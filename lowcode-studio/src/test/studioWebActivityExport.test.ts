import assert from 'assert';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { importXaml } from '../interop/xamlImport';
import { createEmptyWorkflow } from '../models/workflow';
import {
  isWindowsOnlyActivityType,
  portableStrategyFor
} from '../interop/studioWebCompat';
import { ACTIVITY_CATALOG } from '../models/activities';

function run(): void {
  assert.ok(isWindowsOnlyActivityType('Data.BuildDataTable'));
  assert.strictEqual(portableStrategyFor('Data.BuildDataTable'), 'rewrite');
  assert.strictEqual(portableStrategyFor('Programming.MultipleAssign'), 'rewrite');
  assert.strictEqual(portableStrategyFor('System.MessageBox'), 'rewrite');
  assert.strictEqual(portableStrategyFor('System.DeleteFile'), 'comment');
  assert.strictEqual(portableStrategyFor('Python.PythonScope'), 'comment');

  const wf = createEmptyWorkflow('StudioWebActs', 'Sequence');
  wf.variables = [
    { name: 'dt', type: 'DataTable', defaultValue: null },
    { name: 'exists', type: 'Boolean', defaultValue: false }
  ];
  wf.activities = [
    {
      id: 'b1',
      type: 'Data.BuildDataTable',
      displayName: 'Build items',
      properties: { columns: 'Name,Amount,Status', result: 'dt' }
    },
    {
      id: 'm1',
      type: 'Programming.MultipleAssign',
      displayName: 'Set vars',
      properties: { assignments: 'a = 1\nb = 2' }
    },
    {
      id: 'mb',
      type: 'System.MessageBox',
      displayName: 'Alert',
      properties: { text: '"Hello"', title: 'Hi' }
    },
    {
      id: 'df',
      type: 'System.DeleteFile',
      displayName: 'Delete tmp',
      properties: { path: '"tmp.txt"' }
    },
    {
      id: 'oa',
      type: 'UI.OpenApplication',
      displayName: 'Open page',
      properties: { pathOrUrl: 'https://example.com' }
    },
    {
      id: 'ee',
      type: 'UI.ElementExists',
      displayName: 'Exists?',
      properties: {
        selector: "<html app='chrome.exe' title='*' />\n<webctrl id='x' />",
        result: 'exists',
        timeoutMs: 3000
      }
    },
    {
      id: 'we',
      type: 'UI.WaitElement',
      displayName: 'Wait vanish',
      properties: {
        selector: "<html app='chrome.exe' title='*' />\n<webctrl id='modal' />",
        action: 'Vanish',
        timeoutMs: 10000
      }
    },
    {
      id: 'ti',
      type: 'UI.TypeInto',
      displayName: 'Type',
      properties: {
        selector: "<html app='chrome.exe' title='*' />\n<webctrl tag='INPUT' />",
        text: '"hi"',
        emptyField: true,
        inputMethod: 'Simulate'
      }
    },
    {
      id: 'csv',
      type: 'Data.ReadCsv',
      displayName: 'Read CSV',
      properties: { path: 'data.csv', result: 'dt' }
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
    },
    {
      id: 'py',
      type: 'Python.PythonScope',
      displayName: 'Python',
      properties: { path: '/usr/bin/python3' },
      children: []
    }
  ];

  // Windows export: keep Windows-only types where valid
  const win = exportWorkflowToXaml(wf, { targetFramework: 'Windows' });
  assert.ok(win.includes('<ui:BuildDataTable'), win);
  assert.ok(win.includes('ui:MultipleAssign'), win);
  assert.ok(win.includes('ui:MessageBox'), win);
  assert.ok(win.includes('ui:DeleteFile'), win);
  assert.ok(win.includes('uia:NApplicationCard'), win);
  assert.ok(win.includes('uia:NApplicationCard.TargetApp'), win);
  assert.ok(win.includes('Url="https://example.com/orders"'), win);
  assert.ok(!/NApplicationCard[^>]+\sUrl=/.test(win), 'Url must not be on the card');
  assert.ok(!win.includes('AttachMode="Browser"'), win);
  assert.ok(!win.includes('uia:NOpenApplication'), win);
  assert.ok(!win.includes('uia:ElementExists'), win);
  assert.ok(!win.includes('uia:OnElementAppear'), win);
  assert.ok(win.includes('uia:NCheckState'), win);
  assert.ok(win.includes('EmptyFieldMode="SingleLine"'), win);
  assert.ok(!win.includes('EmptyField="True"'), win);
  assert.ok(win.includes('ui:ReadCsvFile') && win.includes('FilePath='), win);
  assert.ok(win.includes('python:PythonScope'), win);

  // Portable / Studio Web
  const portable = exportWorkflowToXaml(wf, { targetFramework: 'Portable' });
  assert.ok(!portable.includes('<ui:BuildDataTable'), portable);
  assert.ok(portable.includes('New System.Data.DataTable'), portable);
  assert.ok(portable.includes('ui:AddDataColumn'), portable);
  assert.ok(!portable.includes('ui:MultipleAssign'), portable);
  assert.ok(portable.includes('(Portable)'), portable);
  assert.ok(!portable.includes('ui:MessageBox'), portable);
  assert.ok(portable.includes('ui:LogMessage') && portable.includes('(Portable)'), portable);
  assert.ok(!portable.includes('ui:DeleteFile'), portable);
  assert.ok(portable.includes('Delete File is Windows-only'), portable);
  assert.ok(portable.includes('uia:NApplicationCard.TargetApp'), portable);
  assert.ok(portable.includes('uia:NCheckState'), portable);
  assert.ok(!portable.includes('python:PythonScope'), portable);
  assert.ok(portable.includes('Python activities are not'), portable);

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
  const scope = imported.workflow.activities[0];
  assert.strictEqual(scope.type, 'UI.UseApplicationBrowser');
  assert.strictEqual(scope.properties.urlOrPath, 'https://shop.example');
  assert.strictEqual(scope.properties.browserType, 'Edge');

  // Catalog coverage: every definition has a package map or is flowchart/UI-known
  for (const def of ACTIVITY_CATALOG) {
    if (def.type.startsWith('Flowchart.')) continue;
    if (def.type.startsWith('Imported.')) continue;
    // Smoke: Portable export of a single activity never throws
    const one = createEmptyWorkflow('One', 'Sequence');
    one.activities = [
      {
        id: 'a1',
        type: def.type,
        displayName: def.displayName,
        properties: Object.fromEntries(
          (def.properties || []).map((p: { name: string; defaultValue?: unknown }) => [
            p.name,
            p.defaultValue ?? ''
          ])
        ),
        children: def.container ? [] : undefined
      }
    ];
    const x = exportWorkflowToXaml(one, { targetFramework: 'Portable' });
    assert.ok(x.includes('<Activity'), def.type + ' failed Portable export');
    // Must not emit known-broken tags
    assert.ok(!x.includes('uia:NOpenApplication'), def.type);
    assert.ok(!x.includes('uia:ElementExists'), def.type);
    assert.ok(!x.includes('AttachMode="Browser"'), def.type);
    assert.ok(!x.includes('EmptyField="True"'), def.type);
    assert.ok(!x.includes('EmptyField="False"'), def.type);
  }

  console.log('studioWebActivityExport.test.ts: all assertions passed');
}

run();
