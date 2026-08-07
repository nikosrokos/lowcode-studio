import { XMLParser } from 'fast-xml-parser';
import {
  ActivityNode,
  ArgumentDirection,
  VariableType,
  WorkflowArgument,
  WorkflowDocument,
  WorkflowVariable,
  newId
} from '../models/workflow';
import { normalizeWorkflowDocument } from './activityNormalize';
import { lcsTypeFromXamlName, unknownActivityType } from './activityMap';
import { applySelectorProps, extractSelectorProps } from './selectorRoundTrip';
import { fromXamlInteractionMode } from './inputMethod';
import { fromVbStringArgument, normalizeLogLevel } from './xamlExport';
import { formatArgumentMappings } from './workflowArguments';

export interface ImportWarning {
  message: string;
}

export interface XamlImportResult {
  workflow: WorkflowDocument;
  warnings: ImportWarning[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  removeNSPrefix: true,
  textNodeName: '#text',
  isArray: (name) => {
    const listish = new Set([
      'Variable',
      'ActivityAction',
      'Catch',
      'FlowStep',
      'FlowDecision',
      'FlowSwitch',
      'State',
      'Transition'
    ]);
    return listish.has(name);
  }
});

export function importXaml(xamlText: string, workflowName = 'Imported'): XamlImportResult {
  const warnings: ImportWarning[] = [];
  const cleaned = stripBom(xamlText);
  let root: unknown;
  try {
    root = parser.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Failed to parse XAML: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const activityRoot = findActivityRoot(root);
  if (!activityRoot) {
    throw new Error('No Activity root found in XAML.');
  }

  const variables = extractVariables(activityRoot, warnings);
  const argumentsList = extractWorkflowArguments(activityRoot);
  const body = unwrapBody(activityRoot);
  const flowchart = findFirstByName(body, 'Flowchart');

  if (flowchart) {
    const { activities, connections, startActivityId } = importFlowchart(
      flowchart,
      warnings
    );
    return {
      workflow: normalizeWorkflowDocument({
        schemaVersion: '1.0',
        name: workflowName,
        description: 'Imported from UiPath XAML (Flowchart)',
        type: 'Flowchart',
        variables,
        arguments: argumentsList,
        activities,
        connections,
        startActivityId,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          template: 'imported-uipath'
        }
      }),
      warnings
    };
  }

  const activities = collectActivities(body, warnings);
  return {
    workflow: normalizeWorkflowDocument({
      schemaVersion: '1.0',
      name: workflowName,
      description: 'Imported from UiPath XAML',
      type: 'Sequence',
      variables,
      arguments: argumentsList,
      activities:
        activities.length > 0
          ? activities
          : [
              {
                id: newId(),
                type: 'System.Comment',
                displayName: 'Empty import',
                properties: { text: 'No recognizable activities were found in this XAML.' }
              }
            ],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        template: 'imported-uipath'
      }
    }),
    warnings
  };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function findActivityRoot(parsed: unknown): Record<string, unknown> | undefined {
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.Activity && typeof obj.Activity === 'object') {
    return obj.Activity as Record<string, unknown>;
  }
  // Some files use root Sequence / Flowchart directly
  if (obj.Sequence || obj.Flowchart) {
    return obj;
  }
  const first = Object.values(obj)[0];
  if (first && typeof first === 'object') {
    return first as Record<string, unknown>;
  }
  return undefined;
}

function unwrapBody(node: Record<string, unknown>): Record<string, unknown> {
  // Prefer Sequence / Flowchart child under Activity
  if (node.Sequence && typeof node.Sequence === 'object') {
    return { Sequence: node.Sequence };
  }
  if (node.Flowchart && typeof node.Flowchart === 'object') {
    return { Flowchart: node.Flowchart };
  }
  return node;
}

function extractVariables(
  root: Record<string, unknown>,
  warnings: ImportWarning[]
): WorkflowVariable[] {
  const vars: WorkflowVariable[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (key.endsWith('.Variables') || key === 'Variables') {
        const bag = value as Record<string, unknown>;
        const list = asArray(bag?.Variable) as Array<Record<string, unknown>>;
        for (const v of list) {
          const name = String(v['@_Name'] || v['@_x:Name'] || '').trim();
          if (!name || seen.has(name)) {
            continue;
          }
          seen.add(name);
          const typeArg = String(v['@_TypeArguments'] || v['@_x:TypeArguments'] || 'String');
          vars.push({
            name,
            type: mapType(typeArg),
            defaultValue: cleanLiteral(v['@_Default'])
          });
        }
      } else {
        visit(value);
      }
    }
  };

  visit(root);
  if (!vars.length) {
    warnings.push({ message: 'No variables found in XAML (or they use an unsupported shape).' });
  }
  return vars;
}

function extractWorkflowArguments(root: Record<string, unknown>): WorkflowArgument[] {
  const args: WorkflowArgument[] = [];
  const members = root['Members'] || root['x:Members'];
  if (!members || typeof members !== 'object') {
    return args;
  }
  const bag = members as Record<string, unknown>;
  const list = asArray(bag.Property || bag['x:Property']) as Array<Record<string, unknown>>;
  for (const p of list) {
    const name = String(p['@_Name'] || '').trim();
    if (!name) {
      continue;
    }
    const typeRaw = String(p['@_Type'] || 'InArgument(x:String)');
    let direction: ArgumentDirection = 'In';
    if (/^OutArgument/i.test(typeRaw)) {
      direction = 'Out';
    } else if (/^InOutArgument/i.test(typeRaw)) {
      direction = 'InOut';
    }
    const inner = typeRaw.replace(/^(In|Out|InOut)Argument\((.+)\)$/i, '$2');
    args.push({
      name,
      type: mapType(inner),
      direction
    });
  }
  return args;
}

/** Pull InvokeWorkflowFile.Arguments dictionary into multiline mappings. */
function extractInvokeArgumentMappings(raw: Record<string, unknown>): string {
  const bag =
    raw['InvokeWorkflowFile.Arguments'] ||
    raw['Arguments'] ||
    (raw as { Arguments?: unknown }).Arguments;
  if (!bag || typeof bag !== 'object') {
    return '';
  }
  const mappings: Array<{
    name: string;
    expression: string;
    direction?: 'In' | 'Out' | 'InOut';
  }> = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'InArgument' || key === 'OutArgument' || key === 'InOutArgument') {
        const direction =
          key === 'OutArgument' ? 'Out' : key === 'InOutArgument' ? 'InOut' : 'In';
        for (const arg of asArray(value) as Array<Record<string, unknown> | string>) {
          if (typeof arg === 'string') {
            continue;
          }
          const name = String(arg['@_Key'] || arg['@_x:Key'] || '').trim();
          if (!name) {
            continue;
          }
          const expr = cleanExpr(argumentValue(arg) ?? arg['#text'] ?? '');
          mappings.push({
            name,
            expression: String(expr || '""'),
            direction
          });
        }
      } else if (!key.startsWith('@_')) {
        visit(value);
      }
    }
  };
  visit(bag);
  return formatArgumentMappings(mappings);
}

