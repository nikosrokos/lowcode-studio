import assert from 'assert';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { importXaml } from '../interop/xamlImport';
import { createEmptyWorkflow } from '../models/workflow';
import { isWindowsOnlyActivityType } from '../interop/studioWebCompat';

function run(): void {
  assert.ok(isWindowsOnlyActivityType('Data.BuildDataTable'));

  const wf = createEmptyWorkflow('StudioWebActs', 'Sequence');
  wf.variables = [{ name: 'dt', type: 'DataTable', defaultValue: null }];
  wf.activities = [
    {
      id: 'b1',
      type: 'Data.BuildDataTable',
      displayName: 'Build items',
      properties: { columns: 'Name,Amount,Status', result: 'dt' }
    },
    {
      id: 'u1',
      type: 'UI.UseApplicationBrowser',
      displayName: 'Use Browser — Orders',
      properties: {
        mode: 'Browser',
        urlOrPath: 'https://example.com/orders',
        browserType: 'Chrome',
        open: 'IfNotOpen',
        close: 'Never',
        inputMethod: 'Simulate',
        selector: "<html app='chrome.exe' title='*' />"
      },
      children: [
        {
          id: 'c1',
          type: 'UI.Click',
          displayName: 'Click',
          properties: {
            selector:
              "<html app='chrome.exe' title='*' />\n<webctrl tag='BUTTON' id='ok' />",
            inputMethod: 'Same as App/Browser'
          }
        }
      ]
    }
  ];

  // Windows export: BuildDataTable stays; Use Browser uses TargetApp
  const win = exportWorkflowToXaml(wf, { targetFramework: 'Windows' });
  assert.ok(win.includes('<ui:BuildDataTable'), win);
  assert.ok(win.includes('DataTable="[dt]"'), win);
  assert.ok(win.includes('uia:NApplicationCard'), win);
  assert.ok(win.includes('uia:NApplicationCard.TargetApp'), win);
  assert.ok(win.includes('uia:TargetApp'), win);
  assert.ok(win.includes('Url="https://example.com/orders"'), win);
  assert.ok(win.includes('BrowserType="Chrome"'), win);
  assert.ok(win.includes('AttachMode="ByInstance"'), win);
  assert.ok(!/NApplicationCard[^>]+\sUrl=/.test(win), 'Url must not be on the card: ' + win);
  assert.ok(!win.includes('AttachMode="Browser"'), win);
  assert.ok(win.includes('ActivityAction x:TypeArguments="x:Object"'), win);

  // Portable / Studio Web: BuildDataTable rewritten
  const portable = exportWorkflowToXaml(wf, { targetFramework: 'Portable' });
  assert.ok(!portable.includes('<ui:BuildDataTable'), portable);
  assert.ok(portable.includes('New System.Data.DataTable'), portable);
  assert.ok(portable.includes('ui:AddDataColumn'), portable);
  assert.ok(portable.includes('ColumnName="Name"'), portable);
  assert.ok(portable.includes('ColumnName="Amount"'), portable);
  assert.ok(portable.includes('uia:NApplicationCard.TargetApp'), portable);

  // Round-trip TargetApp import
  const imported = importXaml(
    `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
 xmlns:uia="http://schemas.uipath.com/workflow/activities/uipath.uiautomation.next">
  <Sequence>
    <uia:NApplicationCard DisplayName="Shop" OpenMode="IfNotOpen" CloseMode="Never"
      AttachMode="ByInstance" InteractionMode="Simulate" Version="V2">
      <uia:NApplicationCard.Body>
        <ActivityAction x:TypeArguments="x:Object">
          <ActivityAction.Argument>
            <DelegateInArgument x:TypeArguments="x:Object" Name="WSSessionData" />
          </ActivityAction.Argument>
          <Sequence />
        </ActivityAction>
      </uia:NApplicationCard.Body>
      <uia:NApplicationCard.TargetApp>
        <uia:TargetApp BrowserType="Edge" Url="https://shop.example" Selector="&lt;html app='msedge.exe' /&gt;" Version="V2" />
      </uia:NApplicationCard.TargetApp>
    </uia:NApplicationCard>
  </Sequence>
</Activity>`,
    'TargetAppImport'
  );
  assert.strictEqual(imported.workflow.activities.length, 1);
  const scope = imported.workflow.activities[0];
  assert.strictEqual(scope.type, 'UI.UseApplicationBrowser');
  assert.strictEqual(scope.properties.mode, 'Browser');
  assert.strictEqual(scope.properties.urlOrPath, 'https://shop.example');
  assert.strictEqual(scope.properties.browserType, 'Edge');
  assert.ok(String(scope.properties.selector).includes('msedge'));

  // Legacy Url-on-card still imports (older LCS exports)
  const legacy = importXaml(
    `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
 xmlns:uia="http://schemas.uipath.com/workflow/activities/uipath.uiautomation.next">
  <Sequence>
    <uia:NApplicationCard DisplayName="Legacy" Url="https://legacy.example" OpenMode="IfNotOpen"
      CloseMode="Never" BrowserType="Chrome" AttachMode="Browser" InteractionMode="Simulate">
      <uia:NApplicationCard.Body><Sequence /></uia:NApplicationCard.Body>
    </uia:NApplicationCard>
  </Sequence>
</Activity>`,
    'LegacyCard'
  );
  assert.strictEqual(legacy.workflow.activities[0].properties.urlOrPath, 'https://legacy.example');

  console.log('studioWebActivityExport.test.ts: all assertions passed');
}

run();
