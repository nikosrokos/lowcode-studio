import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  isUiPathProjectDir,
  writeUiPathProjectToDir,
  ExportedStudioWebProject
} from './studioProject';
import { findAllLcsProjects, isLcsProjectDir } from './projectResolve';
import { importXaml, ImportWarning } from './xamlImport';
import {
  collectActivityTypes,
  resolveUiPathDependencies
} from './uipathDependencies';
import {
  createProjectManifest,
  stringifyWorkflow,
  WorkflowDocument
} from '../models/workflow';

export const STUDIO_WEB_LOCAL_URL = 'https://studio.uipath.com';
/** Kept under the LCS project — overwritten .lcs.json / .xaml copies before sync. */
export const SYNC_TRASH_DIR = '.lcs-sync-trash';
const MAX_TRASH_GENERATIONS = 10;

export interface StudioWebFileFingerprint {
  lcsHash?: string;
  xamlHash?: string;
  syncedAt?: string;
}

export interface StudioWebLocalLink {
  /** Absolute path to the solution root (folder that contains the .uipx) */
  solutionDir: string;
  /** Project folder name inside the solution */
  projectFolder: string;
  solutionId: string;
  projectId: string;
  /** ISO time of last successful bidirectional sync */
  lastSyncedAt?: string;
  /** Per-workflow content hashes after last sync (detect Studio Web edits). */
  files?: Record<string, StudioWebFileFingerprint>;
}

export interface StudioWebLocalSyncResult extends ExportedStudioWebProject {
  link: StudioWebLocalLink;
  uipxPath: string;
  created: boolean;
  /** .lcs.json rels pulled from Studio Web before push */
  pulled?: string[];
  /** Workflows where both sides changed — LCS Save won; Studio Web copy in trash */
  conflicts?: string[];
  backups?: string[];
}

export interface StudioWebPullResult {
  updated: string[];
  skipped: string[];
  conflicts: string[];
  backups: string[];
  warnings: ImportWarning[];
  created: string[];
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

/** True when folder is a Studio Web Local Workspace solution (contains a .uipx). */
export function isStudioWebSolutionDir(folder: string): boolean {
  return findUipx(folder) !== undefined;
}

export function findUipx(solutionDir: string): string | undefined {
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

export interface StudioWebRpaProjectRef {
  projectDir: string;
  projectFolder: string;
  solutionId: string;
  projectId: string;
  projectName: string;
  mainXaml: string;
}

/** Resolve the RPA project folder inside a Studio Web .uipx solution. */
export function resolveStudioWebRpaProject(
  solutionDir: string
): StudioWebRpaProjectRef | undefined {
  if (!fs.existsSync(solutionDir)) {
    return undefined;
  }
  const uipxPath = findUipx(solutionDir);
  let solutionId = '';
  let projectId = '';
  let projectFolder = '';
  if (uipxPath) {
    try {
      const data = JSON.parse(fs.readFileSync(uipxPath, 'utf8')) as {
        SolutionId?: string;
        Projects?: Array<{ Id?: string; ProjectRelativePath?: string }>;
      };
      solutionId = String(data.SolutionId || '');
      const first = (data.Projects || []).find((p) => p.ProjectRelativePath);
      if (first?.ProjectRelativePath) {
        const rel = String(first.ProjectRelativePath).replace(/\\/g, '/');
        projectFolder = rel.includes('/')
          ? rel.split('/')[0]
          : path.basename(path.dirname(path.join(solutionDir, rel)));
        if (rel.endsWith('project.json') && !rel.includes('/')) {
          projectFolder = '.';
        }
        projectId = String(first.Id || '');
      }
    } catch {
      // fall through to scan
    }
  }

  let projectDir =
    projectFolder && projectFolder !== '.'
      ? path.join(solutionDir, projectFolder)
      : projectFolder === '.'
        ? solutionDir
        : '';

  if (!projectDir || !isUiPathProjectDir(projectDir)) {
    // Scan one level (and shallow nested) for a UiPath project with .xaml
    const stack = [solutionDir];
    let found: string | undefined;
    while (stack.length && !found) {
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
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === '.local' ||
          entry.name === 'bin' ||
          entry.name === 'obj'
        ) {
          continue;
        }
        const full = path.join(current, entry.name);
        if (isUiPathProjectDir(full) && listStudioWebXamlRels(full).length) {
          found = full;
          break;
        }
        if (path.relative(solutionDir, full).split(path.sep).length < 3) {
          stack.push(full);
        }
      }
    }
    if (!found && isUiPathProjectDir(solutionDir) && listStudioWebXamlRels(solutionDir).length) {
      found = solutionDir;
    }
    if (!found) {
      return undefined;
    }
    projectDir = found;
    projectFolder =
      path.resolve(projectDir) === path.resolve(solutionDir)
        ? '.'
        : path.relative(solutionDir, projectDir).replace(/\\/g, '/');
  }

