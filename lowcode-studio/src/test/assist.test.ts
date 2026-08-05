import assert from 'assert';
import { explainWorkflow } from '../commands/assistExplain';
import {
  applyGeneratedScenarios,
  generateScenariosFromDescription
} from '../commands/assistScenarios';
import {
  applySelectorRepairs,
  proposeSelectorRepairs,
  suggestSelectorsFromHtml
} from '../commands/assistSelectors';
import { ScenariosFile } from '../commands/refDryRun';
import { WorkflowDocument } from '../models/workflow';

function run(): void {
  const doc: WorkflowDocument = {
    schemaVersion: '1.0',
    name: 'Main',
    type: 'Sequence',
    variables: [{ name: 'MaxTransactions', type: 'Int32', defaultValue: 3 }],
    arguments: [],
    activities: [
      {
        id: 'a1',
        type: 'System.LogMessage',
        displayName: 'Log',
        properties: { level: 'Info', message: '"hi"' }
      },
      {
        id: 'a2',
        type: 'Imported.Mystery',
        displayName: 'Mystery',
        properties: { note: 'todo' }
      },
      {
        id: 'a3',
        type: 'UI.Click',
        displayName: 'Click',
        properties: { selector: '' }
      },
      {
        id: 'a4',
        type: 'UI.TypeInto',
        displayName: 'Type',
        properties: { selector: "<html app='chrome.exe' title='*' />\n<webctrl tag='INPUT' id='input' />" }
      }
    ]
  };

  const report = explainWorkflow(doc);
  assert.ok(report.markdown.includes('Explain — Main'));
  assert.ok(report.markdown.includes('Imported'));
  assert.ok(report.critiqueCount >= 1);
  assert.ok(report.markdown.includes('Studio Web'));

  const httpScenarios = generateScenariosFromDescription(
    'REFramework queue with HTTP API and login UI',
    'Demo'
  );
  const names = httpScenarios.map((s) => s.name);
  assert.ok(names.includes('assist-happy-path'));
  assert.ok(names.includes('assist-http-ok'));
  assert.ok(names.includes('assist-ui-fixtures'));

  const excel = generateScenariosFromDescription('read excel spreadsheet', 'X');
  assert.ok(excel.some((s) => s.name === 'assist-table-fixture'));

  const empty: ScenariosFile = { schemaVersion: '1.0', scenarios: [] };
  const merged = applyGeneratedScenarios(empty, httpScenarios.slice(0, 2));
  assert.strictEqual(merged.scenarios.length, 2);

  // F3 — HTML → classic selector
  const fromHtml = suggestSelectorsFromHtml(
    '<button id="loginBtn" aria-label="Sign in" class="primary">Sign in</button>'
  );
  assert.ok(fromHtml.length >= 1, 'expected HTML suggestion');
  assert.ok(/loginBtn/.test(fromHtml[0].selector), fromHtml[0].selector);
  assert.ok(/webctrl/i.test(fromHtml[0].selector));
  assert.ok(fromHtml[0].quality.score >= 40);

  const fromId = suggestSelectorsFromHtml('#submitForm');
  assert.ok(fromId.some((s) => /submitForm/.test(s.selector)));

  // F3 — repair proposals (empty + starter id)
  const repairs = proposeSelectorRepairs(doc);
  assert.ok(repairs.some((r) => r.activityId === 'a3' && r.actionable));
  assert.ok(repairs.some((r) => r.activityId === 'a4'));
  const applied = applySelectorRepairs(
    doc,
    repairs.filter((r) => r.activityId === 'a3' && r.actionable)
  );
  assert.ok(String(applied.activities.find((a) => a.id === 'a3')?.properties.selector || ''));
  // Unselected starter TypeInto unchanged
  assert.ok(/id='input'/.test(String(applied.activities.find((a) => a.id === 'a4')?.properties.selector)));

  console.log('assist.test.ts OK');
}

run();
