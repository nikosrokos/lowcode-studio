import * as fs from 'fs';
import * as path from 'path';
import { parseWorkflow, WorkflowDocument, ActivityNode } from '../models/workflow';
import {
  collectActivityTypes,
  resolveUiPathDependencies,
  packagesForActivityType
} from './uipathDependencies';
import {
  collectCustomNugetPackages,
  loadProjectCustomActivities
} from '../models/customActivities';
import { getActivityDefinition } from '../models/activities';
import {
  isPlaceholderSelector,
  isWindowsClassicSelector,
  resolveUiPathTarget
} from './windowsTarget';
import { scoreSelector } from './selectorBuilder';
import { isWindowsOnlyActivityType, windowsOnlyReason } from './studioWebCompat';

export interface PackageWarning {
  severity: 'warning' | 'info';
  code: string;
  message: string;
  workflow?: string;
  activityId?: string;
  activityType?: string;
}

export interface PackageValidationResult {
  projectName: string;
  warnings: PackageWarning[];
  dependencies: Record<string, string>;
  activityTypes: string[];
  workflowCount: number;
}

/**
 * Validate Studio Web package readiness for a LowCode Studio project.
 * Surfaces export placeholders, missing NuGet mappings, and broken Invoke paths.
 */
export function validateProjectPackages(projectDir: string): PackageValidationResult {
  const manifestPath = path.join(projectDir, 'project.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Not a LowCode Studio project (missing project.json).');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    name?: string;
    main?: string;
    workflows?: string[];
    schemaVersion?: string;
    uipathDependencies?: Record<string, string>;
    uipathTargetFramework?: string;
  };

  if (manifest.schemaVersion !== '1.0') {
    throw new Error(
      'This folder looks like a UiPath / other project. Use Import UiPath Project, or open a LowCode Studio project.json (schemaVersion 1.0).'
    );
  }

  const projectName = manifest.name || path.basename(projectDir);
  const warnings: PackageWarning[] = [];
  const targetFramework = resolveUiPathTarget(manifest.uipathTargetFramework);
  if (targetFramework !== 'Windows') {
    warnings.push({
      severity: 'warning',
      code: 'non-windows-target',
      message: `Project targetFramework is "${targetFramework}" — set uipathTargetFramework to "Windows" so robots run on Windows machines.`
    });
  } else {
    warnings.push({
      severity: 'info',
      code: 'windows-target',
      message: 'Export target is Windows (net8.0-windows) — suitable for Windows Studio / Windows robots.'
    });
  }

  const workflowRels =
    manifest.workflows?.length
      ? manifest.workflows
      : listLcsWorkflows(projectDir);

  const docs: Array<{ rel: string; doc: WorkflowDocument }> = [];

  for (const rel of workflowRels) {
    const abs = path.join(projectDir, rel);
    if (!fs.existsSync(abs)) {
      warnings.push({
        severity: 'warning',
        code: 'missing-workflow',
        workflow: rel,
        message: `Workflow listed in project.json was not found: ${rel}`
      });
      continue;
    }
    try {
      const doc = parseWorkflow(fs.readFileSync(abs, 'utf8'));
      docs.push({ rel, doc });
      warnings.push(...validateWorkflowPackages(doc, rel, projectDir));
    } catch (err) {
      warnings.push({
        severity: 'warning',
        code: 'parse-error',
        workflow: rel,
        message: `Could not parse ${rel}: ${err instanceof Error ? err.message : String(err)}`
      });
    }
  }

  const activityTypes = collectActivityTypes(docs.map((d) => d.doc));
  const customActivities = loadProjectCustomActivities(projectDir);
  const customByType = new Map(customActivities.map((c) => [c.type, c]));
  const extraPackages = collectCustomNugetPackages(customActivities, activityTypes);

  for (const type of activityTypes) {
    if (!type.startsWith('Custom.') && !customByType.has(type)) {
      continue;
    }
    const def = customByType.get(type);
    if (!def?.nugetPackage) {
      warnings.push({
        severity: 'warning',
        code: 'custom-missing-nuget',
        activityType: type,
        message: `Custom activity "${type}" has no NuGet package id — Studio Web may not restore it.`
      });
    }
  }

  const dependencies = resolveUiPathDependencies({
    activityTypes,
    preserved: manifest.uipathDependencies || {},
    includeBaseline: true,
    extraPackages
  });

  // Flag default placeholder version pins (often means unmapped custom package)
  for (const [name, ver] of Object.entries(dependencies)) {
    if (ver === '[1.0.0]' || ver === '1.0.0') {
      warnings.push({
        severity: name.startsWith('UiPath.') ? 'warning' : 'warning',
        code: 'default-package-version',
        message: `Package "${name}" uses placeholder version ${ver} — open Manage Packages to set a Studio Web–compatible pin.`
      });
    }
  }

  // Also flag explicit manifest pins stuck on [1.0.0]
  for (const [name, ver] of Object.entries(manifest.uipathDependencies || {})) {
    if (
      (ver === '[1.0.0]' || ver === '1.0.0') &&
      !warnings.some(
        (w) => w.code === 'default-package-version' && w.message.includes(`"${name}"`)
      )
    ) {
      warnings.push({
        severity: 'warning',
        code: 'default-package-version',
        message: `Manifest pin "${name}" is ${ver} — set a real version before Connect.`
      });
    }
  }

  if (!docs.length) {
    warnings.push({
      severity: 'warning',
      code: 'no-workflows',
      message: 'Project has no readable .lcs.json workflows to package.'
    });
  }

  // Stable order: warnings first, then info
  warnings.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'warning' ? -1 : 1;
    }
    return a.message.localeCompare(b.message);
  });

  return {
    projectName,
    warnings,
    dependencies,
    activityTypes,
    workflowCount: docs.length
  };
}

