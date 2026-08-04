import assert from 'assert';
import { dryRunWorkflow } from '../commands/simulator';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { getActivityDefinition, getActivityCatalog } from '../models/activities';
import { createEmptyWorkflow } from '../models/workflow';
import { packagesForActivityType } from '../interop/uipathDependencies';

function run(): void {
  const def = getActivityDefinition('UI.ExtractTableData');
  assert.ok(def, 'Extract Table Data activity missing');
  assert.strictEqual(def?.displayName, 'Extract Table Data');
  assert.ok(def?.properties.some((p) => p.name === 'smartExtraction'));
  assert.ok(packagesForActivityType('UI.ExtractTableData').includes('UiPath.UIAutomation.Activities'));

  const catalog = getActivityCatalog();
  assert.ok(catalog.some((a) => a.type === 'UI.ExtractTableData'));

  const wf = createEmptyWorkflow('ExtractDemo', 'Sequence');
  wf.variables = [{ name: 'extractedTable', type: 'DataTable', defaultValue: null }];
  wf.activities = [
    {
      id: 'ex1',
      type: 'UI.ExtractTableData',
      displayName: 'Extract Orders',
      properties: {
        selector: "<html app='chrome.exe' title='*' />\n<webctrl tag='TABLE' />",
        extractionMetadata:
          '{"Columns":[{"Name":"OrderId"},{"Name":"Amount"}],"SmartExtraction":true}',
        includeHeaders: true,
        maxResults: 3,
        smartExtraction: true,
        result: 'extractedTable'
      }
    }
  ];

  const result = dryRunWorkflow(wf);
  assert.ok(result.ok);
  const table = result.variables.extractedTable as {
    columns: string[];
    rows: string[][];
  };
  assert.deepStrictEqual(table.columns, ['OrderId', 'Amount']);
  assert.strictEqual(table.rows.length, 3);

  const xaml = exportWorkflowToXaml(wf);
  assert.ok(xaml.includes('ExtractTableData'));
  assert.ok(xaml.includes('SmartExtraction="True"'));
  assert.ok(xaml.includes('webctrl') || xaml.includes('TABLE'));

  console.log('extractTableData.test.ts: all assertions passed');
}

run();
