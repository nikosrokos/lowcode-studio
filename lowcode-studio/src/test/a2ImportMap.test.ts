import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { importXaml } from '../interop/xamlImport';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { lcsTypeFromXamlName } from '../interop/activityMap';
import { ACTIVITY_CATALOG } from '../models/activities';
import { dryRunWorkflow, classifyExecutionKind } from '../commands/simulator';

function fixture(name: string): string {
  const fromOut = path.join(__dirname, 'fixtures', name);
  const fromSrc = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', name);
  return fs.readFileSync(fs.existsSync(fromOut) ? fromOut : fromSrc, 'utf8');
}

function run(): void {
  assert.strictEqual(lcsTypeFromXamlName('ReadTextFile'), 'System.ReadTextFile');
  assert.strictEqual(lcsTypeFromXamlName('WriteTextFile'), 'System.WriteTextFile');
  assert.strictEqual(lcsTypeFromXamlName('FlowSwitch'), 'Flowchart.FlowSwitch');
  assert.strictEqual(lcsTypeFromXamlName('PathExists'), 'System.PathExists');

  for (const type of [
    'System.ReadTextFile',
    'System.WriteTextFile',
    'System.AppendLine',
    'System.PathExists',
    'System.CreateDirectory',
    'System.CopyFile',
    'System.DeleteFile',
    'Flowchart.FlowSwitch'
  ]) {
    assert.ok(
      ACTIVITY_CATALOG.some((a) => a.type === type),
      `missing catalog entry ${type}`
    );
    assert.notStrictEqual(classifyExecutionKind(type), 'unsupported');
  }

  const { workflow } = importXaml(fixture('file-io.xaml'), 'FileIo');
  const types = workflow.activities.map((a) => a.type);
  assert.ok(types.includes('System.ReadTextFile'), `got ${types.join(',')}`);
  assert.ok(types.includes('System.WriteTextFile'));
  assert.ok(types.includes('System.AppendLine'));
  assert.ok(types.includes('System.PathExists'));
  assert.ok(types.includes('System.CreateDirectory'));
  assert.ok(types.includes('System.CopyFile'));
  assert.ok(types.includes('System.DeleteFile'));
  assert.ok(!types.some((t) => t.startsWith('Imported.')), 'file IO must not be Imported.*');

  const exported = exportWorkflowToXaml(workflow);
  assert.ok(exported.includes('ui:ReadTextFile'));
  assert.ok(exported.includes('ui:WriteTextFile'));
  assert.ok(exported.includes('ui:PathExists'));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-a2-'));
  fs.writeFileSync(path.join(tmp, 'notes.txt'), 'hello-a2', 'utf8');
  const dry = dryRunWorkflow(workflow, { projectDir: tmp });
  assert.strictEqual(dry.ok, true);
  assert.strictEqual(dry.variables.fileText, 'hello-a2');
  assert.strictEqual(dry.variables.exists, true);
  assert.ok(fs.existsSync(path.join(tmp, 'out.txt')));

  const switchDoc = {
    schemaVersion: '1.0' as const,
    name: 'SwitchDemo',
    type: 'Flowchart' as const,
    variables: [],
    arguments: [],
    activities: [
      {
        id: 's1',
        type: 'Flowchart.FlowSwitch',
        displayName: 'Route',
        properties: { expression: 'key', cases: 'A,B,Default' }
      }
    ],
    connections: []
  };
  // Flowchart exports as Sequence — FlowSwitch becomes Switch (FlowSwitch is invalid in Sequence)
  const switchXaml = exportWorkflowToXaml(switchDoc);
  assert.ok(switchXaml.includes('<Switch'), switchXaml.slice(0, 400));
  assert.ok(!switchXaml.includes('<FlowSwitch'), switchXaml.slice(0, 400));

  console.log('a2ImportMap.test.ts OK');
}

run();
