/**
 * Capture the two README screenshots (requires Google Chrome).
 * Usage: npm run compile && node scripts/render-designer-preview.js && LCS_PREVIEW_FLOAT=1 node scripts/render-designer-preview.js
 *        then serve docs/images and screenshot, or run this helper after starting a static server.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const images = path.join(__dirname, '..', 'docs', 'images');
const chrome = 'google-chrome-stable';
const argsBase = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--run-all-compositor-stages-before-draw',
  '--hide-scrollbars',
  '--window-size=1280,800',
  '--virtual-time-budget=14000'
];

function shot(url, out) {
  const r = spawnSync(
    chrome,
    [...argsBase, `--screenshot=${out}`, url],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status || 1);
  }
  console.log('Wrote', out);
}

async function main() {
  spawnSync('node', [path.join(__dirname, 'render-designer-preview.js')], { stdio: 'inherit' });
  spawnSync(
    'node',
    [path.join(__dirname, 'render-designer-preview.js')],
    { stdio: 'inherit', env: { ...process.env, LCS_PREVIEW_FLOAT: '1' } }
  );

  const server = http.createServer((req, res) => {
    const file = path.join(images, decodeURIComponent((req.url || '/').split('?')[0].replace(/^\//, '') || 'index.html'));
    if (!file.startsWith(images) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(8765, '127.0.0.1', r));

  shot('http://127.0.0.1:8765/_preview-designer.html', path.join(images, 'designer-overview.png'));
  shot('http://127.0.0.1:8765/_preview-float.html', path.join(images, 'project-explorer.png'));

  server.close();
  for (const f of ['_preview-designer.html', '_preview-float.html', 'extract-table.png']) {
    const p = path.join(images, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  console.log('Kept designer-overview.png + project-explorer.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
