import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { generateREFrameworkProject } from '../templates/reframework';
import { connectToStudioWeb, studioWebSyncGuideMarkdown } from '../interop/studioWebConnect';
import { packageStudioWebArchives } from '../interop/studioPackage';
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

  // Preferred: Local Workspace create+link
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-sw-ws-'));
  const connected = connectToStudioWeb(dir, {
    local: { mode: 'create', targetDir: parent, solutionName: 'StudioWebDemo' }
  });
  assert.strictEqual(connected.mode, 'local-workspace');
  assert.ok(fs.existsSync(connected.targetDir));
  assert.ok(fs.existsSync(connected.guidePath));
  assert.ok(connected.checklist.length >= 4);
  assert.ok(fs.existsSync(path.join(connected.targetDir, 'project.json')));
  assert.ok(fs.existsSync(path.join(connected.targetDir, 'Main.xaml')));
  assert.ok(connected.local?.uipxPath && fs.existsSync(connected.local.uipxPath));
  assert.ok(!connected.archives);

  const md = studioWebSyncGuideMarkdown();
  assert.ok(md.includes('Local Workspace'));
  assert.ok(md.includes('Save'));

  // Legacy .uip path still available
  const legacy = connectToStudioWeb(dir, { legacyUip: true });
  assert.strictEqual(legacy.mode, 'uip-package');
  assert.ok(legacy.archives && fs.existsSync(legacy.archives.uipPath));
  assert.ok(legacy.archives.uipPath.endsWith('.uip'));
  assert.strictEqual(legacy.archives.uisPath, undefined);

  const uip = new AdmZip(legacy.archives!.uipPath);
  const uipNames = uip.getEntries().map((e) => e.entryName.replace(/\\/g, '/'));
  assert.ok(uipNames.some((n) => n === 'project.json' || n.endsWith('/project.json')));

  const withUis = packageStudioWebArchives(legacy.targetDir, path.dirname(legacy.targetDir), {
    includeUis: true
  });
  assert.ok(withUis.uisPath && fs.existsSync(withUis.uisPath));

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
  fs.rmSync(parent, { recursive: true, force: true });
  fs.rmSync(legacy.targetDir, { recursive: true, force: true });
  fs.rmSync(legacy.archives!.uipPath, { force: true });
  if (withUis.uisPath) {
    fs.rmSync(withUis.uisPath, { force: true });
  }
  fs.rmSync(withUis.uipPath, { force: true });
  console.log('studioWebConnect.test.ts: all assertions passed');
}

run();
