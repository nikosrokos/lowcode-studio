/** Bidirectional mapping between LowCode Studio types and UiPath XAML activity names */

export interface MappedActivity {
  lcsType: string;
  xamlLocalNames: string[];
  /** Optional XML namespace hint used when exporting */
  xamlNamespace?: 'ui' | 'uia' | 'default';
}

type Ns = 'ui' | 'uia' | 'default';

const MAP: Array<{
  lcsType: string;
  xamlLocalNames: string[];
  xamlNamespace?: Ns;
}> = [
  { lcsType: 'System.LogMessage', xamlLocalNames: ['LogMessage'], xamlNamespace: 'ui' },
  { lcsType: 'System.Delay', xamlLocalNames: ['Delay'], xamlNamespace: 'default' },
  { lcsType: 'System.Comment', xamlLocalNames: ['Comment', 'CommentOut'], xamlNamespace: 'ui' },
  { lcsType: 'Programming.Assign', xamlLocalNames: ['Assign'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.If', xamlLocalNames: ['If'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.While', xamlLocalNames: ['While'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.ForEach', xamlLocalNames: ['ForEach'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.TryCatch', xamlLocalNames: ['TryCatch'], xamlNamespace: 'default' },
  { lcsType: 'ControlFlow.Sequence', xamlLocalNames: ['Sequence'], xamlNamespace: 'default' },
  {
    lcsType: 'UI.Click',
    xamlLocalNames: ['Click', 'NClick', 'TargetAwareClick'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.TypeInto',
    xamlLocalNames: ['TypeInto', 'NTypeInto'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.GetText',
    xamlLocalNames: ['GetText', 'NGetText'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.ElementExists',
    xamlLocalNames: ['ElementExists', 'UiElementExists'],
    xamlNamespace: 'uia'
  },
  {
    lcsType: 'UI.OpenApplication',
    xamlLocalNames: ['OpenApplication', 'OpenBrowser', 'NOpenApplication', 'UseApplicationBrowser'],
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
    lcsType: 'Messaging.SendEmail',
    xamlLocalNames: ['SendMail', 'SendOutlookMail', 'SendSMTPMail'],
    xamlNamespace: 'ui'
  },
  {
    lcsType: 'Messaging.HttpRequest',
    xamlLocalNames: ['HttpClient', 'HTTPRequest'],
    xamlNamespace: 'ui'
  },
  {
    lcsType: 'REFramework.InvokeWorkflow',
    xamlLocalNames: ['InvokeWorkflowFile'],
    xamlNamespace: 'ui'
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
