import {
  ActivityNode,
  WorkflowDocument,
  WorkflowVariable
} from '../models/workflow';
import { getActivityDefinition } from '../models/activities';

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
  status: 'ok' | 'skipped' | 'error';
}

export interface DryRunResult {
  ok: boolean;
  steps: DryRunStep[];
  variables: Record<string, unknown>;
  log: string[];
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

  return issues;
}

export function dryRunWorkflow(doc: WorkflowDocument): DryRunResult {
  const variables: Record<string, unknown> = {};
  for (const v of doc.variables) {
    variables[v.name] = v.defaultValue ?? defaultForType(v.type);
  }

  const steps: DryRunStep[] = [];
  const log: string[] = [`Starting dry-run for "${doc.name}" (${doc.type})`];
  let index = 1;
  let ok = true;

  const runList = (list: ActivityNode[], depth = 0) => {
    for (const activity of list) {
      const indent = '  '.repeat(depth);
      const summary = summarize(activity, variables);
      const step: DryRunStep = {
        index: index++,
        activityId: activity.id,
        displayName: activity.displayName,
        type: activity.type,
        action: summary,
        status: 'ok'
      };

      try {
        executeStub(activity, variables, log, indent);
        steps.push(step);

        if (activity.children?.length) {
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
          } else if (activity.type === 'ControlFlow.While') {
            log.push(`${indent}While simulated for 1 iteration`);
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
        }
      } catch (err) {
        ok = false;
        step.status = 'error';
        step.action = err instanceof Error ? err.message : String(err);
        steps.push(step);
        log.push(`${indent}ERROR: ${step.action}`);
      }
    }
  };

  runList(doc.activities);
  log.push(ok ? 'Dry-run completed successfully.' : 'Dry-run completed with errors.');
  return { ok, steps, variables, log };
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
    case 'UI.TypeInto':
      return `Type ${activity.properties.text}`;
    case 'Messaging.HttpRequest':
      return `${activity.properties.method} ${activity.properties.url}`;
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
  indent: string
) {
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
    case 'Programming.Assign': {
      const to = String(activity.properties.to);
      const value = resolveExpression(String(activity.properties.value ?? ''), variables);
      variables[to] = value;
      log.push(`${indent}Assign ${to} = ${JSON.stringify(value)}`);
      break;
    }
    case 'UI.OpenApplication':
      log.push(`${indent}OpenApplication ${activity.properties.pathOrUrl}`);
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
      variables[result] = 'Sample extracted text';
      log.push(`${indent}GetText -> ${result}`);
      break;
    }
    case 'UI.ElementExists': {
      const result = String(activity.properties.result || 'exists');
      variables[result] = true;
      log.push(`${indent}ElementExists -> ${result}=true`);
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
      variables[result] = { status: 200, body: { ok: true } };
      log.push(
        `${indent}HTTP ${activity.properties.method} ${activity.properties.url} -> ${result}`
      );
      break;
    }
    default:
      log.push(`${indent}${activity.displayName}`);
  }
}

function resolveExpression(expr: string, variables: Record<string, unknown>): unknown {
  const trimmed = expr.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
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
  const value = resolveExpression(condition, variables);
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const text = String(value).trim().toLowerCase();
  if (text === 'false' || text === '0' || text === '') {
    return false;
  }
  return true;
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
