import * as fs from 'fs';
import * as path from 'path';
import { loadProjectConfig } from './configBridge';
import { WorkflowDocument } from '../models/workflow';

export interface PropertySuggestions {
  variables: string[];
  configKeys: string[];
  configExpressions: string[];
  workflowPaths: string[];
  projectName?: string;
}

/**
 * Build designer suggestions from open workflow + project Config / workflows.
 */
export function buildPropertySuggestions(
  projectDir: string | undefined,
  workflow: WorkflowDocument
): PropertySuggestions {
  const variables = (workflow.variables || [])
    .map((v) => v.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (!projectDir || !fs.existsSync(projectDir)) {
    return {
      variables,
      configKeys: [],
      configExpressions: [],
      workflowPaths: []
    };
  }

  const config = loadProjectConfig(projectDir).config;
  const configKeys = flattenConfigKeys(config);
  const configExpressions = configKeys.map((k) => `Config.${k}`);
  const workflowPaths = discoverWorkflowPaths(projectDir);
  let projectName: string | undefined;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8')
    ) as { name?: string };
    projectName = manifest.name;
  } catch {
    // ignore
  }

  return {
    variables,
    configKeys,
    configExpressions,
    workflowPaths,
    projectName
  };
}

export function flattenConfigKeys(
  config: Record<string, unknown>,
  prefix = ''
): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(config || {})) {
    if (!key || key.startsWith('_')) {
      continue;
    }
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenConfigKeys(value as Record<string, unknown>, pathKey);
      if (nested.length) {
        keys.push(...nested);
      } else {
        keys.push(pathKey);
      }
    } else {
      keys.push(pathKey);
    }
  }
  return keys.sort((a, b) => a.localeCompare(b));
}

export function discoverWorkflowPaths(projectDir: string): string[] {
  const paths = new Set<string>();
  const manifestPath = path.join(projectDir, 'project.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        main?: string;
        workflows?: string[];
      };
      if (manifest.main) {
        paths.add(normalizeRel(manifest.main));
      }
      for (const wf of manifest.workflows || []) {
        paths.add(normalizeRel(wf));
      }
    } catch {
      // ignore
    }
  }

  walkLcs(projectDir, projectDir, paths);
  return [...paths].sort((a, b) => a.localeCompare(b));
}

function walkLcs(root: string, current: string, out: Set<string>, depth = 0): void {
  if (depth > 6) {
    return;
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    if (entry.name.endsWith('.StudioWeb')) {
      continue;
    }
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walkLcs(root, full, out, depth + 1);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.lcs.json')) {
      out.add(normalizeRel(path.relative(root, full)));
    }
  }
}

function normalizeRel(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/^\.\//, '');
}
