import assert from 'assert';
import {
  classifyExecutionKind,
  dryRunWorkflow,
  formatDryRunReport
} from '../commands/simulator';
import { createEmptyWorkflow } from '../models/workflow';

function run(): void {
  assert.strictEqual(classifyExecutionKind('Programming.Assign'), 'real');
  assert.strictEqual(classifyExecutionKind('Data.FilterDataTable'), 'real');
  assert.strictEqual(classifyExecutionKind('Messaging.SelectToken'), 'real');
  assert.strictEqual(classifyExecutionKind('UI.Click'), 'simulated');
  assert.strictEqual(classifyExecutionKind('Excel.ReadRange'), 'simulated');
  assert.strictEqual(classifyExecutionKind('Orchestrator.GetAsset'), 'simulated');
  assert.strictEqual(classifyExecutionKind('Imported.Foo'), 'unsupported');

  const doc = createEmptyWorkflow('DryRun2', 'Sequence');
  doc.variables.push({ name: 'x', type: 'Int32', defaultValue: 0 });
  doc.activities = [
    {
      id: 'a1',
      type: 'Programming.Assign',
      displayName: 'Assign',
      properties: { to: 'x', value: '1' }
    },
    {
      id: 'a2',
      type: 'UI.Click',
      displayName: 'Click',
      properties: { selector: '' }
    },
    {
      id: 'a3',
      type: 'Imported.Mystery',
      displayName: 'Mystery',
      properties: {}
    }
  ];

  const result = dryRunWorkflow(doc);
  assert.ok(result.steps.length >= 2);
  const assign = result.steps.find((s) => s.type === 'Programming.Assign');
  const click = result.steps.find((s) => s.type === 'UI.Click');
  assert.strictEqual(assign?.executionKind, 'real');
  assert.strictEqual(click?.executionKind, 'simulated');

  const report = formatDryRunReport(result, 'Dry Run 2.0');
  assert.ok(report.includes('[real]'));
  assert.ok(report.includes('[simulated]'));

  console.log('dryRun2.test.ts: ok');
}

run();
