import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  getStudioWebLocalLink,
  linkStudioWebLocalWorkspace,
  syncToStudioWebLocal,
  validateStudioWebLocalOpenability
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

  // Studio Web Local Workspace on Mac rejects Windows-target projects
  const linkedPj = JSON.parse(
    fs.readFileSync(path.join(linked.targetDir, 'project.json'), 'utf8')
  ) as { targetFramework?: string; runtimeOptions?: { netCore?: { targetFramework?: string } } };
  assert.strictEqual(
    linkedPj.targetFramework,
    'Portable',
    'Local Workspace project must be Portable (not Windows)'
  );
  assert.strictEqual(linkedPj.runtimeOptions?.netCore?.targetFramework, 'net8.0');

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

  // Studio Web must be able to open the solution + RPA workflows on disk
  const openability = validateStudioWebLocalOpenability(lcsDir);
  assert.ok(
    openability.ok,
    `solution not openable: ${openability.errors.join('; ')}`
  );
  assert.ok(openability.workflows.includes('Main.xaml'));
  assert.ok(openability.workflows.some((w) => w.startsWith('Framework/')));

  const stored = getStudioWebLocalLink(lcsDir);
  assert.ok(stored);
  assert.strictEqual(path.resolve(stored!.solutionDir), path.resolve(linked.link.solutionDir));

  // Mutate workflow and sync — the file Studio Web reads must change
  const marker = `SAVE_SYNC_${Date.now()}`;
  const processLcs = path.join(lcsDir, 'Framework', 'Process.lcs.json');
  const processXaml = path.join(linked.targetDir, 'Framework', 'Process.xaml');
  const before = fs.readFileSync(processXaml, 'utf8');
  const doc = parseWorkflow(fs.readFileSync(processLcs, 'utf8'));
  doc.activities.push({
    id: 'act_marker',
    type: 'System.LogMessage',
    displayName: 'Sync Probe',
    properties: { message: marker, level: 'Info' }
  });
  fs.writeFileSync(processLcs, stringifyWorkflow(doc), 'utf8');

  const synced = syncToStudioWebLocal(lcsDir);
  assert.strictEqual(synced.created, false);
  const after = fs.readFileSync(processXaml, 'utf8');
  assert.notStrictEqual(before, after, 'Studio-readable Process.xaml must change on sync');
  assert.ok(after.includes(marker), 'marker from Save must appear in Studio XAML');
  const mainXaml = fs.readFileSync(path.join(synced.targetDir, 'Main.xaml'), 'utf8');
  assert.ok(mainXaml.includes('Activity') || mainXaml.length > 20);
  const afterPj = JSON.parse(
    fs.readFileSync(path.join(synced.targetDir, 'project.json'), 'utf8')
  ) as { targetFramework?: string };
  assert.strictEqual(afterPj.targetFramework, 'Portable');

  // Detect Windows-target as not openable in Studio Web on Mac
  fs.writeFileSync(
    path.join(linked.targetDir, 'project.json'),
    JSON.stringify({ name: 'LocalSyncDemo', main: 'Main.xaml', targetFramework: 'Windows' }, null, 2),
    'utf8'
  );
  const windowsBlocked = validateStudioWebLocalOpenability(lcsDir);
  assert.ok(!windowsBlocked.ok);
  assert.ok(windowsBlocked.errors.some((e) => /Windows/i.test(e)));
  // Restore Portable via sync
  syncToStudioWebLocal(lcsDir);
  assert.ok(validateStudioWebLocalOpenability(lcsDir).ok);

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
