import * as fs from 'fs';
import * as path from 'path';
import {
  PackageValidationResult,
  formatPackageValidationReport,
  validateProjectPackages
} from './packageValidation';
import {
  WindowsTodoChecklist,
  checklistFromValidation,
  formatWindowsTodoReport,
  writeWindowsTodoFile
} from './windowsTodo';
import {
  StudioWebOpenabilityReport,
  getStudioWebLocalLink,
  validateStudioWebLocalOpenability
} from './studioWebLocal';

export type ReadyGateSeverity = 'block' | 'warn' | 'ok' | 'info';

export interface ReadyGateItem {
  id: string;
  severity: ReadyGateSeverity;
  title: string;
  detail?: string;
}

export interface ReadyForStudioWebReport {
  projectName: string;
  projectDir: string;
  ready: boolean;
  items: ReadyGateItem[];
  validation: PackageValidationResult;
  windowsTodo: WindowsTodoChecklist;
  openability?: StudioWebOpenabilityReport;
  linked: boolean;
  solutionDir?: string;
  summary: string;
}

const BLOCK_CODES = new Set([
  'imported-placeholder',
  'invoke-missing-path',
  'invoke-missing-file',
  'missing-workflow',
  'no-workflows',
  'unknown-activity',
  'custom-missing-nuget',
  'default-package-version',
  'ui-missing-selector',
  'ui-placeholder-selector',
  'parse-error'
]);

/**
 * Theme 1 / T3 — one gate before Reveal Local Workspace / open Studio Web.
 * Composes packages, Windows TODO, Portable openability, Imported.*, selectors.
 */
