import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  getStudioWebLocalSyncStatus,
  linkStudioWebLocalWorkspace
} from '../interop/studioWebLocal';

function writeRef(dir: string, name = 'SyncBadgeDemo'): void {
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-sync-badge-'));
  const lcsDir = path.join(root, 'SyncBadgeDemo');
  const parent = path.join(root, 'workspace');
  fs.mkdirSync(parent, { recursive: true });
  writeRef(lcsDir);

  const unlinked = getStudioWebLocalSyncStatus(lcsDir);
  assert.strictEqual(unlinked.linked, false);
  assert.strictEqual(unlinked.inSync, true);

  linkStudioWebLocalWorkspace(lcsDir, {
    mode: 'create',
    targetDir: parent
  });

  const synced = getStudioWebLocalSyncStatus(lcsDir);
  assert.strictEqual(synced.linked, true);
  assert.strictEqual(synced.inSync, true, synced.summary);

  const mainLcs = path.join(lcsDir, 'Main.lcs.json');
  const link = synced.link!;
  const mainXaml = path.join(link.solutionDir, link.projectFolder, 'Main.xaml');
  assert.ok(fs.existsSync(mainXaml));
  // Change LCS content so fingerprints report lcs-newer (mtime alone is not enough)
  const doc = JSON.parse(fs.readFileSync(mainLcs, 'utf8')) as {
    description?: string;
  };
  doc.description = `edited-for-sync-badge ${Date.now()}`;
  fs.writeFileSync(mainLcs, JSON.stringify(doc, null, 2) + '\n', 'utf8');

  const stale = getStudioWebLocalSyncStatus(lcsDir);
  assert.strictEqual(stale.inSync, false);
  assert.ok(stale.stale.some((s) => s.workflowRel === 'Main.lcs.json'));
  assert.ok(/out of sync/i.test(stale.summary));

  console.log('studioWebLocalSync.test.ts: all assertions passed');
}

run();
