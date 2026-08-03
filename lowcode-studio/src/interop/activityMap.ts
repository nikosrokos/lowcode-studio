/** Bidirectional mapping between LowCode Studio types and UiPath XAML activity names */

export interface MappedActivity {
  lcsType: string;
  xamlLocalNames: string[];
  /** Optional XML namespace hint used when exporting */
  xamlNamespace?: 'ui' | 'uia' | 'excel' | 'mail' | 'python' | 'default';
}

type Ns = 'ui' | 'uia' | 'excel' | 'mail' | 'python' | 'default';

const MAP: Array<{
  lcsType: string;
  xamlLocalNames: string[];
  xamlNamespace?: Ns;
}> = [
  { lcsType: 'System.LogMessage', xamlLocalNames: ['LogMessage'], xamlNamespace: 'ui' },
  { lcsType: 'System.Delay', xamlLocalNames: ['Delay'], xamlNamespace: 'default' },
  { lcsType: 'System.Comment', xamlLocalNames: ['Comment', 'CommentOut'], xamlNamespace: 'ui' },
  {
    lcsType: 'System.MessageBox',
    xamlLocalNames: ['MessageBox'],
    xamlNamespace: 'ui'
  },
  {
    lcsType: 'System.WriteLine',
    xamlLocalNames: ['WriteLine'],
    xamlNamespace: 'default'
  },
  { lcsType: 'Programming.Assign', xamlLocalNames: ['Assign'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.If', xamlLocalNames: ['If'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.While', xamlLocalNames: ['While'], xamlNamespace: 'default' },
  {
    lcsType: 'ControlFlow.DoWhile',
    xamlLocalNames: ['DoWhile'],
    xamlNamespace: 'default'
  },
  { lcsType: 'ControlFlow.ForEach', xamlLocalNames: ['ForEach'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.TryCatch', xamlLocalNames: ['TryCatch'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.Sequence', xamlLocalNames: ['Sequence'], xamlNamespace: 'default' },
  {
    lcsType: 'ControlFlow.RetryScope',
    xamlLocalNames: ['RetryScope'],
    xamlNamespace: 'ui'
  },
  {
    lcsType: 'ControlFlow.Break',
    xamlLocalNames: ['Break'],
    xamlNamespace: 'default'
  },
  {
    lcsType: 'UI.Click',
    xamlLocalNames: ['Click', 'NClick', 'TargetAwareClick', 'ClickImage'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.TypeInto',
    xamlLocalNames: ['TypeInto', 'NTypeInto', 'TypeSecureText'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.GetText',
    xamlLocalNames: ['GetText', 'NGetText', 'GetFullText', 'GetVisibleText'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.ElementExists',
    xamlLocalNames: ['ElementExists', 'UiElementExists', 'CheckAppState'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.Check',
    xamlLocalNames: ['Check', 'NCheck', 'CheckState'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.Hover',
    xamlLocalNames: ['Hover', 'NHover'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.SelectItem',
    xamlLocalNames: ['SelectItem', 'NSelectItem'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.TakeScreenshot',
    xamlLocalNames: ['TakeScreenshot', 'NTakeScreenshot'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.OpenApplication',
    xamlLocalNames: [
      'OpenApplication',
      'OpenBrowser',
      'NOpenApplication',
      'UseApplicationBrowser',
      'NApplicationCard'
    ],
    xamlNamespace: 'uia'
  },
  { lcsType: 'Data.ReadCsv', xamlLocalNames: ['ReadCsvFile', 'ReadCSV'], xamlNamespace: 'ui' },
  { lcsType: 'Data.WriteCsv', xamlLocalNames: ['WriteCsvFile', 'WriteCSV'], xamlNamespace: 'ui' },
  {
    lcsType: 'Data.BuildDataTable',
    xamlLocalNames: ['BuildDataTable'],
    xamlNamespace: 'ui'
  },
  {
    lcsType: 'Excel.ReadRange',
    xamlLocalNames: ['ReadRange', 'ReadRangeX', 'ExcelReadRange'],
    xamlNamespace: 'excel'
  },
  {
    lcsType: 'Excel.WriteRange',
    xamlLocalNames: ['WriteRange', 'WriteRangeX', 'ExcelWriteRange'],
    xamlNamespace: 'excel'
  },
  {
    lcsType: 'Excel.ReadCell',
    xamlLocalNames: ['ReadCell', 'ReadCellX'],
    xamlNamespace: 'excel'
  },
  {
    lcsType: 'Excel.WriteCell',
    xamlLocalNames: ['WriteCell', 'WriteCellX'],
    xamlNamespace: 'excel'
  },
  {
    lcsType: 'Messaging.SendEmail',
    xamlLocalNames: [
      'SendMail',
      'SendOutlookMail',
      'SendSMTPMail',
      'SendMailX',
      'SendEmail'
    ],
    xamlNamespace: 'mail'
  },
  {
    lcsType: 'Messaging.HttpRequest',
    xamlLocalNames: ['HttpClient', 'HTTPRequest', 'HttpRequest', 'DeserializedHttpRequest'],
    xamlNamespace: 'ui'
  },
  {
    lcsType: 'REFramework.InvokeWorkflow',
    xamlLocalNames: ['InvokeWorkflowFile'],
    xamlNamespace: 'ui'
  },
  {
    lcsType: 'Python.PythonScope',
    xamlLocalNames: ['PythonScope'],
    xamlNamespace: 'python'
  },
  {
    lcsType: 'Python.LoadScript',
    xamlLocalNames: ['LoadScript', 'LoadPythonScript'],
    xamlNamespace: 'python'
  },
  {
    lcsType: 'Python.RunScript',
    xamlLocalNames: ['RunScript', 'RunPythonScript'],
    xamlNamespace: 'python'
  },
  {
    lcsType: 'Python.InvokeMethod',
    // Prefer unambiguous name on export; import also accepts InvokeMethod when Instance is present
    xamlLocalNames: ['InvokePythonMethod', 'InvokeMethod'],
    xamlNamespace: 'python'
  },
  {
    lcsType: 'Python.GetObject',
    xamlLocalNames: ['GetPythonObject', 'GetObject'],
    xamlNamespace: 'python'
  },
  {
    lcsType: 'Flowchart.FlowDecision',
    xamlLocalNames: ['FlowDecision'],
    xamlNamespace: 'default'
  },
  { lcsType: 'Flowchart.Start', xamlLocalNames: ['Flowchart'], xamlNamespace: 'default' }
];

export function lcsTypeFromXamlName(localName: string): string | undefined {
  const bare = localName.includes(':') ? localName.split(':').pop()! : localName;
  for (const row of MAP) {
    if (row.xamlLocalNames.some((n) => n.toLowerCase() === bare.toLowerCase())) {
      return row.lcsType;
    }
  }
  return undefined;
}

export function xamlInfoForLcsType(
  lcsType: string
): { localName: string; ns: Ns } | undefined {
  const row = MAP.find((m) => m.lcsType === lcsType);
  if (!row) {
    return undefined;
  }
  return {
    localName: row.xamlLocalNames[0],
    ns: row.xamlNamespace || 'default'
  };
}

export function unknownActivityType(localName: string): string {
  const bare = localName.includes(':') ? localName.split(':').pop()! : localName;
  return `Imported.${bare}`;
}

export function isUiActivity(lcsType: string): boolean {
  return lcsType.startsWith('UI.');
}
