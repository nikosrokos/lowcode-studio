import { getActivityCatalog, getActivityDefinition } from '../models/activities';
import { ActivityNode, WorkflowDocument, newId } from '../models/workflow';

export interface ScaffoldProposal {
  activities: ActivityNode[];
  summary: string[];
  unmatched: string[];
}

interface Rule {
  test: RegExp;
  type: string;
  displayName?: string;
  props?: Record<string, unknown>;
  once?: boolean;
}

const RULES: Rule[] = [
  { test: /\b(log message|log\b|write line)\b/i, type: 'System.LogMessage', props: { level: 'Info', message: '"Hello from Assist scaffold"' } },
  { test: /\b(message box|msgbox)\b/i, type: 'System.MessageBox', props: { text: '"Hello"' } },
  { test: /\b(assign|set variable)\b/i, type: 'Programming.Assign', props: { to: 'result', value: '""' } },
  { test: /\b(multiple assign)\b/i, type: 'Programming.MultipleAssign', props: { assignments: 'a = 1\nb = 2' } },
  { test: /\b(if |condition|branch)\b/i, type: 'ControlFlow.If', props: { condition: 'True' } },
  { test: /\b(while|loop until)\b/i, type: 'ControlFlow.While', props: { condition: 'True' } },
  { test: /\b(for each row|foreach row)\b/i, type: 'Data.ForEachRow', props: { dataTable: 'dt', row: 'row' } },
  { test: /\b(for each|foreach)\b/i, type: 'ControlFlow.ForEach', props: { values: 'items', item: 'item' } },
  { test: /\b(try catch|try\/catch)\b/i, type: 'ControlFlow.TryCatch' },
  { test: /\b(delay|wait seconds|sleep)\b/i, type: 'System.Delay', props: { duration: '00:00:02' } },
  { test: /\b(use browser|open browser|navigate)\b/i, type: 'UI.UseApplicationBrowser', props: { mode: 'Browser', urlOrPath: 'https://example.com', browserType: 'Chrome' } },
  { test: /\b(open application|use application)\b/i, type: 'UI.UseApplicationBrowser', props: { mode: 'Application', urlOrPath: 'notepad.exe' } },
  { test: /\b(click)\b/i, type: 'UI.Click', props: { selector: '' } },
  { test: /\b(type into|type text|enter text)\b/i, type: 'UI.TypeInto', props: { selector: '', text: '""' } },
  { test: /\b(get text)\b/i, type: 'UI.GetText', props: { selector: '', result: 'textValue' } },
  { test: /\b(element exists|check element)\b/i, type: 'UI.ElementExists', props: { selector: '', result: 'exists' } },
  { test: /\b(http|rest|api request|webhook)\b/i, type: 'Messaging.HttpRequest', props: { method: 'GET', url: '"https://api.example.com"', result: 'httpResult' } },
  { test: /\b(send email|email)\b/i, type: 'Messaging.SendEmail', props: { to: 'user@example.com', subject: '"Hello"', body: '"Body"' } },
  { test: /\b(read csv)\b/i, type: 'Data.ReadCsv', props: { filePath: 'Data/input.csv', dataTable: 'dt' } },
  { test: /\b(write csv)\b/i, type: 'Data.WriteCsv', props: { filePath: 'Data/output.csv', dataTable: 'dt' } },
  { test: /\b(build data table|new data table)\b/i, type: 'Data.BuildDataTable', props: { dataTable: 'dt' } },
  { test: /\b(excel|workbook)\b/i, type: 'Excel.ExcelApplicationScope', props: { workbookPath: 'Data/Workbook.xlsx' } },
  { test: /\b(get queue|queue item|transaction item)\b/i, type: 'Orchestrator.GetTransactionItem', props: { queueName: 'MainQueue', result: 'TransactionItem' } },
  { test: /\b(get asset)\b/i, type: 'Orchestrator.GetAsset', props: { assetName: 'ConfigAsset', result: 'assetValue' } },
  { test: /\b(invoke workflow|call workflow)\b/i, type: 'REFramework.InvokeWorkflow', props: { workflowPath: 'Framework/Process.lcs.json' } },
  { test: /\b(comment|note)\b/i, type: 'System.Comment', props: { text: 'Assist scaffold note' } }
];

