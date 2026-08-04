import {
  ActivityNode,
  WorkflowDocument,
  WorkflowVariable
} from '../models/workflow';
import { getActivityDefinition } from '../models/activities';
import { CustomActivityDefinition } from '../models/customActivities';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  activityId?: string;
  message: string;
}

export interface DryRunStep {
  index: number;
  activityId: string;
  displayName: string;
  type: string;
  action: string;
  status: 'ok' | 'skipped' | 'error' | 'warn';
  /** Full variable snapshot after this step */
  variablesSnapshot?: Record<string, unknown>;
  /** Keys that changed vs the previous step */
  changedKeys?: string[];
}

export interface DryRunFixtures {
  /** GetText / GetAttribute values by activity id, result var, or selector */
  uiText?: Record<string, string>;
  /** ElementExists outcomes by activity id, result var, or selector */
  elementExists?: Record<string, boolean>;
  /** Table fixtures for ExtractTableData / ReadCsv by activity id or result var */
  tables?: Record<string, { columns: string[]; rows: unknown[][] }>;
  /** HTTP response fixtures by activity id, result var, or URL fragment */
  http?: Record<string, { status?: number; body?: unknown }>;
}

export interface DryRunResult {
  ok: boolean;
  steps: DryRunStep[];
  variables: Record<string, unknown>;
  log: string[];
  warnings: string[];
}

export interface DryRunOptions {
  /** Seed / override variables before execution (Config, MaxTransactions, …) */
  initialVariables?: Record<string, unknown>;
  /** Mock UI / HTTP / table responses for stronger Mac dry-runs */
  fixtures?: DryRunFixtures;
  /** Capture per-step variable snapshots (default true) */
  captureSnapshots?: boolean;
}

export function validateWorkflow(doc: WorkflowDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!doc.name?.trim()) {
    issues.push({ severity: 'error', message: 'Workflow name is required.' });
  }

  if (!doc.activities.length) {
    issues.push({
      severity: 'warning',
      message: 'Workflow has no activities. Add activities from the Activities panel.'
    });
  }

  const varNames = new Set(doc.variables.map((v) => v.name));
  walk(doc.activities, (activity) => {
    const def = getActivityDefinition(activity.type);
    if (!def) {
      issues.push({
        severity: 'error',
        activityId: activity.id,
        message: `Unknown activity type: ${activity.type}`
      });
      return;
    }

    for (const prop of def.properties) {
      if (!prop.required) {
        continue;
      }
      const value = activity.properties?.[prop.name];
      if (value === undefined || value === null || String(value).trim() === '') {
        issues.push({
          severity: 'error',
          activityId: activity.id,
          message: `${activity.displayName}: property "${prop.label}" is required.`
        });
      }
    }

    if (activity.type === 'Programming.Assign') {
      const target = String(activity.properties?.to || '');
      if (target && !varNames.has(target) && !/^[A-Za-z_][\w.]*$/.test(target)) {
        issues.push({
          severity: 'warning',
          activityId: activity.id,
          message: `Assign target "${target}" does not look like a variable name.`
        });
      }
    }
  });

  const duplicates = findDuplicateVariableNames(doc.variables);
  for (const name of duplicates) {
    issues.push({
      severity: 'error',
      message: `Duplicate variable name: ${name}`
    });
  }

  if (doc.type === 'Flowchart') {
    const ids = new Set(doc.activities.map((a) => a.id));
    if (!doc.startActivityId || !ids.has(doc.startActivityId)) {
      const start = doc.activities.find((a) => a.type === 'Flowchart.Start');
      if (!start) {
        issues.push({
          severity: 'error',
          message: 'Flowchart needs a Start node or startActivityId.'
        });
      }
    }
    for (const c of doc.connections || []) {
      if (!ids.has(c.from) || !ids.has(c.to)) {
        issues.push({
          severity: 'error',
          message: `Connection ${c.id} references a missing node.`
        });
      }
    }
  }

  return issues;
}

export function dryRunWorkflow(
  doc: WorkflowDocument,
  options: DryRunOptions = {}
): DryRunResult {
  const variables: Record<string, unknown> = {};
  for (const v of doc.variables) {
    variables[v.name] = v.defaultValue ?? defaultForType(v.type);
  }
  if (options.initialVariables) {
    Object.assign(variables, options.initialVariables);
  }

  const fixtures = options.fixtures || {};
  const captureSnapshots = options.captureSnapshots !== false;
  const steps: DryRunStep[] = [];
  const warnings: string[] = [];
  const log: string[] = [`Starting dry-run for "${doc.name}" (${doc.type})`];
  if (options.initialVariables && Object.keys(options.initialVariables).length) {
    log.push(
      `Seeded variables: ${Object.keys(options.initialVariables).sort().join(', ')}`
    );
  }
  if (hasFixtures(fixtures)) {
    log.push('Using dry-run fixtures (UI / HTTP / tables).');
  }
  let index = 1;
  let ok = true;
  let previousSnapshot = captureSnapshots ? cloneVars(variables) : undefined;

  const pushStep = (
    activity: ActivityNode,
    action: string,
    status: DryRunStep['status'] = 'ok'
  ) => {
    const step: DryRunStep = {
      index: index++,
      activityId: activity.id,
      displayName: activity.displayName,
      type: activity.type,
      action,
      status
    };
    if (captureSnapshots) {
      const snap = cloneVars(variables);
      step.variablesSnapshot = snap;
      step.changedKeys = diffVariableKeys(previousSnapshot || {}, snap);
      previousSnapshot = snap;
    }
    steps.push(step);
  };

  const runList = (list: ActivityNode[], depth = 0) => {
    for (const activity of list) {
      const indent = '  '.repeat(depth);
      const summary = summarize(activity, variables);
      try {
        const warn = executeStub(activity, variables, log, indent, fixtures);
        if (warn) {
          warnings.push(warn);
          log.push(`${indent}WARN: ${warn}`);
          pushStep(activity, summary, 'warn');
        } else {
          pushStep(activity, summary);
        }
        runChildren(activity, depth, runList, log, variables, fixtures, warnings);
      } catch (err) {
        ok = false;
        const message = err instanceof Error ? err.message : String(err);
        pushStep(activity, message, 'error');
        log.push(`${indent}ERROR: ${message}`);
      }
    }
  };

  if (doc.type === 'Flowchart') {
    ok = runFlowchart(doc, variables, log, pushStep, fixtures, warnings) && ok;
  } else {
    runList(doc.activities);
  }

  log.push(ok ? 'Dry-run completed successfully.' : 'Dry-run completed with errors.');
  if (warnings.length) {
    log.push(`${warnings.length} warning(s) during dry-run.`);
  }
  return { ok, steps, variables, log, warnings };
}

