import assert from 'assert';
import {
  fromXamlInteractionMode,
  interactionModeAttribute,
  resolveInputMethod,
  toXamlInteractionMode
} from '../interop/inputMethod';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { importXaml } from '../interop/xamlImport';
import { getActivityDefinition } from '../models/activities';
import { createEmptyWorkflow } from '../models/workflow';

function run(): void {
  assert.strictEqual(toXamlInteractionMode('Simulate'), 'Simulate');
  assert.strictEqual(toXamlInteractionMode('Chromium API'), 'DebuggerApi');
  assert.strictEqual(toXamlInteractionMode('Window Messages'), 'WindowMessages');
  assert.strictEqual(toXamlInteractionMode('Hardware Events'), 'HardwareEvents');
  assert.strictEqual(toXamlInteractionMode('Same as App/Browser'), 'SameAsCard');
  assert.strictEqual(toXamlInteractionMode('Background'), 'Background');

  assert.strictEqual(fromXamlInteractionMode('DebuggerApi'), 'Chromium API');
  assert.strictEqual(fromXamlInteractionMode('SameAsCard'), 'Same as App/Browser');

  assert.strictEqual(resolveInputMethod({ inputMethod: 'Chromium API' }), 'Chromium API');
  assert.strictEqual(resolveInputMethod({ simulateClick: true }), 'Simulate');
  assert.strictEqual(resolveInputMethod({ simulateClick: false }), 'Hardware Events');
  assert.ok(interactionModeAttribute({ inputMethod: 'Simulate' }).includes('InteractionMode="Simulate"'));
  assert.ok(
    interactionModeAttribute({ inputMethod: 'Chromium API' }).includes(
      'InteractionMode="DebuggerApi"'
    )
  );

  for (const type of [
    'UI.Click',
    'UI.TypeInto',
    'UI.Hover',
    'UI.Check',
    'UI.SelectItem',
    'UI.UseApplicationBrowser'
  ]) {
    const def = getActivityDefinition(type);
    assert.ok(def?.properties.some((p) => p.name === 'inputMethod'), `${type} missing inputMethod`);
  }

  const wf = createEmptyWorkflow('InputModeDemo', 'Sequence');
  wf.activities = [
    {
      id: 'scope1',
      type: 'UI.UseApplicationBrowser',
      displayName: 'Browser',
      properties: {
        mode: 'Browser',
        urlOrPath: 'https://example.com',
        browserType: 'Chrome',
        inputMethod: 'Chromium API',
        open: 'IfNotOpen',
        close: 'Never'
      },
      children: [
        {
          id: 'c1',
          type: 'UI.Click',
          displayName: 'Click',
          properties: {
            selector:
              "<html app='chrome.exe' title='*' />\n<webctrl tag='BUTTON' id='go' />",
            clickType: 'Single',
            inputMethod: 'Simulate'
          }
        },
        {
          id: 't1',
          type: 'UI.TypeInto',
          displayName: 'Type',
          properties: {
            selector:
              "<html app='chrome.exe' title='*' />\n<webctrl tag='INPUT' id='q' />",
            text: '"hello"',
            emptyField: true,
            inputMethod: 'Same as App/Browser'
          }
        }
      ]
    },
    {
      id: 'legacy',
      type: 'UI.Click',
      displayName: 'Legacy Simulate Flag',
      properties: {
        selector: "<html app='chrome.exe' title='*' />\n<webctrl tag='BUTTON' />",
        simulateClick: true
      }
    }
  ];

  const xaml = exportWorkflowToXaml(wf);
  assert.ok(xaml.includes('uia:NApplicationCard'));
  assert.ok(xaml.includes('InteractionMode="DebuggerApi"'), xaml);
  assert.ok(xaml.includes('InteractionMode="Simulate"'));
  assert.ok(xaml.includes('InteractionMode="SameAsCard"'));
  assert.ok(xaml.includes('ClickType="Single"'));
  assert.ok(xaml.includes('EmptyFieldMode="SingleLine"'), xaml);

  const imported = importXaml(
    `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
 xmlns:uia="http://schemas.uipath.com/workflow/activities/uipath.uiautomationnext">
  <Sequence>
    <uia:NClick DisplayName="Click" InteractionMode="DebuggerApi" ClickType="Single"
      Selector="&lt;html app='chrome.exe' title='*' /&gt;&#xA;&lt;webctrl tag='BUTTON' id='x' /&gt;" />
    <uia:NTypeInto DisplayName="Type" InteractionMode="Simulate" EmptyField="True" Text="[&quot;a&quot;]"
      Selector="&lt;html app='chrome.exe' title='*' /&gt;&#xA;&lt;webctrl tag='INPUT' /&gt;" />
  </Sequence>
</Activity>`,
    'ImportInput'
  );
  const click = imported.workflow.activities.find((a) => a.type === 'UI.Click');
  const typeInto = imported.workflow.activities.find((a) => a.type === 'UI.TypeInto');
  assert.strictEqual(click?.properties.inputMethod, 'Chromium API');
  assert.strictEqual(typeInto?.properties.inputMethod, 'Simulate');

  console.log('inputMethod.test.ts: all assertions passed');
}

run();
