import {
  ActivityNode,
  WorkflowDocument,
  WorkflowVariable
} from '../models/workflow';
import { isUiActivity, xamlInfoForLcsType } from './activityMap';
import { emitTargetXaml, selectorAttribute } from './selectorRoundTrip';
import { interactionModeAttribute } from './inputMethod';
import {
  parseArgumentMappings,
  renderInvokeArgumentsXml,
  renderXamlMembers
} from './workflowArguments';
import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  applyWindowsSelectorsToActivityProps,
  netTfmForTarget,
  resolveUiPathTarget,
  UiPathTargetFramework
} from './windowsTarget';

export interface XamlExportOptions {
  /** When Portable (Studio Web Local), rewrite Windows-only activities. */
  targetFramework?: UiPathTargetFramework;
}

/** Active export target — set for the duration of exportWorkflowToXaml. */
let exportTarget: UiPathTargetFramework = 'Windows';

function isPortableExport(): boolean {
  return exportTarget === 'Portable';
}

/**
 * ScopeGuid of the innermost Use Application/Browser (NApplicationCard) currently
 * being rendered, or undefined at top level. Real Studio Web XAML requires child
 * UI Automation activities inside a card to declare a matching ScopeIdentifier
 * attribute (and HealingAgentBehavior="SameAsCard") — confirmed against a real
 * exported sample. Without it those activities aren't properly scoped to the card
 * and Studio Web flags them. Set/restored around rendering NApplicationCard.Body's
 * children, mirroring the exportTarget pattern above.
 */
let activeScopeGuid: string | undefined;

/**
 * Best-effort XAML export for UiPath Studio Desktop (Windows) / Studio Web import.
 * Default project compatibility is **Windows** so robots run on Windows machines
 * with classic UI Automation selectors. Studio Web Local sync should pass Portable.
 */
export function exportWorkflowToXaml(
  doc: WorkflowDocument,
  options: XamlExportOptions = {}
): string {
  const prev = exportTarget;
  exportTarget = resolveUiPathTarget(options.targetFramework);
  try {
    const varsXml = renderVariables(doc.variables);
    const membersXml = renderXamlMembers(doc.arguments || []);
    const body =
      doc.type === 'Flowchart'
        ? renderFlowchart(doc)
        : renderSequence(doc.activities, doc.name, varsXml);

    return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeAttr(sanitizeClass(doc.name))}" sap:VirtualizedContainerService.HintSize="1200,800" sap2010:WorkflowViewState.IdRef="Activity1" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation" xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation" xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Collections" xmlns:sd="clr-namespace:System.Data;assembly=System.Data.Common" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:uix="http://schemas.uipath.com/workflow/activities/uix" xmlns:mail="http://schemas.uipath.com/workflow/activities/mail" xmlns:python="http://schemas.uipath.com/workflow/activities/python" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
${membersXml}${body}
</Activity>
`;
  } finally {
    exportTarget = prev;
  }
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

/**
 * If.Condition / While.Condition / DoWhile.Condition — WF4's x:Boolean converter
 * accepts a plain literal directly on the attribute, and that's exactly what real
 * Studio Web XAML uses for the default case (see Main.xaml: `Condition="True"`,
 * no brackets). The old code always wrapped every condition in [...], turning a
 * plain "True" default into "[True]" — an unnecessary expression cast that doesn't
 * match a real sample and doesn't round-trip byte-for-byte. Only wrap in brackets
 * when the condition is an actual VB expression.
 */
function conditionAttr(value: unknown): string {
  const text = String(value ?? 'True').trim();
  if (/^(true|false)$/i.test(text)) {
    return escapeAttr(text.charAt(0).toUpperCase() + text.slice(1).toLowerCase());
  }
  return escapeAttr(`[${text}]`);
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
    return `${pad}<If Condition="${conditionAttr(activity.properties.condition)}" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
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
    return `${pad}<While Condition="${conditionAttr(activity.properties.condition)}" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
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
    return renderTryCatch(activity, pad, indent);
  }
/** 
  if (activity.type === 'ControlFlow.TryCatch') {
    const tryKids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    const finallyKids = (activity.finallyChildren || []).map((c) => renderActivity(c, indent + 4)).join('\n');
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
${pad}  <TryCatch.Finally>
${pad}     <Sequence>    
${finallyKids}      
${pad}     </Sequence>
${pad}  </TryCatch.Finally>
${pad}</TryCatch>`;
  }