/** Human-readable dry-run report with per-step variable diffs. */
export function formatDryRunReport(result: DryRunResult, title = 'Dry Run'): string {
  const lines: string[] = [title, '─'.repeat(48)];
  for (const step of result.steps) {
    const mark =
      step.status === 'error' ? '✗' : step.status === 'warn' ? '!' : step.status === 'skipped' ? '·' : '✓';
    lines.push(`[${step.index}] ${mark} ${step.displayName} — ${step.action}`);
    if (step.changedKeys?.length && step.variablesSnapshot) {
      for (const key of step.changedKeys) {
        lines.push(`     Δ ${key} = ${JSON.stringify(step.variablesSnapshot[key])}`);
      }
    }
  }
  lines.push('─'.repeat(48));
  if (result.warnings.length) {
    lines.push('Warnings:');
    for (const w of result.warnings) {
      lines.push(`  ! ${w}`);
    }
    lines.push('');
  }
  lines.push('Variables snapshot:');
  lines.push(JSON.stringify(result.variables, null, 2));
  lines.push(result.ok ? 'Result: OK' : 'Result: ERRORS');
  return lines.join('\n');
}

/** Side-by-side expected vs actual for scenario assertions. */
export function formatVariableDiff(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>
): string {
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  const lines = ['Expected vs actual', '─'.repeat(48)];
  lines.push('Variable'.padEnd(22) + 'Expected'.padEnd(28) + 'Actual');
  for (const key of keys) {
    const exp = key in expected ? JSON.stringify(expected[key]) : '—';
    const act = key in actual ? JSON.stringify(actual[key]) : '—';
    const match = looseJsonEqual(expected[key], actual[key]);
    const mark = match ? '✓' : '✗';
    lines.push(
      `${mark} ${key}`.padEnd(22) + truncate(exp, 26).padEnd(28) + truncate(act, 40)
    );
    if (!match && isDataTableLike(expected[key]) && isDataTableLike(actual[key])) {
      lines.push(...formatDataTableSideBySide(expected[key] as DataTableLike, actual[key] as DataTableLike));
    }
  }
  return lines.join('\n');
}

function runChildren(
  activity: ActivityNode,
  depth: number,
  runList: (list: ActivityNode[], depth?: number) => void,
  log: string[],
  variables: Record<string, unknown>,
  fixtures: DryRunFixtures,
  warnings: string[]
) {
  if (!activity.children?.length) {
    return;
  }
  const indent = '  '.repeat(depth);
  if (activity.type === 'ControlFlow.If') {
    const condition = String(activity.properties?.condition ?? 'true');
    const truthy = evaluateLoose(condition, variables);
    log.push(`${indent}If (${condition}) => ${truthy}`);
    if (truthy) {
      runList(activity.children, depth + 1);
    } else if (activity.elseChildren?.length) {
      runList(activity.elseChildren, depth + 1);
    }
  } else if (activity.type === 'ControlFlow.ForEach') {
    const valuesExpr = String(activity.properties?.values ?? '[]');
    const values = asArray(resolveExpression(valuesExpr, variables));
    const itemName = String(activity.properties?.item ?? 'item');
    log.push(`${indent}For Each ${itemName} in ${valuesExpr} (${values.length} items)`);
    for (const item of values.slice(0, 5)) {
      variables[itemName] = item;
      runList(activity.children, depth + 1);
    }
    if (values.length > 5) {
      log.push(`${indent}... truncated remaining ${values.length - 5} iterations in dry-run`);
    }
  } else if (activity.type === 'Data.ForEachRow') {
    const tableName = String(activity.properties?.dataTable ?? 'dt');
    const rowName = String(activity.properties?.row ?? 'row');
    const table = resolveExpression(tableName, variables);
    const rows = asArray(
      table && typeof table === 'object' && Array.isArray((table as { rows?: unknown[] }).rows)
        ? (table as { rows: unknown[] }).rows
        : table
    );
    log.push(`${indent}For Each Row ${rowName} in ${tableName} (${rows.length} rows)`);
    for (const row of rows.slice(0, 5)) {
      variables[rowName] = row;
      runList(activity.children, depth + 1);
    }
    if (rows.length > 5) {
      log.push(`${indent}... truncated remaining ${rows.length - 5} rows in dry-run`);
    }
  } else if (activity.type === 'ControlFlow.Switch') {
    const expr = String(activity.properties?.expression ?? 'status');
    const value = resolveExpression(expr, variables);
    log.push(`${indent}Switch (${expr}) => ${JSON.stringify(value)} (running Default body)`);
    runList(activity.children, depth + 1);
  } else if (activity.type === 'ControlFlow.While' || activity.type === 'ControlFlow.DoWhile') {
    log.push(`${indent}${activity.type === 'ControlFlow.DoWhile' ? 'DoWhile' : 'While'} simulated for 1 iteration`);
    runList(activity.children, depth + 1);
  } else if (activity.type === 'ControlFlow.RetryScope') {
    log.push(`${indent}RetryScope (1 attempt in dry-run)`);
    runList(activity.children, depth + 1);
  } else if (activity.type === 'Python.PythonScope') {
    log.push(`${indent}PythonScope body`);
    runList(activity.children, depth + 1);
  } else if (activity.type === 'ControlFlow.TryCatch') {
    log.push(`${indent}Try`);
    runList(activity.children, depth + 1);
    if (activity.elseChildren?.length) {
      log.push(`${indent}Catch (not entered in dry-run)`);
    }
  } else {
    runList(activity.children, depth + 1);
  }
  void fixtures;
  void warnings;
}

