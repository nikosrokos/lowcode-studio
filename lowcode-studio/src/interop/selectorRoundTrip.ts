/**
 * Selector extraction / emission helpers for UiPath classic + modern XAML.
 *
 * Stores on LCS activities:
 * - selector: human-readable classic selector string
 * - selectorModern: modern full selector encoding when present
 * - selectorXml: raw nested Target/Selector XML fragment for lossless re-export
 */

export interface ExtractedSelector {
  selector?: string;
  selectorModern?: string;
  selectorXml?: string;
  fuzzySelector?: string;
}

export function extractSelectorProps(raw: Record<string, unknown>): ExtractedSelector {
  const result: ExtractedSelector = {};

  const direct =
    asString(raw['@_Selector']) ||
    asString(deepGet(raw, ['Selector', '#text'])) ||
    asString(findArgumentText(raw, 'Selector'));

  if (direct) {
    result.selector = decodeXml(direct);
  }

  const modern =
    asString(raw['@_FullSelectorEncoding']) ||
    asString(deepGet(raw, ['FullSelectorEncoding', '#text'])) ||
    asString(findArgumentText(raw, 'FullSelectorEncoding'));
  if (modern) {
    result.selectorModern = decodeXml(modern);
  }

  const fuzzy =
    asString(raw['@_FuzzySelectorEncoding']) ||
    asString(findArgumentText(raw, 'FuzzySelectorEncoding'));
  if (fuzzy) {
    result.fuzzySelector = decodeXml(fuzzy);
  }

  // Classic nested: Target / Click.Target / NClick.Target → Selector
  const target =
    asObject(raw.Target) ||
    asObject(raw['Click.Target']) ||
    asObject(raw['TypeInto.Target']) ||
    asObject(raw['GetText.Target']) ||
    asObject(raw['NClick.Target']) ||
    asObject(raw['NTypeInto.Target']) ||
    asObject(raw['NGetText.Target']) ||
    findTargetObject(raw);

  if (target) {
    const nestedSelector =
      asString(target['@_Selector']) ||
      asString(deepGet(target, ['Selector', '#text'])) ||
      asString(deepGet(target, ['Selector'])) ||
      asString(findArgumentText(target, 'Selector'));
    if (nestedSelector && !result.selector) {
      result.selector = decodeXml(nestedSelector);
    }
    const nestedModern =
      asString(target['@_FullSelectorEncoding']) ||
      asString(findArgumentText(target, 'FullSelectorEncoding'));
    if (nestedModern && !result.selectorModern) {
      result.selectorModern = decodeXml(nestedModern);
    }
    // Preserve a compact XML-ish snapshot for round-trip
    result.selectorXml = buildTargetSnapshot(target, result);
  } else if (result.selector || result.selectorModern) {
    result.selectorXml = buildTargetSnapshot({}, result);
  }

  return result;
}

/** Merge selector fields into activity properties without wiping other keys. */
export function applySelectorProps(
  props: Record<string, unknown>,
  extracted: ExtractedSelector
): Record<string, unknown> {
  const next = { ...props };
  if (extracted.selector) {
    next.selector = extracted.selector;
  }
  if (extracted.selectorModern) {
    next.selectorModern = extracted.selectorModern;
  }
  if (extracted.fuzzySelector) {
    next.fuzzySelector = extracted.fuzzySelector;
  }
  if (extracted.selectorXml) {
    next.selectorXml = extracted.selectorXml;
  }
  return next;
}

/**
 * Emit a Target child block for UI activities on export.
 * Prefers preserved selectorXml shape when available; otherwise builds classic Selector.
 */
export function emitTargetXaml(
  properties: Record<string, unknown>,
  indent: string
): string {
  const selector = String(properties.selector || '').trim();
  const modern = String(properties.selectorModern || '').trim();
  const fuzzy = String(properties.fuzzySelector || '').trim();
  const xml = String(properties.selectorXml || '').trim();

  if (!selector && !modern && !xml) {
    return '';
  }

  // If we have a stored snapshot that looks like attributes, rebuild Target
  const pad = indent;
  const lines: string[] = [];
  lines.push(`${pad}<Target>`);
  if (selector) {
    lines.push(
      `${pad}  <Target.Selector>`
    );
    lines.push(
      `${pad}    <InArgument x:TypeArguments="x:String">${escapeXml(selector)}</InArgument>`
    );
    lines.push(`${pad}  </Target.Selector>`);
  }
  if (modern) {
    lines.push(
      `${pad}  <Target.FullSelectorEncoding>`
    );
    lines.push(
      `${pad}    <InArgument x:TypeArguments="x:String">${escapeXml(modern)}</InArgument>`
    );
    lines.push(`${pad}  </Target.FullSelectorEncoding>`);
  }
  if (fuzzy) {
    lines.push(
      `${pad}  <Target.FuzzySelectorEncoding>`
    );
    lines.push(
      `${pad}    <InArgument x:TypeArguments="x:String">${escapeXml(fuzzy)}</InArgument>`
    );
    lines.push(`${pad}  </Target.FuzzySelectorEncoding>`);
  }
  // Also keep classic attribute form for older Studio parsers
  if (selector && !modern) {
    // attribute form is redundant when child exists; keep child only
  }
  lines.push(`${pad}</Target>`);
  return lines.join('\n');
}

/** Attribute form: Selector="..." on the activity element */
export function selectorAttribute(properties: Record<string, unknown>): string {
  const selector = String(properties.selector || '').trim();
  if (!selector) {
    return '';
  }
  return ` Selector="${escapeAttr(selector)}"`;
}

export function hasSelector(properties: Record<string, unknown>): boolean {
  return Boolean(
    properties.selector || properties.selectorModern || properties.selectorXml
  );
}

function buildTargetSnapshot(
  target: Record<string, unknown>,
  extracted: ExtractedSelector
): string {
  const parts = ['<Target'];
  const sel = extracted.selector || asString(target['@_Selector']);
  const modern =
    extracted.selectorModern || asString(target['@_FullSelectorEncoding']);
  if (sel) {
    parts.push(` Selector="${escapeAttr(sel)}"`);
  }
  if (modern) {
    parts.push(` FullSelectorEncoding="${escapeAttr(modern)}"`);
  }
  parts.push(' />');
  return parts.join('');
}

function findTargetObject(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  for (const [key, value] of Object.entries(raw)) {
    if (/target$/i.test(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
}

function findArgumentText(raw: Record<string, unknown>, name: string): unknown {
  const keys = Object.keys(raw).filter(
    (k) => k === name || k.endsWith('.' + name) || k.endsWith(name)
  );
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (obj['#text'] != null) {
        return obj['#text'];
      }
      if (obj.InArgument != null) {
        return argumentText(obj.InArgument);
      }
      if (obj.OutArgument != null) {
        return argumentText(obj.OutArgument);
      }
    }
  }
  return undefined;
}

function argumentText(node: unknown): unknown {
  if (node == null) {
    return undefined;
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return node;
  }
  if (Array.isArray(node)) {
    return argumentText(node[0]);
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj['#text'] != null) {
      return obj['#text'];
    }
  }
  return undefined;
}

function deepGet(obj: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (!cur || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  const text = String(value).trim();
  return text ? text : undefined;
}

function decodeXml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeXml(text).replace(/"/g, '&quot;');
}
