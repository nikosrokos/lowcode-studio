import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ACTIVITY_CATALOG, getActivityDefinition, setCustomActivityOverlay } from '../models/activities';
import {
  collectCustomNugetPackages,
  createCustomActivityDraft,
  loadProjectCustomActivities,
  mergeActivityCatalog,
  saveProjectCustomActivities,
  upsertCustomActivity,
  validateCustomActivityInput
} from '../models/customActivities';
import { dryRunWorkflow } from '../commands/simulator';
import { parseWorkflow } from '../models/workflow';

function run(): void {
  assert.ok(validateCustomActivityInput({ type: 'bad', displayName: 'X' }));
  assert.strictEqual(
    validateCustomActivityInput({
      type: 'Custom.MyLib.DoWork',
      displayName: 'Do Work'
    }),
    undefined
  );

  const draft = createCustomActivityDraft({
    type: 'Custom.MyLib.DoWork',
    displayName: 'Do Work',
    nugetPackage: 'MyLib.Activities',
    nugetVersion: '2.1.0',
    dryRun: {
      log: 'DoWork stub',
      assign: { result: '"done"' }
    }
  });
  assert.strictEqual(draft.category, 'Custom');
  assert.strictEqual(draft.nugetPackage, 'MyLib.Activities');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-custom-'));
  saveProjectCustomActivities(dir, [draft]);
  const loaded = loadProjectCustomActivities(dir);
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].type, 'Custom.MyLib.DoWork');

  const packages = collectCustomNugetPackages(loaded, ['Custom.MyLib.DoWork']);
  assert.strictEqual(packages['MyLib.Activities'], '[2.1.0]');

  const merged = mergeActivityCatalog(ACTIVITY_CATALOG, loaded, []);
  assert.ok(merged.some((a) => a.type === 'Custom.MyLib.DoWork'));
  assert.ok(merged.some((a) => a.type === 'System.LogMessage'));

  setCustomActivityOverlay(loaded);
  assert.ok(getActivityDefinition('Custom.MyLib.DoWork'));

  const list = upsertCustomActivity([], draft);
  assert.strictEqual(list.length, 1);

  const doc = parseWorkflow(`{
    "schemaVersion": "1.0",
    "name": "CustomTest",
    "type": "Sequence",
    "variables": [{ "name": "result", "type": "String", "defaultValue": "" }],
    "arguments": [],
    "activities": [{
      "id": "c1",
      "type": "Custom.MyLib.DoWork",
      "displayName": "Do Work",
      "properties": { "input": "\\"x\\"" }
    }]
  }`);
  const result = dryRunWorkflow(doc);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.variables.result, 'done');
  assert.ok(result.log.some((l) => l.includes('DoWork stub')));

  setCustomActivityOverlay([]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('customActivities.test.ts: all assertions passed');
}

run();