  let mainXaml = 'Main.xaml';
  let projectName = path.basename(projectDir === solutionDir ? solutionDir : projectDir);
  try {
    const pj = JSON.parse(
      fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8')
    ) as { name?: string; main?: string };
    if (pj.main) {
      mainXaml = pj.main;
    }
    if (pj.name) {
      projectName = sanitizeName(pj.name);
    }
  } catch {
    // defaults
  }
  if (!projectId) {
    projectId = crypto.randomUUID();
  }
  if (!solutionId) {
    solutionId = crypto.randomUUID();
  }

  return {
    projectDir,
    projectFolder: projectFolder || path.basename(projectDir),
    solutionId,
    projectId,
    projectName,
    mainXaml
  };
}

/** Find LCS projects already linked to this Studio Web solution. */
export function findLcsProjectsForSolution(
  solutionDir: string,
  searchRoots: string[] = []
): string[] {
  const resolved = path.resolve(solutionDir);
  const roots = [
    ...searchRoots,
    path.dirname(resolved),
    resolved
  ].filter((r, i, arr) => r && arr.indexOf(r) === i);
  const hits: string[] = [];
  for (const root of roots) {
    for (const lcs of findAllLcsProjects([root])) {
      const link = getStudioWebLocalLink(lcs);
      if (link && path.resolve(link.solutionDir) === resolved && !hits.includes(lcs)) {
        hits.push(lcs);
      }
    }
  }
  // Also: sibling folder named "<solution>.lcs" or "<projectName>"
  const siblingLcs = path.join(path.dirname(resolved), `${path.basename(resolved)}.lcs`);
  if (isLcsProjectDir(siblingLcs) && !hits.includes(siblingLcs)) {
    hits.push(siblingLcs);
  }
  return hits;
}

export interface AdoptedStudioWebSolution {
  lcsProjectDir: string;
  solutionDir: string;
  projectFolder: string;
  mainWorkflow: string;
  mainWorkflowAbs: string;
  workflows: string[];
  created: boolean;
  imported: string[];
  warnings: ImportWarning[];
}

/**
 * Open a Studio Web .uipx solution as an LCS project:
 * import all .xaml → .lcs.json, write the Local Workspace link, record fingerprints.
 * Does **not** overwrite Studio Web files.
 */
