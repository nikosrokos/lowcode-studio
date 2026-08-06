import { getActivityDefinition } from '../models/activities';
import type { ActivityNode, WorkflowDocument } from '../models/workflow';
import { newId } from '../models/workflow';
import { lcsTypeFromXamlName } from './activityMap';
import { normalizeLogLevel } from './xamlExport';

/**
 * Map common Studio Web / UiPath PascalCase property bags onto LCS catalog keys
 * so Properties edits and right-click actions work after import/adopt/pull.
 */
const ALIASES: Record<string, Record<string, string>> = {
  'System.LogMessage': {
    Message: 'message',
    Text: 'message',
    Level: 'level',
    TraceLevel: 'level'
  },
  'System.MessageBox': {
    Message: 'text',
    Text: 'text',
    Caption: 'title',
    Title: 'title'
  },
  'System.WriteLine': {
    Text: 'text',
    Message: 'text'
  },
  'System.Delay': {
    Duration: 'durationMs',
    DurationMs: 'durationMs'
  },
  'Programming.Assign': {
    To: 'to',
    Value: 'value'
  },
  'UI.Click': {
    Selector: 'selector',
    Target: 'selector'
  },
  'UI.TypeInto': {
    Selector: 'selector',
    Text: 'text',
    Value: 'text'
  },
  'UI.GetText': {
    Selector: 'selector',
    Result: 'result'
  },
  'UI.UseApplicationBrowser': {
    Url: 'urlOrPath',
    URL: 'urlOrPath',
    FilePath: 'urlOrPath',
    BrowserType: 'browserType',
    AttachMode: 'attachMode'
  },
  'Messaging.HttpRequest': {
    Url: 'url',
    URL: 'url',
    Method: 'method',
    Result: 'result'
  },
  'REFramework.InvokeWorkflow': {
    WorkflowFileName: 'workflowPath',
    WorkflowPath: 'workflowPath',
    FilePath: 'workflowPath'
  },
  'ControlFlow.If': {
    Condition: 'condition'
  },
  'ControlFlow.While': {
    Condition: 'condition'
  },
  'ControlFlow.DoWhile': {
    Condition: 'condition'
  }
};

/** Unwrap Studio Web / XAML expression objects into plain editable values. */
function coercePropValue(value: unknown): unknown {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const o = value as Record<string, unknown>;
  if (o.Expression != null) {
    return String(o.Expression);
  }
  if (o.expression != null) {
    return String(o.expression);
  }
  if (typeof o.Value === 'string' || typeof o.Value === 'number' || typeof o.Value === 'boolean') {
    return o.Value;
  }
  if (typeof o.value === 'string' || typeof o.value === 'number' || typeof o.value === 'boolean') {
    return o.value;
  }
  return value;
}

/**
 * Remap Imported.LogMessage (etc.) onto catalog types when the XAML local name is known.
 */
function remapImportedType(node: ActivityNode): void {
  if (!String(node.type || '').startsWith('Imported.')) {
    return;
  }
  const bare = String(node.type).slice('Imported.'.length);
  const fromOriginal = node.properties?.originalType
    ? String(node.properties.originalType)
    : bare;
  const local = fromOriginal.includes(':')
    ? fromOriginal.split(':').pop() || fromOriginal
    : fromOriginal;
  const mapped = lcsTypeFromXamlName(local) || lcsTypeFromXamlName(bare);
  if (mapped && getActivityDefinition(mapped)) {
    node.type = mapped;
    // Drop import-only hints once we have a real catalog type
    if (node.properties) {
      delete node.properties.originalType;
      delete node.properties.hint;
    }
    if (/\(imported\)\s*$/i.test(node.displayName || '')) {
      node.displayName = String(node.displayName).replace(/\s*\(imported\)\s*$/i, '').trim();
    }
  }
}

function walk(list: ActivityNode[] | undefined, fn: (n: ActivityNode) => void): void {
  for (const n of list || []) {
    fn(n);
    walk(n.children, fn);
    walk(n.elseChildren, fn);
  }
}

function coalesceCaseInsensitive(
  props: Record<string, unknown>,
  catalogName: string
): unknown {
  if (props[catalogName] !== undefined && props[catalogName] !== null && String(props[catalogName]).trim() !== '') {
    return props[catalogName];
  }
  const lower = catalogName.toLowerCase();
  for (const [k, v] of Object.entries(props)) {
    if (k.toLowerCase() === lower && v !== undefined && v !== null && String(v).trim() !== '') {
      return v;
    }
  }
  return props[catalogName];
}

export function normalizeActivityNode(node: ActivityNode): ActivityNode {
  if (!String(node.id || '').trim()) {
    node.id = newId();
  }
  remapImportedType(node);

  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.properties || {})) {
    props[k] = coercePropValue(v);
  }

  // Also map PascalCase aliases that apply once type is remapped
  const aliases = ALIASES[node.type] || {};
  for (const [from, to] of Object.entries(aliases)) {
    if (
      (props[to] === undefined || props[to] === null || String(props[to]).trim() === '') &&
      props[from] !== undefined &&
      props[from] !== null &&
      String(props[from]).trim() !== ''
    ) {
      props[to] = props[from];
    }
    // Prefer catalog key; drop PascalCase duplicate to avoid dual-edit confusion
    if (props[to] !== undefined && from !== to) {
      delete props[from];
    }
  }

  const def = getActivityDefinition(node.type);
  if (def) {
    for (const p of def.properties || []) {
      const got = coalesceCaseInsensitive(props, p.name);
      if (got !== undefined) {
        props[p.name] = got;
      }
      // Remove case-variant duplicates
      for (const k of Object.keys(props)) {
        if (k !== p.name && k.toLowerCase() === p.name.toLowerCase()) {
          delete props[k];
        }
      }
    }
  }

  if (node.type === 'System.LogMessage') {
    props.level = normalizeLogLevel(props.level);
    if (props.message !== undefined && props.message !== null) {
      props.message = String(props.message);
    }
  }

  if (node.type === 'System.Delay' && typeof props.durationMs === 'string') {
    const s = String(props.durationMs);
    if (!s.includes(':')) {
      const n = Number(s);
      if (!Number.isNaN(n)) {
        props.durationMs = n;
      }
    }
  }

  node.properties = props;
  return node;
}

/** Normalize all activities in a workflow (mutates and returns doc). */
export function normalizeWorkflowDocument(doc: WorkflowDocument): WorkflowDocument {
  walk(doc.activities, normalizeActivityNode);
  doc.variables = Array.isArray(doc.variables) ? doc.variables : [];
  doc.arguments = Array.isArray(doc.arguments) ? doc.arguments : [];
  return doc;
}
