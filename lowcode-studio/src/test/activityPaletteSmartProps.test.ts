import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildPaletteEntries,
  normalizeActivityList,
  pushRecent,
  toggleFavorite,
  MAX_PINNED_FAVORITES
} from '../interop/activityPalette';
import {
  buildPropertySuggestions,
  flattenConfigKeys,
  discoverWorkflowPaths
} from '../interop/propertySuggestions';
import { getActivityCatalog } from '../models/activities';
import { createEmptyWorkflow } from '../models/workflow';
import { generateREFrameworkProject } from '../templates/reframework';

function run(): void {
  // Favorites / recent
  let favorites: string[] = [];
  favorites = toggleFavorite(favorites, 'UI.Click');
  favorites = toggleFavorite(favorites, 'UI.TypeInto');
  assert.deepStrictEqual(favorites.slice(0, 2), ['UI.TypeInto', 'UI.Click']);
  favorites = toggleFavorite(favorites, 'UI.Click');
  assert.ok(!favorites.includes('UI.Click'));

  const many = Array.from({ length: 15 }, (_, i) => `UI.Act${i}`);
  assert.strictEqual(normalizeActivityList(many, MAX_PINNED_FAVORITES).length, 10);

  let recent = pushRecent([], 'System.LogMessage');
  recent = pushRecent(recent, 'Programming.Assign');
  recent = pushRecent(recent, 'System.LogMessage');
  assert.deepStrictEqual(recent.slice(0, 2), ['System.LogMessage', 'Programming.Assign']);

  const catalog = getActivityCatalog();
  const entries = buildPaletteEntries(
    { favorites: ['UI.Click', 'Missing.Type'], recent: ['Programming.Assign', 'UI.Click'] },
    catalog
  );
  assert.ok(entries.some((e) => e.section === 'Favorites' && e.type === 'UI.Click' && e.pinned));
  assert.ok(entries.some((e) => e.section === 'Recent' && e.type === 'Programming.Assign'));
  assert.ok(!entries.some((e) => e.type === 'Missing.Type'));
  // Click should not appear twice in Recent
  assert.strictEqual(entries.filter((e) => e.type === 'UI.Click').length, 1);

  // Config flatten + suggestions
  const keys = flattenConfigKeys({
    Settings: { MaxTransactions: 3, Nested: { TimeoutMS: 1000 } },
    Constants: { Queue: 'Q1' },
    Assets: {}
  });
  assert.ok(keys.includes('Settings.MaxTransactions'));
  assert.ok(keys.includes('Settings.Nested.TimeoutMS'));
  assert.ok(keys.includes('Constants.Queue'));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-smart-'));
  for (const file of generateREFrameworkProject('SmartProps')) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }

  const paths = discoverWorkflowPaths(dir);
  assert.ok(paths.includes('Main.lcs.json'));
  assert.ok(paths.some((p) => p.includes('Framework/Process.lcs.json')));

  const wf = createEmptyWorkflow('Main', 'Sequence');
  wf.variables = [
    { name: 'counter', type: 'Int32', defaultValue: 0 },
    { name: 'label', type: 'String', defaultValue: '' }
  ];
  const suggestions = buildPropertySuggestions(dir, wf);
  assert.ok(suggestions.variables.includes('counter'));
  assert.ok(suggestions.configKeys.some((k) => k.includes('Max')));
  assert.ok(suggestions.configExpressions.some((k) => k.startsWith('Config.')));
  assert.ok(suggestions.workflowPaths.includes('Framework/Process.lcs.json'));

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('activityPaletteSmartProps.test.ts: all assertions passed');
}

run();
