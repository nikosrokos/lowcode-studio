import {
  ActivityNode,
  WorkflowDocument,
  WorkflowVariable
} from '../models/workflow';
import { isUiActivity, xamlInfoForLcsType } from './activityMap';
import { emitTargetXaml, selectorAttribute } from './selectorRoundTrip';

/**
 * Best-effort XAML export for Studio Web / Studio Desktop (Portable-friendly subset).
 * Not every LCS activity has a perfect UiPath twin — unknowns become Comments.
 */
export function exportWorkflowToXaml(doc: WorkflowDocument): string {
  const varsXml = renderVariables(doc.variables);
  const body =
    doc.type === 'Flowchart'
      ? renderFlowchart(doc)
      : renderSequence(doc.activities, doc.name, varsXml);

  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sapc" x:Class="${escapeAttr(sanitizeClass(doc.name))}" sap:VirtualizedContainerService.HintSize="1200,800" sap2010:WorkflowViewState.IdRef="Activity1" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation" xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation" xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Collections" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:uia="http://schemas.uipath.com/workflow/activities/uipath.uiautomation.next" xmlns:excel="http://schemas.uipath.com/workflow/activities/excel" xmlns:mail="http://schemas.uipath.com/workflow/activities/mail" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
${body}
</Activity>
`;
}

export function exportUiPathProjectJson(options: {
  name: string;
  description?: string;
  main: string;
  projectVersion?: string;
  dependencies?: Record<string, string>;
}): string {
  const main = options.main.endsWith('.xaml') ? options.main : `${options.main}.xaml`;
  const manifest = {
    name: options.name,
    description: options.description || `${options.name} exported from LowCode Studio`,
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
      netCore: { isValid: true, targetFramework: 'net6.0' },
      isPausable: true,
      isAttended: false,
      requiresUserInteraction: false,
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
        uniqueId: pseudoUuid(options.name),
        input: [],
        output: []
      }
    ],
    isTemplate: false,
    templateProjectData: {},
    publishData: {},
    targetFramework: 'Portable'
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

function renderSequence(
  activities: ActivityNode[],
  displayName: string,
  varsXml: string
): string {
  const kids = activities.map((a) => renderActivity(a, 2)).join('\n');
  return `  <Sequence DisplayName="${escapeAttr(displayName)}" sap:VirtualizedContainerService.HintSize="800,600" sap2010:WorkflowViewState.IdRef="Sequence_1">
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
  const pad = '  '.repeat(indent);
  const info = xamlInfoForLcsType(activity.type);

  if (activity.type === 'ControlFlow.Sequence') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 1)).join('\n');
    return `${pad}<Sequence DisplayName="${escapeAttr(activity.displayName)}">\n${kids}\n${pad}</Sequence>`;
  }

  if (activity.type === 'ControlFlow.If') {
    const thenKids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    const elseKids = (activity.elseChildren || [])
      .map((c) => renderActivity(c, indent + 2))
      .join('\n');
    return `${pad}<If Condition="[${escapeAttr(String(activity.properties.condition ?? 'True'))}]" DisplayName="${escapeAttr(activity.displayName)}">
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
    return `${pad}<While Condition="[${escapeAttr(String(activity.properties.condition ?? 'True'))}]" DisplayName="${escapeAttr(activity.displayName)}">
${pad}  <Sequence>
${kids}
${pad}  </Sequence>
${pad}</While>`;
  }

  if (activity.type === 'ControlFlow.ForEach') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<ForEach x:TypeArguments="x:Object" Values="[${escapeAttr(String(activity.properties.values ?? 'collection'))}]" DisplayName="${escapeAttr(activity.displayName)}">
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
    return `${pad}<TryCatch DisplayName="${escapeAttr(activity.displayName)}">
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
    return `${pad}<Assign DisplayName="${escapeAttr(activity.displayName)}">
${pad}  <Assign.To>
${pad}    <OutArgument x:TypeArguments="x:Object">[${escapeAttr(String(activity.properties.to ?? 'variable'))}]</OutArgument>
${pad}  </Assign.To>
${pad}  <Assign.Value>
${pad}    <InArgument x:TypeArguments="x:Object">[${escapeAttr(String(activity.properties.value ?? '""'))}]</InArgument>
${pad}  </Assign.Value>
${pad}</Assign>`;
  }

  if (activity.type === 'System.LogMessage') {
    return `${pad}<ui:LogMessage DisplayName="${escapeAttr(activity.displayName)}" Level="TraceLevel.${escapeAttr(String(activity.properties.level || 'Info'))}" Message="[${escapeAttr(String(activity.properties.message ?? '""'))}]" />`;
  }

  if (activity.type === 'System.Delay') {
    const ms = Number(activity.properties.durationMs ?? 1000);
    const ts = msToTimeSpan(ms);
    return `${pad}<Delay DisplayName="${escapeAttr(activity.displayName)}" Duration="${ts}" />`;
  }

  if (activity.type === 'REFramework.InvokeWorkflow') {
    const path = String(activity.properties.workflowPath || 'Workflow.xaml').replace(
      /\.lcs\.json$/i,
      '.xaml'
    );
    return `${pad}<ui:InvokeWorkflowFile DisplayName="${escapeAttr(activity.displayName)}" WorkflowFileName="${escapeAttr(path)}" />`;
  }

  if (activity.type === 'System.MessageBox') {
    return `${pad}<ui:MessageBox DisplayName="${escapeAttr(activity.displayName)}" Text="[${escapeAttr(String(activity.properties.text ?? '""'))}]" Caption="${escapeAttr(String(activity.properties.title || 'LowCode Studio'))}" />`;
  }

  if (activity.type === 'System.WriteLine') {
    return `${pad}<WriteLine DisplayName="${escapeAttr(activity.displayName)}" Text="[${escapeAttr(String(activity.properties.text ?? '""'))}]" />`;
  }

  if (activity.type === 'ControlFlow.DoWhile') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<DoWhile Condition="[${escapeAttr(String(activity.properties.condition ?? 'True'))}]" DisplayName="${escapeAttr(activity.displayName)}">
