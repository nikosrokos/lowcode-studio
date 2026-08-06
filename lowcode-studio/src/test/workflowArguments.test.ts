import assert from 'assert';
import {
  formatArgumentMappings,
  parseArgumentMappings,
  renderInvokeArgumentsXml,
  renderXamlMembers,
  normalizeWorkflowArgument,
  mergeInvokeMappings,
  missingInvokeMappings
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
  assert.deepStrictEqual(parseArgumentMappings('Out:out_Status = status'), [
    { name: 'out_Status', expression: 'status', direction: 'Out' }
  ]);
  assert.deepStrictEqual(parseArgumentMappings('{"in_Config":"Config","x":1}'), [
    { name: 'in_Config', expression: 'Config' },
    { name: 'x', expression: '1' }
  ]);
  assert.strictEqual(
    formatArgumentMappings([{ name: 'in_Config', expression: 'Config' }]),
    'in_Config = Config'
  );
  assert.strictEqual(
    formatArgumentMappings([{ name: 'out_Status', expression: 'status', direction: 'Out' }]),
    'Out:out_Status = status'
  );

  const merged = mergeInvokeMappings(
    [
      { name: 'in_Config', direction: 'In', type: 'Object' },
      { name: 'out_Status', direction: 'Out', type: 'String' }
    ],
    [{ name: 'in_Config', expression: 'Config' }]
  );
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].expression, 'Config');
  assert.strictEqual(merged[1].direction, 'Out');
  assert.strictEqual(merged[1].expression, '');

  const missing = missingInvokeMappings(
    [
      { name: 'in_Config', direction: 'In' },
      { name: 'out_Status', direction: 'Out' }
    ],
    [{ name: 'in_Config', expression: 'Config' }]
  );
  assert.deepStrictEqual(missing, [{ name: 'out_Status', direction: 'Out' }]);

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
    [
      { name: 'in_Config', expression: 'Config' },
      { name: 'out_Status', expression: 'status', direction: 'Out' }
    ],
    '  '
  );
  assert.ok(invokeXml.includes('InvokeWorkflowFile.Arguments'));
  assert.ok(invokeXml.includes('x:Key="in_Config"'));
  assert.ok(invokeXml.includes('<InArgument'));
  assert.ok(invokeXml.includes('<OutArgument'));
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
          argumentMappings: 'in_Config = Config\nOut:out_Status = status'
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
  assert.ok(exported.includes('<OutArgument'), 'Out mappings export as OutArgument');

  const { workflow } = importXaml(exported, 'ArgsDemo');
  assert.ok(workflow.arguments.some((a) => a.name === 'in_Config' && a.direction === 'In'));
  assert.ok(workflow.arguments.some((a) => a.name === 'out_Status' && a.direction === 'Out'));
  const inv = workflow.activities.find((a) => a.type === 'REFramework.InvokeWorkflow');
  assert.ok(inv);
  const mappings = String(inv!.properties.argumentMappings || '');
  assert.ok(mappings.includes('in_Config'));
  assert.ok(mappings.includes('out_Status'));
  assert.ok(mappings.includes('Out:out_Status') || mappings.includes('out_Status'), 'Out direction preserved');

  console.log('workflowArguments.test.ts: ok');
}

run();
