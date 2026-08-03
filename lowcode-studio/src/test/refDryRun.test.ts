import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  deepMerge,
  evaluateExpect,
  loadScenariosFile,
  runAllScenarios,
  runScenario,
  variablesFromConfig
} from '../commands/refDryRun';
import { dryRunWorkflow } from '../commands/simulator';
import { parseWorkflow } from '../models/workflow';

function run(): void {
  const merged = deepMerge(
    { Settings: { MaxTransactions: 3, LogLevel: 'Info' } },
    { Settings: { MaxTransactions: 1 } }
  );
  assert.strictEqual((merged.Settings as { MaxTransactions: number }).MaxTransactions, 1);
  assert.strictEqual((merged.Settings as { LogLevel: string }).LogLevel, 'Info');

  const vars = variablesFromConfig({
    Settings: { MaxTransactions: 2, MaxRetryNumber: 1 },
    Constants: { OrchestratorQueueName: 'Q' }
  });
  assert.strictEqual(vars.MaxTransactions, 2);
  assert.strictEqual(vars.OrchestratorQueueName, 'Q');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-ref-'));
  for (const file of generateREFrameworkProject('ScenarioDemo')) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, file.content, 'utf8');
  }

  assert.ok(fs.existsSync(path.join(dir, 'Data/Test/scenarios.json')));
  assert.ok(fs.existsSync(path.join(dir, 'activities.custom.json')));

  const scenarios = loadScenariosFile(dir);
  assert.ok(scenarios.scenarios.length >= 3);

  const results = runAllScenarios(dir);
  assert.strictEqual(results.length, scenarios.scenarios.length);
  for (const r of results) {
    assert.ok(r.passed, `${r.scenario.name}: ${r.assertions.map((a) => a.message).join('; ')}`);
  }

  const single = runScenario(
    dir,
    scenarios.scenarios.find((s) => s.name === 'single-item')!
  );
  assert.ok(single.passed);
  assert.ok(single.dryRun.log.some((l) => l.includes('Seeded variables')));

  const main = parseWorkflow(fs.readFileSync(path.join(dir, 'Main.lcs.json'), 'utf8'));
  const seeded = dryRunWorkflow(main, {
    initialVariables: { MaxTransactions: 0, TransactionNumber: 1, TransactionItem: null }
  });
  assert.strictEqual(seeded.ok, true);

  const asserts = evaluateExpect(
    { ok: true, logIncludes: ['CloseAllApplications'], variables: { TransactionItem: null } },
    seeded
  );
  assert.ok(asserts.every((a) => a.ok));

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('refDryRun.test.ts: all assertions passed');
}

run();
