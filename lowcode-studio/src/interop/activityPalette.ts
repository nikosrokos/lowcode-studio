import { ActivityDefinition, getActivityCatalog } from '../models/activities';

export const ACTIVITY_FAVORITES_KEY = 'lowcodeStudio.activityFavorites';
export const ACTIVITY_RECENT_KEY = 'lowcodeStudio.activityRecent';
export const MAX_PINNED_FAVORITES = 10;
export const MAX_RECENT = 10;

export interface ActivityPaletteState {
  favorites: string[];
  recent: string[];
}

export function normalizeActivityList(types: unknown, max: number): string[] {
  if (!Array.isArray(types)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of types) {
    if (typeof item !== 'string' || !item.trim()) {
      continue;
    }
    const type = item.trim();
    if (seen.has(type)) {
      continue;
    }
    seen.add(type);
    out.push(type);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

export function toggleFavorite(favorites: string[], activityType: string): string[] {
  const type = activityType.trim();
  if (!type) {
    return normalizeActivityList(favorites, MAX_PINNED_FAVORITES);
  }
  if (favorites.includes(type)) {
    return favorites.filter((t) => t !== type);
  }
  return normalizeActivityList([type, ...favorites], MAX_PINNED_FAVORITES);
}

export function pushRecent(recent: string[], activityType: string): string[] {
  const type = activityType.trim();
  if (!type) {
    return normalizeActivityList(recent, MAX_RECENT);
  }
  return normalizeActivityList([type, ...recent.filter((t) => t !== type)], MAX_RECENT);
}

export interface PaletteEntry {
  type: string;
  displayName: string;
  category: string;
  description: string;
  section: 'Favorites' | 'Recent' | 'All';
  pinned: boolean;
}

/**
 * Build QuickPick / palette rows: favorites (pinned top 10) → recent → rest of catalog.
 */
export function buildPaletteEntries(
  state: ActivityPaletteState,
  catalog: ActivityDefinition[] = getActivityCatalog()
): PaletteEntry[] {
  const byType = new Map(catalog.map((a) => [a.type, a]));
  const favorites = normalizeActivityList(state.favorites, MAX_PINNED_FAVORITES).filter((t) =>
    byType.has(t)
  );
  const recent = normalizeActivityList(state.recent, MAX_RECENT).filter(
    (t) => byType.has(t) && !favorites.includes(t)
  );
  const used = new Set([...favorites, ...recent]);
  const rest = catalog
    .filter((a) => !used.has(a.type))
    .slice()
    .sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.displayName.localeCompare(b.displayName);
    });

  const entries: PaletteEntry[] = [];
  for (const type of favorites) {
    const def = byType.get(type)!;
    entries.push(toEntry(def, 'Favorites', true));
  }
  for (const type of recent) {
    const def = byType.get(type)!;
    entries.push(toEntry(def, 'Recent', false));
  }
  for (const def of rest) {
    entries.push(toEntry(def, 'All', false));
  }
  return entries;
}

function toEntry(
  def: ActivityDefinition,
  section: PaletteEntry['section'],
  pinned: boolean
): PaletteEntry {
  return {
    type: def.type,
    displayName: def.displayName,
    category: def.category,
    description: def.description || '',
    section,
    pinned
  };
}
