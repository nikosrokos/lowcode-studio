import { ActivityDefinition } from '../models/activities';
import { WorkflowDocument } from '../models/workflow';

export function getDesignerHtml(
  nonce: string,
  cspSource: string,
  workflow: WorkflowDocument,
  catalog: ActivityDefinition[]
): string {
  const workflowJson = JSON.stringify(workflow).replace(/</g, '\\u003c');
  const catalogJson = JSON.stringify(catalog).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LowCode Studio Designer</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --panel: var(--vscode-sideBar-background);
      --border: var(--vscode-panel-border, #333);
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-button-background);
      --accent-fg: var(--vscode-button-foreground);
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-input-border, #444);
      --hover: var(--vscode-list-hoverBackground);
      --focus: var(--vscode-focusBorder);
      --card: color-mix(in srgb, var(--bg) 88%, var(--text) 12%);
      --shadow: 0 8px 24px rgba(0,0,0,.18);
      --radius: 10px;
      --mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
      --sans: var(--vscode-font-family, "Segoe UI", sans-serif);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; height: 100%;
      background: radial-gradient(1200px 600px at 10% -10%, color-mix(in srgb, var(--accent) 18%, transparent), transparent),
                  radial-gradient(900px 500px at 100% 0%, color-mix(in srgb, #22c55e 10%, transparent), transparent),
                  var(--bg);
      color: var(--text);
      font-family: var(--sans);
      overflow: hidden;
    }
    .app {
      display: grid;
      grid-template-columns: 250px 1fr 300px;
      grid-template-rows: 52px 1fr;
      height: 100%;
    }
    .toolbar {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      backdrop-filter: blur(8px);
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; min-width: 170px; }
    .brand-mark {
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(135deg, #0ea5e9, #22c55e);
      box-shadow: 0 0 0 1px rgba(255,255,255,.08), var(--shadow);
    }
    .workflow-name {
      font-size: 14px; font-weight: 600; background: transparent; border: none; color: var(--text);
      border-bottom: 1px dashed transparent; min-width: 140px;
    }
    .workflow-name:focus { outline: none; border-bottom-color: var(--focus); }
    .mode-pill {
      font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
      padding: 4px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted);
    }
    .mode-pill.flow { color: #0ea5e9; border-color: color-mix(in srgb, #0ea5e9 50%, var(--border)); }
    .spacer { flex: 1; }
    .btn {
      appearance: none; border: 1px solid var(--border);
      background: var(--input-bg); color: var(--text);
      border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer;
    }
    .btn:hover { background: var(--hover); }
    .btn.primary { background: var(--accent); color: var(--accent-fg); border-color: transparent; }
    .btn.danger { border-color: color-mix(in srgb, #ef4444 50%, var(--border)); }
    .btn.active { outline: 1px solid var(--focus); }
    .panel {
      border-right: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 96%, transparent);
      overflow: auto;
    }
    .panel.right { border-right: none; border-left: 1px solid var(--border); }
    .panel h2 {
      margin: 0; padding: 14px 14px 8px; font-size: 11px; text-transform: uppercase;
      letter-spacing: .08em; color: var(--muted); font-weight: 700;
    }
    .search {
      margin: 0 12px 10px; width: calc(100% - 24px);
      background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px;
      padding: 8px 10px; font-size: 12px;
    }
    .cat { padding: 0 8px 12px; }
    .cat-title { font-size: 11px; color: var(--muted); padding: 6px 8px; font-weight: 600; }
    .activity-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; margin: 2px 0; border-radius: 8px;
      cursor: grab; user-select: none; border: 1px solid transparent;
    }
    .activity-item:hover { background: var(--hover); }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
    .activity-item .meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .activity-item .title { font-size: 12px; font-weight: 600; }
    .activity-item .type {
      font-size: 10px; color: var(--muted); font-family: var(--mono);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .canvas-wrap { position: relative; overflow: auto; padding: 20px 20px 80px; }
    .canvas-help { color: var(--muted); font-size: 12px; margin-bottom: 12px; }
    .sequence { max-width: 720px; margin: 0 auto; }
    .drop-zone {
      min-height: 18px; border-radius: 8px; border: 1px dashed transparent; margin: 2px 0;
    }
    .drop-zone.active {
      min-height: 42px; border-color: var(--focus);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .card {
      position: relative; background: var(--card);
      border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
      border-radius: var(--radius); box-shadow: var(--shadow);
      padding: 12px 14px 12px 16px; cursor: pointer; animation: rise .22s ease both;
    }
    .card.selected { border-color: var(--focus); box-shadow: 0 0 0 1px var(--focus), var(--shadow); }
    .card-accent { position: absolute; left: 0; top: 10px; bottom: 10px; width: 4px; border-radius: 0 3px 3px 0; }
    .card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .step { font-size: 10px; color: var(--muted); font-family: var(--mono); min-width: 28px; }
    .card-title { font-size: 13px; font-weight: 700; }
    .card-summary {
      font-size: 12px; color: var(--muted); font-family: var(--mono);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .card-actions { position: absolute; right: 8px; top: 8px; display: none; gap: 4px; }
    .card:hover .card-actions, .card.selected .card-actions { display: flex; }
    .icon-btn {
      width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--input-bg); color: var(--text); cursor: pointer; font-size: 12px;
    }
    .connector { width: 2px; height: 16px; background: color-mix(in srgb, var(--muted) 45%, transparent); margin: 0 auto; }
    .children, .else-children {
      margin: 8px 0 0 18px; padding: 8px 0 8px 12px;
      border-left: 2px solid color-mix(in srgb, var(--muted) 35%, transparent);
    }
    .branch-label {
      font-size: 10px; font-weight: 700; color: var(--muted);
      text-transform: uppercase; letter-spacing: .08em; margin: 4px 0;
    }
    .flow-stage {
      position: relative; min-width: 900px; min-height: 720px;
      border: 1px dashed color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: 12px;
      background:
        linear-gradient(color-mix(in srgb, var(--muted) 12%, transparent) 1px, transparent 1px) 0 0 / 24px 24px,
        linear-gradient(90deg, color-mix(in srgb, var(--muted) 12%, transparent) 1px, transparent 1px) 0 0 / 24px 24px,
        color-mix(in srgb, var(--bg) 92%, transparent);
    }
    .flow-stage.drop-target { outline: 2px solid var(--focus); }
    .flow-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    .flow-svg path { fill: none; stroke: color-mix(in srgb, var(--muted) 70%, #0ea5e9); stroke-width: 2; marker-end: url(#arrow); }
    .flow-svg text { fill: var(--muted); font-size: 11px; font-weight: 700; }
    .flow-node {
      position: absolute; width: 180px; min-height: 64px;
      background: var(--card); border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
      border-radius: 12px; box-shadow: var(--shadow); padding: 10px 12px 12px;
      cursor: grab; user-select: none;
    }
    .flow-node.selected { border-color: var(--focus); box-shadow: 0 0 0 1px var(--focus), var(--shadow); }
    .flow-node.decision {
      width: 170px; height: 170px; border-radius: 16px;
      transform: rotate(45deg); display: flex; align-items: center; justify-content: center;
      padding: 0;
    }
    .flow-node.decision .inner { transform: rotate(-45deg); width: 120px; text-align: center; }
    .flow-node.start, .flow-node.end {
      width: 120px; border-radius: 999px; text-align: center; min-height: 48px;
      display: flex; align-items: center; justify-content: center;
    }
    .flow-node .title { font-size: 12px; font-weight: 700; }
    .flow-node .summary { font-size: 10px; color: var(--muted); margin-top: 4px; font-family: var(--mono); }
    .port {
      position: absolute; width: 12px; height: 12px; border-radius: 50%;
      background: #0ea5e9; border: 2px solid var(--bg); right: -7px; top: 50%;
      transform: translateY(-50%); cursor: crosshair; pointer-events: auto;
    }
    .flow-node.decision .port { right: -8px; }
    .props { padding: 0 14px 20px; }
    .props .empty { color: var(--muted); font-size: 12px; line-height: 1.5; padding: 8px 0; }
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; font-weight: 600; }
    .field input, .field select, .field textarea {
      width: 100%; background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px;
      padding: 8px 10px; font-size: 12px; font-family: var(--mono);
    }
    .field textarea { min-height: 84px; resize: vertical; }
    .toast {
      position: absolute; right: 18px; bottom: 18px;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 12px; font-size: 12px;
      box-shadow: var(--shadow); opacity: 0; pointer-events: none;
      transform: translateY(8px); transition: .2s ease; z-index: 5;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    @keyframes rise {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="toolbar">
      <div class="brand"><div class="brand-mark"></div><span>LowCode Studio</span></div>
      <input class="workflow-name" id="workflowName" />
      <span class="mode-pill" id="workflowType">Sequence</span>
      <div class="spacer"></div>
      <button class="btn" id="btnLink" title="Connect two flowchart nodes" style="display:none">Link</button>
      <button class="btn" id="btnAutoLayout" style="display:none">Auto Layout</button>
      <button class="btn" id="btnValidate">Validate</button>
      <button class="btn" id="btnDryRun">Dry Run</button>
      <button class="btn primary" id="btnSave">Save</button>
    </div>

    <aside class="panel" id="toolbox">
      <h2>Activities</h2>
      <input class="search" id="search" placeholder="Search activities..." />
      <div id="catalog"></div>
    </aside>

    <main class="canvas-wrap" id="canvasWrap">
      <div class="canvas-help" id="canvasHelp"></div>
      <div class="sequence" id="sequence"></div>
      <div class="flow-stage" id="flowStage" style="display:none"></div>
      <div class="toast" id="toast"></div>
    </main>

    <aside class="panel right">
      <h2>Properties</h2>
      <div class="props" id="props"></div>
      <h2>Variables</h2>
      <div class="props" id="variablesPanel"></div>
      <div style="padding:0 14px 18px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" id="btnAddVar">Add Variable</button>
        <button class="btn danger" id="btnDelete" disabled>Delete</button>
      </div>
      <h2 id="connHeading" style="display:none">Connections</h2>
      <div class="props" id="connectionsPanel" style="display:none"></div>
    </aside>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = {
      workflow: ${workflowJson},
      catalog: ${catalogJson},
      selectedId: null,
      dragType: null,
      linkFrom: null,
      draggingId: null,
      dragOffset: { x: 0, y: 0 }
    };

    const els = {
      catalog: document.getElementById('catalog'),
      sequence: document.getElementById('sequence'),
      flowStage: document.getElementById('flowStage'),
      props: document.getElementById('props'),
      variablesPanel: document.getElementById('variablesPanel'),
      connectionsPanel: document.getElementById('connectionsPanel'),
      connHeading: document.getElementById('connHeading'),
      workflowName: document.getElementById('workflowName'),
      workflowType: document.getElementById('workflowType'),
      canvasHelp: document.getElementById('canvasHelp'),
      search: document.getElementById('search'),
      toast: document.getElementById('toast'),
      btnDelete: document.getElementById('btnDelete'),
      btnLink: document.getElementById('btnLink'),
      btnAutoLayout: document.getElementById('btnAutoLayout')
    };

    function isFlow() { return state.workflow.type === 'Flowchart'; }
    function toast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      setTimeout(() => els.toast.classList.remove('show'), 1800);
    }
    function findDef(type) { return state.catalog.find(a => a.type === type); }
    function newId(prefix) {
      return (prefix || 'act') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }
    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

    function createActivity(type, x, y) {
      const def = findDef(type);
      if (!def) return null;
      const properties = {};
      for (const p of def.properties) properties[p.name] = p.defaultValue ?? '';
      const node = { id: newId(), type: def.type, displayName: def.displayName, properties };
      if (def.container) node.children = [];
      if (def.hasElse) node.elseChildren = [];
      if (isFlow()) {
        node.x = typeof x === 'number' ? x : 80 + (state.workflow.activities.length % 4) * 200;
        node.y = typeof y === 'number' ? y : 80 + Math.floor(state.workflow.activities.length / 4) * 140;
      }
      return node;
    }

    function walkFind(list, id) {
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        if (node.id === id) return { node, list, index: i };
        if (node.children) {
          const hit = walkFind(node.children, id);
          if (hit) return hit;
        }
        if (node.elseChildren) {
          const hit = walkFind(node.elseChildren, id);
          if (hit) return hit;
        }
      }
      return null;
    }

    function summary(node) {
      const p = node.properties || {};
      switch (node.type) {
        case 'System.LogMessage': return String(p.message || '');
        case 'Programming.Assign': return (p.to || '') + ' := ' + (p.value || '');
        case 'Flowchart.FlowDecision': return String(p.condition || '');
        case 'REFramework.InvokeWorkflow': return String(p.workflowPath || '');
        case 'ControlFlow.If':
        case 'ControlFlow.While': return 'when ' + (p.condition || '');
        case 'Messaging.HttpRequest': return (p.method || 'GET') + ' ' + (p.url || '');
        default: {
          const first = Object.values(p)[0];
          return first === undefined ? node.type : String(first).slice(0, 42);
        }
      }
    }

    function renderCatalog() {
      const q = els.search.value.trim().toLowerCase();
      const groups = {};
      for (const a of state.catalog) {
        if (q && !a.displayName.toLowerCase().includes(q) && !a.type.toLowerCase().includes(q) && !a.category.toLowerCase().includes(q)) continue;
        if (!isFlow() && a.category === 'Flowchart') continue;
        (groups[a.category] ||= []).push(a);
      }
      els.catalog.innerHTML = Object.entries(groups).map(([cat, items]) => {
        return '<div class="cat"><div class="cat-title">' + escapeHtml(cat) + '</div>' +
          items.map(a => (
            '<div class="activity-item" draggable="true" data-type="' + escapeAttr(a.type) + '">' +
              '<span class="dot" style="background:' + a.color + '"></span>' +
              '<div class="meta"><div class="title">' + escapeHtml(a.displayName) + '</div>' +
              '<div class="type">' + escapeHtml(a.type) + '</div></div></div>'
          )).join('') + '</div>';
      }).join('');

      els.catalog.querySelectorAll('.activity-item').forEach(el => {
        el.addEventListener('dragstart', (e) => {
          state.dragType = el.getAttribute('data-type');
          e.dataTransfer.setData('text/plain', state.dragType);
          e.dataTransfer.effectAllowed = 'copy';
        });
        el.addEventListener('dblclick', () => {
          const node = createActivity(el.getAttribute('data-type'));
          if (!node) return;
          state.workflow.activities.push(node);
          if (isFlow() && state.workflow.activities.length === 1 && node.type === 'Flowchart.Start') {
            state.workflow.startActivityId = node.id;
          }
          state.selectedId = node.id;
          persist(true);
        });
      });
    }

    function parsePath(pathKey) {
      const [base, idxPart] = String(pathKey).split('@');
      const index = idxPart === undefined ? undefined : Number(idxPart);
      return { base, index };
    }
    function getListByPath(pathKey) {
      const { base } = parsePath(pathKey);
      if (base === 'root') return state.workflow.activities;
      const [id, branch] = base.split(':');
      const hit = walkFind(state.workflow.activities, id);
      if (!hit) return state.workflow.activities;
      if (branch === 'else') { hit.node.elseChildren ||= []; return hit.node.elseChildren; }
      hit.node.children ||= [];
      return hit.node.children;
    }
    function insertAtPath(pathKey, node) {
      const { base, index } = parsePath(pathKey);
      const list = getListByPath(base);
      if (typeof index === 'number' && !Number.isNaN(index)) list.splice(index, 0, node);
      else list.push(node);
    }
    function dropZone(pathKey) {
      const z = document.createElement('div');
      z.className = 'drop-zone';
      z.dataset.path = pathKey;
      z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('active'); });
      z.addEventListener('dragleave', () => z.classList.remove('active'));
      z.addEventListener('drop', (e) => {
        e.preventDefault();
        z.classList.remove('active');
        const type = e.dataTransfer.getData('text/plain') || state.dragType;
        const node = createActivity(type);
        if (!node) return;
        insertAtPath(pathKey, node);
        state.selectedId = node.id;
        persist(true);
      });
      return z;
    }

    function renderNode(node, stepNo) {
      const def = findDef(node.type);
      const color = node.color || def?.color || '#64748B';
      const wrap = document.createElement('div');
      const card = document.createElement('div');
      card.className = 'card' + (state.selectedId === node.id ? ' selected' : '');
      card.innerHTML =
        '<div class="card-accent" style="background:' + color + '"></div>' +
        '<div class="card-actions">' +
          '<button class="icon-btn" data-act="up" title="Move up">↑</button>' +
          '<button class="icon-btn" data-act="down" title="Move down">↓</button>' +
          '<button class="icon-btn" data-act="dup" title="Duplicate">⧉</button>' +
        '</div>' +
        '<div class="card-head"><span class="step">#' + stepNo + '</span>' +
        '<div class="card-title">' + escapeHtml(node.displayName) + '</div></div>' +
        '<div class="card-summary">' + escapeHtml(summary(node)) + '</div>';
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-act]')) return;
        state.selectedId = node.id;
        renderAll();
      });
      card.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const act = btn.getAttribute('data-act');
          const hit = walkFind(state.workflow.activities, node.id);
          if (!hit) return;
          if (act === 'up' && hit.index > 0) {
            const [item] = hit.list.splice(hit.index, 1);
            hit.list.splice(hit.index - 1, 0, item);
          } else if (act === 'down' && hit.index < hit.list.length - 1) {
            const [item] = hit.list.splice(hit.index, 1);
            hit.list.splice(hit.index + 1, 0, item);
          } else if (act === 'dup') {
            const clone = JSON.parse(JSON.stringify(node));
            const reid = (n) => { n.id = newId(); (n.children || []).forEach(reid); (n.elseChildren || []).forEach(reid); };
            reid(clone);
            hit.list.splice(hit.index + 1, 0, clone);
            state.selectedId = clone.id;
          }
          persist(true);
        });
      });
      wrap.appendChild(card);
      if (def?.container) {
        const children = document.createElement('div');
        children.className = 'children';
        children.appendChild(Object.assign(document.createElement('div'), { className: 'branch-label', textContent: def.hasElse ? 'Then' : 'Body' }));
        renderList(node.children || [], children, node.id + ':then');
        wrap.appendChild(children);
        if (def.hasElse) {
          const elseChildren = document.createElement('div');
          elseChildren.className = 'else-children';
          elseChildren.appendChild(Object.assign(document.createElement('div'), { className: 'branch-label', textContent: node.type === 'ControlFlow.TryCatch' ? 'Catch' : 'Else' }));
          renderList(node.elseChildren || [], elseChildren, node.id + ':else');
          wrap.appendChild(elseChildren);
        }
      }
      return wrap;
    }

    function renderList(list, container, pathKey) {
      container.appendChild(dropZone(pathKey));
      list.forEach((node, idx) => {
        container.appendChild(renderNode(node, idx + 1));
        const connector = document.createElement('div');
        connector.className = 'connector';
        container.appendChild(connector);
        container.appendChild(dropZone(pathKey + '@' + (idx + 1)));
      });
    }

    function renderSequence() {
      els.sequence.style.display = '';
      els.flowStage.style.display = 'none';
      els.sequence.innerHTML = '';
      renderList(state.workflow.activities, els.sequence, 'root');
    }

    function nodeCenter(node) {
      const isDecision = node.type === 'Flowchart.FlowDecision';
      const isTerminal = node.type === 'Flowchart.Start' || node.type === 'Flowchart.End';
      const w = isDecision ? 170 : isTerminal ? 120 : 180;
      const h = isDecision ? 170 : isTerminal ? 48 : 72;
      return { x: (node.x || 0) + w / 2, y: (node.y || 0) + h / 2, w, h };
    }

    function renderFlowchart() {
      els.sequence.style.display = 'none';
      els.flowStage.style.display = '';
      state.workflow.connections ||= [];
      const stage = els.flowStage;
      stage.innerHTML = '';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('flow-svg');
      svg.innerHTML = '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="currentColor"></path></marker></defs>';

      for (const c of state.workflow.connections) {
        const from = state.workflow.activities.find(a => a.id === c.from);
        const to = state.workflow.activities.find(a => a.id === c.to);
        if (!from || !to) continue;
        const a = nodeCenter(from);
        const b = nodeCenter(to);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = (a.y + b.y) / 2;
        path.setAttribute('d', 'M ' + a.x + ' ' + a.y + ' C ' + a.x + ' ' + midY + ', ' + b.x + ' ' + midY + ', ' + b.x + ' ' + b.y);
        svg.appendChild(path);
        if (c.label) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', String((a.x + b.x) / 2));
          text.setAttribute('y', String(midY - 6));
          text.setAttribute('text-anchor', 'middle');
          text.textContent = c.label;
          svg.appendChild(text);
        }
      }
      stage.appendChild(svg);

      for (const node of state.workflow.activities) {
        const def = findDef(node.type);
        const el = document.createElement('div');
        const isDecision = node.type === 'Flowchart.FlowDecision';
        const isStart = node.type === 'Flowchart.Start';
        const isEnd = node.type === 'Flowchart.End';
        el.className = 'flow-node' +
          (state.selectedId === node.id ? ' selected' : '') +
          (isDecision ? ' decision' : '') +
          (isStart ? ' start' : '') +
          (isEnd ? ' end' : '');
        el.style.left = (node.x || 40) + 'px';
        el.style.top = (node.y || 40) + 'px';
        el.style.borderColor = node.color || def?.color || undefined;
        if (isDecision) {
          el.innerHTML = '<div class="inner"><div class="title">' + escapeHtml(node.displayName) + '</div><div class="summary">' + escapeHtml(summary(node)) + '</div></div><div class="port" title="Drag to connect"></div>';
        } else {
          el.innerHTML = '<div class="title">' + escapeHtml(node.displayName) + '</div>' +
            (isStart || isEnd ? '' : '<div class="summary">' + escapeHtml(summary(node)) + '</div>') +
            (isEnd ? '' : '<div class="port" title="Drag to connect"></div>');
        }

        el.addEventListener('mousedown', (e) => {
          if (e.target.classList.contains('port')) return;
          state.selectedId = node.id;
          state.draggingId = node.id;
          state.dragOffset = { x: e.clientX - (node.x || 0), y: e.clientY - (node.y || 0) };
          renderProps();
          renderConnectionsPanel();
          document.querySelectorAll('.flow-node').forEach(n => n.classList.remove('selected'));
          el.classList.add('selected');
        });

        el.querySelector('.port')?.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          state.linkFrom = node.id;
          els.btnLink.classList.add('active');
          toast('Click a target node to connect');
        });

        el.addEventListener('mouseup', () => {
          if (state.linkFrom && state.linkFrom !== node.id) {
            state.workflow.connections.push({
              id: newId('conn'),
              from: state.linkFrom,
              to: node.id,
              label: node.type === 'Flowchart.FlowDecision' || findDef(state.workflow.activities.find(a => a.id === state.linkFrom)?.type)?.type === 'Flowchart.FlowDecision'
                ? promptLabel(state.linkFrom)
                : ''
            });
            state.linkFrom = null;
            els.btnLink.classList.remove('active');
            persist(true);
          }
        });

        stage.appendChild(el);
      }

      stage.ondragover = (e) => { e.preventDefault(); stage.classList.add('drop-target'); };
      stage.ondragleave = () => stage.classList.remove('drop-target');
      stage.ondrop = (e) => {
        e.preventDefault();
        stage.classList.remove('drop-target');
        const type = e.dataTransfer.getData('text/plain') || state.dragType;
        const rect = stage.getBoundingClientRect();
        const node = createActivity(type, e.clientX - rect.left - 60, e.clientY - rect.top - 20);
        if (!node) return;
        state.workflow.activities.push(node);
        if (node.type === 'Flowchart.Start') state.workflow.startActivityId = node.id;
        state.selectedId = node.id;
        persist(true);
      };
    }

    function promptLabel(fromId) {
      const from = state.workflow.activities.find(a => a.id === fromId);
      if (from?.type !== 'Flowchart.FlowDecision') return '';
      const existing = (state.workflow.connections || []).filter(c => c.from === fromId).map(c => (c.label || '').toLowerCase());
      if (!existing.includes('true')) return 'True';
      if (!existing.includes('false')) return 'False';
      return 'Next';
    }

    window.addEventListener('mousemove', (e) => {
      if (!state.draggingId) return;
      const node = state.workflow.activities.find(a => a.id === state.draggingId);
      if (!node) return;
      node.x = Math.max(0, e.clientX - state.dragOffset.x);
      node.y = Math.max(0, e.clientY - state.dragOffset.y);
      const el = [...document.querySelectorAll('.flow-node')].find(n => n.classList.contains('selected'));
      // live move without full persist spam
      const map = new Map(state.workflow.activities.map(a => [a.id, a]));
      document.querySelectorAll('.flow-node').forEach((dom, idx) => {
        const n = state.workflow.activities[idx];
        if (!n) return;
        if (n.id === state.draggingId) {
          dom.style.left = node.x + 'px';
          dom.style.top = node.y + 'px';
        }
      });
      // redraw lines cheaply
      const svg = els.flowStage.querySelector('.flow-svg');
      if (svg) {
        [...svg.querySelectorAll('path, text')].forEach(n => n.remove());
        for (const c of state.workflow.connections || []) {
          const from = map.get(c.from); const to = map.get(c.to);
          if (!from || !to) continue;
          const a = nodeCenter(from); const b = nodeCenter(to);
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const midY = (a.y + b.y) / 2;
          path.setAttribute('d', 'M ' + a.x + ' ' + a.y + ' C ' + a.x + ' ' + midY + ', ' + b.x + ' ' + midY + ', ' + b.x + ' ' + b.y);
          svg.appendChild(path);
          if (c.label) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', String((a.x + b.x) / 2));
            text.setAttribute('y', String(midY - 6));
            text.setAttribute('text-anchor', 'middle');
            text.textContent = c.label;
            svg.appendChild(text);
          }
        }
      }
    });
    window.addEventListener('mouseup', () => {
      if (state.draggingId) {
        state.draggingId = null;
        persist(false);
        renderFlowchart();
        renderProps();
        renderConnectionsPanel();
      }
    });

    function renderProps() {
      const hit = state.selectedId ? walkFind(state.workflow.activities, state.selectedId) : null;
      els.btnDelete.disabled = !hit;
      if (!hit) {
        els.props.innerHTML = '<div class="empty">Select a step to edit properties. In Flowchart mode, drag the blue port to connect nodes.</div>';
        return;
      }
      const node = hit.node;
      const def = findDef(node.type);
      let html = '<div class="field"><label>Display Name</label><input id="prop_displayName" value="' + escapeAttr(node.displayName) + '" /></div>';
      html += '<div class="field"><label>Type</label><input value="' + escapeAttr(node.type) + '" disabled /></div>';
      const currentColor = node.color || def?.color || '#64748B';
      const presets = ['#3B82F6','#8B5CF6','#F59E0B','#10B981','#EF4444','#0EA5E9','#EC4899','#64748B','#22C55E','#A855F7'];
      html += '<div class="field"><label>Container color</label>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
        presets.map(c => '<button type="button" class="icon-btn" data-color="' + c + '" title="' + c + '" style="background:' + c + ';border-color:transparent;width:22px;height:22px;"></button>').join('') +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input type="color" id="prop_color" value="' + escapeAttr(currentColor) + '" style="width:48px;height:32px;padding:0;border:none;background:transparent;" />' +
        '<input id="prop_color_hex" value="' + escapeAttr(currentColor) + '" placeholder="#RRGGBB" />' +
        '<button class="btn" id="btnResetColor" type="button">Reset</button>' +
        '</div></div>';
      for (const p of (def?.properties || [])) {
        const val = node.properties?.[p.name] ?? '';
        html += '<div class="field"><label>' + escapeHtml(p.label) + (p.required ? ' *' : '') + '</label>';
        if (p.type === 'enum') {
          html += '<select data-prop="' + escapeAttr(p.name) + '">' +
            (p.options || []).map(o => '<option value="' + escapeAttr(o) + '"' + (String(val) === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>').join('') +
            '</select>';
        } else if (p.type === 'boolean') {
          html += '<select data-prop="' + escapeAttr(p.name) + '"><option value="true"' + (val === true || val === 'true' ? ' selected' : '') + '>true</option><option value="false"' + (val === false || val === 'false' ? ' selected' : '') + '>false</option></select>';
        } else if (p.type === 'multiline') {
          html += '<textarea data-prop="' + escapeAttr(p.name) + '">' + escapeHtml(String(val)) + '</textarea>';
        } else if (p.type === 'number') {
          html += '<input type="number" data-prop="' + escapeAttr(p.name) + '" value="' + escapeAttr(String(val)) + '" />';
        } else {
          html += '<input data-prop="' + escapeAttr(p.name) + '" value="' + escapeAttr(String(val)) + '" />';
        }
        html += '</div>';
      }
      if (isFlow()) {
        html += '<div class="field"><label>Set as Start</label><button class="btn" id="btnSetStart">Use as flowchart start</button></div>';
      }
      els.props.innerHTML = html;
      document.getElementById('prop_displayName').addEventListener('change', (e) => {
        node.displayName = e.target.value || node.displayName;
        persist(true);
      });
      const applyColor = (value) => {
        if (!value || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return;
        node.color = value;
        const hex = document.getElementById('prop_color_hex');
        const picker = document.getElementById('prop_color');
        if (hex) hex.value = value;
        if (picker) picker.value = value.length === 4
          ? '#' + value.slice(1).split('').map(ch => ch + ch).join('')
          : value;
        persist(true);
      };
      document.getElementById('prop_color')?.addEventListener('input', (e) => applyColor(e.target.value));
      document.getElementById('prop_color_hex')?.addEventListener('change', (e) => applyColor(e.target.value.trim()));
      document.getElementById('btnResetColor')?.addEventListener('click', () => {
        delete node.color;
        persist(true);
      });
      els.props.querySelectorAll('[data-color]').forEach(btn => {
        btn.addEventListener('click', () => applyColor(btn.getAttribute('data-color')));
      });
      els.props.querySelectorAll('[data-prop]').forEach(input => {
        const apply = () => {
          const key = input.getAttribute('data-prop');
          let value = input.value;
          const pdef = def?.properties.find(p => p.name === key);
          if (pdef?.type === 'number') value = Number(value);
          if (pdef?.type === 'boolean') value = value === 'true';
          node.properties[key] = value;
          persist(true);
        };
        input.addEventListener('change', apply);
        input.addEventListener('blur', apply);
      });
      document.getElementById('btnSetStart')?.addEventListener('click', () => {
        state.workflow.startActivityId = node.id;
        toast('Start node set');
        persist(false);
      });
    }

    function renderVariables() {
      const vars = state.workflow.variables || [];
      if (!vars.length) {
        els.variablesPanel.innerHTML = '<div class="empty">No variables yet.</div>';
        return;
      }
      els.variablesPanel.innerHTML = vars.map((v, i) => (
        '<div class="field" style="display:grid;grid-template-columns:1fr 90px 28px;gap:6px;align-items:end;">' +
          '<div><label>Name</label><input data-var="' + i + '" data-field="name" value="' + escapeAttr(v.name) + '" /></div>' +
          '<div><label>Type</label><select data-var="' + i + '" data-field="type">' +
            ['String','Int32','Boolean','Double','Object','DataTable','Array'].map(t => '<option' + (v.type===t?' selected':'') + '>' + t + '</option>').join('') +
          '</select></div>' +
          '<button class="icon-btn" data-del-var="' + i + '" title="Remove">✕</button>' +
        '</div>' +
        '<div class="field"><label>Default</label><input data-var="' + i + '" data-field="defaultValue" value="' + escapeAttr(v.defaultValue === undefined || v.defaultValue === null ? '' : String(v.defaultValue)) + '" /></div>'
      )).join('');
      els.variablesPanel.querySelectorAll('[data-var]').forEach(input => {
        input.addEventListener('change', () => {
          const i = Number(input.getAttribute('data-var'));
          const field = input.getAttribute('data-field');
          if (field === 'defaultValue') {
            const t = state.workflow.variables[i].type;
            let val = input.value;
            if (t === 'Int32' || t === 'Double') val = Number(val || 0);
            if (t === 'Boolean') val = val === 'true';
            state.workflow.variables[i].defaultValue = val;
          } else {
            state.workflow.variables[i][field] = input.value;
          }
          persist(false);
          vscode.postMessage({ type: 'variablesChanged', variables: state.workflow.variables });
        });
      });
      els.variablesPanel.querySelectorAll('[data-del-var]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.workflow.variables.splice(Number(btn.getAttribute('data-del-var')), 1);
          persist(true);
          vscode.postMessage({ type: 'variablesChanged', variables: state.workflow.variables });
        });
      });
    }

    function renderConnectionsPanel() {
      if (!isFlow()) {
        els.connHeading.style.display = 'none';
        els.connectionsPanel.style.display = 'none';
        return;
      }
      els.connHeading.style.display = '';
      els.connectionsPanel.style.display = '';
      const conns = state.workflow.connections || [];
      if (!conns.length) {
        els.connectionsPanel.innerHTML = '<div class="empty">No links yet. Drag a blue port to another node.</div>';
        return;
      }
      const nameOf = (id) => state.workflow.activities.find(a => a.id === id)?.displayName || id;
      els.connectionsPanel.innerHTML = conns.map((c, i) => (
        '<div class="field" style="display:grid;grid-template-columns:1fr 70px 28px;gap:6px;align-items:end;">' +
          '<div><label>' + escapeHtml(nameOf(c.from)) + ' → ' + escapeHtml(nameOf(c.to)) + '</label>' +
          '<input data-conn="' + i + '" value="' + escapeAttr(c.label || '') + '" placeholder="Label (True/False/Next)" /></div>' +
          '<button class="btn" data-focus-conn="' + i + '">Sel</button>' +
          '<button class="icon-btn" data-del-conn="' + i + '">✕</button></div>'
      )).join('');
      els.connectionsPanel.querySelectorAll('[data-conn]').forEach(input => {
        input.addEventListener('change', () => {
          state.workflow.connections[Number(input.getAttribute('data-conn'))].label = input.value;
          persist(true);
        });
      });
      els.connectionsPanel.querySelectorAll('[data-del-conn]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.workflow.connections.splice(Number(btn.getAttribute('data-del-conn')), 1);
          persist(true);
        });
      });
    }

    function autoLayout() {
      const nodes = state.workflow.activities;
      nodes.forEach((n, i) => {
        n.x = 80 + (i % 3) * 220;
        n.y = 40 + Math.floor(i / 3) * 160;
      });
      // Prefer layered layout by following edges from start
      const startId = state.workflow.startActivityId || nodes.find(n => n.type === 'Flowchart.Start')?.id;
      if (startId) {
        const outs = new Map();
        for (const c of state.workflow.connections || []) {
          (outs.get(c.from) || outs.set(c.from, []).get(c.from)).push(c.to);
        }
        const depth = new Map();
        const queue = [startId];
        depth.set(startId, 0);
        while (queue.length) {
          const id = queue.shift();
          for (const to of (outs.get(id) || [])) {
            if (!depth.has(to)) {
              depth.set(to, (depth.get(id) || 0) + 1);
              queue.push(to);
            }
          }
        }
        const buckets = new Map();
        for (const n of nodes) {
          const d = depth.get(n.id) ?? 0;
          const list = buckets.get(d) || [];
          list.push(n);
          buckets.set(d, list);
        }
        [...buckets.keys()].sort((a,b)=>a-b).forEach((d) => {
          const list = buckets.get(d);
          list.forEach((n, i) => {
            n.x = 60 + i * 220;
            n.y = 40 + d * 150;
          });
        });
      }
      persist(true);
      toast('Auto layout applied');
    }

    function renderAll() {
      els.workflowName.value = state.workflow.name || '';
      els.workflowType.textContent = state.workflow.type || 'Sequence';
      els.workflowType.classList.toggle('flow', isFlow());
      els.btnLink.style.display = isFlow() ? '' : 'none';
      els.btnAutoLayout.style.display = isFlow() ? '' : 'none';
      els.canvasHelp.textContent = isFlow()
        ? 'Flowchart mode: drop activities on the grid, drag nodes, and use the blue port to create True/False/Next links.'
        : 'Sequence mode: drag activities onto the sequence. Click a step to edit properties.';
      renderCatalog();
      if (isFlow()) renderFlowchart(); else renderSequence();
      renderProps();
      renderVariables();
      renderConnectionsPanel();
    }

    function persist(rerender) {
      vscode.postMessage({ type: 'edit', workflow: state.workflow });
      if (rerender) renderAll();
      else if (isFlow()) { /* positions already live */ }
      else { renderSequence(); renderProps(); }
    }

    els.workflowName.addEventListener('change', () => {
      state.workflow.name = els.workflowName.value || 'Untitled';
      persist(false);
    });
    els.search.addEventListener('input', renderCatalog);
    document.getElementById('btnSave').addEventListener('click', () => {
      vscode.postMessage({ type: 'save' });
      toast('Saved');
    });
    document.getElementById('btnValidate').addEventListener('click', () => {
      vscode.postMessage({ type: 'validate', workflow: state.workflow });
    });
    document.getElementById('btnDryRun').addEventListener('click', () => {
      vscode.postMessage({ type: 'dryRun', workflow: state.workflow });
    });
    document.getElementById('btnAddVar').addEventListener('click', () => {
      state.workflow.variables ||= [];
      state.workflow.variables.push({ name: 'var' + (state.workflow.variables.length + 1), type: 'String', defaultValue: '' });
      persist(true);
      vscode.postMessage({ type: 'variablesChanged', variables: state.workflow.variables });
    });
    els.btnDelete.addEventListener('click', () => {
      if (!state.selectedId) return;
      const hit = walkFind(state.workflow.activities, state.selectedId);
      if (!hit) return;
      const id = state.selectedId;
      hit.list.splice(hit.index, 1);
      if (isFlow()) {
        state.workflow.connections = (state.workflow.connections || []).filter(c => c.from !== id && c.to !== id);
        if (state.workflow.startActivityId === id) state.workflow.startActivityId = undefined;
      }
      state.selectedId = null;
      persist(true);
    });
    els.btnLink.addEventListener('click', () => {
      if (!state.selectedId) { toast('Select a source node first'); return; }
      state.linkFrom = state.selectedId;
      els.btnLink.classList.add('active');
      toast('Click a target node');
    });
    els.btnAutoLayout.addEventListener('click', autoLayout);

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'setWorkflow') {
        state.workflow = msg.workflow;
        state.selectedId = null;
        renderAll();
      }
      if (msg.type === 'insertActivity' && msg.activityType) {
        const node = createActivity(msg.activityType);
        if (!node) return;
        state.workflow.activities.push(node);
        state.selectedId = node.id;
        persist(true);
        toast('Added ' + node.displayName);
      }
      if (msg.type === 'toast' && msg.message) toast(msg.message);
    });

    renderAll();
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