*/
  if (activity.type === 'Programming.Assign') {
    return `${pad}<Assign DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <Assign.To>
${pad}    <OutArgument x:TypeArguments="x:Object">[${escapeAttr(String(activity.properties.to ?? 'variable'))}]</OutArgument>
${pad}  </Assign.To>
${pad}  <Assign.Value>
${pad}    <InArgument x:TypeArguments="x:Object">[${escapeAttr(toVbStringArgument(String(activity.properties.value ?? '""')))}]</InArgument>
${pad}  </Assign.Value>
${pad}</Assign>`;
  }

  if (activity.type === 'Programming.MultipleAssign') {
    return renderMultipleAssign(activity, pad);
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
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 3)).join('\n');
    const caseLabels = String(activity.properties.cases || 'Default')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const nonDefault = caseLabels.filter((c) => c.toLowerCase() !== 'default');
    const caseXml = nonDefault
      .map((label) => {
        return `${pad}  <Switch.Case x:Key="${escapeAttr(label)}">
${pad}    <Sequence>
${pad}      <ui:Comment Text="Case ${escapeAttr(label)} — edit body in Studio or nest via Default for dry-run" />
${pad}    </Sequence>
${pad}  </Switch.Case>`;
      })
      .join('\n');
    return `${pad}<Switch x:TypeArguments="x:String" Expression="[${escapeAttr(String(activity.properties.expression ?? 'status'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${caseXml ? caseXml + '\n' : ''}${pad}  <Switch.Default>
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
    return `${pad}<ui:FilterDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" FilterRowsDataTable="[${escapeAttr(String(activity.properties.result || 'filteredDt'))}]" ColumnName="${escapeAttr(String(activity.properties.columnName || 'Status'))}" Operator="${escapeAttr(String(activity.properties.operator || '='))}" Value="[${escapeAttr(String(activity.properties.value ?? '""'))}]" />`;
  }

  if (activity.type === 'Data.MergeDataTable') {
    return `${pad}<ui:MergeDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Destination="[${escapeAttr(String(activity.properties.destination || 'dt'))}]" Source="[${escapeAttr(String(activity.properties.source || 'dtSource'))}]" MissingSchemaAction="${escapeAttr(String(activity.properties.missingSchemaAction || 'Add'))}" />`;
  }
  if (activity.type === 'Data.RemoveDataRow') {
    return `${pad}<ui:RemoveDataRow DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" RowIndex="[${escapeAttr(String(activity.properties.rowIndex ?? '0'))}]" />`;
  }
  if (activity.type === 'Data.RemoveDataColumn') {
    return `${pad}<ui:RemoveDataColumn DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" ColumnName="${escapeAttr(String(activity.properties.columnName || 'Column1'))}" />`;
  }
  if (activity.type === 'Data.GetRowItem') {
    return `${pad}<ui:GetRowItem DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Row="[${escapeAttr(String(activity.properties.row || 'row'))}]" ColumnName="${escapeAttr(String(activity.properties.columnName || 'Column1'))}" Result="[${escapeAttr(String(activity.properties.result || 'cellValue'))}]" />`;
  }
  if (activity.type === 'Data.UpdateRowItem') {
    return `${pad}<ui:UpdateRowItem DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Row="[${escapeAttr(String(activity.properties.row || 'row'))}]" ColumnName="${escapeAttr(String(activity.properties.columnName || 'Column1'))}" Value="[${escapeAttr(String(activity.properties.value ?? '""'))}]" />`;
  }
  if (activity.type === 'Data.JoinDataTable') {
    return `${pad}<ui:JoinDataTables DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable1="[${escapeAttr(String(activity.properties.dataTable1 || 'dtLeft'))}]" DataTable2="[${escapeAttr(String(activity.properties.dataTable2 || 'dtRight'))}]" JoinType="${escapeAttr(String(activity.properties.joinType || 'Inner'))}" Column1="${escapeAttr(String(activity.properties.column1 || 'Id'))}" Column2="${escapeAttr(String(activity.properties.column2 || 'Id'))}" DataTable="[${escapeAttr(String(activity.properties.result || 'joinedDt'))}]" />`;
  }

  if (activity.type === 'Data.LookupDataTable') {
    return `${pad}<ui:LookupDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" LookupColumnName="${escapeAttr(String(activity.properties.lookupColumn || 'Id'))}" LookupValue="[${escapeAttr(String(activity.properties.lookupValue ?? '""'))}]" TargetColumnName="${escapeAttr(String(activity.properties.targetColumn || 'Name'))}" Value="[${escapeAttr(String(activity.properties.result || 'lookupResult'))}]" />`;
  }

  if (activity.type === 'Data.SortDataTable') {
    return `${pad}<ui:SortDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" ColumnName="${escapeAttr(String(activity.properties.columnName || 'Id'))}" Order="${escapeAttr(String(activity.properties.order || 'Ascending'))}" SortDataTable="[${escapeAttr(String(activity.properties.result || 'sortedDt'))}]" />`;
  }

  if (activity.type === 'Data.ClearDataTable') {
    return `${pad}<ui:ClearDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" />`;
  }

  if (activity.type === 'Data.OutputDataTable') {
    return `${pad}<ui:OutputDataTable DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" DataTable="[${escapeAttr(String(activity.properties.dataTable || 'dt'))}]" Text="[${escapeAttr(String(activity.properties.result || 'tableText'))}]" />`;
  }

  if (activity.type === 'Messaging.DeserializeJson') {
    // JsonObject holds the result variable — xamlImport.ts reads it back via
    // raw['@_JsonObject']. Previously omitted here, so the configured result
    // variable was silently dropped on every export.
    return `${pad}<ui:DeserializeJson DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" JsonString="[${escapeAttr(String(activity.properties.jsonString ?? '\"{}\"'))}]" JsonObject="[${escapeAttr(String(activity.properties.result || 'jsonObj'))}]" />`;
  }

  if (activity.type === 'Messaging.SerializeJson') {
    // JsonString holds the result variable — xamlImport.ts reads it back via
    // raw['@_JsonString']. Previously omitted here, so the configured result
    // variable was silently dropped on every export.
    return `${pad}<ui:SerializeJson DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" JsonObject="[${escapeAttr(String(activity.properties.value || 'jsonObj'))}]" JsonString="[${escapeAttr(String(activity.properties.result || 'jsonText'))}]" />`;
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
    const mappings = parseArgumentMappings(activity.properties.argumentMappings);
    const argsXml = renderInvokeArgumentsXml(mappings, pad);
    if (argsXml) {
      return `${pad}<ui:InvokeWorkflowFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkflowFileName="${escapeAttr(path)}">
${argsXml}${pad}</ui:InvokeWorkflowFile>`;
    }
    return `${pad}<ui:InvokeWorkflowFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkflowFileName="${escapeAttr(path)}" />`;
  }

  if (activity.type === 'System.MessageBox') {
    if (isPortableExport()) {
      // Message Box is Windows-only — Log Message loads in Studio Web
      return `${pad}<ui:LogMessage DisplayName="${escapeAttr(exportDisplayName(activity.displayName))} (Portable)" Level="Info" Message="[${escapeAttr(toVbStringArgument(activity.properties.text))}]" />`;
    }
    return `${pad}<ui:MessageBox DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="[${escapeAttr(toVbStringArgument(activity.properties.text))}]" Caption="${escapeAttr(String(activity.properties.title || 'LowCode Studio'))}" />`;
  }

  if (activity.type === 'System.WriteLine') {
    return `${pad}<WriteLine DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="[${escapeAttr(toVbStringArgument(activity.properties.text))}]" />`;
  }

  if (activity.type === 'System.ReadTextFile') {
    return `${pad}<ui:ReadTextFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" FileName="[${escapeAttr(toVbStringArgument(activity.properties.fileName))}]" Content="[${escapeAttr(String(activity.properties.result || 'fileText'))}]" />`;
  }
  if (activity.type === 'System.WriteTextFile') {
    return `${pad}<ui:WriteTextFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" FileName="[${escapeAttr(toVbStringArgument(activity.properties.fileName))}]" Text="[${escapeAttr(toVbStringArgument(activity.properties.text))}]" />`;
  }
  if (activity.type === 'System.AppendLine') {
    return `${pad}<ui:AppendLine DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" FileName="[${escapeAttr(toVbStringArgument(activity.properties.fileName))}]" Text="[${escapeAttr(toVbStringArgument(activity.properties.text))}]" />`;
  }
  if (activity.type === 'System.PathExists') {
    return `${pad}<ui:PathExists DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Path="[${escapeAttr(toVbStringArgument(activity.properties.path))}]" PathType="${escapeAttr(String(activity.properties.pathType || 'Any'))}" Exists="[${escapeAttr(String(activity.properties.result || 'exists'))}]" />`;
  }
  if (activity.type === 'System.CreateDirectory') {
    return `${pad}<ui:CreateDirectory DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Path="[${escapeAttr(toVbStringArgument(activity.properties.path))}]" />`;
  }
  if (activity.type === 'System.CopyFile') {
    return `${pad}<ui:CopyFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Path="[${escapeAttr(toVbStringArgument(activity.properties.path))}]" Destination="[${escapeAttr(toVbStringArgument(activity.properties.destination))}]" Overwrite="${activity.properties.overwrite === false ? 'False' : 'True'}" />`;
  }
  if (activity.type === 'System.MoveFile') {
    return `${pad}<ui:MoveFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Path="[${escapeAttr(toVbStringArgument(activity.properties.path))}]" Destination="[${escapeAttr(toVbStringArgument(activity.properties.destination))}]" Overwrite="${activity.properties.overwrite === false ? 'False' : 'True'}" />`;
  }
  if (activity.type === 'System.RenameFile') {
    return `${pad}<ui:RenameFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Path="[${escapeAttr(toVbStringArgument(activity.properties.path))}]" NewName="[${escapeAttr(toVbStringArgument(activity.properties.newName))}]" />`;
  }
  if (activity.type === 'System.Matches') {
    return `${pad}<ui:Matches DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Input="[${escapeAttr(String(activity.properties.input || 'text'))}]" Pattern="[${escapeAttr(toVbStringArgument(activity.properties.pattern))}]" Result="[${escapeAttr(String(activity.properties.result || 'matches'))}]" />`;
  }
  if (activity.type === 'System.IsMatch') {
    return `${pad}<ui:IsMatch DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Input="[${escapeAttr(String(activity.properties.input || 'text'))}]" Pattern="[${escapeAttr(toVbStringArgument(activity.properties.pattern))}]" Result="[${escapeAttr(String(activity.properties.result || 'isMatch'))}]" />`;
  }
  if (activity.type === 'System.Replace') {
    return `${pad}<ui:Replace DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Input="[${escapeAttr(String(activity.properties.input || 'text'))}]" Pattern="[${escapeAttr(toVbStringArgument(activity.properties.pattern))}]" Replacement="[${escapeAttr(toVbStringArgument(activity.properties.replacement))}]" Result="[${escapeAttr(String(activity.properties.result || 'replaced'))}]" />`;
  }
  if (activity.type === 'System.KillProcess') {
    return `${pad}<ui:KillProcess DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" ProcessName="[${escapeAttr(toVbStringArgument(activity.properties.processName))}]" />`;
  }
  if (activity.type === 'System.DeleteFile') {
    if (isPortableExport()) {
      return `${pad}<ui:Comment DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="${escapeAttr('Delete File is Windows-only — replace with a Portable Delete / file activity in Studio Web, or export as Windows. Path: ' + String(activity.properties.path || ''))}" />`;
    }
    return `${pad}<ui:DeleteFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Path="[${escapeAttr(toVbStringArgument(activity.properties.path))}]" />`;
  }
  if (activity.type === 'Data.ReadCsv') {
    return `${pad}<ui:ReadCsvFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" FilePath="[${escapeAttr(toVbStringArgument(activity.properties.filePath || activity.properties.path || 'input.csv'))}]" DataTable="[${escapeAttr(String(activity.properties.result || 'dt'))}]" />`;
  }
  if (activity.type === 'Data.WriteCsv') {
    return `${pad}<ui:WriteCsvFile DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" FilePath="[${escapeAttr(toVbStringArgument(activity.properties.filePath || activity.properties.path || 'output.csv'))}]" DataTable="[${escapeAttr(String(activity.properties.data || 'dt'))}]" />`;
  }
  if (activity.type === 'Flowchart.FlowSwitch') {
    // FlowSwitch is invalid inside a Sequence — export as Switch for Studio Web
    return `${pad}<Switch x:TypeArguments="x:String" Expression="[${escapeAttr(String(activity.properties.expression || 'key'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <Switch.Default>
${pad}    <Sequence />
${pad}  </Switch.Default>
${pad}</Switch>`;
  }

  if (activity.type === 'ControlFlow.DoWhile') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<DoWhile Condition="${conditionAttr(activity.properties.condition)}" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <Sequence>
