/**
 * Workflow arguments + Invoke Workflow argument mapping helpers.
 */

import { ArgumentDirection, WorkflowArgument, VariableType } from '../models/workflow';

const VAR_TYPES: VariableType[] = [
  'String',
  'Int32',
  'Boolean',
  'Double',
  'Object',
  'DataTable',
  'Array'
];

export interface InvokeArgumentMapping {
  name: string;
  expression: string;
  direction?: ArgumentDirection;
}

/** Parse multiline "name = expression" (or name: expression) mappings. */
export function parseArgumentMappings(raw: unknown): InvokeArgumentMapping[] {
  const text = String(raw ?? '').trim();
  if (!text) {
    return [];
  }
  // JSON object form: { "in_Config": "Config" }
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      return Object.entries(obj).map(([name, expression]) => ({
        name: String(name).trim(),
        expression: String(expression ?? '').trim()
      })).filter((m) => m.name);
    } catch {
      // fall through to line parser
    }
  }
  const out: InvokeArgumentMapping[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const m = trimmed.match(/^([A-Za-z_][\w]*)\s*(?:=|:)\s*(.+)$/);
    if (m) {
      out.push({ name: m[1], expression: m[2].trim() });
    }
  }
  return out;
}

export function formatArgumentMappings(mappings: InvokeArgumentMapping[]): string {
  return mappings
    .filter((m) => m.name)
    .map((m) => `${m.name} = ${m.expression || '""'}`)
    .join('\n');
}

export function normalizeWorkflowArgument(raw: Partial<WorkflowArgument> | null | undefined): WorkflowArgument | null {
  if (!raw || !String(raw.name || '').trim()) {
    return null;
  }
  const direction: ArgumentDirection =
    raw.direction === 'Out' || raw.direction === 'InOut' ? raw.direction : 'In';
  const type = String(raw.type || 'String');
  return {
    name: String(raw.name).trim(),
    type: (VAR_TYPES.includes(type as VariableType) ? type : type) as VariableType | string,
    direction,
    defaultValue: raw.defaultValue
  };
}

export function xamlTypeForArgument(type: string): string {
  switch (type) {
    case 'Int32':
      return 'x:Int32';
    case 'Boolean':
      return 'x:Boolean';
    case 'Double':
      return 'x:Double';
    case 'DataTable':
      return 'sd:DataTable';
    case 'Array':
      return 'x:Array';
    case 'Object':
      return 'x:Object';
    case 'String':
    default:
      return 'x:String';
  }
}

/** UiPath-style x:Members property declarations for workflow arguments. */
export function renderXamlMembers(args: WorkflowArgument[]): string {
  if (!args.length) {
    return '';
  }
  const lines = args.map((a) => {
    const dir = a.direction || 'In';
    const t = xamlTypeForArgument(String(a.type || 'String'));
    const argType =
      dir === 'Out'
        ? `OutArgument(${t})`
        : dir === 'InOut'
          ? `InOutArgument(${t})`
          : `InArgument(${t})`;
    return `  <x:Property Name="${escapeXml(a.name)}" Type="${escapeXml(argType)}" />`;
  });
  return `<x:Members>\n${lines.join('\n')}\n</x:Members>\n`;
}

/**
 * Child Arguments element for InvokeWorkflowFile.
 * Uses InArgument dictionary entries keyed by argument name.
 */
export function renderInvokeArgumentsXml(
  mappings: InvokeArgumentMapping[],
  pad: string
): string {
  if (!mappings.length) {
    return '';
  }
  const kids = mappings
    .map((m) => {
      const expr = stripOuterBrackets(m.expression);
      return `${pad}    <InArgument x:TypeArguments="x:Object" x:Key="${escapeXml(m.name)}">[${escapeXml(expr)}]</InArgument>`;
    })
    .join('\n');
  return `${pad}  <ui:InvokeWorkflowFile.Arguments>
${kids}
${pad}  </ui:InvokeWorkflowFile.Arguments>
`;
}

export function stripOuterBrackets(value: string): string {
  const s = String(value || '').trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    return s.slice(1, -1);
  }
  return s;
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