${pad}  <Sequence>
${kids}
${pad}  </Sequence>
${pad}</DoWhile>`;
  }

  if (activity.type === 'ControlFlow.RetryScope') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<ui:RetryScope DisplayName="${escapeAttr(activity.displayName)}" NumberOfRetries="${Number(activity.properties.numberOfRetries ?? 3)}">
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
    return `${pad}<Break DisplayName="${escapeAttr(activity.displayName)}" />`;
  }

  if (isUiActivity(activity.type)) {
    return renderUiActivity(activity, pad, indent);
  }

  if (activity.type.startsWith('Excel.')) {
    return renderExcelActivity(activity, pad);
  }

  if (activity.type === 'Messaging.SendEmail') {
    return `${pad}<mail:SendMail DisplayName="${escapeAttr(activity.displayName)}" To="${escapeAttr(String(activity.properties.to || ''))}" Subject="[${escapeAttr(String(activity.properties.subject ?? '""'))}]" Body="${escapeAttr(String(activity.properties.body || ''))}" />`;
  }

  if (activity.type === 'Messaging.HttpRequest') {
    return `${pad}<ui:HttpClient DisplayName="${escapeAttr(activity.displayName)}" Method="${escapeAttr(String(activity.properties.method || 'GET'))}" EndPoint="[${escapeAttr(String(activity.properties.url || '""'))}]" />`;
  }

  if (activity.type === 'System.Comment' || activity.type.startsWith('Imported.') || activity.type.startsWith('Flowchart.')) {
    // Preserve selector on imported placeholders when present
    const sel = selectorAttribute(activity.properties);
    return `${pad}<ui:Comment DisplayName="${escapeAttr(activity.displayName)}" Text="${escapeAttr(String(activity.properties.text || activity.properties.hint || activity.type))}"${sel} />`;
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
              : info.localName;
    return `${pad}<${tag} DisplayName="${escapeAttr(activity.displayName)}" />`;
  }

  return `${pad}<ui:Comment DisplayName="${escapeAttr(activity.displayName)}" Text="${escapeAttr('Exported placeholder for ' + activity.type)}" />`;
}

function renderUiActivity(activity: ActivityNode, pad: string, indent: number): string {
  const selAttr = selectorAttribute(activity.properties);
  const target = emitTargetXaml(activity.properties, pad + '  ');
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
  if (activity.type === 'UI.TypeInto') {
    extra.push(`Text="[${escapeAttr(String(activity.properties.text ?? '""'))}]"`);
  }
  if (activity.type === 'UI.SelectItem') {
    extra.push(`Item="[${escapeAttr(String(activity.properties.item ?? '""'))}]"`);
  }
  if (activity.type === 'UI.OpenApplication') {
    extra.push(`Url="${escapeAttr(String(activity.properties.pathOrUrl || ''))}"`);
  }
  if (activity.type === 'UI.TakeScreenshot') {
    extra.push(`FileName="${escapeAttr(String(activity.properties.filePath || 'screenshot.png'))}"`);
  }
  if (activity.type === 'UI.Check') {
    extra.push(`Action="${escapeAttr(String(activity.properties.action || 'Check'))}"`);
  }

  const attrs = [
    `DisplayName="${escapeAttr(activity.displayName)}"`,
    selAttr.trim(),
    ...extra
  ]
    .filter(Boolean)
    .join(' ');

  if (!target) {
    return `${pad}<${open} ${attrs} />`;
  }

  const kids = (activity.children || []).map((c) => renderActivity(c, indent + 1)).join('\n');
  if (kids) {
    return `${pad}<${open} ${attrs}>