export function evaluateReadyForStudioWeb(projectDir: string): ReadyForStudioWebReport {
  const validation = validateProjectPackages(projectDir);
  const windowsTodo = checklistFromValidation(validation);
  writeWindowsTodoFile(projectDir, windowsTodo);

  const link = getStudioWebLocalLink(projectDir);
  const openability = link ? validateStudioWebLocalOpenability(projectDir) : undefined;
  const items: ReadyGateItem[] = [];

  // Link / Portable openability
  if (!link) {
    items.push({
      id: 'not-linked',
      severity: 'warn',
      title: 'Not linked to Studio Web Local Workspace',
      detail: 'Run Connect so Save syncs .xaml into a Local Workspace.'
    });
  } else if (openability) {
    if (openability.ok) {
      items.push({
        id: 'openable',
        severity: 'ok',
        title: 'Local Workspace openable',
        detail: `${openability.workflows.length} .xaml · Portable · ${path.basename(openability.solutionDir)}`
      });
    } else {
      for (const err of openability.errors) {
        items.push({
          id: 'openability',
          severity: 'block',
          title: 'Cannot open in Studio Web Local',
          detail: err
        });
      }
    }
  }

  // Package / export blockers from validation
  const warnCodes = validation.warnings.filter((w) => w.severity === 'warning');
  const imported = warnCodes.filter((w) => w.code === 'imported-placeholder');
  const invokes = warnCodes.filter(
    (w) => w.code === 'invoke-missing-path' || w.code === 'invoke-missing-file'
  );
  const selectors = warnCodes.filter(
    (w) =>
      w.code === 'ui-missing-selector' ||
      w.code === 'ui-placeholder-selector' ||
      w.code === 'ui-weak-selector'
  );
  const pins = warnCodes.filter((w) => w.code === 'default-package-version');
  const otherBlocks = warnCodes.filter(
    (w) => BLOCK_CODES.has(w.code) && !imported.includes(w) && !invokes.includes(w) && !pins.includes(w)
  );

  if (imported.length) {
    items.push({
      id: 'imported',
      severity: 'block',
      title: `${imported.length} Imported.* placeholder(s)`,
      detail: imported
        .slice(0, 4)
        .map((w) => w.message)
        .join(' · ')
    });
  } else {
    items.push({
      id: 'imported',
      severity: 'ok',
      title: 'No Imported.* placeholders'
    });
  }

  if (invokes.length) {
    items.push({
      id: 'invoke',
      severity: 'block',
      title: `${invokes.length} broken Invoke path(s)`,
      detail: invokes
        .slice(0, 4)
        .map((w) => w.message)
        .join(' · ')
    });
  } else {
    items.push({
      id: 'invoke',
      severity: 'ok',
      title: 'Invoke Workflow paths resolve'
    });
  }

  if (selectors.length) {
    const hard = selectors.filter((w) => w.code !== 'ui-weak-selector');
    items.push({
      id: 'selectors',
      severity: hard.length ? 'block' : 'warn',
      title: `${selectors.length} selector issue(s)`,
      detail: selectors
        .slice(0, 3)
        .map((w) => w.message)
        .join(' · ')
    });
  } else {
    items.push({
      id: 'selectors',
      severity: 'ok',
      title: 'UI selectors look ready'
    });
  }

  if (pins.length) {
    items.push({
      id: 'packages',
      severity: 'block',
      title: `${pins.length} placeholder package pin(s)`,
      detail: 'Open Manage Packages and set Studio Web–compatible versions.'
    });
  } else {
    items.push({
      id: 'packages',
      severity: 'ok',
      title: `${Object.keys(validation.dependencies).length} NuGet deps resolved`
    });
  }

  for (const w of otherBlocks.slice(0, 8)) {
    items.push({
      id: w.code,
      severity: 'block',
      title: w.message,
      detail: w.workflow
    });
  }

  // Windows TODO (Mac→robot handoff notes; high = still block publish confidence)
  if (!windowsTodo.readyForWindows) {
    const high = windowsTodo.items.filter((i) => i.priority === 'high');
    items.push({
      id: 'windows-todo',
      severity: 'warn',
      title: windowsTodo.summary,
      detail: high
        .slice(0, 3)
        .map((i) => i.message)
        .join(' · ')
    });
  } else {
    items.push({
      id: 'windows-todo',
      severity: 'ok',
      title: 'Windows TODO clean (no high-priority items)'
    });
  }

  const blocks = items.filter((i) => i.severity === 'block');
  const warns = items.filter((i) => i.severity === 'warn');
  // Ready = no blockers. Link warn alone does not block "ready to Connect",
  // but openability blocks do. Soft warns (Windows TODO) keep ready=true when
  // packages/openability/imported are green — publish confidence is "green enough".
  const ready = blocks.length === 0 && !(openability && !openability.ok);
  const summary = ready
    ? warns.length
      ? `Ready for Studio Web with ${warns.length} note(s)`
      : 'Ready for Studio Web'
    : `${blocks.length} blocker(s) before Studio Web publish`;

  return {
    projectName: validation.projectName,
    projectDir,
    ready,
    items,
    validation,
    windowsTodo,
    openability,
    linked: Boolean(link),
    solutionDir: link?.solutionDir,
    summary
  };
}

export function formatReadyForStudioWebReport(report: ReadyForStudioWebReport): string {
  const lines: string[] = [
    `Ready for Studio Web? — ${report.projectName}`,
    '─'.repeat(48),
    report.summary,
    '',
    'Gate checklist:'
  ];
  for (const item of report.items) {
    const mark =
      item.severity === 'ok' ? '✓' : item.severity === 'block' ? '✗' : item.severity === 'warn' ? '!' : '·';
    lines.push(`  [${mark}] ${item.title}`);
    if (item.detail) {
      lines.push(`      ${item.detail}`);
    }
  }
  lines.push('', formatPackageValidationReport(report.validation));
  lines.push('', formatWindowsTodoReport(report.windowsTodo));
  if (report.openability) {
    lines.push('');
    lines.push('Studio Web Local openability:');
    lines.push(`  Solution: ${report.openability.solutionDir || '(none)'}`);
    lines.push(`  Openable: ${report.openability.ok ? 'yes' : 'NO'}`);
    for (const e of report.openability.errors) {
      lines.push(`  ! ${e}`);
    }
  } else if (!report.linked) {
    lines.push('', 'Not linked — Connect first to create / attach a Local Workspace.');
  }
  if (report.solutionDir && fs.existsSync(report.solutionDir)) {
    lines.push('', `Reveal path: ${report.solutionDir}`);
  }
  return lines.join('\n');
}
