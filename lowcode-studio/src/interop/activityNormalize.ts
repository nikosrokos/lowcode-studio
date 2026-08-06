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
  'Data.BuildDataTable': {
    Columns: 'columns',
    ColumnNames: 'columns',
    Result: 'result',
    DataTable: 'result'
  },
  'Data.AddDataRow': {
    DataTable: 'dataTable',
    ArrayRow: 'arrayRow'
  },
  'Data.ReadCsv': {
    FilePath: 'filePath',
    DataTable: 'dataTable',
    Result: 'dataTable'
  },
  'Data.WriteCsv': {
    FilePath: 'filePath',
    DataTable: 'dataTable'
  },
  'ControlFlow.If': {
    Condition: 'condition'
  },
  'ControlFlow.While': {
    Condition: 'condition'
  },
  'ControlFlow.DoWhile': {
    Condition: 'condition'
  },
  'Excel.ReadRange': {
    WorkbookPath: 'workbookPath',
    SheetName: 'sheetName',
    Range: 'range',
    Result: 'result',
    DataTable: 'result'
  },
  'Excel.WriteRange': {
    WorkbookPath: 'workbookPath',
    SheetName: 'sheetName',
    DataTable: 'data',
    Data: 'data'
  },
  'Excel.AppendRange': {
    WorkbookPath: 'workbookPath',
    SheetName: 'sheetName',
    DataTable: 'data',
    Data: 'data'
  },
  'Excel.ReadCell': {
    WorkbookPath: 'workbookPath',
    SheetName: 'sheetName',
    Cell: 'cell',
    Result: 'result'
  },
  'Excel.WriteCell': {
    WorkbookPath: 'workbookPath',
    SheetName: 'sheetName',
    Cell: 'cell',
    Value: 'value'
  },
  'Excel.ExcelApplicationScope': {
    WorkbookPath: 'workbookPath',
    CreateNewFile: 'createIfNotExists',
    CreateIfNotExists: 'createIfNotExists'
  },
  'Orchestrator.GetTransactionItem': {
    QueueName: 'queueName',
    FolderPath: 'folderPath',
    Reference: 'reference',
    Result: 'result',
    TransactionItem: 'result'
  },
  'Orchestrator.WaitQueueItem': {
    QueueName: 'queueName',
    FolderPath: 'folderPath',
    TimeoutMS: 'timeoutMs',
    TimeoutMs: 'timeoutMs',
    Result: 'result',
    TransactionItem: 'result'
  },
  'Orchestrator.AddQueueItem': {
    QueueName: 'queueName',
    FolderPath: 'folderPath',
    Reference: 'reference',
    Priority: 'priority',
    ItemInformation: 'itemInformation'
  },
  'Orchestrator.GetAsset': {
    AssetName: 'assetName',
    FolderPath: 'folderPath',
    Result: 'result'
  },
  'Orchestrator.GetCredential': {
    AssetName: 'assetName',
    FolderPath: 'folderPath',
    Username: 'username',
    Password: 'password'
  },
  'Orchestrator.SetAsset': {
    AssetName: 'assetName',
    FolderPath: 'folderPath',
    Value: 'value'
  }
};

/** Unwrap Studio Web / XAML expression objects into plain editable values. */
export function coercePropValue(value: unknown): unknown {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const o = value as Record<string, unknown>;
  if (o.ExpressionText != null && String(o.ExpressionText).trim() !== '') {
    return String(o.ExpressionText);
  }
  if (o.expressionText != null && String(o.expressionText).trim() !== '') {
    return String(o.expressionText);
  }
  if (o['@_ExpressionText'] != null && String(o['@_ExpressionText']).trim() !== '') {
    return String(o['@_ExpressionText']);
  }
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
  // Nested VisualBasicValue / Literal
  for (const [k, v] of Object.entries(o)) {
    if (/VisualBasicValue|Literal|InArgument|CSharpValue/i.test(k) && v && typeof v === 'object') {
      const inner = coercePropValue(v);
      if (inner != null && typeof inner !== 'object') {
        return inner;
      }
    }
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
  // Coerce children bags to arrays (bad SW JSON sometimes stores a single object)
  const coerceLists = (list: ActivityNode[] | undefined): void => {
    for (const n of list || []) {
      if (!n) continue;
      if (n.children != null && !Array.isArray(n.children)) {
        n.children = [n.children as unknown as ActivityNode];
      }
      if (n.elseChildren != null && !Array.isArray(n.elseChildren)) {
        n.elseChildren = [n.elseChildren as unknown as ActivityNode];
      }
      coerceLists(n.children);
      coerceLists(n.elseChildren);
    }
  };
  if (!Array.isArray(doc.activities)) {
    doc.activities = [];
  }
  coerceLists(doc.activities);
  walk(doc.activities, normalizeActivityNode);
  // Promote lone root Sequence so Sync/pull activities are top-level click targets
  unwrapSingletonSequence(doc);
  walk(doc.activities, normalizeActivityNode);
  doc.variables = Array.isArray(doc.variables) ? doc.variables : [];
  doc.arguments = Array.isArray(doc.arguments) ? doc.arguments : [];
  return doc;
}

/**
 * Promote a lone root ControlFlow.Sequence so Studio Web–style trees expose
 * real steps at the top level (Properties / click targets).
 */
export function unwrapSingletonSequence(doc: WorkflowDocument): boolean {
  if (!doc || doc.type === 'Flowchart') {
    return false;
  }
  if (!Array.isArray(doc.activities) || doc.activities.length !== 1) {
    return false;
  }
  const root = doc.activities[0];
  if (!root || root.type !== 'ControlFlow.Sequence') {
    return false;
  }
  const kids = Array.isArray(root.children) ? root.children : [];
  if (!kids.length) {
    return false;
  }
  doc.activities = kids;
  return true;
}

/** True when raw JSON still has blank ids (common on older Studio Web pulls). */
export function rawWorkflowHasMissingIds(text: string): boolean {
  try {
    const raw = JSON.parse(text) as { activities?: ActivityNode[] };
    const visit = (list: ActivityNode[] | undefined): boolean => {
      for (const n of list || []) {
        if (!String(n?.id || '').trim()) {
          return true;
        }
        if (visit(n.children) || visit(n.elseChildren)) {
          return true;
        }
      }
      return false;
    };
    return visit(raw.activities);
  } catch {
    return false;
  }
}

/**
 * Designer-ready migration for existing projects: normalize props/types, heal ids,
 * unwrap a singleton Sequence wrapper. Mutates and returns whether anything changed.
 */
export function migrateWorkflowDocument(doc: WorkflowDocument): { doc: WorkflowDocument; changed: boolean } {
  const before = JSON.stringify({
    activities: doc.activities,
    variables: doc.variables,
    arguments: doc.arguments
  });
  normalizeWorkflowDocument(doc);
  const unwrapped = unwrapSingletonSequence(doc);
  // Re-normalize after unwrap (children may still need PascalCase / ids)
  normalizeWorkflowDocument(doc);
  const after = JSON.stringify({
    activities: doc.activities,
    variables: doc.variables,
    arguments: doc.arguments
  });
  return { doc, changed: unwrapped || before !== after };
}
