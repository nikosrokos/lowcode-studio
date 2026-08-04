import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import {
  createProjectManifest,
  parseWorkflow,
  stringifyWorkflow,
  WorkflowDocument
} from '../models/workflow';
import { importXaml, ImportWarning } from './xamlImport';
import { exportUiPathProjectJson, exportWorkflowToXaml } from './xamlExport';
import { resolveUiPathTarget } from './windowsTarget';
import {
  collectActivityTypes,
  resolveUiPathDependencies
} from './uipathDependencies';
import {
  collectCustomNugetPackages,
  loadProjectCustomActivities
} from '../models/customActivities';

export interface ImportedStudioProject {
  projectName: string;
  targetDir: string;
  workflows: string[];
  mainWorkflow: string;
  warnings: ImportWarning[];
  sourceKind: 'folder' | 'nupkg';
  uipathDependencies: Record<string, string>;
}

export interface ExportedStudioWebProject {
  targetDir: string;
  mainXaml: string;
  files: string[];
  dependencies: Record<string, string>;
}

export function isUiPathProjectDir(dir: string): boolean {
  const manifestPath = path.join(dir, 'project.json');
  if (!fs.existsSync(manifestPath)) {
    return false;
  }
  try {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      main?: string;
      schemaVersion?: string | number;
      dependencies?: unknown;
    };
    // UiPath projects have dependencies / main .xaml; LCS has schemaVersion "1.0" and .lcs.json
    if (typeof json.main === 'string' && json.main.endsWith('.xaml')) {
      return true;
    }
    if (json.dependencies && typeof json.dependencies === 'object') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function importUiPathProjectFolder(
  sourceDir: string,
  destinationParent: string
): ImportedStudioProject {
  if (!isUiPathProjectDir(sourceDir)) {
    throw new Error('Selected folder does not look like a UiPath Studio project (project.json + .xaml).');
  }

  const manifest = JSON.parse(
    fs.readFileSync(path.join(sourceDir, 'project.json'), 'utf8')
  ) as {
    name?: string;
    main?: string;
    dependencies?: Record<string, string>;
  };

  const projectName = sanitizeName(manifest.name || path.basename(sourceDir));
  const targetDir = uniqueDir(destinationParent, projectName);
  fs.mkdirSync(targetDir, { recursive: true });

  const xamlFiles = listFiles(sourceDir, (f) => f.endsWith('.xaml'));
  if (!xamlFiles.length) {
    throw new Error('No .xaml workflows found in the UiPath project.');
  }

  const warnings: ImportWarning[] = [];
  const workflows: string[] = [];
  const importedDocs: WorkflowDocument[] = [];
  const mainXaml = manifest.main && manifest.main.endsWith('.xaml')
    ? manifest.main
    : path.basename(xamlFiles[0]);

  for (const abs of xamlFiles) {
    const rel = path.relative(sourceDir, abs).replace(/\\/g, '/');
    const lcsRel = rel.replace(/\.xaml$/i, '.lcs.json');
    const name = path.basename(lcsRel, '.lcs.json');
    const text = fs.readFileSync(abs, 'utf8');
    const imported = importXaml(text, name);
    importedDocs.push(imported.workflow);
    warnings.push(
      ...imported.warnings.map((w) => ({
        message: `${rel}: ${w.message}`
      }))
    );
    const outPath = path.join(targetDir, lcsRel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, stringifyWorkflow(imported.workflow), 'utf8');
    workflows.push(lcsRel);
  }

  // Copy helpful non-workflow assets
  for (const rel of ['Data/Config.xlsx', 'Data/Config.json', 'README.md', '.gitignore']) {
    const src = path.join(sourceDir, rel);
    if (fs.existsSync(src) && fs.statSync(src).isFile()) {
      const dest = path.join(targetDir, rel.replace(/Config\.xlsx$/i, 'Config.imported.xlsx'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }

  const uipathDependencies = resolveUiPathDependencies({
    activityTypes: collectActivityTypes(importedDocs),
    preserved: manifest.dependencies || {},
    includeBaseline: true
  });

  const mainWorkflow = mainXaml.replace(/\.xaml$/i, '.lcs.json');
  fs.writeFileSync(
    path.join(targetDir, 'project.json'),
    JSON.stringify(
      {
        ...createProjectManifest(projectName, mainWorkflow, workflows, 'blank'),
        description: `${projectName} imported from UiPath Studio project`,
        uipathDependencies,
        source: {
          kind: 'uipath-folder',
          originalMain: mainXaml
        }
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  fs.writeFileSync(
    path.join(targetDir, 'IMPORT_NOTES.md'),
    buildImportNotes(projectName, warnings, 'folder', uipathDependencies),
    'utf8'
  );

  return {
    projectName,
    targetDir,
    workflows,
    mainWorkflow,
    warnings,
    sourceKind: 'folder',
    uipathDependencies
  };
}

export function importUiPathNupkg(
  nupkgPath: string,
  destinationParent: string
): ImportedStudioProject {
  if (!fs.existsSync(nupkgPath)) {
    throw new Error(`Package not found: ${nupkgPath}`);
  }

  const zip = new AdmZip(nupkgPath);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-nupkg-'));
  try {
    zip.extractAllTo(tempDir, true);

    // NuGet layout: lib/net*/**, content/**, or flat project files
    const projectDir =
      findProjectDir(tempDir) ||
      findProjectDir(path.join(tempDir, 'content')) ||
      findProjectDir(path.join(tempDir, 'lib')) ||
      tempDir;

    // Sometimes sources are under contentFiles or a nested folder
    if (!isUiPathProjectDir(projectDir)) {
      const xamls = listFiles(tempDir, (f) => f.endsWith('.xaml'));
      if (!xamls.length) {
        throw new Error(
          'This .nupkg has no .xaml sources. Republish from Studio with "Include Sources", or import the original project folder.'
        );
      }
      // Synthesize a project.json if missing
      const rootForXaml = path.dirname(xamls[0]);
      if (!fs.existsSync(path.join(rootForXaml, 'project.json'))) {
        const name = sanitizeName(path.basename(nupkgPath, '.nupkg').replace(/\.\d+\.\d+.*/, ''));
        fs.writeFileSync(
          path.join(rootForXaml, 'project.json'),
          JSON.stringify(
            {
              name,
              main: path.basename(xamls[0]),
              dependencies: {},
              schemaVersion: '4.0',
              targetFramework: 'Portable'
            },
            null,
            2
          ),
          'utf8'
        );
      }
      const imported = importUiPathProjectFolder(rootForXaml, destinationParent);
      return { ...imported, sourceKind: 'nupkg' as const };
    }

    const imported = importUiPathProjectFolder(projectDir, destinationParent);
    return { ...imported, sourceKind: 'nupkg' as const };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

export function exportToStudioWebProject(
  lcsProjectDir: string,
  destinationParent?: string
): ExportedStudioWebProject {
  const manifestPath = path.join(lcsProjectDir, 'project.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Open/select a LowCode Studio project folder (with project.json).');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    name?: string;
    main?: string;
    workflows?: string[];
    description?: string;
    uipathDependencies?: Record<string, string>;
    uipathTargetFramework?: string;
  };

  const projectName = sanitizeName(manifest.name || path.basename(lcsProjectDir));
  const outDir = uniqueDir(
    destinationParent || path.join(lcsProjectDir, '..'),
    `${projectName}.StudioWeb`
  );
  fs.mkdirSync(outDir, { recursive: true });

  const workflowRels =
    manifest.workflows?.length
      ? manifest.workflows
      : listFiles(lcsProjectDir, (f) => f.endsWith('.lcs.json')).map((f) =>
          path.relative(lcsProjectDir, f).replace(/\\/g, '/')
        );

  const written: string[] = [];
  const docs: WorkflowDocument[] = [];
  for (const rel of workflowRels) {
    const abs = path.join(lcsProjectDir, rel);
    if (!fs.existsSync(abs)) {
      continue;
    }
    const doc = parseWorkflow(fs.readFileSync(abs, 'utf8'));
    docs.push(doc);
    const xamlRel = rel.replace(/\.lcs\.json$/i, '.xaml');
    const xamlAbs = path.join(outDir, xamlRel);
    fs.mkdirSync(path.dirname(xamlAbs), { recursive: true });
    fs.writeFileSync(xamlAbs, exportWorkflowToXaml(doc), 'utf8');
    written.push(xamlRel);
  }

  const mainLcs = manifest.main || written[0]?.replace(/\.xaml$/i, '.lcs.json');
  const mainXaml = (mainLcs || 'Main.lcs.json').replace(/\.lcs\.json$/i, '.xaml');

  const activityTypes = collectActivityTypes(docs);
  const customActivities = loadProjectCustomActivities(lcsProjectDir);
  const dependencies = resolveUiPathDependencies({
    activityTypes,
    preserved: manifest.uipathDependencies || {},
    includeBaseline: true,
    extraPackages: collectCustomNugetPackages(customActivities, activityTypes)
  });

  const targetFramework = resolveUiPathTarget(manifest.uipathTargetFramework);
  const requiresUserInteraction = activityTypes.some(
    (t) => t.startsWith('UI.') || t.startsWith('Imported.')
  );

  fs.writeFileSync(
    path.join(outDir, 'project.json'),
    exportUiPathProjectJson({
      name: projectName,
      description: manifest.description,
      main: mainXaml,
      dependencies,
      targetFramework,
      requiresUserInteraction
    }),
    'utf8'
  );
  written.push('project.json');

  // Copy config + scenario files (Studio Web resources / team handoff)
  for (const rel of [
    'Data/Config.json',
    'Data/Config.xlsx',
    'Data/Test/scenarios.json',
    'activities.custom.json'
  ]) {
    const abs = path.join(lcsProjectDir, rel);
    if (!fs.existsSync(abs)) {
      continue;
    }
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
    written.push(rel);
  }

  const depList = Object.entries(dependencies)
    .map(([name, ver]) => `- \`${name}\`: ${ver}`)
    .join('\n');

  fs.writeFileSync(
    path.join(outDir, 'README_STUDIO_WEB.md'),
    `# ${projectName} — Studio export (Windows)

Exported from **LowCode Studio** as a **Windows** UiPath project (\`targetFramework: ${targetFramework}\`).

## Run on a Windows machine

1. Open the project in **UiPath Studio Desktop (Windows)** or import the \`.uip\` in Studio Web and run on a **Windows robot**
2. Restore NuGet packages from \`project.json\`
3. UI activities use **classic Windows selectors** (\`<html>/<webctrl>\`, \`<wnd>\`, …) — capture/refine them on Windows with UI Explorer
4. Publish to Orchestrator and run from a Windows unattended/attended robot

Main entry: \`${mainXaml}\`

## Activity packages (dependencies)

${depList}
`,
    'utf8'
  );
  written.push('README_STUDIO_WEB.md');

  return {
    targetDir: outDir,
    mainXaml,
    files: written,
    dependencies
  };
}

export function exportSingleWorkflowToXamlFile(
  doc: WorkflowDocument,
  destinationFile: string
): void {
  fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
  fs.writeFileSync(destinationFile, exportWorkflowToXaml(doc), 'utf8');
}

function findProjectDir(root: string): string | undefined {
  if (!fs.existsSync(root)) {
    return undefined;
  }
  if (isUiPathProjectDir(root)) {
    return root;
  }
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const full = path.join(current, entry.name);
      if (isUiPathProjectDir(full)) {
        return full;
      }
      stack.push(full);
    }
  }
  return undefined;
}

function listFiles(root: string, predicate: (file: string) => boolean): string[] {
  const results: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'bin' || entry.name === 'obj') {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile() && predicate(full)) {
        results.push(full);
      }
    }
  }
  return results.sort();
}

function uniqueDir(parent: string, name: string): string {
  let candidate = path.join(parent, name);
  let i = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parent, `${name}_${i++}`);
  }
  return candidate;
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'ImportedProject';
}

function buildImportNotes(
  projectName: string,
  warnings: ImportWarning[],
  kind: string,
  dependencies: Record<string, string> = {}
): string {
  const deps = Object.entries(dependencies)
    .map(([name, ver]) => `- \`${name}\`: ${ver}`)
    .join('\n');
  return `# Import notes — ${projectName}

Source: UiPath ${kind}

This project was converted to LowCode Studio \`.lcs.json\` workflows.

## Warnings (${warnings.length})

${warnings.length ? warnings.map((w) => `- ${w.message}`).join('\n') : '- None'}

## Preserved / resolved UiPath activity packages

${deps || '- (none)'}

These are stored in \`project.json\` → \`uipathDependencies\` and written again on **Export for Studio Web**.

## Next steps

1. Open the main \`.lcs.json\` in the designer
2. Replace any \`Imported.*\` placeholder activities
3. Dry Run (F5)
4. When ready for Studio Web: **LowCode Studio: Export for Studio Web**
`;
}