export function validateWorkflowPackages(
  doc: WorkflowDocument,
  workflowRel?: string,
  projectDir?: string
): PackageWarning[] {
  const warnings: PackageWarning[] = [];
  const walk = (list: ActivityNode[]) => {
    for (const activity of list) {
      warnings.push(...classifyActivity(activity, workflowRel, projectDir));
      if (activity.children) {
        walk(activity.children);
      }
      if (activity.elseChildren) {
        walk(activity.elseChildren);
      }
    }
  };
  walk(doc.activities);
  return warnings;
}

function classifyActivity(
  activity: ActivityNode,
  workflowRel?: string,
  projectDir?: string
): PackageWarning[] {
  const warnings: PackageWarning[] = [];
  const type = activity.type;
  const base = {
    workflow: workflowRel,
    activityId: activity.id,
    activityType: type
  };

  if (type.startsWith('Imported.')) {
    warnings.push({
      ...base,
      severity: 'warning',
      code: 'imported-placeholder',
      message: `${activity.displayName}: "${type}" exports as a Comment placeholder in Studio Web — replace after import.`
    });
  }

  if (isWindowsOnlyActivityType(type)) {
    warnings.push({
      ...base,
      severity: 'warning',
      code: 'windows-only-activity',
      message: `${activity.displayName}: ${windowsOnlyReason(type)}`
    });
  }

  if (type === 'System.Comment') {
    const text = String(activity.properties?.text || '');
    if (/placeholder|Imported\.|TODO/i.test(text) || /placeholder|Imported\./i.test(activity.displayName)) {
      warnings.push({
        ...base,
        severity: 'info',
        code: 'comment-placeholder',
        message: `${activity.displayName}: comment looks like an unresolved import placeholder.`
      });
    }
  }

  const packages = packagesForActivityType(type);
  const def = getActivityDefinition(type);
  if (!def && !type.startsWith('Imported.') && !type.startsWith('Custom.')) {
    warnings.push({
      ...base,
      severity: 'warning',
      code: 'unknown-activity',
      message: `${activity.displayName}: unknown type "${type}" — may export as a Comment placeholder.`
    });
  } else if (!packages.length && !type.startsWith('Flowchart.') && !type.startsWith('Imported.')) {
    warnings.push({
      ...base,
      severity: 'info',
      code: 'unmapped-package',
      message: `${activity.displayName}: no explicit UiPath package map for "${type}" (falls back to System.Activities).`
    });
  }

  if (type === 'REFramework.InvokeWorkflow') {
    const rel = String(activity.properties?.workflowPath || '').trim().replace(/\\/g, '/');
    if (!rel) {
      warnings.push({
        ...base,
        severity: 'warning',
        code: 'invoke-missing-path',
        message: `${activity.displayName}: Invoke Workflow has no workflow path.`
      });
    } else if (projectDir) {
      const abs = path.isAbsolute(rel) ? rel : path.join(projectDir, rel);
      if (!fs.existsSync(abs)) {
        warnings.push({
          ...base,
          severity: 'warning',
          code: 'invoke-missing-file',
          message: `${activity.displayName}: invoked workflow not found: ${rel}`
        });
      }
    }
  }

  // UI activities without selectors often fail at runtime / Studio Web review
  if (type.startsWith('UI.') && type !== 'UI.OpenApplication' && type !== 'UI.TakeScreenshot') {
    const selector = String(activity.properties?.selector || '').trim();
    if (!selector) {
      warnings.push({
        ...base,
        severity: 'warning',
        code: 'ui-missing-selector',
        message: `${activity.displayName}: UI activity has no Windows selector — capture with UI Explorer on Windows.`
      });
    } else if (isPlaceholderSelector(selector)) {
      warnings.push({
        ...base,
        severity: 'warning',
        code: 'ui-placeholder-selector',
        message: `${activity.displayName}: selector is still a starter / placeholder — replace with a captured Windows <html>/<webctrl> or <wnd> selector.`
      });
    } else {
      const quality = scoreSelector(selector);
      if (quality.level === 'weak') {
        warnings.push({
          ...base,
          severity: 'warning',
          code: 'ui-weak-selector',
          message: `${activity.displayName}: weak selector (score ${quality.score}/100) — ${quality.hints[0] || 'add Id or aaname'}.`
        });
      } else if (!isWindowsClassicSelector(selector)) {
        warnings.push({
          ...base,
          severity: 'info',
          code: 'ui-nonclassic-selector',
          message: `${activity.displayName}: selector may not be classic Windows format (expected <html>/<webctrl>/<wnd>).`
        });
      }
    }
  }

  return warnings;
}

