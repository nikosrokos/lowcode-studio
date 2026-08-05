import {
  ActivityNode,
  WorkflowDocument,
  WorkflowVariable
} from '../models/workflow';
import { isUiActivity, xamlInfoForLcsType } from './activityMap';
import { emitTargetXaml, selectorAttribute } from './selectorRoundTrip';
import { interactionModeAttribute } from './inputMethod';
import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  applyWindowsSelectorsToActivityProps,
  netTfmForTarget,
  resolveUiPathTarget,
  UiPathTargetFramework
} from './windowsTarget';

/**
 * Best-effort XAML export for UiPath Studio Desktop (Windows) / Studio Web import.
 * Default project compatibility is **Windows** so robots run on Windows machines
 * with classic UI Automation selectors.
 */
export function exportWorkflowToXaml(doc: WorkflowDocument): string {
  const varsXml = renderVariables(doc.variables);
  const body =
    doc.type === 'Flowchart'
      ? renderFlowchart(doc)
      : renderSequence(doc.activities, doc.name, varsXml);

  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeAttr(sanitizeClass(doc.name))}" sap:VirtualizedContainerService.HintSize="1200,800" sap2010:WorkflowViewState.IdRef="Activity1" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation" xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation" xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Collections" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:uia="http://schemas.uipath.com/workflow/activities/uipath.uiautomation.next" xmlns:excel="http://schemas.uipath.com/workflow/activities/excel" xmlns:mail="http://schemas.uipath.com/workflow/activities/mail" xmlns:python="http://schemas.uipath.com/workflow/activities/python" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
${body}
</Activity>
`;
}

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidGuid(value: string | undefined): boolean {
  return Boolean(value && GUID_RE.test(value));
}

/**
 * Prefer an existing valid entry-point GUID (stable across syncs); otherwise a real UUID.
 * Never use the old pseudoUuid() — Studio Web fails to parse non-Guid uniqueId values.
 */
export function resolveEntryPointUniqueId(
  preferred?: string,
  existingProjectJsonPath?: string
): string {
  if (isValidGuid(preferred)) {
    return preferred!;
  }
  if (existingProjectJsonPath && fs.existsSync(existingProjectJsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(existingProjectJsonPath, 'utf8')) as {
        entryPoints?: Array<{ uniqueId?: string }>;
      };
      const existing = raw.entryPoints?.[0]?.uniqueId;
      if (isValidGuid(existing)) {
        return existing!;
      }
    } catch {
      // generate below
    }
  }
  return crypto.randomUUID();
}

export function exportUiPathProjectJson(options: {
  name: string;
  description?: string;
  main: string;
  projectVersion?: string;
  dependencies?: Record<string, string>;
  /** Windows (default) runs on Windows robots; Portable is cross-platform. */
  targetFramework?: UiPathTargetFramework;
  /** When true, marks the process as needing a user session (UI automation). */
  requiresUserInteraction?: boolean;
  /** Valid Guid for entryPoints[0].uniqueId — required by Studio Web. */
  entryPointUniqueId?: string;
  /** If set, reuse a valid uniqueId already present in this project.json. */
  existingProjectJsonPath?: string;
}): string {
  const main = options.main.endsWith('.xaml') ? options.main : `${options.main}.xaml`;
  const targetFramework = resolveUiPathTarget(options.targetFramework);
  const netTfm = netTfmForTarget(targetFramework);
  const requiresUserInteraction = options.requiresUserInteraction ?? true;
  const uniqueId = resolveEntryPointUniqueId(
    options.entryPointUniqueId,
    options.existingProjectJsonPath
  );
  const manifest = {
    name: options.name,
    description:
      options.description ||
      `${options.name} exported from LowCode Studio (${targetFramework})`,
    main,
    dependencies: options.dependencies || {
      'UiPath.System.Activities': '[25.4.1]',
      'UiPath.UIAutomation.Activities': '[25.4.1]'
    },
    schemaVersion: '4.0',
    studioVersion: '24.10.0.0',
    projectVersion: options.projectVersion || '1.0.0',
    runtimeOptions: {
      autoDispose: false,
      netCore: { isValid: true, targetFramework: netTfm },
      isPausable: true,
      isAttended: false,
      requiresUserInteraction,
      supportsPersistence: false,
      excludedLoggedData: ['Private:*', '*password*'],
      executionType: 'Workflow',
      readyForPiP: false,
      startsInPiP: false
    },
    designOptions: {
      projectProfile: 'Developement',
      outputType: 'Process',
      libraryOptions: {
        includeOriginalXaml: false,
        privateWorkflows: []
      },
      processOptions: { ignoredFiles: [] },
      fileInfoCollection: [],
      modernBehavior: true
    },
    expressionLanguage: 'VisualBasic',
    entryPoints: [
      {
        filePath: main,
        uniqueId,
        input: [],
        output: []
      }
    ],
    isTemplate: false,
    templateProjectData: {},
    publishData: {},
    targetFramework
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

function renderSequence(
  activities: ActivityNode[],
  displayName: string,
  varsXml: string
): string {
  const kids = activities
    .filter((a) => !shouldSkipActivityOnExport(a))
    .map((a) => renderActivity(a, 2))
    .filter(Boolean)
    .join('\n');
  return `  <Sequence DisplayName="${escapeAttr(exportDisplayName(displayName))}" sap:VirtualizedContainerService.HintSize="800,600" sap2010:WorkflowViewState.IdRef="Sequence_1">
