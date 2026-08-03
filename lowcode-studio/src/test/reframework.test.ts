import assert from 'assert';
import { generateREFrameworkProject } from '../templates/reframework';
import { parseWorkflow } from '../models/workflow';
import { dryRunWorkflow, validateWorkflow } from '../commands/simulator';

function run(): void {
  const files = generateREFrameworkProject('DemoREF');
  const paths = files.map((f) => f.relativePath);

  assert.ok(paths.includes('Main.lcs.json'));
  assert.ok(paths.includes('Framework/Process.lcs.json'));
  assert.ok(paths.includes('Data/Config.json'));
  assert.ok(paths.includes('Data/Test/scenarios.json'));
  assert.ok(paths.includes('activities.custom.json'));
  assert.ok(paths.includes('project.json'));

  const main = parseWorkflow(files.find((f) => f.relativePath === 'Main.lcs.json')!.content);
  assert.strictEqual(main.type, 'Flowchart');
  assert.ok((main.connections || []).length >= 5);
  assert.ok(main.activities.some((a) => a.type === 'Flowchart.FlowDecision'));
  assert.ok(main.activities.some((a) => a.type === 'REFramework.InvokeWorkflow'));

  const issues = validateWorkflow(main).filter((i) => i.severity === 'error');
  assert.strictEqual(issues.length, 0, issues.map((i) => i.message).join('; '));

  // Decision True path should be taken with default TransactionItem object
  const result = dryRunWorkflow(main);
  assert.strictEqual(result.ok, true);
  assert.ok(result.log.some((l) => l.includes('InvokeWorkflow')));
  assert.ok(result.steps.length > 3);

  const process = parseWorkflow(
    files.find((f) => f.relativePath === 'Framework/Process.lcs.json')!.content
  );
  assert.strictEqual(process.type, 'Sequence');
  assert.ok(validateWorkflow(process).every((i) => i.severity !== 'error'));

  console.log('reframework.test.ts: all assertions passed');
}

run();
