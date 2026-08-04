import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export const CONFIG_JSON_REL = 'Data/Config.json';
export const CONFIG_XLSX_REL = 'Data/Config.xlsx';

/** Classic REFramework sheets (Name/Value). Assets uses Name/Asset/OrchestratorFolder. */
export const CLASSIC_NAME_VALUE_SHEETS = ['Settings', 'Constants'] as const;
export const ASSETS_SHEET = 'Assets';

export interface ConfigBridgeResult {
  source: 'json' | 'xlsx' | 'merged' | 'empty';
  config: Record<string, unknown>;
  jsonPath?: string;
  xlsxPath?: string;
}

export interface SyncResult {
  direction: 'json-to-xlsx' | 'xlsx-to-json';
  sourcePath: string;
  targetPath: string;
  sheets: string[];
  config: Record<string, unknown>;
}

/**
 * Convert LowCode Studio Config.json object → classic REFramework Config.xlsx buffer.
 * - Settings / Constants / other dict sheets → Name | Value
 * - Assets → Name | Asset | OrchestratorFolder
 */
export function configJsonToXlsxBuffer(config: Record<string, unknown>): Buffer {
  const wb = XLSX.utils.book_new();
  const extraSheets = Object.keys(config).filter(
    (s) =>
      !CLASSIC_NAME_VALUE_SHEETS.includes(s as (typeof CLASSIC_NAME_VALUE_SHEETS)[number]) &&
      s !== ASSETS_SHEET
  );
  // Classic order: Settings, Constants, Assets, then any extras (Endpoints, …)
  const uniqueSheets = [...CLASSIC_NAME_VALUE_SHEETS, ASSETS_SHEET, ...extraSheets];

  for (const sheetName of uniqueSheets) {
    const section = config[sheetName];
    if (sheetName === ASSETS_SHEET) {
      const rows = assetsObjectToRows(
        section && typeof section === 'object' && !Array.isArray(section)
          ? (section as Record<string, unknown>)
          : {}
      );
      const aoa = [['Name', 'Asset', 'OrchestratorFolder'], ...rows];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
      continue;
    }

    const obj =
      section && typeof section === 'object' && !Array.isArray(section)
        ? (section as Record<string, unknown>)
        : {};
    const rows = objectToNameValueRows(obj);
    const aoa = [['Name', 'Value'], ...rows];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  }

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

/** Parse classic (or LCS-exported) Config.xlsx → Config.json object. */
export function configXlsxBufferToJson(buffer: Buffer | Uint8Array): Record<string, unknown> {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const config: Record<string, unknown> = {};

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false
    });
    if (sheetName === ASSETS_SHEET || looksLikeAssetsSheet(rows)) {
      config[sheetName === ASSETS_SHEET ? ASSETS_SHEET : sheetName] = rowsToAssetsObject(rows);
      continue;
    }
    config[sheetName] = rowsToNameValueObject(rows);
  }

  // Normalize common sheet names if missing
  if (!config.Settings) {
    config.Settings = {};
  }
  if (!config.Constants) {
    config.Constants = {};
  }
  if (!config.Assets) {
    config.Assets = {};
  }

  return config;
}