function runFlowchart(
  doc: WorkflowDocument,
  variables: Record<string, unknown>,
  log: string[],
  pushStep: (activity: ActivityNode, action: string, status?: DryRunStep['status']) => void,
  fixtures: DryRunFixtures,
  warnings: string[]
): boolean {
  const byId = new Map(doc.activities.map((a) => [a.id, a]));
  const outs = new Map<string, { to: string; label?: string }[]>();
  for (const c of doc.connections || []) {
    const list = outs.get(c.from) || [];
    list.push({ to: c.to, label: c.label });
    outs.set(c.from, list);
  }

  let currentId =
    doc.startActivityId ||
    doc.activities.find((a) => a.type === 'Flowchart.Start')?.id ||
    doc.activities[0]?.id;

  if (!currentId) {
    log.push('Flowchart has no nodes to run.');
    return false;
  }

  let ok = true;
  const visited = new Map<string, number>();
  let guard = 0;
  const maxSteps = 80;

  while (currentId && guard++ < maxSteps) {
    const activity = byId.get(currentId);
    if (!activity) {
      log.push(`Missing node ${currentId}`);
      return false;
    }

    const seen = (visited.get(currentId) || 0) + 1;
    visited.set(currentId, seen);
    if (seen > 8) {
      log.push(`Loop guard: stopped revisiting ${activity.displayName}`);
      break;
    }

    try {
      const warn = executeStub(activity, variables, log, '', fixtures);
      if (warn) {
        warnings.push(warn);
        log.push(`WARN: ${warn}`);
        pushStep(activity, summarize(activity, variables), 'warn');
      } else {
        pushStep(activity, summarize(activity, variables));
      }
    } catch (err) {
      ok = false;
      const message = err instanceof Error ? err.message : String(err);
      pushStep(activity, message, 'error');
      log.push(`ERROR: ${message}`);
      break;
    }

    if (activity.type === 'Flowchart.End') {
      break;
    }

    const edges = outs.get(currentId) || [];
    if (!edges.length) {
      break;
    }

    if (activity.type === 'Flowchart.FlowDecision') {
      const condition = String(activity.properties?.condition ?? 'true');
      const truthy = evaluateLoose(condition, variables);
      log.push(`Decision (${condition}) => ${truthy}`);
      const label = truthy ? 'True' : 'False';
      const match =
        edges.find((e) => (e.label || '').toLowerCase() === label.toLowerCase()) ||
        edges.find((e) => (truthy ? !e.label || e.label.toLowerCase() === 'true' : e.label?.toLowerCase() === 'false')) ||
        edges[0];
      currentId = match?.to;
    } else {
      // Prefer unlabeled / Next / default edge
      const next =
        edges.find((e) => !e.label || e.label.toLowerCase() === 'next') || edges[0];
      currentId = next?.to;
    }

    // Simulate REFramework transaction exhaustion after a few Get Transaction loops
    if (
      activity.displayName.toLowerCase().includes('get transaction') &&
      typeof variables.TransactionNumber === 'number'
    ) {
      const n = Number(variables.TransactionNumber);
      const max = Number(variables.MaxTransactions ?? 3);
      if (n > max) {
        variables.TransactionItem = null;
        log.push('No more transaction items (simulated).');
      }
    }
  }

  if (guard >= maxSteps) {
    log.push('Flowchart dry-run hit max step limit.');
  }
  return ok;
}

export function toPseudocode(doc: WorkflowDocument): string {
  const lines: string[] = [];
  lines.push(`// Workflow: ${doc.name}`);
  lines.push(`// Type: ${doc.type}`);
  if (doc.variables.length) {
    lines.push('// Variables:');
    for (const v of doc.variables) {
      lines.push(`//   ${v.type} ${v.name} = ${JSON.stringify(v.defaultValue ?? null)}`);
    }
  }
  lines.push('');
  emitPseudo(doc.activities, lines, 0);
  return lines.join('\n') + '\n';
}

