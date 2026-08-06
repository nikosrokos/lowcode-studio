import * as fs from 'fs';
import * as path from 'path';
import { parseWorkflow, stringifyWorkflow, WorkflowDocument } from '../models/workflow';
import {
  ExpressionRepairProposal,
  applyExpressionRepairs,
  proposeExpressionRepairs
} from '../commands/assistExpressions';
import {
  SelectorRepairProposal,
  applySelectorRepairs,
  proposeSelectorRepairs
} from '../commands/assistSelectors';
import { listLcsWorkflows } from './packageValidation';

export interface ProjectAssistWorkflowHit {
  workflowRel: string;
  expressions: ExpressionRepairProposal[];
  selectors: SelectorRepairProposal[];
}

export interface ProjectAssistScan {
  projectDir: string;
  projectName: string;
  workflows: ProjectAssistWorkflowHit[];
  expressionCount: number;
  selectorCount: number;
  actionableSelectorCount: number;
  total: number;
}

export interface ProjectAssistApplyResult {
  appliedFiles: string[];
  expressionApplied: number;
  selectorApplied: number;
  errors: string[];
}

/**
 * Theme 1 / T1c — Bulk Assist across the open project (F3 selectors + F4 VB).
 * Propose-don't-mute: callers must confirm before applyProjectAssistScan.
 */
export function scanProjectAssist(projectDir: string): ProjectAssistScan {
  const manifestPath = path.join(projectDir, 'project.json');
  let projectName = path.basename(projectDir);
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { name?: string };
    if (manifest.name) {
      projectName = manifest.name;
    }
  } catch {
    // ignore
  }

  const workflows: ProjectAssistWorkflowHit[] = [];
  for (const rel of listLcsWorkflows(projectDir)) {
    const abs = path.join(projectDir, rel);
    try {
      const doc = parseWorkflow(fs.readFileSync(abs, 'utf8'));
      const expressions = proposeExpressionRepairs(doc);
      const selectors = proposeSelectorRepairs(doc);
      if (expressions.length || selectors.length) {
        workflows.push({ workflowRel: rel, expressions, selectors });
      }
    } catch {
      // skip unreadable
    }
  }

  const expressionCount = workflows.reduce((n, w) => n + w.expressions.length, 0);
  const selectorCount = workflows.reduce((n, w) => n + w.selectors.length, 0);
  const actionableSelectorCount = workflows.reduce(
    (n, w) => n + w.selectors.filter((s) => s.actionable).length,
    0
  );

  return {
    projectDir,
    projectName,
    workflows,
    expressionCount,
    selectorCount,
    actionableSelectorCount,
    total: expressionCount + selectorCount
  };
}

export function formatProjectAssistReport(scan: ProjectAssistScan): string {
  const lines: string[] = [
    `Project Assist — ${scan.projectName}`,
    '─'.repeat(48),
    `Workflows with hits: ${scan.workflows.length}`,
    `VB expression repairs (F4): ${scan.expressionCount}`,
    `Selector proposals (F3): ${scan.selectorCount} (${scan.actionableSelectorCount} actionable)`,
    ''
  ];
  if (!scan.workflows.length) {
    lines.push('No Assist hits across the project.');
    return lines.join('\n');
  }
  for (const hit of scan.workflows) {
    lines.push(`## ${hit.workflowRel}`);
    for (const e of hit.expressions) {
      lines.push(
        `  [VB] ${e.displayName} · ${e.propertyLabel}: ${oneLine(e.original)} → ${oneLine(e.proposed)}`
      );
    }
    for (const s of hit.selectors) {
      const flag = s.actionable ? 'actionable' : 'note';
      lines.push(
        `  [Sel/${flag}] ${s.displayName}: ${oneLine(s.current) || '(empty)'} → ${oneLine(s.proposed)}`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Apply safe repairs: all VB expression rewrites + actionable selector repairs.
 * Writes workflows back to disk. Returns which files changed.
 */
export function applyProjectAssistScan(
  scan: ProjectAssistScan,
  options: { expressions?: boolean; selectors?: boolean } = {}
): ProjectAssistApplyResult {
  const doExpr = options.expressions !== false;
  const doSel = options.selectors !== false;
  const appliedFiles: string[] = [];
  const errors: string[] = [];
  let expressionApplied = 0;
  let selectorApplied = 0;

  for (const hit of scan.workflows) {
    const abs = path.join(scan.projectDir, hit.workflowRel);
    try {
      let doc: WorkflowDocument = parseWorkflow(fs.readFileSync(abs, 'utf8'));
      const before = stringifyWorkflow(doc);
      if (doExpr && hit.expressions.length) {
        doc = applyExpressionRepairs(doc, hit.expressions);
        expressionApplied += hit.expressions.length;
      }
      if (doSel) {
        const actionable = hit.selectors.filter((s) => s.actionable);
        if (actionable.length) {
          doc = applySelectorRepairs(doc, actionable);
          selectorApplied += actionable.length;
        }
      }
      const after = stringifyWorkflow(doc);
      if (after !== before) {
        fs.writeFileSync(abs, after, 'utf8');
        appliedFiles.push(hit.workflowRel);
      }
    } catch (err) {
      errors.push(
        `${hit.workflowRel}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { appliedFiles, expressionApplied, selectorApplied, errors };
}

function oneLine(s: string): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
