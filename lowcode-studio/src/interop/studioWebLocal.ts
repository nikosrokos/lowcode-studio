import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { writeUiPathProjectToDir, ExportedStudioWebProject } from './studioProject';
import { isLcsProjectDir } from './projectResolve';

export const STUDIO_WEB_LOCAL_URL = 'https://studio.uipath.com';

export interface StudioWebLocalLink {
  /** Absolute path to the solution root (folder that contains the .uipx) */
  solutionDir: string;
  /** Project folder name inside the solution */
  projectFolder: string;
  solutionId: string;
  projectId: string;
}

export interface StudioWebLocalSyncResult extends ExportedStudioWebProject {
  link: StudioWebLocalLink;
  uipxPath: string;
  created: boolean;
}

interface LcsManifestWithLocal {
  name?: string;
  description?: string;
  studioWebLocal?: StudioWebLocalLink;
  [key: string]: unknown;
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'Project';
}

function readLcsManifest(lcsProjectDir: string): LcsManifestWithLocal {
  const manifestPath = path.join(lcsProjectDir, 'project.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Open/select a LowCode Studio project folder (with project.json).');
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as LcsManifestWithLocal;
}

function writeLcsManifest(lcsProjectDir: string, manifest: LcsManifestWithLocal): void {
  fs.writeFileSync(
    path.join(lcsProjectDir, 'project.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );
}

export function getStudioWebLocalLink(lcsProjectDir: string): StudioWebLocalLink | undefined {
  try {
    const link = readLcsManifest(lcsProjectDir).studioWebLocal;
    if (!link?.solutionDir || !link.projectFolder) {
      return undefined;
    }
    return link;
  } catch {
    return undefined;
  }
}

export function isStudioWebLocalLinked(lcsProjectDir: string): boolean {
  const link = getStudioWebLocalLink(lcsProjectDir);
  if (!link) {
    return false;
  }
  return fs.existsSync(link.solutionDir) && findUipx(link.solutionDir) !== undefined;
}

function findUipx(solutionDir: string): string | undefined {
  if (!fs.existsSync(solutionDir)) {
    return undefined;
  }
  try {
    const named = path.join(solutionDir, `${path.basename(solutionDir)}.uipx`);
    if (fs.existsSync(named)) {
      return named;
    }
    const hit = fs.readdirSync(solutionDir).find((f) => f.endsWith('.uipx'));
    return hit ? path.join(solutionDir, hit) : undefined;
  } catch {
    return undefined;
  }
}

function readOrCreateUipx(
  solutionDir: string,
  solutionName: string,
  existingSolutionId?: string
): { uipxPath: string; data: Record<string, unknown>; created: boolean } {
  const existing = findUipx(solutionDir);
  if (existing) {
    try {
      const data = JSON.parse(fs.readFileSync(existing, 'utf8')) as Record<string, unknown>;
      return { uipxPath: existing, data, created: false };
    } catch {
      // rewrite below
    }
  }
  const uipxPath = path.join(solutionDir, `${solutionName}.uipx`);
  const data = {
    DocVersion: '1.0.0',
    StudioMinVersion: '2025.10.0',
    SolutionId: existingSolutionId || crypto.randomUUID(),
    name: solutionName,
    description: `${solutionName} — LowCode Studio ↔ Studio Web Local Workspace`,
    Projects: [] as Array<Record<string, unknown>>
  };
  return { uipxPath, data, created: true };
}

function ensureProjectInUipx(
  data: Record<string, unknown>,
  projectFolder: string,
  projectId: string
): void {
  const projects = Array.isArray(data.Projects) ? [...(data.Projects as Array<Record<string, unknown>>)] : [];
  const rel = `${projectFolder}/project.json`;
  const idx = projects.findIndex(
    (p) =>
      String(p.ProjectRelativePath || '') === rel ||
      String(p.ProjectRelativePath || '').startsWith(`${projectFolder}/`)
  );
  if (idx >= 0) {
    const prev = projects[idx];
    projects[idx] = {
      ...prev,
      Id: String(prev.Id || projectId),
      ProjectRelativePath: rel,
      Type: prev.Type || 'Process'
    };
  } else {
    projects.push({
      Id: projectId,
      ProjectRelativePath: rel,
      Type: 'Process'
    });
  }
  data.Projects = projects;
}

/**
 * Create or open a Studio Web Local Workspace solution and link the LCS project to it.
 * Writes the UiPath project under solutionDir/projectFolder and registers it in .uipx.
 */
export function linkStudioWebLocalWorkspace(
  lcsProjectDir: string,
  options: {
    /** Existing solution folder, or parent where a new solution folder will be created */
    targetDir: string;
    mode: 'create' | 'open';
    solutionName?: string;
  }
): StudioWebLocalSyncResult {
  const manifest = readLcsManifest(lcsProjectDir);
  const projectName = sanitizeName(manifest.name || path.basename(lcsProjectDir));
  const solutionName = sanitizeName(options.solutionName || projectName);

  let solutionDir: string;
  let created = false;
  if (options.mode === 'create') {
    solutionDir = path.join(options.targetDir, solutionName);
    if (!fs.existsSync(solutionDir)) {
      fs.mkdirSync(solutionDir, { recursive: true });
      created = true;
    } else if (!findUipx(solutionDir)) {
      created = true;
    }
  } else {
    solutionDir = options.targetDir;
    if (!fs.existsSync(solutionDir)) {
      throw new Error(`Solution folder not found: ${solutionDir}`);
    }
  }

  const prev = manifest.studioWebLocal;
  const projectFolder = sanitizeName(prev?.projectFolder || projectName);
  const projectId = prev?.projectId || crypto.randomUUID();
  const { uipxPath, data, created: uipxCreated } = readOrCreateUipx(
    solutionDir,
    solutionName,
    prev?.solutionId
  );
  created = created || uipxCreated;

  const solutionId = String(data.SolutionId || prev?.solutionId || crypto.randomUUID());
  data.SolutionId = solutionId;
  if (!data.name) {
    data.name = solutionName;
  }
  ensureProjectInUipx(data, projectFolder, projectId);
  fs.writeFileSync(uipxPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const projectDir = path.join(solutionDir, projectFolder);
  // Portable is required for Studio Web Local Workspace on Mac.
  // Windows-target projects show an error icon and cannot be opened/edited there.
  const exported = writeUiPathProjectToDir(lcsProjectDir, projectDir, {
    // Keep markdown guides at solution root only — avoid extra files in the RPA project
    writeReadme: false,
    targetFramework: 'Portable'
  });

  const link: StudioWebLocalLink = {
    solutionDir,
    projectFolder,
    solutionId,
    projectId
  };
  manifest.studioWebLocal = link;
  writeLcsManifest(lcsProjectDir, manifest);

  // Guide next to solution for first open
  fs.writeFileSync(
    path.join(solutionDir, 'OPEN_IN_STUDIO_WEB_LOCAL.md'),
    `# Open in Studio Web Local Workspace

This folder is a **UiPath solution** linked from LowCode Studio.

1. Go to [${STUDIO_WEB_LOCAL_URL}](${STUDIO_WEB_LOCAL_URL})
2. Open **Local Workspace**
3. **Open solution** → select this folder (\`${path.basename(solutionDir)}\`)
4. Allow the browser to edit files when prompted

LowCode Studio syncs \`.xaml\` + \`project.json\` into \`${projectFolder}/\` every time you **Save** a workflow.
The linked project uses \`targetFramework: Portable\` so Studio Web can open it on Mac (Windows-target projects are blocked in Studio Web on Mac).

No \`.uip\` export is required for this loop.
`,
    'utf8'
  );

  return {
    ...exported,
    targetDir: projectDir,
    link,
    uipxPath,
    created
  };
}

/**
 * Sync the LCS project into its linked Studio Web Local Workspace project folder.
 * No-op-friendly: throws if not linked.
 */
export function syncToStudioWebLocal(lcsProjectDir: string): StudioWebLocalSyncResult {
  const link = getStudioWebLocalLink(lcsProjectDir);
  if (!link) {
    throw new Error(
      'This project is not linked to a Studio Web Local Workspace. Run Connect / Open Local Workspace first.'
    );
  }
  if (!fs.existsSync(link.solutionDir)) {
    throw new Error(
      `Linked Studio Web solution folder is missing: ${link.solutionDir}. Re-run Connect to recreate it.`
    );
  }

  const solutionName = path.basename(link.solutionDir);
  const { uipxPath, data } = readOrCreateUipx(link.solutionDir, solutionName, link.solutionId);
  data.SolutionId = link.solutionId || data.SolutionId;
  ensureProjectInUipx(data, link.projectFolder, link.projectId);
  fs.writeFileSync(uipxPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const projectDir = path.join(link.solutionDir, link.projectFolder);
  const exported = writeUiPathProjectToDir(lcsProjectDir, projectDir, {
    writeReadme: false,
    targetFramework: 'Portable'
  });

  return {
    ...exported,
    targetDir: projectDir,
    link,
    uipxPath,
    created: false
  };
}

export function trySyncToStudioWebLocal(
  lcsProjectDir: string
): StudioWebLocalSyncResult | undefined {
  if (!getStudioWebLocalLink(lcsProjectDir)) {
    return undefined;
  }
  return syncToStudioWebLocal(lcsProjectDir);
}

/** Remove studioWebLocal link from LCS project.json (does not delete solution files). */
export function unlinkStudioWebLocalWorkspace(lcsProjectDir: string): boolean {
  if (!isLcsProjectDir(lcsProjectDir)) {
    return false;
  }
  const manifest = readLcsManifest(lcsProjectDir);
  if (!manifest.studioWebLocal) {
    return false;
  }
  delete manifest.studioWebLocal;
  writeLcsManifest(lcsProjectDir, manifest);
  return true;
}

export interface StudioWebOpenabilityReport {
  ok: boolean;
  solutionDir: string;
  uipxPath?: string;
  projectDir?: string;
  mainXaml?: string;
  workflows: string[];
  errors: string[];
}

/**
 * Validate that a linked (or just-created) solution has the files Studio Web
 * Local Workspace needs to open the solution and its RPA workflows.
 */
export function validateStudioWebLocalOpenability(
  lcsProjectDir: string
): StudioWebOpenabilityReport {
  const errors: string[] = [];
  const link = getStudioWebLocalLink(lcsProjectDir);
  if (!link) {
    return {
      ok: false,
      solutionDir: '',
      workflows: [],
      errors: ['Project is not linked to a Studio Web Local Workspace']
    };
  }
  const uipxPath = findUipx(link.solutionDir);
  if (!uipxPath) {
    errors.push(`Missing .uipx in ${link.solutionDir}`);
  }
  const projectDir = path.join(link.solutionDir, link.projectFolder);
  const projectJson = path.join(projectDir, 'project.json');
  if (!fs.existsSync(projectJson)) {
    errors.push(`Missing project.json at ${projectJson}`);
  }
  let mainXaml = '';
  const workflows: string[] = [];
  if (fs.existsSync(projectJson)) {
    try {
      const pj = JSON.parse(fs.readFileSync(projectJson, 'utf8')) as {
        main?: string;
        targetFramework?: string;
      };
      mainXaml = pj.main || 'Main.xaml';
      if (pj.targetFramework === 'Windows' || pj.targetFramework === 'WindowsLegacy') {
        errors.push(
          `Project targets ${pj.targetFramework} — Studio Web Local Workspace on Mac cannot open it. Re-Connect / Save to rewrite as Portable.`
        );
      } else if (pj.targetFramework && pj.targetFramework !== 'Portable') {
        errors.push(`Unexpected targetFramework "${pj.targetFramework}" (expected Portable)`);
      }
      const mainAbs = path.join(projectDir, mainXaml);
      if (!fs.existsSync(mainAbs)) {
        errors.push(`Main workflow missing: ${mainXaml}`);
      } else {
        const text = fs.readFileSync(mainAbs, 'utf8');
        if (!text.includes('xmlns') || !text.includes('Activity')) {
          errors.push(`Main workflow does not look like openable XAML: ${mainXaml}`);
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Invalid project.json');
    }
  }
  if (uipxPath) {
    try {
      const uipx = JSON.parse(fs.readFileSync(uipxPath, 'utf8')) as {
        Projects?: Array<{ ProjectRelativePath?: string }>;
      };
      for (const p of uipx.Projects || []) {
        const rel = String(p.ProjectRelativePath || '');
        if (!rel || !fs.existsSync(path.join(link.solutionDir, rel))) {
          errors.push(`uipx project path missing: ${rel || '(empty)'}`);
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Invalid .uipx');
    }
  }
  const stack = [projectDir];
  while (stack.length && fs.existsSync(projectDir)) {
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
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.xaml')) {
        workflows.push(path.relative(projectDir, full).replace(/\\/g, '/'));
      }
    }
  }
  workflows.sort();
  if (!workflows.length) {
    errors.push('No .xaml workflows found in the linked project folder');
  }
  return {
    ok: errors.length === 0,
    solutionDir: link.solutionDir,
    uipxPath,
    projectDir,
    mainXaml,
    workflows,
    errors
  };
}

export function studioWebLocalGuideMarkdown(): string {
  return `# LowCode Studio ↔ Studio Web Local Workspace

Design in LowCode Studio. Open the linked solution in Studio Web **Local Workspace**.
**Save** in LowCode Studio syncs \`.xaml\` into that folder — no \`.uip\` export needed.

## Loop

\`\`\`
LowCode Studio (design + dry-run)
   → Connect / Open Studio Web Local Workspace  (once: create or open solution folder)
   → Open that folder in Studio Web → Local Workspace
   → Save in LowCode Studio  → files sync on disk → Studio Web sees updates
   → Publish from Studio Web when ready
\`\`\`

## First-time connect

1. Select your LowCode Studio project
2. Run **Connect / Open Studio Web Local Workspace**
3. **Create new** solution folder (or **Open existing** \`.uipx\` solution)
4. Reveal the folder, then in Studio Web: Local Workspace → Open solution → Allow file access

## Notes

- Link is stored in LowCode Studio \`project.json\` → \`studioWebLocal\`
- Linked UiPath project is always **Portable** (required to open in Studio Web on Mac)
- Sync runs automatically on Save (disable via setting \`lowcodeStudio.syncStudioWebOnSave\`)
- Classic **Export Windows project folder** / legacy \`.uip\` remains for Windows Desktop / robot handoff

> Not an official UiPath product.
`;
}
