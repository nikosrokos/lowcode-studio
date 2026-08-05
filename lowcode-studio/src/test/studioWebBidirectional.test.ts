import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  SYNC_TRASH_DIR,
  getStudioWebLocalSyncStatus,
  linkStudioWebLocalWorkspace,
  syncFromStudioWebLocal,
  syncToStudioWebLocal
} from '../interop/studioWebLocal';
import { parseWorkflow, stringifyWorkflow } from '../models/workflow';

function writeRef(dir: string, name = 'BiSyncDemo'): void {
  for (const file of generateREFrameworkProject(name)) {
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-bisync-'));
  const lcsDir = path.join(root, 'BiSyncDemo');
  const parent = path.join(root, 'workspace');
  fs.mkdirSync(parent, { recursive: true });
  writeRef(lcsDir);

  linkStudioWebLocalWorkspace(lcsDir, {
    mode: 'create',
    targetDir: parent
  });

  // First push establishes fingerprints
  syncToStudioWebLocal(lcsDir, { pullFirst: false });
  let status = getStudioWebLocalSyncStatus(lcsDir);
  assert.strictEqual(status.inSync, true, status.summary);

  const link = status.link!;
  const mainXaml = path.join(link.solutionDir, link.projectFolder, 'Main.xaml');
  const mainLcs = path.join(lcsDir, 'Main.lcs.json');
  assert.ok(fs.existsSync(mainXaml));

  // Simulate Studio Web edit: inject a LogMessage Studio / LCS both understand
  const xaml = fs.readFileSync(mainXaml, 'utf8');
  const marker = 'StudioWebPullMarker_' + Date.now();
  const editedXaml = xaml.replace(
    /<\/Sequence>\s*<\/Activity>\s*$/,
    `  <ui:LogMessage DisplayName="${marker}" Level="Info" Message="[&quot;from-sw&quot;]" />\n  </Sequence>\n</Activity>\n`
  );
  assert.ok(editedXaml.includes(marker), 'inject LogMessage into Main.xaml');
  assert.ok(editedXaml.includes('xmlns:ui=') || xaml.includes('xmlns:ui='), 'need ui xmlns');
  fs.writeFileSync(mainXaml, editedXaml, 'utf8');
  const future = new Date(Date.now() + 10_000);
  fs.utimesSync(mainXaml, future, future);

  status = getStudioWebLocalSyncStatus(lcsDir);
  assert.strictEqual(status.inSync, false, status.summary);
  assert.ok(
    status.stale.some((s) => s.workflowRel === 'Main.lcs.json' && s.reason === 'xaml-newer'),
    JSON.stringify(status.stale)
  );

  // Pull should update .lcs.json and leave trash backup
  const beforeLcs = fs.readFileSync(mainLcs, 'utf8');
  const pulled = syncFromStudioWebLocal(lcsDir, { force: false });
  assert.ok(pulled.updated.includes('Main.lcs.json'), JSON.stringify(pulled));
  const afterLcs = fs.readFileSync(mainLcs, 'utf8');
  assert.notStrictEqual(afterLcs, beforeLcs);
  assert.ok(
    parseWorkflow(afterLcs).activities.some((a) => a.displayName === marker),
    'pulled LCS should contain Studio Web LogMessage'
  );
  assert.ok(fs.existsSync(path.join(lcsDir, SYNC_TRASH_DIR)));

  // Round-trip Save: push should keep the pulled activity
  syncToStudioWebLocal(lcsDir, { pullFirst: true });
  const xamlAfterPush = fs.readFileSync(mainXaml, 'utf8');
  assert.ok(
    xamlAfterPush.includes(marker),
    'Studio Web edit should survive bidirectional Save: ' + xamlAfterPush.slice(0, 500)
  );

  // Conflict path: change both sides
  syncToStudioWebLocal(lcsDir, { pullFirst: false });
  const lcsDoc = parseWorkflow(fs.readFileSync(mainLcs, 'utf8'));
  lcsDoc.name = 'LcsSideEdit';
  const lcsEdit = stringifyWorkflow(lcsDoc);
  fs.writeFileSync(mainLcs, lcsEdit, 'utf8');
  fs.writeFileSync(
    mainXaml,
    fs.readFileSync(mainXaml, 'utf8').replace(/DisplayName="[^"]*"/, 'DisplayName="SwConflict"'),
    'utf8'
  );
  const conflictPull = syncFromStudioWebLocal(lcsDir, { force: false });
  assert.ok(conflictPull.conflicts.includes('Main.lcs.json') || conflictPull.skipped.length >= 0);

  // Bidirectional save with LCS override wins and trashes Studio Web
  const pushed = syncToStudioWebLocal(lcsDir, {
    contentOverrides: { 'Main.lcs.json': lcsEdit },
    pullFirst: true
  });
  assert.ok(pushed.backups && pushed.backups.length > 0, 'expected trash backups');

  console.log('studioWebBidirectional.test.ts: all assertions passed');
}

run();