function collectActivities(
  node: unknown,
  warnings: ImportWarning[],
  depth = 0
): ActivityNode[] {
  if (!node || typeof node !== 'object') {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap((n) => collectActivities(n, warnings, depth));
  }

  const obj = node as Record<string, unknown>;
  const results: ActivityNode[] = [];

  // Body wrappers are often a lone <Sequence> — dive in so container.children
  // get the real activities. When Sequence is a sibling among other activities
  // (Studio Web Main), keep every sibling (do not early-return).
  const activityKeys = Object.keys(obj).filter((key) => {
    if (key.startsWith('@_') || key === '#text' || key.endsWith('.Variables')) {
      return false;
    }
    if (
      key.endsWith('.ViewState') ||
      key.endsWith('.HintSize') ||
      key === 'WorkflowViewStateService.ViewState'
    ) {
      return false;
    }
    if (key.includes('.')) {
      return false;
    }
    return true;
  });
  if (activityKeys.length === 1 && activityKeys[0] === 'Sequence') {
    return collectActivities(obj.Sequence, warnings, depth);
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@_') || key === '#text' || key.endsWith('.Variables')) {
      continue;
    }
    if (key.endsWith('.ViewState') || key.endsWith('.HintSize') || key === 'WorkflowViewStateService.ViewState') {
      continue;
    }

    // Property element wrappers: If.Then / If.Else / TryCatch.Try / Assign.To
    if (key.includes('.')) {
      continue;
    }

    const nodes = asArray(value);
    for (const raw of nodes) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      // ActivityAction is WF4 delegate plumbing (used by ForEach.Body,
      // NApplicationCard.Body, RetryScope, TimeoutScope, ParallelForEach, etc.) —
      // not a real activity. Its actual children sit under a bare <Sequence> sibling
      // to <ActivityAction.Argument>, which mapActivity has no way to find (it only
      // checks raw['Body']/raw['Activity']/raw['Then']/raw['<Type>.Body'] for unknown
      // types). Recursing here instead of mapping it means we land back on the
      // Sequence-unwrap shortcut above and actually see the real children, rather
      // than dropping them and emitting an empty "ActivityAction (imported)" node.
      if (key === 'ActivityAction') {
        results.push(...collectActivities(raw as Record<string, unknown>, warnings, depth + 1));
        continue;
      }
      const activity = mapActivity(key, raw as Record<string, unknown>, warnings);
      if (activity) {
        results.push(activity);
      }
    }
  }

  return results;
}

