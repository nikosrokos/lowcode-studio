import { WhatsNewSection } from '../util/changelogParse';

export interface HomeScreenModel {
  version: string;
  projectName?: string;
  projectPath?: string;
  studioWebLinked?: boolean;
  studioWebSolution?: string;
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
  const projectName = model.projectName || 'No project open';
  const projectPath = model.projectPath || '';
  const swLine = model.studioWebLinked
    ? `Linked · ${model.studioWebSolution || 'Local Workspace'}`
    : 'Not linked — Connect to sync .xaml';

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
    .wrap { max-width: 880px; margin: 0 auto; padding: 28px 22px 48px; }
    .hero {
      display: flex; align-items: center; gap: 18px; margin-bottom: 22px;
    }
    .logo {
      width: 72px; height: 72px; border-radius: 18px;
      box-shadow: 0 10px 28px rgba(0,0,0,.22);
      flex: 0 0 auto;
    }
    .hero h1 {
      margin: 0 0 4px; font-size: 26px; font-weight: 750; letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .hero p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; max-width: 46ch; }
    .ver {
      display: inline-block; margin-top: 8px; font-size: 11px; font-weight: 700;
      padding: 3px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted);
    }
    .grid {
      display: grid; grid-template-columns: 1.2fr .8fr; gap: 14px;
    }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: var(--radius); padding: 14px 16px;
      backdrop-filter: blur(8px);
    }
    .card h2 {
      margin: 0 0 10px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
      color: var(--muted); font-weight: 700;
    }
    .actions { display: grid; gap: 8px; }
    .btn {
      appearance: none; border: 1px solid var(--border); background: var(--input);
      color: var(--text); border-radius: 10px; padding: 10px 12px; font: inherit;
      font-size: 13px; font-weight: 600; cursor: pointer; text-align: left;
      display: flex; align-items: center; gap: 10px;
    }
    .btn:hover { background: var(--hover); }
    .btn.primary { background: var(--accent); color: var(--accent-fg); border-color: transparent; }
    .btn .sub { display: block; font-size: 11px; font-weight: 500; opacity: .75; margin-top: 2px; }
    .meta { font-size: 12px; color: var(--muted); line-height: 1.45; }
    .meta strong { color: var(--text); font-weight: 650; }
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
      margin-top: 8px; font-size: 12px; color: var(--muted); white-space: pre-wrap;
      line-height: 1.45; max-height: 220px; overflow: auto;
    }
    .steps { margin: 0; padding-left: 18px; font-size: 12px; color: var(--muted); line-height: 1.55; }
    .steps li { margin: 4px 0; }
    .foot { margin-top: 16px; font-size: 11px; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <img class="logo" src="${logoUri}" alt="LowCode Studio" />
      <div>
        <h1>LowCode Studio</h1>
        <p>Mac-first low-code RPA — design locally, sync to Studio Web Local Workspace, dry-run before publish.</p>
        <span class="ver">v${escapeHtml(model.version)}</span>
      </div>
    </header>

    <div class="grid">
      <section class="card">
        <h2>Open</h2>
        <div class="actions">
          <button class="btn primary" data-cmd="openLocalProject" type="button">
            <span>📁 Open project / Studio Web solution<span class="sub">LCS folder or .uipx — imports .lcs.json</span></span>
          </button>
          <button class="btn" data-cmd="newREFramework" type="button">
            <span>🧩 New REFramework<span class="sub">Init → Get Data → Process template</span></span>
          </button>
          <button class="btn" data-cmd="newBlueprint" type="button">
            <span>🤖 New Robot Blueprint<span class="sub">scrape→Excel · login→email · API→table</span></span>
          </button>
          <button class="btn" data-cmd="connectStudioWeb" type="button">
            <span>☁ Connect / Open Studio Web Local<span class="sub">Link .uipx and sync on Save</span></span>
          </button>
          <button class="btn" data-cmd="openStudioWeb" type="button">
            <span>↗ Open Studio Web in browser<span class="sub">studio.uipath.com</span></span>
          </button>
        </div>
      </section>

      <section class="card">
        <h2>Current</h2>
        <div class="meta">
          <div><strong>${escapeHtml(projectName)}</strong></div>
          <div>${escapeHtml(projectPath || 'Open a folder to get started')}</div>
          <div style="margin-top:8px">Studio Web: ${escapeHtml(swLine)}</div>
        </div>
        <div class="actions" style="margin-top:12px">
          <button class="btn" data-cmd="firstRunWizard" type="button">🚀 First-run wizard</button>
          <button class="btn" data-cmd="scaffoldFromDescription" type="button">✦ Assist F2 — Scaffold</button>
          <button class="btn" data-cmd="repairFromDryRunTrace" type="button">✦ Assist F2 — Trace repair</button>
          <button class="btn" data-cmd="showWhatsNew" type="button">What's New (full)</button>
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:14px">
      <h2>Latest changes</h2>
      <div id="changelog"></div>
    </section>

    <section class="card" style="margin-top:14px">
      <h2>Next 5 steps</h2>
      <ol class="steps" id="nextSteps"></ol>
    </section>

    <p class="foot">Independent community tooling inspired by classic Studio workflows — not an official UiPath product.</p>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const changelog = ${changelogJson};
    const nextSteps = ${nextStepsJson};
    const box = document.getElementById('changelog');
    box.innerHTML = (changelog.length ? changelog : [{ version: '—', body: 'No changelog sections found.' }]).map((s, i) => (
      '<details class="changelog"' + (i === 0 ? '' : '') + '>' +
        '<summary><span>v' + escapeHtml(s.version) + '</span><span style="opacity:.6">expand</span></summary>' +
        '<div class="body">' + escapeHtml(s.body) + '</div>' +
      '</details>'
    )).join('');
    // First section open by default for discoverability, rest collapsed
    const first = box.querySelector('details');
    if (first) first.open = true;

    document.getElementById('nextSteps').innerHTML = nextSteps.map(s => '<li>' + escapeHtml(s) + '</li>').join('');

    document.querySelectorAll('[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'command', command: btn.getAttribute('data-cmd') });
      });
    });

    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Product next steps surfaced on the Home screen (keep in sync with ROADMAP). */
export const HOME_NEXT_STEPS: string[] = [
  'Open a project or Studio Web .uipx solution — Main.lcs.json opens in the designer',
  'Edit Process / Main, then F5 dry-run (Shift+F5 for scenarios)',
  'Use Assist F2 to scaffold steps from a short description, or repair from a failed dry-run trace',
  'Connect / link Studio Web Local Workspace — Save keeps .xaml ↔ .lcs.json in sync',
  'Validate packages → publish from Studio Web when ready'
];