${kids}
${pad}  </Sequence>
${pad}</DoWhile>`;
  }

  if (activity.type === 'ControlFlow.RetryScope') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    const intervalMs = Number(activity.properties.retryIntervalMs ?? 1000);
    return `${pad}<ui:RetryScope DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" NumberOfRetries="${Number(activity.properties.numberOfRetries ?? 3)}" RetryInterval="${msToTimeSpan(intervalMs)}">
${pad}  <ui:RetryScope.Activity>
${pad}    <ActivityAction>
${pad}      <Sequence>
${kids}
${pad}      </Sequence>
${pad}    </ActivityAction>
${pad}  </ui:RetryScope.Activity>
${pad}</ui:RetryScope>`;
  }

  if (activity.type === 'ControlFlow.Parallel') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 1)).join('\n');
    return `${pad}<Parallel DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${kids}
${pad}</Parallel>`;
  }

  if (activity.type === 'ControlFlow.ParallelForEach') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    return `${pad}<ParallelForEach x:TypeArguments="x:Object" Values="[${escapeAttr(String(activity.properties.values || 'collection'))}]" DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <ActivityAction x:TypeArguments="x:Object">
${pad}    <ActivityAction.Argument>
${pad}      <DelegateInArgument x:TypeArguments="x:Object" Name="${escapeAttr(String(activity.properties.item || 'item'))}" />
${pad}    </ActivityAction.Argument>
${pad}    <Sequence>
${kids}
${pad}    </Sequence>
${pad}  </ActivityAction>
${pad}</ParallelForEach>`;
  }

  if (activity.type === 'ControlFlow.TimeoutScope') {
    const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
    const timeoutMs = Number(activity.properties.timeoutMs ?? 30000);
    return `${pad}<ui:TimeoutScope DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Timeout="${msToTimeSpan(timeoutMs)}">
