import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import { connectToStudioWeb, studioWebSyncGuideMarkdown } from '../interop/studioWebConnect';
import {
  createQuickScenario,
  duplicateScenario,
  ensureScenariosFile,
  saveScenariosFile,
  upsertScenario
} from '../commands/refDryRun';

function run(): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-sw-'));
  for (const file of generateREFrameworkProject('StudioWebDemo')) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }

  const connected = connectToStudioWeb(dir);
  assert.ok(fs.existsSync(connected.targetDir));
  assert.ok(fs.existsSync(connected.guidePath));
  assert.ok(connected.checklist.length >= 4);
  assert.ok(fs.existsSync(path.join(connected.targetDir, 'project.json')));
  assert.ok(fs.existsSync(path.join(connected.targetDir, 'Main.xaml')));
  assert.ok(fs.existsSync(path.join(connected.targetDir, 'Data', 'Config.json')));
  assert.ok(
    fs.existsSync(path.join(connected.targetDir, 'Data', 'Test', 'scenarios.json')),
    'scenarios should be copied for handoff'
  );
  const guide = fs.readFileSync(connected.guidePath, 'utf8');
  assert.ok(guide.includes('studio.uipath.com'));
  assert.ok(guide.includes('Fast path'));

  const md = studioWebSyncGuideMarkdown();
  assert.ok(md.includes('Connect to Studio Web'));
  assert.ok(md.includes('Shift+F5') || md.includes('Dry Run'));

  // Scenario manage helpers
  const file = ensureScenariosFile(dir, 'StudioWebDemo');
  const smoke = createQuickScenario({ name: 'smoke', maxTransactions: 1 });
  const next = upsertScenario(file, smoke);
  assert.ok(next.scenarios.some((s) => s.name === 'smoke'));
  const copy = duplicateScenario(smoke, 'smoke-2');
  saveScenariosFile(dir, upsertScenario(next, copy));
  const reloaded = ensureScenariosFile(dir, 'StudioWebDemo');
  assert.ok(reloaded.scenarios.some((s) => s.name === 'smoke-2'));

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(connected.targetDir, { recursive: true, force: true });
  console.log('studioWebConnect.test.ts: all assertions passed');
}

run();