${varsXml}${kids}
  </Sequence>`;
}

function renderFlowchart(doc: WorkflowDocument): string {
  // Export flowchart as a Sequence of invoked steps — Studio Web opens this reliably.
  // True free-form Flowchart XAML is highly view-state dependent.
  const note: ActivityNode = {
    id: 'note',
    type: 'System.Comment',
    displayName: 'Flowchart export note',
    properties: {
      text: 'Exported from LowCode Studio Flowchart as a Sequence for Studio Web compatibility.'
    }
  };
  return renderSequence([note, ...doc.activities.filter((a) => a.type !== 'Flowchart.Start' && a.type !== 'Flowchart.End')], doc.name, renderVariables(doc.variables));
}

function renderVariables(variables: WorkflowVariable[]): string {
  if (!variables.length) {
    return '';
  }
  const lines = variables.map((v) => {
    const typeArg = typeToXaml(v.type);
    const def =
      v.defaultValue === undefined || v.defaultValue === null
        ? ''
        : ` Default="${escapeAttr(formatDefault(v.defaultValue))}"`;
    return `      <Variable x:TypeArguments="${typeArg}" Name="${escapeAttr(v.name)}"${def} />`;
  });
  return `    <Sequence.Variables>
${lines.join('\n')}
    </Sequence.Variables>
`;
}

function renderActivity(activity: ActivityNode, indent: number): string {
  if (shouldSkipActivityOnExport(activity)) {
    return '';
  }
  const pad = '  '.repeat(indent);
  const info = xamlInfoForLcsType(activity.type);

  if (activity.type === 'ControlFlow.Sequence') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 1)).join('\n');
    return `${pad}<Sequence DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">\n${kids}\n${pad}</Sequence>`;
  }

  if (activity.type === 'ControlFlow.If') {
    const thenKids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    const elseKids = (activity.elseChildren || [])
      .map((c) => renderActivity(c, indent + 2))
      .join('\n');
    return `${pad}<If Condition="[${escapeAttr(String(activity.properties.condition ?? 'True'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <If.Then>
${pad}    <Sequence DisplayName="Then">
${thenKids}
${pad}    </Sequence>
${pad}  </If.Then>
${pad}  <If.Else>
${pad}    <Sequence DisplayName="Else">
${elseKids}
${pad}    </Sequence>
${pad}  </If.Else>
${pad}</If>`;
  }

  if (activity.type === 'ControlFlow.While') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<While Condition="[${escapeAttr(String(activity.properties.condition ?? 'True'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <Sequence>
