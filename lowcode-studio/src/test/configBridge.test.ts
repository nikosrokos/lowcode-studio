import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CONFIG_JSON_REL,
  CONFIG_XLSX_REL,
  configJsonToXlsxBuffer,
  configXlsxBufferToJson,
  defaultREFrameworkConfig,
  exportJsonToXlsx,
  importXlsxToJson,
  loadProjectConfig,
  objectToNameValueRows,
  rowsToAssetsObject,
  writeDualConfig
} from '../interop/configBridge';
import { generateREFrameworkProject } from '../templates/reframework';
import { loadConfigJson } from '../commands/refDryRun';

function run(): void {
  const config = defaultREFrameworkConfig('BridgeDemo');
  assert.ok((config.Settings as { MaxTransactions: number }).MaxTransactions === 3);
  assert.ok((config.Constants as { ConfigXlsxPath: string }).ConfigXlsxPath === CONFIG_XLSX_REL);

  const rows = objectToNameValueRows({ MaxRetryNumber: 2, LogLevel: 'Info' });
  assert.deepStrictEqual(rows[0], ['MaxRetryNumber', 2]);

  const assets = rowsToAssetsObject([
    { Name: 'CredentialAsset', Asset: 'REFramework.Credential', OrchestratorFolder: 'Shared' },
    { Name: 'ApiKey', Asset: 'My.ApiKey' }
  ]);
  assert.deepStrictEqual(assets.CredentialAsset, {
    Asset: 'REFramework.Credential',
    OrchestratorFolder: 'Shared'
  });
  assert.strictEqual(assets.ApiKey, 'My.ApiKey');

  const buffer = configJsonToXlsxBuffer(config);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 200);

  const roundTrip = configXlsxBufferToJson(buffer);
  assert.strictEqual(
    (roundTrip.Settings as { MaxTransactions: number }).MaxTransactions,
    3
  );
  assert.strictEqual(
    (roundTrip.Constants as { OrchestratorQueueName: string }).OrchestratorQueueName,
    'BridgeDemo.Queue'
  );
  assert.strictEqual(
    (roundTrip.Endpoints as { ProcessApi: string }).ProcessApi,
    'https://api.example.com/items'
  );
  assert.ok(roundTrip.Assets);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-config-'));
  writeDualConfig(dir, config);
  assert.ok(fs.existsSync(path.join(dir, CONFIG_JSON_REL)));
  assert.ok(fs.existsSync(path.join(dir, CONFIG_XLSX_REL)));

  const loaded = loadProjectConfig(dir);
  assert.strictEqual(loaded.source, 'json');
  assert.strictEqual(
    (loaded.config.Settings as { projectName: string }).projectName,
    'BridgeDemo'
  );

  // JSON removed → fall back to xlsx
  fs.unlinkSync(path.join(dir, CONFIG_JSON_REL));
  const fromXlsx = loadProjectConfig(dir);
  assert.strictEqual(fromXlsx.source, 'xlsx');
  assert.strictEqual(
    (fromXlsx.config.Settings as { MaxRetryNumber: number }).MaxRetryNumber,
    2
  );

  // Re-import xlsx → json
  const imported = importXlsxToJson(dir);
  assert.strictEqual(imported.direction, 'xlsx-to-json');
  assert.ok(fs.existsSync(imported.targetPath));

  // Export json → xlsx again
  const exported = exportJsonToXlsx(dir);
  assert.strictEqual(exported.direction, 'json-to-xlsx');
  assert.ok(exported.sheets.includes('Settings'));
  assert.ok(exported.sheets.includes('Assets'));

  // Dry-run loader sees config
  assert.strictEqual(
    (loadConfigJson(dir).Settings as { MaxTransactions: number }).MaxTransactions,
    3
  );

  // REFramework template includes both config files
  const files = generateREFrameworkProject('XlsxREF');
  assert.ok(files.some((f) => f.relativePath === CONFIG_XLSX_REL && Buffer.isBuffer(f.content)));
  const jsonCfg = JSON.parse(
    files.find((f) => f.relativePath === CONFIG_JSON_REL)!.content as string
  ) as { Constants: { ConfigXlsxPath: string } };
  assert.strictEqual(jsonCfg.Constants.ConfigXlsxPath, CONFIG_XLSX_REL);

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('configBridge.test.ts: all assertions passed');
}

run();
