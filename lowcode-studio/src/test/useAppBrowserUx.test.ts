import assert from 'assert';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { importXaml } from '../interop/xamlImport';
import { isPlaceholderSelector } from '../interop/windowsTarget';
import { createEmptyWorkflow } from '../models/workflow';

function run(): void {
  const imported = importXaml(
    `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
 xmlns:uia="http://schemas.uipath.com/workflow/activities/uipath.uiautomationnext"
 xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <uia:NApplicationCard DisplayName="Shop" Url="https://example.com" OpenMode="IfNotOpen"
      CloseMode="Never" BrowserType="Chrome" AttachMode="Browser" InteractionMode="Simulate">
      <uia:NApplicationCard.Body>
        <Sequence>
          <uia:NClick DisplayName="Buy" ClickType="Single"
            Selector="&lt;html app='chrome.exe' title='*' /&gt;&#xA;&lt;webctrl tag='BUTTON' id='buyNow' /&gt;" />
          <uia:NGetText DisplayName="Price" Result="[price]" TimeoutMS="15000"
            Selector="&lt;html app='chrome.exe' title='*' /&gt;&#xA;&lt;webctrl tag='SPAN' id='price' /&gt;" />
        </Sequence>
      </uia:NApplicationCard.Body>
    </uia:NApplicationCard>
  </Sequence>
</Activity>`,
    'UseAppImport'
  );

  assert.strictEqual(imported.workflow.activities.length, 1);
  const scope = imported.workflow.activities[0];
  assert.strictEqual(scope.type, 'UI.UseApplicationBrowser');
  assert.strictEqual(scope.properties.mode, 'Browser');
  assert.strictEqual(scope.properties.urlOrPath, 'https://example.com');
  assert.ok(Array.isArray(scope.children) && scope.children.length === 2, 'nested UI children kept');
  assert.strictEqual(scope.children![0].type, 'UI.Click');
  assert.strictEqual(scope.children![1].type, 'UI.GetText');
  assert.ok(String(scope.children![0].properties.selector).includes('buyNow'));

  const wf = createEmptyWorkflow('ResultExport', 'Sequence');
  wf.activities = [
    {
      id: 'g1',
      type: 'UI.GetText',
      displayName: 'Read',
      properties: {
        selector:
          "<html app='chrome.exe' title='*' />\n<webctrl tag='SPAN' id='priceLabel' />",
        result: 'extractedText',
        timeoutMs: 12000,
        inputMethod: 'Simulate'
      }
    },
    {
      id: 'e1',
      type: 'UI.ElementExists',
      displayName: 'Exists?',
      properties: {
        selector:
          "<html app='chrome.exe' title='*' />\n<webctrl tag='DIV' id='modal' />",
        result: 'exists',
        timeoutMs: 3000
      }
    }
  ];
  const xaml = exportWorkflowToXaml(wf);
  assert.ok(xaml.includes('Result="[extractedText]"'), xaml);
  assert.ok(xaml.includes('Result="[exists]"'), xaml);
  assert.ok(xaml.includes('TimeoutMS="12000"'), xaml);
  assert.ok(xaml.includes('TimeoutMS="3000"'), xaml);

  assert.ok(isPlaceholderSelector(''));
  assert.ok(
    isPlaceholderSelector(
      "<html app='chrome.exe' title='*' />\n<webctrl tag='BUTTON' id='btnSubmit' />"
    )
  );
  assert.ok(
    !isPlaceholderSelector(
      "<html app='chrome.exe' title='*' />\n<webctrl tag='BUTTON' id='buyNow' />"
    )
  );

  console.log('useAppBrowserUx.test.ts: all assertions passed');
}

run();
