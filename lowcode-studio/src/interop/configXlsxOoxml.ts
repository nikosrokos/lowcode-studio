/**
 * Minimal OOXML (.xlsx) writer/reader for classic REFramework Config workbooks.
 * Uses adm-zip + fast-xml-parser already in the extension — avoids SheetJS `xlsx`
 * (prototype pollution / ReDoS) and ExcelJS (transitive uuid advisories).
 */
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const OFFICEDOC_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
const WORKSHEET_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Keep text nodes as strings; nested <is><t>…
  trimValues: false,
  isArray: (name) =>
    ['sheet', 'Relationship', 'row', 'c', 't', 'si'].includes(name)
});

export type SheetAoa = Array<Array<string | number | boolean | null | undefined>>;

export function writeWorkbookAoa(sheets: Array<{ name: string; aoa: SheetAoa }>): Buffer {
  const zip = new AdmZip();
  const overrides: string[] = [
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
  ];
  const workbookSheets: string[] = [];
  const workbookRels: string[] = [];

  sheets.forEach((sheet, index) => {
    const sheetId = index + 1;
    const part = `worksheets/sheet${sheetId}.xml`;
    const rId = `rId${sheetId}`;
    workbookSheets.push(
      `<sheet name="${escapeXml(sheet.name)}" sheetId="${sheetId}" r:id="${rId}"/>`
    );
    workbookRels.push(
      `<Relationship Id="${rId}" Type="${WORKSHEET_REL}" Target="${part}"/>`
    );
    overrides.push(
      `<Override PartName="/xl/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    );
    zip.addFile(`xl/${part}`, Buffer.from(buildWorksheetXml(sheet.aoa), 'utf8'));
  });

  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="${CONTENT_TYPES_NS}">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        overrides.join('') +
        `</Types>`,
      'utf8'
    )
  );

  zip.addFile(
    '_rels/.rels',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="${RELS_NS}">` +
        `<Relationship Id="rId1" Type="${OFFICEDOC_REL}" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
      'utf8'
    )
  );

  zip.addFile(
    'xl/workbook.xml',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="${MAIN_NS}" xmlns:r="${R_NS}">` +
        `<sheets>${workbookSheets.join('')}</sheets>` +
        `</workbook>`,
      'utf8'
    )
  );

  zip.addFile(
    'xl/_rels/workbook.xml.rels',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="${RELS_NS}">` +
        workbookRels.join('') +
        `</Relationships>`,
      'utf8'
    )
  );

  return zip.toBuffer();
}

export function readWorkbookRows(
  buffer: Buffer | Uint8Array
): Array<{ name: string; rows: Record<string, unknown>[] }> {
  const zip = new AdmZip(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  const workbookEntry = zip.getEntry('xl/workbook.xml');
  if (!workbookEntry) {
    throw new Error('Invalid .xlsx: missing xl/workbook.xml');
  }
  const workbook = parser.parse(workbookEntry.getData().toString('utf8')) as {
    workbook?: { sheets?: { sheet?: Array<Record<string, string>> } };
  };
  const sheetMetas = workbook.workbook?.sheets?.sheet || [];
  const relsEntry = zip.getEntry('xl/_rels/workbook.xml.rels');
  const relMap = new Map<string, string>();
  if (relsEntry) {
    const relsDoc = parser.parse(relsEntry.getData().toString('utf8')) as {
      Relationships?: { Relationship?: Array<Record<string, string>> };
    };
    for (const rel of relsDoc.Relationships?.Relationship || []) {
      const id = rel['@_Id'];
      const target = rel['@_Target'];
      if (id && target) {
        relMap.set(id, target.replace(/^\//, '').replace(/^\.\.\//, ''));
      }
    }
  }

  const sharedStrings = loadSharedStrings(zip);
  const result: Array<{ name: string; rows: Record<string, unknown>[] }> = [];

  for (const meta of sheetMetas) {
    const name = meta['@_name'] || 'Sheet';
    const rId = meta['@_r:id'] || meta['@_Id'];
    let target = rId ? relMap.get(rId) : undefined;
    if (!target && meta['@_sheetId']) {
      target = `worksheets/sheet${meta['@_sheetId']}.xml`;
    }
    if (!target) {
      continue;
    }
    const partPath = target.startsWith('xl/') ? target : `xl/${target}`;
    const entry = zip.getEntry(partPath);
    if (!entry) {
      continue;
    }
    const aoa = parseWorksheetAoa(entry.getData().toString('utf8'), sharedStrings);
    result.push({ name, rows: aoaToObjects(aoa) });
  }

  return result;
}

function buildWorksheetXml(aoa: SheetAoa): string {
  const rowXml: string[] = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const cells: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const ref = `${colLetter(c)}${r + 1}`;
      cells.push(cellXml(ref, row[c]));
    }
    rowXml.push(`<row r="${r + 1}">${cells.join('')}</row>`);
  }
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="${MAIN_NS}"><sheetData>${rowXml.join('')}</sheetData></worksheet>`
  );
}

function cellXml(ref: string, value: string | number | boolean | null | undefined): string {
  if (value == null || value === '') {
    return `<c r="${ref}"/>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
}

function loadSharedStrings(zip: AdmZip): string[] {
  const entry = zip.getEntry('xl/sharedStrings.xml');
  if (!entry) {
    return [];
  }
  const doc = parser.parse(entry.getData().toString('utf8')) as {
    sst?: { si?: Array<unknown> };
  };
  const items = doc.sst?.si || [];
  return items.map((si) => sharedStringText(si));
}

function sharedStringText(si: unknown): string {
  if (si == null) {
    return '';
  }
  if (typeof si === 'string' || typeof si === 'number' || typeof si === 'boolean') {
    return String(si);
  }
  const node = si as { t?: unknown; r?: unknown };
  if (node.t != null) {
    return flattenText(node.t);
  }
  // Rich text runs: <r><t>…
  if (node.r != null) {
    const runs = Array.isArray(node.r) ? node.r : [node.r];
    return runs.map((r) => flattenText((r as { t?: unknown }).t)).join('');
  }
  return '';
}

function flattenText(t: unknown): string {
  if (t == null) {
    return '';
  }
  if (typeof t === 'string' || typeof t === 'number' || typeof t === 'boolean') {
    return String(t);
  }
  if (Array.isArray(t)) {
    return t.map(flattenText).join('');
  }
  const obj = t as { '#text'?: unknown; '@_xml:space'?: string };
  if (obj['#text'] != null) {
    return String(obj['#text']);
  }
  return '';
}

function parseWorksheetAoa(xml: string, sharedStrings: string[]): SheetAoa {
  const doc = parser.parse(xml) as {
    worksheet?: { sheetData?: { row?: Array<Record<string, unknown>> } };
  };
  const rows = doc.worksheet?.sheetData?.row || [];
  const grid: SheetAoa = [];
  let maxCol = 0;

  for (const row of rows) {
    const rIdx = Math.max(0, Number(row['@_r'] || grid.length + 1) - 1);
    const cells = (row.c as Array<Record<string, unknown>> | undefined) || [];
    while (grid.length <= rIdx) {
      grid.push([]);
    }
    for (const cell of cells) {
      const ref = String(cell['@_r'] || '');
      const parsed = parseCellRef(ref);
      const cIdx = parsed ? parsed.col : grid[rIdx].length;
      maxCol = Math.max(maxCol, cIdx);
      while (grid[rIdx].length <= cIdx) {
        grid[rIdx].push('');
      }
      grid[rIdx][cIdx] = readCellValue(cell, sharedStrings);
    }
  }

  // Normalize row widths for header mapping
  for (const row of grid) {
    while (row.length <= maxCol) {
      row.push('');
    }
  }
  return grid;
}

function readCellValue(
  cell: Record<string, unknown>,
  sharedStrings: string[]
): string | number | boolean {
  const t = String(cell['@_t'] || '');
  if (t === 'inlineStr') {
    const is = cell.is as { t?: unknown } | undefined;
    return flattenText(is?.t);
  }
  if (t === 's') {
    const idx = Number(cell.v);
    return sharedStrings[idx] ?? '';
  }
  if (t === 'b') {
    return String(cell.v) === '1' || cell.v === true || cell.v === 1;
  }
  if (t === 'str' || t === 'e') {
    return cell.v == null ? '' : String(cell.v);
  }
  if (cell.v == null || cell.v === '') {
    return '';
  }
  const num = Number(cell.v);
  if (typeof cell.v === 'number') {
    return cell.v;
  }
  if (String(cell.v).trim() !== '' && Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(String(cell.v).trim())) {
    return num;
  }
  return String(cell.v);
}

function aoaToObjects(aoa: SheetAoa): Record<string, unknown>[] {
  if (!aoa.length) {
    return [];
  }
  const headers = aoa[0].map((h, i) => {
    const label = String(h ?? '').trim();
    return label || `Column${i + 1}`;
  });
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const line = aoa[i];
    const obj: Record<string, unknown> = {};
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      const value = line[c] ?? '';
      obj[headers[c]] = value;
      if (value !== '' && value != null) {
        any = true;
      }
    }
    if (any) {
      rows.push(obj);
    }
  }
  return rows;
}

function parseCellRef(ref: string): { col: number; row: number } | undefined {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref);
  if (!m) {
    return undefined;
  }
  return { col: lettersToCol(m[1]), row: Number(m[2]) - 1 };
}

function colLetter(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