${kids}
${pad}  </Sequence>
${pad}</While>`;
  }

  if (activity.type === 'ControlFlow.ForEach') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<ForEach x:TypeArguments="x:Object" Values="[${escapeAttr(String(activity.properties.values ?? 'collection'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <ActivityAction x:TypeArguments="x:Object">
${pad}    <ActivityAction.Argument>
${pad}      <DelegateInArgument x:TypeArguments="x:Object" Name="${escapeAttr(String(activity.properties.item ?? 'item'))}" />
${pad}    </ActivityAction.Argument>
${pad}    <Sequence>
${kids}
${pad}    </Sequence>
${pad}  </ActivityAction>
${pad}</ForEach>`;
  }

  if (activity.type === 'ControlFlow.TryCatch') {
    const tryKids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    const catchKids = (activity.elseChildren || [])
      .map((c) => renderActivity(c, indent + 3))
      .join('\n');
    return `${pad}<TryCatch DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <TryCatch.Try>
${pad}    <Sequence>
${tryKids}
${pad}    </Sequence>
${pad}  </TryCatch.Try>
${pad}  <TryCatch.Catches>
${pad}    <Catch x:TypeArguments="s:Exception" xmlns:s="clr-namespace:System;assembly=System.Private.CoreLib">
${pad}      <ActivityAction x:TypeArguments="s:Exception">
${pad}        <ActivityAction.Argument>
${pad}          <DelegateInArgument x:TypeArguments="s:Exception" Name="exception" />
${pad}        </ActivityAction.Argument>
${pad}        <Sequence>
${catchKids}
${pad}        </Sequence>
${pad}      </ActivityAction>
${pad}    </Catch>
${pad}  </TryCatch.Catches>
${pad}</TryCatch>`;
  }

  if (activity.type === 'Programming.Assign') {
    return `${pad}<Assign DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <Assign.To>
${pad}    <OutArgument x:TypeArguments="x:Object">[${escapeAttr(String(activity.properties.to ?? 'variable'))}]</OutArgument>
${pad}  </Assign.To>
${pad}  <Assign.Value>
${pad}    <InArgument x:TypeArguments="x:Object">[${escapeAttr(String(activity.properties.value ?? '""'))}]</InArgument>
${pad}  </Assign.Value>
${pad}</Assign>`;
  }

  if (activity.type === 'Programming.MultipleAssign') {
    const lines = String(activity.properties.assignments || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const assigns = lines
      .map((line) => {
        const eq = line.indexOf('=');
        const to = eq >= 0 ? line.slice(0, eq).trim() : line;
        const value = eq >= 0 ? line.slice(eq + 1).trim() : '""';
        return `${pad}  <Assign>
${pad}    <Assign.To><OutArgument x:TypeArguments="x:Object">[${escapeAttr(to)}]</OutArgument></Assign.To>
${pad}    <Assign.Value><InArgument x:TypeArguments="x:Object">[${escapeAttr(value)}]</InArgument></Assign.Value>
${pad}  </Assign>`;
      })
      .join('\n');
    return `${pad}<ui:MultipleAssign DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <ui:MultipleAssign.Assignments>
${assigns || `${pad}  <Assign />`}
${pad}  </ui:MultipleAssign.Assignments>
${pad}</ui:MultipleAssign>`;
  }

  if (activity.type === 'Programming.InvokeCode') {
    const lang = String(activity.properties.language || 'CSharp');
    return `${pad}<ui:InvokeCode DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Language="${escapeAttr(lang)}" Code="${escapeAttr(String(activity.properties.code || ''))}" />`;
  }

  if (activity.type === 'System.Throw') {
    return `${pad}<Throw DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Exception="[${escapeAttr(String(activity.properties.message ?? '\"Error\"'))}]" />`;
  }

  if (activity.type === 'System.TerminateWorkflow') {
    return `${pad}<ui:TerminateWorkflow DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Reason="[${escapeAttr(String(activity.properties.reason ?? '\"Terminated\"'))}]" />`;
  }

  if (activity.type === 'ControlFlow.Switch') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<Switch x:TypeArguments="x:String" Expression="[${escapeAttr(String(activity.properties.expression ?? 'status'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <Switch.Default>
${pad}    <Sequence>
${kids}
${pad}    </Sequence>
${pad}  </Switch.Default>
${pad}</Switch>`;
  }

  if (activity.type === 'Data.ForEachRow') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<ui:ForEachRow DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <ui:ForEachRow.Body>
${pad}    <ActivityAction x:TypeArguments="s:DataRow" xmlns:s="clr-namespace:System.Data;assembly=System.Data.Common">
${pad}      <ActivityAction.Argument>
${pad}        <DelegateInArgument x:TypeArguments="s:DataRow" Name="${escapeAttr(String(activity.properties.row || 'row'))}" />
${pad}      </ActivityAction.Argument>
${pad}      <Sequence>
${kids}
${pad}      </Sequence>
${pad}    </ActivityAction>
${pad}  </ui:ForEachRow.Body>
${pad}</ui:ForEachRow>`;
  }

  if (activity.type === 'Data.AddDataRow') {
    return `${pad}<ui:AddDataRow DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" ArrayRow="[${escapeAttr(String(activity.properties.arrayRow || '[]'))}]" />`;
  }

  if (activity.type === 'Data.AddDataColumn') {
    return `${pad}<ui:AddDataColumn DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" ColumnName="${escapeAttr(String(activity.properties.columnName || 'NewColumn'))}" />`;
  }

  if (activity.type === 'Data.FilterDataTable') {
    return `${pad}<ui:FilterDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" FilterRowsDataTable="[${escapeAttr(String(activity.properties.result || 'filteredDt'))}]" />`;
  }

  if (activity.type === 'Data.ClearDataTable') {
    return `${pad}<ui:ClearDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" />`;
  }

  if (activity.type === 'Data.OutputDataTable') {
    return `${pad}<ui:OutputDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" Text="[${escapeAttr(String(activity.properties.result || 'tableText'))}]" />`;
  }

  if (activity.type === 'Messaging.DeserializeJson') {
    return `${pad}<ui:DeserializeJson DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" JsonString="[${escapeAttr(String(activity.properties.jsonString ?? '\"{}\"'))}]" />`;
  }

  if (activity.type === 'Messaging.SerializeJson') {
    return `${pad}<ui:SerializeJson DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" JsonObject="[${escapeAttr(String(activity.properties.value || 'jsonObj'))}]" />`;
  }

  if (activity.type === 'System.LogMessage') {
    // Studio Web expects Level="Info" (enum member name). Desktop sometimes wrote
    // Level="TraceLevel.Info", which Studio Web rejects: Failed to create a 'Level'…
    const level = normalizeLogLevel(activity.properties.level);
    const messageExpr = toVbStringArgument(activity.properties.message);
    return `${pad}<ui:LogMessage DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Level="${escapeAttr(level)}" Message="[${escapeAttr(messageExpr)}]" />`;
  }

  if (activity.type === 'System.Delay') {
    const ms = Number(activity.properties.durationMs ?? 1000);
    const ts = msToTimeSpan(ms);
    return `${pad}<Delay DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Duration="${ts}" />`;
  }

  if (activity.type === 'REFramework.InvokeWorkflow') {
    const path = String(activity.properties.workflowPath || 'Workflow.xaml').replace(
      /\.lcs\.json$/i,
      '.xaml'
    );
    return `${pad}<ui:InvokeWorkflowFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkflowFileName="${escapeAttr(path)}" />`;
  }

  if (activity.type === 'System.MessageBox') {
    return `${pad}<ui:MessageBox DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="[${escapeAttr(toVbStringArgument(activity.properties.text))}]" Caption="${escapeAttr(String(activity.properties.title || 'LowCode Studio'))}" />`;
  }

  if (activity.type === 'System.WriteLine') {
    return `${pad}<WriteLine DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="[${escapeAttr(toVbStringArgument(activity.properties.text))}]" />`;
  }

  if (activity.type === 'ControlFlow.DoWhile') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<DoWhile Condition="[${escapeAttr(String(activity.properties.condition ?? 'True'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <Sequence>
