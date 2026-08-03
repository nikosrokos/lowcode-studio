import { ActivityNode, WorkflowDocument } from '../models/workflow';

/**
 * UiPath activity package versions used when exporting for Studio Web.
 * Bracket form matches Studio project.json conventions.
 */
export const DEFAULT_PACKAGE_VERSIONS: Record<string, string> = {
  'UiPath.System.Activities': '[25.4.1]',
  'UiPath.UIAutomation.Activities': '[25.4.1]',
  'UiPath.Mail.Activities': '[2.2.2]',
  'UiPath.WebAPI.Activities': '[2.2.1]',
  'UiPath.Excel.Activities': '[2.24.3]',
  'UiPath.Python.Activities': '[1.9.0]',
  'UiPath.Testing.Activities': '[24.10.0]'
};

/** Always included so Studio can open the project without missing core packages. */
export const BASELINE_PACKAGES = [
  'UiPath.System.Activities',
  'UiPath.UIAutomation.Activities'
] as const;

const ACTIVITY_TO_PACKAGES: Record<string, string[]> = {
  'System.LogMessage': ['UiPath.System.Activities'],
  'System.Delay': ['UiPath.System.Activities'],
  'System.Comment': ['UiPath.System.Activities'],
  'Programming.Assign': ['UiPath.System.Activities'],
  'ControlFlow.If': ['UiPath.System.Activities'],
  'ControlFlow.While': ['UiPath.System.Activities'],
  'ControlFlow.ForEach': ['UiPath.System.Activities'],
  'ControlFlow.TryCatch': ['UiPath.System.Activities'],
  'ControlFlow.Sequence': ['UiPath.System.Activities'],
  'REFramework.InvokeWorkflow': ['UiPath.System.Activities'],
  'REFramework.SetTransactionStatus': ['UiPath.System.Activities'],
  'Data.ReadCsv': ['UiPath.System.Activities'],
  'Data.WriteCsv': ['UiPath.System.Activities'],
  'Data.BuildDataTable': ['UiPath.System.Activities'],
  'System.MessageBox': ['UiPath.System.Activities'],
  'System.WriteLine': ['UiPath.System.Activities'],
  'ControlFlow.DoWhile': ['UiPath.System.Activities'],
  'ControlFlow.RetryScope': ['UiPath.System.Activities'],
  'ControlFlow.Break': ['UiPath.System.Activities'],
  'UI.Click': ['UiPath.UIAutomation.Activities'],
  'UI.TypeInto': ['UiPath.UIAutomation.Activities'],
  'UI.GetText': ['UiPath.UIAutomation.Activities'],
  'UI.ElementExists': ['UiPath.UIAutomation.Activities'],
  'UI.Check': ['UiPath.UIAutomation.Activities'],
  'UI.Hover': ['UiPath.UIAutomation.Activities'],
  'UI.SelectItem': ['UiPath.UIAutomation.Activities'],
  'UI.TakeScreenshot': ['UiPath.UIAutomation.Activities'],
  'UI.OpenApplication': ['UiPath.UIAutomation.Activities'],
  'Excel.ReadRange': ['UiPath.Excel.Activities'],
  'Excel.WriteRange': ['UiPath.Excel.Activities'],
  'Excel.ReadCell': ['UiPath.Excel.Activities'],
  'Excel.WriteCell': ['UiPath.Excel.Activities'],
  'Messaging.SendEmail': ['UiPath.Mail.Activities'],
  'Messaging.HttpRequest': ['UiPath.WebAPI.Activities', 'UiPath.System.Activities'],
  'Python.PythonScope': ['UiPath.Python.Activities'],
  'Python.LoadScript': ['UiPath.Python.Activities'],
  'Python.RunScript': ['UiPath.Python.Activities'],
  'Python.InvokeMethod': ['UiPath.Python.Activities'],
  'Python.GetObject': ['UiPath.Python.Activities'],
  'Flowchart.Start': ['UiPath.System.Activities'],
  'Flowchart.End': ['UiPath.System.Activities'],
  'Flowchart.FlowDecision': ['UiPath.System.Activities']
};

export function collectActivityTypes(docs: WorkflowDocument[]): string[] {
  const types = new Set<string>();
  const walk = (list: ActivityNode[]) => {
    for (const a of list) {
      types.add(a.type);
      if (a.children) {
        walk(a.children);
      }
      if (a.elseChildren) {
        walk(a.elseChildren);
      }
    }
  };
  for (const doc of docs) {
    walk(doc.activities);
  }
  return [...types];
}

/**
 * Build Studio-compatible dependencies map from used activities + optional
 * packages preserved from an imported UiPath project.
 */
export function resolveUiPathDependencies(options: {
  activityTypes?: string[];
  preserved?: Record<string, string>;
  includeBaseline?: boolean;
  versions?: Record<string, string>;
}): Record<string, string> {
  const versions = { ...DEFAULT_PACKAGE_VERSIONS, ...(options.versions || {}) };
  const packages = new Set<string>();

  if (options.includeBaseline !== false) {
    for (const p of BASELINE_PACKAGES) {
      packages.add(p);
    }
  }

  for (const type of options.activityTypes || []) {
    const mapped = ACTIVITY_TO_PACKAGES[type];
    if (mapped) {
      mapped.forEach((p) => packages.add(p));
    } else if (type.startsWith('Imported.') || type.startsWith('UI.')) {
      packages.add('UiPath.UIAutomation.Activities');
      packages.add('UiPath.System.Activities');
    } else {
      packages.add('UiPath.System.Activities');
    }
  }

  const result: Record<string, string> = {};

  // Preserve imported versions first (Studio already validated them)
  for (const [name, ver] of Object.entries(options.preserved || {})) {
    if (name.startsWith('UiPath.') || name.includes('Activities')) {
      result[name] = normalizeVersion(ver);
    }
  }

  // Ensure required packages exist (fill defaults when missing)
  for (const name of packages) {
    if (!result[name]) {
      result[name] = versions[name] || '[1.0.0]';
    }
  }

  // Stable key order
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function normalizeVersion(ver: string): string {
  const v = String(ver).trim();
  if (!v) {
    return '[1.0.0]';
  }
  if (v.startsWith('[') || v.startsWith('(')) {
    return v;
  }
  // plain semver → exact bracket pin like Studio
  return `[${v}]`;
}
