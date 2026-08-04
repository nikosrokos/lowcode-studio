import * as fs from 'fs';
import * as path from 'path';

/**
 * Walk up from a directory to find a LowCode Studio project root (schemaVersion 1.0).
 */
export function findProjectRoot(startDir: string): string | undefined {
  let current = startDir;
  for (let i = 0; i < 16; i++) {
    const candidate = path.join(current, 'project.json');
    if (fs.existsSync(candidate)) {
      try {
        const content = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          schemaVersion?: string;
        };
        if (content.schemaVersion === '1.0') {
          return current;
        }
      } catch {
        // continue walking
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
}

/**
 * Discover all LowCode Studio projects under the given roots (sorted by path).
 */
export function findAllLcsProjects(roots: string[]): string[] {
  const results = new Set<string>();
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) {
      continue;
    }
    const stack = [root];
    while (stack.length) {
      const current = stack.pop()!;
      const candidate = path.join(current, 'project.json');
      if (fs.existsSync(candidate)) {
        try {
          const content = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
            schemaVersion?: string;
          };
          if (content.schemaVersion === '1.0') {
            results.add(current);
            continue; // don't descend into nested projects
          }
        } catch {
          // keep scanning
        }
      }
      try {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          if (
            !entry.isDirectory() ||
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'out' ||
            entry.name.endsWith('.StudioWeb')
          ) {
            continue;
          }
          stack.push(path.join(current, entry.name));
        }
      } catch {
        // ignore unreadable dirs
      }
    }
  }
  return [...results].sort((a, b) => a.localeCompare(b));
}

export function isLcsProjectDir(dir: string | undefined): boolean {
  if (!dir) {
    return false;
  }
  const candidate = path.join(dir, 'project.json');
  if (!fs.existsSync(candidate)) {
    return false;
  }
  try {
    const content = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
      schemaVersion?: string;
    };
    return content.schemaVersion === '1.0';
  } catch {
    return false;
  }
}

export interface DesignerProjectEntry {
  name: string;
  path: string;
  kind: 'project' | 'folder' | 'workflow' | 'file';
  active?: boolean;
  children?: DesignerProjectEntry[];
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'out',
  'bin',
  'obj',
  '.vs',
  '.local'
]);

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.endsWith('.StudioWeb') || name.endsWith('.StudioWebLocal');
}

/**
 * Build designer Project Explorer entries for a single current LCS project
 * (folders + files of that RPA / solution only — not every workspace project).
 */
export function buildCurrentProjectTree(projectDir: string | undefined): DesignerProjectEntry[] {
  if (!projectDir || !isLcsProjectDir(projectDir)) {
    return [];
  }
  return listProjectEntries(projectDir, 3);
}

/**
 * @deprecated Prefer buildCurrentProjectTree for the designer rail.
 * Kept for tests that assert multi-project discovery.
 */
export function buildDesignerProjectTree(
  roots: string[],
  activeProjectDir?: string
): DesignerProjectEntry[] {
  const projects = findAllLcsProjects(roots);
  const focus =
    activeProjectDir && isLcsProjectDir(activeProjectDir)
      ? [activeProjectDir]
      : projects.length === 1
        ? projects
        : activeProjectDir
          ? projects.filter((p) => path.resolve(p) === path.resolve(activeProjectDir))
          : [];
  const target = focus[0] || projects[0];
  if (!target) {
    return [];
  }
  return [
    {
      name: path.basename(target),
      path: target,
      kind: 'project',
      active: true,
      children: listProjectEntries(target, 3)
    }
  ];
}

function listProjectEntries(dir: string, depth: number): DesignerProjectEntry[] {
  if (depth < 0) {
    return [];
  }
  const items: DesignerProjectEntry[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) {
          continue;
        }
        items.push({
          name: entry.name,
          path: full,
          kind: 'folder',
          children: depth > 0 ? listProjectEntries(full, depth - 1) : undefined
        });
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.lcs.json')) {
          items.push({
            name: entry.name.replace(/\.lcs\.json$/i, ''),
            path: full,
            kind: 'workflow'
          });
        } else if (
          entry.name === 'project.json' ||
          entry.name.endsWith('.json') ||
          entry.name.endsWith('.xlsx') ||
          entry.name.endsWith('.md') ||
          entry.name.endsWith('.txt')
        ) {
          items.push({
            name: entry.name,
            path: full,
            kind: 'file'
          });
        }
      }
    }
  } catch {
    // ignore
  }
  return items.sort((a, b) => {
    if (a.kind !== b.kind) {
      const order = { folder: 0, project: 1, workflow: 2, file: 3 } as const;
      return (order[a.kind] ?? 9) - (order[b.kind] ?? 9);
    }
    return a.name.localeCompare(b.name);
  });
}