function createFromType(type: string, displayName?: string, props?: Record<string, unknown>): ActivityNode | undefined {
  const def = getActivityDefinition(type) || getActivityCatalog().find((a) => a.type === type);
  if (!def) {
    return undefined;
  }
  const properties: Record<string, unknown> = {};
  for (const p of def.properties || []) {
    properties[p.name] = p.defaultValue ?? '';
  }
  Object.assign(properties, props || {});
  const node: ActivityNode = {
    id: newId(),
    type: def.type,
    displayName: displayName || def.displayName,
    properties
  };
  if (def.container) {
    node.children = [];
  }
  if (def.hasElse) {
    node.elseChildren = [];
  }
  return node;
}

/**
 * F2 Assist — scaffold a sequence from natural language (catalog-constrained, no LLM).
 * Splits on newlines / "then" / ";" and matches keyword rules to activity types.
 */
export function scaffoldSequenceFromDescription(description: string): ScaffoldProposal {
  const text = String(description || '').trim();
  const chunks = text
    ? text
        .split(/\n+|;|\bthen\b|\band then\b/i)
        .map((s) => s.trim())
        .filter(Boolean)
    : ['log message hello'];

  const activities: ActivityNode[] = [];
  const summary: string[] = [];
  const unmatched: string[] = [];
  const usedOnce = new Set<string>();

  for (const chunk of chunks) {
    let matched = false;
    for (const rule of RULES) {
      if (rule.once && usedOnce.has(rule.type)) {
        continue;
      }
      if (!rule.test.test(chunk)) {
        continue;
      }
      const node = createFromType(rule.type, rule.displayName, rule.props);
      if (!node) {
        continue;
      }
      // Prefer LogMessage message from quoted text in chunk
      if (node.type === 'System.LogMessage') {
        const q = chunk.match(/["“]([^"”]+)["”]/);
        if (q) {
          node.properties.message = `"${q[1].replace(/"/g, '""')}"`;
        }
      }
      if (node.type === 'Messaging.HttpRequest') {
        const url = chunk.match(/https?:\/\/\S+/i);
        if (url) {
          node.properties.url = `"${url[0]}"`;
        }
      }
      activities.push(node);
      summary.push(`${node.displayName} ← “${chunk.slice(0, 60)}”`);
      if (rule.once) {
        usedOnce.add(rule.type);
      }
      matched = true;
      break;
    }
    if (!matched) {
      unmatched.push(chunk);
    }
  }

  if (!activities.length) {
    const fallback = createFromType('System.LogMessage', 'Log Message', {
      level: 'Info',
      message: `"${text.slice(0, 80).replace(/"/g, '""') || 'Assist scaffold'}"`
    });
    if (fallback) {
      activities.push(fallback);
      summary.push('Fallback Log Message (no keyword match)');
    }
  }

  return { activities, summary, unmatched };
}

/** Append scaffolded activities to a workflow (returns a copy). */
export function applyScaffoldToWorkflow(
  doc: WorkflowDocument,
  proposal: ScaffoldProposal,
  mode: 'append' | 'replace' = 'append'
): WorkflowDocument {
  const next: WorkflowDocument = JSON.parse(JSON.stringify(doc)) as WorkflowDocument;
  if (mode === 'replace') {
    next.activities = proposal.activities;
  } else {
    next.activities = [...(next.activities || []), ...proposal.activities];
  }
  next.metadata = {
    ...(next.metadata || {}),
    updatedAt: new Date().toISOString()
  };
  return next;
}

export function formatScaffoldReport(proposal: ScaffoldProposal): string {
  const lines = [
    'Assist F2 — Scaffold from description',
    '─'.repeat(48),
    `Activities: ${proposal.activities.length}`,
    ...proposal.summary.map((s) => `  · ${s}`),
    ''
  ];
  if (proposal.unmatched.length) {
    lines.push('Unmatched phrases (skipped):');
    for (const u of proposal.unmatched) {
      lines.push(`  · ${u}`);
    }
    lines.push('');
  }
  lines.push('Types:', ...proposal.activities.map((a) => `  · ${a.type}`));
  return lines.join('\n');
}