function mapActivity(
  localName: string,
  raw: Record<string, unknown>,
  warnings: ImportWarning[]
): ActivityNode | undefined {
  const displayName = String(raw['@_DisplayName'] || localName);

  // Studio Web start triggers — keep out of LCS canvas (re-exporting them as Comments breaks Main.xaml)
  if (isStudioWebTriggerLocalName(localName, displayName)) {
    warnings.push({
      message: `Skipped Studio Web trigger "${displayName}" (${localName}) — not needed in LowCode Studio.`
    });
    return undefined;
  }

  const mapped = lcsTypeFromXamlName(localName);

  if (localName === 'Sequence') {
    return {
      id: newId(),
      type: 'ControlFlow.Sequence',
      displayName,
      properties: {},
      children: collectActivities(raw, warnings)
    };
  }

  if (localName === 'If') {
    const thenNode = raw['Then'] || raw['If.Then'];
    const elseNode = raw['Else'] || raw['If.Else'];
    return {
      id: newId(),
      type: 'ControlFlow.If',
      displayName,
      properties: {
        condition: cleanExpr(raw['@_Condition'] ?? extractArgument(raw, 'Condition') ?? 'true')
      },
      children: collectActivities(thenNode, warnings),
      elseChildren: collectActivities(elseNode, warnings)
    };
  }

  if (localName === 'While' || localName === 'DoWhile') {
    return {
      id: newId(),
      type: localName === 'DoWhile' ? 'ControlFlow.DoWhile' : 'ControlFlow.While',
      displayName,
      properties: {
        condition: cleanExpr(raw['@_Condition'] ?? extractArgument(raw, 'Condition') ?? 'true')
      },
      children: collectActivities(raw['Body'] || raw[`${localName}.Body`] || raw, warnings).filter(
        (a) => a.type !== 'ControlFlow.While' && a.type !== 'ControlFlow.DoWhile'
      )
    };
  }

  if (localName === 'RetryScope') {
    return {
      id: newId(),
      type: 'ControlFlow.RetryScope',
      displayName,
      properties: {
        numberOfRetries: Number(raw['@_NumberOfRetries'] ?? 3),
        retryIntervalMs: parseDurationMs(String(raw['@_RetryInterval'] || '00:00:01'))
      },
      children: collectActivities(raw['Activity'] || raw['RetryScope.Activity'] || raw, warnings)
    };
  }

  if (localName === 'Break') {
    return {
      id: newId(),
      type: 'ControlFlow.Break',
      displayName,
      properties: {}
    };
  }

  if (localName === 'Continue') {
    return {
      id: newId(),
      type: 'ControlFlow.Continue',
      displayName,
      properties: {}
    };
  }

  if (localName === 'MessageBox') {
    return {
      id: newId(),
      type: 'System.MessageBox',
      displayName,
      properties: {
        text: cleanExpr(raw['@_Text'] ?? extractArgument(raw, 'Text') ?? '"Hello"'),
        title: cleanExpr(raw['@_Caption'] ?? raw['@_Title'] ?? 'LowCode Studio')
      }
    };
  }

  if (localName === 'WriteLine') {
    return {
      id: newId(),
      type: 'System.WriteLine',
      displayName,
      properties: {
        text: cleanExpr(raw['@_Text'] ?? extractArgument(raw, 'Text') ?? '""')
      }
    };
  }

  if (localName === 'ForEach') {
    return {
      id: newId(),
      type: 'ControlFlow.ForEach',
      displayName,
      properties: {
        item: String(raw['@_DisplayName'] ? 'item' : 'item'),
        values: cleanExpr(raw['@_Values'] ?? extractArgument(raw, 'Values') ?? 'collection')
      },
      children: collectActivities(raw['Body'] || raw['ForEach.Body'] || raw, warnings)
    };
  }

  if (localName === 'TryCatch') {
    return {
      id: newId(),
      type: 'ControlFlow.TryCatch',
      displayName,
      properties: {
        exceptionType: 'System.Exception'
      },
      children: collectActivities(raw['Try'] || raw['TryCatch.Try'], warnings),
      elseChildren: collectActivities(raw['Catches'] || raw['TryCatch.Catches'], warnings)
    };
  }

  if (localName === 'Assign') {
    const to = cleanExpr(extractArgument(raw, 'To') ?? raw['@_To'] ?? 'variable');
    const value = cleanExpr(extractArgument(raw, 'Value') ?? raw['@_Value'] ?? '""');
    return {
      id: newId(),
      type: 'Programming.Assign',
      displayName,
      properties: { to: stripBrackets(to), value }
    };
  }

  if (localName === 'LogMessage') {
    return {
      id: newId(),
      type: 'System.LogMessage',
      displayName,
      properties: {
        message: fromVbStringArgument(
          cleanExpr(raw['@_Message'] ?? extractArgument(raw, 'Message') ?? '')
        ),
        level: normalizeLogLevel(raw['@_Level'] || extractArgument(raw, 'Level') || 'Info')
      }
    };
  }

  if (localName === 'Delay') {
    const duration = String(raw['@_Duration'] || '00:00:01');
    return {
      id: newId(),
      type: 'System.Delay',
      displayName,
      properties: { durationMs: parseDurationMs(duration) }
    };
  }

  if (localName === 'InvokeWorkflowFile') {
    const mappings = extractInvokeArgumentMappings(raw);
    return {
      id: newId(),
      type: 'REFramework.InvokeWorkflow',
      displayName,
      properties: {
        workflowPath: String(raw['@_WorkflowFileName'] || raw['@_FilePath'] || 'Workflow.xaml'),
        argumentMappings: mappings,
        description: displayName
      }
    };
  }

  if (localName === 'PythonScope') {
    return {
      id: newId(),
      type: 'Python.PythonScope',
      displayName,
      properties: {
        path: cleanExpr(raw['@_Path'] || extractArgument(raw, 'Path') || ''),
        libraryPath: cleanExpr(raw['@_LibraryPath'] || extractArgument(raw, 'LibraryPath') || ''),
        target: String(raw['@_Target'] || 'x64'),
        workingFolder: cleanExpr(
          raw['@_WorkingFolder'] || extractArgument(raw, 'WorkingFolder') || ''
        ),
        version: cleanExpr(raw['@_Version'] || '')
      },
      children: collectActivities(raw, warnings)
    };
  }

  if (localName === 'LoadScript' || localName === 'LoadPythonScript') {
    return {
      id: newId(),
      type: 'Python.LoadScript',
      displayName,
      properties: {
        file: cleanExpr(raw['@_File'] || extractArgument(raw, 'File') || ''),
        code: cleanExpr(raw['@_Code'] || extractArgument(raw, 'Code') || ''),
        result: stripBrackets(
          cleanExpr(raw['@_Result'] || extractArgument(raw, 'Result') || 'pythonScript')
        )
      }
    };
  }

  if (localName === 'RunScript' || localName === 'RunPythonScript') {
    return {
      id: newId(),
      type: 'Python.RunScript',
      displayName,
      properties: {
        file: cleanExpr(raw['@_File'] || extractArgument(raw, 'File') || ''),
        code: cleanExpr(raw['@_Code'] || extractArgument(raw, 'Code') || '')
      }
    };
  }

  if (
    localName === 'InvokePythonMethod' ||
    (localName === 'InvokeMethod' &&
      (raw['@_Instance'] != null ||
        extractArgument(raw, 'Instance') != null ||
        raw['@_Name'] != null))
  ) {
    // Prefer Python InvokeMethod when Instance/Name present (UiPath.Python.Activities)
    if (localName === 'InvokePythonMethod' || extractArgument(raw, 'Instance') != null || raw['@_Instance'] != null) {
      return {
        id: newId(),
        type: 'Python.InvokeMethod',
        displayName,
        properties: {
          instance: stripBrackets(
            cleanExpr(raw['@_Instance'] || extractArgument(raw, 'Instance') || 'pythonScript')
          ),
          name: cleanExpr(raw['@_Name'] || extractArgument(raw, 'Name') || 'main'),
          inputParameters: cleanExpr(
            raw['@_InputParameters'] || extractArgument(raw, 'InputParameters') || '{}'
          ),
          result: stripBrackets(
            cleanExpr(raw['@_Result'] || extractArgument(raw, 'Result') || 'pythonResult')
          )
        }
      };
    }
  }

  if (localName === 'GetPythonObject' || localName === 'GetObject') {
    return {
      id: newId(),
      type: 'Python.GetObject',
      displayName,
      properties: {
        pythonObject: stripBrackets(
          cleanExpr(
            raw['@_PythonObject'] ||
              extractArgument(raw, 'PythonObject') ||
              extractArgument(raw, 'Input') ||
              'pythonResult'
          )
        ),
        type: String(raw['@_Type'] || 'String').replace(/^.*\./, ''),
        result: stripBrackets(
          cleanExpr(raw['@_Result'] || extractArgument(raw, 'Result') || 'netValue')
        )
      }
    };
  }

  if (localName === 'InvokeCode') {
    return {
      id: newId(),
      type: 'Programming.InvokeCode',
      displayName,
      properties: {
        code: cleanExpr(
          raw['@_Code'] ||
            extractArgument(raw, 'Code') ||
            (typeof raw.Code === 'string' ? raw.Code : '') ||
            'Console.WriteLine("Hello");'
        ),
        language: String(raw['@_Language'] || raw['@_CodeLanguage'] || 'CSharp')
          .replace('CodeLanguage.', '')
          .replace('InvokeCodeLanguage.', ''),
        arguments: cleanExpr(
          raw['@_Arguments'] || extractArgument(raw, 'Arguments') || ''
        )
      }
    };
  }

  if (localName === 'MultipleAssign') {
    const assignments = extractMultipleAssignLines(raw);
    return {
      id: newId(),
      type: 'Programming.MultipleAssign',
      displayName,
      properties: {
        assignments: assignments.length ? assignments.join('\n') : 'variable = ""'
      }
    };
  }

  if (localName === 'Throw') {
    return {
      id: newId(),
      type: 'System.Throw',
      displayName,
      properties: {
        exceptionType: String(
          raw['@_ExceptionType'] ||
            extractArgument(raw, 'Exception') ||
            'System.Exception'
        )
          .replace(/^\[/, '')
          .replace(/\]$/, ''),
        message: cleanExpr(
          raw['@_Exception'] ||
            extractArgument(raw, 'Exception') ||
            '"An error occurred"'
        )
      }
    };
  }

  if (localName === 'TerminateWorkflow') {
    return {
      id: newId(),
      type: 'System.TerminateWorkflow',
      displayName,
      properties: {
        reason: cleanExpr(
          raw['@_Reason'] || extractArgument(raw, 'Reason') || '"Terminated"'
        )
      }
    };
  }

  if (localName === 'Switch') {
    const caseKeys: string[] = [];
    const visitCases = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(visitCases);
        return;
      }
      const obj = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'Case' || k === 'Switch.Case') {
          for (const c of asArray(v) as Array<Record<string, unknown>>) {
            const key = String(c['@_Key'] || c['@_x:Key'] || '').trim();
            if (key) caseKeys.push(key);
          }
        } else if (!k.startsWith('@_')) {
          visitCases(v);
        }
      }
    };
    visitCases(raw);
    if (!caseKeys.includes('Default')) caseKeys.push('Default');
    return {
      id: newId(),
      type: 'ControlFlow.Switch',
      displayName,
      properties: {
        expression: cleanExpr(
          raw['@_Expression'] || extractArgument(raw, 'Expression') || 'status'
        ),
        cases: caseKeys.join(',') || 'Default'
      },
      children: collectActivities(
        raw['Default'] || raw['Switch.Default'] || raw,
        warnings
      )
    };
  }

  if (localName === 'Parallel') {
    return {
      id: newId(),
      type: 'ControlFlow.Parallel',
      displayName,
      properties: {},
      children: collectActivities(raw, warnings)
    };
  }

  if (localName === 'ParallelForEach') {
    return {
      id: newId(),
      type: 'ControlFlow.ParallelForEach',
      displayName,
      properties: {
        item: stripBrackets(
          cleanExpr(raw['@_Item'] || extractArgument(raw, 'Item') || 'item')
        ),
        values: stripBrackets(
          cleanExpr(raw['@_Values'] || extractArgument(raw, 'Values') || 'collection')
        )
      },
      children: collectActivities(raw['Body'] || raw['Action'] || raw, warnings)
    };
  }

  if (localName === 'TimeoutScope') {
    return {
      id: newId(),
      type: 'ControlFlow.TimeoutScope',
      displayName,
      properties: {
        timeoutMs: parseDurationMs(String(raw['@_Timeout'] || '00:00:30'))
      },
      children: collectActivities(raw['Body'] || raw['TimeoutScope.Body'] || raw, warnings)
    };
  }

  if (localName === 'JoinDataTables' || localName === 'JoinDataTable') {
    return {
      id: newId(),
      type: 'Data.JoinDataTable',
      displayName,
      properties: {
        dataTable1: stripBrackets(cleanExpr(raw['@_DataTable1'] || extractArgument(raw, 'DataTable1') || 'dtLeft')),
        dataTable2: stripBrackets(cleanExpr(raw['@_DataTable2'] || extractArgument(raw, 'DataTable2') || 'dtRight')),
        joinType: String(raw['@_JoinType'] || 'Inner'),
        column1: cleanExpr(raw['@_Column1'] || extractArgument(raw, 'Column1') || 'Id'),
        column2: cleanExpr(raw['@_Column2'] || extractArgument(raw, 'Column2') || 'Id'),
        result: stripBrackets(cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'joinedDt'))
      }
    };
  }

  if (localName === 'LookupDataTable') {
    return {
      id: newId(),
      type: 'Data.LookupDataTable',
      displayName,
      properties: {
        dataTable: stripBrackets(cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')),
        lookupColumn: cleanExpr(raw['@_LookupColumnName'] || extractArgument(raw, 'LookupColumnName') || 'Id'),
        lookupValue: cleanExpr(raw['@_LookupValue'] || extractArgument(raw, 'LookupValue') || '""'),
        targetColumn: cleanExpr(raw['@_TargetColumnName'] || extractArgument(raw, 'TargetColumnName') || 'Name'),
        result: stripBrackets(cleanExpr(raw['@_Value'] || extractArgument(raw, 'Value') || 'lookupResult'))
      }
    };
  }

  if (localName === 'SortDataTable') {
    return {
      id: newId(),
      type: 'Data.SortDataTable',
      displayName,
      properties: {
        dataTable: stripBrackets(cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')),
        columnName: cleanExpr(raw['@_ColumnName'] || extractArgument(raw, 'ColumnName') || 'Id'),
        order: String(raw['@_Order'] || 'Ascending'),
        result: stripBrackets(cleanExpr(raw['@_SortDataTable'] || extractArgument(raw, 'SortDataTable') || 'sortedDt'))
      }
    };
  }

  if (localName === 'GetQueueItem' || localName === 'GetTransactionItem') {
    return {
      id: newId(),
      type: 'Orchestrator.GetTransactionItem',
      displayName,
      properties: {
        queueName: cleanExpr(raw['@_QueueName'] || extractArgument(raw, 'QueueName') || 'MainQueue'),
        folderPath: cleanExpr(raw['@_FolderPath'] || extractArgument(raw, 'FolderPath') || ''),
        reference: cleanExpr(raw['@_Reference'] || extractArgument(raw, 'Reference') || ''),
        result: stripBrackets(cleanExpr(raw['@_TransactionItem'] || extractArgument(raw, 'TransactionItem') || 'TransactionItem'))
      }
    };
  }

  if (localName === 'AddQueueItem') {
    return {
      id: newId(),
      type: 'Orchestrator.AddQueueItem',
      displayName,
      properties: {
        queueName: cleanExpr(raw['@_QueueName'] || extractArgument(raw, 'QueueName') || 'MainQueue'),
        folderPath: cleanExpr(raw['@_FolderPath'] || extractArgument(raw, 'FolderPath') || ''),
        reference: cleanExpr(raw['@_Reference'] || extractArgument(raw, 'Reference') || '""'),
        itemInformation: cleanExpr(raw['@_ItemInformation'] || extractArgument(raw, 'ItemInformation') || '{}'),
        priority: String(raw['@_Priority'] || 'Normal')
      }
    };
  }

  if (localName === 'GetRobotAsset' || localName === 'GetAsset') {
    return {
      id: newId(),
      type: 'Orchestrator.GetAsset',
      displayName,
      properties: {
        assetName: cleanExpr(raw['@_AssetName'] || extractArgument(raw, 'AssetName') || 'AssetName'),
        folderPath: cleanExpr(raw['@_FolderPath'] || extractArgument(raw, 'FolderPath') || ''),
        result: stripBrackets(cleanExpr(raw['@_Value'] || extractArgument(raw, 'Value') || 'assetValue'))
      }
    };
  }

  if (localName === 'GetCredential' || localName === 'GetOrchestratorCredential') {
    return {
      id: newId(),
      type: 'Orchestrator.GetCredential',
      displayName,
      properties: {
        assetName: cleanExpr(
          raw['@_AssetName'] ||
            raw['@_CredentialName'] ||
            extractArgument(raw, 'AssetName') ||
            extractArgument(raw, 'CredentialName') ||
            'Credential'
        ),
        folderPath: cleanExpr(raw['@_FolderPath'] || extractArgument(raw, 'FolderPath') || ''),
        username: stripBrackets(
          cleanExpr(raw['@_Username'] || extractArgument(raw, 'Username') || 'username')
        ),
        password: stripBrackets(
          cleanExpr(raw['@_Password'] || extractArgument(raw, 'Password') || 'password')
        )
      }
    };
  }

  if (localName === 'WaitQueueItem') {
    return {
      id: newId(),
      type: 'Orchestrator.WaitQueueItem',
      displayName,
      properties: {
        queueName: cleanExpr(raw['@_QueueName'] || extractArgument(raw, 'QueueName') || 'MainQueue'),
        folderPath: cleanExpr(raw['@_FolderPath'] || extractArgument(raw, 'FolderPath') || ''),
        timeoutMs: Number(raw['@_TimeoutMS'] || raw['@_Timeout'] || extractArgument(raw, 'TimeoutMS') || 60000),
        result: stripBrackets(
          cleanExpr(
            raw['@_TransactionItem'] ||
              raw['@_Result'] ||
              extractArgument(raw, 'TransactionItem') ||
              'TransactionItem'
          )
        )
      }
    };
  }

  if (localName === 'SetAsset') {
    return {
      id: newId(),
      type: 'Orchestrator.SetAsset',
      displayName,
      properties: {
        assetName: cleanExpr(raw['@_AssetName'] || extractArgument(raw, 'AssetName') || 'AssetName'),
        value: cleanExpr(raw['@_Value'] || extractArgument(raw, 'Value') || '""'),
        folderPath: cleanExpr(raw['@_FolderPath'] || extractArgument(raw, 'FolderPath') || '')
      }
    };
  }

  if (localName === 'SetTransactionStatus') {
    return {
      id: newId(),
      type: 'REFramework.SetTransactionStatus',
      displayName,
      properties: {
        transactionItem: stripBrackets(cleanExpr(raw['@_TransactionItem'] || extractArgument(raw, 'TransactionItem') || 'TransactionItem')),
        status: String(raw['@_Status'] || raw['@_ErrorType'] || 'Success'),
        reason: cleanExpr(raw['@_Reason'] || extractArgument(raw, 'Reason') || '""')
      }
    };
  }

  if (localName === 'SelectToken' || localName === 'DeserializeAndSelectToken') {
    return {
      id: newId(),
      type: 'Messaging.SelectToken',
      displayName,
      properties: {
        json: stripBrackets(cleanExpr(raw['@_Json'] || extractArgument(raw, 'Json') || 'jsonObj')),
        path: cleanExpr(raw['@_Path'] || extractArgument(raw, 'Path') || 'data.id'),
        result: stripBrackets(cleanExpr(raw['@_Result'] || extractArgument(raw, 'Result') || 'tokenValue'))
      }
    };
  }

  if (
    localName === 'GetIMAPMailMessages' ||
    localName === 'GetOutlookMailMessages' ||
    localName === 'GetPOP3MailMessages' ||
    localName === 'GetEmail' ||
    localName === 'GetMail'
  ) {
    return {
      id: newId(),
      type: 'Messaging.GetEmail',
      displayName,
      properties: {
        mailFolder: cleanExpr(raw['@_MailFolder'] || extractArgument(raw, 'MailFolder') || 'Inbox'),
        top: Number(raw['@_Top'] || 10),
        filter: cleanExpr(raw['@_Filter'] || extractArgument(raw, 'Filter') || ''),
        result: stripBrackets(cleanExpr(raw['@_Messages'] || extractArgument(raw, 'Messages') || 'mails'))
      }
    };
  }

  if (localName === 'ForEachRow' || localName === 'ForEachRowX') {
    return {
      id: newId(),
      type: 'Data.ForEachRow',
      displayName,
      properties: {
        dataTable: stripBrackets(
          cleanExpr(
            raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt'
          )
        ),
        row: stripBrackets(
          cleanExpr(raw['@_CurrentIndex'] || extractArgument(raw, 'CurrentRow') || 'row')
        )
      },
      children: collectActivities(raw['Body'] || raw['ForEachRow.Body'] || raw, warnings)
    };
  }

  if (localName === 'AddDataRow') {
    return {
      id: newId(),
      type: 'Data.AddDataRow',
      displayName,
      properties: {
        dataTable: stripBrackets(
          cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')
        ),
        arrayRow: cleanExpr(
          raw['@_ArrayRow'] || extractArgument(raw, 'ArrayRow') || '[]'
        )
      }
    };
  }

  if (localName === 'AddDataColumn') {
    return {
      id: newId(),
      type: 'Data.AddDataColumn',
      displayName,
      properties: {
        dataTable: stripBrackets(
          cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')
        ),
        columnName: cleanExpr(
          raw['@_ColumnName'] || extractArgument(raw, 'ColumnName') || 'NewColumn'
        ),
        columnType: String(raw['@_ColumnType'] || 'String')
      }
    };
  }

  if (localName === 'FilterDataTable') {
    return {
      id: newId(),
      type: 'Data.FilterDataTable',
      displayName,
      properties: {
        dataTable: stripBrackets(
          cleanExpr(
            raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt'
          )
        ),
        columnName: cleanExpr(
          raw['@_ColumnName'] || extractArgument(raw, 'ColumnName') || 'Status'
        ),
        operator: String(raw['@_Operator'] || '='),
        value: cleanExpr(raw['@_Value'] || extractArgument(raw, 'Value') || '""'),
        result: stripBrackets(
          cleanExpr(
            raw['@_FilterRowsDataTable'] ||
              raw['@_DataTable'] ||
              extractArgument(raw, 'FilterRowsDataTable') ||
              'filteredDt'
          )
        )
      }
    };
  }

  if (localName === 'ClearDataTable') {
    return {
      id: newId(),
      type: 'Data.ClearDataTable',
      displayName,
      properties: {
        dataTable: stripBrackets(
          cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')
        )
      }
    };
  }

  if (localName === 'OutputDataTable') {
    return {
      id: newId(),
      type: 'Data.OutputDataTable',
      displayName,
      properties: {
        dataTable: stripBrackets(
          cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')
        ),
        result: stripBrackets(
          cleanExpr(raw['@_Text'] || extractArgument(raw, 'Text') || 'tableText')
        )
      }
    };
  }

  if (localName === 'DeserializeJson' || localName === 'DeserializeJsonActivity') {
    return {
      id: newId(),
      type: 'Messaging.DeserializeJson',
      displayName,
      properties: {
        jsonString: cleanExpr(
          raw['@_JsonString'] || extractArgument(raw, 'JsonString') || '"{}"'
        ),
        result: stripBrackets(
          cleanExpr(raw['@_JsonObject'] || extractArgument(raw, 'JsonObject') || 'jsonObj')
        )
      }
    };
  }

  if (localName === 'SerializeJson' || localName === 'SerializeJsonActivity') {
    return {
      id: newId(),
      type: 'Messaging.SerializeJson',
      displayName,
      properties: {
        value: stripBrackets(
          cleanExpr(raw['@_JsonObject'] || extractArgument(raw, 'JsonObject') || 'jsonObj')
        ),
        result: stripBrackets(
          cleanExpr(raw['@_JsonString'] || extractArgument(raw, 'JsonString') || 'jsonText')
        )
      }
    };
  }

  // Use Application/Browser — modern UI scope with nested body (must stay a container)
  if (
    localName === 'UseApplicationBrowser' ||
    localName === 'NApplicationCard' ||
    localName === 'ApplicationCard' ||
    localName === 'UseBrowser'
  ) {
    const kids = collectActivities(
      raw['Body'] ||
        raw['UseApplicationBrowser.Body'] ||
        raw['NApplicationCard.Body'] ||
        raw['ApplicationCard.Body'] ||
        raw,
      warnings
    );
    const targetApp = extractTargetApp(raw);
    const filePath = cleanExpr(
      targetApp.filePath ||
        raw['@_FilePath'] ||
        extractArgument(raw, 'FilePath') ||
        ''
    );
    const url = cleanExpr(
      targetApp.url ||
        raw['@_Url'] ||
        extractArgument(raw, 'Url') ||
        ''
    );
    const mode = filePath && !url ? 'Application' : 'Browser';
    const windowAttach = String(
      raw['@_AttachMode'] || extractArgument(raw, 'AttachMode') || ''
    );
    return {
      id: newId(),
      type: 'UI.UseApplicationBrowser',
      displayName,
      properties: applySelectorProps(
        {
          mode,
          urlOrPath: url || filePath || (mode === 'Browser' ? 'https://example.com' : ''),
          browserType: String(
            targetApp.browserType ||
              raw['@_BrowserType'] ||
              extractArgument(raw, 'BrowserType') ||
              'Chrome'
          ),
          open: String(raw['@_OpenMode'] || raw['@_Open'] || 'IfNotOpen'),
          close: String(raw['@_CloseMode'] || raw['@_Close'] || 'Never'),
          attachMode: /single/i.test(windowAttach)
            ? 'SingleWindow'
            : /instance|process/i.test(windowAttach)
              ? 'ByInstance'
              : undefined,
          inputMethod: fromXamlInteractionMode(
            String(raw['@_InteractionMode'] || extractArgument(raw, 'InteractionMode') || '')
          )
        },
        {
          ...extractSelectorProps(raw),
          ...(targetApp.selector ? { selector: targetApp.selector } : {})
        }
      ),
      children: kids.length ? kids : undefined
    };
  }

  // Classic Open Browser (non-scope) — keep as Open Application stub
  if (localName === 'OpenBrowser') {
    return {
      id: newId(),
      type: 'UI.OpenApplication',
      displayName,
      properties: {
        pathOrUrl: cleanExpr(
          raw['@_Url'] || extractArgument(raw, 'Url') || 'https://example.com'
        )
      }
    };
  }

  if (mapped) {
    const props = applySelectorProps(pickCommonProps(localName, raw, mapped), extractSelectorProps(raw));
    const node: ActivityNode = {
      id: newId(),
      type: mapped,
      displayName,
      properties: props
    };
    // Containers that may carry body children
    if (
      mapped === 'ControlFlow.RetryScope' ||
      mapped === 'UI.UseApplicationBrowser' ||
      mapped === 'UI.OpenApplication' ||
      mapped === 'Data.ForEachRow' ||
      mapped === 'ControlFlow.Switch' ||
      mapped === 'ControlFlow.Parallel' ||
      mapped === 'ControlFlow.ParallelForEach' ||
      mapped === 'ControlFlow.TimeoutScope' ||
      mapped === 'Excel.ExcelApplicationScope' ||
      mapped === 'UI.WaitElement'
    ) {
      const kids = collectActivities(
        raw['Body'] || raw['Activity'] || raw['Default'] || raw,
        warnings
      );
      if (kids.length) {
        node.children = kids;
      }
    }
    if (mapped === 'UI.GetAttribute') {
      node.properties.attribute = cleanExpr(
        raw['@_Attribute'] || extractArgument(raw, 'Attribute') || 'aaname'
      );
      node.properties.result = stripBrackets(
        cleanExpr(raw['@_Result'] || extractArgument(raw, 'Result') || 'attributeValue')
      );
    }
    if (mapped === 'UI.WaitElement') {
      const vanish = /vanish/i.test(localName);
      node.properties.action = vanish ? 'Vanish' : 'Appear';
      node.properties.timeoutMs = Number(raw['@_TimeoutMS'] || raw['@_Timeout'] || 30000);
    }
    return node;
  }

  warnings.push({
    message: `Unknown activity "${localName}" (${displayName}) imported as placeholder.`
  });
  const placeholderProps = applySelectorProps(
    {
      originalType: localName,
      hint: 'Best-effort import — configure or replace this step.'
    },
    extractSelectorProps(raw)
  );
  const node: ActivityNode = {
    id: newId(),
    type: unknownActivityType(localName),
    displayName: `${displayName} (imported)`,
    properties: placeholderProps
  };
  const body =
    raw['Body'] ||
    raw['Activity'] ||
    raw['Handler'] ||
    raw['Then'] ||
    raw[`${localName}.Body`] ||
    raw[`${localName}.Activity`];
  if (body) {
    const kids = collectActivities(body, warnings);
    if (kids.length) {
      node.children = kids;
    }
  }
  return node;
}

function importFlowchart(
  flowchart: Record<string, unknown>,
  warnings: ImportWarning[]
): {
  activities: ActivityNode[];
  connections: WorkflowDocument['connections'];
  startActivityId?: string;
} {
  const activities: ActivityNode[] = [];
  const connections: NonNullable<WorkflowDocument['connections']> = [];
  const start = node('Flowchart.Start', 'Start', {}, 280, 40);
  activities.push(start);

  // Flowchart children can be FlowStep / FlowDecision mixed
  const kids = Object.entries(flowchart).filter(
    ([k]) => !k.startsWith('@_') && !k.includes('.') && k !== '#text'
  );

  let y = 160;
  let prev = start.id;
  for (const [key, value] of kids) {
    for (const raw of asArray(value)) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const obj = raw as Record<string, unknown>;
      if (key === 'FlowDecision' || obj.Condition !== undefined || obj['@_Condition']) {
        const decision = node(
          'Flowchart.FlowDecision',
          String(obj['@_DisplayName'] || 'Flow Decision'),
          {
            condition: cleanExpr(obj['@_Condition'] ?? extractArgument(obj, 'Condition') ?? 'true')
          },
          250,
          y
        );
        activities.push(decision);
        connections.push({ id: newId('conn'), from: prev, to: decision.id, label: '' });
        prev = decision.id;
        y += 140;
        continue;
      }

      if (key === 'FlowSwitch' || obj['@_Expression'] !== undefined) {
        const local = key.includes(':') ? key.split(':').pop()! : key;
        if (local === 'FlowSwitch' || lcsTypeFromXamlName(local) === 'Flowchart.FlowSwitch') {
          const sw = node(
            'Flowchart.FlowSwitch',
            String(obj['@_DisplayName'] || 'Flow Switch'),
            pickCommonProps('FlowSwitch', obj, 'Flowchart.FlowSwitch'),
            250,
            y
          );
          activities.push(sw);
          connections.push({ id: newId('conn'), from: prev, to: sw.id, label: '' });
          prev = sw.id;
          y += 140;
          continue;
        }
      }

      // FlowStep usually wraps an activity under FlowStep.Action / Action
      const action =
        obj.Action ||
        obj['FlowStep.Action'] ||
        obj.Sequence ||
        obj;
      const mapped = collectActivities(action, warnings);
      if (!mapped.length) {
        const placeholder = node(
          'System.Comment',
          String(obj['@_DisplayName'] || key),
          { text: 'Imported flowchart step' },
          240,
          y
        );
        activities.push(placeholder);
        connections.push({ id: newId('conn'), from: prev, to: placeholder.id, label: '' });
        prev = placeholder.id;
      } else {
        const first = mapped[0];
        first.x = 240;
        first.y = y;
        activities.push(first);
        connections.push({ id: newId('conn'), from: prev, to: first.id, label: '' });
        prev = first.id;
      }
      y += 140;
    }
  }

  warnings.push({
    message:
      'Flowchart links are best-effort. Review True/False edges after import.'
  });

  return { activities, connections, startActivityId: start.id };
}