${kids}
${pad}  </Sequence>
${pad}</DoWhile>`;
  }

  if (activity.type === 'ControlFlow.RetryScope') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<ui:RetryScope DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" NumberOfRetries="${Number(activity.properties.numberOfRetries ?? 3)}">
${pad}  <ui:RetryScope.Activity>
${pad}    <ActivityAction>
${pad}      <Sequence>
${kids}
${pad}      </Sequence>
${pad}    </ActivityAction>
${pad}  </ui:RetryScope.Activity>
${pad}</ui:RetryScope>`;
  }

  if (activity.type === 'ControlFlow.Break') {
    return `${pad}<Break DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" />`;
  }

  if (activity.type === 'UI.UseApplicationBrowser') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 1)).join('\n');
    const props = applyWindowsSelectorsToActivityProps(activity.properties || {});
    const url = escapeAttr(String(props.urlOrPath || 'https://example.com'));
    const mode = String(props.mode || 'Browser');
    const browser = escapeAttr(String(props.browserType || 'Chrome'));
    const open = escapeAttr(String(props.open || 'IfNotOpen'));
    const close = escapeAttr(String(props.close || 'Never'));
    const selAttr = selectorAttribute(props);
    const inputAttr = interactionModeAttribute(props, 'Simulate');
    return `${pad}<uia:NApplicationCard DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Url="${url}" OpenMode="${open}" CloseMode="${close}" BrowserType="${browser}" AttachMode="${mode === 'Application' ? 'Application' : 'Browser'}"${inputAttr}${selAttr}>
${pad}  <uia:NApplicationCard.Body>
${pad}    <Sequence>
${kids}
${pad}    </Sequence>
${pad}  </uia:NApplicationCard.Body>
${pad}</uia:NApplicationCard>`;
  }

  if (isUiActivity(activity.type)) {
    if (activity.type === 'UI.ExtractTableData') {
      return renderExtractTableData(activity, pad);
    }
    return renderUiActivity(activity, pad, indent);
  }

  if (activity.type.startsWith('Excel.')) {
    return renderExcelActivity(activity, pad);
  }

  if (activity.type === 'Messaging.SendEmail') {
    return `${pad}<mail:SendMail DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" To="${escapeAttr(String(activity.properties.to || ''))}" Subject="[${escapeAttr(String(activity.properties.subject ?? '""'))}]" Body="${escapeAttr(String(activity.properties.body || ''))}" />`;
  }

  if (activity.type === 'Messaging.HttpRequest') {
    return `${pad}<ui:HttpClient DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Method="${escapeAttr(String(activity.properties.method || 'GET'))}" EndPoint="[${escapeAttr(String(activity.properties.url || '""'))}]" />`;
  }

  if (activity.type.startsWith('Python.')) {
    return renderPythonActivity(activity, pad, indent);
  }

  if (activity.type === 'System.Comment' || activity.type.startsWith('Imported.') || activity.type.startsWith('Flowchart.')) {
    // Preserve selector on imported placeholders when present
    const sel = selectorAttribute(activity.properties);
    return `${pad}<ui:Comment DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="${escapeAttr(String(activity.properties.text || activity.properties.hint || activity.type))}"${sel} />`;
  }

  if (info) {
    const tag =
      info.ns === 'ui'
        ? `ui:${info.localName}`
        : info.ns === 'uia'
          ? `uia:${info.localName}`
          : info.ns === 'excel'
            ? `excel:${info.localName}`
            : info.ns === 'mail'
              ? `mail:${info.localName}`
              : info.ns === 'python'
                ? `python:${info.localName}`
                : info.localName;
    return `${pad}<${tag} DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" />`;
  }

  return `${pad}<ui:Comment DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="${escapeAttr('Exported placeholder for ' + activity.type)}" />`;
}

