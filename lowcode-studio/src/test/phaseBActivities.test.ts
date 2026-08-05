import assert from 'assert';
import { ACTIVITY_CATALOG } from '../models/activities';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { importXaml } from '../interop/xamlImport';
import { dryRunWorkflow } from '../commands/simulator';
import { createEmptyWorkflow } from '../models/workflow';
import {
  collectActivityTypes,
  resolveUiPathDependencies
} from '../interop/uipathDependencies';
import { lcsTypeFromXamlName, xamlInfoForLcsType } from '../interop/activityMap';

const PHASE_B_TYPES = [
  'Orchestrator.GetTransactionItem',
  'Orchestrator.AddQueueItem',
  'Orchestrator.GetAsset',
  'Orchestrator.SetAsset',
  'Excel.AppendRange',
  'Excel.ExcelApplicationScope',
  'Data.JoinDataTable',
  'Data.LookupDataTable',
  'Data.SortDataTable',
  'ControlFlow.Parallel',
  'ControlFlow.ParallelForEach',
  'ControlFlow.TimeoutScope',
  'Messaging.GetEmail',
  'Messaging.SelectToken'
];

function run(): void {
  for (const type of PHASE_B_TYPES) {
    assert.ok(
      ACTIVITY_CATALOG.some((a) => a.type === type),
      `missing catalog entry ${type}`
    );
    assert.ok(xamlInfoForLcsType(type), `missing activityMap for ${type}`);
  }

  assert.strictEqual(lcsTypeFromXamlName('GetQueueItem'), 'Orchestrator.GetTransactionItem');
  assert.strictEqual(lcsTypeFromXamlName('AppendRange'), 'Excel.AppendRange');
  assert.strictEqual(lcsTypeFromXamlName('SetTransactionStatus'), 'REFramework.SetTransactionStatus');

  const doc = createEmptyWorkflow('PhaseB', 'Sequence');
  doc.variables.push(
    { name: 'TransactionItem', type: 'Object', defaultValue: null },
    { name: 'assetValue', type: 'String', defaultValue: '' },
    { name: 'dtLeft', type: 'DataTable', defaultValue: { columns: ['Id', 'Name'], rows: [['1', 'A']] } },
    { name: 'dtRight', type: 'DataTable', defaultValue: { columns: ['Id', 'Score'], rows: [['1', '10']] } },
    { name: 'joinedDt', type: 'DataTable', defaultValue: { columns: [], rows: [] } },
    { name: 'lookupResult', type: 'Object', defaultValue: null },
    { name: 'sortedDt', type: 'DataTable', defaultValue: { columns: [], rows: [] } },
    { name: 'jsonObj', type: 'Object', defaultValue: { data: { id: 42 } } },
    { name: 'tokenValue', type: 'Object', defaultValue: null },
    { name: 'mails', type: 'Array', defaultValue: [] },
    { name: 'response', type: 'Object', defaultValue: null },
    { name: 'statusCode', type: 'Int32', defaultValue: 0 },
    { name: 'filteredDt', type: 'DataTable', defaultValue: { columns: [], rows: [] } }
  );
  doc.activities = [
    {
      id: 'a1',
      type: 'Orchestrator.GetAsset',
      displayName: 'Get Asset',
      properties: { assetName: 'AppUrl', result: 'assetValue' }
    },
    {
      id: 'a2',
      type: 'Orchestrator.GetTransactionItem',
      displayName: 'Get TI',
      properties: { queueName: 'MainQueue', result: 'TransactionItem' }
    },
    {
      id: 'a3',
      type: 'Messaging.HttpRequest',
      displayName: 'HTTP',
      properties: {
        method: 'GET',
        url: '"https://api.example.com/x"',
        authType: 'Bearer',
        token: '"tok"',
        headers: 'Accept: application/json',
        result: 'response',
        statusCode: 'statusCode'
      }
    },
    {
      id: 'a4',
      type: 'Data.JoinDataTable',
      displayName: 'Join',
      properties: {
        dataTable1: 'dtLeft',
        dataTable2: 'dtRight',
        joinType: 'Inner',
        column1: 'Id',
        column2: 'Id',
        result: 'joinedDt'
      }
    },
    {
      id: 'a5',
      type: 'Data.LookupDataTable',
      displayName: 'Lookup',
      properties: {
        dataTable: 'dtLeft',
        lookupColumn: 'Id',
        lookupValue: '"1"',
        targetColumn: 'Name',
        result: 'lookupResult'
      }
    },
    {
      id: 'a6',
      type: 'Data.SortDataTable',
      displayName: 'Sort',
      properties: {
        dataTable: 'dtLeft',
        columnName: 'Id',
        order: 'Ascending',
        result: 'sortedDt'
      }
    },
    {
      id: 'a7',
      type: 'Messaging.SelectToken',
      displayName: 'Select',
      properties: { json: 'jsonObj', path: 'data.id', result: 'tokenValue' }
    },
    {
      id: 'a8',
      type: 'Messaging.GetEmail',
      displayName: 'Mail',
      properties: { mailFolder: 'Inbox', top: 5, result: 'mails' }
    },
    {
      id: 'a9',
      type: 'Excel.AppendRange',
      displayName: 'Append',
      properties: { workbookPath: 'out.xlsx', sheetName: 'Sheet1', data: 'joinedDt' }
    },
    {
      id: 'a10',
      type: 'ControlFlow.Parallel',
      displayName: 'Parallel',
      properties: {},
      children: [
        {
          id: 'a10a',
          type: 'System.LogMessage',
          displayName: 'P1',
          properties: { message: '"branch"', level: 'Info' }
        }
      ]
    },
    {
      id: 'a11',
      type: 'ControlFlow.TimeoutScope',
      displayName: 'Timeout',
      properties: { timeoutMs: 5000 },
      children: [
        {
          id: 'a11a',
          type: 'System.Delay',
          displayName: 'Wait',
          properties: { durationMs: 100 }
        }
      ]
    },
    {
      id: 'a12',
      type: 'REFramework.SetTransactionStatus',
      displayName: 'Set Status',
      properties: {
        transactionItem: 'TransactionItem',
        status: 'Success',
        reason: '""'
      }
    },
    {
      id: 'a13',
      type: 'ControlFlow.Switch',
      displayName: 'Switch',
      properties: { expression: 'statusCode', cases: '200,404,Default' },
      children: [
        {
          id: 'a13a',
          type: 'System.LogMessage',
          displayName: 'Default',
          properties: { message: '"sw"', level: 'Info' }
        }
      ]
    },
    {
      id: 'a14',
      type: 'Excel.ExcelApplicationScope',
      displayName: 'Excel Scope',
      properties: { workbookPath: 'data.xlsx', createIfNotExists: true },
      children: [
        {
          id: 'a14a',
          type: 'Excel.ReadRange',
          displayName: 'Read',
          properties: {
            workbookPath: 'data.xlsx',
            sheetName: 'Sheet1',
            range: '',
            result: 'sortedDt'
          }
        }
      ]
    }
  ];

  const exported = exportWorkflowToXaml(doc);
  assert.ok(exported.includes('ui:GetQueueItem'), exported.slice(0, 400));
  assert.ok(exported.includes('ui:GetRobotAsset'));
  assert.ok(exported.includes('ui:SetTransactionStatus'));
  assert.ok(exported.includes('excel:AppendRange'));
  assert.ok(exported.includes('excel:ExcelApplicationScope'));
  assert.ok(exported.includes('ui:JoinDataTables'));
  assert.ok(exported.includes('ui:LookupDataTable'));
  assert.ok(exported.includes('ui:SortDataTable'));
  assert.ok(exported.includes('<Parallel'));
  assert.ok(exported.includes('ui:TimeoutScope'));
  assert.ok(exported.includes('mail:GetIMAPMailMessages'));
  assert.ok(exported.includes('ui:SelectToken'));
  assert.ok(exported.includes('Switch.Case'));
  assert.ok(exported.includes('Headers='));
  assert.ok(!/ui:Comment[^>]*Set Transaction Status/.test(exported));

  const { workflow } = importXaml(exported, 'PhaseB');
  const types = new Set(workflow.activities.map((a) => a.type));
  assert.ok(types.has('Orchestrator.GetTransactionItem'));
  assert.ok(types.has('Orchestrator.GetAsset'));
  assert.ok(types.has('REFramework.SetTransactionStatus'));
  assert.ok(types.has('Excel.AppendRange'));
  assert.ok(types.has('Data.JoinDataTable'));
  assert.ok(types.has('Messaging.SelectToken'));
  assert.ok(types.has('ControlFlow.Parallel'));

  const dry = dryRunWorkflow(doc, {
    fixtures: {
      assets: { AppUrl: 'https://api.example.com' },
      queueItems: { MainQueue: [{ Reference: 'R1' }] },
      http: { 'api.example.com': { status: 201, body: { ok: true } } },
      mails: { Inbox: [{ subject: 'Hi' }] }
    }
  });
  assert.strictEqual(dry.ok, true, dry.log.join('\n'));
  assert.ok(dry.variables.lookupResult === 'A');
  assert.ok(dry.variables.tokenValue === 42);
  assert.ok(dry.variables.statusCode === 201);
  assert.deepStrictEqual(dry.variables.response, { status: 201, body: { ok: true } });
  assert.ok(Array.isArray(dry.variables.mails));
  assert.ok(
    (dry.variables.joinedDt as { rows: unknown[] }).rows.length === 1,
    JSON.stringify(dry.variables.joinedDt)
  );
  assert.ok(dry.warnings.some((w) => /Parallel/i.test(w)));

  const deps = resolveUiPathDependencies({
    activityTypes: collectActivityTypes([doc]),
    includeBaseline: true
  });
  assert.ok(deps['UiPath.System.Activities']);
  assert.ok(deps['UiPath.Excel.Activities']);
  assert.ok(deps['UiPath.Mail.Activities']);
  assert.ok(deps['UiPath.WebAPI.Activities']);

  console.log('phaseBActivities.test.ts: ok');
}

run();