function emitPseudo(list: ActivityNode[], lines: string[], depth: number) {
  const pad = '  '.repeat(depth);
  for (const activity of list) {
    switch (activity.type) {
      case 'System.LogMessage':
        lines.push(`${pad}Log(${activity.properties.message})`);
        break;
      case 'System.Delay':
        lines.push(`${pad}Delay(${activity.properties.durationMs} ms)`);
        break;
      case 'Programming.Assign':
        lines.push(`${pad}${activity.properties.to} = ${activity.properties.value}`);
        break;
      case 'ControlFlow.If':
        lines.push(`${pad}If (${activity.properties.condition})`);
        emitPseudo(activity.children || [], lines, depth + 1);
        if (activity.elseChildren?.length) {
          lines.push(`${pad}Else`);
          emitPseudo(activity.elseChildren, lines, depth + 1);
        }
        lines.push(`${pad}End If`);
        break;
      case 'ControlFlow.While':
        lines.push(`${pad}While (${activity.properties.condition})`);
        emitPseudo(activity.children || [], lines, depth + 1);
        lines.push(`${pad}End While`);
        break;
      case 'ControlFlow.ForEach':
        lines.push(
          `${pad}For Each ${activity.properties.item} In ${activity.properties.values}`
        );
        emitPseudo(activity.children || [], lines, depth + 1);
        lines.push(`${pad}Next`);
        break;
      case 'UI.Click':
        lines.push(`${pad}Click(${JSON.stringify(activity.properties.selector)})`);
        break;
      case 'UI.UseApplicationBrowser':
        lines.push(
          `${pad}UseApplicationBrowser(${JSON.stringify(activity.properties.urlOrPath || '')})`
        );
        emitPseudo(activity.children || [], lines, depth + 1);
        lines.push(`${pad}End UseApplicationBrowser`);
        break;
      case 'UI.ExtractTableData':
        lines.push(
          `${pad}${activity.properties.result || 'extractedTable'} = ExtractTableData(${JSON.stringify(activity.properties.selector)}, smart=${activity.properties.smartExtraction !== false})`
        );
        break;
      case 'UI.TypeInto':
        lines.push(
          `${pad}TypeInto(${JSON.stringify(activity.properties.selector)}, ${activity.properties.text})`
        );
        break;
      case 'Messaging.HttpRequest':
        lines.push(
          `${pad}${activity.properties.result} = Http(${activity.properties.method}, ${activity.properties.url})`
        );
        break;
      default:
        lines.push(`${pad}${activity.displayName}(...)`);
        if (activity.children?.length) {
          emitPseudo(activity.children, lines, depth + 1);
        }
    }
  }
}

function walk(list: ActivityNode[], visitor: (a: ActivityNode) => void) {
  for (const activity of list) {
    visitor(activity);
    if (activity.children) {
      walk(activity.children, visitor);
    }
    if (activity.elseChildren) {
      walk(activity.elseChildren, visitor);
    }
  }
}

function findDuplicateVariableNames(variables: WorkflowVariable[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of variables) {
    if (seen.has(v.name)) {
      dup.add(v.name);
    }
    seen.add(v.name);
  }
  return [...dup];
}

function defaultForType(type: string): unknown {
  switch (type) {
    case 'String':
      return '';
    case 'Int32':
    case 'Double':
      return 0;
    case 'Boolean':
      return false;
    case 'Array':
      return [];
    case 'DataTable':
      return { columns: [], rows: [] };
    default:
      return null;
  }
}

function summarize(activity: ActivityNode, variables: Record<string, unknown>): string {
  switch (activity.type) {
    case 'System.LogMessage':
      return `Log ${activity.properties.level}: ${activity.properties.message}`;
    case 'Programming.Assign':
      return `${activity.properties.to} := ${activity.properties.value}`;
    case 'UI.Click':
      return `Click ${String(activity.properties.selector).slice(0, 40)}`;
    case 'UI.UseApplicationBrowser':
      return `Use ${activity.properties.mode || 'Browser'}: ${activity.properties.urlOrPath}`;
    case 'UI.ExtractTableData':
      return `ExtractTable -> ${activity.properties.result || 'extractedTable'}`;
    case 'UI.TypeInto':
      return `Type ${activity.properties.text}`;
    case 'Messaging.HttpRequest':
      return `${activity.properties.method} ${activity.properties.url}`;
    case 'Flowchart.Start':
      return 'Start';
    case 'Flowchart.End':
      return 'End';
    case 'Flowchart.FlowDecision':
      return `Decision: ${activity.properties.condition}`;
    case 'REFramework.InvokeWorkflow':
      return `Invoke ${activity.properties.workflowPath}`;
    case 'REFramework.SetTransactionStatus':
      return `Status=${activity.properties.status}`;
    default:
      return Object.keys(variables).length
        ? `${activity.displayName}`
        : activity.displayName;
  }
}

