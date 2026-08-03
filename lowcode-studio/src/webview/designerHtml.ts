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
    .brand {
      display: flex; align-items: center; gap: 10px;
      font-weight: 700; letter-spacing: .2px;
      min-width: 180px;
    }
    .brand-mark {
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(135deg, #0ea5e9, #22c55e);
      box-shadow: 0 0 0 1px rgba(255,255,255,.08), var(--shadow);
    }
    .workflow-name {
      font-size: 14px; font-weight: 600;
      background: transparent; border: none; color: var(--text);
      border-bottom: 1px dashed transparent; min-width: 160px;
    }
    .workflow-name:focus {
      outline: none; border-bottom-color: var(--focus);
    }
    .spacer { flex: 1; }
    .btn {
      appearance: none; border: 1px solid var(--border);
      background: var(--input-bg); color: var(--text);
      border-radius: 8px; padding: 6px 12px; font-size: 12px;
      cursor: pointer;
    }
    .btn:hover { background: var(--hover); }
    .btn.primary {
      background: var(--accent); color: var(--accent-fg); border-color: transparent;
    }
    .btn.danger { border-color: color-mix(in srgb, #ef4444 50%, var(--border)); }
    .panel {
      border-right: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 96%, transparent);
      overflow: auto;
    }
    .panel.right { border-right: none; border-left: 1px solid var(--border); }
    .panel h2 {
      margin: 0; padding: 14px 14px 8px;
      font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
      color: var(--muted); font-weight: 700;
    }
    .search {
      margin: 0 12px 10px; width: calc(100% - 24px);
      background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px;
      padding: 8px 10px; font-size: 12px;
    }
    .cat { padding: 0 8px 12px; }
    .cat-title {
      font-size: 11px; color: var(--muted); padding: 6px 8px; font-weight: 600;
    }
    .activity-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; margin: 2px 0; border-radius: 8px;
      cursor: grab; user-select: none; border: 1px solid transparent;
    }
    .activity-item:hover {
      background: var(--hover); border-color: color-mix(in srgb, var(--border) 80%, transparent);
    }
    .dot {
      width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto;
    }
    .activity-item .meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .activity-item .title { font-size: 12px; font-weight: 600; }
    .activity-item .type {
      font-size: 10px; color: var(--muted); font-family: var(--mono);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .canvas-wrap {
      position: relative; overflow: auto; padding: 28px 24px 80px;
    }
    .canvas-help {
      color: var(--muted); font-size: 12px; margin-bottom: 14px;
    }
    .sequence {
      max-width: 720px; margin: 0 auto;
      display: flex; flex-direction: column; align-items: stretch; gap: 0;
    }
    .drop-zone {
      min-height: 18px; border-radius: 8px;
      border: 1px dashed transparent; margin: 2px 0;
      transition: .15s ease;
    }
    .drop-zone.active {
      min-height: 42px;
      border-color: var(--focus);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .card {
      position: relative;
      background: var(--card);
      border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 12px 14px 12px 16px;
      cursor: pointer;
      animation: rise .22s ease both;
    }
    .card.selected {
      border-color: var(--focus);
      box-shadow: 0 0 0 1px var(--focus), var(--shadow);
    }
    .card-accent {
      position: absolute; left: 0; top: 10px; bottom: 10px; width: 4px;
      border-radius: 0 3px 3px 0;
    }
    .card-head {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
    }
    .step {
      font-size: 10px; color: var(--muted); font-family: var(--mono);
      min-width: 28px;
    }
    .card-title { font-size: 13px; font-weight: 700; }
    .card-summary {
      font-size: 12px; color: var(--muted); font-family: var(--mono);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .card-actions {
      position: absolute; right: 8px; top: 8px; display: none; gap: 4px;
    }
    .card:hover .card-actions, .card.selected .card-actions { display: flex; }
    .icon-btn {
      width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--input-bg); color: var(--text); cursor: pointer; font-size: 12px;
    }
    .connector {
      width: 2px; height: 16px; background: color-mix(in srgb, var(--muted) 45%, transparent);
      margin: 0 auto;
    }
    .children, .else-children {
      margin: 8px 0 0 18px;
      padding: 8px 0 8px 12px;
      border-left: 2px solid color-mix(in srgb, var(--muted) 35%, transparent);
    }
    .branch-label {
      font-size: 10px; font-weight: 700; color: var(--muted);
      text-transform: uppercase; letter-spacing: .08em; margin: 4px 0;
    }
    .props {
      padding: 0 14px 20px;
    }
    .props .empty {
      color: var(--muted); font-size: 12px; line-height: 1.5; padding: 8px 0;
    }
    .field { margin-bottom: 12px; }
    .field label {
      display: block; font-size: 11px; color: var(--muted);
      margin-bottom: 4px; font-weight: 600;
    }
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
      transform: translateY(8px); transition: .2s ease;
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
      <span id="workflowType" style="color:var(--muted);font-size:12px;"></span>
      <div class="spacer"></div>
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
      <div class="canvas-help">Drag activities onto the sequence. Click a step to edit properties. Double-click an activity in the toolbox to append it.</div>
      <div class="sequence" id="sequence"></div>
      <div class="toast" id="toast"></div>
    </main>

    <aside class="panel right">
      <h2>Properties</h2>
      <div class="props" id="props"></div>
      <h2>Variables</h2>
      <div class="props" id="variablesPanel"></div>
      <div style="padding:0 14px 18px;display:flex;gap:8px;">
        <button class="btn" id="btnAddVar">Add Variable</button>
        <button class="btn danger" id="btnDelete" disabled>Delete Step</button>
      </div>
    </aside>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = {
      workflow: ${workflowJson},
      catalog: ${catalogJson},
      selectedId: null,
      dragType: null
    };

    const els = {
      catalog: document.getElementById('catalog'),
      sequence: document.getElementById('sequence'),
      props: document.getElementById('props'),
      variablesPanel: document.getElementById('variablesPanel'),
      workflowName: document.getElementById('workflowName'),
      workflowType: document.getElementById('workflowType'),
      search: document.getElementById('search'),
      toast: document.getElementById('toast'),
      btnDelete: document.getElementById('btnDelete')
    };

    function toast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      setTimeout(() => els.toast.classList.remove('show'), 1800);
    }

    function findDef(type) {
      return state.catalog.find(a => a.type === type);
    }

    function newId() {
      return 'act_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function createActivity(type) {
      const def = findDef(type);
      if (!def) return null;
      const properties = {};
      for (const p of def.properties) properties[p.name] = p.defaultValue ?? '';
      const node = {
        id: newId(),
        type: def.type,
        displayName: def.displayName,
        properties
      };
      if (def.container) node.children = [];
      if (def.hasElse) node.elseChildren = [];
      return node;
    }

    function walkFind(list, id, parent = null) {
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        if (node.id === id) return { node, list, index: i, parent };
        if (node.children) {
          const hit = walkFind(node.children, id, node);
          if (hit) return hit;
        }
        if (node.elseChildren) {
          const hit = walkFind(node.elseChildren, id, node);
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
        case 'ControlFlow.If':
        case 'ControlFlow.While': return 'when ' + (p.condition || '');
        case 'ControlFlow.ForEach': return (p.item || 'item') + ' in ' + (p.values || '');
        case 'UI.Click': return String(p.selector || '').slice(0, 48);
        case 'UI.TypeInto': return String(p.text || '');
        case 'Messaging.HttpRequest': return (p.method || 'GET') + ' ' + (p.url || '');
        default: {
          const first = Object.values(p)[0];
          return first === undefined ? node.type : String(first).slice(0, 48);
        }
      }
    }

    function renderCatalog() {
      const q = els.search.value.trim().toLowerCase();
      const groups = {};
      for (const a of state.catalog) {
        if (q && !a.displayName.toLowerCase().includes(q) && !a.type.toLowerCase().includes(q) && !a.category.toLowerCase().includes(q)) {
          continue;
        }
        (groups[a.category] ||= []).push(a);
      }
      els.catalog.innerHTML = Object.entries(groups).map(([cat, items]) => {
        return '<div class="cat"><div class="cat-title">' + escapeHtml(cat) + '</div>' +
          items.map(a => (
            '<div class="activity-item" draggable="true" data-type="' + escapeAttr(a.type) + '">' +
              '<span class="dot" style="background:' + a.color + '"></span>' +
              '<div class="meta"><div class="title">' + escapeHtml(a.displayName) + '</div>' +
              '<div class="type">' + escapeHtml(a.type) + '</div></div>' +
            '</div>'
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
          state.selectedId = node.id;
          persist(true);
        });
      });
    }

    function dropZone(pathKey) {
      const z = document.createElement('div');
      z.className = 'drop-zone';
      z.dataset.path = pathKey;
      z.addEventListener('dragover', (e) => {
        e.preventDefault();
        z.classList.add('active');
      });
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
      if (branch === 'else') {
        hit.node.elseChildren ||= [];
        return hit.node.elseChildren;
      }
      hit.node.children ||= [];
      return hit.node.children;
    }

    function insertAtPath(pathKey, node) {
      const { base, index } = parsePath(pathKey);
      const list = getListByPath(base);
      if (typeof index === 'number' && !Number.isNaN(index)) list.splice(index, 0, node);
      else list.push(node);
    }

    function renderNode(node, stepNo) {
      const def = findDef(node.type);
      const color = def?.color || '#64748B';
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
            const reid = (n) => {
              n.id = newId();
              (n.children || []).forEach(reid);
              (n.elseChildren || []).forEach(reid);
            };
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
      els.sequence.innerHTML = '';
      renderList(state.workflow.activities, els.sequence, 'root');
    }

    function renderProps() {
      const hit = state.selectedId ? walkFind(state.workflow.activities, state.selectedId) : null;
      els.btnDelete.disabled = !hit;
      if (!hit) {
        els.props.innerHTML = '<div class="empty">Select an activity on the canvas to edit its properties. This panel mirrors Studio\\'s Properties pane.</div>';
        return;
      }
      const node = hit.node;
      const def = findDef(node.type);
      let html = '<div class="field"><label>Display Name</label><input id="prop_displayName" value="' + escapeAttr(node.displayName) + '" /></div>';
      html += '<div class="field"><label>Type</label><input value="' + escapeAttr(node.type) + '" disabled /></div>';
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
        if (p.description) html += '<div style="font-size:10px;color:var(--muted);margin-top:4px;">' + escapeHtml(p.description) + '</div>';
        html += '</div>';
      }
      els.props.innerHTML = html;

      const nameInput = document.getElementById('prop_displayName');
      nameInput.addEventListener('change', () => {
        node.displayName = nameInput.value || node.displayName;
        persist(true);
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
          notifyVariables();
        });
      });
      els.variablesPanel.querySelectorAll('[data-del-var]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.getAttribute('data-del-var'));
          state.workflow.variables.splice(i, 1);
          persist(true);
          notifyVariables();
        });
      });
    }

    function notifyVariables() {
      vscode.postMessage({ type: 'variablesChanged', variables: state.workflow.variables });
    }

    function renderAll() {
      els.workflowName.value = state.workflow.name || '';
      els.workflowType.textContent = state.workflow.type || 'Sequence';
      renderCatalog();
      renderSequence();
      renderProps();
      renderVariables();
    }

    function persist(rerender) {
      vscode.postMessage({ type: 'edit', workflow: state.workflow });
      if (rerender) renderAll();
      else {
        // light update of selected card summary
        renderSequence();
        renderProps();
      }
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
    }
    function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

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
      notifyVariables();
    });
    els.btnDelete.addEventListener('click', () => {
      if (!state.selectedId) return;
      const hit = walkFind(state.workflow.activities, state.selectedId);
      if (!hit) return;
      hit.list.splice(hit.index, 1);
      state.selectedId = null;
      persist(true);
    });

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