${pad}  <ui:TimeoutScope.Body>
${pad}    <ActivityAction>
${pad}      <Sequence>
${kids}
${pad}      </Sequence>
${pad}    </ActivityAction>
${pad}  </ui:TimeoutScope.Body>
${pad}</ui:TimeoutScope>`;
  }

  if (activity.type === 'ControlFlow.Break') {
    return `${pad}<Break DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" />`;
  }
  if (activity.type === 'ControlFlow.Continue') {
    return `${pad}<Continue DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" />`;
  }

  if (activity.type === 'UI.SendHotkey') {
    const props = applyWindowsSelectorsToActivityProps(activity.properties || {});
    const key = String(props.key || 'enter');
    const selector = String(props.selector || '').trim();
    const selAttr = selector ? ` Selector="${escapeAttr(selector)}"` : '';
    let inputAttr = interactionModeAttribute(props, 'Simulate');
    if (isPortableExport() && /InteractionMode="(WindowMessages|HardwareEvents|Background)"/.test(inputAttr)) {
      inputAttr = ' InteractionMode="Simulate"';
    }
    return `${pad}<uix:NKeyboardShortcuts DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Shortcuts="[${escapeAttr(toVbStringArgument(key))}]"${selAttr}${inputAttr} />`;
  }

  if (activity.type === 'UI.UseApplicationBrowser') {
    return renderUseApplicationBrowser(activity, pad, indent);
  }

  if (activity.type === 'Data.BuildDataTable') {
    return renderBuildDataTable(activity, pad, indent);
  }

  if (isUiActivity(activity.type)) {
    if (activity.type === 'UI.ExtractTableData') {
      return renderExtractTableData(activity, pad);
    }
    return renderUiActivity(activity, pad, indent);
  }

  if (activity.type.startsWith('Excel.')) {
    return renderExcelActivity(activity, pad, indent);
  }

  if (activity.type === 'Messaging.SendEmail') {
    return `${pad}<mail:SendMail DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" To="${escapeAttr(String(activity.properties.to || ''))}" Subject="[${escapeAttr(String(activity.properties.subject ?? '""'))}]" Body="${escapeAttr(String(activity.properties.body || ''))}" />`;
  }

  if (activity.type === 'Messaging.HttpRequest') {
    const headers = String(activity.properties.headers || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const authType = String(activity.properties.authType || 'None');
    if (authType === 'Bearer' && activity.properties.token) {
      headers.push('Authorization: Bearer ' + String(activity.properties.token).replace(/^\[|\]$/g, ''));
    }
    const headerAttrs = headers.length
      ? ` Headers="${escapeAttr(headers.join('; '))}"`
      : '';
    const body = String(activity.properties.body || '');
    const bodyAttr = body ? ` Body="[${escapeAttr(body)}]"` : '';
    const statusVar = String(activity.properties.statusCode || '').replace(/^\[|\]$/g, '');
    const statusAttr = statusVar ? ` StatusCode="[${escapeAttr(statusVar)}]"` : '';
    const resultVar = String(activity.properties.result || '').replace(/^\[|\]$/g, '');
    const resultAttr = resultVar ? ` Result="[${escapeAttr(resultVar)}]"` : '';
    return `${pad}<ui:HttpClient DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Method="${escapeAttr(String(activity.properties.method || 'GET'))}" EndPoint="[${escapeAttr(String(activity.properties.url || '""'))}]"${headerAttrs}${bodyAttr}${statusAttr}${resultAttr} />`;
  }

  if (activity.type === 'Messaging.GetEmail') {
    return `${pad}<mail:GetIMAPMailMessages DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" MailFolder="${escapeAttr(String(activity.properties.mailFolder || 'Inbox'))}" Top="${Number(activity.properties.top ?? 10)}" Filter="${escapeAttr(String(activity.properties.filter || ''))}" Messages="[${escapeAttr(String(activity.properties.result || 'mails'))}]" />`;
  }

  if (activity.type === 'Messaging.SelectToken') {
    return `${pad}<ui:SelectToken DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Json="[${escapeAttr(String(activity.properties.json || 'jsonObj'))}]" Path="${escapeAttr(String(activity.properties.path || 'data.id'))}" Result="[${escapeAttr(String(activity.properties.result || 'tokenValue'))}]" />`;
  }

  if (activity.type === 'Orchestrator.GetTransactionItem') {
    const folder = String(activity.properties.folderPath || '');
    const folderAttr = folder ? ` FolderPath="${escapeAttr(folder)}"` : '';
    const ref = String(activity.properties.reference || '');
    const refAttr = ref ? ` Reference="${escapeAttr(ref)}"` : '';
    return `${pad}<ui:GetQueueItem DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" QueueName="${escapeAttr(String(activity.properties.queueName || 'MainQueue'))}"${folderAttr}${refAttr} TransactionItem="[${escapeAttr(String(activity.properties.result || 'TransactionItem'))}]" />`;
  }

  if (activity.type === 'Orchestrator.WaitQueueItem') {
    const folder = String(activity.properties.folderPath || '');
    const folderAttr = folder ? ` FolderPath="${escapeAttr(folder)}"` : '';
    const timeout = Number(activity.properties.timeoutMs ?? 60000);
    return `${pad}<ui:WaitQueueItem DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" QueueName="${escapeAttr(String(activity.properties.queueName || 'MainQueue'))}"${folderAttr} TimeoutMS="${timeout}" TransactionItem="[${escapeAttr(String(activity.properties.result || 'TransactionItem'))}]" />`;
  }

  if (activity.type === 'Orchestrator.AddQueueItem') {
    const folder = String(activity.properties.folderPath || '');
    const folderAttr = folder ? ` FolderPath="${escapeAttr(folder)}"` : '';
    const display = escapeAttr(exportDisplayName(activity.displayName));
    const queueType = escapeAttr(String(activity.properties.queueName || 'MainQueue'));
    const priority = escapeAttr(String(activity.properties.priority || 'Normal'));
    const referenceRaw = String(activity.properties.reference ?? '""');
    const referenceAttr = referenceRaw && referenceRaw !== '""'
      ? ` Reference="[${escapeAttr(referenceRaw)}]"`
      : '';
    const itemInfoXml = renderQueueItemInformation(
      String(activity.properties.itemInformation || '{}'),
      pad + '    '
    );
    return `${pad}<ui:AddQueueItem DisplayName="${display}" QueueType="${queueType}"${folderAttr}${referenceAttr} Priority="${priority}">
${pad}  <ui:AddQueueItem.ItemInformation>
${itemInfoXml}
${pad}  </ui:AddQueueItem.ItemInformation>
${pad}</ui:AddQueueItem>`;
  }

  if (activity.type === 'Orchestrator.GetAsset') {
    const folder = String(activity.properties.folderPath || '');
    const folderAttr = folder ? ` FolderPath="${escapeAttr(folder)}"` : '';
    return `${pad}<ui:GetRobotAsset DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" AssetName="${escapeAttr(String(activity.properties.assetName || 'AssetName'))}"${folderAttr} Value="[${escapeAttr(String(activity.properties.result || 'assetValue'))}]" />`;
  }

  if (activity.type === 'Orchestrator.GetCredential') {
    const folder = String(activity.properties.folderPath || '');
    const folderAttr = folder ? ` FolderPath="${escapeAttr(folder)}"` : '';
    return `${pad}<ui:GetCredential DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" AssetName="${escapeAttr(String(activity.properties.assetName || 'Credential'))}"${folderAttr} Username="[${escapeAttr(String(activity.properties.username || 'username'))}]" Password="[${escapeAttr(String(activity.properties.password || 'password'))}]" />`;
  }

  if (activity.type === 'Orchestrator.SetAsset') {
    const folder = String(activity.properties.folderPath || '');
    const folderAttr = folder ? ` FolderPath="${escapeAttr(folder)}"` : '';
    return `${pad}<ui:SetAsset DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" AssetName="${escapeAttr(String(activity.properties.assetName || 'AssetName'))}"${folderAttr} Value="[${escapeAttr(String(activity.properties.value ?? '""'))}]" />`;
  }

  if (activity.type === 'REFramework.SetTransactionStatus') {
    return `${pad}<ui:SetTransactionStatus DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" TransactionItem="[${escapeAttr(String(activity.properties.transactionItem || 'TransactionItem'))}]" Status="${escapeAttr(String(activity.properties.status || 'Success'))}" ErrorType="${escapeAttr(String(activity.properties.status || 'Success'))}" Reason="[${escapeAttr(String(activity.properties.reason ?? '""'))}]" />`;
  }

  if (activity.type.startsWith('Python.')) {
    if (isPortableExport()) {
      return `${pad}<ui:Comment DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="${escapeAttr('Python activities are not in the stable cross-platform pack — use Windows export or UiPath.Python 2.0 preview in Studio Web. (' + activity.type + ')')}" />`;
    }
    return renderPythonActivity(activity, pad, indent);
  }

  if (activity.type === 'System.Comment' || activity.type.startsWith('Imported.') || activity.type === 'Flowchart.Start' || activity.type === 'Flowchart.End' || activity.type === 'Flowchart.FlowDecision') {
    // Preserve selector on imported placeholders when present
    const sel = selectorAttribute(activity.properties);
    return `${pad}<ui:Comment DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="${escapeAttr(String(activity.properties.text || activity.properties.hint || activity.type))}"${sel} />`;
  }

  if (info) {
    const tag =
      info.ns === 'ui'
        ? `ui:${info.localName}`
        : info.ns === 'uia'
          ? `uix:${info.localName}`
          : info.ns === 'excel'
            ? `ui:${info.localName}`
            : info.ns === 'mail'
              ? `mail:${info.localName}`
              : info.ns === 'python'
                ? `python:${info.localName}`
                : info.localName;
    return `${pad}<${tag} DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" />`;
  }

  return `${pad}<ui:Comment DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" Text="${escapeAttr('Exported placeholder for ' + activity.type)}" />`;
}