export function readConfigJsonFile(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

export function writeConfigJsonFile(filePath: string, config: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function writeConfigXlsxFile(filePath: string, config: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, configJsonToXlsxBuffer(config));
}

export function readConfigXlsxFile(filePath: string): Record<string, unknown> {
  return configXlsxBufferToJson(fs.readFileSync(filePath));
}

/**
 * Load project config for dry-run / tooling.
 * Preference: Config.json if present, else Config.xlsx, else {}.
 * When both exist, JSON wins (Mac-friendly source of truth) unless preferXlsx.
 */
export function loadProjectConfig(
  projectDir: string,
  options: { preferXlsx?: boolean } = {}
): ConfigBridgeResult {
  const jsonPath = path.join(projectDir, CONFIG_JSON_REL);
  const xlsxPath = path.join(projectDir, CONFIG_XLSX_REL);
  const hasJson = fs.existsSync(jsonPath);
  const hasXlsx = fs.existsSync(xlsxPath);

  if (options.preferXlsx && hasXlsx) {
    return {
      source: 'xlsx',
      config: readConfigXlsxFile(xlsxPath),
      jsonPath: hasJson ? jsonPath : undefined,
      xlsxPath
    };
  }
  if (hasJson) {
    return {
      source: 'json',
      config: readConfigJsonFile(jsonPath),
      jsonPath,
      xlsxPath: hasXlsx ? xlsxPath : undefined
    };
  }
  if (hasXlsx) {
    return {
      source: 'xlsx',
      config: readConfigXlsxFile(xlsxPath),
      xlsxPath
    };
  }
  return { source: 'empty', config: {} };
}

/** Config.json → Data/Config.xlsx */
export function exportJsonToXlsx(projectDir: string): SyncResult {
  const jsonPath = path.join(projectDir, CONFIG_JSON_REL);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing ${CONFIG_JSON_REL}. Create or import config first.`);
  }
  const config = readConfigJsonFile(jsonPath);
  const xlsxPath = path.join(projectDir, CONFIG_XLSX_REL);
  writeConfigXlsxFile(xlsxPath, config);
  return {
    direction: 'json-to-xlsx',
    sourcePath: jsonPath,
    targetPath: xlsxPath,
    sheets: Object.keys(config),
    config
  };
}

/** Config.xlsx → Data/Config.json */
export function importXlsxToJson(projectDir: string, xlsxFilePath?: string): SyncResult {
  const xlsxPath = xlsxFilePath || path.join(projectDir, CONFIG_XLSX_REL);
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`Missing Config.xlsx at ${xlsxPath}`);
  }
  const config = readConfigXlsxFile(xlsxPath);
  // Keep ConfigPath pointing at JSON for LCS projects after import
  const constants = (config.Constants || {}) as Record<string, unknown>;
  if (!constants.ConfigPath) {
    constants.ConfigPath = CONFIG_JSON_REL;
    config.Constants = constants;
  }
  const jsonPath = path.join(projectDir, CONFIG_JSON_REL);
  writeConfigJsonFile(jsonPath, config);
  return {
    direction: 'xlsx-to-json',
    sourcePath: xlsxPath,
    targetPath: jsonPath,
    sheets: Object.keys(config),
    config
  };
}

/** Write both JSON and XLSX from the same object (new REFramework projects). */
export function writeDualConfig(projectDir: string, config: Record<string, unknown>): void {
  writeConfigJsonFile(path.join(projectDir, CONFIG_JSON_REL), config);
  // Classic twin: Constants.ConfigPath can list xlsx for Studio parity
  const dual = structuredCloneConfig(config);
  const constants = (dual.Constants || {}) as Record<string, unknown>;
  if (constants.ConfigPath === CONFIG_JSON_REL || !constants.ConfigPath) {
    // Keep JSON path in JSON file; xlsx copy notes both in README
  }
  writeConfigXlsxFile(path.join(projectDir, CONFIG_XLSX_REL), dual);
}

export function defaultREFrameworkConfig(projectName: string): Record<string, unknown> {
  return {
    Settings: {
      projectName,
      MaxRetryNumber: 2,
      MaxTransactions: 3,
      TimeoutMS: 30000,
      ExScreenshotsFolderPath: 'Data/Temp',
      LogLevel: 'Info'
    },
    Constants: {
      OrchestratorQueueName: `${projectName}.Queue`,
      ConfigPath: CONFIG_JSON_REL,
      ConfigXlsxPath: CONFIG_XLSX_REL
    },
    Assets: {
      CredentialAsset: 'REFramework.Credential'
    },
    Endpoints: {
      ProcessApi: 'https://api.example.com/items'
    }
  };
}

export function objectToNameValueRows(obj: Record<string, unknown>): Array<[string, string | number | boolean]> {
  return Object.entries(obj).map(([name, value]) => [name, serializeCell(value)]);
}

export function assetsObjectToRows(
  obj: Record<string, unknown>
): Array<[string, string, string]> {
  return Object.entries(obj).map(([name, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const row = value as Record<string, unknown>;
      return [
        name,
        String(row.Asset ?? row.asset ?? row.Value ?? row.value ?? ''),
        String(row.OrchestratorFolder ?? row.Folder ?? row.folder ?? '')
      ];
    }
    return [name, String(value ?? ''), ''];
  });
}

export function rowsToNameValueObject(
  rows: Record<string, unknown>[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const name = String(row.Name ?? row.name ?? row.Key ?? row.key ?? '').trim();
    if (!name) {
      continue;
    }
    const raw = row.Value ?? row.value ?? '';
    result[name] = coerceCell(raw);
  }
  return result;
}

export function rowsToAssetsObject(
  rows: Record<string, unknown>[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const name = String(row.Name ?? row.name ?? '').trim();
    if (!name) {
      continue;
    }
    const asset = String(row.Asset ?? row.asset ?? row.Value ?? row.value ?? '').trim();
    const folder = String(
      row.OrchestratorFolder ?? row['Orchestrator Folder'] ?? row.Folder ?? row.folder ?? ''
    ).trim();
    result[name] = folder ? { Asset: asset, OrchestratorFolder: folder } : asset;
  }
  return result;
}

function looksLikeAssetsSheet(rows: Record<string, unknown>[]): boolean {
  if (!rows.length) {
    return false;
  }
  const keys = Object.keys(rows[0]).map((k) => k.toLowerCase());
  return keys.includes('asset') || keys.includes('orchestratorfolder');
}

function serializeCell(value: unknown): string | number | boolean {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function coerceCell(raw: unknown): unknown {
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return raw;
  }
  const text = String(raw ?? '').trim();
  if (text === '') {
    return '';
  }
  if (/^(true|false)$/i.test(text)) {
    return text.toLowerCase() === 'true';
  }
  if (/^-?\d+$/.test(text)) {
    return Number(text);
  }
  if (/^-?\d+\.\d+$/.test(text)) {
    return Number(text);
  }
  if (
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('[') && text.endsWith(']'))
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function structuredCloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}
