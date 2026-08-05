/**
 * Studio Web Local Workspace syncs as Portable (cross-platform).
 * Some UiPath activities exist only for Windows / Windows-Legacy and show
 * "The activity is either missing or could not be loaded properly" in Studio Web.
 *
 * Sources: UiPath System / UI Automation project-compatibility docs.
 */

/** LCS activity types that are NOT available in cross-platform (Portable) projects. */
export const WINDOWS_ONLY_ACTIVITY_TYPES = new Set<string>([
  'Data.BuildDataTable',
  'Programming.MultipleAssign',
  'System.MessageBox',
  // Classic Excel Application Scope is Windows-oriented; modern Excel may differ
  'Excel.ExcelApplicationScope'
]);

export function isWindowsOnlyActivityType(type: string): boolean {
  return WINDOWS_ONLY_ACTIVITY_TYPES.has(type);
}

export function windowsOnlyReason(type: string): string {
  switch (type) {
    case 'Data.BuildDataTable':
      return 'Build Data Table is Windows-only — Studio Web (Portable) cannot load it. Export rewrites it to New DataTable + Add Data Column.';
    case 'Programming.MultipleAssign':
      return 'Multiple Assign is Windows-only — prefer single Assign activities for Studio Web.';
    case 'System.MessageBox':
      return 'Message Box is Windows-only — not available in Studio Web Portable projects.';
    case 'Excel.ExcelApplicationScope':
      return 'Excel Application Scope is not cross-platform — use Excel activities Studio Web supports, or export as Windows.';
    default:
      return `"${type}" is not available in Studio Web Portable (cross-platform) projects.`;
  }
}