function pickCommonProps(
  localName: string,
  raw: Record<string, unknown>,
  mapped?: string
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const text = raw['@_Text'] || extractArgument(raw, 'Text');
  const url =
    raw['@_Url'] ||
    raw['@_FilePath'] ||
    raw['@_Path'] ||
    raw['@_WorkbookPath'] ||
    extractArgument(raw, 'Url') ||
    extractArgument(raw, 'FilePath') ||
    extractArgument(raw, 'WorkbookPath');
  const item = raw['@_Item'] || extractArgument(raw, 'Item');
  const result =
    raw['@_Result'] ||
    extractArgument(raw, 'Result') ||
    extractArgument(raw, 'DataTable');

  if (text) {
    props.text = cleanExpr(text);
  }
  if (item) {
    props.item = cleanExpr(item);
  }
  if (url) {
    if (mapped?.startsWith('Excel.')) {
      props.workbookPath = cleanExpr(url);
    } else if (mapped === 'UI.OpenApplication') {
      props.pathOrUrl = cleanExpr(url);
    } else {
      props.pathOrUrl = cleanExpr(url);
    }
  }

  if (mapped?.startsWith('Excel.')) {
    props.sheetName = cleanExpr(raw['@_SheetName'] || extractArgument(raw, 'SheetName') || 'Sheet1');
    props.range = cleanExpr(raw['@_Range'] || extractArgument(raw, 'Range') || '');
    props.cell = cleanExpr(raw['@_Cell'] || extractArgument(raw, 'Cell') || 'A1');
    if (result) {
      props.result = stripBrackets(cleanExpr(result));
    }
    if (mapped === 'Excel.WriteRange' || mapped === 'Excel.AppendRange') {
      props.data = stripBrackets(
        cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')
      );
    }
    if (mapped === 'Excel.WriteCell') {
      props.value = cleanExpr(raw['@_Value'] || extractArgument(raw, 'Value') || '""');
    }
    if (mapped === 'Excel.ExcelApplicationScope') {
      props.createIfNotExists = String(raw['@_CreateNewFile'] ?? 'True') !== 'False';
    }
  }

  if (mapped === 'UI.GetText' || mapped === 'UI.ElementExists') {
    props.result = stripBrackets(
      cleanExpr(result || (mapped === 'UI.ElementExists' ? 'exists' : 'extractedText'))
    );
  }

  if (mapped === 'UI.Check') {
    props.action = String(raw['@_Action'] || raw['@_Checked'] || 'Check');
  }

  if (mapped === 'UI.TakeScreenshot') {
    props.filePath = cleanExpr(
      raw['@_FileName'] || raw['@_FilePath'] || extractArgument(raw, 'FileName') || 'Data/Temp/screenshot.png'
    );
  }

  if (mapped === 'Messaging.SendEmail') {
    props.to = cleanExpr(raw['@_To'] || extractArgument(raw, 'To') || 'user@example.com');
    props.subject = cleanExpr(raw['@_Subject'] || extractArgument(raw, 'Subject') || '""');
    props.body = cleanExpr(raw['@_Body'] || extractArgument(raw, 'Body') || '');
  }

  if (localName.toLowerCase().includes('http') || mapped === 'Messaging.HttpRequest') {
    props.method = String(raw['@_Method'] || 'GET');
    props.url = cleanExpr(url || raw['@_EndPoint'] || '"https://api.example.com"');
    props.result = stripBrackets(cleanExpr(result || 'response'));
    props.body = cleanExpr(raw['@_Body'] || extractArgument(raw, 'Body') || '');
    props.headers = String(raw['@_Headers'] || extractArgument(raw, 'Headers') || '')
      .split(';')
      .map((h) => h.trim())
      .filter(Boolean)
      .join('\n');
    props.statusCode = stripBrackets(
      cleanExpr(raw['@_StatusCode'] || extractArgument(raw, 'StatusCode') || 'statusCode')
    );
    const authHeader = String(props.headers || '');
    if (/Authorization:\s*Bearer/i.test(authHeader)) {
      props.authType = 'Bearer';
    } else if (/Authorization:\s*Basic/i.test(authHeader)) {
      props.authType = 'Basic';
    } else {
      props.authType = 'None';
    }
  }

  if (mapped === 'UI.Click') {
    props.clickType = String(raw['@_ClickType'] || 'Single').replace('ClickType.', '');
    const interaction = fromXamlInteractionMode(String(raw['@_InteractionMode'] || ''));
    if (interaction) {
      props.inputMethod = interaction;
    } else if (raw['@_SimulateClick'] != null) {
      props.inputMethod =
        String(raw['@_SimulateClick']) !== 'False' ? 'Simulate' : 'Hardware Events';
      props.simulateClick = String(raw['@_SimulateClick']) !== 'False';
    } else {
      props.inputMethod = 'Simulate';
    }
  }

  if (mapped === 'UI.TypeInto') {
    props.emptyField = String(raw['@_EmptyField'] ?? 'true') !== 'False';
    const interaction = fromXamlInteractionMode(String(raw['@_InteractionMode'] || ''));
    if (interaction) {
      props.inputMethod = interaction;
    } else if (raw['@_SimulateType'] != null) {
      props.inputMethod =
        String(raw['@_SimulateType']) !== 'False' ? 'Simulate' : 'Hardware Events';
    }
  }

  if (
    mapped === 'UI.Hover' ||
    mapped === 'UI.Check' ||
    mapped === 'UI.SelectItem' ||
    mapped === 'UI.UseApplicationBrowser'
  ) {
    const interaction = fromXamlInteractionMode(String(raw['@_InteractionMode'] || ''));
    if (interaction) {
      props.inputMethod = interaction;
    }
  }

  if (
    mapped === 'System.ReadTextFile' ||
    mapped === 'System.WriteTextFile' ||
    mapped === 'System.AppendLine'
  ) {
    props.fileName = cleanExpr(
      raw['@_FileName'] || raw['@_Path'] || extractArgument(raw, 'FileName') || url || '"data.txt"'
    );
    if (mapped === 'System.ReadTextFile') {
      props.result = stripBrackets(
        cleanExpr(raw['@_Content'] || result || extractArgument(raw, 'Content') || 'fileText')
      );
    } else {
      props.text = cleanExpr(text || raw['@_Text'] || extractArgument(raw, 'Text') || '""');
    }
  }
  if (mapped === 'System.PathExists') {
    props.path = cleanExpr(raw['@_Path'] || extractArgument(raw, 'Path') || url || '"data.txt"');
    props.pathType = String(raw['@_PathType'] || 'Any').replace('PathType.', '');
    props.result = stripBrackets(
      cleanExpr(raw['@_Exists'] || result || extractArgument(raw, 'Exists') || 'exists')
    );
  }
  if (mapped === 'System.CreateDirectory' || mapped === 'System.DeleteFile') {
    props.path = cleanExpr(raw['@_Path'] || extractArgument(raw, 'Path') || url || '"path"');
  }
  if (mapped === 'System.CopyFile' || mapped === 'System.MoveFile') {
    props.path = cleanExpr(raw['@_Path'] || extractArgument(raw, 'Path') || '"in.txt"');
    props.destination = cleanExpr(
      raw['@_Destination'] || extractArgument(raw, 'Destination') || '"out.txt"'
    );
    props.overwrite = String(raw['@_Overwrite'] ?? 'True') !== 'False';
  }
  if (mapped === 'System.RenameFile') {
    props.path = cleanExpr(raw['@_Path'] || extractArgument(raw, 'Path') || '"old.txt"');
    props.newName = cleanExpr(
      raw['@_NewName'] ||
        raw['@_Destination'] ||
        extractArgument(raw, 'NewName') ||
        extractArgument(raw, 'Destination') ||
        '"new.txt"'
    );
  }
  if (mapped === 'System.Matches' || mapped === 'System.IsMatch' || mapped === 'System.Replace') {
    props.input = stripBrackets(
      cleanExpr(raw['@_Input'] || extractArgument(raw, 'Input') || text || 'text')
    );
    // Patterns arrive as ["\d+"] — store quoted expression; dry-run strips quotes for RegExp
    const rawPattern = raw['@_Pattern'] || raw['@_Regex'] || extractArgument(raw, 'Pattern') || '"\\w+"';
    const pat = fromVbStringArgument(rawPattern);
    props.pattern = `"${pat.replace(/"/g, '""')}"`;
    props.result = stripBrackets(
      cleanExpr(
        raw['@_Result'] ||
          result ||
          extractArgument(raw, 'Result') ||
          (mapped === 'System.IsMatch'
            ? 'isMatch'
            : mapped === 'System.Replace'
              ? 'replaced'
              : 'matches')
      )
    );
    if (mapped === 'System.Replace') {
      const rawRepl = raw['@_Replacement'] || extractArgument(raw, 'Replacement') || '" "';
      const repl = fromVbStringArgument(rawRepl);
      props.replacement = `"${repl.replace(/"/g, '""')}"`;
    }
  }
  if (mapped === 'System.KillProcess') {
    props.processName = cleanExpr(
      raw['@_ProcessName'] || extractArgument(raw, 'ProcessName') || '"notepad"'
    );
  }
  if (mapped === 'Data.MergeDataTable') {
    props.destination = stripBrackets(
      cleanExpr(raw['@_Destination'] || extractArgument(raw, 'Destination') || 'dt')
    );
    props.source = stripBrackets(
      cleanExpr(raw['@_Source'] || extractArgument(raw, 'Source') || 'dtSource')
    );
    props.missingSchemaAction = String(
      raw['@_MissingSchemaAction'] || extractArgument(raw, 'MissingSchemaAction') || 'Add'
    ).replace('MissingSchemaAction.', '');
  }
  if (mapped === 'Data.RemoveDataRow') {
    props.dataTable = stripBrackets(
      cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')
    );
    props.rowIndex = cleanExpr(
      raw['@_RowIndex'] || raw['@_Index'] || extractArgument(raw, 'RowIndex') || '0'
    );
  }
  if (mapped === 'Data.RemoveDataColumn') {
    props.dataTable = stripBrackets(
      cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')
    );
    props.columnName = cleanExpr(
      raw['@_ColumnName'] || extractArgument(raw, 'ColumnName') || 'Column1'
    );
  }
  if (mapped === 'Data.GetRowItem' || mapped === 'Data.UpdateRowItem') {
    props.row = stripBrackets(cleanExpr(raw['@_Row'] || extractArgument(raw, 'Row') || 'row'));
    props.columnName = cleanExpr(
      raw['@_ColumnName'] ||
        raw['@_Column'] ||
        extractArgument(raw, 'ColumnName') ||
        extractArgument(raw, 'Column') ||
        'Column1'
    );
    if (mapped === 'Data.GetRowItem') {
      props.result = stripBrackets(
        cleanExpr(raw['@_Result'] || result || extractArgument(raw, 'Result') || 'cellValue')
      );
    } else {
      props.value = cleanExpr(raw['@_Value'] || extractArgument(raw, 'Value') || '""');
    }
  }
  if (mapped === 'UI.SendHotkey') {
    const rawKey =
      raw['@_Key'] ||
      raw['@_Shortcuts'] ||
      raw['@_Text'] ||
      extractArgument(raw, 'Key') ||
      extractArgument(raw, 'Shortcuts') ||
      '"enter"';
    props.key = `"${fromVbStringArgument(rawKey).replace(/"/g, '""')}"`;
    const interaction = fromXamlInteractionMode(String(raw['@_InteractionMode'] || ''));
    if (interaction) {
      props.inputMethod = interaction;
    }
  }
  if (mapped === 'Data.BuildDataTable') {
    // BuildDataTable has no "Columns"/"ColumnNames" property — its schema lives in
    // "TableInfo", an ADO.NET DataSet XSD schema string (see extractTableInfoColumns
    // for the confirmed real shape). Reading @_Columns/@_ColumnNames here always
    // failed silently and fell back to placeholder columns, discarding whatever
    // schema the user actually configured.
    const tableInfoRaw = raw['@_TableInfo'] || extractArgument(raw, 'TableInfo');
    const parsedCols = tableInfoRaw ? extractTableInfoColumns(String(tableInfoRaw)) : [];
    if (parsedCols.length) {
      props.columns = parsedCols.join(',');
    } else {
      const cols =
        raw['@_ColumnNames'] ||
        raw['@_Columns'] ||
        extractArgument(raw, 'ColumnNames') ||
        extractArgument(raw, 'Columns');
      if (cols) {
        props.columns = String(cleanExpr(cols)).replace(/^"|"$/g, '');
      } else if (!props.columns) {
        props.columns = 'Name,Amount,Status';
      }
    }
    const dtResult =
      raw['@_DataTable'] ||
      extractArgument(raw, 'DataTable') ||
      raw['@_Result'] ||
      extractArgument(raw, 'Result') ||
      result;
    if (dtResult) {
      props.result = stripBrackets(cleanExpr(dtResult));
    }
    // Drop import-only note when we have real catalog props
    delete props.note;
  }

  if (mapped === 'Flowchart.FlowSwitch') {
    props.expression = cleanExpr(
      raw['@_Expression'] || extractArgument(raw, 'Expression') || 'key'
    );
  }

  if (!Object.keys(props).length) {
    props.note = 'Imported from ' + localName;
  }
  return props;
}