${target}
${kids}
${pad}</${open}>`;
  }
  return `${pad}<${open} ${attrs}>
${target}
${pad}</${open}>`;
}

function renderExcelActivity(activity: ActivityNode, pad: string): string {
  const path = escapeAttr(String(activity.properties.workbookPath || 'data.xlsx'));
  const sheet = escapeAttr(String(activity.properties.sheetName || 'Sheet1'));
  const range = escapeAttr(String(activity.properties.range || ''));
  const cell = escapeAttr(String(activity.properties.cell || 'A1'));
  switch (activity.type) {
    case 'Excel.ReadRange':
      return `${pad}<excel:ReadRange DisplayName="${escapeAttr(activity.displayName)}" WorkbookPath="${path}" SheetName="${sheet}" Range="${range}" />`;
    case 'Excel.WriteRange':
      return `${pad}<excel:WriteRange DisplayName="${escapeAttr(activity.displayName)}" WorkbookPath="${path}" SheetName="${sheet}" DataTable="[${escapeAttr(String(activity.properties.data || 'dt'))}]" />`;
    case 'Excel.ReadCell':
      return `${pad}<excel:ReadCell DisplayName="${escapeAttr(activity.displayName)}" WorkbookPath="${path}" SheetName="${sheet}" Cell="${cell}" />`;
    case 'Excel.WriteCell':
      return `${pad}<excel:WriteCell DisplayName="${escapeAttr(activity.displayName)}" WorkbookPath="${path}" SheetName="${sheet}" Cell="${cell}" Value="[${escapeAttr(String(activity.properties.value ?? '""'))}]" />`;
    default:
      return `${pad}<ui:Comment DisplayName="${escapeAttr(activity.displayName)}" Text="Excel placeholder" />`;
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

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pseudoUuid(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return `${hex(hash)}-4${hex(hash ^ 0xabc).slice(1)}-8${hex(hash ^ 0xdef).slice(1)}-${hex(hash ^ 0x123)}`;
}
