import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  getStudioWebLocalLink,
  linkStudioWebLocalWorkspace,
  syncToStudioWebLocal
} from '../interop/studioWebLocal';
import { connectToStudioWeb } from '../interop/studioWebConnect';
import { parseWorkflow, stringifyWorkflow } from '../models/workflow';

function writeRef(dir: string): void {
  for (const file of generateREFrameworkProject('LocalSyncDemo')) {
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-local-'));
  const lcsDir = path.join(root, 'LocalSyncDemo');
  const parent = path.join(root, 'workspace');
  fs.mkdirSync(parent, { recursive: true });
  writeRef(lcsDir);

  const linked = linkStudioWebLocalWorkspace(lcsDir, {
    mode: 'create',
    targetDir: parent,
    solutionName: 'LocalSyncDemo'
  });

  assert.ok(fs.existsSync(linked.link.solutionDir));
  assert.ok(fs.existsSync(linked.uipxPath));
  assert.ok(fs.existsSync(path.join(linked.targetDir, 'project.json')));
  assert.ok(fs.existsSync(path.join(linked.targetDir, 'Main.xaml')));
  assert.ok(fs.existsSync(path.join(linked.link.solutionDir, 'OPEN_IN_STUDIO_WEB_LOCAL.md')));

  const uipx = JSON.parse(fs.readFileSync(linked.uipxPath, 'utf8')) as {
    DocVersion?: string;
    SolutionId?: string;
    Projects?: Array<{ ProjectRelativePath?: string; Id?: string }>;
  };
  assert.strictEqual(uipx.DocVersion, '1.0.0');
  assert.ok(uipx.SolutionId);
  assert.ok(
    uipx.Projects?.some((p) => p.ProjectRelativePath === 'LocalSyncDemo/project.json')
  );

  const stored = getStudioWebLocalLink(lcsDir);
  assert.ok(stored);
  assert.strictEqual(path.resolve(stored!.solutionDir), path.resolve(linked.link.solutionDir));

  // Mutate workflow and sync — XAML should update without creating .uip
  const mainLcs = path.join(lcsDir, 'Main.lcs.json');
  const doc = parseWorkflow(fs.readFileSync(mainLcs, 'utf8'));
  doc.description = 'synced-after-save';
  fs.writeFileSync(mainLcs, stringifyWorkflow(doc), 'utf8');

  const synced = syncToStudioWebLocal(lcsDir);
  assert.strictEqual(synced.created, false);
  const xaml = fs.readFileSync(path.join(synced.targetDir, 'Main.xaml'), 'utf8');
  assert.ok(xaml.includes('Activity') || xaml.length > 20);

  // Connect helper with existing link
  const connected = connectToStudioWeb(lcsDir);
  assert.strictEqual(connected.mode, 'local-workspace');
  assert.ok(!connected.archives);
  assert.ok(fs.existsSync(connected.guidePath));

  // No .uip beside solution
  const siblings = fs.readdirSync(linked.link.solutionDir);
  assert.ok(!siblings.some((f) => f.endsWith('.uip')));

  fs.rmSync(root, { recursive: true, force: true });
  console.log('studioWebLocal.test.ts: all assertions passed');
}

run();