function executeStub(
  activity: ActivityNode,
  variables: Record<string, unknown>,
  log: string[],
  indent: string,
  fixtures: DryRunFixtures = {}
): string | undefined {
  let warning: string | undefined;
  const selector = String(activity.properties?.selector ?? '').trim();
  if (needsSelector(activity.type) && !selector) {
    warning = `${activity.displayName}: selector is empty (capture on Windows or use Selector Builder)`;
  }

  switch (activity.type) {
    case 'System.LogMessage': {
      const msg = resolveExpression(String(activity.properties.message ?? ''), variables);
      log.push(`${indent}[${activity.properties.level || 'Info'}] ${msg}`);
      break;
    }
    case 'System.Delay':
      log.push(`${indent}Delay ${activity.properties.durationMs}ms (simulated)`);
      break;
    case 'System.Comment':
      log.push(`${indent}// ${activity.properties.text}`);
      break;
    case 'System.MessageBox':
      log.push(`${indent}MessageBox ${activity.properties.title}: ${activity.properties.text}`);
      break;
    case 'System.WriteLine':
      log.push(`${indent}WriteLine ${activity.properties.text}`);
      break;
    case 'UI.Check':
      log.push(`${indent}Check ${activity.properties.action} selector=${JSON.stringify(activity.properties.selector)}`);
      break;
    case 'UI.Hover':
      log.push(`${indent}Hover selector=${JSON.stringify(activity.properties.selector)}`);
      break;
    case 'UI.SelectItem':
      log.push(`${indent}SelectItem ${activity.properties.item}`);
      break;
    case 'UI.TakeScreenshot':
      log.push(`${indent}TakeScreenshot -> ${activity.properties.filePath}`);
      break;
    case 'Excel.ReadRange': {
      const result = String(activity.properties.result || 'dt');
      variables[result] = { columns: ['A', 'B'], rows: [['1', '2']] };
      log.push(`${indent}Excel.ReadRange ${activity.properties.workbookPath} -> ${result}`);
      break;
    }
    case 'Excel.WriteRange':
      log.push(`${indent}Excel.WriteRange ${activity.properties.workbookPath}`);
      break;
    case 'Excel.ReadCell': {
      const result = String(activity.properties.result || 'cellValue');
      variables[result] = 'cell';
      log.push(`${indent}Excel.ReadCell ${activity.properties.cell} -> ${result}`);
      break;
    }
    case 'Excel.WriteCell':
      log.push(`${indent}Excel.WriteCell ${activity.properties.cell}=${activity.properties.value}`);
      break;
    case 'ControlFlow.Break':
      log.push(`${indent}Break`);
      break;
    case 'Python.PythonScope':
      log.push(
        `${indent}PythonScope path=${activity.properties.path || '(default)'} target=${activity.properties.target || 'x64'}`
      );
      break;
    case 'Python.LoadScript': {
      const result = String(activity.properties.result || 'pythonScript');
      variables[result] = {
        kind: 'PythonObject',
        file: activity.properties.file,
        code: activity.properties.code
      };
      log.push(`${indent}LoadPythonScript ${activity.properties.file || '(inline)'} -> ${result}`);
      break;
    }
    case 'Python.RunScript':
      log.push(
        `${indent}RunPythonScript ${activity.properties.file || ''} ${activity.properties.code ? '(inline code)' : ''}`.trim()
      );
      break;
    case 'Python.InvokeMethod': {
      const result = String(activity.properties.result || 'pythonResult');
      variables[result] = {
        kind: 'PythonObject',
        method: activity.properties.name,
        instance: activity.properties.instance
      };
      log.push(
        `${indent}InvokePythonMethod ${activity.properties.instance}.${activity.properties.name}() -> ${result}`
      );
      break;
    }
    case 'Python.GetObject': {
      const result = String(activity.properties.result || 'netValue');
      const t = String(activity.properties.type || 'String');
      variables[result] =
        t === 'Int32' || t === 'Double' ? 0 : t === 'Boolean' ? false : t === 'Array' ? [] : 'python-value';
      log.push(
        `${indent}GetPythonObject ${activity.properties.pythonObject} as ${t} -> ${result}`
      );
      break;
    }
    case 'Programming.Assign': {
      const to = String(activity.properties.to);
      const value = resolveExpression(String(activity.properties.value ?? ''), variables);
      variables[to] = value;
      log.push(`${indent}Assign ${to} = ${JSON.stringify(value)}`);
      break;
    }
    case 'Programming.MultipleAssign': {
      const lines = String(activity.properties.assignments || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      log.push(`${indent}MultipleAssign (${lines.length} pairs)`);
      for (const line of lines) {
        const eq = line.indexOf('=');
        if (eq < 0) {
          continue;
        }
        const to = line.slice(0, eq).trim();
        const value = resolveExpression(line.slice(eq + 1).trim(), variables);
        variables[to] = value;
        log.push(`${indent}  ${to} = ${JSON.stringify(value)}`);
      }
      break;
    }
    case 'Programming.InvokeCode': {
      const lang = String(activity.properties.language || 'CSharp');
      const code = String(activity.properties.code || '');
      log.push(
        `${indent}InvokeCode [${lang}] (${code.split('\n').length} lines, simulated — not executed)`
      );
      break;
    }
    case 'System.Throw': {
      const message = resolveExpression(String(activity.properties.message ?? '"Error"'), variables);
      throw new Error(
        `${activity.properties.exceptionType || 'System.Exception'}: ${String(message)}`
      );
    }
    case 'System.TerminateWorkflow': {
      const reason = resolveExpression(
        String(activity.properties.reason ?? '"Terminated"'),
        variables
      );
      log.push(`${indent}TerminateWorkflow: ${String(reason)}`);
      throw new Error(`Workflow terminated: ${String(reason)}`);
    }
    case 'Data.AddDataRow': {
      const tableName = String(activity.properties.dataTable || 'dt');
      const table = (variables[tableName] || { columns: [], rows: [] }) as {
        columns: string[];
        rows: unknown[][];
      };
      const rowVal = resolveExpression(String(activity.properties.arrayRow ?? '[]'), variables);
      const row = Array.isArray(rowVal) ? rowVal : [rowVal];
      table.rows = [...(table.rows || []), row as unknown[]];
      variables[tableName] = table;
      log.push(`${indent}AddDataRow -> ${tableName} (${table.rows.length} rows)`);
      break;
    }
    case 'Data.AddDataColumn': {
      const tableName = String(activity.properties.dataTable || 'dt');
      const table = (variables[tableName] || { columns: [], rows: [] }) as {
        columns: string[];
        rows: unknown[][];
      };
      const col = String(activity.properties.columnName || 'NewColumn');
      table.columns = [...new Set([...(table.columns || []), col])];
      variables[tableName] = table;
      log.push(`${indent}AddDataColumn ${col} -> ${tableName}`);
      break;
    }
    case 'Data.FilterDataTable': {
      const tableName = String(activity.properties.dataTable || 'dt');
      const resultName = String(activity.properties.result || 'filteredDt');
      const col = String(activity.properties.columnName || '');
      const expected = resolveExpression(String(activity.properties.value ?? ''), variables);
      const table = (variables[tableName] || { columns: [], rows: [] }) as {
        columns: string[];
        rows: unknown[][];
      };
      const colIndex = (table.columns || []).indexOf(col);
      const rows =
        colIndex < 0
          ? table.rows || []
          : (table.rows || []).filter((r) => String(r[colIndex]) === String(expected));
      variables[resultName] = { columns: table.columns || [], rows };
      log.push(
        `${indent}FilterDataTable ${tableName} where ${col}==${JSON.stringify(expected)} -> ${resultName} (${rows.length} rows)`
      );
      break;
    }
    case 'Data.ClearDataTable': {
      const tableName = String(activity.properties.dataTable || 'dt');
      const table = (variables[tableName] || { columns: [], rows: [] }) as {
        columns: string[];
        rows: unknown[];
      };
      table.rows = [];
      variables[tableName] = table;
      log.push(`${indent}ClearDataTable ${tableName}`);
      break;
    }
    case 'Data.OutputDataTable': {
      const tableName = String(activity.properties.dataTable || 'dt');
      const resultName = String(activity.properties.result || 'tableText');
      const table = variables[tableName] as { columns?: string[]; rows?: unknown[][] } | undefined;
      const header = (table?.columns || []).join(',');
      const body = (table?.rows || []).map((r) => r.join(',')).join('\n');
      variables[resultName] = [header, body].filter(Boolean).join('\n');
      log.push(`${indent}OutputDataTable ${tableName} -> ${resultName}`);
      break;
    }
    case 'Data.ForEachRow':
      log.push(`${indent}ForEachRow ${activity.properties.dataTable}`);
      break;
    case 'ControlFlow.Switch':
      log.push(`${indent}Switch ${activity.properties.expression}`);
      break;
    case 'UI.GetAttribute': {
      const result = String(activity.properties.result || 'attributeValue');
      const attr = String(activity.properties.attribute || 'aaname');
      const fromFixture = lookupFixtureString(fixtures.uiText, activity, result, selector);
      variables[result] = fromFixture ?? `sample-${attr}`;
      log.push(
        `${indent}GetAttribute ${attr} -> ${result}${fromFixture !== undefined ? ' (fixture)' : ''}`
      );
      break;
    }
    case 'UI.WaitElement':
      log.push(
        `${indent}WaitElement ${activity.properties.action || 'Appear'} timeout=${activity.properties.timeoutMs || 30000}ms (simulated)`
      );
      break;
    case 'Messaging.DeserializeJson': {
      const result = String(activity.properties.result || 'jsonObj');
      const raw = resolveExpression(String(activity.properties.jsonString ?? '{}'), variables);
      try {
        variables[result] =
          typeof raw === 'string' ? JSON.parse(raw) : raw && typeof raw === 'object' ? raw : {};
      } catch {
        variables[result] = {};
      }
      log.push(`${indent}DeserializeJson -> ${result}`);
      break;
    }
    case 'Messaging.SerializeJson': {
      const result = String(activity.properties.result || 'jsonText');
      const value = resolveExpression(String(activity.properties.value ?? ''), variables);
      variables[result] = JSON.stringify(value ?? null);
      log.push(`${indent}SerializeJson -> ${result}`);
      break;
    }
    case 'UI.OpenApplication':
      log.push(`${indent}OpenApplication ${activity.properties.pathOrUrl}`);
      break;
    case 'UI.UseApplicationBrowser':
      log.push(
        `${indent}UseApplicationBrowser ${activity.properties.mode || 'Browser'} ${activity.properties.urlOrPath || ''}`
      );
      break;
    case 'UI.Click':
      log.push(`${indent}Click selector=${JSON.stringify(activity.properties.selector)}`);
      break;
    case 'UI.TypeInto':
      log.push(
        `${indent}TypeInto text=${resolveExpression(String(activity.properties.text ?? ''), variables)}`
      );
      break;
    case 'UI.GetText': {
      const result = String(activity.properties.result || 'extractedText');
      const fromFixture = lookupFixtureString(fixtures.uiText, activity, result, selector);
      variables[result] = fromFixture ?? 'Sample extracted text';
      log.push(
        `${indent}GetText -> ${result}=${JSON.stringify(variables[result])}${fromFixture !== undefined ? ' (fixture)' : ''}`
      );
      break;
    }
    case 'UI.ExtractTableData': {
      const result = String(activity.properties.result || 'extractedTable');
      const tableFixture = lookupFixtureTable(fixtures.tables, activity, result);
      if (tableFixture) {
        variables[result] = {
          ...tableFixture,
          smartExtraction: activity.properties.smartExtraction !== false
        };
        log.push(
          `${indent}ExtractTableData fixture cols=${tableFixture.columns.length} rows=${tableFixture.rows.length} -> ${result}`
        );
        break;
      }
      let columns = ['Column1', 'Column2'];
      try {
        const meta = JSON.parse(String(activity.properties.extractionMetadata || '{}')) as {
          Columns?: Array<{ Name?: string }>;
        };
        if (Array.isArray(meta.Columns) && meta.Columns.length) {
          columns = meta.Columns.map((c, i) => c.Name || `Column${i + 1}`);
        }
      } catch {
        // keep defaults — smart extraction mock
      }
      const max = Math.min(5, Math.max(1, Number(activity.properties.maxResults ?? 5)));
      const rows = Array.from({ length: max }, (_, r) =>
        columns.map((c) => `${c}_R${r + 1}`)
      );
      variables[result] = {
        columns,
        rows,
        smartExtraction: activity.properties.smartExtraction !== false
      };
      log.push(
        `${indent}ExtractTableData smart=${activity.properties.smartExtraction !== false} cols=${columns.length} rows=${rows.length} -> ${result}`
      );
      break;
    }
    case 'UI.ElementExists': {
      const result = String(activity.properties.result || 'exists');
      const fromFixture = lookupFixtureBool(fixtures.elementExists, activity, result, selector);
      variables[result] = fromFixture ?? true;
      log.push(
        `${indent}ElementExists -> ${result}=${variables[result]}${fromFixture !== undefined ? ' (fixture)' : ''}`
      );
      break;
    }
    case 'Data.ReadCsv': {
      const result = String(activity.properties.result || 'dt');
      variables[result] = {
        columns: ['Col1', 'Col2'],
        rows: [
          ['A', '1'],
          ['B', '2']
        ]
      };
      log.push(`${indent}ReadCsv ${activity.properties.path} -> ${result}`);
      break;
    }
    case 'Data.WriteCsv':
      log.push(`${indent}WriteCsv ${activity.properties.path}`);
      break;
    case 'Data.BuildDataTable': {
      const result = String(activity.properties.result || 'dt');
      const columns = String(activity.properties.columns || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      variables[result] = { columns, rows: [] };
      log.push(`${indent}BuildDataTable -> ${result} columns=${columns.join(',')}`);
      break;
    }
    case 'Messaging.SendEmail':
      log.push(
        `${indent}SendEmail to=${activity.properties.to} subject=${activity.properties.subject}`
      );
      break;
    case 'Messaging.HttpRequest': {
      const result = String(activity.properties.result || 'response');
      const urlRaw = String(activity.properties.url || '');
      const urlResolved = resolveExpression(urlRaw, variables);
      const url = String(urlResolved ?? urlRaw);
      const fromFixture = lookupFixtureHttp(fixtures.http, activity, result, url);
      variables[result] = fromFixture || { status: 200, body: { ok: true } };
      log.push(
        `${indent}HTTP ${activity.properties.method} ${url} -> ${result}${fromFixture ? ' (fixture)' : ''}`
      );
      break;
    }
    case 'Flowchart.Start':
      log.push(`${indent}▶ Start`);
      break;
    case 'Flowchart.End':
      log.push(`${indent}■ End`);
      break;
    case 'Flowchart.FlowDecision':
      log.push(`${indent}◇ Decision ${activity.properties.condition}`);
      break;
    case 'REFramework.InvokeWorkflow': {
      const wfPath = String(activity.properties.workflowPath || '');
      log.push(
        `${indent}InvokeWorkflow ${wfPath}` +
          (activity.properties.description ? ` (${activity.properties.description})` : '')
      );
      if (/GetTransactionData/i.test(wfPath)) {
        const n = Number(variables.TransactionNumber ?? 1);
        const max = Number(variables.MaxTransactions ?? 3);
        if (n > max) {
          variables.TransactionItem = null;
          log.push(`${indent}  → no more items (TransactionNumber=${n})`);
        } else {
          variables.TransactionItem = { id: n, data: `Item-${n}` };
          log.push(`${indent}  → TransactionItem id=${n}`);
        }
      } else if (/InitAllSettings/i.test(wfPath)) {
        variables.Config = variables.Config || { Settings: { MaxRetryNumber: 2 } };
        variables.MaxTransactions = variables.MaxTransactions ?? 3;
        variables.MaxRetryNumber = variables.MaxRetryNumber ?? 2;
      } else if (/Process\.lcs\.json/i.test(wfPath)) {
        variables.TransactionResult = 'Success';
        log.push(`${indent}  → Process completed (Success)`);
      } else if (/SetTransactionStatus/i.test(wfPath)) {
        variables.RetryNumber = 0;
        variables.TransactionNumber = Number(variables.TransactionNumber ?? 1) + 1;
        log.push(
          `${indent}  → status set, next TransactionNumber=${variables.TransactionNumber}`
        );
      }
      break;
    }
    case 'REFramework.SetTransactionStatus':
      variables.TransactionResult = activity.properties.status;
      log.push(`${indent}SetTransactionStatus ${activity.properties.status}`);
      break;
    default: {
      const def = getActivityDefinition(activity.type) as CustomActivityDefinition | undefined;
      if (def?.dryRun) {
        const stubLog =
          def.dryRun.log || `${activity.displayName} (custom simulated)`;
        log.push(`${indent}${stubLog}`);
        for (const [name, expr] of Object.entries(def.dryRun.assign || {})) {
          variables[name] = resolveExpression(String(expr), variables);
          log.push(`${indent}  → ${name} = ${JSON.stringify(variables[name])}`);
        }
      } else if (activity.type.startsWith('Custom.') || activity.type.startsWith('Imported.')) {
        log.push(`${indent}${activity.displayName} (simulated stub)`);
      } else {
        log.push(`${indent}${activity.displayName}`);
      }
    }
  }
  return warning;
}

function resolveExpression(expr: string, variables: Record<string, unknown>): unknown {
  const trimmed = expr.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'null' || trimmed === 'undefined') {
    return null;
  }
  if (trimmed in variables) {
    return variables[trimmed];
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  const add = trimmed.match(/^([A-Za-z_][\w]*)\s*\+\s*(-?\d+)$/);
  if (add && add[1] in variables) {
    return Number(variables[add[1]] ?? 0) + Number(add[2]);
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function evaluateLoose(condition: string, variables: Record<string, unknown>): boolean {
  const expr = condition.trim();

  const cmp = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (cmp) {
    const left = resolveExpression(cmp[1].trim(), variables);
    const right = resolveExpression(cmp[3].trim(), variables);
    const op = cmp[2];
    switch (op) {
      case '==':
        return looseEqual(left, right);
      case '!=':
        return !looseEqual(left, right);
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
    }
  }

  if (/\s+!=\s*null$/i.test(expr)) {
    const name = expr.replace(/\s+!=\s*null$/i, '').trim();
    return resolveExpression(name, variables) != null;
  }
  if (/\s+==\s*null$/i.test(expr)) {
    const name = expr.replace(/\s+==\s*null$/i, '').trim();
    return resolveExpression(name, variables) == null;
  }

  const value = resolveExpression(expr, variables);
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (value === null || value === undefined) {
    return false;
  }
  const text = String(value).trim().toLowerCase();
  if (text === 'false' || text === '0' || text === '' || text === 'null') {
    return false;
  }
  return true;
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a == null && (b === 'null' || b === null)) {
    return true;
  }
  return String(a) === String(b);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object' && Array.isArray((value as { rows?: unknown[] }).rows)) {
    return (value as { rows: unknown[] }).rows;
  }
  return [value];
}

type DataTableLike = { columns?: string[]; rows?: unknown[][] };

function hasFixtures(fixtures: DryRunFixtures): boolean {
  return Boolean(
    (fixtures.uiText && Object.keys(fixtures.uiText).length) ||
      (fixtures.elementExists && Object.keys(fixtures.elementExists).length) ||
      (fixtures.tables && Object.keys(fixtures.tables).length) ||
      (fixtures.http && Object.keys(fixtures.http).length)
  );
}

function cloneVars(variables: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(variables)) as Record<string, unknown>;
  } catch {
    return { ...variables };
  }
}

function diffVariableKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.filter((k) => !looseJsonEqual(before[k], after[k]));
}

function looseJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a == null && b == null) {
    return true;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return String(a) === String(b);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

function isDataTableLike(value: unknown): value is DataTableLike {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as DataTableLike).columns) &&
      Array.isArray((value as DataTableLike).rows)
  );
}

function formatDataTableSideBySide(expected: DataTableLike, actual: DataTableLike): string[] {
  const lines = ['     DataTable side-by-side:'];
  lines.push(
    `     expected columns: ${(expected.columns || []).join(', ') || '(none)'}`
  );
  lines.push(`     actual   columns: ${(actual.columns || []).join(', ') || '(none)'}`);
  const maxRows = Math.max(expected.rows?.length || 0, actual.rows?.length || 0, 0);
  for (let i = 0; i < Math.min(maxRows, 5); i++) {
    const expRow = expected.rows?.[i];
    const actRow = actual.rows?.[i];
    lines.push(
      `     row ${i + 1}: exp=${JSON.stringify(expRow ?? '—')} | act=${JSON.stringify(actRow ?? '—')}`
    );
  }
  if (maxRows > 5) {
    lines.push(`     … ${maxRows - 5} more row(s)`);
  }
  return lines;
}

function needsSelector(type: string): boolean {
  return (
    type === 'UI.Click' ||
    type === 'UI.TypeInto' ||
    type === 'UI.GetText' ||
    type === 'UI.GetAttribute' ||
    type === 'UI.ElementExists' ||
    type === 'UI.Check' ||
    type === 'UI.Hover' ||
    type === 'UI.SelectItem' ||
    type === 'UI.WaitElement' ||
    type === 'UI.ExtractTableData'
  );
}