function renderPythonActivity(activity: ActivityNode, pad: string, indent: number): string {
  switch (activity.type) {
    case 'Python.PythonScope': {
      const kids = (activity.children || []).map((c) => renderActivity(c, indent + 1)).join('\n');
      return `${pad}<python:PythonScope DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Path="${escapeAttr(String(activity.properties.path || ''))}" Target="${escapeAttr(String(activity.properties.target || 'x64'))}" WorkingFolder="${escapeAttr(String(activity.properties.workingFolder || ''))}" Version="${escapeAttr(String(activity.properties.version || ''))}">
${kids}
${pad}</python:PythonScope>`;
    }
    case 'Python.LoadScript':
      return `${pad}<python:LoadScript DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" File="${escapeAttr(String(activity.properties.file || ''))}" Code="${escapeAttr(String(activity.properties.code || ''))}" />`;
    case 'Python.RunScript':
      return `${pad}<python:RunScript DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" File="${escapeAttr(String(activity.properties.file || ''))}" Code="${escapeAttr(String(activity.properties.code || ''))}" />`;
    case 'Python.InvokeMethod':
      return `${pad}<python:InvokeMethod DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Name="${escapeAttr(String(activity.properties.name || 'main'))}" Instance="[${escapeAttr(String(activity.properties.instance || 'pythonScript'))}]" />`;
    case 'Python.GetObject':
      return `${pad}<python:GetObject DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Type="{x:Type ${escapeAttr(String(activity.properties.type || 'String'))}}" />`;
    default:
      return `${pad}<ui:Comment DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="Python placeholder" />`;
  }
}

