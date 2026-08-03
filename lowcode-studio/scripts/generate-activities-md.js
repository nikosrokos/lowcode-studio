/**
 * Generates docs/ACTIVITIES.md from the compiled activity catalog.
 * Run: node scripts/generate-activities-md.js  (after npm run compile)
 */
const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'out', 'models', 'activities.js');
if (!fs.existsSync(catalogPath)) {
  console.error('Compile first: npm run compile');
  process.exit(1);
}

const { ACTIVITY_CATALOG } = require(catalogPath);
const pkg = require('../package.json');

const packageHints = {
  System: 'UiPath.System.Activities',
  'Control Flow': 'UiPath.System.Activities (WF)',
  Programming: 'UiPath.System.Activities',
  'UI Automation': 'UiPath.UIAutomation.Activities',
  Data: 'UiPath.System.Activities',
  Excel: 'UiPath.Excel.Activities',
  Python: 'UiPath.Python.Activities',
  Messaging: 'UiPath.Mail.Activities / UiPath.WebAPI.Activities',
  Flowchart: 'UiPath.System.Activities',
  REFramework: 'UiPath.System.Activities'
};

const byCategory = new Map();
for (const a of ACTIVITY_CATALOG) {
  const list = byCategory.get(a.category) || [];
  list.push(a);
  byCategory.set(a.category, list);
}

const lines = [];
lines.push('# LowCode Studio — Activity coverage');
lines.push('');
lines.push(`Generated for **v${pkg.version}** from the extension activity catalog.`);
lines.push('');
lines.push('This list is what you can design in VS Code / Cursor, dry-run locally, and best-effort import/export with UiPath Studio / Studio Web.');
lines.push('');
lines.push('> Not every property of every UiPath activity is modeled. Selectors for UI activities round-trip via `selector` / `selectorModern` / `selectorXml`.');
lines.push('');
lines.push(`**Total activities:** ${ACTIVITY_CATALOG.length}`);
lines.push('');
lines.push('## By category');
lines.push('');

for (const [category, items] of [...byCategory.entries()].sort((a, b) =>
  a[0].localeCompare(b[0])
)) {
  lines.push(`### ${category}`);
  lines.push('');
  lines.push(`UiPath package (typical): \`${packageHints[category] || '—'}\``);
  lines.push('');
  lines.push('| Activity | Type id | Container | Key properties |');
  lines.push('|---|---|---|---|');
  for (const a of items.sort((x, y) => x.displayName.localeCompare(y.displayName))) {
    const props = (a.properties || [])
      .map((p) => p.name)
      .slice(0, 6)
      .join(', ');
    const more = (a.properties || []).length > 6 ? '…' : '';
    lines.push(
      `| ${a.displayName} | \`${a.type}\` | ${a.container ? 'Yes' : 'No'} | ${props}${more || '—'} |`
    );
  }
  lines.push('');
}

lines.push('## Python pack (`UiPath.Python.Activities`)');
lines.push('');
lines.push('Modeled after the official Python activities pack:');
lines.push('');
lines.push('| LowCode Studio | UiPath activity | Notes |');
lines.push('|---|---|---|');
lines.push('| Python Scope | Python Scope | Container; sets Path / Target / WorkingFolder |');
lines.push('| Load Python Script | Load Python Script | File or inline Code → PythonObject |');
lines.push('| Run Python Script | Run Python Script | Execute file or inline code |');
lines.push('| Invoke Python Method | Invoke Python Method | Requires loaded Instance + method Name |');
lines.push('| Get Python Object | Get Python Object | Convert PythonObject → String/Int32/… |');
lines.push('');
lines.push('Typical pattern:');
lines.push('');
lines.push('```text');
lines.push('Python Scope');
lines.push('  ├─ Load Python Script  → pythonScript');
lines.push('  ├─ Invoke Python Method(pythonScript, "main") → pythonResult');
lines.push('  └─ Get Python Object(pythonResult as String) → netValue');
lines.push('```');
lines.push('');
lines.push('Dry-run simulates handlers only (does not execute a real Python runtime on Mac).');
lines.push('');
lines.push('## Import / export coverage notes');
lines.push('');
lines.push('| Area | Status |');
lines.push('|---|---|');
lines.push('| System / Control Flow | Strong |');
lines.push('| UI + selectors | Strong (classic + modern encodings) |');
lines.push('| Excel / Mail / HTTP | Good |');
lines.push('| Python pack | Good (Scope / Load / Run / Invoke / Get) |');
lines.push('| REFramework Invoke | Good |');
lines.push('| Unknown Studio activities | Imported as `Imported.*` placeholders |');
lines.push('');
lines.push('## Regenerating this file');
lines.push('');
lines.push('```bash');
lines.push('npm run compile');
lines.push('npm run docs:activities');
lines.push('```');
lines.push('');

const out = path.join(__dirname, '..', 'docs', 'ACTIVITIES.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`Wrote ${out} (${ACTIVITY_CATALOG.length} activities)`);
