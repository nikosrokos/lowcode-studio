import { ActivityNode, WorkflowDocument } from '../models/workflow';
import {
  SelectorParts,
  SelectorQuality,
  SELECTOR_TEMPLATES,
  applyTemplate,
  buildWindowsSelector,
  scoreSelector,
  tryDecodeSelectorPaste
} from '../interop/selectorBuilder';
import { isPlaceholderSelector } from '../interop/windowsTarget';

export interface SelectorSuggestion {
  selector: string;
  quality: SelectorQuality;
  source: 'html' | 'decode' | 'template';
  rationale: string;
}

export interface SelectorRepairProposal {
  activityId: string;
  displayName: string;
  type: string;
  current: string;
  currentQuality: SelectorQuality;
  proposed: string;
  proposedQuality: SelectorQuality;
  rationale: string;
  /** True when proposed is different and scores better (or fills empty). */
  actionable: boolean;
}

/**
 * F3 Assist — suggest classic Windows selectors from an HTML snippet,
 * and propose repairs for empty / placeholder / weak UI selectors.
 * Propose-don't-mute: never writes the workflow unless the caller applies.
 */
export function suggestSelectorsFromHtml(
  htmlOrPaste: string,
  options: { app?: string; title?: string } = {}
): SelectorSuggestion[] {
  const text = String(htmlOrPaste || '').trim();
  const out: SelectorSuggestion[] = [];
  if (!text) {
    return out;
  }

  const decoded = tryDecodeSelectorPaste(text);
  if (decoded) {
    const quality = scoreSelector(decoded);
    out.push({
      selector: decoded,
      quality,
      source: 'decode',
      rationale: 'Decoded classic / #id / Explorer paste'
    });
  }

  const fromHtml = parseHtmlElementToParts(text);
  if (fromHtml) {
    const parts: SelectorParts = {
      ...fromHtml,
      app: options.app || fromHtml.app || 'chrome.exe',
      title: options.title || fromHtml.title || '*'
    };
    const selector = buildWindowsSelector(parts);
    if (!out.some((s) => s.selector === selector)) {
      out.push({
        selector,
        quality: scoreSelector(selector),
        source: 'html',
        rationale: describeHtmlParts(parts)
      });
    }
  }

  // Fallbacks when snippet is too sparse
  if (!out.length) {
    const tagGuess = guessTagFromText(text);
    if (tagGuess) {
      const tplId =
        tagGuess === 'INPUT' || tagGuess === 'TEXTAREA'
          ? 'chrome-input'
          : tagGuess === 'SELECT'
            ? 'chrome-select'
            : tagGuess === 'TABLE'
              ? 'chrome-table'
              : tagGuess === 'A'
                ? 'edge-link'
                : 'chrome-button';
      const selector = applyTemplate(tplId);
      out.push({
        selector,
        quality: scoreSelector(selector),
        source: 'template',
        rationale: `No id/name found — starter template for <${tagGuess.toLowerCase()}> (fill Id / aaname)`
      });
    }
  }

  return out.sort((a, b) => b.quality.score - a.quality.score);
}

export function proposeSelectorRepairs(doc: WorkflowDocument): SelectorRepairProposal[] {
  const uiActs = collectUiWithSelectors(doc.activities);
  const strongSiblings = uiActs.filter((a) => {
    const q = scoreSelector(String(a.properties?.selector || ''));
    return q.level === 'ok' || q.level === 'strong';
  });

  const proposals: SelectorRepairProposal[] = [];
  for (const activity of uiActs) {
    const current = String(activity.properties?.selector || '').trim();
    const currentQuality = scoreSelector(current);
    if (
      currentQuality.level !== 'empty' &&
      currentQuality.level !== 'placeholder' &&
      currentQuality.level !== 'weak'
    ) {
      continue;
    }

    let proposed = '';
    let rationale = '';

    const decoded = current ? tryDecodeSelectorPaste(current) : null;
    if (decoded && decoded !== current && scoreSelector(decoded).score > currentQuality.score) {
      proposed = decoded;
      rationale = 'Decode paste into classic <html>/<webctrl>';
    } else {
      const tpl = templateForActivity(activity.type);
      const fromTpl = applyTemplate(tpl);
      const sibling = strongSiblings.find(
        (s) => s.id !== activity.id && similarUiFamily(s.type, activity.type)
      );
      if (sibling && (currentQuality.level === 'empty' || isPlaceholderSelector(current))) {
        proposed = String(sibling.properties.selector || '');
        rationale = `Copy selector from sibling “${sibling.displayName}” (same family) — verify target`;
      } else {
        proposed = fromTpl;
        const tplLabel = SELECTOR_TEMPLATES.find((t) => t.id === tpl)?.label || tpl;
        rationale = `Suggest template “${tplLabel}” — replace demo Id / aaname with real values`;
      }
    }

    const proposedQuality = scoreSelector(proposed);
    const actionable =
      Boolean(proposed) &&
      proposed !== current &&
      (currentQuality.level === 'empty' ||
        proposedQuality.score > currentQuality.score ||
        (isPlaceholderSelector(current) && !isPlaceholderSelector(proposed)));

    proposals.push({
      activityId: activity.id,
      displayName: activity.displayName,
      type: activity.type,
      current,
      currentQuality,
      proposed,
      proposedQuality,
      rationale,
      actionable
    });
  }
  return proposals;
}

