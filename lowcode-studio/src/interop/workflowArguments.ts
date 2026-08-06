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

/** Parse multiline "name = expression" (or name: expression) mappings.
 *  Optional direction prefix: `Out:out_Status = result` / `InOut:io_X = y`.
 */
export function parseArgumentMappings(raw: unknown): InvokeArgumentMapping[] {
  const text = String(raw ?? '').trim();
  if (!text) {
    return [];
  }
  // JSON object form: { "in_Config": "Config" } or { "in_Config": { expression, direction } }
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      return Object.entries(obj)
        .map(([name, value]) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const rec = value as { expression?: unknown; direction?: unknown };
            const direction =
              rec.direction === 'Out' || rec.direction === 'InOut' || rec.direction === 'In'
                ? (rec.direction as ArgumentDirection)
                : undefined;
            return {
              name: String(name).trim(),
              expression: String(rec.expression ?? '').trim(),
              direction
            };
          }
          return {
            name: String(name).trim(),
            expression: String(value ?? '').trim()
          };
        })
        .filter((m) => m.name);
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
    const directed = trimmed.match(
      /^(In|Out|InOut)\s*:\s*([A-Za-z_][\w]*)\s*(?:=|:)\s*(.+)$/i
    );
    if (directed) {
      const dirRaw = directed[1];
      const direction: ArgumentDirection =
        /^out$/i.test(dirRaw) ? 'Out' : /^inout$/i.test(dirRaw) ? 'InOut' : 'In';
      out.push({
        name: directed[2],
        expression: directed[3].trim(),
        direction
      });
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
    .map((m) => {
      const expr = m.expression || '""';
      if (m.direction === 'Out' || m.direction === 'InOut') {
        return `${m.direction}:${m.name} = ${expr}`;
      }
      return `${m.name} = ${expr}`;
    })
    .join('\n');
}

/** Merge target workflow contract with existing mappings (preserve expressions). */
export function mergeInvokeMappings(
  targetArgs: Array<Pick<WorkflowArgument, 'name' | 'direction' | 'type'>>,
  existing: InvokeArgumentMapping[]
): InvokeArgumentMapping[] {
  const byName = new Map(existing.map((m) => [m.name, m]));
  const out: InvokeArgumentMapping[] = [];
  for (const arg of targetArgs) {
    const name = String(arg.name || '').trim();
    if (!name) {
      continue;
    }
    const prev = byName.get(name);
    out.push({
      name,
      expression: prev?.expression ?? '',
      direction: arg.direction || prev?.direction || 'In'
    });
    byName.delete(name);
  }
  // Keep extras (manual / stale) so we don't silently drop
  for (const m of byName.values()) {
    out.push(m);
  }
  return out;
}

export function missingInvokeMappings(
  targetArgs: Array<Pick<WorkflowArgument, 'name' | 'direction'>>,
  existing: InvokeArgumentMapping[]
): Array<{ name: string; direction: ArgumentDirection }> {
  const mapped = new Set(
    existing.filter((m) => m.name && String(m.expression || '').trim()).map((m) => m.name)
  );
  return targetArgs
    .filter((a) => a.name && !mapped.has(a.name))
    .map((a) => ({
      name: a.name,
      direction: a.direction === 'Out' || a.direction === 'InOut' ? a.direction : 'In'
    }));
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
 * Emits In / Out / InOut dictionary entries from mapping.direction.
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
      const tag =
        m.direction === 'Out'
          ? 'OutArgument'
          : m.direction === 'InOut'
            ? 'InOutArgument'
            : 'InArgument';
      return `${pad}    <${tag} x:TypeArguments="x:Object" x:Key="${escapeXml(m.name)}">[${escapeXml(expr)}]</${tag}>`;
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
