import assert from 'assert';
import {
  formatArgumentMappings,
  parseArgumentMappings,
  renderInvokeArgumentsXml,
  renderXamlMembers,
  normalizeWorkflowArgument
} from '../interop/workflowArguments';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { importXaml } from '../interop/xamlImport';
import { WorkflowDocument } from '../models/workflow';

function run(): void {
  assert.deepStrictEqual(parseArgumentMappings(''), []);
  assert.deepStrictEqual(parseArgumentMappings('in_Config = Config'), [
    { name: 'in_Config', expression: 'Config' }
  ]);
  assert.deepStrictEqual(
    parseArgumentMappings('in_Config = Config\nout_Result = result\n# comment\nbad line'),
    [
      { name: 'in_Config', expression: 'Config' },
      { name: 'out_Result', expression: 'result' }
    ]
  );
  assert.deepStrictEqual(parseArgumentMappings('{"in_Config":"Config","x":1}'), [
    { name: 'in_Config', expression: 'Config' },
    { name: 'x', expression: '1' }
  ]);
  assert.strictEqual(
    formatArgumentMappings([{ name: 'in_Config', expression: 'Config' }]),
    'in_Config = Config'
  );

  const arg = normalizeWorkflowArgument({ name: ' in_Foo ', type: 'Int32', direction: 'Out' });
  assert.deepStrictEqual(arg, {
    name: 'in_Foo',
    type: 'Int32',
    direction: 'Out',
    defaultValue: undefined
  });
  assert.strictEqual(normalizeWorkflowArgument({ name: '' }), null);

  const members = renderXamlMembers([
    { name: 'in_Config', type: 'Object', direction: 'In' },
    { name: 'out_Result', type: 'String', direction: 'Out' }
  ]);
  assert.ok(members.includes('<x:Members>'));
  assert.ok(members.includes('Name="in_Config"'));
  assert.ok(members.includes('Type="InArgument(x:Object)"'));
  assert.ok(members.includes('Type="OutArgument(x:String)"'));

  const invokeXml = renderInvokeArgumentsXml(
    [{ name: 'in_Config', expression: 'Config' }],
    '  '
  );
  assert.ok(invokeXml.includes('InvokeWorkflowFile.Arguments'));
  assert.ok(invokeXml.includes('x:Key="in_Config"'));
  assert.ok(invokeXml.includes('[Config]'));

  const doc: WorkflowDocument = {
    schemaVersion: '1.0',
    name: 'ArgsDemo',
    type: 'Sequence',
    variables: [],
    arguments: [
      { name: 'in_Config', type: 'Object', direction: 'In' },
      { name: 'out_Status', type: 'String', direction: 'Out' }
    ],
    activities: [
      {
        id: 'a1',
        type: 'REFramework.InvokeWorkflow',
        displayName: 'Invoke Process',
        properties: {
          workflowPath: 'Framework/Process.lcs.json',
          argumentMappings: 'in_Config = Config\nout_Status = status'
        }
      }
    ]
  };

  const exported = exportWorkflowToXaml(doc);
  assert.ok(exported.includes('<x:Members>'), 'workflow arguments export as x:Members');
  assert.ok(exported.includes('Name="in_Config"'));
  assert.ok(exported.includes('InvokeWorkflowFile.Arguments'));
  assert.ok(exported.includes('WorkflowFileName="Framework/Process.xaml"'));
  assert.ok(exported.includes('x:Key="in_Config"'));
  assert.ok(exported.includes('x:Key="out_Status"'));

  const { workflow } = importXaml(exported, 'ArgsDemo');
  assert.ok(workflow.arguments.some((a) => a.name === 'in_Config' && a.direction === 'In'));
  assert.ok(workflow.arguments.some((a) => a.name === 'out_Status' && a.direction === 'Out'));
  const inv = workflow.activities.find((a) => a.type === 'REFramework.InvokeWorkflow');
  assert.ok(inv);
  const mappings = String(inv!.properties.argumentMappings || '');
  assert.ok(mappings.includes('in_Config'));
  assert.ok(mappings.includes('out_Status'));

  console.log('workflowArguments.test.ts: ok');
}

run();