export function adoptStudioWebSolutionAsLcsProject(
  solutionDir: string,
  options: {
    /** Reuse this LCS folder when set */
    lcsProjectDir?: string;
    /** Parent for a new LCS folder (default: sibling of the solution) */
    destinationParent?: string;
    searchRoots?: string[];
  } = {}
): AdoptedStudioWebSolution {
  if (!isStudioWebSolutionDir(solutionDir)) {
    throw new Error(
      'That folder is not a Studio Web Local Workspace (no .uipx found).'
    );
  }
  const rpa = resolveStudioWebRpaProject(solutionDir);
  if (!rpa) {
    throw new Error(
      'No RPA project (.xaml + project.json) found inside that Studio Web solution.'
    );
  }

  let lcsProjectDir = options.lcsProjectDir;
  let created = false;
  if (lcsProjectDir && !isLcsProjectDir(lcsProjectDir)) {
    throw new Error(`Not a LowCode Studio project: ${lcsProjectDir}`);
  }
  if (!lcsProjectDir) {
    const existing = findLcsProjectsForSolution(solutionDir, options.searchRoots || []);
    if (existing[0]) {
      lcsProjectDir = existing[0];
    }
  }
  if (!lcsProjectDir) {
    const parent = options.destinationParent || path.dirname(solutionDir);
    const baseName = `${sanitizeName(rpa.projectName)}.lcs`;
    lcsProjectDir = path.join(parent, baseName);
    if (fs.existsSync(lcsProjectDir) && !isLcsProjectDir(lcsProjectDir)) {
      let i = 2;
      while (fs.existsSync(`${lcsProjectDir}-${i}`)) {
        i += 1;
      }
      lcsProjectDir = `${lcsProjectDir}-${i}`;
    }
    if (!fs.existsSync(lcsProjectDir)) {
      fs.mkdirSync(lcsProjectDir, { recursive: true });
      created = true;
    }
  }

  const xamlRels = listStudioWebXamlRels(rpa.projectDir);
  if (!xamlRels.length) {
    throw new Error('No .xaml workflows found in the Studio Web project.');
  }

  const warnings: ImportWarning[] = [];
  const imported: string[] = [];
  const workflows: string[] = [];
  const docs: WorkflowDocument[] = [];
  const fingerprints: Record<string, StudioWebFileFingerprint> = {};
  const now = new Date().toISOString();

  for (const xamlRel of xamlRels) {
    const lcsRel = xamlRel.replace(/\.xaml$/i, '.lcs.json');
    const xamlAbs = path.join(rpa.projectDir, xamlRel);
    const lcsAbs = path.join(lcsProjectDir, lcsRel);
    const xamlText = fs.readFileSync(xamlAbs, 'utf8');
    const name = path.basename(lcsRel, '.lcs.json');
    const result = importXaml(xamlText, name);
    docs.push(result.workflow);
    warnings.push(
      ...result.warnings.map((w) => ({ message: `${xamlRel}: ${w.message}` }))
    );
    const nextJson = stringifyWorkflow(result.workflow);
    const existed = fs.existsSync(lcsAbs);
    fs.mkdirSync(path.dirname(lcsAbs), { recursive: true });
    // Prefer Studio Web on adopt (fresh open) — always write imported content
    if (existed) {
      const stamp = now.replace(/[:.]/g, '-');
      backupToSyncTrash(lcsProjectDir, lcsAbs, stamp, lcsRel);
    } else {
      imported.push(lcsRel);
    }
    fs.writeFileSync(lcsAbs, nextJson, 'utf8');
    workflows.push(lcsRel);
    fingerprints[lcsRel] = {
      lcsHash: contentHash(nextJson),
      xamlHash: contentHash(xamlText),
      syncedAt: now
    };
  }

  // Helpful assets
  for (const rel of ['Data/Config.xlsx', 'Data/Config.json', 'README.md', '.gitignore']) {
    const src = path.join(rpa.projectDir, rel);
    if (fs.existsSync(src) && fs.statSync(src).isFile()) {
      const destRel = rel.replace(/Config\.xlsx$/i, 'Config.imported.xlsx');
      const dest = path.join(lcsProjectDir, destRel);
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }
  }

  let uipathDependencies: Record<string, string> = {};
  try {
    const swPj = JSON.parse(
      fs.readFileSync(path.join(rpa.projectDir, 'project.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    uipathDependencies = resolveUiPathDependencies({
      activityTypes: collectActivityTypes(docs),
      preserved: swPj.dependencies || {},
      includeBaseline: true
    });
  } catch {
    uipathDependencies = resolveUiPathDependencies({
      activityTypes: collectActivityTypes(docs),
      preserved: {},
      includeBaseline: true
    });
  }

  const mainWorkflow = (rpa.mainXaml || 'Main.xaml').replace(/\.xaml$/i, '.lcs.json');
  const link: StudioWebLocalLink = {
    solutionDir: path.resolve(solutionDir),
    projectFolder: rpa.projectFolder,
    solutionId: rpa.solutionId,
    projectId: rpa.projectId,
    lastSyncedAt: now,
    files: fingerprints
  };

  const prevName = (() => {
    try {
      return readLcsManifest(lcsProjectDir).name;
    } catch {
      return undefined;
    }
  })();

  const manifest = {
    ...createProjectManifest(
      sanitizeName(prevName || rpa.projectName),
      mainWorkflow,
      workflows,
      'blank'
    ),
    description: `${rpa.projectName} — linked Studio Web Local Workspace`,
    uipathDependencies,
    studioWebLocal: link,
    source: {
      kind: 'studio-web-local',
      solutionDir: link.solutionDir,
      projectFolder: link.projectFolder
    }
  };
  writeLcsManifest(lcsProjectDir, manifest);

  // Keep .uipx registration pointing at the same RPA folder (no overwrite of .xaml)
  const solutionName = sanitizeName(path.basename(solutionDir));
  const { uipxPath, data } = readOrCreateUipx(solutionDir, solutionName, rpa.solutionId);
  data.SolutionId = rpa.solutionId;
  if (!data.name) {
    data.name = solutionName;
  }
  if (rpa.projectFolder && rpa.projectFolder !== '.') {
    ensureProjectInUipx(data, rpa.projectFolder, rpa.projectId);
  }
  fs.writeFileSync(uipxPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  fs.writeFileSync(
    path.join(solutionDir, 'OPEN_IN_STUDIO_WEB_LOCAL.md'),
    `# Open in Studio Web Local Workspace

This folder is a **UiPath solution** linked from LowCode Studio.

1. Go to [${STUDIO_WEB_LOCAL_URL}](${STUDIO_WEB_LOCAL_URL})
2. Open **Local Workspace**
3. **Open solution** → select this folder (\`${path.basename(solutionDir)}\`)
4. Allow the browser to edit files when prompted

**Bidirectional sync on Save:**
- Edits in LowCode Studio → push \`.xaml\` into this folder
- Edits in Studio Web → pulled back into \`.lcs.json\` when you Save (or run **Pull from Studio Web Local**)
- Overwritten copies land in the LCS project under \`.lcs-sync-trash/\`

The linked project uses \`targetFramework: Portable\` so Studio Web can open it on Mac.

No \`.uip\` export is required for this loop.
`,
    'utf8'
  );

  const mainWorkflowAbs = path.join(lcsProjectDir, mainWorkflow);
  return {
    lcsProjectDir,
    solutionDir: link.solutionDir,
    projectFolder: link.projectFolder,
    mainWorkflow,
    mainWorkflowAbs: fs.existsSync(mainWorkflowAbs)
      ? mainWorkflowAbs
      : path.join(lcsProjectDir, workflows[0]),
    workflows,
    created,
    imported,
    warnings
  };
}

/**
 * Create or open a Studio Web Local Workspace solution and link the LCS project to it.
 * Writes the UiPath project under solutionDir/projectFolder and registers it in .uipx.
 * When **opening** an existing solution that already has .xaml, imports into LCS instead of overwriting Studio Web.
 */
export function linkStudioWebLocalWorkspace(
  lcsProjectDir: string,
  options: {
    /** Existing solution folder, or parent where a new solution folder will be created */
    targetDir: string;
    mode: 'create' | 'open';
    solutionName?: string;
    /** Open mode: prefer existing Studio Web .xaml over LCS push (default true). */
    preferStudioWeb?: boolean;
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

  const preferStudioWeb =
    options.mode === 'open' && options.preferStudioWeb !== false;
  const existingRpa = preferStudioWeb ? resolveStudioWebRpaProject(solutionDir) : undefined;
  const swHasXaml = Boolean(
    existingRpa && listStudioWebXamlRels(existingRpa.projectDir).length
  );

  // Opening an existing Studio Web solution: adopt/import into LCS, never clobber .xaml
  if (preferStudioWeb && swHasXaml && existingRpa) {
    const adopted = adoptStudioWebSolutionAsLcsProject(solutionDir, {
      lcsProjectDir
    });
    const projectDir = path.join(adopted.solutionDir, adopted.projectFolder);
    const link = getStudioWebLocalLink(lcsProjectDir)!;
    return {
      targetDir: projectDir,
      mainXaml: adopted.mainWorkflow.replace(/\.lcs\.json$/i, '.xaml'),
      files: adopted.workflows.map((w) => w.replace(/\.lcs\.json$/i, '.xaml')),
      dependencies: {},
      link,
      uipxPath: findUipx(solutionDir) || path.join(solutionDir, `${solutionName}.uipx`),
      created: false,
      pulled: adopted.imported.length ? adopted.imported : adopted.workflows
    };
  }

  const prev = manifest.studioWebLocal;
  const projectFolder = sanitizeName(
    existingRpa?.projectFolder && existingRpa.projectFolder !== '.'
      ? existingRpa.projectFolder
      : prev?.projectFolder || projectName
  );
  const projectId = existingRpa?.projectId || prev?.projectId || crypto.randomUUID();
  const { uipxPath, data, created: uipxCreated } = readOrCreateUipx(
    solutionDir,
    solutionName,
    existingRpa?.solutionId || prev?.solutionId
  );
  created = created || uipxCreated;

  const solutionId = String(
    data.SolutionId || existingRpa?.solutionId || prev?.solutionId || crypto.randomUUID()
  );
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
  recordPushFingerprints(lcsProjectDir, projectDir);

  // Guide next to solution for first open
  fs.writeFileSync(
    path.join(solutionDir, 'OPEN_IN_STUDIO_WEB_LOCAL.md'),
    `# Open in Studio Web Local Workspace

This folder is a **UiPath solution** linked from LowCode Studio.

1. Go to [${STUDIO_WEB_LOCAL_URL}](${STUDIO_WEB_LOCAL_URL})
2. Open **Local Workspace**
3. **Open solution** → select this folder (\`${path.basename(solutionDir)}\`)
4. Allow the browser to edit files when prompted

**Bidirectional sync on Save:**
- Edits in LowCode Studio → push \`.xaml\` into this folder
- Edits in Studio Web → pulled back into \`.lcs.json\` when you Save (or run **Pull from Studio Web Local**)
- Overwritten copies land in the LCS project under \`.lcs-sync-trash/\`

The linked project uses \`targetFramework: Portable\` so Studio Web can open it on Mac.

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

function contentHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function trashRoot(lcsProjectDir: string): string {
  return path.join(lcsProjectDir, SYNC_TRASH_DIR);
}

/** Copy a file into .lcs-sync-trash/{stamp}/ before overwrite. Returns backup path or undefined. */
export function backupToSyncTrash(
  lcsProjectDir: string,
  absPath: string,
  stamp: string,
  labelRel: string
): string | undefined {
  if (!fs.existsSync(absPath)) {
    return undefined;
  }
  const dest = path.join(trashRoot(lcsProjectDir), stamp, labelRel.replace(/[\\/]/g, '__'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(absPath, dest);
  pruneSyncTrash(lcsProjectDir);
  return dest;
}

function pruneSyncTrash(lcsProjectDir: string): void {
  const root = trashRoot(lcsProjectDir);
  if (!fs.existsSync(root)) {
    return;
  }
  let dirs: string[];
  try {
    dirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
  } catch {
    return;
  }
  for (const name of dirs.slice(MAX_TRASH_GENERATIONS)) {
    try {
      fs.rmSync(path.join(root, name), { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

function listStudioWebXamlRels(projectDir: string): string[] {
  const results: string[] = [];
  const stack = [projectDir];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.local' ||
        entry.name === 'bin' ||
        entry.name === 'obj'
      ) {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.xaml')) {
        results.push(path.relative(projectDir, full).replace(/\\/g, '/'));
      }
    }
  }
  return results.sort();
}

/**
 * Pull Studio Web Local .xaml → LCS .lcs.json (receive changes).
 * Backs up overwritten JSON into `.lcs-sync-trash/`.
 */
export function syncFromStudioWebLocal(
  lcsProjectDir: string,
  options: {
    /** Only these .lcs.json rels (default: all linked / discovered). */
    workflowRels?: string[];
    /** Skip pull for these (e.g. the file the designer is actively saving). */
    skipLcsRels?: string[];
    /** Pull even when LCS content also changed since last sync. */
    force?: boolean;
  } = {}
): StudioWebPullResult {
  const link = getStudioWebLocalLink(lcsProjectDir);
  if (!link) {
    throw new Error(
      'This project is not linked to a Studio Web Local Workspace. Run Connect first.'
    );
  }
  const projectDir = path.join(link.solutionDir, link.projectFolder);
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Linked Studio Web project folder missing: ${projectDir}`);
  }

  const skip = new Set((options.skipLcsRels || []).map((r) => r.replace(/\\/g, '/')));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const result: StudioWebPullResult = {
    updated: [],
    skipped: [],
    conflicts: [],
    backups: [],
    warnings: [],
    created: []
  };

  const xamlRels = listStudioWebXamlRels(projectDir);
  const targets = options.workflowRels?.length
    ? options.workflowRels.map((r) => r.replace(/\.lcs\.json$/i, '.xaml').replace(/\\/g, '/'))
    : xamlRels;

  const fingerprints = { ...(link.files || {}) };
  let manifestDirty = false;

  for (const xamlRel of targets) {
    const lcsRel = xamlRel.replace(/\.xaml$/i, '.lcs.json');
    if (skip.has(lcsRel)) {
      result.skipped.push(lcsRel);
      continue;
    }
    const xamlAbs = path.join(projectDir, xamlRel);
    const lcsAbs = path.join(lcsProjectDir, lcsRel);
    if (!fs.existsSync(xamlAbs)) {
      continue;
    }
    const xamlText = fs.readFileSync(xamlAbs, 'utf8');
    const xamlHash = contentHash(xamlText);
    const lcsText = fs.existsSync(lcsAbs) ? fs.readFileSync(lcsAbs, 'utf8') : '';
    const lcsHash = lcsText ? contentHash(lcsText) : '';
    const prev = fingerprints[lcsRel];

    const xamlChanged = !prev?.xamlHash || prev.xamlHash !== xamlHash;
    const lcsChanged = Boolean(lcsText) && (!prev?.lcsHash || prev.lcsHash !== lcsHash);

    if (!xamlChanged && fs.existsSync(lcsAbs)) {
      result.skipped.push(lcsRel);
      continue;
    }

    // Both sides diverged — caller may force; otherwise mark conflict and skip
    if (xamlChanged && lcsChanged && !options.force && prev?.lcsHash && prev?.xamlHash) {
      result.conflicts.push(lcsRel);
      result.skipped.push(lcsRel);
      continue;
    }

    // Fallback without fingerprints: only pull when XAML mtime is clearly newer
    if (!prev?.xamlHash && fs.existsSync(lcsAbs) && !options.force) {
      try {
        const xamlStat = fs.statSync(xamlAbs);
        const lcsStat = fs.statSync(lcsAbs);
        if (xamlStat.mtimeMs <= lcsStat.mtimeMs + 1500) {
          result.skipped.push(lcsRel);
          continue;
        }
      } catch {
        // pull
      }
    }

    const name = path.basename(lcsRel, '.lcs.json');
    const imported = importXaml(xamlText, name);
    result.warnings.push(
      ...imported.warnings.map((w) => ({ message: `${xamlRel}: ${w.message}` }))
    );
    const nextJson = stringifyWorkflow(imported.workflow);

    if (fs.existsSync(lcsAbs)) {
      const bak = backupToSyncTrash(lcsProjectDir, lcsAbs, stamp, lcsRel);
      if (bak) {
        result.backups.push(bak);
      }
    } else {
      result.created.push(lcsRel);
      manifestDirty = true;
    }

    fs.mkdirSync(path.dirname(lcsAbs), { recursive: true });
    fs.writeFileSync(lcsAbs, nextJson, 'utf8');
    fingerprints[lcsRel] = {
      lcsHash: contentHash(nextJson),
      xamlHash,
      syncedAt: new Date().toISOString()
    };
    result.updated.push(lcsRel);
  }

  if (result.updated.length || manifestDirty) {
    const manifest = readLcsManifest(lcsProjectDir);
    if (manifestDirty) {
      const workflows = new Set([
        ...((manifest.workflows as string[]) || []),
        ...result.created,
        ...result.updated
      ]);
      manifest.workflows = [...workflows].sort();
    }
    if (manifest.studioWebLocal) {
      manifest.studioWebLocal = {
        ...manifest.studioWebLocal,
        lastSyncedAt: new Date().toISOString(),
        files: { ...(manifest.studioWebLocal.files || {}), ...fingerprints }
      };
    }
    writeLcsManifest(lcsProjectDir, manifest);
  }

  return result;
}

function recordPushFingerprints(
  lcsProjectDir: string,
  projectDir: string,
  contentOverrides?: Record<string, string>
): void {
  const manifest = readLcsManifest(lcsProjectDir);
  if (!manifest.studioWebLocal) {
    return;
  }
  const files: Record<string, StudioWebFileFingerprint> = {
    ...(manifest.studioWebLocal.files || {})
  };
  const now = new Date().toISOString();
  for (const lcsRel of listLcsWorkflowRels(lcsProjectDir)) {
    const lcsAbs = path.join(lcsProjectDir, lcsRel);
    const xamlRel = lcsRel.replace(/\.lcs\.json$/i, '.xaml');
    const xamlAbs = path.join(projectDir, xamlRel);
    const lcsText =
      contentOverrides?.[lcsRel] ??
      contentOverrides?.[lcsRel.replace(/\\/g, '/')] ??
      (fs.existsSync(lcsAbs) ? fs.readFileSync(lcsAbs, 'utf8') : '');
    if (!lcsText || !fs.existsSync(xamlAbs)) {
      continue;
    }
    files[lcsRel] = {
      lcsHash: contentHash(lcsText),
      xamlHash: contentHash(fs.readFileSync(xamlAbs, 'utf8')),
      syncedAt: now
    };
  }
  manifest.studioWebLocal = {
    ...manifest.studioWebLocal,
    lastSyncedAt: now,
    files
  };
  writeLcsManifest(lcsProjectDir, manifest);
}

/**
 * Bidirectional sync: pull Studio Web edits into .lcs.json (when LCS unchanged),
 * then push LCS → Studio Web. Overwrites go to `.lcs-sync-trash/`.
 */
export function syncToStudioWebLocal(
  lcsProjectDir: string,
  options: {
    contentOverrides?: Record<string, string>;
    /** When false, skip pull (push-only). Default true. */
    pullFirst?: boolean;
  } = {}
): StudioWebLocalSyncResult {
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

  const overrides = { ...(options.contentOverrides || {}) };
  const pullFirst = options.pullFirst !== false;
  let pulled: string[] = [];
  let conflicts: string[] = [];
  let backups: string[] = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (pullFirst) {
    // Pull Studio Web → LCS for workflows the designer is NOT actively saving
    const pull = syncFromStudioWebLocal(lcsProjectDir, {
      skipLcsRels: Object.keys(overrides),
      force: false
    });
    pulled = pull.updated;
    conflicts = pull.conflicts;
    backups = [...pull.backups];

    // For the file being saved: if Studio Web changed and LCS override matches last sync
    // (designer didn't actually change content), prefer Studio Web pull
    const freshLink = getStudioWebLocalLink(lcsProjectDir)!;
    const projectDirPeek = path.join(freshLink.solutionDir, freshLink.projectFolder);
    for (const [lcsRel, overrideText] of Object.entries(overrides)) {
      const prev = freshLink.files?.[lcsRel];
      const xamlAbs = path.join(projectDirPeek, lcsRel.replace(/\.lcs\.json$/i, '.xaml'));
      if (!fs.existsSync(xamlAbs) || !prev?.xamlHash || !prev?.lcsHash) {
        continue;
      }
      const xamlHash = contentHash(fs.readFileSync(xamlAbs, 'utf8'));
      const overrideHash = contentHash(overrideText);
      const xamlChanged = xamlHash !== prev.xamlHash;
      const lcsUnchanged = overrideHash === prev.lcsHash;
      if (xamlChanged && lcsUnchanged) {
        const pullOne = syncFromStudioWebLocal(lcsProjectDir, {
          workflowRels: [lcsRel],
          force: true
        });
        pulled.push(...pullOne.updated);
        backups.push(...pullOne.backups);
        if (pullOne.updated.includes(lcsRel)) {
          const lcsAbs = path.join(lcsProjectDir, lcsRel);
          overrides[lcsRel] = fs.readFileSync(lcsAbs, 'utf8');
        }
      } else if (xamlChanged && !lcsUnchanged) {
        // Both changed — keep LCS Save; trash Studio Web copy
        const bak = backupToSyncTrash(
          lcsProjectDir,
          xamlAbs,
          stamp,
          lcsRel.replace(/\.lcs\.json$/i, '.xaml') + '.from-studio-web'
        );
        if (bak) {
          backups.push(bak);
        }
        if (!conflicts.includes(lcsRel)) {
          conflicts.push(lcsRel);
        }
      }
    }
  }

  // Backup Studio Web xaml that we are about to overwrite
  const projectDir = path.join(link.solutionDir, link.projectFolder);
  for (const lcsRel of listLcsWorkflowRels(lcsProjectDir)) {
    const xamlRel = lcsRel.replace(/\.lcs\.json$/i, '.xaml');
    const xamlAbs = path.join(projectDir, xamlRel);
    if (fs.existsSync(xamlAbs)) {
      const bak = backupToSyncTrash(
        lcsProjectDir,
        xamlAbs,
        stamp,
        xamlRel + '.before-push'
      );
      if (bak) {
        backups.push(bak);
      }
    }
  }

  const solutionName = path.basename(link.solutionDir);
  const { uipxPath, data } = readOrCreateUipx(link.solutionDir, solutionName, link.solutionId);
  data.SolutionId = link.solutionId || data.SolutionId;
  ensureProjectInUipx(data, link.projectFolder, link.projectId);
  fs.writeFileSync(uipxPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const exported = writeUiPathProjectToDir(lcsProjectDir, projectDir, {
    writeReadme: false,
    targetFramework: 'Portable',
    contentOverrides: overrides
  });

  recordPushFingerprints(lcsProjectDir, projectDir, overrides);
  const updatedLink = getStudioWebLocalLink(lcsProjectDir) || link;

  return {
    ...exported,
    targetDir: projectDir,
    link: updatedLink,
    uipxPath,
    created: false,
    pulled,
    conflicts,
    backups
  };
}

export function trySyncToStudioWebLocal(
  lcsProjectDir: string,
  options: {
    contentOverrides?: Record<string, string>;
    pullFirst?: boolean;
  } = {}
): StudioWebLocalSyncResult | undefined {
  if (!getStudioWebLocalLink(lcsProjectDir)) {
    return undefined;
  }
  return syncToStudioWebLocal(lcsProjectDir, options);
}

export function trySyncFromStudioWebLocal(
  lcsProjectDir: string,
  options?: Parameters<typeof syncFromStudioWebLocal>[1]
): StudioWebPullResult | undefined {
  if (!getStudioWebLocalLink(lcsProjectDir)) {
    return undefined;
  }
  return syncFromStudioWebLocal(lcsProjectDir, options);
}

export interface StudioWebLocalStaleFile {
  workflowRel: string;
  xamlRel: string;
  reason: 'missing-xaml' | 'lcs-newer' | 'xaml-newer';
}

export interface StudioWebLocalSyncStatus {
  linked: boolean;
  inSync: boolean;
  link?: StudioWebLocalLink;
  projectDir?: string;
  stale: StudioWebLocalStaleFile[];
  summary: string;
}

/**
 * Compare LCS .lcs.json mtimes vs linked Studio Web .xaml files.
 * Used for Project Explorer out-of-sync badges.
 */
export function getStudioWebLocalSyncStatus(
  lcsProjectDir: string
): StudioWebLocalSyncStatus {
  const link = getStudioWebLocalLink(lcsProjectDir);
  if (!link) {
    return {
      linked: false,
      inSync: true,
      stale: [],
      summary: 'Not linked to Studio Web Local Workspace'
    };
  }
  const projectDir = path.join(link.solutionDir, link.projectFolder);
  if (!fs.existsSync(link.solutionDir) || !fs.existsSync(projectDir)) {
    return {
      linked: true,
      inSync: false,
      link,
      projectDir,
      stale: [
        {
          workflowRel: '(solution)',
          xamlRel: projectDir,
          reason: 'missing-xaml'
        }
      ],
      summary: 'Linked solution folder missing — re-run Connect'
    };
  }

  const workflowRels = listLcsWorkflowRels(lcsProjectDir);
  const stale: StudioWebLocalStaleFile[] = [];
  for (const rel of workflowRels) {
    const lcsAbs = path.join(lcsProjectDir, rel);
    const xamlRel = rel.replace(/\.lcs\.json$/i, '.xaml');
    const xamlAbs = path.join(projectDir, xamlRel);
    if (!fs.existsSync(lcsAbs)) {
      continue;
    }
    if (!fs.existsSync(xamlAbs)) {
      stale.push({ workflowRel: rel, xamlRel, reason: 'missing-xaml' });
      continue;
    }
    try {
      const lcsText = fs.readFileSync(lcsAbs, 'utf8');
      const xamlText = fs.readFileSync(xamlAbs, 'utf8');
      const prev = link.files?.[rel];
      const lcsHash = contentHash(lcsText);
      const xamlHash = contentHash(xamlText);
      if (prev?.lcsHash && prev?.xamlHash) {
        const lcsChanged = lcsHash !== prev.lcsHash;
        const xamlChanged = xamlHash !== prev.xamlHash;
        if (xamlChanged && !lcsChanged) {
          stale.push({ workflowRel: rel, xamlRel, reason: 'xaml-newer' });
        } else if (lcsChanged && !xamlChanged) {
          stale.push({ workflowRel: rel, xamlRel, reason: 'lcs-newer' });
        } else if (lcsChanged && xamlChanged) {
          // Both diverged — surface as xaml-newer so Pull is offered
          stale.push({ workflowRel: rel, xamlRel, reason: 'xaml-newer' });
        }
      } else {
        const lcsStat = fs.statSync(lcsAbs);
        const xamlStat = fs.statSync(xamlAbs);
        if (xamlStat.mtimeMs > lcsStat.mtimeMs + 1500) {
          stale.push({ workflowRel: rel, xamlRel, reason: 'xaml-newer' });
        } else if (lcsStat.mtimeMs > xamlStat.mtimeMs + 1500) {
          stale.push({ workflowRel: rel, xamlRel, reason: 'lcs-newer' });
        }
      }
    } catch {
      stale.push({ workflowRel: rel, xamlRel, reason: 'missing-xaml' });
    }
  }

  const inSync = stale.length === 0;
  const xamlNewer = stale.filter((s) => s.reason === 'xaml-newer').length;
  const lcsNewer = stale.filter((s) => s.reason === 'lcs-newer').length;
  let summary = 'Synced with Studio Web Local Workspace';
  if (!inSync) {
    const parts: string[] = [];
    if (xamlNewer) {
      parts.push(`${xamlNewer} Studio Web newer (Pull or Save to merge)`);
    }
    if (lcsNewer) {
      parts.push(`${lcsNewer} LCS newer (Save to push)`);
    }
    const missing = stale.filter((s) => s.reason === 'missing-xaml').length;
    if (missing) {
      parts.push(`${missing} missing .xaml`);
    }
    summary = `Out of sync — ${parts.join('; ')}`;
  }
  return {
    linked: true,
    inSync,
    link,
    projectDir,
    stale,
    summary
  };
}

function listLcsWorkflowRels(lcsProjectDir: string): string[] {
  const results: string[] = [];
  const stack = [lcsProjectDir];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'bin' ||
        entry.name === 'obj' ||
        entry.name === 'out'
      ) {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (findUipx(full)) {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.lcs.json')) {
        results.push(path.relative(lcsProjectDir, full).replace(/\\/g, '/'));
      }
    }
  }
  try {
    const manifest = readLcsManifest(lcsProjectDir);
    const listed = Array.isArray(manifest.workflows)
      ? (manifest.workflows as string[])
      : [];
    for (const rel of listed) {
      if (rel.endsWith('.lcs.json') && !results.includes(rel)) {
        results.push(rel);
      }
    }
  } catch {
    // ignore
  }
  return results.sort();
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

Design in LowCode Studio **or** Studio Web Local Workspace. **Save** keeps both sides in sync.

## Loop

\`\`\`
LowCode Studio (design + dry-run)
   ↔ Connect / Open Studio Web Local Workspace  (once)
   ↔ Edit in Studio Web Local Workspace
   → Save in LowCode Studio  → pull Studio Web edits into .lcs.json, then push .xaml
   → Or: Pull from Studio Web Local (command) without pushing
   → Publish from Studio Web when ready
\`\`\`

## Trash / backups

Before overwrite, copies go to \`.lcs-sync-trash/\` inside the LowCode Studio project
(last ${MAX_TRASH_GENERATIONS} sync generations).

## Notes

- Link is stored in LowCode Studio \`project.json\` → \`studioWebLocal\` (includes content fingerprints)
- Linked UiPath project is always **Portable** (required to open in Studio Web on Mac)
- Sync on Save: \`lowcodeStudio.syncStudioWebOnSave\` (default on)
- Classic **Export Windows project folder** / legacy \`.uip\` remains for Windows Desktop / robot handoff

> Not an official UiPath product.
`;
}