function extractArgument(raw: Record<string, unknown>, name: string): unknown {
  const direct = raw[name];
  if (typeof direct === 'string' || typeof direct === 'number') {
    return direct;
  }
  const nestedKey = Object.keys(raw).find((k) => k.endsWith('.' + name));
  const nested = nestedKey ? raw[nestedKey] : undefined;
  const candidates = [direct, nested, raw[`Assign.${name}`], raw[name]];
  for (const c of candidates) {
    if (c == null) {
      continue;
    }
    if (typeof c === 'string' || typeof c === 'number') {
      return c;
    }
    if (typeof c === 'object') {
      // Prefer full unwrap (ExpressionText / VisualBasicValue) before #text
      const unwrapped = argumentValue(c);
      if (unwrapped != null && String(unwrapped).trim() !== '') {
        return unwrapped;
      }
      const obj = c as Record<string, unknown>;
      if (obj.InArgument) {
        const v = argumentValue(obj.InArgument);
        if (v != null && String(v).trim() !== '') {
          return v;
        }
      }
      if (obj.OutArgument) {
        const v = argumentValue(obj.OutArgument);
        if (v != null && String(v).trim() !== '') {
          return v;
        }
      }
      if (obj.InOutArgument) {
        const v = argumentValue(obj.InOutArgument);
        if (v != null && String(v).trim() !== '') {
          return v;
        }
      }
      // Assign.To style
      for (const v of Object.values(obj)) {
        const inner = argumentValue(v);
        if (inner != null && String(inner).trim() !== '') {
          return inner;
        }
      }
    }
  }
  return undefined;
}

