import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  applyCatalogDefaultsForPins,
  isDefaultPin,
  loadPackageInventory,
  writeManifestPackagePins
} from '../interop/packageManager';
import { resolveUiPathDependencies } from '../interop/uipathDependencies';

function run(): void {
  assert.ok(isDefaultPin('[1.0.0]'));
  assert.ok(!isDefaultPin('[25.4.1]'));

  const withoutSilent = resolveUiPathDependencies({
    activityTypes: ['System.LogMessage'],
    extraPackages: { 'Acme.Custom.Activities': '' },
    allowDefaultPins: false
  });
  assert.ok(withoutSilent['UiPath.System.Activities']);
  assert.ok(!withoutSilent['Acme.Custom.Activities']);

  const withSilent = resolveUiPathDependencies({
    activityTypes: ['System.LogMessage'],
    extraPackages: { 'Acme.Custom.Activities': '' },
    allowDefaultPins: true
  });
  assert.strictEqual(withSilent['Acme.Custom.Activities'], '[1.0.0]');

  const { next, changed } = applyCatalogDefaultsForPins({
    'UiPath.System.Activities': '[1.0.0]',
    'Acme.Custom.Activities': '[1.0.0]'
  });
  assert.ok(changed.includes('UiPath.System.Activities'));
  assert.ok(!changed.includes('Acme.Custom.Activities'));
  assert.strictEqual(next['UiPath.System.Activities'], '[25.4.1]');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-pkg-'));
  const projectDir = path.join(root, 'Proj');
  fs.mkdirSync(projectDir);
  fs.writeFileSync(
    path.join(projectDir, 'project.json'),
    JSON.stringify(
      {
        name: 'Proj',
        schemaVersion: '1.0',
        main: 'Main.lcs.json',
        workflows: ['Main.lcs.json'],
        uipathDependencies: {
          'UiPath.System.Activities': '[1.0.0]',
          'Acme.Custom.Activities': '[1.0.0]'
        }
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(projectDir, 'Main.lcs.json'),
    JSON.stringify(
      {
        name: 'Main',
        type: 'Sequence',
        variables: [],
        activities: [
          {
            id: 'a1',
            type: 'System.LogMessage',
            displayName: 'Log',
            properties: { message: '"hi"' }
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  );

  const inventory = loadPackageInventory(projectDir);
  assert.ok(inventory.defaultPinCount >= 1);
  assert.ok(inventory.pins.some((p) => p.name === 'UiPath.System.Activities' && p.isDefaultPin));

  writeManifestPackagePins(projectDir, {
    'UiPath.System.Activities': '[25.4.1]',
    'Acme.Custom.Activities': '[2.0.0]'
  });
  const after = loadPackageInventory(projectDir);
  assert.strictEqual(after.manifestPins['UiPath.System.Activities'], '[25.4.1]');
  assert.strictEqual(after.manifestPins['Acme.Custom.Activities'], '[2.0.0]');

  console.log('packageManager.test.ts: all assertions passed');
}

run();
