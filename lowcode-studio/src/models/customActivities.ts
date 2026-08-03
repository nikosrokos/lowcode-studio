import * as fs from 'fs';
import * as path from 'path';
import {
  ActivityCategory,
  ActivityDefinition,
  ActivityPropertyDef
} from './activities';

export const CUSTOM_ACTIVITIES_FILENAME = 'activities.custom.json';
export const USER_CUSTOM_ACTIVITIES_KEY = 'lowcodeStudio.customActivities';

export interface CustomDryRunStub {
  /** Log line written during dry-run */
  log?: string;
  /**
   * Variable assignments after the stub runs.
   * Values are expression strings resolved like Assign (e.g. `"ok"`, `true`, `0`).
   */
  assign?: Record<string, string>;
}

export interface CustomActivityDefinition extends ActivityDefinition {
  /** NuGet package id declared on Studio Web export */
  nugetPackage?: string;
  nugetVersion?: string;
  dryRun?: CustomDryRunStub;
  /** Where this definition was loaded from */
  source?: 'project' | 'user' | 'builtin';
}

export interface CustomActivitiesFile {
  schemaVersion: '1.0';
  activities: CustomActivityDefinition[];
}

const PROPERTY_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'enum',
  'expression',
  'multiline'
]);

export function emptyCustomActivitiesFile(): CustomActivitiesFile {
  return { schemaVersion: '1.0', activities: [] };
}

export function customActivitiesPath(projectDir: string): string {
  return path.join(projectDir, CUSTOM_ACTIVITIES_FILENAME);
}

export function loadProjectCustomActivities(
  projectDir: string
): CustomActivityDefinition[] {
  const filePath = customActivitiesPath(projectDir);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CustomActivitiesFile;
    return normalizeCustomList(raw.activities || [], 'project');
  } catch {
    return [];
  }
}

export function saveProjectCustomActivities(
  projectDir: string,
  activities: CustomActivityDefinition[]
): void {
  const file: CustomActivitiesFile = {
    schemaVersion: '1.0',
    activities: activities.map((a) => stripRuntimeFields(a))
  };
  fs.writeFileSync(
    customActivitiesPath(projectDir),
    JSON.stringify(file, null, 2) + '\n',
    'utf8'
  );
}

export function upsertCustomActivity(
  list: CustomActivityDefinition[],
  activity: CustomActivityDefinition
): CustomActivityDefinition[] {
  const source = activity.source === 'user' ? 'user' : 'project';
  const normalized = normalizeCustomActivity(activity, source);
  const next = list.filter((a) => a.type !== normalized.type);
  next.push(normalized);
  return next.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function removeCustomActivity(
  list: CustomActivityDefinition[],
  type: string
): CustomActivityDefinition[] {
  return list.filter((a) => a.type !== type);
}

/**
 * Merge built-in + project + user definitions.
 * Precedence: project > user > builtin (same type).
 */
export function mergeActivityCatalog(
  builtin: ActivityDefinition[],
  project: CustomActivityDefinition[],
  user: CustomActivityDefinition[]
): ActivityDefinition[] {
  const map = new Map<string, ActivityDefinition>();
  for (const a of builtin) {
    map.set(a.type, { ...a });
  }
  for (const a of user) {
    map.set(a.type, { ...a, category: (a.category || 'Custom') as ActivityCategory });
  }
  for (const a of project) {
    map.set(a.type, { ...a, category: (a.category || 'Custom') as ActivityCategory });
  }
  return [...map.values()];
}

export function collectCustomNugetPackages(
  customs: CustomActivityDefinition[],
  usedTypes?: Set<string> | string[]
): Record<string, string> {
  const used =
    usedTypes instanceof Set
      ? usedTypes
      : usedTypes
        ? new Set(usedTypes)
        : undefined;
  const result: Record<string, string> = {};
  for (const a of customs) {
    if (used && !used.has(a.type)) {
      continue;
    }
    if (a.nugetPackage) {
      result[a.nugetPackage] = normalizeNugetVersion(a.nugetVersion);
    }
  }
  return result;
}

export function validateCustomActivityInput(input: {
  type: string;
  displayName: string;
  description?: string;
  nugetPackage?: string;
  nugetVersion?: string;
  properties?: ActivityPropertyDef[];
}): string | undefined {
  if (!/^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)+$/.test(input.type)) {
    return 'Type must look like Namespace.Activity (e.g. Custom.MyLib.DoWork).';
  }
  if (!input.displayName.trim()) {
    return 'Display name is required.';
  }
  if (input.nugetPackage && !/^[A-Za-z0-9_.-]+$/.test(input.nugetPackage)) {
    return 'NuGet package id looks invalid.';
  }
  for (const p of input.properties || []) {
    if (!p.name || !/^[A-Za-z_][\w]*$/.test(p.name)) {
      return `Invalid property name: ${p.name}`;
    }
    if (!PROPERTY_TYPES.has(p.type)) {
      return `Invalid property type: ${p.type}`;
    }
  }
  return undefined;
}