function renderMultipleAssign(activity: ActivityNode, pad: string): string {
  const lines = String(activity.properties.assignments || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const assignBlocks = lines
    .map((line) => {
      const eq = line.indexOf('=');
      const to = eq >= 0 ? line.slice(0, eq).trim() : line;
      const value = eq >= 0 ? line.slice(eq + 1).trim() : '""';
      return `${pad}  <Assign DisplayName="${escapeAttr(to)} = …">
${pad}    <Assign.To><OutArgument x:TypeArguments="x:Object">[${escapeAttr(to)}]</OutArgument></Assign.To>
${pad}    <Assign.Value><InArgument x:TypeArguments="x:Object">[${escapeAttr(value)}]</InArgument></Assign.Value>
${pad}  </Assign>`;
    })
    .join('\n');

  if (isPortableExport()) {
    // Multiple Assign is Windows-only — expand to Sequence of Assign
    return `${pad}<Sequence DisplayName="${escapeAttr(exportDisplayName(activity.displayName))} (Portable)">
${assignBlocks || `${pad}  <ui:Comment Text="Empty Multiple Assign" />`}
${pad}</Sequence>`;
  }

  return `${pad}<ui:MultipleAssign DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <ui:MultipleAssign.Assignments>
${assignBlocks || `${pad}  <Assign />`}
${pad}  </ui:MultipleAssign.Assignments>
${pad}</ui:MultipleAssign>`;
}

/**
 * Best-guess assembly per exception type, for the xmlns:clr-namespace declaration
 * WF4 requires on <Catch x:TypeArguments="...">. UNVERIFIED beyond System.Exception
 * (the only case confirmed against a real Studio Web sample so far, per
 * FIXING_ACTIVITIES.md) — treat entries here as suspects, same as the doc's other
 * flagged areas, until each is checked against a real multi-catch export.
 */
const KNOWN_EXCEPTION_ASSEMBLIES: Record<string, string> = {
  'System.Exception': 'System.Private.CoreLib',
  'System.ArgumentException': 'System.Private.CoreLib',
  'System.ArgumentNullException': 'System.Private.CoreLib',
  'System.ArgumentOutOfRangeException': 'System.Private.CoreLib',
  'System.InvalidOperationException': 'System.Private.CoreLib',
  'System.NullReferenceException': 'System.Private.CoreLib',
  'System.NotSupportedException': 'System.Private.CoreLib',
  'System.NotImplementedException': 'System.Private.CoreLib',
  'System.FormatException': 'System.Private.CoreLib',
  'System.TimeoutException': 'System.Private.CoreLib',
  'System.OverflowException': 'System.Private.CoreLib',
  'System.IO.IOException': 'System.IO.FileSystem.Primitives',
  'System.IO.FileNotFoundException': 'System.IO.FileSystem.Primitives',
  'System.IO.DirectoryNotFoundException': 'System.IO.FileSystem.Primitives',
  'System.Net.Http.HttpRequestException': 'System.Net.Http',
  'UiPath.Core.BusinessRuleException': 'UiPath.System.Activities'
};

function resolveExceptionTypeInfo(fullType: string): {
  namespace: string;
  localName: string;
  assembly: string;
} {
  const trimmed = (fullType || 'System.Exception').trim().replace(/^\[|\]$/g, '');
  const lastDot = trimmed.lastIndexOf('.');
  const namespace = lastDot >= 0 ? trimmed.slice(0, lastDot) : 'System';
  const localName = lastDot >= 0 ? trimmed.slice(lastDot + 1) : trimmed || 'Exception';
  // Unknown System.* types default to System.Private.CoreLib (true for most BCL
  // exceptions on modern .NET); unknown non-System types are left assembly-less —
  // Studio Web treats a bare clr-namespace as "same assembly as the project", which
  // is wrong for a genuinely external type but safer than a fabricated assembly.
  const assembly = KNOWN_EXCEPTION_ASSEMBLIES[trimmed] || (namespace.startsWith('System') ? 'System.Private.CoreLib' : '');
  return { namespace, localName, assembly };
}

function renderTryCatch(activity: ActivityNode, pad: string, indent: number): string {
  const tryKids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
  const finallyKids = (activity.finallyChildren || []).map((c) => renderActivity(c, indent + 4)).join('\n');

  // Real multi-catch model, with a fallback to the legacy single-catch shape
  // (elseChildren + properties.exceptionType) for documents saved before this change.
  const clauses =
    activity.catches && activity.catches.length
      ? activity.catches
      : [
          {
            exceptionType: String(activity.properties.exceptionType || 'System.Exception'),
            exceptionVariable: 'exception',
            children: activity.elseChildren || []
          }
        ];

  const catchXml = clauses
    .map((clause, i) => {
      const { namespace, localName, assembly } = resolveExceptionTypeInfo(clause.exceptionType);
      const nsPrefix = i === 0 ? 's' : `s${i}`;
      const xmlnsDecl = assembly
        ? `clr-namespace:${namespace};assembly=${assembly}`
        : `clr-namespace:${namespace}`;
      const typeArg = `${nsPrefix}:${escapeAttr(localName)}`;
      const varName = escapeAttr(clause.exceptionVariable || 'exception');
      const kids = (clause.children || []).map((c) => renderActivity(c, indent + 3)).join('\n');
      return `${pad}    <Catch x:TypeArguments="${typeArg}" xmlns:${nsPrefix}="${escapeAttr(xmlnsDecl)}">
${pad}      <ActivityAction x:TypeArguments="${typeArg}">
${pad}        <ActivityAction.Argument>
${pad}          <DelegateInArgument x:TypeArguments="${typeArg}" Name="${varName}" />
${pad}        </ActivityAction.Argument>
${pad}        <Sequence>
${kids}
${pad}        </Sequence>
${pad}      </ActivityAction>
${pad}    </Catch>`;
    })
    .join('\n');

  return `${pad}<TryCatch DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}">
${pad}  <TryCatch.Try>
${pad}    <Sequence>
${tryKids}
${pad}    </Sequence>
${pad}  </TryCatch.Try>
${pad}  <TryCatch.Catches>
${catchXml}
${pad}  </TryCatch.Catches>
${pad}  <TryCatch.Finally>
${pad}     <Sequence>    
${finallyKids}      
${pad}     </Sequence>
${pad}  </TryCatch.Finally>
${pad}</TryCatch>`;
}

/**
 * Modern Use Application/Browser (NApplicationCard).
 * Studio rejects hallucinated card-level Url / BrowserType / AttachMode="Browser".
 * URL + BrowserType belong on TargetApp; AttachMode is SingleWindow | ByInstance.
 */
function renderUseApplicationBrowser(
  activity: ActivityNode,
  pad: string,
  indent: number
): string {
  const scopeGuid = crypto.randomUUID();
  const prevScope = activeScopeGuid;
  activeScopeGuid = scopeGuid;
  const kids = (activity.children || [])
    .map((c) => renderActivity(c, indent + 3))
    .join('\n');
  activeScopeGuid = prevScope;
  const props = applyWindowsSelectorsToActivityProps(activity.properties || {});
  const mode = String(props.mode || 'Browser');
  const isApp = /application/i.test(mode);
  const pathOrUrl = String(props.urlOrPath || (isApp ? '' : 'https://example.com'));
  const browser = escapeAttr(String(props.browserType || 'Chrome'));
  const open = escapeAttr(normalizeOpenMode(props.open));
  const close = escapeAttr(normalizeCloseMode(props.close));
  // AttachMode is window scope — NOT Browser/Application (those go on TargetApp)
  const attach = escapeAttr(
    normalizeAttachMode(props.attachMode) || (isApp ? 'ByInstance' : 'ByInstance')
  );
  let inputAttr = interactionModeAttribute(props, 'Simulate');
  // Portable / Studio Web only supports Simulate + Chromium API (DebuggerApi)
  if (isPortableExport() && /InteractionMode="(WindowMessages|HardwareEvents|Background)"/.test(inputAttr)) {
    inputAttr = ' InteractionMode="Simulate"';
  }
  const selector = String(props.selector || '').trim();
  const selAttr = selector ? ` Selector="${escapeAttr(selector)}"` : '';

  const targetInner = isApp
    ? ` FilePath="${escapeAttr(pathOrUrl)}"`
    : ` BrowserType="${browser}" Url="${escapeAttr(pathOrUrl)}"${selAttr}`;

  return `${pad}<uix:NApplicationCard DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" OpenMode="${open}" CloseMode="${close}" AttachMode="${attach}"${inputAttr} Version="V2" ScopeGuid="${scopeGuid}">
${pad}  <uix:NApplicationCard.Body>
${pad}    <ActivityAction x:TypeArguments="x:Object">
${pad}      <ActivityAction.Argument>
${pad}        <DelegateInArgument x:TypeArguments="x:Object" Name="WSSessionData" />
${pad}      </ActivityAction.Argument>
${pad}      <Sequence DisplayName="Do">
${kids}
${pad}      </Sequence>
${pad}    </ActivityAction>
${pad}  </uix:NApplicationCard.Body>
${pad}  <uix:NApplicationCard.TargetApp>
${pad}    <uix:TargetApp Area="0, 0, 0, 0"${targetInner} Version="V2" />
${pad}  </uix:NApplicationCard.TargetApp>
${pad}</uix:NApplicationCard>`;
}

function normalizeOpenMode(raw: unknown): string {
  const v = String(raw || 'IfNotOpen').trim();
  if (/^always$/i.test(v)) return 'Always';
  if (/^never$/i.test(v)) return 'Never';
  return 'IfNotOpen';
}

function normalizeCloseMode(raw: unknown): string {
  const v = String(raw || 'Never').trim();
  if (/^always$/i.test(v)) return 'Always';
  if (/if\s*opened/i.test(v) || /IfOpenedBy/i.test(v)) return 'IfOpenedByAppBrowser';
  return 'Never';
}

function normalizeAttachMode(raw: unknown): string | undefined {
  const v = String(raw || '').trim();
  if (!v) return undefined;
  if (/single/i.test(v)) return 'SingleWindow';
  if (/instance|process/i.test(v)) return 'ByInstance';
  // Legacy LCS mistakenly stored Browser/Application here — ignore
  if (/^(browser|application)$/i.test(v)) return undefined;
  return undefined;
}

/**
 * Build Data Table is Windows-only. Portable (Studio Web) rewrite:
 * Assign New DataTable + Add Data Column per column (cross-platform).
 */
/**
 * Builds the ADO.NET DataSet XSD schema string that UiPath.Core.Activities.BuildDataTable
 * actually stores its column definitions in (the "TableInfo" property). This is NOT a
 * simple "Columns"/"ColumnNames" attribute — BuildDataTable has no such property. Verified
 * against real Studio-exported XAML samples, e.g.:
 *   <ui:BuildDataTable DataTable="[dt]" TableInfo="&lt;NewDataSet&gt;
 *     &lt;xs:schema id=&quot;NewDataSet&quot; ...&gt;
 *       &lt;xs:element name=&quot;NewDataSet&quot;&gt;
 *         &lt;xs:complexType&gt;
 *           &lt;xs:choice minOccurs=&quot;0&quot; maxOccurs=&quot;unbounded&quot;&gt;
 *             &lt;xs:element name=&quot;Table1&quot;&gt;
 *               &lt;xs:complexType&gt;
 *                 &lt;xs:sequence&gt;
 *                   &lt;xs:element name=&quot;ColName&quot; type=&quot;xs:string&quot; minOccurs=&quot;0&quot; /&gt;
 *                   ...
 * Only the leaf column elements carry a `type="xs:..."` attribute — the wrapping
 * NewDataSet/Table1 elements don't — which is also what the import-side parser below
 * keys off of.
 */
function buildTableInfoSchema(columns: string[]): string {
  const cols = (columns.length ? columns : ['Column1'])
    .map(
      (col) =>
        `          <xs:element name="${escapeAttr(col)}" type="xs:string" minOccurs="0" />`
    )
    .join('\n');
  return `<NewDataSet>
  <xs:schema id="NewDataSet" xmlns="" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
    <xs:element name="NewDataSet" msdata:IsDataSet="true" msdata:UseCurrentLocale="true">
      <xs:complexType>
        <xs:choice minOccurs="0" maxOccurs="unbounded">
          <xs:element name="Table1">
            <xs:complexType>
              <xs:sequence>
${cols}
              </xs:sequence>
            </xs:complexType>
          </xs:element>
        </xs:choice>
      </xs:complexType>
    </xs:element>
  </xs:schema>
</NewDataSet>`;
}

/**
 * AddQueueItem.ItemInformation is a Dictionary<string, InArgument<string>>, serialized
 * as one <InArgument x:TypeArguments="x:String" x:Key="...">value</InArgument> per key —
 * confirmed against a real Studio Web export. The LCS catalog stores this as a JSON
 * multiline string (e.g. {"Name": "Sample"}); this converts one to the other.
 * Falls back to a single "Value" key with the raw text if it isn't valid JSON, rather
 * than dropping the data or emitting an empty dictionary.
 */
function renderQueueItemInformation(itemInfoJson: string, pad: string): string {
  let entries: Array<[string, unknown]>;
  try {
    const parsed = JSON.parse(itemInfoJson);
    entries =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.entries(parsed)
        : [['Value', itemInfoJson]];
  } catch {
    entries = itemInfoJson.trim() ? [['Value', itemInfoJson]] : [];
  }
  if (!entries.length) {
    return '';
  }
  return entries
    .map(([key, value]) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      return `${pad}<InArgument x:TypeArguments="x:String" x:Key="${escapeAttr(key)}">${escapeAttr(text)}</InArgument>`;
    })
    .join('\n');
}