function renderExtractTableData(activity: ActivityNode, pad: string): string {
  const props = applyWindowsSelectorsToActivityProps(activity.properties || {});
  const selAttr = selectorAttribute(props);
  const target = emitTargetXaml(props, pad + '  ');
  const result = escapeAttr(String(props.result || 'extractedTable'));
  const includeHeaders = props.includeHeaders === false || props.includeHeaders === 'false' ? 'False' : 'True';
  const maxResults = Number(props.maxResults ?? 100);
  const smart =
    props.smartExtraction === false || props.smartExtraction === 'false' ? 'False' : 'True';
  const meta = escapeAttr(String(props.extractionMetadata || ''));
  const attrs = [
    `DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}"`,
    selAttr.trim(),
    `ExtractMetadata="${meta}"`,
    `IncludeHeaders="${includeHeaders}"`,
    `MaxNumberOfResults="${maxResults}"`,
    `SmartExtraction="${smart}"`,
    `DataTable="[${result}]"`
  ]
    .filter(Boolean)
    .join(' ');

  if (!target) {
    return `${pad}<uia:ExtractTableData ${attrs} />`;
  }
  return `${pad}<uia:ExtractTableData ${attrs}>
${target}
${pad}</uia:ExtractTableData>`;
}

function renderUiActivity(activity: ActivityNode, pad: string, indent: number): string {
  const props = applyWindowsSelectorsToActivityProps(activity.properties || {});
  const selAttr = selectorAttribute(props);
  const target = emitTargetXaml(props, pad + '  ');
  const open =
    activity.type === 'UI.Click'
      ? 'uia:NClick'
      : activity.type === 'UI.TypeInto'
        ? 'uia:NTypeInto'
        : activity.type === 'UI.GetText'
          ? 'uia:NGetText'
          : activity.type === 'UI.ElementExists'
            ? 'uia:ElementExists'
            : activity.type === 'UI.Check'
              ? 'uia:NCheck'
              : activity.type === 'UI.Hover'
                ? 'uia:NHover'
                : activity.type === 'UI.SelectItem'
                  ? 'uia:NSelectItem'
                  : activity.type === 'UI.TakeScreenshot'
                    ? 'uia:NTakeScreenshot'
                    : activity.type === 'UI.OpenApplication'
                      ? 'uia:NOpenApplication'
                      : 'uia:NClick';

  const extra: string[] = [];
  if (activity.type === 'UI.Click') {
    const clickType = String(props.clickType || 'Single');
    extra.push(`ClickType="${escapeAttr(clickType)}"`);
    if (clickType === 'Right') {
      extra.push(`MouseButton="Right"`);
    } else {
      extra.push(`MouseButton="Left"`);
    }
  }
  if (activity.type === 'UI.TypeInto') {
    extra.push(`Text="[${escapeAttr(toVbStringArgument(props.text))}]"`);
    if (props.emptyField !== false && props.emptyField !== 'false') {
      extra.push(`EmptyField="True"`);
    } else {
      extra.push(`EmptyField="False"`);
    }
  }
  if (activity.type === 'UI.SelectItem') {
    extra.push(`Item="[${escapeAttr(String(props.item ?? '""'))}]"`);
  }
  if (activity.type === 'UI.OpenApplication') {
    extra.push(`Url="${escapeAttr(String(props.pathOrUrl || ''))}"`);
  }
  if (activity.type === 'UI.TakeScreenshot') {
    extra.push(`FileName="${escapeAttr(String(props.filePath || 'screenshot.png'))}"`);
  }
  if (activity.type === 'UI.Check') {
    extra.push(`Action="${escapeAttr(String(props.action || 'Check'))}"`);
  }
  if (activity.type === 'UI.GetAttribute') {
    extra.push(`Attribute="${escapeAttr(String(props.attribute || 'aaname'))}"`);
  }
  if (activity.type === 'UI.WaitElement') {
    extra.push(`TimeoutMS="${Number(props.timeoutMs ?? 30000)}"`);
  }

  const supportsInputMethod =
    activity.type === 'UI.Click' ||
    activity.type === 'UI.TypeInto' ||
    activity.type === 'UI.Hover' ||
    activity.type === 'UI.Check' ||
    activity.type === 'UI.SelectItem';
  if (supportsInputMethod) {
    const fallback =
      activity.type === 'UI.Click' || activity.type === 'UI.TypeInto'
        ? 'Simulate'
        : 'Same as App/Browser';
    const inputAttr = interactionModeAttribute(props, fallback).trim();
    if (inputAttr) {
      extra.push(inputAttr);
    }
  }

  const openTag =
    activity.type === 'UI.GetAttribute'
      ? 'uia:NGetAttribute'
      : activity.type === 'UI.WaitElement'
        ? props.action === 'Vanish'
          ? 'uia:WaitElementVanish'
          : 'uia:OnElementAppear'
        : open;

  const attrs = [
    `DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}"`,
    selAttr.trim(),
    ...extra
  ]
    .filter(Boolean)
    .join(' ');

  if (!target) {
    return `${pad}<${openTag} ${attrs} />`;
  }

  const kids = (activity.children || []).map((c) => renderActivity(c, indent + 1)).join('\n');
  if (kids) {
    return `${pad}<${openTag} ${attrs}>
${target}
${kids}
${pad}</${openTag}>`;
  }
  return `${pad}<${openTag} ${attrs}>
${target}
${pad}</${openTag}>`;
}

