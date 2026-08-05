import * as fs from 'fs';
import * as path from 'path';
import {
  collectActivityTypes,
  DEFAULT_PACKAGE_VERSIONS,
  resolveUiPathDependencies
} from './uipathDependencies';
import { parseWorkflow, WorkflowDocument } from '../models/workflow';
import {
  collectCustomNugetPackages,
  loadProjectCustomActivities
} from '../models/customActivities';

export interface PackagePin {
  name: string;
  version: string;
  isDefaultPin: boolean;
  hasCatalogDefault: boolean;
  catalogDefault?: string;
  source: 'manifest' | 'resolved';
}

export interface PackageInventory {
  projectDir: string;
  projectName: string;
  manifestPins: Record<string, string>;
  resolved: Record<string, string>;
  pins: PackagePin[];
  defaultPinCount: number;
}

function isDefaultPin(ver: string): boolean {
  const v = String(ver || '').trim();
  return v === '[1.0.0]' || v === '1.0.0' || v === '(1.0.0)';
}

export function loadPackageInventory(projectDir: string): PackageInventory {
  const manifestPath = path.join(projectDir, 'project.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Not a LowCode Studio project (missing project.json).');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    name?: string;
    schemaVersion?: string;
    workflows?: string[];
    uipathDependencies?: Record<string, string>;
  };
  if (manifest.schemaVersion !== '1.0') {
    throw new Error(
      'Open a LowCode Studio project.json (schemaVersion 1.0) to manage packages.'
    );
  }

  const docs: WorkflowDocument[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out') {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.lcs.json')) {
        try {
          docs.push(parseWorkflow(fs.readFileSync(full, 'utf8')));
        } catch {
          // ignore
        }
      }
    }
  };
  walk(projectDir);

  const activityTypes = collectActivityTypes(docs);
  const custom = loadProjectCustomActivities(projectDir);
  const manifestPins = { ...(manifest.uipathDependencies || {}) };
  const resolved = resolveUiPathDependencies({
    activityTypes,
    preserved: manifestPins,
    includeBaseline: true,
    extraPackages: collectCustomNugetPackages(custom, activityTypes),
    allowDefaultPins: true
  });

  const names = new Set([...Object.keys(manifestPins), ...Object.keys(resolved)]);
  const pins: PackagePin[] = [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const version = manifestPins[name] || resolved[name] || '[1.0.0]';
      const catalogDefault = DEFAULT_PACKAGE_VERSIONS[name];
      return {
        name,
        version,
        isDefaultPin: isDefaultPin(version),
        hasCatalogDefault: Boolean(catalogDefault),
        catalogDefault,
        source: manifestPins[name] ? 'manifest' : 'resolved'
      };
    });

  return {
    projectDir,
    projectName: manifest.name || path.basename(projectDir),
    manifestPins,
    resolved,
    pins,
    defaultPinCount: pins.filter((p) => p.isDefaultPin).length
  };
}

export function writeManifestPackagePins(
  projectDir: string,
  pins: Record<string, string>
): void {
  const manifestPath = path.join(projectDir, 'project.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<
    string,
    unknown
  >;
  const cleaned: Record<string, string> = {};
  for (const [name, ver] of Object.entries(pins)) {
    const v = String(ver || '').trim();
    if (!name || !v) {
      continue;
    }
    cleaned[name] = v.startsWith('[') || v.startsWith('(') ? v : `[${v}]`;
  }
  manifest.uipathDependencies = Object.fromEntries(
    Object.entries(cleaned).sort(([a], [b]) => a.localeCompare(b))
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

export function applyCatalogDefaultsForPins(
  pins: Record<string, string>
): { next: Record<string, string>; changed: string[] } {
  const next = { ...pins };
  const changed: string[] = [];
  for (const [name, ver] of Object.entries(next)) {
    if (!isDefaultPin(ver)) {
      continue;
    }
    const catalog = DEFAULT_PACKAGE_VERSIONS[name];
    if (catalog && catalog !== ver) {
      next[name] = catalog;
      changed.push(name);
    }
  }
  return { next, changed };
}

export { isDefaultPin };
