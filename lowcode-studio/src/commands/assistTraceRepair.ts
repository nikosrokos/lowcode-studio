import { DryRunResult, DryRunStep } from './simulator';
import { getActivityDefinition } from '../models/activities';
import { ActivityNode, WorkflowDocument } from '../models/workflow';
import { isPlaceholderSelector } from '../interop/windowsTarget';

export interface TraceRepair {
  activityId: string;
  displayName: string;
  type: string;
  property?: string;
  reason: string;
  before?: string;
  after?: string;
  kind: 'fill-default' | 'selector-placeholder' | 'imported-comment' | 'log-message';
}

function walk(list: ActivityNode[], fn: (n: ActivityNode) => void): void {
  for (const n of list || []) {
    fn(n);
    if (n.children) {
      walk(n.children, fn);
    }
    if (n.elseChildren) {
      walk(n.elseChildren, fn);
    }
  }
}

function findNode(doc: WorkflowDocument, id: string): ActivityNode | undefined {
  let hit: ActivityNode | undefined;
  walk(doc.activities || [], (n) => {
    if (n.id === id) {
      hit = n;
    }
  });
  return hit;
}

/**
 * F2 Assist — propose repairs from a failed / warning dry-run trace.
 * Deterministic: empty required props → catalog defaults; empty selectors →
 * annotated placeholder; Imported.* → System.Comment keeping hint text.
 */
export function proposeRepairsFromDryRunTrace(
  doc: WorkflowDocument,
  result: DryRunResult
): TraceRepair[] {
  const repairs: TraceRepair[] = [];
  const problemSteps = (result.steps || []).filter(
    (s) => s.status === 'error' || s.status === 'warn'
  );
  const seen = new Set<string>();

  const consider = (step: DryRunStep) => {
    const node = findNode(doc, step.activityId);
    if (!node || seen.has(node.id)) {
      return;
    }
    seen.add(node.id);
    const def = getActivityDefinition(node.type);

    if (String(node.type || '').startsWith('Imported.')) {
      const hint = String(node.properties?.hint || node.properties?.originalType || node.type);
      repairs.push({
        activityId: node.id,
        displayName: node.displayName,
        type: node.type,
        reason: `Dry-run ${step.status}: imported placeholder — replace with Comment for Mac dry-run`,
        before: node.type,
        after: 'System.Comment',
        kind: 'imported-comment'
      });
      void hint;
      return;
    }

    if (def) {
      for (const p of def.properties || []) {
        if (!p.required) {
          continue;
        }
        const cur = node.properties?.[p.name];
        if (cur !== undefined && cur !== null && String(cur).trim() !== '') {
          continue;
        }
        const next = p.defaultValue ?? (p.type === 'boolean' ? false : '');
        repairs.push({
          activityId: node.id,
          displayName: node.displayName,
          type: node.type,
          property: p.name,
          reason: `Dry-run ${step.status}: required “${p.label}” empty — fill catalog default`,
          before: String(cur ?? ''),
          after: String(next ?? ''),
          kind: 'fill-default'
        });
      }
    }

    if (String(node.type || '').startsWith('UI.') && 'selector' in (node.properties || {})) {
      const sel = String(node.properties?.selector || '');
      if (!sel.trim() || isPlaceholderSelector(sel)) {
        const placeholder =
          "<html app='chrome.exe' title='*' />\n<webctrl tag='*' aaname='TODO' />";
        repairs.push({
          activityId: node.id,
          displayName: node.displayName,
          type: node.type,
          property: 'selector',
          reason: `Dry-run ${step.status}: missing/weak selector — set TODO placeholder for Studio Web`,
          before: sel,
          after: placeholder,
          kind: 'selector-placeholder'
        });
      }
    }

    if (node.type === 'System.LogMessage') {
      const msg = String(node.properties?.message || '').trim();
      if (!msg) {
        repairs.push({
          activityId: node.id,
          displayName: node.displayName,
          type: node.type,
          property: 'message',
          reason: `Dry-run ${step.status}: empty log message`,
          before: msg,
          after: '"Dry-run step"',
          kind: 'log-message'
        });
      }
    }
  };

  for (const step of problemSteps) {
    consider(step);
  }

  // Also scan warnings text for activity ids mentioned
  for (const w of result.warnings || []) {
    const m = w.match(/act_[a-z0-9_]+/i);
    if (m) {
      const fake: DryRunStep = {
        index: -1,
        activityId: m[0],
        displayName: m[0],
        type: '',
        action: w,
        status: 'warn'
      };
      consider(fake);
    }
  }

  return repairs;
}

export function applyTraceRepairs(
  doc: WorkflowDocument,
  repairs: TraceRepair[]
): WorkflowDocument {
  const next: WorkflowDocument = JSON.parse(JSON.stringify(doc)) as WorkflowDocument;
  const byId = new Map<string, TraceRepair[]>();
  for (const r of repairs) {
    const list = byId.get(r.activityId) || [];
    list.push(r);
    byId.set(r.activityId, list);
  }
  walk(next.activities || [], (node) => {
    const list = byId.get(node.id);
    if (!list) {
      return;
    }
    for (const r of list) {
      if (r.kind === 'imported-comment') {
        const text = String(
          node.properties?.hint ||
            node.properties?.originalType ||
            node.displayName ||
            'Imported activity'
        );
        node.type = 'System.Comment';
        node.displayName = node.displayName.includes('(imported)')
          ? node.displayName
          : `${node.displayName} (imported)`;
        node.properties = { text };
        delete node.children;
        delete node.elseChildren;
        continue;
      }
      if (r.property) {
        node.properties = node.properties || {};
        if (r.kind === 'fill-default') {
          const def = getActivityDefinition(node.type);
          const p = def?.properties?.find((x) => x.name === r.property);
          let value: unknown = r.after;
          if (p?.type === 'number') {
            value = Number(r.after || 0);
          }
          if (p?.type === 'boolean') {
            value = String(r.after) === 'true';
          }
          node.properties[r.property] = value;
        } else {
          node.properties[r.property] = r.after;
        }
      }
    }
  });
  next.metadata = {
    ...(next.metadata || {}),
    updatedAt: new Date().toISOString()
  };
  return next;
}

export function formatTraceRepairReport(repairs: TraceRepair[], result: DryRunResult): string {
  const lines = [
    'Assist F2 — Repair from dry-run trace',
    '─'.repeat(48),
    `Dry-run ok: ${result.ok} · steps: ${result.steps.length} · warnings: ${result.warnings.length}`,
    `Repairs proposed: ${repairs.length}`,
    ''
  ];
  if (!repairs.length) {
    lines.push('No automatic repairs from this trace.');
    return lines.join('\n');
  }
  for (const r of repairs) {
    lines.push(`· ${r.displayName} (${r.type})`);
    lines.push(`  ${r.reason}`);
    if (r.property) {
      lines.push(`  ${r.property}: ${oneLine(r.before)} → ${oneLine(r.after)}`);
    }
  }
  return lines.join('\n');
}

function oneLine(s: unknown): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}
