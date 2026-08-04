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

/**
 * Build a shallow project tree for the designer left rail.
 */
export function buildDesignerProjectTree(
  roots: string[],
  activeProjectDir?: string
): DesignerProjectEntry[] {
  const projects = findAllLcsProjects(roots);
  return projects.map((projectDir) => {
    const children: DesignerProjectEntry[] = [];
    try {
      for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
        const full = path.join(projectDir, entry.name);
        if (entry.isDirectory()) {
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'out' ||
            entry.name.endsWith('.StudioWeb')
          ) {
            continue;
          }
          children.push({
            name: entry.name,
            path: full,
            kind: 'folder',
            children: listWorkflowFiles(full, 1)
          });
        } else if (entry.isFile() && entry.name.endsWith('.lcs.json')) {
          children.push({
            name: entry.name.replace(/\.lcs\.json$/i, ''),
            path: full,
            kind: 'workflow'
          });
        }
      }
    } catch {
      // ignore
    }
    children.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return {
      name: path.basename(projectDir),
      path: projectDir,
      kind: 'project' as const,
      active: Boolean(
        activeProjectDir && path.resolve(activeProjectDir) === path.resolve(projectDir)
      ),
      children
    };
  });
}

function listWorkflowFiles(dir: string, depth: number): DesignerProjectEntry[] {
  if (depth < 0) {
    return [];
  }
  const items: DesignerProjectEntry[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && depth > 0) {
        const nested = listWorkflowFiles(full, depth - 1);
        if (nested.length) {
          items.push({ name: entry.name, path: full, kind: 'folder', children: nested });
        }
      } else if (entry.isFile() && entry.name.endsWith('.lcs.json')) {
        items.push({
          name: entry.name.replace(/\.lcs\.json$/i, ''),
          path: full,
          kind: 'workflow'
        });
      }
    }
  } catch {
    // ignore
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}