function renderBuildDataTable(
  activity: ActivityNode,
  pad: string,
  indent: number
): string {
  const result = String(activity.properties.result || 'dt').replace(/^\[|\]$/g, '');
  const columns = String(activity.properties.columns || 'Column1')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const display = escapeAttr(exportDisplayName(activity.displayName));

  if (!isPortableExport()) {
    // BuildDataTable is Windows/Windows-Legacy only (not Cross-platform) — this is the
    // real export path. Previously this emitted no schema at all, so every configured
    // column was silently dropped and Studio Web would show an empty/blank table.
    const tableInfo = escapeAttr(buildTableInfoSchema(columns));
    return `${pad}<ui:BuildDataTable DisplayName="${display}" DataTable="[${escapeAttr(result)}]" TableInfo="${tableInfo}" />`;
  }

  const initPad = pad + '  ';
  const colPad = pad + '  ';
  const colXml = columns
    .map(
      (col) =>
        `${colPad}<ui:AddDataColumn DisplayName="Add column ${escapeAttr(col)}" DataTable="[${escapeAttr(result)}]" ColumnName="${escapeAttr(col)}" />`
    )
    .join('\n');

  return `${pad}<Sequence DisplayName="${display} (Portable)">
${initPad}<Assign DisplayName="New DataTable → ${escapeAttr(result)}">
${initPad}  <Assign.To>
${initPad}    <OutArgument x:TypeArguments="sd:DataTable">[${escapeAttr(result)}]</OutArgument>
${initPad}  </Assign.To>
${initPad}  <Assign.Value>
${initPad}    <InArgument x:TypeArguments="sd:DataTable">[New System.Data.DataTable]</InArgument>
${initPad}  </Assign.Value>
${initPad}</Assign>
${colXml}
${pad}</Sequence>`;
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

  // Real modern class is UiPath.UIAutomationNext.Activities.NExtractData —
  // "ExtractTableData" is not a real class name and was silently breaking Studio Web
  // load after sync.
  if (!target) {
    return `${pad}<uix:NExtractData ${attrs} />`;
  }
  return `${pad}<uix:NExtractData ${attrs}>
${target}
${pad}</uix:NExtractData>`;
}

