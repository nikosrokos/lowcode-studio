/**
 * Studio Web Local Workspace syncs as Portable (cross-platform).
 * Some UiPath activities exist only for Windows / Windows-Legacy and show
 * "The activity is either missing or could not be loaded properly" in Studio Web.
 *
 * Sources: UiPath System / UI Automation / Excel / Developer project-compatibility docs.
 */

export type PortableStrategy =
  | 'rewrite' // export emits a Portable-friendly substitute
  | 'comment' // export as ui:Comment so Studio Web can open the file
  | 'ok'; // available on cross-platform as-is (or already modern)

/** LCS types that are NOT available (or not safely loadable) in Portable projects. */
export const WINDOWS_ONLY_ACTIVITY_TYPES = new Set<string>([
  'Data.BuildDataTable',
  'Programming.MultipleAssign',
  'System.MessageBox',
  'System.DeleteFile',
  'Excel.ExcelApplicationScope',
  'Python.PythonScope',
  'Python.LoadScript',
  'Python.RunScript',
  'Python.InvokeMethod',
  'Python.GetObject'
]);

/** How Portable export should treat each Windows-only type. */
export const PORTABLE_STRATEGY: Record<string, PortableStrategy> = {
  'Data.BuildDataTable': 'rewrite',
  'Programming.MultipleAssign': 'rewrite',
  'System.MessageBox': 'rewrite',
  'System.DeleteFile': 'comment',
  'Excel.ExcelApplicationScope': 'comment',
  'Python.PythonScope': 'comment',
  'Python.LoadScript': 'comment',
  'Python.RunScript': 'comment',
  'Python.InvokeMethod': 'comment',
  'Python.GetObject': 'comment'
};

export function isWindowsOnlyActivityType(type: string): boolean {
  return WINDOWS_ONLY_ACTIVITY_TYPES.has(type);
}

export function portableStrategyFor(type: string): PortableStrategy {
  if (PORTABLE_STRATEGY[type]) {
    return PORTABLE_STRATEGY[type];
  }
  return isWindowsOnlyActivityType(type) ? 'comment' : 'ok';
}

export function windowsOnlyReason(type: string): string {
  switch (type) {
    case 'Data.BuildDataTable':
      return 'Build Data Table is Windows-only — Studio Web Save rewrites to New DataTable + Add Data Column.';
    case 'Programming.MultipleAssign':
      return 'Multiple Assign is Windows-only — Studio Web Save expands to a Sequence of Assign activities.';
    case 'System.MessageBox':
      return 'Message Box is Windows-only — Studio Web Save rewrites to Log Message.';
    case 'System.DeleteFile':
      return 'Delete File is Windows-only in System.Activities — Studio Web Save emits a Comment placeholder.';
    case 'Excel.ExcelApplicationScope':
      return 'Excel Application Scope is classic Windows-only — use Workbook Excel activities or export as Windows.';
    case 'Python.PythonScope':
    case 'Python.LoadScript':
    case 'Python.RunScript':
    case 'Python.InvokeMethod':
    case 'Python.GetObject':
      return 'UiPath.Python.Activities is not cross-platform in the stable pack — Studio Web Save emits a Comment (use Windows export or Python 2.0 preview).';
    default:
      return `"${type}" is not available in Studio Web Portable (cross-platform) projects.`;
  }
}