function argumentValue(node: unknown): unknown {
  if (node == null) {
    return undefined;
  }
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return node;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = argumentValue(item);
      if (hit != null && String(hit).trim() !== '') {
        return hit;
      }
    }
    return undefined;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    // Studio Web edited expressions: VisualBasicValue / Literal with ExpressionText
    const exprText =
      obj['@_ExpressionText'] ??
      obj.ExpressionText ??
      obj.expressionText ??
      obj['@_Expression'] ??
      obj.Expression ??
      obj.expression;
    if (exprText != null && String(exprText).trim() !== '') {
      return exprText;
    }
    const litVal = obj['@_Value'] ?? obj.Value ?? obj.value;
    if (
      (typeof litVal === 'string' || typeof litVal === 'number' || typeof litVal === 'boolean') &&
      String(litVal).trim() !== ''
    ) {
      return litVal;
    }
    // Nested InArgument / VisualBasicValue / Literal under any key
    for (const [k, v] of Object.entries(obj)) {
      if (k === '#text' || k.startsWith('@_')) {
        continue;
      }
      if (
        /VisualBasicValue|VisualBasicReference|Literal|InArgument|OutArgument|InOutArgument|CSharpValue/i.test(k) ||
        (v && typeof v === 'object')
      ) {
        const inner = argumentValue(v);
        if (inner != null && String(inner).trim() !== '') {
          return inner;
        }
      }
    }
    if (obj['#text'] != null && String(obj['#text']).trim() !== '') {
      return obj['#text'];
    }
    if (obj['@_'] != null && String(obj['@_']).trim() !== '') {
      return obj['@_'];
    }
  }
  return undefined;
}