function renderExcelActivity(activity: ActivityNode, pad: string): string {
  const path = escapeAttr(String(activity.properties.workbookPath || 'data.xlsx'));
  const sheet = escapeAttr(String(activity.properties.sheetName || 'Sheet1'));
  const range = escapeAttr(String(activity.properties.range || ''));
  const cell = escapeAttr(String(activity.properties.cell || 'A1'));
  switch (activity.type) {
    case 'Excel.ReadRange':
      return `${pad}<excel:ReadRange DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" SheetName="${sheet}" Range="${range}" />`;
    case 'Excel.WriteRange':
      return `${pad}<excel:WriteRange DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" SheetName="${sheet}" DataTable="[${escapeAttr(String(activity.properties.data || 'dt'))}]" />`;
    case 'Excel.ReadCell':
      return `${pad}<excel:ReadCell DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" SheetName="${sheet}" Cell="${cell}" />`;
    case 'Excel.WriteCell':
      return `${pad}<excel:WriteCell DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" SheetName="${sheet}" Cell="${cell}" Value="[${escapeAttr(String(activity.properties.value ?? '""'))}]" />`;
    default:
      return `${pad}<ui:Comment DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="Excel placeholder" />`;
  }
}

function typeToXaml(type: string): string {
  switch (type) {
    case 'Int32':
      return 'x:Int32';
    case 'Boolean':
      return 'x:Boolean';
    case 'Double':
      return 'x:Double';
    case 'String':
      return 'x:String';
    default:
      return 'x:Object';
  }
}

