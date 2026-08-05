import * as fs from 'fs';
import * as path from 'path';
import { getStudioWebLocalSyncStatus } from '../interop/studioWebLocal';
import { isLcsProjectDir } from '../interop/projectResolve';

export const RECENT_PROJECTS_KEY = 'lowcodeStudio.recentProjects';
const MAX_RECENT = 8;

export interface RecentProjectEntry {
  path: string;
  name: string;
  lastOpened: string;
}

export interface RecentProjectCard extends RecentProjectEntry {
  exists: boolean;
  linked: boolean;
  inSync: boolean;
  syncSummary: string;
  syncBadge: 'ok' | 'stale' | 'unlinked' | 'missing';
}

export function readRecentProjects(raw: unknown): RecentProjectEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((r) => {
      const o = r as RecentProjectEntry;
      if (!o?.path || typeof o.path !== 'string') {
        return undefined;
      }
      return {
        path: o.path,
        name: String(o.name || path.basename(o.path)),
        lastOpened: String(o.lastOpened || new Date(0).toISOString())
      };
    })
    .filter(Boolean) as RecentProjectEntry[];
}

export function pushRecentProject(
  list: RecentProjectEntry[],
  projectDir: string,
  name?: string
): RecentProjectEntry[] {
  const resolved = path.resolve(projectDir);
  const nextName =
    name ||
    (() => {
      try {
        const m = JSON.parse(
          fs.readFileSync(path.join(resolved, 'project.json'), 'utf8')
        ) as { name?: string };
        return m.name || path.basename(resolved);
      } catch {
        return path.basename(resolved);
      }
    })();
  const filtered = list.filter((e) => path.resolve(e.path) !== resolved);
  filtered.unshift({
    path: resolved,
    name: nextName,
    lastOpened: new Date().toISOString()
  });
  return filtered.slice(0, MAX_RECENT);
}

export function enrichRecentProjects(list: RecentProjectEntry[]): RecentProjectCard[] {
  return list.map((e) => {
    const exists = fs.existsSync(e.path) && isLcsProjectDir(e.path);
    if (!exists) {
      return {
        ...e,
        exists: false,
        linked: false,
        inSync: false,
        syncSummary: 'Folder missing',
        syncBadge: 'missing'
      };
    }
    const status = getStudioWebLocalSyncStatus(e.path);
    let syncBadge: RecentProjectCard['syncBadge'] = 'unlinked';
    if (status.linked && status.inSync) {
      syncBadge = 'ok';
    } else if (status.linked && !status.inSync) {
      syncBadge = 'stale';
    }
    return {
      ...e,
      exists: true,
      linked: status.linked,
      inSync: status.inSync,
      syncSummary: status.summary,
      syncBadge
    };
  });
}
