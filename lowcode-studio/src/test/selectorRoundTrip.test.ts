import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { importXaml } from '../interop/xamlImport';
import { exportWorkflowToXaml } from '../interop/xamlExport';
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
  const { workflow, warnings } = importXaml(fixture('ui-selectors.xaml'), 'UiSelectors');

  const click = workflow.activities.find((a) => a.type === 'UI.Click' && a.displayName.includes('Submit'));
  assert.ok(click, 'Click Submit imported');
  assert.ok(String(click!.properties.selector).includes('btnSubmit'), 'classic selector kept');
  assert.strictEqual(click!.properties.selectorModern, 'modern-encoding-submit');
  assert.ok(click!.properties.selectorXml, 'selectorXml snapshot stored');

  const typeInto = workflow.activities.find((a) => a.type === 'UI.TypeInto');
  assert.ok(typeInto);
  assert.ok(String(typeInto!.properties.selector).includes('txtName'));
  assert.ok(String(typeInto!.properties.text).includes('Ada'));

  assert.ok(workflow.activities.some((a) => a.type === 'UI.GetText'));
  assert.ok(workflow.activities.some((a) => a.type === 'UI.Hover'));
  assert.ok(workflow.activities.some((a) => a.type === 'UI.SelectItem'));
  assert.ok(workflow.activities.some((a) => a.type === 'System.MessageBox'));
  assert.ok(workflow.activities.some((a) => a.type === 'Excel.ReadRange'));
  assert.ok(workflow.activities.some((a) => a.type === 'ControlFlow.RetryScope'));

  const exported = exportWorkflowToXaml(workflow);
  assert.ok(exported.includes('btnSubmit'), 'selector re-exported');
  assert.ok(exported.includes('modern-encoding-submit'), 'modern selector re-exported');
  assert.ok(exported.includes('uia:NClick'));
  assert.ok(exported.includes('uia:NTypeInto'));
  assert.ok(exported.includes('excel:ReadRange'));
  assert.ok(exported.includes('Target.Selector') || exported.includes('Selector='));

  // Round-trip import again and keep selector
  const again = importXaml(exported, 'RoundTrip');
  const click2 = again.workflow.activities.find((a) => a.type === 'UI.Click');
  assert.ok(click2);
  assert.ok(String(click2!.properties.selector).includes('btnSubmit'));

  const deps = resolveUiPathDependencies({
    activityTypes: collectActivityTypes([workflow]),
    includeBaseline: true
  });
  assert.ok(deps['UiPath.Excel.Activities']);
  assert.ok(deps['UiPath.UIAutomation.Activities']);

  console.log(
    `selectorRoundTrip.test.ts: ok (activities=${workflow.activities.length}, warnings=${warnings.length})`
  );
}

run();
