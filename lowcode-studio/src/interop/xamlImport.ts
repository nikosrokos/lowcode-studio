import { XMLParser } from 'fast-xml-parser';
import {
  ActivityNode,
  VariableType,
  WorkflowDocument,
  WorkflowVariable,
  newId
} from '../models/workflow';
import { lcsTypeFromXamlName, unknownActivityType } from './activityMap';
import { applySelectorProps, extractSelectorProps } from './selectorRoundTrip';

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
  const body = unwrapBody(activityRoot);
  const flowchart = findFirstByName(body, 'Flowchart');

  if (flowchart) {
    const { activities, connections, startActivityId } = importFlowchart(
      flowchart,
      warnings
    );
    return {
      workflow: {
        schemaVersion: '1.0',
        name: workflowName,
        description: 'Imported from UiPath XAML (Flowchart)',
        type: 'Flowchart',
        variables,
        arguments: [],
        activities,
        connections,
        startActivityId,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          template: 'imported-uipath'
        }
      },
      warnings
    };
  }

  const activities = collectActivities(body, warnings);
  return {
    workflow: {
      schemaVersion: '1.0',
      name: workflowName,
      description: 'Imported from UiPath XAML',
      type: 'Sequence',
      variables,
      arguments: [],
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
    },
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

  // If this object is itself a Sequence wrapper, dive into children in document order
  if (obj.Sequence) {
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
        message: cleanExpr(raw['@_Message'] ?? extractArgument(raw, 'Message') ?? '"Message"'),
        level: String(raw['@_Level'] || 'Info').replace('TraceLevel.', '')
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
    return {
      id: newId(),
      type: 'REFramework.InvokeWorkflow',
      displayName,
      properties: {
        workflowPath: String(raw['@_WorkflowFileName'] || raw['@_FilePath'] || 'Workflow.xaml'),
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

  // Use Application/Browser — treat as open + nested body
  if (
    localName === 'UseApplicationBrowser' ||
    localName === 'NApplicationCard' ||
    localName === 'OpenBrowser'
  ) {
    const kids = collectActivities(
      raw['Body'] || raw['UseApplicationBrowser.Body'] || raw['NApplicationCard.Body'] || raw,
      warnings
    );
    return {
      id: newId(),
      type: 'UI.OpenApplication',
      displayName,
      properties: applySelectorProps(
        {
          pathOrUrl: cleanExpr(
            raw['@_Url'] ||
              raw['@_FilePath'] ||
              extractArgument(raw, 'Url') ||
              extractArgument(raw, 'FilePath') ||
              'https://example.com'
          )
        },
        extractSelectorProps(raw)
      ),
      children: kids.length ? kids : undefined
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
    if (mapped === 'ControlFlow.RetryScope' || mapped === 'UI.OpenApplication') {
      const kids = collectActivities(
        raw['Body'] || raw['Activity'] || raw,
        warnings
      );
      if (kids.length) {
        node.children = kids;
      }
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
  return {
    id: newId(),
    type: unknownActivityType(localName),
    displayName: `${displayName} (imported)`,
    properties: placeholderProps
  };
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
    if (mapped === 'Excel.WriteRange') {
      props.data = stripBrackets(
        cleanExpr(raw['@_DataTable'] || extractArgument(raw, 'DataTable') || 'dt')
      );
    }
    if (mapped === 'Excel.WriteCell') {
      props.value = cleanExpr(raw['@_Value'] || extractArgument(raw, 'Value') || '""');
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
  }

  if (mapped === 'UI.Click') {
    props.clickType = String(raw['@_ClickType'] || 'Single').replace('ClickType.', '');
    props.simulateClick = String(raw['@_SimulateClick'] ?? 'true') !== 'False';
  }

  if (mapped === 'UI.TypeInto') {
    props.emptyField = String(raw['@_EmptyField'] ?? 'true') !== 'False';
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
  const nested = raw[`${Object.keys(raw).find((k) => k.endsWith('.' + name)) || ''}`];
  const candidates = [direct, nested, raw[`Assign.${name}`], raw[name]];
  for (const c of candidates) {
    if (c == null) {
      continue;
    }
    if (typeof c === 'string' || typeof c === 'number') {
      return c;
    }
    if (typeof c === 'object') {
      const obj = c as Record<string, unknown>;
      if (obj['#text'] != null) {
        return obj['#text'];
      }
      if (obj.InArgument) {
        return argumentValue(obj.InArgument);
      }
      if (obj.OutArgument) {
        return argumentValue(obj.OutArgument);
      }
      if (obj.InOutArgument) {
        return argumentValue(obj.InOutArgument);
      }
      // Assign.To style
      for (const v of Object.values(obj)) {
        const inner = argumentValue(v);
        if (inner != null) {
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
  if (typeof node === 'string' || typeof node === 'number') {
    return node;
  }
  if (Array.isArray(node)) {
    return argumentValue(node[0]);
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj['#text'] != null) {
      return obj['#text'];
    }
    if (obj['@_'] != null) {
      return obj['@_'];
    }
  }
  return undefined;
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

function cleanExpr(value: unknown): string {
  if (value == null) {
    return '';
  }
  let text = String(value).trim();
  text = text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return text;
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
