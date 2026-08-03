import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { ACTIVITY_CATALOG } from '../models/activities';
import { importXaml } from '../interop/xamlImport';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { dryRunWorkflow } from '../commands/simulator';
import { createEmptyWorkflow } from '../models/workflow';
import {
  collectActivityTypes,
  resolveUiPathDependencies
} from '../interop/uipathDependencies';

function fixture(name: string): string {
  const fromOut = path.join(__dirname, 'fixtures', name);
  const fromSrc = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', name);
  return fs.readFileSync(fs.existsSync(fromOut) ? fromOut : fromSrc, 'utf8');
}

const EXPECTED_NEW = [
  'Programming.InvokeCode',
  'Programming.MultipleAssign',
  'System.Throw',
  'System.TerminateWorkflow',
  'ControlFlow.Switch',
  'UI.GetAttribute',
  'UI.WaitElement',
  'Data.AddDataRow',
  'Data.AddDataColumn',
  'Data.FilterDataTable',
  'Data.ForEachRow',
  'Data.ClearDataTable',
  'Data.OutputDataTable',
  'Messaging.DeserializeJson',
  'Messaging.SerializeJson'
];

function run(): void {
  for (const type of EXPECTED_NEW) {
    assert.ok(
      ACTIVITY_CATALOG.some((a) => a.type === type),
      `missing catalog entry ${type}`
    );
  }

  const { workflow } = importXaml(fixture('top-activities.xaml'), 'TopActivities');
  const types = new Set(workflow.activities.map((a) => a.type));
  assert.ok(types.has('Programming.InvokeCode'));
  assert.ok(types.has('Programming.MultipleAssign'));
  assert.ok(types.has('Data.AddDataRow'));
  assert.ok(types.has('Data.ForEachRow'));
  assert.ok(types.has('Messaging.DeserializeJson'));
  assert.ok(types.has('UI.GetAttribute') || types.has('UI.WaitElement'));
  assert.ok(types.has('ControlFlow.Switch'));
  assert.ok(types.has('System.Throw'));

  const invoke = workflow.activities.find((a) => a.type === 'Programming.InvokeCode');
  assert.ok(String(invoke?.properties.code || '').includes('Console.WriteLine'));

  const exported = exportWorkflowToXaml(workflow);
  assert.ok(exported.includes('ui:InvokeCode'));
  assert.ok(exported.includes('ui:MultipleAssign') || exported.includes('MultipleAssign'));
  assert.ok(exported.includes('ui:AddDataRow'));
  assert.ok(exported.includes('ui:ForEachRow'));
  assert.ok(exported.includes('ui:DeserializeJson'));

  const deps = resolveUiPathDependencies({
    activityTypes: collectActivityTypes([workflow]),
    includeBaseline: true
  });
  assert.ok(deps['UiPath.System.Activities']);
  assert.ok(deps['UiPath.UIAutomation.Activities']);

  const demo = createEmptyWorkflow('InvokeDemo', 'Sequence');
  demo.variables.push({ name: 'counter', type: 'Int32', defaultValue: 0 });
  demo.variables.push({ name: 'dt', type: 'DataTable', defaultValue: { columns: ['A'], rows: [] } });
  demo.variables.push({ name: 'jsonObj', type: 'Object', defaultValue: {} });
  demo.variables.push({ name: 'jsonText', type: 'String', defaultValue: '' });
  demo.activities = [
    {
      id: 'a1',
      type: 'Programming.MultipleAssign',
      displayName: 'Multiple Assign',
      properties: { assignments: 'counter = 2\nstatus = "ok"' }
    },
    {
      id: 'a2',
      type: 'Programming.InvokeCode',
      displayName: 'Invoke Code',
      properties: {
        language: 'CSharp',
        code: 'counter = counter + 1;',
        arguments: 'counter'
      }
    },
    {
      id: 'a3',
      type: 'Data.AddDataRow',
      displayName: 'Add Row',
      properties: { dataTable: 'dt', arrayRow: '["x"]' }
    },
    {
      id: 'a4',
      type: 'Messaging.DeserializeJson',
      displayName: 'Deserialize',
      properties: { jsonString: '{"ok":true}', result: 'jsonObj' }
    },
    {
      id: 'a5',
      type: 'Messaging.SerializeJson',
      displayName: 'Serialize',
      properties: { value: 'jsonObj', result: 'jsonText' }
    },
    {
      id: 'a6',
      type: 'UI.GetAttribute',
      displayName: 'Get Attribute',
      properties: {
        selector: '<html/>',
        attribute: 'aaname',
        result: 'attributeValue'
      }
    }
  ];

  const dry = dryRunWorkflow(demo);
  assert.strictEqual(dry.ok, true);
  assert.strictEqual(dry.variables.counter, 2);
  assert.strictEqual(dry.variables.status, 'ok');
  assert.ok(dry.log.some((l) => l.includes('InvokeCode')));
  assert.ok(dry.log.some((l) => l.includes('AddDataRow')));
  assert.deepStrictEqual(dry.variables.jsonObj, { ok: true });
  assert.ok(String(dry.variables.jsonText).includes('ok'));
  assert.ok(String(dry.variables.attributeValue).includes('aaname'));

  console.log(
    `topActivities.test.ts: all assertions passed (${EXPECTED_NEW.length} new activities)`
  );
}

run();
