import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildCurrentProjectTree,
  buildDesignerProjectTree,
  findAllLcsProjects,
  findProjectRoot,
  isLcsProjectDir
} from '../interop/projectResolve';

function writeProject(dir: string, name: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'Framework'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'Data'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'project.json'),
    JSON.stringify({ name, schemaVersion: '1.0', main: 'Main.lcs.json' }, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dir, 'Main.lcs.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        name: 'Main',
        type: 'Sequence',
        activities: [],
        variables: []
      },
      null,
      2
    ),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dir, 'Framework', 'Init.lcs.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        name: 'Init',
        type: 'Sequence',
        activities: [],
        variables: []
      },
      null,
      2
    ),
    'utf8'
  );
  fs.writeFileSync(path.join(dir, 'Data', 'Config.json'), '{}\n', 'utf8');
}

function run(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-proj-'));
  const project1 = path.join(root, 'project1');
  const project2 = path.join(root, 'project2');
  writeProject(project1, 'Project1');
  writeProject(project2, 'Project2');

  const all = findAllLcsProjects([root]);
  assert.deepStrictEqual(all, [project1, project2].sort((a, b) => a.localeCompare(b)));
  assert.ok(all.includes(project1));
  assert.ok(all.includes(project2));

  assert.strictEqual(findProjectRoot(path.join(project1, 'Framework')), project1);
  assert.strictEqual(findProjectRoot(path.dirname(path.join(project1, 'Main.lcs.json'))), project1);
  assert.ok(isLcsProjectDir(project1));
  assert.ok(!isLcsProjectDir(root));

  // Designer rail: current project only (sibling project2 must not appear)
  const current = buildCurrentProjectTree(project1);
  assert.ok(current.some((e) => e.kind === 'project' && e.path === project1));
  assert.ok(!current.some((e) => e.path === project2 || e.name === 'project2'));
  const lcsNode = current.find((e) => e.kind === 'project' && e.path === project1);
  const children = lcsNode?.children || [];
  assert.ok(children.some((e) => e.kind === 'folder' && e.name === 'Framework'));
  assert.ok(children.some((e) => e.kind === 'folder' && e.name === 'Data'));
  assert.ok(children.some((e) => e.kind === 'workflow' && e.name === 'Main'));
  assert.ok(children.some((e) => e.kind === 'file' && e.name === 'project.json'));

  // Sync trash must not appear in designer Workspace Explorer
  const trash = path.join(project1, '.lcs-sync-trash', 'stamp1');
  fs.mkdirSync(trash, { recursive: true });
  fs.writeFileSync(path.join(trash, 'Main.lcs.json'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(project1, '.hidden'), { recursive: true });
  const afterTrash = buildCurrentProjectTree(project1);
  const afterChildren = afterTrash.find((e) => e.kind === 'project' && e.path === project1)?.children || [];
  assert.ok(
    !afterChildren.some((e) => e.name === '.lcs-sync-trash' || e.name === '.hidden'),
    'Workspace Explorer must hide .lcs-sync-trash and dotfolders'
  );

  const framework = children.find((e) => e.name === 'Framework');
  assert.ok(framework?.children?.some((c) => c.kind === 'workflow' && c.name === 'Init'));

  // Active-focused wrapper still returns a single project
  const tree = buildDesignerProjectTree([root], project1);
  assert.strictEqual(tree.length, 1);
  assert.strictEqual(tree[0].path, project1);
  assert.ok(tree[0].active);

  fs.rmSync(root, { recursive: true, force: true });
  console.log('projectResolve.test.ts: all assertions passed');
}

run();
