import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { ACTIVITY_CATALOG } from '../models/activities';
import { importXaml } from '../interop/xamlImport';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { dryRunWorkflow } from '../commands/simulator';
import {
  collectActivityTypes,
  resolveUiPathDependencies
} from '../interop/uipathDependencies';

function fixture(name: string): string {
  const fromOut = path.join(__dirname, 'fixtures', name);
  const fromSrc = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', name);
  return fs.readFileSync(fs.existsSync(fromOut) ? fromOut : fromSrc, 'utf8');
}

function run(): void {
  const pythonTypes = ACTIVITY_CATALOG.filter((a) => a.category === 'Python').map((a) => a.type);
  assert.deepStrictEqual(
    pythonTypes.sort(),
    [
      'Python.GetObject',
      'Python.InvokeMethod',
      'Python.LoadScript',
      'Python.PythonScope',
      'Python.RunScript'
    ].sort()
  );

  const { workflow } = importXaml(fixture('python-scope.xaml'), 'PythonDemo');
  const scope = workflow.activities.find((a) => a.type === 'Python.PythonScope');
  assert.ok(scope);
  assert.ok(scope!.children?.some((c) => c.type === 'Python.LoadScript'));
  assert.ok(scope!.children?.some((c) => c.type === 'Python.InvokeMethod'));
  assert.ok(scope!.children?.some((c) => c.type === 'Python.GetObject'));
  assert.ok(scope!.children?.some((c) => c.type === 'Python.RunScript'));

  const exported = exportWorkflowToXaml(workflow);
  assert.ok(exported.includes('python:PythonScope'));
  assert.ok(exported.includes('python:LoadScript'));
  assert.ok(exported.includes('python:InvokeMethod'));
  assert.ok(exported.includes('python:GetObject'));
  assert.ok(exported.includes('python:RunScript'));

  const deps = resolveUiPathDependencies({
    activityTypes: collectActivityTypes([workflow]),
    includeBaseline: true
  });
  assert.ok(deps['UiPath.Python.Activities']);

  const dry = dryRunWorkflow(workflow);
  assert.strictEqual(dry.ok, true);
  assert.ok(dry.log.some((l) => l.includes('PythonScope')));
  assert.ok(dry.log.some((l) => l.includes('LoadPythonScript')));

  console.log('pythonActivities.test.ts: all assertions passed');
}

run();
