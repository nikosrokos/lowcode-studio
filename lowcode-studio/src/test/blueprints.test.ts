import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ROBOT_BLUEPRINTS,
  generateBlueprintProject,
  getBlueprint
} from '../templates/blueprints';
import { parseWorkflow } from '../models/workflow';
import { dryRunWorkflow } from '../commands/simulator';
import { evaluateExpect, runScenario } from '../commands/refDryRun';
import { collectActivityTypes } from '../interop/uipathDependencies';

function writeProject(
  dir: string,
  files: { relativePath: string; content: string | Buffer }[]
): void {
  for (const file of files) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }
}

function run(): void {
  assert.strictEqual(ROBOT_BLUEPRINTS.length, 4);
  assert.ok(getBlueprint('web-scrape-excel'));
  assert.ok(getBlueprint('login-extract-email'));
  assert.ok(getBlueprint('api-datatable-process'));
  assert.ok(getBlueprint('queue-orchestrator'));

  for (const bp of ROBOT_BLUEPRINTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `lcs-bp-${bp.id}-`));
    const files = generateBlueprintProject(`Demo_${bp.id}`, bp.id);
    writeProject(dir, files);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'project.json'), 'utf8')
    ) as {
      template?: string;
      blueprintId?: string;
      uipathDependencies?: Record<string, string>;
      main?: string;
    };
    assert.strictEqual(manifest.template, 'blueprint');
    assert.strictEqual(manifest.blueprintId, bp.id);
    assert.ok(manifest.uipathDependencies);
    assert.ok(
      Object.keys(manifest.uipathDependencies || {}).includes(
        'UiPath.UIAutomation.Activities'
      ) ||
        bp.id === 'api-datatable-process'
    );

    const main = parseWorkflow(fs.readFileSync(path.join(dir, 'Main.lcs.json'), 'utf8'));
    assert.ok(main.activities.length >= 3);
    assert.ok(collectActivityTypes([main]).length >= 3);

    const scenarios = JSON.parse(
      fs.readFileSync(path.join(dir, 'Data/Test/scenarios.json'), 'utf8')
    ) as { scenarios: Array<{ name: string; fixtures?: unknown; expect?: unknown }> };
    assert.ok(scenarios.scenarios.length >= 1);

    const result = runScenario(dir, scenarios.scenarios[0] as never);
    assert.ok(result.passed, `${bp.id} scenario failed: ${JSON.stringify(result.assertions)}`);

    // Direct dry-run also succeeds
    const dry = dryRunWorkflow(main);
    assert.ok(dry.ok);

    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Spot-check web scrape structure
  const scrapeFiles = generateBlueprintProject('Scrape', 'web-scrape-excel');
  const scrapeMain = parseWorkflow(
    String(scrapeFiles.find((f) => f.relativePath === 'Main.lcs.json')?.content || '')
  );
  assert.ok(scrapeMain.activities.some((a) => a.type === 'UI.UseApplicationBrowser'));
  assert.ok(scrapeMain.activities.some((a) => a.type === 'Excel.WriteRange'));
  const scope = scrapeMain.activities.find((a) => a.type === 'UI.UseApplicationBrowser');
  assert.ok(scope?.children?.some((c) => c.type === 'UI.ExtractTableData'));

  const apiFiles = generateBlueprintProject('Api', 'api-datatable-process');
  const apiMain = parseWorkflow(
    String(apiFiles.find((f) => f.relativePath === 'Main.lcs.json')?.content || '')
  );
  const dryApi = dryRunWorkflow(apiMain, {
    fixtures: {
      http: { 'api.example.com': { status: 200, body: { ok: true } } }
    }
  });
  assert.ok(dryApi.ok);
  assert.strictEqual(dryApi.variables.processedCount, 2);
  const asserts = evaluateExpect(
    { ok: true, variables: { processedCount: 2 } },
    dryApi
  );
  assert.ok(asserts.every((a) => a.ok));

  console.log('blueprints.test.ts: all assertions passed');
}

run();