function renderUiActivity(activity: ActivityNode, pad: string, indent: number): string {
  // Open Application is not a real modern type (NOpenApplication) — emit NApplicationCard
  if (activity.type === 'UI.OpenApplication') {
    const pathOrUrl = String(activity.properties.pathOrUrl || '');
    const isBrowser = /^https?:\/\//i.test(pathOrUrl) || !/\.exe$/i.test(pathOrUrl);
    return renderUseApplicationBrowser(
      {
        ...activity,
        type: 'UI.UseApplicationBrowser',
        properties: {
          mode: isBrowser ? 'Browser' : 'Application',
          urlOrPath: pathOrUrl || 'https://example.com',
          browserType: 'Chrome',
          open: 'IfNotOpen',
          close: 'Never',
          inputMethod: 'Simulate',
          selector: activity.properties.selector
        }
      },
      pad,
      indent
    );
  }

  // Classic ElementExists / Wait appear|vanish → modern NCheckState (cross-platform)
  if (activity.type === 'UI.ElementExists' || activity.type === 'UI.WaitElement') {
    return renderCheckAppState(activity, pad);
  }

  const props = applyWindowsSelectorsToActivityProps(activity.properties || {});
  const selAttr = selectorAttribute(props);
  const target = emitTargetXaml(props, pad + '  ');
  const open =
    activity.type === 'UI.Click'
      ? 'uix:NClick'
      : activity.type === 'UI.TypeInto'
        ? 'uix:NTypeInto'
        : activity.type === 'UI.GetText'
          ? 'uix:NGetText'
          : activity.type === 'UI.Check'
            ? 'uix:NCheck'
            : activity.type === 'UI.Hover'
              ? 'uix:NHover'
              : activity.type === 'UI.SelectItem'
                ? 'uix:NSelectItem'
                : activity.type === 'UI.TakeScreenshot'
                  ? 'uix:NTakeScreenshot'
                  : activity.type === 'UI.GetAttribute'
                    ? 'uix:NGetAttributeGeneric'
                    : (() => {
                        // Should never happen for a type isUiActivity() accepts.
                        throw new Error(
                          `xamlExport: no modern UI Automation tag mapped for lcsType "${activity.type}"`
                        );
                      })();

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
    // Modern NTypeInto uses EmptyFieldMode enum — EmptyField bool fails Studio Web load
    if (props.emptyField !== false && props.emptyField !== 'false') {
      extra.push(`EmptyFieldMode="SingleLine"`);
    } else {
      extra.push(`EmptyFieldMode="None"`);
    }
  }
  if (activity.type === 'UI.SelectItem') {
    extra.push(`Item="[${escapeAttr(toVbStringArgument(props.item))}]"`);
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
  if (activeScopeGuid) {
    // Confirmed against a real Studio Web export: UI activities nested inside a
    // Use Application/Browser card must declare ScopeIdentifier (matching the
    // card's ScopeGuid) and HealingAgentBehavior="SameAsCard", or Studio Web
    // doesn't treat them as properly scoped to that card.
    extra.push(`ScopeIdentifier="${escapeAttr(activeScopeGuid)}"`);
    extra.push(`HealingAgentBehavior="SameAsCard"`);
  }
  if (activity.type === 'UI.GetText' || activity.type === 'UI.GetAttribute') {
    const resultVar = String(
      props.result || (activity.type === 'UI.GetAttribute' ? 'attributeValue' : 'extractedText')
    ).replace(/^\[|\]$/g, '');
    if (resultVar) {
      extra.push(`Result="[${escapeAttr(resultVar)}]"`);
    }
  }
  if (
    activity.type === 'UI.Click' ||
    activity.type === 'UI.TypeInto' ||
    activity.type === 'UI.GetText' ||
    activity.type === 'UI.Hover' ||
    activity.type === 'UI.Check' ||
    activity.type === 'UI.SelectItem'
  ) {
    const timeout = Number(props.timeoutMs);
    if (Number.isFinite(timeout) && timeout > 0) {
      extra.push(`TimeoutMS="${timeout}"`);
    }
  }

  const supportsInputMethod =
    activity.type === 'UI.Click' ||
    activity.type === 'UI.TypeInto' ||
    activity.type === 'UI.Hover' ||
    activity.type === 'UI.Check' ||
    activity.type === 'UI.SelectItem' ||
    activity.type === 'UI.GetText';
  if (supportsInputMethod) {
    // Real Studio Web sample: a Click left with no explicit interaction mode,
    // nested inside a Use Application/Browser card, exports InteractionMode="SameAsCard"
    // — not "Simulate". Only changes the *default* used when the user hasn't picked
    // something explicit (props.inputMethod); an explicit choice is never overridden.
    const fallback =
      activeScopeGuid && !props.inputMethod
        ? 'Same as App/Browser'
        : activity.type === 'UI.Click' ||
            activity.type === 'UI.TypeInto' ||
            activity.type === 'UI.GetText'
          ? 'Simulate'
          : 'Same as App/Browser';
    let inputAttr = interactionModeAttribute(props, fallback).trim();
    // Portable only supports Simulate + Chromium API (DebuggerApi) + SameAsCard
    if (
      isPortableExport() &&
      /InteractionMode="(WindowMessages|HardwareEvents|Background)"/.test(inputAttr)
    ) {
      inputAttr = 'InteractionMode="Simulate"';
    }
    if (inputAttr) {
      extra.push(inputAttr);
    }
  }

  const openTag = open;
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

/** Modern Check App State — replaces classic ElementExists / OnElementAppear. */
function renderCheckAppState(activity: ActivityNode, pad: string): string {
  const props = applyWindowsSelectorsToActivityProps(activity.properties || {});
  const selAttr = selectorAttribute(props);
  const timeout = Number(props.timeoutMs ?? (activity.type === 'UI.WaitElement' ? 30000 : 5000));
  const resultVar = String(props.result || 'exists').replace(/^\[|\]$/g, '');
  const vanish =
    activity.type === 'UI.WaitElement' &&
    /vanish|disappear/i.test(String(props.action || ''));
  const attrs = [
    `DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}"`,
    selAttr.trim(),
    Number.isFinite(timeout) && timeout > 0 ? `TimeoutMS="${timeout}"` : '',
    resultVar ? `Result="[${escapeAttr(resultVar)}]"` : '',
    vanish ? 'Appearance="Disappear"' : ''
  ]
    .filter(Boolean)
    .join(' ');
  return `${pad}<uix:NCheckState ${attrs} />`;
}

function renderExcelActivity(activity: ActivityNode, pad: string, indent = 0): string {
  const path = escapeAttr(String(activity.properties.workbookPath || 'data.xlsx'));
  const sheet = escapeAttr(String(activity.properties.sheetName || 'Sheet1'));
  const range = escapeAttr(String(activity.properties.range || ''));
  const cell = escapeAttr(String(activity.properties.cell || 'A1'));
  switch (activity.type) {
    case 'Excel.ReadRange': {
      const display = escapeAttr(exportDisplayName(activity.displayName));
      const resultVar = String(activity.properties.result || 'dt').replace(/^\[|\]$/g, '').trim();
      const rawPath = String(activity.properties.workbookPath || 'data.xlsx').trim();
      const looksLikeVariable = /^[A-Za-z_][A-Za-z0-9_]*$/.test(rawPath);
      const sheetAttr = ` SheetName="${sheet}"`;
      const rangeAttr = range ? ` Range="${range}"` : '';
      const dataTableAttr = resultVar ? ` DataTable="[${escapeAttr(resultVar)}]"` : '';
      if (looksLikeVariable) {
        // Confirmed against a real Studio Web export: modern ReadRange takes an
        // IResource, not a plain path string — CType-cast a Resource-typed variable.
        return `${pad}<ui:ReadRange DisplayName="${display}" AddHeaders="True" WorkbookPathResource="[CType(${escapeAttr(rawPath)}, UiPath.Platform.ResourceHandling.IResource)]"${sheetAttr}${rangeAttr}${dataTableAttr} />`;
      }
      // UNVERIFIED: rawPath looks like a literal file path string rather than a
      // Resource-typed variable, and I don't have a confirmed way to construct an
      // IResource from a literal path (guessing a ResourceInfo constructor here
      // risks shipping XAML that fails to compile in Studio Web, worse than this
      // fallback). Keeping classic WorkbookPath as best-effort. If Excel Read Range
      // with a literal path still fails to load, capture a real sample configured
      // that way and this branch can be corrected properly.
      return `${pad}<ui:ReadRange DisplayName="${display}" AddHeaders="True" WorkbookPath="${path}"${sheetAttr}${rangeAttr}${dataTableAttr} />`;
    }
    case 'Excel.WriteRange':
      return `${pad}<ui:WriteRange DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" SheetName="${sheet}" DataTable="[${escapeAttr(String(activity.properties.data || 'dt'))}]" />`;
    case 'Excel.AppendRange':
      return `${pad}<ui:AppendRange DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" SheetName="${sheet}" DataTable="[${escapeAttr(String(activity.properties.data || 'dt'))}]" />`;
    case 'Excel.ExcelApplicationScope': {
      if (isPortableExport()) {
        const kids = (activity.children || []).map((c) => renderActivity(c, indent + 1)).join('\n');
        return `${pad}<Sequence DisplayName="${escapeAttr(exportDisplayName(activity.displayName))} (Portable — no Excel Scope)">
${pad}  <ui:Comment Text="${escapeAttr('Excel Application Scope is Windows-only. Nested workbook steps follow; open workbook activities in Studio Web if needed. Path: ' + String(activity.properties.workbookPath || 'data.xlsx'))}" />
${kids}
${pad}</Sequence>`;
      }
      const kids = (activity.children || []).map((c) => renderActivity(c, indent + 2)).join('\n');
      const create = activity.properties.createIfNotExists === false || activity.properties.createIfNotExists === 'false' ? 'False' : 'True';
      return `${pad}<ui:ExcelApplicationScope DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" CreateNewFile="${create}">
${pad}  <ui:ExcelApplicationScope.Body>
${pad}    <ActivityAction>
${pad}      <Sequence>
${kids}
${pad}      </Sequence>
${pad}    </ActivityAction>
${pad}  </ui:ExcelApplicationScope.Body>
${pad}</ui:ExcelApplicationScope>`;
    }
    case 'Excel.ReadCell':
      return `${pad}<ui:ReadCell DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" SheetName="${sheet}" Cell="${cell}" />`;
    case 'Excel.WriteCell':
      return `${pad}<ui:WriteCell DisplayName="${escapeAttr(exportDisplayName(activity.displayName))}" WorkbookPath="${path}" SheetName="${sheet}" Cell="${cell}" Value="[${escapeAttr(String(activity.properties.value ?? '""'))}]" />`;
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