export function createCustomActivityDraft(partial: {
  type: string;
  displayName: string;
  description?: string;
  nugetPackage?: string;
  nugetVersion?: string;
  color?: string;
  properties?: ActivityPropertyDef[];
  dryRun?: CustomDryRunStub;
  source?: 'project' | 'user';
}): CustomActivityDefinition {
  const error = validateCustomActivityInput(partial);
  if (error) {
    throw new Error(error);
  }
  return normalizeCustomActivity(
    {
      type: partial.type.trim(),
      displayName: partial.displayName.trim(),
      category: 'Custom',
      description: partial.description?.trim() || 'Custom activity (local registration).',
      icon: '$(extensions)',
      color: partial.color || '#F59E0B',
      properties: partial.properties || [
        {
          name: 'input',
          label: 'Input',
          type: 'expression',
          defaultValue: '""'
        }
      ],
      nugetPackage: partial.nugetPackage?.trim() || undefined,
      nugetVersion: partial.nugetVersion?.trim() || undefined,
      dryRun: partial.dryRun || {
        log: `${partial.type.trim()} (simulated)`
      },
      source: partial.source || 'project'
    },
    partial.source || 'project'
  );
}

function normalizeCustomList(
  list: CustomActivityDefinition[],
  source: 'project' | 'user'
): CustomActivityDefinition[] {
  return list
    .map((a) => {
      try {
        return normalizeCustomActivity(a, source);
      } catch {
        return undefined;
      }
    })
    .filter((a): a is CustomActivityDefinition => !!a);
}

function normalizeCustomActivity(
  activity: CustomActivityDefinition,
  source: 'project' | 'user'
): CustomActivityDefinition {
  const error = validateCustomActivityInput(activity);
  if (error) {
    throw new Error(error);
  }
  return {
    type: activity.type.trim(),
    displayName: activity.displayName.trim(),
    category: 'Custom',
    description: activity.description?.trim() || 'Custom activity',
    icon: activity.icon || '$(extensions)',
    color: activity.color || '#F59E0B',
    container: !!activity.container,
    hasElse: !!activity.hasElse,
    properties: (activity.properties || []).map((p) => ({
      name: p.name,
      label: p.label || p.name,
      type: p.type,
      defaultValue: p.defaultValue,
      options: p.options,
      description: p.description,
      required: p.required
    })),
    nugetPackage: activity.nugetPackage?.trim() || undefined,
    nugetVersion: activity.nugetVersion?.trim() || undefined,
    dryRun: activity.dryRun,
    source
  };
}

function stripRuntimeFields(activity: CustomActivityDefinition): CustomActivityDefinition {
  const { source: _source, ...rest } = activity;
  return rest;
}

function normalizeNugetVersion(ver?: string): string {
  const v = String(ver || '1.0.0').trim();
  if (!v) {
    return '[1.0.0]';
  }
  if (v.startsWith('[') || v.startsWith('(')) {
    return v;
  }
  return `[${v}]`;
}