/**
 * Parses column names out of BuildDataTable's "TableInfo" property — an ADO.NET
 * DataSet XSD schema string, e.g.:
 *   <NewDataSet>
 *     <xs:schema id="NewDataSet" ...>
 *       <xs:element name="NewDataSet" msdata:IsDataSet="true" ...>
 *         <xs:complexType>
 *           <xs:choice minOccurs="0" maxOccurs="unbounded">
 *             <xs:element name="Table1">
 *               <xs:complexType>
 *                 <xs:sequence>
 *                   <xs:element name="ColName" type="xs:string" minOccurs="0" />
 *                   ...
 * Only the leaf column elements carry a `type="xs:..."` attribute — the wrapping
 * "NewDataSet" and table-name elements don't — so matching on `type="xs:` reliably
 * excludes those wrapper elements without needing a full XML parse.
 * Handles both raw XML and the double-escaped form (&lt;xs:element ...) that shows
 * up when TableInfo has already been through one round of entity-decoding upstream.
 */
export function extractTableInfoColumns(tableInfoRaw: string): string[] {
  if (!tableInfoRaw) {
    return [];
  }
  let text = String(tableInfoRaw);
  // Undo up to two rounds of entity-encoding — this attribute value is itself XML
  // embedded inside an XML attribute, so it can arrive singly- or doubly-escaped
  // depending on which layer last touched it.
  for (let i = 0; i < 2; i++) {
    if (!/&lt;|&quot;|&amp;/.test(text)) {
      break;
    }
    text = text
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
  const columns: string[] = [];
  const re = /<xs:element\s+name="([^"]+)"\s+type="xs:[^"]*"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) {
      columns.push(m[1]);
    }
  }
  return columns;
}

