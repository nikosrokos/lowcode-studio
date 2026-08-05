import { ActivityNode, WorkflowDocument } from '../models/workflow';
import { getActivityDefinition } from '../models/activities';

export interface ExpressionFix {
  ruleId: string;
  label: string;
}

export interface ExpressionRewriteResult {
  original: string;
  next: string;
  fixes: ExpressionFix[];
  changed: boolean;
}

export interface ExpressionRepairProposal {
  activityId: string;
  displayName: string;
  type: string;
  property: string;
  propertyLabel: string;
  original: string;
  proposed: string;
  fixes: ExpressionFix[];
  actionable: boolean;
}

/** Properties that usually hold UiPath VB expressions even without a catalog hit. */
const EXPRESSIONISH_NAMES = new Set([
  'condition',
  'message',
  'value',
  'text',
  'expression',
  'url',
  'jsonString',
  'json',
  'arrayRow',
  'subject',
  'body',
  'to',
  'assignments',
  'code',
  'script',
  'fileName',
  'path',
  'destination',
  'reference',
  'itemInformation',
  'lookupValue',
  'filter',
  'argumentMappings'
]);

/**
 * F4 Assist — deterministic UiPath Visual Basic expression repairs.
 * Examples: TRim(name) → name.Trim(); name.toUpperCase() → name.ToUpper(); == null → Is Nothing.
 * Propose-don't-mute: callers must confirm before applying.
 */
