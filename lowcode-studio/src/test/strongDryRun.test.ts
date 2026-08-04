import assert from 'assert';
import {
  dryRunWorkflow,
  formatDryRunReport,
  formatVariableDiff
} from '../commands/simulator';
import { createEmptyWorkflow } from '../models/workflow';
import { evaluateExpect, formatScenarioReport } from '../commands/refDryRun';

function run(): void {
  const wf = createEmptyWorkflow('StrongDry', 'Sequence');
  wf.variables = [
    { name: 'label', type: 'String', defaultValue: '' },
    { name: 'exists', type: 'Boolean', defaultValue: false },
    { name: 'table', type: 'DataTable', defaultValue: null },
    { name: 'response', type: 'Object', defaultValue: null }
  ];
  wf.activities = [
    {
      id: 'click1',
      type: 'UI.Click',
      displayName: 'Click Empty',
      properties: { selector: '' }
    },
    {
      id: 'get1',
      type: 'UI.GetText',
      displayName: 'Get Title',
      properties: {
        selector: "<html app='chrome.exe' title='*' />\n<webctrl tag='H1' />",
        result: 'label'
      }
    },
    {
      id: 'ex1',
      type: 'UI.ElementExists',
      displayName: 'Popup Exists',
      properties: {
        selector: "<html app='chrome.exe' title='*' />\n<webctrl id='popup' />",
        result: 'exists'
      }
    },
    {
      id: 'tbl1',
      type: 'UI.ExtractTableData',
      displayName: 'Extract Orders',
      properties: {
        selector: "<html app='chrome.exe' title='*' />\n<webctrl tag='TABLE' />",
        result: 'table',
        maxResults: 2
      }
    },
    {
      id: 'http1',
      type: 'Messaging.HttpRequest',
      displayName: 'Get API',
      properties: {
        method: 'GET',
        url: 'https://api.example.com/orders',
        result: 'response'
      }
    }
  ];

  const result = dryRunWorkflow(wf, {
    fixtures: {
      uiText: { get1: 'Order #42', label: 'fallback-unused' },
      elementExists: { exists: false },
      tables: {
        table: {
          columns: ['OrderId', 'Amount'],
          rows: [['A-1', '10'], ['A-2', '20']]
        }
      },
      http: {
        'api.example.com': { status: 201, body: { created: true } }
      }
    }
  });

  assert.ok(result.ok);
  assert.ok(result.warnings.some((w) => w.includes('selector is empty')));
  assert.strictEqual(result.variables.label, 'Order #42');
  assert.strictEqual(result.variables.exists, false);
  const table = result.variables.table as { columns: string[]; rows: string[][] };
  assert.deepStrictEqual(table.columns, ['OrderId', 'Amount']);
  assert.strictEqual(table.rows.length, 2);
  assert.deepStrictEqual(result.variables.response, { status: 201, body: { created: true } });
  assert.ok(result.steps.every((s) => s.variablesSnapshot));
  assert.ok(result.steps.some((s) => (s.changedKeys || []).includes('label')));
  assert.ok(result.steps.some((s) => s.status === 'warn'));

  const report = formatDryRunReport(result, 'Dry Run — StrongDry');
  assert.ok(report.includes('Δ label'));
  assert.ok(report.includes('Warnings:'));

  const expect = {
    ok: true,
    variables: {
      label: 'Order #42',
      exists: false,
      table: { columns: ['OrderId', 'Amount'], rows: [['A-1', '10'], ['A-2', '20']] }
    }
  };
  const assertions = evaluateExpect(expect, result);
  assert.ok(assertions.every((a) => a.ok));

  const failDiff = formatVariableDiff(
    { label: 'wrong', table: { columns: ['X'], rows: [['1']] } },
    result.variables
  );
  assert.ok(failDiff.includes('Expected vs actual'));
  assert.ok(failDiff.includes('DataTable side-by-side'));

  const scenarioReport = formatScenarioReport([
    {
      scenario: {
        name: 'ui-fixtures',
        fixtures: { uiText: { get1: 'Order #42' } },
        expect
      },
      dryRun: result,
      assertions,
      passed: true,
      config: {}
    }
  ]);
  assert.ok(scenarioReport.includes('fixtures:'));
  assert.ok(scenarioReport.includes('PASS'));

  console.log('strongDryRun.test.ts: all assertions passed');
}

run();