function findFirstByName(
  node: unknown,
  name: string
): Record<string, unknown> | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findFirstByName(item, name);
      if (hit) {
        return hit;
      }
    }
    return undefined;
  }
  const obj = node as Record<string, unknown>;
  if (obj[name] && typeof obj[name] === 'object') {
    return obj[name] as Record<string, unknown>;
  }
  for (const value of Object.values(obj)) {
    const hit = findFirstByName(value, name);
    if (hit) {
      return hit;
    }
  }
  return undefined;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function mapType(typeArg: string): VariableType {
  const t = typeArg.toLowerCase();
  if (t.includes('int32') || t.includes('int16') || t.includes('int64')) {
    return 'Int32';
  }
  if (t.includes('double') || t.includes('decimal') || t.includes('float')) {
    return 'Double';
  }
  if (t.includes('bool')) {
    return 'Boolean';
  }
  if (t.includes('datatable')) {
    return 'DataTable';
  }
  if (t.includes('array') || t.includes('ienumerable') || t.includes('list')) {
    return 'Array';
  }
  if (t.includes('string')) {
    return 'String';
  }
  return 'Object';
}

/** Read Url / FilePath / BrowserType / Selector from NApplicationCard.TargetApp. */
function extractTargetApp(raw: Record<string, unknown>): {
  url?: string;
  filePath?: string;
  browserType?: string;
  selector?: string;
} {
  const block =
    (raw['TargetApp'] as Record<string, unknown> | undefined) ||
    (raw['NApplicationCard.TargetApp'] as Record<string, unknown> | undefined) ||
    (raw['UseApplicationBrowser.TargetApp'] as Record<string, unknown> | undefined);
  if (!block || typeof block !== 'object') {
    return {};
  }
  // TargetApp may be wrapped: { TargetApp: { '@_Url': ... } } or direct attrs
  const inner =
    (block['TargetApp'] as Record<string, unknown> | undefined) &&
    typeof block['TargetApp'] === 'object'
      ? (block['TargetApp'] as Record<string, unknown>)
      : block;
  const url = cleanExpr(
    inner['@_Url'] || extractArgument(inner, 'Url') || ''
  );
  const filePath = cleanExpr(
    inner['@_FilePath'] || extractArgument(inner, 'FilePath') || ''
  );
  const browserType = String(
    inner['@_BrowserType'] || extractArgument(inner, 'BrowserType') || ''
  ).trim();
  const selector = cleanExpr(
    inner['@_Selector'] || extractArgument(inner, 'Selector') || ''
  );
  return {
    url: url || undefined,
    filePath: filePath || undefined,
    browserType: browserType || undefined,
    selector: selector || undefined
  };
}

function cleanExpr(value: unknown): string {
  if (value == null) {
    return '';
  }
  let text = String(value).trim();
  text = text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return text;
}

/** Studio Web / Integration trigger activities that should not enter LCS workflows. */
function isStudioWebTriggerLocalName(localName: string, displayName: string): boolean {
  if (/Trigger$/i.test(localName)) {
    return true;
  }
  if (/ManualTrigger|TimeTrigger|FormTrigger|HotkeyTrigger|ClickImageTrigger|KeyPressTrigger/i.test(localName)) {
    return true;
  }
  if (/^Manual\s*Trigger$/i.test(displayName.trim())) {
    return true;
  }
  return false;
}

function cleanLiteral(value: unknown): unknown {
  if (value == null || value === '') {
    return undefined;
  }
  const text = cleanExpr(value);
  if (text === 'True' || text === 'true') {
    return true;
  }
  if (text === 'False' || text === 'false') {
    return false;
  }
  if (/^-?\d+$/.test(text)) {
    return Number(text);
  }
  return text.replace(/^\[("|')?(.*?)("|')?\]$/, '$2').replace(/^"(.*)"$/, '$1');
}

function stripBrackets(expr: string): string {
  return expr.replace(/^\[/, '').replace(/\]$/, '').trim();
}

/** Best-effort parse of UiPath MultipleAssign Assignments collection. */
function extractMultipleAssignLines(raw: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const block =
    raw.Assignments ||
    raw['MultipleAssign.Assignments'] ||
    raw['AssignOperations'] ||
    raw;
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    const to = cleanExpr(
      obj['@_To'] || extractArgument(obj, 'To') || obj.To || ''
    );
    const value = cleanExpr(
      obj['@_Value'] || extractArgument(obj, 'Value') || obj.Value || ''
    );
    if (to && (value || value === '0' || value === 'false')) {
      lines.push(`${stripBrackets(to)} = ${value}`);
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('@_') || k === '#text') {
        continue;
      }
      if (k === 'Assign' || k.includes('Assign') || k === 'InArgument' || k === 'OutArgument') {
        walk(v);
      }
    }
  };
  walk(block);
  return lines;
}

function parseDurationMs(duration: string): number {
  // TimeSpan: hh:mm:ss or mm:ss
  const parts = duration.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) {
    return 1000;
  }
  if (parts.length === 3) {
    return ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000;
  }
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  return 1000;
}

function node(
  type: string,
  displayName: string,
  properties: Record<string, unknown>,
  x: number,
  y: number
): ActivityNode {
  return { id: newId(), type, displayName, properties, x, y };
}
