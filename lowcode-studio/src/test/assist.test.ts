import assert from 'assert';
import { explainWorkflow } from '../commands/assistExplain';
import {
  applyGeneratedScenarios,
  generateScenariosFromDescription
} from '../commands/assistScenarios';
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

  console.log('assist.test.ts OK');
}

run();