export function rewriteVbExpression(input: string): ExpressionRewriteResult {
  const original = String(input ?? '');
  if (!original.trim()) {
    return { original, next: original, fixes: [], changed: false };
  }

  const fixes: ExpressionFix[] = [];
  const note = (ruleId: string, label: string) => {
    if (!fixes.some((f) => f.ruleId === ruleId && f.label === label)) {
      fixes.push({ ruleId, label });
    }
  };

  // Protect string literals so we don't rewrite inside "Trim(x)" text
  const parts = splitKeepingStrings(original);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].kind === 'string') {
      continue;
    }
    let chunk = parts[i].text;
    const before = chunk;

    // JS String methods first (so later null-checks see name.ToUpper() …)
    const methodMap: Array<[RegExp, string, string, string]> = [
      [/\.toUpperCase\s*\(/gi, '.ToUpper(', 'js-upper', '.toUpperCase() → .ToUpper()'],
      [/\.toLowerCase\s*\(/gi, '.ToLower(', 'js-lower', '.toLowerCase() → .ToLower()'],
      [/\.trim\s*\(/gi, '.Trim(', 'js-trim', '.trim() → .Trim()'],
      [/\.includes\s*\(/gi, '.Contains(', 'js-includes', '.includes() → .Contains()'],
      [/\.startsWith\s*\(/gi, '.StartsWith(', 'js-startswith', '.startsWith() → .StartsWith()'],
      [/\.endsWith\s*\(/gi, '.EndsWith(', 'js-endswith', '.endsWith() → .EndsWith()'],
      [/\.indexOf\s*\(/gi, '.IndexOf(', 'js-indexof', '.indexOf() → .IndexOf()'],
      [/\.substring\s*\(/gi, '.Substring(', 'js-substring', '.substring() → .Substring()'],
      [/\.substr\s*\(/gi, '.Substring(', 'js-substr', '.substr() → .Substring()'],
      [/\.replace\s*\(/gi, '.Replace(', 'js-replace', '.replace() → .Replace()'],
      [/\.split\s*\(/gi, '.Split(', 'js-split', '.split() → .Split()'],
      [/\.padStart\s*\(/gi, '.PadLeft(', 'js-padstart', '.padStart() → .PadLeft()'],
      [/\.padEnd\s*\(/gi, '.PadRight(', 'js-padend', '.padEnd() → .PadRight()']
    ];
    for (const [re, rep, id, label] of methodMap) {
      chunk = replaceAll(chunk, re, rep, () => note(id, label));
    }
    chunk = replaceAll(chunk, /\.length\b/g, '.Length', () =>
      note('js-length', '.length → .Length')
    );

    // VB legacy helpers / mistyped wrappers → instance style (UiPath idiomatic)
    chunk = replaceUnaryFn(chunk, 'Trim', (arg) => `${arg}.Trim()`, () =>
      note('vb-trim', 'Trim(x) → x.Trim()')
    );
    chunk = replaceUnaryFn(chunk, 'LTrim', (arg) => `${arg}.TrimStart()`, () =>
      note('vb-ltrim', 'LTrim(x) → x.TrimStart()')
    );
    chunk = replaceUnaryFn(chunk, 'RTrim', (arg) => `${arg}.TrimEnd()`, () =>
      note('vb-rtrim', 'RTrim(x) → x.TrimEnd()')
    );
    chunk = replaceUnaryFn(chunk, 'UCase', (arg) => `${arg}.ToUpper()`, () =>
      note('vb-ucase', 'UCase(x) → x.ToUpper()')
    );
    chunk = replaceUnaryFn(chunk, 'LCase', (arg) => `${arg}.ToLower()`, () =>
      note('vb-lcase', 'LCase(x) → x.ToLower()')
    );
    chunk = replaceUnaryFn(chunk, 'Len', (arg) => `${arg}.Length`, () =>
      note('vb-len', 'Len(x) → x.Length')
    );

    chunk = replaceBinaryFn(chunk, 'Left', (a, b) => `${a}.Substring(0, ${b})`, () =>
      note('vb-left', 'Left(x, n) → x.Substring(0, n)')
    );
    chunk = replaceBinaryFn(
      chunk,
      'Right',
      (a, b) => `${a}.Substring(${a}.Length - (${b}))`,
      () => note('vb-right', 'Right(x, n) → x.Substring(x.Length - n)')
    );
    chunk = replaceTernaryFn(
      chunk,
      'Mid',
      (s, start, len) => `${s}.Substring((${start}) - 1, ${len})`,
      () => note('vb-mid', 'Mid(s, start, len) → s.Substring(start - 1, len)')
    );

    // null / undefined comparisons (allow simple calls like name.ToUpper())
    const lhs = String.raw`([\w.]+(?:\([^)]*\))?)`;
    chunk = replaceAll(
      chunk,
      new RegExp(`${lhs}\\s*(?:===|==)\\s*(?:null|undefined)\\b`, 'gi'),
      '$1 Is Nothing',
      () => note('null-eq', '== null/undefined → Is Nothing')
    );
    chunk = replaceAll(
      chunk,
      new RegExp(`\\b(?:null|undefined)\\s*(?:===|==)\\s*${lhs}`, 'gi'),
      '$1 Is Nothing',
      () => note('null-eq', 'null/undefined == x → x Is Nothing')
    );
    chunk = replaceAll(
      chunk,
      new RegExp(`${lhs}\\s*(?:!==|!=)\\s*(?:null|undefined)\\b`, 'gi'),
      '$1 IsNot Nothing',
      () => note('null-neq', '!= null/undefined → IsNot Nothing')
    );
    chunk = replaceAll(
      chunk,
      new RegExp(`\\b(?:null|undefined)\\s*(?:!==|!=)\\s*${lhs}`, 'gi'),
      '$1 IsNot Nothing',
      () => note('null-neq', 'null/undefined != x → x IsNot Nothing')
    );

    // Bare null / undefined tokens
    chunk = replaceAll(chunk, /\bundefined\b/g, 'Nothing', () =>
      note('undefined', 'undefined → Nothing')
    );
    chunk = replaceAll(chunk, /\bnull\b/g, 'Nothing', () => note('null', 'null → Nothing'));

    // x = Nothing / x == Nothing → x Is Nothing (VB reference equality)
    chunk = replaceAll(
      chunk,
      new RegExp(`${lhs}\\s*(?:==|=)\\s*Nothing\\b`, 'gi'),
      '$1 Is Nothing',
      () => note('is-nothing', '= Nothing → Is Nothing')
    );
    chunk = replaceAll(
      chunk,
      new RegExp(`${lhs}\\s*(?:!=|<>)\\s*Nothing\\b`, 'gi'),
      '$1 IsNot Nothing',
      () => note('isnot-nothing', '<> Nothing → IsNot Nothing')
    );

    // JS / C# operators → VB
    chunk = replaceAll(chunk, /===/g, '=', () => note('eq3', '=== → ='));
    chunk = replaceAll(chunk, /!==/g, '<>', () => note('neq3', '!== → <>'));
    chunk = replaceAll(chunk, /!=/g, '<>', () => note('neq', '!= → <>'));
    chunk = replaceAll(chunk, /&&/g, ' AndAlso ', () => note('and', '&& → AndAlso'));
    chunk = replaceAll(chunk, /\|\|/g, ' OrElse ', () => note('or', '|| → OrElse'));
    chunk = replaceAll(chunk, /\btrue\b/g, 'True', () => note('true', 'true → True'));
    chunk = replaceAll(chunk, /\bfalse\b/g, 'False', () => note('false', 'false → False'));

    // Missing String. prefix (common Studio typo)
    chunk = replaceAll(
      chunk,
      /\b(?<!String\.)IsNullOrEmpty\s*\(/g,
      'String.IsNullOrEmpty(',
      () => note('isnullorempty', 'IsNullOrEmpty → String.IsNullOrEmpty')
    );
    chunk = replaceAll(
      chunk,
      /\b(?<!String\.)IsNullOrWhiteSpace\s*\(/g,
      'String.IsNullOrWhiteSpace(',
      () => note('isnullorws', 'IsNullOrWhiteSpace → String.IsNullOrWhiteSpace')
    );

    // Collapse spaces introduced by AndAlso/OrElse
    chunk = chunk.replace(/[ \t]{2,}/g, ' ');

    if (chunk !== before) {
      parts[i] = { kind: 'code', text: chunk };
    }
  }

  const next = parts.map((p) => p.text).join('');
  return {
    original,
    next,
    fixes,
    changed: next !== original
  };
}

export function proposeExpressionRepairs(doc: WorkflowDocument): ExpressionRepairProposal[] {
  const proposals: ExpressionRepairProposal[] = [];
  const walk = (list: ActivityNode[]) => {
    for (const activity of list) {
      const def = getActivityDefinition(activity.type);
      const props = activity.properties || {};
      for (const [name, raw] of Object.entries(props)) {
        if (typeof raw !== 'string') {
          continue;
        }
        if (!isExpressionProperty(activity.type, name, def?.properties)) {
          continue;
        }
        // Skip selectors — F3 owns those
        if (name === 'selector' || name === 'selectorModern' || name === 'selectorXml') {
          continue;
        }
        const rewritten = rewriteVbExpression(raw);
        if (!rewritten.changed) {
          continue;
        }
        const propDef = def?.properties?.find((p) => p.name === name);
        proposals.push({
          activityId: activity.id,
          displayName: activity.displayName,
          type: activity.type,
          property: name,
          propertyLabel: propDef?.label || name,
          original: raw,
          proposed: rewritten.next,
          fixes: rewritten.fixes,
          actionable: true
        });
      }
      if (activity.children) walk(activity.children);
      if (activity.elseChildren) walk(activity.elseChildren);
    }
  };
  walk(doc.activities);
  return proposals;
}

export function applyExpressionRepairs(
  doc: WorkflowDocument,
  proposals: ExpressionRepairProposal[]
): WorkflowDocument {
  const byKey = new Map(
    proposals
      .filter((p) => p.actionable)
      .map((p) => [`${p.activityId}::${p.property}`, p.proposed] as const)
  );
  if (!byKey.size) {
    return doc;
  }
  const clone: WorkflowDocument = JSON.parse(JSON.stringify(doc)) as WorkflowDocument;
  const walk = (list: ActivityNode[]) => {
    for (const a of list) {
      for (const key of Object.keys(a.properties || {})) {
        const next = byKey.get(`${a.id}::${key}`);
        if (next !== undefined) {
          a.properties[key] = next;
        }
      }
      if (a.children) walk(a.children);
      if (a.elseChildren) walk(a.elseChildren);
    }
  };
  walk(clone.activities);
  return clone;
}

export function formatExpressionAssistReport(proposals: ExpressionRepairProposal[]): string {
  const lines: string[] = [
    '# Assist F4 — VB expression repairs',
    '',
    '_Deterministic UiPath Visual Basic fixes (no LLM). Confirm before apply._',
    '',
    `${proposals.length} proposal(s).`,
    ''
  ];
  if (!proposals.length) {
    lines.push('No Trim/JS/operator typos detected in expression fields.');
  }
  for (const p of proposals) {
    lines.push(
      `### ${p.displayName} · ${p.propertyLabel}`,
      `- Activity: \`${p.type}\` (\`${p.activityId}\`)`,
      `- Before: \`${oneLine(p.original)}\``,
      `- After:  \`${oneLine(p.proposed)}\``,
      `- Fixes: ${p.fixes.map((f) => f.label).join('; ') || '(none)'}`,
      ''
    );
  }
  lines.push('---', 'Always spot-check in Studio Web — especially Left/Right/Mid conversions.');
  return lines.join('\n');
}

function isExpressionProperty(
  activityType: string,
  name: string,
  props?: { name: string; type: string }[]
): boolean {
  void activityType;
  const def = props?.find((p) => p.name === name);
  if (def) {
    return (
      def.type === 'expression' ||
      def.type === 'multiline' ||
      name === 'condition' ||
      name === 'expression' ||
      name === 'assignments' ||
      name === 'argumentMappings'
    );
  }
  return EXPRESSIONISH_NAMES.has(name);
}

type Segment = { kind: 'code' | 'string'; text: string };

function splitKeepingStrings(input: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  let code = '';
  while (i < input.length) {
    const ch = input[i];
    if (ch === '"' || ch === "'") {
      if (code) {
        out.push({ kind: 'code', text: code });
        code = '';
      }
      const quote = ch;
      let s = quote;
      i += 1;
      while (i < input.length) {
        const c = input[i];
        s += c;
        // VB doubled quotes inside strings
        if (c === quote) {
          if (input[i + 1] === quote) {
            s += input[i + 1];
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      out.push({ kind: 'string', text: s });
      continue;
    }
    code += ch;
    i += 1;
  }
  if (code) {
    out.push({ kind: 'code', text: code });
  }
  return out.length ? out : [{ kind: 'code', text: input }];
}

function replaceAll(
  input: string,
  re: RegExp,
  replacement: string,
  onHit: () => void
): string {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const global = new RegExp(re.source, flags);
  let hit = false;
  const next = input.replace(global, (...args) => {
    hit = true;
    if (typeof replacement === 'string') {
      // Support $1-style replacements
      const match = args[0] as string;
      const groups = args.slice(1, -2) as string[];
      let out = replacement;
      out = out.replace(/\$(\d+)/g, (_, n) => groups[Number(n) - 1] ?? '');
      void match;
      return out;
    }
    return replacement;
  });
  if (hit) onHit();
  return next;
}

function replaceUnaryFn(
  input: string,
  name: string,
  wrap: (arg: string) => string,
  onHit: () => void
): string {
  // (?<![\w.]) avoids rewriting already-correct instance calls like x.Trim()
  const re = new RegExp(`(?<![\\w.])${name}\\s*\\(\\s*([^()]+?)\\s*\\)`, 'gi');
  let hit = false;
  const next = input.replace(re, (_m, arg: string) => {
    hit = true;
    return wrap(arg.trim());
  });
  if (hit) onHit();
  return next;
}

function replaceBinaryFn(
  input: string,
  name: string,
  wrap: (a: string, b: string) => string,
  onHit: () => void
): string {
  const re = new RegExp(
    `(?<![\\w.])${name}\\s*\\(\\s*([^,()]+?)\\s*,\\s*([^()]+?)\\s*\\)`,
    'gi'
  );
  let hit = false;
  const next = input.replace(re, (_m, a: string, b: string) => {
    hit = true;
    return wrap(a.trim(), b.trim());
  });
  if (hit) onHit();
  return next;
}

function replaceTernaryFn(
  input: string,
  name: string,
  wrap: (a: string, b: string, c: string) => string,
  onHit: () => void
): string {
  const re = new RegExp(
    `(?<![\\w.])${name}\\s*\\(\\s*([^,()]+?)\\s*,\\s*([^,()]+?)\\s*,\\s*([^()]+?)\\s*\\)`,
    'gi'
  );
  let hit = false;
  const next = input.replace(re, (_m, a: string, b: string, c: string) => {
    hit = true;
    return wrap(a.trim(), b.trim(), c.trim());
  });
  if (hit) onHit();
  return next;
}

function oneLine(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}
