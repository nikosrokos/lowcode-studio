import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildDesignerProjectTree,
  findAllLcsProjects,
  findProjectRoot,
  isLcsProjectDir
} from '../interop/projectResolve';

function writeProject(dir: string, name: string): void {
  fs.mkdirSync(dir, { recursive: true });
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
}

function run(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-proj-'));
  const project1 = path.join(root, 'project1');
  const project2 = path.join(root, 'project2');
  writeProject(project1, 'Project1');
  writeProject(project2, 'Project2');

  const all = findAllLcsProjects([root]);
  assert.deepStrictEqual(all, [project1, project2].sort((a, b) => a.localeCompare(b)));

  // Must not silently prefer LIFO last sibling — both must be discoverable
  assert.ok(all.includes(project1));
  assert.ok(all.includes(project2));

  fs.mkdirSync(path.join(project1, 'Framework'), { recursive: true });
  assert.strictEqual(findProjectRoot(path.join(project1, 'Framework')), project1);
  assert.strictEqual(findProjectRoot(path.dirname(path.join(project1, 'Main.lcs.json'))), project1);

  assert.ok(isLcsProjectDir(project1));
  assert.ok(!isLcsProjectDir(root));

  const tree = buildDesignerProjectTree([root], project1);
  assert.strictEqual(tree.length, 2);
  const active = tree.find((p) => p.path === project1);
  const other = tree.find((p) => p.path === project2);
  assert.ok(active?.active);
  assert.ok(!other?.active);
  assert.ok(active?.children?.some((c) => c.kind === 'workflow'));

  fs.rmSync(root, { recursive: true, force: true });
  console.log('projectResolve.test.ts: all assertions passed');
}

run();
