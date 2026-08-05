import * as fs from 'fs';
import * as path from 'path';
import {
  PackageValidationResult,
  PackageWarning,
  validateProjectPackages
} from './packageValidation';

export interface WindowsTodoItem {
  priority: 'high' | 'medium' | 'low';
  code: string;
  message: string;
  workflow?: string;
  activityType?: string;
}

export interface WindowsTodoChecklist {
  projectName: string;
  items: WindowsTodoItem[];
  readyForWindows: boolean;
  summary: string;
}

const HIGH_CODES = new Set([
  'ui-missing-selector',
  'ui-placeholder-selector',
  'ui-weak-selector',
  'imported-placeholder',
  'invoke-missing-path',
  'invoke-missing-file',
  'non-windows-target',
  'unknown-activity',
  'custom-missing-nuget',
  'missing-workflow',
  'no-workflows'
]);

/**
 * Build a Mac → Windows handoff checklist from package validation.
 * High-priority items should be fixed (or captured on Windows) before robot run.
 */
export function buildWindowsTodoChecklist(projectDir: string): WindowsTodoChecklist {
  const validation = validateProjectPackages(projectDir);
  return checklistFromValidation(validation);
}

export function checklistFromValidation(
  validation: PackageValidationResult
): WindowsTodoChecklist {
  const items: WindowsTodoItem[] = validation.warnings
    .filter((w) => w.severity === 'warning' || HIGH_CODES.has(w.code))
    .map((w) => warningToTodo(w));

  // Deduplicate by message+workflow
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = `${item.workflow || ''}|${item.code}|${item.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    if (rank[a.priority] !== rank[b.priority]) {
      return rank[a.priority] - rank[b.priority];
    }
    return a.message.localeCompare(b.message);
  });

  const high = unique.filter((i) => i.priority === 'high').length;
  const readyForWindows = high === 0;
  const summary = readyForWindows
    ? `Windows ready — no high-priority TODOs (${unique.length} note(s)).`
    : `${high} high-priority Windows TODO(s) before reliable robot run.`;

  return {
    projectName: validation.projectName,
    items: unique,
    readyForWindows,
    summary
  };
}

export function formatWindowsTodoMarkdown(todo: WindowsTodoChecklist): string {
  const lines = [
    `# Windows TODO — ${todo.projectName}`,
    '',
    todo.summary,
    '',
    'Designed on Mac in **LowCode Studio**. Capture/refine UI selectors on a **Windows** machine (UI Explorer / Indicate Element), then publish and run on a Windows robot.',
    ''
  ];

  if (!todo.items.length) {
    lines.push('No outstanding Windows TODOs. You can Connect / publish.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Priority | Item | Workflow |');
  lines.push('|---|---|---|');
  for (const item of todo.items) {
    lines.push(
      `| ${item.priority} | ${escapeMd(item.message)} | ${escapeMd(item.workflow || '—')} |`
    );
  }
  lines.push('');
  lines.push('## Suggested Mac workflow');
  lines.push('');
  lines.push('1. Fix Invoke paths / missing workflows in LowCode Studio');
  lines.push('2. Use **Selector Builder** for classic `<html>/<webctrl>` / `<wnd>` strings');
  lines.push('3. Connect to Studio Web → open on Windows Studio Desktop');
  lines.push('4. Use Indicate Element for any remaining UI steps');
  lines.push('5. Publish → run on Windows robot');
  lines.push('');
  return lines.join('\n');
}

export function formatWindowsTodoReport(todo: WindowsTodoChecklist): string {
  const lines = [
    `Windows TODO — ${todo.projectName}`,
    '─'.repeat(48),
    todo.summary,
    ''
  ];
  if (!todo.items.length) {
    lines.push('OK: no Windows TODOs.');
    return lines.join('\n');
  }
  for (const item of todo.items) {
    const where = item.workflow ? ` [${item.workflow}]` : '';
    lines.push(`[${item.priority}]${where} ${item.message}`);
  }
  return lines.join('\n');
}

export function writeWindowsTodoFile(
  projectDirOrExportDir: string,
  todo: WindowsTodoChecklist
): string {
  const filePath = path.join(projectDirOrExportDir, 'WINDOWS_TODO.md');
  fs.writeFileSync(filePath, formatWindowsTodoMarkdown(todo), 'utf8');
  return filePath;
}

function warningToTodo(w: PackageWarning): WindowsTodoItem {
  const priority: WindowsTodoItem['priority'] = HIGH_CODES.has(w.code)
    ? 'high'
    : w.severity === 'warning'
      ? 'medium'
      : 'low';
  return {
    priority,
    code: w.code,
    message: w.message,
    workflow: w.workflow,
    activityType: w.activityType
  };
}

function escapeMd(text: string): string {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