export function formatPackageValidationReport(result: PackageValidationResult): string {
  const lines: string[] = [
    `Package validation — ${result.projectName}`,
    '─'.repeat(48),
    `Workflows: ${result.workflowCount}`,
    `Activity types: ${result.activityTypes.length}`,
    `Dependencies: ${Object.keys(result.dependencies).length}`,
    ''
  ];

  if (!result.warnings.length) {
    lines.push('OK: no package / export warnings.');
  } else {
    const warnCount = result.warnings.filter((w) => w.severity === 'warning').length;
    const infoCount = result.warnings.filter((w) => w.severity === 'info').length;
    lines.push(`Found ${warnCount} warning(s), ${infoCount} info note(s):`);
    lines.push('');
    for (const w of result.warnings) {
      const where = w.workflow ? ` [${w.workflow}]` : '';
      lines.push(`[${w.severity}]${where} ${w.message}`);
    }
  }

  lines.push('');
  lines.push('Resolved NuGet packages:');
  for (const [name, ver] of Object.entries(result.dependencies)) {
    lines.push(`  ${name}: ${ver}`);
  }
  return lines.join('\n');
}

function listLcsWorkflows(projectDir: string): string[] {
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
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.endsWith('.StudioWeb')) {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.lcs.json')) {
        results.push(path.relative(projectDir, full).replace(/\\/g, '/'));
      }
    }
  }
  return results.sort();
}