function lookupKeys(activity: ActivityNode, result?: string, extra?: string): string[] {
  const keys = [activity.id, activity.displayName];
  if (result) {
    keys.push(result);
  }
  if (extra) {
    keys.push(extra, extra.slice(0, 80));
  }
  return keys.filter(Boolean);
}

function lookupFixtureString(
  map: Record<string, string> | undefined,
  activity: ActivityNode,
  result: string,
  selector: string
): string | undefined {
  if (!map) {
    return undefined;
  }
  for (const key of lookupKeys(activity, result, selector)) {
    if (key in map) {
      return map[key];
    }
  }
  for (const [key, value] of Object.entries(map)) {
    if (selector && selector.includes(key)) {
      return value;
    }
  }
  return undefined;
}

function lookupFixtureBool(
  map: Record<string, boolean> | undefined,
  activity: ActivityNode,
  result: string,
  selector: string
): boolean | undefined {
  if (!map) {
    return undefined;
  }
  for (const key of lookupKeys(activity, result, selector)) {
    if (key in map) {
      return map[key];
    }
  }
  return undefined;
}

function lookupFixtureTable(
  map: Record<string, { columns: string[]; rows: unknown[][] }> | undefined,
  activity: ActivityNode,
  result: string
): { columns: string[]; rows: unknown[][] } | undefined {
  if (!map) {
    return undefined;
  }
  for (const key of lookupKeys(activity, result)) {
    if (key in map) {
      return map[key];
    }
  }
  return undefined;
}

function lookupFixtureHttp(
  map: Record<string, { status?: number; body?: unknown }> | undefined,
  activity: ActivityNode,
  result: string,
  url: string
): { status: number; body: unknown } | undefined {
  if (!map) {
    return undefined;
  }
  for (const key of lookupKeys(activity, result, url)) {
    if (key in map) {
      const hit = map[key];
      return { status: hit.status ?? 200, body: hit.body ?? null };
    }
  }
  for (const [key, value] of Object.entries(map)) {
    if (url && url.includes(key)) {
      return { status: value.status ?? 200, body: value.body ?? null };
    }
  }
  return undefined;
}
