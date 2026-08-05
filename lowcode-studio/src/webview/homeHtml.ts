import { WhatsNewSection } from '../util/changelogParse';
import { RecentProjectCard } from '../util/recentProjects';

export interface HomeScreenModel {
  version: string;
  projectName?: string;
  projectPath?: string;
  studioWebLinked?: boolean;
  studioWebSolution?: string;
  syncBadge?: 'ok' | 'stale' | 'unlinked' | 'missing';
  syncSummary?: string;
  recent: RecentProjectCard[];
  changelog: WhatsNewSection[];
  nextSteps: string[];
}

export function getHomeHtml(
  nonce: string,
  cspSource: string,
  logoUri: string,
  model: HomeScreenModel
): string {
  const changelogJson = JSON.stringify(model.changelog || []).replace(/</g, '\\u003c');
  const nextStepsJson = JSON.stringify(model.nextSteps || []).replace(/</g, '\\u003c');
  const recentJson = JSON.stringify(model.recent || []).replace(/</g, '\\u003c');
  const projectName = model.projectName || 'No project open';
  const projectPath = model.projectPath || '';
  const swLine = model.studioWebLinked
    ? `Linked · ${model.studioWebSolution || 'Local Workspace'}`
    : 'Not linked — Connect to sync .xaml';
  const badge = model.syncBadge || (model.studioWebLinked ? 'ok' : 'unlinked');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LowCode Studio Home</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --panel: var(--vscode-sideBar-background);
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border, #333);
      --accent: var(--vscode-button-background);
      --accent-fg: var(--vscode-button-foreground);
      --hover: var(--vscode-list-hoverBackground);
      --input: var(--vscode-input-background);
      --radius: 12px;
      --ok: #22c55e;
      --stale: #f59e0b;
      --miss: #ef4444;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text);
      font-family: var(--vscode-font-family, "Segoe UI", sans-serif); }
    body {
      overflow: auto;
      background:
        radial-gradient(900px 420px at 20% -10%, color-mix(in srgb, #0ea5e9 16%, transparent), transparent 55%),
        radial-gradient(700px 380px at 90% 0%, color-mix(in srgb, #14b8a6 12%, transparent), transparent 50%),
        var(--bg);
    }
    .wrap { max-width: 920px; margin: 0 auto; padding: 22px 16px 40px; }
    .hero { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
    .logo { width: 56px; height: 56px; border-radius: 14px; box-shadow: 0 8px 22px rgba(0,0,0,.22); flex: 0 0 auto; }
    .hero h1 { margin: 0 0 4px; font-size: 22px; font-weight: 750; letter-spacing: -0.02em; line-height: 1.15; }
    .hero p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .ver {
      display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 700;
      padding: 2px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted);
    }
    .grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 12px; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: var(--radius); padding: 12px 14px;
    }
    .card h2 {
      margin: 0 0 8px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
      color: var(--muted); font-weight: 700;
    }
    .actions { display: grid; gap: 7px; }
    .btn {
      appearance: none; border: 1px solid var(--border); background: var(--input);
      color: var(--text); border-radius: 9px; padding: 9px 11px; font: inherit;
      font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;
    }
    .btn:hover { background: var(--hover); }
    .btn.primary { background: var(--accent); color: var(--accent-fg); border-color: transparent; }
    .btn .sub { display: block; font-size: 10px; font-weight: 500; opacity: .75; margin-top: 2px; }
    .meta { font-size: 12px; color: var(--muted); line-height: 1.45; }
    .meta strong { color: var(--text); font-weight: 650; }
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px;
      border: 1px solid var(--border); vertical-align: middle;
    }
    .badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
    .badge.ok::before { background: var(--ok); }
    .badge.stale::before { background: var(--stale); }
    .badge.unlinked::before { background: var(--muted); }
    .badge.missing::before { background: var(--miss); }
    .recent { display: grid; gap: 6px; }
    .recent-item {
      display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
      border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      border-radius: 9px; padding: 8px 10px; background: color-mix(in srgb, var(--input) 70%, transparent);
      cursor: pointer; text-align: left; color: inherit; font: inherit; width: 100%;
    }
    .recent-item:hover { background: var(--hover); }
    .recent-item .name { font-size: 12px; font-weight: 650; }
    .recent-item .path { font-size: 10px; color: var(--muted); margin-top: 2px; word-break: break-all; }
    .recent-empty { font-size: 12px; color: var(--muted); }
    details.changelog {
      border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      margin-top: 8px; padding-top: 8px;
    }
    details.changelog summary {
      cursor: pointer; font-size: 12px; font-weight: 650; color: var(--text);
      list-style: none; display: flex; justify-content: space-between; gap: 8px;
    }
    details.changelog summary::-webkit-details-marker { display: none; }
    details.changelog .body {
      margin-top: 8px; font-size: 11px; color: var(--muted); white-space: pre-wrap;
      line-height: 1.45; max-height: 180px; overflow: auto;
    }
    .steps { margin: 0; padding-left: 18px; font-size: 12px; color: var(--muted); line-height: 1.55; }
    .foot { margin-top: 14px; font-size: 10px; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <img class="logo" src="${logoUri}" alt="LowCode Studio" />
      <div>
        <h1>LowCode Studio</h1>
        <p>Design locally · dry-run · sync Studio Web Local Workspace</p>
        <span class="ver">v${escapeHtml(model.version)}</span>
      </div>
    </header>

    <div class="grid">
      <section class="card">
        <h2>Open</h2>
        <div class="actions">
          <button class="btn primary" data-cmd="openLocalProject" type="button">
            Open project / Studio Web solution<span class="sub">LCS folder or .uipx</span>
          </button>
          <button class="btn" data-cmd="newREFramework" type="button">New REFramework</button>
          <button class="btn" data-cmd="newBlueprint" type="button">New Robot Blueprint</button>
          <button class="btn" data-cmd="connectStudioWeb" type="button">Connect Studio Web Local</button>
          <button class="btn" data-cmd="openStudioWeb" type="button">Open Studio Web in browser</button>
        </div>
      </section>

      <section class="card">
        <h2>Current</h2>
        <div class="meta">
          <div><strong>${escapeHtml(projectName)}</strong>
            <span class="badge ${escapeHtml(badge)}" title="${escapeHtml(model.syncSummary || '')}">${escapeHtml(badgeLabel(badge))}</span>
          </div>
          <div>${escapeHtml(projectPath || 'Open a folder to get started')}</div>
          <div style="margin-top:6px">Studio Web: ${escapeHtml(swLine)}</div>
          ${model.syncSummary ? `<div style="margin-top:4px;font-size:11px">${escapeHtml(model.syncSummary)}</div>` : ''}
        </div>
        <div class="actions" style="margin-top:10px">
          <button class="btn" data-cmd="firstRunWizard" type="button">First-run wizard</button>
          <button class="btn" data-cmd="scaffoldFromDescription" type="button">Assist F2 — Scaffold</button>
          <button class="btn" data-cmd="repairFromDryRunTrace" type="button">Assist F2 — Trace repair</button>
          <button class="btn" data-cmd="showWhatsNew" type="button">What's New</button>
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:12px">
      <h2>Recent projects</h2>
      <div class="recent" id="recent"></div>
    </section>

    <section class="card" style="margin-top:12px">
      <h2>Latest changes</h2>
      <div id="changelog"></div>
    </section>

    <section class="card" style="margin-top:12px">
      <h2>Next 5 steps</h2>
      <ol class="steps" id="nextSteps"></ol>
    </section>

    <p class="foot">Independent community tooling — not an official UiPath product.</p>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const changelog = ${changelogJson};
    const nextSteps = ${nextStepsJson};
    const recent = ${recentJson};

    const recentEl = document.getElementById('recent');
    if (!recent.length) {
      recentEl.innerHTML = '<div class="recent-empty">No recent projects yet — open a folder to start.</div>';
    } else {
      recentEl.innerHTML = recent.map((r) => (
        '<button type="button" class="recent-item" data-open-path="' + escapeAttr(r.path) + '"' + (r.exists ? '' : ' disabled') + '>' +
          '<div><div class="name">' + escapeHtml(r.name) + '</div>' +
          '<div class="path">' + escapeHtml(r.path) + '</div></div>' +
          '<span class="badge ' + escapeAttr(r.syncBadge) + '" title="' + escapeAttr(r.syncSummary) + '">' +
            escapeHtml(badgeLabel(r.syncBadge)) + '</span>' +
        '</button>'
      )).join('');
    }

    const box = document.getElementById('changelog');
    box.innerHTML = (changelog.length ? changelog : [{ version: '—', body: 'No changelog sections found.' }]).map((s) => (
      '<details class="changelog">' +
        '<summary><span>v' + escapeHtml(s.version) + '</span><span style="opacity:.6">expand</span></summary>' +
        '<div class="body">' + escapeHtml(s.body) + '</div>' +
      '</details>'
    )).join('');
    const first = box.querySelector('details');
    if (first) first.open = false; // collapsed by default

    document.getElementById('nextSteps').innerHTML = nextSteps.map(s => '<li>' + escapeHtml(s) + '</li>').join('');

    document.querySelectorAll('[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'command', command: btn.getAttribute('data-cmd') });
      });
    });
    document.querySelectorAll('[data-open-path]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openRecent', path: btn.getAttribute('data-open-path') });
      });
    });

    function badgeLabel(b) {
      if (b === 'ok') return 'In sync';
      if (b === 'stale') return 'Out of sync';
      if (b === 'missing') return 'Missing';
      return 'Not linked';
    }
    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
  </script>
</body>
</html>`;
}

function badgeLabel(b: string): string {
  if (b === 'ok') return 'In sync';
  if (b === 'stale') return 'Out of sync';
  if (b === 'missing') return 'Missing';
  return 'Not linked';
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const HOME_NEXT_STEPS: string[] = [
  'Open a recent project or a Studio Web .uipx solution — Main opens in the designer',
  'Edit activities (Log Message, UI, …) — Properties + right-click / ⋯ menu',
  'F5 dry-run; use Assist F2/F4 for scaffold and VB expression repairs',
  'Connect Studio Web Local — watch sync badges on Home; Save keeps both sides aligned',
  'Validate packages → publish from Studio Web when ready'
];
