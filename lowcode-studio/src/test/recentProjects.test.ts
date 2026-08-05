import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  enrichRecentProjects,
  pushRecentProject,
  readRecentProjects
} from '../util/recentProjects';

function run(): void {
  {
    const list = readRecentProjects([
      { path: '/tmp/a', name: 'A', lastOpened: '2026-01-01T00:00:00.000Z' },
      { path: '', name: 'bad' },
      null,
      { path: '/tmp/b' }
    ]);
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[1].name, 'b');
  }

  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-recent-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'project.json'),
        JSON.stringify({
          name: 'DemoProj',
          schemaVersion: '1.0',
          main: 'Main.lcs.json',
          workflows: []
        }),
        'utf8'
      );
      let list = pushRecentProject([], dir, 'DemoProj');
      list = pushRecentProject(list, '/other/path', 'Other');
      list = pushRecentProject(list, dir, 'DemoProj');
      assert.strictEqual(list[0].path, path.resolve(dir));
      assert.strictEqual(list[0].name, 'DemoProj');
      assert.strictEqual(list.length, 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  {
    const cards = enrichRecentProjects([
      {
        path: path.join(os.tmpdir(), 'lcs-does-not-exist-' + Date.now()),
        name: 'Gone',
        lastOpened: new Date().toISOString()
      }
    ]);
    assert.strictEqual(cards[0].syncBadge, 'missing');
    assert.strictEqual(cards[0].exists, false);
  }

  console.log('recentProjects.test.ts OK');
}

run();