function formatDefault(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  return String(value);
}

function msToTimeSpan(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function sanitizeClass(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `Workflow_${cleaned}`;
}

/** UiPath LogMessage Level enum member names accepted by Studio Web. */
const LOG_LEVELS = new Set(['Trace', 'Info', 'Warn', 'Error', 'Fatal']);

export function normalizeLogLevel(value: unknown): string {
  let raw = String(value ?? 'Info').trim();
  raw = raw.replace(/^TraceLevel\./i, '').replace(/^LogLevel\./i, '');
  if (!raw) {
    return 'Info';
  }
  // Normalize common aliases
  const lower = raw.toLowerCase();
  const alias: Record<string, string> = {
    information: 'Info',
    info: 'Info',
    warning: 'Warn',
    warn: 'Warn',
    trace: 'Trace',
    error: 'Error',
    fatal: 'Fatal',
    critical: 'Fatal'
  };
  const mapped = alias[lower] || raw;
  // Preserve canonical casing when already valid
  for (const level of LOG_LEVELS) {
    if (level.toLowerCase() === mapped.toLowerCase()) {
      return level;
    }
  }
  return 'Info';
}

/** Strip LCS import suffix before writing DisplayName to Studio Web XAML. */
export function exportDisplayName(name: string | undefined): string {
  const raw = String(name || '').trim();
  return raw.replace(/\s*\(imported\)\s*$/i, '').trim() || raw || 'Activity';
}

/**
 * Studio Web triggers (Manual Trigger, etc.) must not be re-emitted as Comment
 * placeholders — they break / clutter Main.xaml. Skip on export.
 */
export function shouldSkipActivityOnExport(activity: ActivityNode): boolean {
  const type = activity.type || '';
  const bareType = type.replace(/^Imported\./i, '');
  const label = exportDisplayName(activity.displayName);
  if (/Trigger$/i.test(bareType)) {
    return true;
  }
  if (/trigger/i.test(label) && (type.startsWith('Imported.') || type === 'System.Comment')) {
    return true;
  }
  if (/^Manual\s*Trigger$/i.test(label)) {
    return true;
  }
  // Flowchart chrome nodes are handled separately; never emit as comments
  if (type === 'Flowchart.Start' || type === 'Flowchart.End') {
    return true;
  }
  return false;
}

/**
 * Build the VB expression fragment for a string InArgument (content inside [...]).
 * Designer stores plain text like `12` or `"12"`; XAML needs `"12"` so Studio Web
 * shows the string 12 — not `[12]` (number) or `[["12"]]` (double-wrapped).
 */
export function toVbStringArgument(value: unknown): string {
  let text = value == null ? '' : String(value).trim();
  if (!text) {
    return '""';
  }

  // Explicit expression from designer: [message] or ["12"] or [["12"]]
  if (text.startsWith('[') && text.endsWith(']') && text.length >= 2) {
    let inner = text.slice(1, -1).trim();
    while (inner.startsWith('[') && inner.endsWith(']') && inner.length >= 2) {
      inner = inner.slice(1, -1).trim();
    }
    if (inner.length >= 2 && inner.startsWith('"') && inner.endsWith('"')) {
      return inner;
    }
    if (inner.length >= 2 && inner.startsWith("'") && inner.endsWith("'")) {
      return `"${inner.slice(1, -1).replace(/"/g, '""')}"`;
    }
    return inner || '""';
  }

  // Already a string literal
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text;
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return `"${text.slice(1, -1).replace(/"/g, '""')}"`;
  }

  // Plain designer text (including numbers and words like Starting) → VB string literal
  return `"${text.replace(/"/g, '""')}"`;
}

/** Inverse for import: store plain designer text, not VB wrappers. */
export function fromVbStringArgument(value: unknown): string {
  let text = value == null ? '' : String(value).trim();
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  while (text.startsWith('[') && text.endsWith(']') && text.length >= 2) {
    text = text.slice(1, -1).trim();
  }
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/""/g, '"');
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1);
  }
  return text;
}

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