export function applySelectorRepairs(
  doc: WorkflowDocument,
  proposals: SelectorRepairProposal[]
): WorkflowDocument {
  const byId = new Map(
    proposals.filter((p) => p.actionable).map((p) => [p.activityId, p.proposed] as const)
  );
  if (!byId.size) {
    return doc;
  }
  const clone: WorkflowDocument = JSON.parse(JSON.stringify(doc)) as WorkflowDocument;
  const walk = (list: ActivityNode[]) => {
    for (const a of list) {
      const next = byId.get(a.id);
      if (next !== undefined) {
        a.properties = { ...(a.properties || {}), selector: next };
      }
      if (a.children) walk(a.children);
      if (a.elseChildren) walk(a.elseChildren);
    }
  };
  walk(clone.activities);
  return clone;
}

export function formatSelectorAssistReport(
  title: string,
  suggestions: SelectorSuggestion[],
  repairs: SelectorRepairProposal[]
): string {
  const lines: string[] = [`# ${title}`, '', '_Assist F3 — deterministic selector assist (no LLM)._', ''];

  if (suggestions.length) {
    lines.push('## Suggestions from paste / HTML', '');
    suggestions.forEach((s, i) => {
      lines.push(
        `### ${i + 1}. ${s.source} · ${s.quality.label} (score ${s.quality.score})`,
        s.rationale,
        '```',
        s.selector,
        '```',
        ''
      );
    });
  }

  if (repairs.length) {
    const actionable = repairs.filter((r) => r.actionable);
    lines.push(
      '## Workflow repair proposals',
      '',
      `${actionable.length}/${repairs.length} actionable (empty / placeholder / weak).`,
      ''
    );
    for (const r of repairs) {
      lines.push(
        `### ${r.displayName} (\`${r.type}\`)`,
        `- Current: ${r.currentQuality.label}${r.current ? ` — \`${oneLine(r.current)}\`` : ' — *(empty)*'}`,
        `- Proposed (${r.proposedQuality.label}): \`${oneLine(r.proposed)}\``,
        `- ${r.rationale}`,
        r.actionable ? '- **Actionable** — can apply with confirmation' : '- Not applied automatically',
        ''
      );
    }
  }

  if (!suggestions.length && !repairs.length) {
    lines.push('No selector suggestions or repairs for this input.');
  }

  lines.push(
    '---',
    'Paste proposals into Selector Builder, or use **Apply** when prompted. Always verify on Windows.'
  );
  return lines.join('\n');
}

function parseHtmlElementToParts(text: string): SelectorParts | undefined {
  // Prefer a concrete interactive tag
  const tagRe =
    /<(button|input|a|select|textarea|table|div|span|label|img)\b([^>]*)>(?:([^<]*)<\/\1>)?/i;
  const m = text.match(tagRe) || text.match(/<([a-z][\w-]*)\b([^>]*)\/?>/i);
  if (!m) {
    return undefined;
  }
  const tag = (m[1] || '*').toUpperCase();
  const attrBlob = m[2] || '';
  const inner = (m[3] || '').trim();
  const attrs = parseHtmlAttrs(attrBlob);

  const id = attrs.id || attrs['data-testid'] || attrs['data-id'] || '';
  const name = attrs.name || '';
  const aaname =
    attrs['aria-label'] ||
    attrs.title ||
    attrs.alt ||
    attrs.placeholder ||
    attrs.value ||
    (inner && inner.length < 80 ? inner.replace(/\s+/g, ' ') : '') ||
    '';
  const cls = (attrs.class || '').split(/\s+/).filter(Boolean)[0] || '';

  if (!id && !name && !aaname && !cls && (tag === '*' || tag === 'DIV' || tag === 'SPAN')) {
    return undefined;
  }

  return {
    kind: 'browser',
    app: 'chrome.exe',
    title: '*',
    tag: tag === 'DIV' || tag === 'SPAN' ? '*' : tag,
    id,
    aaname,
    name,
    cls,
    idx: ''
  };
}

function parseHtmlAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:@\w.-]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

function describeHtmlParts(parts: SelectorParts): string {
  const bits: string[] = [`tag=${parts.tag || '*'}`];
  if (parts.id) bits.push(`id=${parts.id}`);
  if (parts.name) bits.push(`name=${parts.name}`);
  if (parts.aaname) bits.push(`aaname=${parts.aaname}`);
  if (parts.cls) bits.push(`class=${parts.cls}`);
  return `Built from HTML attributes (${bits.join(', ')})`;
}

function guessTagFromText(text: string): string | undefined {
  const m = text.match(/\b(button|input|select|textarea|table|a|link)\b/i);
  if (!m) return undefined;
  const t = m[1].toLowerCase();
  if (t === 'link' || t === 'a') return 'A';
  return t.toUpperCase();
}

function templateForActivity(type: string): string {
  switch (type) {
    case 'UI.TypeInto':
      return 'chrome-input';
    case 'UI.ExtractTableData':
      return 'chrome-table';
    case 'UI.SelectItem':
      return 'chrome-select';
    case 'UI.Check':
      return 'chrome-button';
    case 'UI.OpenApplication':
      return 'wnd-generic';
    default:
      return 'chrome-button';
  }
}

function similarUiFamily(a: string, b: string): boolean {
  const family = (t: string) => {
    if (t === 'UI.TypeInto' || t === 'UI.GetText' || t === 'UI.GetAttribute') return 'input';
    if (t === 'UI.ExtractTableData') return 'table';
    if (t === 'UI.SelectItem') return 'select';
    return 'click';
  };
  return family(a) === family(b);
}

function collectUiWithSelectors(list: ActivityNode[]): ActivityNode[] {
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

function oneLine(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}
