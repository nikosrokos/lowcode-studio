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

  assert.ok(connected.archives, 'archives should be returned');
  assert.ok(fs.existsSync(connected.archives.uipPath), '.uip package missing');
  assert.ok(connected.archives.uipPath.endsWith('.uip'));
  assert.strictEqual(
    connected.archives.uisPath,
    undefined,
    'Connect / Export .uip must not create .uis'
  );
  assert.ok(
    !fs.existsSync(connected.archives.uipPath.replace(/\.uip$/i, '.uis')),
    '.uis must not be written beside .uip'
  );

  const uip = new AdmZip(connected.archives.uipPath);
  const uipNames = uip.getEntries().map((e) => e.entryName.replace(/\\/g, '/'));
  assert.ok(uipNames.some((n) => n === 'project.json' || n.endsWith('/project.json')));
  assert.ok(uipNames.some((n) => n === 'Main.xaml' || n.endsWith('/Main.xaml')));

  // Optional .uis path still available when explicitly requested
  const withUis = packageStudioWebArchives(connected.targetDir, path.dirname(connected.targetDir), {
    includeUis: true
  });
  assert.ok(withUis.uisPath && fs.existsSync(withUis.uisPath));
  const uis = new AdmZip(withUis.uisPath!);
  const uisNames = uis.getEntries().map((e) => e.entryName.replace(/\\/g, '/'));
  assert.ok(uisNames.some((n) => n.endsWith('.uipx')));
  assert.ok(uisNames.some((n) => n.includes('projects/') && n.endsWith('project.json')));

  const guide = fs.readFileSync(connected.guidePath, 'utf8');
  assert.ok(guide.includes('studio.uipath.com'));
  assert.ok(guide.includes('.uip'));
  assert.ok(!guide.includes('.uis'));

  const md = studioWebSyncGuideMarkdown();
  assert.ok(md.includes('Connect to Studio Web'));
  assert.ok(md.includes('.uip'));
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
  fs.rmSync(connected.archives.uipPath, { force: true });
  if (withUis.uisPath) {
    fs.rmSync(withUis.uisPath, { force: true });
  }
  fs.rmSync(withUis.uipPath, { force: true });
  console.log('studioWebConnect.test.ts: all assertions passed');
}

run();
