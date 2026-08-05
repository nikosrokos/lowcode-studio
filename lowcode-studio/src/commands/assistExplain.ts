import { WorkflowDocument, ActivityNode } from '../models/workflow';
import { getActivityDefinition } from '../models/activities';
import { validateWorkflow } from './simulator';
import {
  PackageWarning,
  validateWorkflowPackages
} from '../interop/packageValidation';
import { scoreSelector } from '../interop/selectorBuilder';
import { isPlaceholderSelector } from '../interop/windowsTarget';

export interface ExplainWorkflowReport {
  title: string;
  markdown: string;
  critiqueCount: number;
}

/**
 * Deterministic F0 Assist: explain + critique a workflow for Studio Web readiness.
 * No LLM — uses validation, package warnings, and selector scores.
 */
export function explainWorkflow(
  doc: WorkflowDocument,
  options: { workflowRel?: string; projectDir?: string } = {}
): ExplainWorkflowReport {
  const issues = validateWorkflow(doc);
  const packageWarnings = options.projectDir
    ? validateWorkflowPackages(doc, options.workflowRel, options.projectDir)
    : validateWorkflowPackages(doc, options.workflowRel);

  const counts = countByCategory(doc.activities);
  const imported = collectByPrefix(doc.activities, 'Imported.');
  const invokes = collectByType(doc.activities, 'REFramework.InvokeWorkflow');
  const uiActs = collectUi(doc.activities);

  const critique: string[] = [];
  for (const issue of issues) {
    critique.push(`- **${issue.severity}**: ${issue.message}`);
  }
  for (const w of packageWarnings) {
    if (w.severity === 'warning' || w.code.startsWith('ui-') || w.code === 'imported-placeholder') {
      critique.push(`- **${w.code}**: ${w.message}`);
    }
  }
  for (const a of uiActs) {
    const q = scoreSelector(String(a.properties?.selector || ''));
    if (q.cardMessage) {
      critique.push(`- **selector** (${a.displayName}): ${q.cardMessage}`);
    } else if (isPlaceholderSelector(String(a.properties?.selector || ''))) {
      critique.push(`- **selector** (${a.displayName}): starter / placeholder`);
    }
  }

  const uniqueCritique = [...new Set(critique)];
  const lines: string[] = [
    `# Explain — ${doc.name || 'Untitled'}`,
    '',
    `Type: **${doc.type || 'Sequence'}** · Activities: **${countActivities(doc.activities)}** · Variables: **${(doc.variables || []).length}** · Arguments: **${(doc.arguments || []).length}**`,
    '',
    '## Structure',
    ''
  ];
  for (const [cat, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${cat}: ${n}`);
  }
  if (invokes.length) {
    lines.push('', '### Invoke Workflow targets', '');
    for (const inv of invokes) {
      lines.push(`- ${inv.displayName}: \`${inv.properties?.workflowPath || '(missing)'}\``);
    }
  }
  if (imported.length) {
    lines.push('', '### Imported placeholders', '');
    for (const a of imported.slice(0, 20)) {
      lines.push(`- \`${a.type}\` — ${a.displayName}`);
    }
    if (imported.length > 20) {
      lines.push(`- … +${imported.length - 20} more`);
    }
  }

  lines.push('', '## Critique (Studio Web / Windows readiness)', '');
  if (!uniqueCritique.length) {
    lines.push('No blocking issues detected by local checks. Still verify selectors on Windows.');
  } else {
    lines.push(...uniqueCritique);
  }

  lines.push('', '## Why Studio Web may reject or degrade this Save', '');
  const studioReasons = studioWebRejectReasons(imported, packageWarnings, uiActs);
  if (!studioReasons.length) {
    lines.push('- No automatic reject signals from LCS checks.');
  } else {
    lines.push(...studioReasons.map((r) => `- ${r}`));
  }

  lines.push(
    '',
    '---',
    '_Assist F0 — deterministic report (no LLM). Use Validate Packages / Windows TODO for project-wide checks._'
  );

  return {
    title: `Explain — ${doc.name}`,
    markdown: lines.join('\n'),
    critiqueCount: uniqueCritique.length
  };
}

function studioWebRejectReasons(
  imported: ActivityNode[],
  warnings: PackageWarning[],
  uiActs: ActivityNode[]
): string[] {
  const reasons: string[] = [];
  if (imported.length) {
    reasons.push(
      `${imported.length} Imported.* activit(ies) export as Comment placeholders — map them to LCS types before relying on Studio Web.`
    );
  }
  if (warnings.some((w) => w.code === 'default-package-version')) {
    reasons.push('One or more NuGet pins are still [1.0.0] — Studio Web restore may fail (Manage Packages).');
  }
  if (warnings.some((w) => w.code === 'invoke-missing-file' || w.code === 'invoke-missing-path')) {
    reasons.push('Broken Invoke Workflow path(s) — Studio Web cannot open missing workflows.');
  }
  const weakUi = uiActs.filter((a) => {
    const sel = String(a.properties?.selector || '');
    return !sel || isPlaceholderSelector(sel) || scoreSelector(sel).level === 'weak';
  });
  if (weakUi.length) {
    reasons.push(
      `${weakUi.length} UI step(s) have missing/weak selectors — robots will fail until captured on Windows.`
    );
  }
  return reasons;
}

function countActivities(list: ActivityNode[]): number {
  let n = 0;
  const walk = (items: ActivityNode[]) => {
    for (const a of items) {
      n += 1;
      if (a.children) walk(a.children);
      if (a.elseChildren) walk(a.elseChildren);
    }
  };
  walk(list);
  return n;
}

function countByCategory(list: ActivityNode[]): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (items: ActivityNode[]) => {
    for (const a of items) {
      const def = getActivityDefinition(a.type);
      const cat = def?.category || (a.type.startsWith('Imported.') ? 'Imported' : 'Other');
      out[cat] = (out[cat] || 0) + 1;
      if (a.children) walk(a.children);
      if (a.elseChildren) walk(a.elseChildren);
    }
  };
  walk(list);
  return out;
}

function collectByPrefix(list: ActivityNode[], prefix: string): ActivityNode[] {
  const out: ActivityNode[] = [];
  const walk = (items: ActivityNode[]) => {
    for (const a of items) {
      if (a.type.startsWith(prefix)) out.push(a);
      if (a.children) walk(a.children);
      if (a.elseChildren) walk(a.elseChildren);
    }
  };
  walk(list);
  return out;
}

function collectByType(list: ActivityNode[], type: string): ActivityNode[] {
  const out: ActivityNode[] = [];
  const walk = (items: ActivityNode[]) => {
    for (const a of items) {
      if (a.type === type) out.push(a);
      if (a.children) walk(a.children);
      if (a.elseChildren) walk(a.elseChildren);
    }
  };
  walk(list);
  return out;
}

function collectUi(list: ActivityNode[]): ActivityNode[] {
  const out: ActivityNode[] = [];
  const walk = (items: ActivityNode[]) => {
    for (const a of items) {
      if (
        a.type.startsWith('UI.') &&
        a.type !== 'UI.OpenApplication' &&
        a.type !== 'UI.TakeScreenshot'
      ) {
        out.push(a);
      }
      if (a.children) walk(a.children);
      if (a.elseChildren) walk(a.elseChildren);
    }
  };
  walk(list);
  return out;
}
