import { ActivityDefinition } from '../models/activities';
import { WorkflowDocument } from '../models/workflow';
import { SELECTOR_TEMPLATES } from '../interop/selectorBuilder';
import { ActivityPaletteState } from '../interop/activityPalette';
import { PropertySuggestions } from '../interop/propertySuggestions';
import { DesignerProjectEntry } from '../interop/projectResolve';

export type DesignerSettings = {
  showLineNumbers: boolean;
  defaultWorkflowType: 'Sequence' | 'Flowchart';
  autoOpenDesigner: boolean;
  syncStudioWebOnSave: boolean;
  uipathTargetFramework: 'Windows' | 'Portable';
  canvasStyle: 'plain' | 'dots';
};

const DEFAULT_DESIGNER_SETTINGS: DesignerSettings = {
  showLineNumbers: true,
  defaultWorkflowType: 'Sequence',
  autoOpenDesigner: true,
  syncStudioWebOnSave: true,
  uipathTargetFramework: 'Windows',
  canvasStyle: 'plain'
};

export function getDesignerHtml(
  nonce: string,
  cspSource: string,
  workflow: WorkflowDocument,
  catalog: ActivityDefinition[],
  suggestions: PropertySuggestions = {
    variables: [],
    configKeys: [],
    configExpressions: [],
    workflowPaths: []
  },
  palette: ActivityPaletteState = { favorites: [], recent: [] },
  projects: DesignerProjectEntry[] = [],
  settings: DesignerSettings = DEFAULT_DESIGNER_SETTINGS
): string {
  const workflowJson = JSON.stringify(workflow).replace(/</g, '\\u003c');
  const catalogJson = JSON.stringify(catalog).replace(/</g, '\\u003c');
  const selectorTemplatesJson = JSON.stringify(SELECTOR_TEMPLATES).replace(/</g, '\\u003c');
  const suggestionsJson = JSON.stringify(suggestions).replace(/</g, '\\u003c');
  const paletteJson = JSON.stringify(palette).replace(/</g, '\\u003c');
  const projectsJson = JSON.stringify(projects).replace(/</g, '\\u003c');
  const settingsJson = JSON.stringify(settings).replace(/</g, '\\u003c');

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
      --card: color-mix(in srgb, var(--bg) 92%, var(--text) 8%);
      --board: color-mix(in srgb, var(--bg) 96%, var(--text) 4%);
      --shadow: 0 1px 2px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.08);
      --shadow-sm: 0 1px 2px rgba(0,0,0,.1);
      --shadow-frame: 0 12px 40px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.16);
      --radius: 8px;
      --radius-frame: 14px;
      --mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
      --sans: var(--vscode-font-family, "Segoe UI", sans-serif);
      --spine: color-mix(in srgb, var(--muted) 40%, transparent);
      --dock-h: 64px;
      --left-width: 280px;
      --props-width: 300px;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: var(--sans);
      overflow: hidden;
    }
    .app {
      display: grid;
      grid-template-columns: var(--left-width, 280px) 1fr var(--props-width, 300px);
      grid-template-rows: 48px 1fr;
      height: 100%;
      gap: 0;
      background:
        radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%),
        var(--bg);
    }
    .app.left-floating { grid-template-columns: 0 1fr var(--props-width, 300px); }
    .app.left-collapsed { grid-template-columns: 40px 1fr var(--props-width, 300px); }
    .app.props-floating { grid-template-columns: var(--left-width, 280px) 1fr 0; }
    .app.props-collapsed { grid-template-columns: var(--left-width, 280px) 1fr 40px; }
    .app.left-floating.props-floating { grid-template-columns: 0 1fr 0; }
    .app.left-collapsed.props-floating { grid-template-columns: 40px 1fr 0; }
    .app.left-floating.props-collapsed { grid-template-columns: 0 1fr 40px; }
    .app.left-collapsed.props-collapsed { grid-template-columns: 40px 1fr 40px; }
    .toolbar {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      background: color-mix(in srgb, var(--panel) 78%, transparent);
      backdrop-filter: blur(14px) saturate(1.2);
      z-index: 20;
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
      border-right: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      background: color-mix(in srgb, var(--panel) 94%, transparent);
      overflow: auto;
      position: relative;
      min-height: 0;
    }
    .panel.left-rail {
      display: flex; flex-direction: column; overflow: hidden;
      border-right: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
    }
    .panel.frame-docked {
      margin: 8px 0 8px 8px;
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: var(--radius-frame);
      box-shadow: var(--shadow-sm);
      background: color-mix(in srgb, var(--panel) 96%, transparent);
      backdrop-filter: blur(10px);
    }
    .panel.right.frame-docked {
      margin: 8px 8px 8px 0;
      border-right: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-left: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    }
    .left-stack {
      display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;
    }
    .left-section {
      display: flex; flex-direction: column; min-height: 0;
      flex: 0 0 auto;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    }
    .left-section.collapsed { flex: 0 0 auto; min-height: 0; }
    .left-section.collapsed .left-section-body { display: none; }
    /* Accordion: only the open section grows to fill the rail */
    .left-section:not(.collapsed) {
      flex: 1 1 auto;
      min-height: 120px;
    }
    .left-section[data-section="fixtures"] { border-bottom: none; }
    .left-section-head {
      display: flex; align-items: center; gap: 6px; width: 100%;
      padding: 8px 10px; border: none; background: transparent; color: var(--text);
      font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
      cursor: pointer; text-align: left; flex: 0 0 auto;
    }
    .left-section-head:hover { background: var(--hover); }
    .left-section-head .grow { flex: 1; }
    .left-section-head .count {
      font-size: 10px; font-weight: 600; color: var(--muted); text-transform: none; letter-spacing: 0;
      border: 1px solid var(--border); border-radius: 999px; padding: 1px 6px;
    }
    .left-section-body { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
    .project-tree { padding: 8px 6px 16px; font-size: 12px; }
    .project-node {
      display: flex; align-items: center; gap: 6px; padding: 5px 8px;
      border-radius: 6px; cursor: pointer; user-select: none;
    }
    .project-node:hover { background: var(--hover); }
    .project-node.active {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      outline: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    }
    .project-node .ico { width: 14px; opacity: .75; flex: 0 0 auto; }
    .project-node .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .project-node .badge {
      font-size: 10px; color: var(--accent-fg); background: var(--accent);
      border-radius: 4px; padding: 1px 5px; font-weight: 700;
    }
    .project-node .project-remove {
      border: none; background: transparent; color: var(--muted);
      cursor: pointer; font-size: 14px; line-height: 1; padding: 0 4px;
      border-radius: 4px;
    }
    .project-node .project-remove:hover {
      color: #ef4444; background: color-mix(in srgb, #ef4444 12%, transparent);
    }
    .project-children { margin-left: 12px; border-left: 1px solid var(--border); padding-left: 4px; }
    .project-empty { padding: 16px 12px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .panel.right {
      border-right: none; border-left: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .panel.right .panel-scroll { flex: 1; overflow: auto; min-height: 0; }
    .panel .frame-resize-x {
      position: absolute; top: 0; bottom: 0; width: 5px; cursor: ew-resize;
      z-index: 6; background: transparent;
    }
    .panel.left-rail .frame-resize-x { right: 0; left: auto; }
    .panel.right .frame-resize-x { left: 0; right: auto; }
    .panel .frame-resize-x:hover,
    .panel .frame-resize-x.dragging {
      background: color-mix(in srgb, var(--focus) 55%, transparent);
    }
    .panel .frame-resize-y {
      height: 6px; cursor: ns-resize; flex: 0 0 auto;
      background: transparent; border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      display: none;
    }
    .panel.floating .frame-resize-y { display: block; }
    .panel .frame-resize-y:hover,
    .panel .frame-resize-y.dragging {
      background: color-mix(in srgb, var(--focus) 45%, transparent);
    }
    .panel-chrome {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px 4px; flex: 0 0 auto;
      cursor: default; user-select: none;
    }
    .panel.floating .panel-chrome { cursor: grab; }
    .panel.floating .panel-chrome:active { cursor: grabbing; }
    .panel-chrome h2 { padding: 0; margin: 0; flex: 1; }
    .panel-chrome-actions { display: flex; gap: 4px; }
    .traffic {
      display: flex; align-items: center; gap: 6px; padding: 0 2px;
      flex: 0 0 auto;
    }
    .traffic .tl {
      width: 12px; height: 12px; border-radius: 50%; border: none;
      padding: 0; cursor: pointer; box-shadow: inset 0 0 0 0.5px rgba(0,0,0,.25);
      transition: transform .12s ease, filter .12s ease;
    }
    .traffic .tl:hover { transform: scale(1.08); filter: brightness(1.08); }
    .traffic .tl.min { background: #febc2e; }
    .traffic .tl.max { background: #28c840; }
    .panel.floating {
      position: fixed; z-index: 28;
      border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
      border-radius: var(--radius-frame);
      box-shadow: var(--shadow-frame);
      background: color-mix(in srgb, var(--panel) 94%, transparent);
      backdrop-filter: blur(18px) saturate(1.35);
      margin: 0 !important;
    }
    .panel.left-rail.floating {
      left: 16px; top: 60px;
      width: var(--left-width, 300px);
      height: var(--left-height, 70vh);
      max-height: calc(100vh - 96px);
    }
    .panel.right.floating {
      right: 16px; top: 60px;
      width: var(--props-width, 340px);
      height: var(--props-height, 70vh);
      max-height: calc(100vh - 96px);
    }
    .panel.collapsed-strip {
      overflow: hidden; padding: 0;
      display: flex; flex-direction: column; align-items: center;
      justify-content: flex-start; gap: 8px; padding-top: 10px;
      margin: 8px 4px; border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      background: color-mix(in srgb, var(--panel) 92%, transparent);
    }
    .panel.collapsed-strip > *:not(.collapsed-only) { display: none !important; }
    .collapsed-only { display: none; }
    .panel.collapsed-strip .collapsed-only { display: flex; flex-direction: column; gap: 6px; align-items: center; }
    .collapsed-only .btn { writing-mode: vertical-rl; padding: 10px 6px; }
    .panel h2 {
      margin: 0; padding: 14px 14px 8px; font-size: 11px; text-transform: uppercase;
      letter-spacing: .08em; color: var(--muted); font-weight: 700;
      display: flex; align-items: center; gap: 8px;
    }
    .panel h2 .grow { flex: 1; }
    .panel-tools { display: flex; gap: 4px; padding: 0 12px 8px; }
    .panel-tools .btn { padding: 4px 8px; font-size: 11px; }
    .search {
      margin: 0 12px 10px; width: calc(100% - 24px);
      background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px;
      padding: 8px 10px; font-size: 12px;
    }
    .cat { padding: 0 8px 8px; }
    .cat-title {
      font-size: 11px; color: var(--muted); padding: 6px 8px; font-weight: 700;
      display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 6px;
      user-select: none;
    }
    .cat-title:hover { background: var(--hover); color: var(--text); }
    .cat-title .chev { width: 12px; font-size: 10px; opacity: .8; }
    .cat.collapsed .cat-items { display: none; }
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
    .canvas-wrap {
      position: relative; overflow: auto; padding: 12px 16px calc(var(--dock-h) + 28px);
      mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 36px), transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 36px), transparent 100%);
    }
    .canvas-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-bottom: 10px; position: sticky; top: 0; z-index: 3;
      padding: 6px 0; background: color-mix(in srgb, var(--bg) 88%, transparent);
      backdrop-filter: blur(8px);
    }
    .canvas-help { color: var(--muted); font-size: 12px; flex: 1; min-width: 120px; }
    .workflow-search {
      width: 180px; max-width: 40vw;
      background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px;
      padding: 6px 10px; font-size: 12px;
    }
    .breadcrumbs {
      display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
      margin: 0 0 10px; font-size: 11px; color: var(--muted);
      min-height: 18px;
    }
    .breadcrumbs button {
      appearance: none; border: none; background: transparent; color: var(--muted);
      font: inherit; cursor: pointer; padding: 2px 4px; border-radius: 4px;
    }
    .breadcrumbs button:hover { color: var(--text); background: var(--hover); }
    .breadcrumbs .crumb-sep { opacity: .45; }
    .breadcrumbs .crumb-current { color: var(--text); font-weight: 650; }
    .expr-overlay {
      position: fixed; inset: 0; z-index: 50; display: none;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,.45); backdrop-filter: blur(4px);
    }
    .expr-overlay.show { display: flex; }
    .settings-overlay {
      position: fixed; inset: 0; z-index: 55; display: none;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,.45); backdrop-filter: blur(4px);
    }
    .settings-overlay.show { display: flex; }
    .settings-dialog {
      width: min(440px, 92vw); max-height: 84vh;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 14px; box-shadow: var(--shadow-frame);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .settings-dialog-head {
      display: flex; align-items: center; gap: 8px; padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }
    .settings-dialog-head .title { flex: 1; font-weight: 700; font-size: 13px; }
    .settings-dialog-body {
      overflow: auto; padding: 12px 14px 16px;
    }
    .settings-section { margin-bottom: 16px; }
    .settings-section h3 {
      margin: 0 0 8px; font-size: 11px; letter-spacing: .04em;
      text-transform: uppercase; color: var(--muted); font-weight: 700;
    }
    .settings-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 0; border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
    }
    .settings-row:last-child { border-bottom: none; }
    .settings-row .label { flex: 1; min-width: 0; }
    .settings-row .label .name { display: block; font-size: 12px; font-weight: 600; }
    .settings-row .label .hint { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; line-height: 1.35; }
    .settings-row select {
      background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px;
      padding: 6px 8px; font-size: 12px; min-width: 130px;
    }
    .settings-dialog-foot {
      display: flex; gap: 8px; justify-content: flex-end; padding: 10px 14px;
      border-top: 1px solid var(--border);
    }
    .assist-help-dialog {
      width: min(520px, 94vw); max-height: 86vh;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 14px; box-shadow: var(--shadow-frame);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .assist-help-body { overflow: auto; padding: 12px 16px 18px; font-size: 12px; line-height: 1.45; }
    .assist-help-body p { margin: 0 0 10px; color: var(--text); }
    .assist-help-body .lead { color: var(--muted); margin-bottom: 14px; }
    .assist-help-body h3 {
      margin: 14px 0 6px; font-size: 11px; letter-spacing: .04em;
      text-transform: uppercase; color: var(--muted); font-weight: 700;
    }
    .assist-help-body h3:first-child { margin-top: 0; }
    .assist-help-body .cmd {
      display: block; font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
      font-size: 11.5px; padding: 6px 8px; margin: 4px 0 8px;
      background: var(--input-bg); border: 1px solid var(--input-border);
      border-radius: 8px; word-break: break-word;
    }
    .assist-help-body ul { margin: 0 0 10px; padding-left: 18px; }
    .assist-help-body li { margin: 4px 0; }
    .assist-help-body kbd {
      font-family: inherit; font-size: 11px; padding: 1px 5px;
      border: 1px solid var(--border); border-radius: 4px;
      background: color-mix(in srgb, var(--input-bg) 80%, transparent);
    }
    .btn.symbol.active-assist {
      outline: 1px solid color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent);
      background: color-mix(in srgb, var(--accent, #3b82f6) 18%, transparent);
    }
    .app.hide-steps .step { display: none; }
    .sequence.canvas-dots, .flow-stage.canvas-dots {
      background-color: var(--board);
      background-image: radial-gradient(circle, color-mix(in srgb, var(--muted) 40%, transparent) 1px, transparent 1px);
      background-size: 14px 14px;
    }
    .expr-dialog {
      width: min(640px, 92vw); max-height: 80vh;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 14px; box-shadow: var(--shadow-frame);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .expr-dialog-head {
      display: flex; align-items: center; gap: 8px; padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }
    .expr-dialog-head .title { flex: 1; font-weight: 700; font-size: 13px; }
    .expr-dialog textarea {
      width: 100%; min-height: 220px; border: none; resize: vertical;
      background: var(--input-bg); color: var(--text); padding: 14px;
      font-family: var(--mono); font-size: 13px; line-height: 1.45;
    }
    .expr-dialog-foot {
      display: flex; gap: 8px; justify-content: flex-end; padding: 10px 14px;
      border-top: 1px solid var(--border);
    }
    .field-with-expand { display: flex; gap: 6px; align-items: flex-start; }
    .field-with-expand > :first-child { flex: 1; min-width: 0; }
    .btn-expand-expr {
      flex: 0 0 auto; width: 28px; height: 32px; padding: 0;
      border-radius: 8px; border: 1px solid var(--border);
      background: var(--input-bg); color: var(--muted); cursor: pointer; font-size: 12px;
    }
    .btn-expand-expr:hover { color: var(--text); border-color: var(--focus); }
    .card.search-hit, .flow-node.search-hit {
      animation: search-flash .9s ease;
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    @keyframes search-flash {
      0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); }
      70% { box-shadow: 0 0 0 10px transparent; }
      100% { box-shadow: none; }
    }
    .zoom-tools { display: none; }
    .zoom-label {
      min-width: 40px; text-align: center; font-size: 11px; font-family: var(--mono); color: var(--muted);
    }
    .maestro-dock {
      position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%);
      z-index: 40; display: flex; align-items: center; gap: 2px;
      padding: 7px 9px;
      border-radius: 22px;
      background: color-mix(in srgb, var(--panel) 82%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
      box-shadow: 0 10px 36px rgba(0,0,0,.32), inset 0 1px 0 color-mix(in srgb, var(--text) 8%, transparent);
      backdrop-filter: blur(18px) saturate(1.45);
      animation: dock-in .35s ease both;
    }
    @keyframes dock-in {
      from { opacity: 0; transform: translateX(-50%) translateY(12px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .maestro-dock .dock-btn {
      appearance: none; border: none; background: transparent; color: var(--text);
      width: 36px; height: 36px; border-radius: 12px; cursor: pointer;
      font-size: 13px; font-weight: 650; display: inline-flex; align-items: center; justify-content: center;
      transition: background .12s ease, transform .12s ease;
    }
    .maestro-dock .dock-btn:hover {
      background: color-mix(in srgb, var(--hover) 90%, var(--accent) 10%);
      transform: translateY(-2px);
    }
    .maestro-dock .dock-btn.active {
      background: color-mix(in srgb, var(--accent) 28%, transparent);
      color: var(--text);
    }
    .maestro-dock .dock-btn.primary {
      background: color-mix(in srgb, var(--accent) 85%, transparent);
      color: var(--accent-fg);
    }
    .maestro-dock .dock-btn.primary:hover { filter: brightness(1.06); }
    .maestro-dock .dock-sep {
      width: 1px; height: 22px; margin: 0 5px;
      background: color-mix(in srgb, var(--border) 90%, transparent);
    }
    .maestro-dock .dock-zoom {
      display: inline-flex; align-items: center; gap: 0;
      padding: 0 2px; border-radius: 12px;
      background: color-mix(in srgb, var(--bg) 35%, transparent);
    }
    .maestro-dock .dock-zoom .zoom-label { min-width: 38px; font-size: 10px; }
    .panel-tools .btn.symbol,
    .panel-chrome-actions .btn.symbol {
      min-width: 28px; padding: 4px 7px; font-size: 12px; line-height: 1;
      letter-spacing: -0.04em;
    }
    .canvas-zoom {
      transform-origin: 0 0;
      transition: transform .12s ease;
      width: max-content; min-width: 100%;
    }
    .sequence {
      max-width: 680px; margin: 0 auto;
      background: var(--board);
      border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      border-radius: 12px;
      padding: 18px 22px 28px;
      box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent);
    }
    .canvas-empty {
      text-align: center; padding: 48px 24px; color: var(--muted);
      border: 1px dashed color-mix(in srgb, var(--muted) 45%, transparent);
      border-radius: 12px; background: color-mix(in srgb, var(--board) 80%, transparent);
    }
    .canvas-empty h3 { margin: 0 0 8px; color: var(--text); font-size: 15px; font-weight: 650; }
    .canvas-empty p { margin: 0; font-size: 12px; line-height: 1.5; }
    .drop-zone {
      position: relative; height: 18px; margin: 2px 0;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    }
    .drop-zone::before {
      content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 2px;
      background: var(--spine); transform: translateX(-50%); pointer-events: none;
      opacity: .35;
    }
    .drop-zone::after {
      content: '+'; position: relative; z-index: 1;
      width: 22px; height: 22px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; line-height: 1;
      color: transparent; background: transparent;
      border: 1px solid transparent;
      transition: .12s ease;
    }
    .drop-zone:hover::after, .drop-zone.active::after {
      color: var(--accent-fg, #fff);
      background: var(--accent);
      border-color: var(--accent);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 35%, transparent);
    }
    .drop-zone.active {
      height: 28px;
    }
    .ctx-menu {
      position: fixed; z-index: 80; min-width: 160px;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 10px; box-shadow: var(--shadow-frame);
      padding: 4px; display: none;
    }
    .ctx-menu.show { display: block; }
    .ctx-menu button {
      display: block; width: 100%; text-align: left;
      border: none; background: transparent; color: var(--text);
      padding: 8px 10px; border-radius: 6px; font: inherit; cursor: pointer;
    }
    .ctx-menu button:hover { background: var(--hover); }
    .ctx-menu button.danger { color: #ef4444; }
    .card.has-bp { outline: none; }
    .card.has-bp .card-bp.on { /* already styled */ }
    .card {
      position: relative; background: var(--card);
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: var(--radius); box-shadow: var(--shadow-sm);
      padding: 10px 12px 10px 14px; cursor: pointer;
      transition: border-color .14s ease, background .14s ease, box-shadow .14s ease, transform .14s ease;
      animation: rise .22s ease both;
    }
    .card:hover {
      border-color: color-mix(in srgb, var(--focus) 40%, var(--border));
      background: color-mix(in srgb, var(--card) 92%, var(--hover));
      transform: translateY(-1px);
    }
    .card.selected {
      border-color: var(--focus);
      box-shadow: inset 3px 0 0 var(--focus), 0 0 0 1px color-mix(in srgb, var(--focus) 35%, transparent), var(--shadow-sm);
      background: color-mix(in srgb, var(--card) 88%, var(--focus) 12%);
    }
    .card-accent { position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 0 2px 2px 0; }
    .card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; padding-right: 56px; }
    .step { font-size: 10px; color: var(--muted); font-family: var(--mono); min-width: 26px; opacity: .75; }
    .card-title { font-size: 13px; font-weight: 650; }
    .card-summary {
      font-size: 11px; color: var(--muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .card-summary.mono { font-family: var(--mono); }
    .card-bp {
      width: 14px; height: 14px; border-radius: 50%;
      border: 1.5px solid color-mix(in srgb, #ef4444 55%, var(--border));
      background: transparent; cursor: pointer; padding: 0; flex: 0 0 auto;
    }
    .card-bp:hover { border-color: #ef4444; }
    .card-bp.on, .flow-node .card-bp.on {
      background: #ef4444; border-color: #ef4444;
      box-shadow: 0 0 0 2px color-mix(in srgb, #ef4444 25%, transparent);
    }
    .flow-node .card-bp {
      position: absolute; right: 8px; top: 8px; z-index: 3;
    }
    .card-actions .card-bp { display: inline-block; }
    .kind-badge {
      display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: .04em;
      text-transform: uppercase; padding: 1px 5px; border-radius: 4px; margin-left: 6px;
      vertical-align: middle;
    }
    .kind-badge.real { color: #15803d; background: color-mix(in srgb, #22c55e 18%, transparent); }
    .kind-badge.simulated { color: #a16207; background: color-mix(in srgb, #f59e0b 18%, transparent); }
    .kind-badge.unsupported { color: #b91c1c; background: color-mix(in srgb, #ef4444 16%, transparent); }
    .watch-panel { padding: 0 10px 12px; font-size: 12px; }
    .watch-panel .watch-row {
      display: grid; grid-template-columns: 1fr 1.2fr; gap: 6px; margin-bottom: 6px; align-items: center;
    }
    .watch-panel label { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; }
    .watch-panel input { font-family: var(--mono); font-size: 11px; }
    .fixtures-editor {
      width: 100%; min-height: 120px; font-family: var(--mono); font-size: 11px;
      background: var(--input-bg); color: var(--text); border: 1px solid var(--input-border);
      border-radius: 8px; padding: 8px; resize: vertical;
    }
    .pb-kind { opacity: .85; font-size: 10px; margin-left: 6px; }
    .card.has-bp { outline: 1px dashed color-mix(in srgb, #ef4444 45%, transparent); }
    .card-warn {
      margin-top: 6px; font-size: 10px; font-weight: 600; color: #d97706;
      letter-spacing: .02em;
    }
    .card-warn.weak { color: #ca8a04; }
    .card-actions {
      position: absolute; right: 6px; top: 6px; display: flex; gap: 3px; align-items: center;
      z-index: 3;
    }
    .card-actions .icon-btn { display: none; }
    .card:hover .card-actions .icon-btn, .card.selected .card-actions .icon-btn { display: inline-flex; align-items: center; justify-content: center; }
    .card-actions .card-bp { display: inline-block; }
    .icon-btn {
      width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--input-bg); color: var(--text); cursor: pointer; font-size: 12px;
    }
    .connector {
      width: 2px; height: 14px; background: var(--spine); margin: 0 auto;
    }
    .children, .else-children {
      margin: 8px 0 0 10px; padding: 8px 0 8px 14px;
      border-left: 2px solid color-mix(in srgb, var(--focus) 35%, var(--muted));
      background: color-mix(in srgb, var(--board) 70%, transparent);
      border-radius: 0 8px 8px 0;
    }
    .branch-label {
      display: inline-block; font-size: 10px; font-weight: 700; color: var(--muted);
      letter-spacing: .06em; text-transform: uppercase; margin: 2px 0 6px;
      padding: 2px 7px; border-radius: 999px;
      background: color-mix(in srgb, var(--muted) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    }
    .flow-stage {
      position: relative; min-width: 900px; min-height: 720px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 12px;
      background-color: var(--board);
      background-image: radial-gradient(circle, color-mix(in srgb, var(--muted) 22%, transparent) 1px, transparent 1.5px);
      background-size: 22px 22px;
    }
    .flow-stage.drop-target {
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--focus) 55%, transparent);
    }
    .flow-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    .flow-svg path { fill: none; stroke: color-mix(in srgb, var(--muted) 75%, var(--text)); stroke-width: 1.75; marker-end: url(#arrow); }
    .flow-svg text { fill: var(--muted); font-size: 11px; font-weight: 700; }
    .flow-node {
      position: absolute; width: 180px; min-height: 64px;
      background: var(--card); border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: 10px; box-shadow: var(--shadow-sm); padding: 10px 12px 12px;
      cursor: grab; user-select: none;
      transition: border-color .12s ease, box-shadow .12s ease, background .12s ease;
    }
    .flow-node:hover {
      border-color: color-mix(in srgb, var(--focus) 40%, var(--border));
      z-index: 2;
    }
    .flow-node.selected {
      border-color: var(--focus);
      box-shadow: inset 3px 0 0 var(--focus), var(--shadow-sm);
      z-index: 3;
    }
    .flow-node.decision {
      width: 170px; height: 170px; border-radius: 16px;
      transform: rotate(45deg); display: flex; align-items: center; justify-content: center;
      padding: 0;
    }
    .flow-node.decision .inner { transform: rotate(-45deg); width: 120px; text-align: center; }
    .flow-node.start, .flow-node.end {
      width: 120px; border-radius: 999px; text-align: center; min-height: 48px;
      display: flex; align-items: center; justify-content: center;
      border-width: 2px;
    }
    .flow-node.start { border-color: color-mix(in srgb, #22c55e 55%, var(--border)); }
    .flow-node.end { border-color: color-mix(in srgb, #ef4444 45%, var(--border)); }
    .flow-node .title { font-size: 12px; font-weight: 650; }
    .flow-node .summary { font-size: 10px; color: var(--muted); margin-top: 4px; }
    .port {
      position: absolute; width: 11px; height: 11px; border-radius: 50%;
      background: color-mix(in srgb, var(--accent) 85%, var(--text));
      border: 2px solid var(--bg); right: -6px; top: 50%;
      transform: translateY(-50%); cursor: crosshair; pointer-events: auto;
    }
    .flow-node.decision .port { right: -8px; }
    .selector-warn {
      margin: 6px 0 0; font-size: 11px; color: #d97706;
      line-height: 1.35;
    }
    .selector-warn.ok { color: color-mix(in srgb, #16a34a 80%, var(--muted)); }
    .selector-warn.weak { color: #ca8a04; }
    .sb-score {
      display: flex; align-items: center; gap: 8px; margin: 8px 0 4px;
      font-size: 11px;
    }
    .sb-score .sb-meter {
      flex: 1; height: 6px; border-radius: 999px;
      background: color-mix(in srgb, var(--muted) 22%, transparent);
      overflow: hidden;
    }
    .sb-score .sb-meter > span {
      display: block; height: 100%; border-radius: 999px;
      background: #d97706; transition: width .15s ease;
    }
    .sb-score.ok .sb-meter > span { background: #16a34a; }
    .sb-score.strong .sb-meter > span { background: #15803d; }
    .sb-score.weak .sb-meter > span { background: #ca8a04; }
    .sb-score.empty .sb-meter > span,
    .sb-score.placeholder .sb-meter > span { background: #ea580c; }
    .sb-score-label { font-weight: 700; min-width: 72px; }
    .sb-hints { margin: 0 0 6px; padding-left: 16px; font-size: 10px; color: var(--muted); }
    .sb-hints li { margin: 2px 0; }
    .sb-actions { display: flex; gap: 6px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
    .sb-hint { font-size: 10px; color: var(--muted); flex: 1; min-width: 120px; }
    .sb-paste-row { display: flex; gap: 6px; margin-top: 8px; align-items: stretch; }
    .sb-paste-row textarea {
      flex: 1; min-height: 52px; font-family: var(--mono); font-size: 11px;
      background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px; padding: 6px 8px;
      resize: vertical;
    }
    .studio-web-check {
      display: flex; flex-direction: column; gap: 6px;
    }
    .studio-web-check .swc-row {
      display: flex; gap: 8px; align-items: flex-start;
      font-size: 11px; line-height: 1.35;
      padding: 6px 8px; border-radius: 8px;
      background: color-mix(in srgb, var(--bg) 70%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    }
    .studio-web-check .swc-row.ok {
      border-color: color-mix(in srgb, #16a34a 35%, var(--border));
    }
    .studio-web-check .swc-row.bad {
      border-color: color-mix(in srgb, #d97706 45%, var(--border));
    }
    .studio-web-check .swc-mark {
      flex: 0 0 auto; font-weight: 700; min-width: 14px;
    }
    .studio-web-check .swc-row.ok .swc-mark { color: #16a34a; }
    .studio-web-check .swc-row.bad .swc-mark { color: #d97706; }
    .studio-web-check .swc-text { flex: 1; min-width: 0; }
    .studio-web-check .swc-summary {
      font-size: 11px; color: var(--muted); margin: 0 0 4px;
    }
    .modern-sel {
      margin: 0 0 12px; padding: 8px 10px; border-radius: 8px;
      border: 1px dashed color-mix(in srgb, var(--border) 85%, transparent);
      background: color-mix(in srgb, var(--bg) 55%, transparent);
    }
    .modern-sel > summary {
      cursor: pointer; font-size: 11px; font-weight: 650; color: var(--muted);
      list-style: none; user-select: none;
    }
    .modern-sel > summary::-webkit-details-marker { display: none; }
    .modern-sel[open] > summary { margin-bottom: 8px; color: var(--text); }
    .modern-sel .field { margin-bottom: 0; }
    .props { padding: 0 14px 12px; }
    .props .empty { color: var(--muted); font-size: 12px; line-height: 1.5; padding: 8px 0; }
    .prop-section {
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: 10px; margin-bottom: 10px; overflow: hidden;
      background: color-mix(in srgb, var(--panel) 70%, transparent);
    }
    .prop-section-head {
      display: flex; align-items: center; gap: 6px; width: 100%;
      padding: 8px 10px; border: none; background: transparent; color: var(--text);
      font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
      cursor: pointer; text-align: left;
    }
    .prop-section-head:hover { background: var(--hover); }
    .prop-section-body { padding: 4px 10px 10px; }
    .prop-section.collapsed .prop-section-body { display: none; }
    .side-section {
      margin: 0 10px 10px; border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: 10px; overflow: hidden;
      background: color-mix(in srgb, var(--panel) 70%, transparent);
    }
    .side-section-head {
      display: flex; align-items: center; gap: 6px; width: 100%;
      padding: 8px 10px; border: none; background: transparent; color: var(--text);
      font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
      cursor: pointer; text-align: left;
    }
    .side-section-head:hover { background: var(--hover); }
    .side-section-head .grow { flex: 1; }
    .side-section-head .count {
      font-size: 10px; font-weight: 600; color: var(--muted);
      min-width: 18px; text-align: center;
      border: 1px solid var(--border); border-radius: 999px; padding: 1px 6px;
    }
    .side-section-body { padding: 0 10px 4px; }
    .side-section.collapsed .side-section-body { display: none; }
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; font-weight: 600; }
    .field input, .field select, .field textarea {
      width: 100%; background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px;
      padding: 8px 10px; font-size: 12px; font-family: var(--mono);
    }
    .field textarea { min-height: 84px; resize: vertical; }
    .selector-builder {
      margin-top: 8px; padding: 10px; border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      background: color-mix(in srgb, var(--bg) 70%, transparent);
    }
    .selector-builder .sb-title {
      font-size: 11px; font-weight: 700; letter-spacing: .04em;
      text-transform: uppercase; color: var(--muted); margin-bottom: 8px;
    }
    .selector-builder .sb-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;
    }
    .selector-builder .sb-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .selector-builder .sb-preview {
      margin: 0; padding: 8px 10px; border-radius: 6px; font-size: 11px;
      font-family: var(--mono); white-space: pre-wrap; word-break: break-all;
      background: var(--input-bg); border: 1px solid var(--input-border);
      color: var(--muted); max-height: 96px; overflow: auto;
    }
    .selector-builder .field { margin-bottom: 0; }
    .hover-tip {
      position: fixed; z-index: 20; max-width: 280px; pointer-events: none;
      background: var(--panel); color: var(--text); border: 1px solid var(--border);
      border-radius: 8px; padding: 8px 10px; font-size: 11px; line-height: 1.4;
      box-shadow: var(--shadow); opacity: 0; transform: translateY(4px);
      transition: opacity .12s ease, transform .12s ease;
    }
    .hover-tip.show { opacity: 1; transform: translateY(0); }
    .hover-tip .tip-title { font-weight: 700; margin-bottom: 2px; }
    .hover-tip .tip-meta { color: var(--muted); font-family: var(--mono); word-break: break-all; }
    .toast {
      position: absolute; right: 18px; bottom: 18px;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 12px; font-size: 12px;
      box-shadow: var(--shadow); opacity: 0; pointer-events: none;
      transform: translateY(8px); transition: .2s ease; z-index: 5;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    .card.dry-run-done, .flow-node.dry-run-done {
      outline: 1px solid color-mix(in srgb, #22c55e 55%, transparent);
    }
    .card.dry-run-active, .flow-node.dry-run-active {
      outline: 2px solid #0ea5e9;
      box-shadow: 0 0 0 3px color-mix(in srgb, #0ea5e9 28%, transparent), var(--shadow);
      animation: pulse-step .9s ease infinite alternate;
    }
    .card.dry-run-warn, .flow-node.dry-run-warn { outline-color: #f59e0b; }
    .card.dry-run-error, .flow-node.dry-run-error { outline-color: #ef4444; }
    @keyframes pulse-step {
      from { transform: translateY(0); }
      to { transform: translateY(-2px); }
    }
    .playback-bar {
      display: none; align-items: center; gap: 8px; flex-wrap: wrap;
      margin: 0 0 10px; padding: 8px 10px; border-radius: 10px;
      border: 1px solid color-mix(in srgb, #0ea5e9 45%, var(--border));
      background: color-mix(in srgb, #0ea5e9 12%, var(--panel));
    }
    .playback-bar.show { display: flex; }
    .playback-bar .pb-label {
      font-size: 12px; font-weight: 600; flex: 1; min-width: 160px;
      font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .playback-bar .pb-vars {
      width: 100%; font-size: 11px; color: var(--muted); font-family: var(--mono);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .palette-overlay {
      display: none; position: fixed; inset: 0; z-index: 40;
      background: rgba(0,0,0,.35); align-items: flex-start; justify-content: center;
      padding-top: 12vh;
    }
    .palette-overlay.show { display: flex; }
    .palette {
      width: min(560px, 92vw); max-height: 70vh; display: flex; flex-direction: column;
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      box-shadow: var(--shadow); overflow: hidden; animation: rise .16s ease both;
    }
    .palette-head { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .palette-head input {
      width: 100%; background: var(--input-bg); color: var(--text);
      border: 1px solid var(--input-border); border-radius: 8px;
      padding: 10px 12px; font-size: 13px; font-family: var(--sans);
    }
    .palette-hint { font-size: 11px; color: var(--muted); margin-top: 6px; }
    .palette-list { overflow: auto; padding: 6px; }
    .palette-section {
      font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      color: var(--muted); padding: 8px 8px 4px;
    }
    .palette-item {
      display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center;
      width: 100%; text-align: left; border: 1px solid transparent; border-radius: 8px;
      background: transparent; color: var(--text); padding: 8px 10px; cursor: pointer;
    }
    .palette-item:hover, .palette-item.active {
      background: var(--hover); border-color: color-mix(in srgb, var(--focus) 40%, transparent);
    }
    .palette-item .pi-name { font-size: 13px; font-weight: 600; }
    .palette-item .pi-meta { font-size: 11px; color: var(--muted); font-family: var(--mono); }
    .palette-item .pi-pin {
      border: 1px solid var(--border); background: var(--input-bg); color: var(--muted);
      border-radius: 6px; width: 28px; height: 28px; cursor: pointer;
    }
    .palette-item .pi-pin.on { color: #f59e0b; border-color: #f59e0b; }
    .suggest-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .suggest-chips button {
      border: 1px solid var(--border); background: var(--input-bg); color: var(--muted);
      border-radius: 999px; padding: 2px 8px; font-size: 10px; cursor: pointer;
      font-family: var(--mono); max-width: 100%; overflow: hidden; text-overflow: ellipsis;
    }
    .suggest-chips button:hover { color: var(--text); border-color: var(--focus); }
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
      <button class="btn" id="btnAutoLayout" style="display:none" title="Tidy flowchart layout">Tidy</button>
      <button class="btn symbol" id="btnAssistHelp" type="button" title="Assist (AI) — how to use" aria-expanded="false">✦</button>
      <button class="btn symbol" id="btnSettings" type="button" title="Settings">⚙</button>
      <button class="btn primary" id="btnSave">Save</button>
    </div>

    <aside class="panel left-rail frame-docked" id="toolbox">
      <div class="frame-resize-x" id="leftResizeX" title="Drag to resize width"></div>
      <div class="panel-chrome" id="leftChrome">
        <div class="traffic" aria-label="Left frame controls">
          <button class="tl min" id="btnLeftFloat" type="button" title="Float frame"></button>
          <button class="tl max" id="btnLeftDock" type="button" title="Dock frame"></button>
        </div>
        <h2><span class="grow">Workspace</span></h2>
      </div>
      <div class="left-stack" id="leftStack">
        <section class="left-section" data-section="project">
          <button type="button" class="left-section-head" data-toggle-section="project">
            <span class="chev">▾</span><span class="grow">Explorer</span>
          </button>
          <div class="left-section-body">
            <div class="project-tree" id="projectTree"></div>
          </div>
        </section>
        <section class="left-section" data-section="activities">
          <button type="button" class="left-section-head" data-toggle-section="activities">
            <span class="chev">▾</span><span class="grow">Activities</span>
          </button>
          <div class="left-section-body">
            <div class="panel-tools">
              <button class="btn symbol" id="btnExpandCats" type="button" title="Expand all categories">▾▾</button>
              <button class="btn symbol" id="btnCollapseCats" type="button" title="Collapse all categories">▸▸</button>
            </div>
            <input class="search" id="search" placeholder="Search activities..." />
            <div id="catalog"></div>
          </div>
        </section>
        <section class="left-section" data-section="variables">
          <button type="button" class="left-section-head" data-toggle-section="variables">
            <span class="chev">▾</span><span class="grow">Variables</span>
            <span class="count" id="variablesCount">0</span>
          </button>
          <div class="left-section-body">
            <div class="props" id="variablesView" style="padding:0 10px;"></div>
            <div style="padding:0 12px 12px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn" id="btnAddVar">Add Variable</button>
            </div>
          </div>
        </section>
        <section class="left-section" data-section="arguments">
          <button type="button" class="left-section-head" data-toggle-section="arguments">
            <span class="chev">▾</span><span class="grow">Arguments</span>
            <span class="count" id="argumentsCount">0</span>
          </button>
          <div class="left-section-body">
            <div class="props" id="argumentsView" style="padding:0 10px;"></div>
            <div style="padding:0 12px 12px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn" id="btnAddArg">Add Argument</button>
            </div>
          </div>
        </section>
        <section class="left-section collapsed" data-section="watch">
          <button type="button" class="left-section-head" data-toggle-section="watch">
            <span class="chev">▸</span><span class="grow">Watch</span>
            <span class="count" id="watchCount">0</span>
          </button>
          <div class="left-section-body">
            <div class="watch-panel" id="watchView"><div class="empty">Run Step-through to watch variables.</div></div>
            <div style="padding:0 12px 12px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn" id="btnWatchApply" type="button" title="Re-run dry-run using edited watch values as seeds">Re-run with watch</button>
            </div>
          </div>
        </section>
        <section class="left-section collapsed" data-section="fixtures">
          <button type="button" class="left-section-head" data-toggle-section="fixtures">
            <span class="chev">▸</span><span class="grow">Fixtures</span>
          </button>
          <div class="left-section-body">
            <div style="padding:0 10px 8px;color:var(--muted);font-size:11px;line-height:1.4;">
              Session fixtures for dry-run (HTTP, UI text, tables, queue, assets). JSON object.
            </div>
            <div style="padding:0 10px;">
              <textarea class="fixtures-editor" id="fixturesEditor" spellcheck="false" placeholder='{
  "http": { "api.example.com": { "status": 200, "body": {} } },
  "assets": { "AppUrl": "https://..." }
}'></textarea>
            </div>
            <div style="padding:8px 12px 12px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn" id="btnFixturesApply" type="button">Apply fixtures</button>
              <button class="btn" id="btnFixturesClear" type="button">Clear</button>
            </div>
          </div>
        </section>
      </div>
      <div class="frame-resize-y" id="leftResizeY" title="Drag to resize height (float mode)"></div>
      <div class="collapsed-only">
        <button class="btn" id="btnLeftExpand" type="button" title="Expand workspace">Workspace</button>
      </div>
    </aside>

    <main class="canvas-wrap" id="canvasWrap">
      <div class="playback-bar" id="playbackBar">
        <span class="pb-label" id="playbackLabel">Step-through</span>
        <button class="btn" id="btnPbStep" type="button" title="Next step (stops at breakpoints)">Step</button>
        <button class="btn primary" id="btnPbContinue" type="button" title="Continue until breakpoint or end">Continue</button>
        <button class="btn" id="btnPbStop" type="button">Stop</button>
        <button class="btn" id="btnPbRunTo" type="button" title="Run step-through until the selected activity">Run to here</button>
        <div class="pb-vars" id="playbackVars"></div>
      </div>
      <div class="canvas-bar">
        <div class="canvas-help" id="canvasHelp"></div>
        <input class="workflow-search" id="workflowSearch" placeholder="Find in workflow…" title="Search activities in this workflow" />
        <div class="zoom-tools">
          <button class="btn" id="btnZoomOutLegacy" type="button" title="Zoom out">−</button>
          <span class="zoom-label" id="zoomLabelLegacy">100%</span>
          <button class="btn" id="btnZoomInLegacy" type="button" title="Zoom in">+</button>
          <button class="btn" id="btnZoomResetLegacy" type="button" title="Reset zoom">100%</button>
        </div>
      </div>
      <div class="breadcrumbs" id="breadcrumbs"></div>
      <div class="canvas-zoom" id="canvasZoom">
        <div class="sequence" id="sequence"></div>
        <div class="flow-stage" id="flowStage" style="display:none"></div>
      </div>
      <div class="toast" id="toast"></div>
      <div class="hover-tip" id="hoverTip"></div>
      <div class="ctx-menu" id="ctxMenu" role="menu">
        <button type="button" data-ctx="insert-before">Insert activity above</button>
        <button type="button" data-ctx="insert-after">Insert activity below</button>
        <button type="button" data-ctx="bp">Toggle breakpoint</button>
        <button type="button" data-ctx="runto">Run to here</button>
        <button type="button" data-ctx="dup">Duplicate</button>
        <button type="button" class="danger" data-ctx="delete">Delete</button>
      </div>
    </main>

    <div class="expr-overlay" id="exprOverlay">
      <div class="expr-dialog" role="dialog" aria-label="Expression editor">
        <div class="expr-dialog-head">
          <div class="title" id="exprDialogTitle">Expression</div>
          <button class="btn" type="button" id="exprDialogCancel">Close</button>
        </div>
        <textarea id="exprDialogValue" spellcheck="false"></textarea>
        <div class="expr-dialog-foot">
          <button class="btn" type="button" id="exprDialogDismiss">Cancel</button>
          <button class="btn primary" type="button" id="exprDialogApply">Apply</button>
        </div>
      </div>
    </div>

    <div class="settings-overlay" id="assistHelpOverlay">
      <div class="assist-help-dialog" role="dialog" aria-label="Assist help" aria-modal="true">
        <div class="settings-dialog-head">
          <div class="title">Assist — how to use</div>
          <button class="btn" type="button" id="assistHelpClose">Close</button>
        </div>
        <div class="assist-help-body">
          <p class="lead">
            Assist helpers are <strong>deterministic</strong> (no chat LLM). They run from the
            Command Palette or Project Explorer and write results to the
            <strong>LowCode Studio</strong> Output channel.
          </p>

          <h3>Where to run commands</h3>
          <ul>
            <li>Command Palette → type <strong>LowCode Studio</strong> (or <kbd>⌘/Ctrl+Shift+P</kbd>)</li>
            <li>Editor title bar on a <code>.lcs.json</code> file (Explain)</li>
            <li>Project Explorer toolbar / title actions</li>
            <li><strong>Manage Scenarios</strong> → <em>Generate from description…</em></li>
          </ul>

          <h3>Explain / critique workflow (F0)</h3>
          <span class="cmd">LowCode Studio: Explain / critique workflow (Assist)</span>
          <p>
            Open the workflow in the designer (or select its <code>.lcs.json</code>), run the command.
            Output shows structure, package/selector critique, and why Studio Web may reject a Save.
            Read-only — it does not change the workflow.
          </p>

          <h3>Generate scenarios (F1)</h3>
          <span class="cmd">LowCode Studio: Generate scenarios from description (Assist)</span>
          <p>
            Or: <strong>Manage Scenarios</strong> → <em>Generate from description…</em>.
            Type a short process description in the input box, for example:
          </p>
          <span class="cmd">REFramework queue with HTTP API and login UI</span>
          <p>
            Keywords map to templates (<code>queue</code>, <code>http</code>, <code>login</code>,
            <code>excel</code>, <code>fail</code>, …) and are saved to
            <code>Data/Test/scenarios.json</code>. Then run with <kbd>Shift+F5</kbd> or Dry Run Scenarios.
          </p>

          <h3>Suggest / repair selectors (F3)</h3>
          <span class="cmd">LowCode Studio: Suggest / repair selectors (Assist)</span>
          <p>Two modes (propose first — nothing is applied until you confirm):</p>
          <ul>
            <li><strong>From HTML / Explorer paste</strong> — paste a DOM snippet, <code>#id</code>, or UI Explorer dump; copy the best classic <code>&lt;html&gt;/&lt;webctrl&gt;</code> into Selector Builder</li>
            <li><strong>Repair weak selectors</strong> — scans the open workflow for empty / placeholder / weak UI steps; apply all or pick which proposals to write</li>
          </ul>
          <span class="cmd">&lt;button id="loginBtn" aria-label="Sign in"&gt;Sign in&lt;/button&gt;</span>

          <h3>Repair VB expressions (F4)</h3>
          <span class="cmd">LowCode Studio: Repair VB expressions (Assist)</span>
          <p>
            Scans expression fields for UiPath Visual Basic typos / JS-style calls and proposes fixes
            (confirm before apply). Examples:
          </p>
          <ul>
            <li><code>TRim(name)</code> → <code>name.Trim()</code></li>
            <li><code>name.toUpperCase()</code> → <code>name.ToUpper()</code></li>
            <li><code>x == null</code> → <code>x Is Nothing</code> · <code>&amp;&amp;</code> → <code>AndAlso</code></li>
            <li><code>Len(s)</code> → <code>s.Length</code> · <code>Left(s, 3)</code> → <code>s.Substring(0, 3)</code></li>
          </ul>

          <h3>Related dry-run settings (not Assist)</h3>
          <p>
            Optional real HTTP / Python live under Settings → VS Code
            <code>lowcodeStudio.dryRun.*</code> (allow-listed hosts; fixtures always win).
          </p>

          <h3>Tips</h3>
          <ul>
            <li>Always check <strong>View → Output → LowCode Studio</strong> after Assist commands</li>
            <li>Explain works best with the active project open (package pins + Invoke paths)</li>
            <li>Scenario names starting with <code>assist-</code> are safe to edit or delete in <code>scenarios.json</code></li>
          </ul>
        </div>
        <div class="settings-dialog-foot">
          <button class="btn primary" type="button" id="assistHelpDone">Got it</button>
        </div>
      </div>
    </div>

    <div class="settings-overlay" id="settingsOverlay">
      <div class="settings-dialog" role="dialog" aria-label="Settings">
        <div class="settings-dialog-head">
          <div class="title">Settings</div>
          <button class="btn" type="button" id="settingsDialogCancel">Close</button>
        </div>
        <div class="settings-dialog-body">
          <div class="settings-section">
            <h3>Canvas</h3>
            <div class="settings-row">
              <div class="label">
                <span class="name">Step numbers</span>
                <span class="hint">Show #1, #2… on sequence cards</span>
              </div>
              <input type="checkbox" id="set_showLineNumbers" />
            </div>
            <div class="settings-row">
              <div class="label">
                <span class="name">Canvas background</span>
                <span class="hint">Plain board or subtle dot grid</span>
              </div>
              <select id="set_canvasStyle">
                <option value="plain">Plain</option>
                <option value="dots">Dots</option>
              </select>
            </div>
          </div>
          <div class="settings-section">
            <h3>Defaults</h3>
            <div class="settings-row">
              <div class="label">
                <span class="name">New workflow type</span>
                <span class="hint">Used when creating a workflow</span>
              </div>
              <select id="set_defaultWorkflowType">
                <option value="Sequence">Sequence</option>
                <option value="Flowchart">Flowchart</option>
              </select>
            </div>
            <div class="settings-row">
              <div class="label">
                <span class="name">Auto-open designer</span>
                <span class="hint">Open the visual designer for new workflows</span>
              </div>
              <input type="checkbox" id="set_autoOpenDesigner" />
            </div>
            <div class="settings-row">
              <div class="label">
                <span class="name">Sync Studio Web on Save</span>
                <span class="hint">Write .xaml into a linked Local Workspace</span>
              </div>
              <input type="checkbox" id="set_syncStudioWebOnSave" />
            </div>
            <div class="settings-row">
              <div class="label">
                <span class="name">UiPath target framework</span>
                <span class="hint">Windows robots vs Portable (cross-platform)</span>
              </div>
              <select id="set_uipathTargetFramework">
                <option value="Windows">Windows</option>
                <option value="Portable">Portable</option>
              </select>
            </div>
          </div>
        </div>
        <div class="settings-dialog-foot">
          <button class="btn" type="button" id="settingsDialogDismiss">Cancel</button>
          <button class="btn primary" type="button" id="settingsDialogApply">Save</button>
        </div>
      </div>
    </div>

    <div class="palette-overlay" id="paletteOverlay">
      <div class="palette" role="dialog" aria-label="Insert activity">
        <div class="palette-head">
          <input id="paletteSearch" placeholder="Search activities… (favorites · recent · all)" autocomplete="off" />
          <div class="palette-hint">Enter insert · ↑↓ navigate · ⌘/Ctrl+⇧+P pin favorite (max 10) · Esc close</div>
        </div>
        <div class="palette-list" id="paletteList"></div>
      </div>
    </div>

    <aside class="panel right frame-docked" id="propsPanel">
      <div class="frame-resize-x" id="propsResizeX" title="Drag to resize width"></div>
      <div class="panel-chrome" id="propsChrome">
        <div class="traffic" aria-label="Properties frame controls">
          <button class="tl min" id="btnPropsFloat" type="button" title="Float frame"></button>
          <button class="tl max" id="btnPropsDock" type="button" title="Dock frame"></button>
        </div>
        <h2><span class="grow">Properties</span></h2>
        <div class="panel-chrome-actions">
          <button class="btn symbol" id="btnExpandProps" type="button" title="Expand all property groups">▾▾</button>
          <button class="btn symbol" id="btnCollapseProps" type="button" title="Collapse all property groups">▸▸</button>
        </div>
      </div>
      <div class="panel-scroll" id="propsScroll">
        <div class="props" id="props"></div>
        <div class="side-section" id="connectionsSection" data-section="connections" style="display:none">
          <button type="button" class="side-section-head" id="btnToggleConnections">
            <span class="chev">▾</span>
            <span class="grow">Connections</span>
            <span class="count" id="connectionsCount">0</span>
          </button>
          <div class="side-section-body">
            <div class="props" id="connectionsPanel"></div>
          </div>
        </div>
        <div style="padding:0 14px 18px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn danger" id="btnDelete" disabled>Delete activity</button>
        </div>
      </div>
      <div class="frame-resize-y" id="propsResizeY" title="Drag to resize height (float mode)"></div>
      <div class="collapsed-only">
        <button class="btn" id="btnPropsExpand" type="button" title="Expand properties panel">Properties</button>
      </div>
    </aside>

    <nav class="maestro-dock" id="maestroDock" aria-label="Canvas dock">
      <button class="dock-btn" id="dockLeft" type="button" title="Show / hide toolbox">▢</button>
      <button class="dock-btn" id="btnInsert" type="button" title="Insert activity (⌘K / Ctrl+K)">＋</button>
      <span class="dock-sep" aria-hidden="true"></span>
      <div class="dock-zoom">
        <button class="dock-btn" id="btnZoomOut" type="button" title="Zoom out">−</button>
        <span class="zoom-label" id="zoomLabel" title="Current zoom">100%</span>
        <button class="dock-btn" id="btnZoomIn" type="button" title="Zoom in">+</button>
        <button class="dock-btn" id="btnZoomReset" type="button" title="Reset zoom to 100%">⛶</button>
      </div>
      <span class="dock-sep" aria-hidden="true"></span>
      <button class="dock-btn" id="btnValidate" type="button" title="Validate workflow">✓</button>
      <button class="dock-btn" id="btnDryRun" type="button" title="Dry Run (run all)">▶</button>
      <button class="dock-btn" id="btnStepThrough" type="button" title="Step through on canvas">⏭</button>
      <span class="dock-sep" aria-hidden="true"></span>
      <button class="dock-btn" id="dockProps" type="button" title="Show / hide properties">☰</button>
    </nav>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const SELECTOR_TEMPLATES = ${selectorTemplatesJson};

    let state = {
      workflow: ${workflowJson},
      catalog: ${catalogJson},
      suggestions: ${suggestionsJson},
      palette: ${paletteJson},
      projects: ${projectsJson},
      settings: ${settingsJson},
      settingsOpen: false,
      assistHelpOpen: false,
      collapsedLeftSections: { project: true, activities: false, variables: true, arguments: true, watch: true, fixtures: true },
      selectedId: null,
      dragType: null,
      linkFrom: null,
      draggingId: null,
      dragOffset: { x: 0, y: 0 },
      zoom: 1,
      collapsedCats: {},
      collapsedPropSections: {},
      propsMode: 'docked',
      propsWidth: 300,
      propsHeight: Math.round(window.innerHeight * 0.7),
      propsFloatPos: { x: null, y: null },
      leftMode: 'docked',
      leftWidth: 300,
      leftHeight: Math.round(window.innerHeight * 0.72),
      leftFloatPos: { x: null, y: null },
      playback: null,
      breakpoints: {},
      fixtures: {},
      paletteOpen: false,
      paletteQuery: '',
      paletteActive: 0,
      exprEdit: null,
      insertPath: null,
      ctxTargetId: null
    };

    const els = {
      app: document.querySelector('.app'),
      propsPanel: document.getElementById('propsPanel'),
      toolbox: document.getElementById('toolbox'),
      propsScroll: document.getElementById('propsScroll'),
      catalog: document.getElementById('catalog'),
      projectTree: document.getElementById('projectTree'),
      sequence: document.getElementById('sequence'),
      flowStage: document.getElementById('flowStage'),
      canvasZoom: document.getElementById('canvasZoom'),
      props: document.getElementById('props'),
      variablesView: document.getElementById('variablesView'),
      argumentsView: document.getElementById('argumentsView'),
      connectionsPanel: document.getElementById('connectionsPanel'),
      connectionsSection: document.getElementById('connectionsSection'),
      variablesCount: document.getElementById('variablesCount'),
      argumentsCount: document.getElementById('argumentsCount'),
      connectionsCount: document.getElementById('connectionsCount'),
      workflowName: document.getElementById('workflowName'),
      workflowType: document.getElementById('workflowType'),
      canvasHelp: document.getElementById('canvasHelp'),
      breadcrumbs: document.getElementById('breadcrumbs'),
      workflowSearch: document.getElementById('workflowSearch'),
      search: document.getElementById('search'),
      toast: document.getElementById('toast'),
      hoverTip: document.getElementById('hoverTip'),
      zoomLabel: document.getElementById('zoomLabel'),
      btnDelete: document.getElementById('btnDelete'),
      btnLink: document.getElementById('btnLink'),
      btnAutoLayout: document.getElementById('btnAutoLayout'),
      dockLeft: document.getElementById('dockLeft'),
      dockProps: document.getElementById('dockProps'),
      exprOverlay: document.getElementById('exprOverlay'),
      exprDialogTitle: document.getElementById('exprDialogTitle'),
      exprDialogValue: document.getElementById('exprDialogValue'),
      settingsOverlay: document.getElementById('settingsOverlay'),
      assistHelpOverlay: document.getElementById('assistHelpOverlay'),
      btnAssistHelp: document.getElementById('btnAssistHelp'),
      watchView: document.getElementById('watchView'),
      watchCount: document.getElementById('watchCount'),
      fixturesEditor: document.getElementById('fixturesEditor')
    };

    function applyDesignerSettings() {
      const s = state.settings || {};
      els.app?.classList.toggle('hide-steps', s.showLineNumbers === false);
      const dots = s.canvasStyle === 'dots';
      els.sequence?.classList.toggle('canvas-dots', dots);
      els.flowStage?.classList.toggle('canvas-dots', dots);
    }
    function fillSettingsForm() {
      const s = state.settings || {};
      const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
      const setSel = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      setChk('set_showLineNumbers', s.showLineNumbers !== false);
      setSel('set_canvasStyle', s.canvasStyle === 'dots' ? 'dots' : 'plain');
      setSel('set_defaultWorkflowType', s.defaultWorkflowType === 'Flowchart' ? 'Flowchart' : 'Sequence');
      setChk('set_autoOpenDesigner', s.autoOpenDesigner !== false);
      setChk('set_syncStudioWebOnSave', s.syncStudioWebOnSave !== false);
      setSel('set_uipathTargetFramework', s.uipathTargetFramework === 'Portable' ? 'Portable' : 'Windows');
    }
    function openSettings() {
      closeAssistHelp();
      state.settingsOpen = true;
      fillSettingsForm();
      els.settingsOverlay?.classList.add('show');
    }
    function closeSettings() {
      state.settingsOpen = false;
      els.settingsOverlay?.classList.remove('show');
    }
    function openAssistHelp() {
      closeSettings();
      state.assistHelpOpen = true;
      els.assistHelpOverlay?.classList.add('show');
      els.btnAssistHelp?.classList.add('active-assist');
      els.btnAssistHelp?.setAttribute('aria-expanded', 'true');
    }
    function closeAssistHelp() {
      state.assistHelpOpen = false;
      els.assistHelpOverlay?.classList.remove('show');
      els.btnAssistHelp?.classList.remove('active-assist');
      els.btnAssistHelp?.setAttribute('aria-expanded', 'false');
    }
    function toggleAssistHelp() {
      if (state.assistHelpOpen) closeAssistHelp();
      else openAssistHelp();
    }
    function saveSettingsFromForm() {
      const chk = (id) => !!document.getElementById(id)?.checked;
      const sel = (id) => document.getElementById(id)?.value;
      const next = {
        showLineNumbers: chk('set_showLineNumbers'),
        canvasStyle: sel('set_canvasStyle') === 'dots' ? 'dots' : 'plain',
        defaultWorkflowType: sel('set_defaultWorkflowType') === 'Flowchart' ? 'Flowchart' : 'Sequence',
        autoOpenDesigner: chk('set_autoOpenDesigner'),
        syncStudioWebOnSave: chk('set_syncStudioWebOnSave'),
        uipathTargetFramework: sel('set_uipathTargetFramework') === 'Portable' ? 'Portable' : 'Windows'
      };
      state.settings = Object.assign({}, state.settings, next);
      applyDesignerSettings();
      vscode.postMessage({ type: 'updateSettings', settings: next });
      closeSettings();
    }
    applyDesignerSettings();

    function applyLeftSections() {
      document.querySelectorAll('.left-section').forEach((sec) => {
        const id = sec.getAttribute('data-section');
        const collapsed = !!state.collapsedLeftSections[id];
        sec.classList.toggle('collapsed', collapsed);
        const chev = sec.querySelector('.left-section-head .chev');
        if (chev) chev.textContent = collapsed ? '▸' : '▾';
      });
    }
    /** Accordion: opening one section collapses the others so Watch/Fixtures get full height. */
    function openLeftSectionExclusive(id) {
      document.querySelectorAll('.left-section').forEach((sec) => {
        const sid = sec.getAttribute('data-section');
        state.collapsedLeftSections[sid] = sid !== id;
      });
      applyLeftSections();
    }
    document.querySelectorAll('[data-toggle-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle-section');
        const currentlyOpen = !state.collapsedLeftSections[id];
        if (currentlyOpen) {
          // Collapse this one only (others stay as-is); keep activities open as fallback
          state.collapsedLeftSections[id] = true;
          if (Object.keys(state.collapsedLeftSections).every((k) => state.collapsedLeftSections[k])) {
            state.collapsedLeftSections.activities = false;
          }
          applyLeftSections();
        } else {
          openLeftSectionExclusive(id);
        }
      });
    });
    // Default: Activities open, others collapsed (room for tall panels when opened)
    state.collapsedLeftSections = Object.assign(
      { project: true, activities: false, variables: true, arguments: true, watch: true, fixtures: true },
      state.collapsedLeftSections || {}
    );
    applyLeftSections();

        function renderProjectTree() {
      if (!els.projectTree) return;
      const projects = state.projects || [];
      if (!projects.length) {
        els.projectTree.innerHTML = '<div class="project-empty">Open a workflow from the current RPA project to browse its folders and files here.</div>';
        return;
      }
      function nodeHtml(node, depth) {
        const icon =
          node.kind === 'project' ? 'P' :
          node.kind === 'solution' || node.kind === 'workspace' ? 'S' :
          node.kind === 'folder' ? 'F' :
          node.kind === 'workflow' ? 'W' : '·';
        const active = node.active ? ' active' : '';
        const badgeText = node.badge || (node.active ? 'active' : '');
        const badge = badgeText ? '<span class="badge">' + escapeHtml(badgeText) + '</span>' : '';
        const canRemove = node.kind === 'project' || node.kind === 'solution' || node.kind === 'workspace';
        const removeBtn = canRemove && depth === 0
          ? '<button type="button" class="project-remove" data-remove-kind="' + escapeAttr(node.kind) + '" data-path="' + escapeAttr(node.path) + '" title="Remove from explorer">×</button>'
          : '';
        let html = '<div class="project-node' + active + '" data-kind="' + escapeAttr(node.kind) + '" data-path="' + escapeAttr(node.path) + '">' +
          '<span class="ico">' + icon + '</span><span class="label">' + escapeHtml(node.name) + '</span>' + badge + removeBtn + '</div>';
        if (node.children && node.children.length) {
          html += '<div class="project-children">' + node.children.map((c) => nodeHtml(c, depth + 1)).join('') + '</div>';
        }
        return html;
      }
      els.projectTree.innerHTML = projects.map((p) => nodeHtml(p, 0)).join('');
      els.projectTree.querySelectorAll('.project-remove').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const kind = btn.getAttribute('data-remove-kind') || '';
          const p = btn.getAttribute('data-path') || '';
          vscode.postMessage({ type: 'removeFromExplorer', kind, path: p });
        });
      });
      els.projectTree.querySelectorAll('.project-node').forEach((el) => {
        el.addEventListener('click', () => {
          const kind = el.getAttribute('data-kind');
          const p = el.getAttribute('data-path') || '';
          if (kind === 'project') {
            vscode.postMessage({ type: 'setActiveProject', path: p });
            toast('Active project → ' + (el.querySelector('.label')?.textContent || ''));
          } else if (kind === 'solution' || kind === 'workspace') {
            vscode.postMessage({ type: 'revealInOs', path: p });
          } else if (kind === 'workflow' || kind === 'file') {
            vscode.postMessage({ type: 'openProjectFile', path: p });
          }
        });
      });
    }

    function isFlow() { return state.workflow.type === 'Flowchart'; }
    function toast(msg, opts) {
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      setTimeout(() => els.toast.classList.remove('show'), 1800);
      // Mirror designer notifications into VS Code Output (skip if host already logged)
      if (!(opts && opts.skipLog)) {
        try { vscode.postMessage({ type: 'log', message: String(msg || '') }); } catch (_) {}
      }
    }
    function setLeftSection(id, open) {
      if (open === false) {
        state.collapsedLeftSections[id] = true;
        applyLeftSections();
      } else {
        openLeftSectionExclusive(id);
      }
    }
    function setLeftTab(id) { openLeftSectionExclusive(id); }
    function parseFixturesEditor() {
      const raw = (els.fixturesEditor && els.fixturesEditor.value || '').trim();
      if (!raw) return {};
      try { return JSON.parse(raw); }
      catch (err) { toast('Fixtures JSON invalid'); return state.fixtures || {}; }
    }
    function currentFixtures() {
      return Object.keys(state.fixtures || {}).length ? state.fixtures : parseFixturesEditor();
    }
    function postDryRun(opts) {
      const o = opts || {};
      vscode.postMessage({
        type: 'dryRun',
        workflow: state.workflow,
        stepThrough: !!o.stepThrough,
        fixtures: currentFixtures(),
        initialVariables: o.initialVariables,
        runToActivityId: o.runToActivityId || undefined,
        breakpoints: Object.keys(state.breakpoints || {}).filter(k => state.breakpoints[k])
      });
    }
    function toggleBreakpoint(id) {
      if (!id) return;
      state.breakpoints[id] = !state.breakpoints[id];
      if (!state.breakpoints[id]) delete state.breakpoints[id];
      toast(state.breakpoints[id] ? 'Breakpoint on' : 'Breakpoint off');
      renderAll();
    }
    function deleteActivityById(id) {
      if (!id) return;
      const hit = walkFind(state.workflow.activities, id);
      if (!hit) return;
      hit.list.splice(hit.index, 1);
      if (isFlow()) {
        state.workflow.connections = (state.workflow.connections || []).filter(c => c.from !== id && c.to !== id);
        if (state.workflow.startActivityId === id) state.workflow.startActivityId = undefined;
      }
      if (state.breakpoints[id]) delete state.breakpoints[id];
      if (state.selectedId === id) state.selectedId = null;
      hideCtxMenu();
      persist(true);
      toast('Deleted activity');
    }
    function hideCtxMenu() {
      const menu = document.getElementById('ctxMenu');
      if (menu) menu.classList.remove('show');
      state.ctxTargetId = null;
    }
    function showCtxMenu(x, y, activityId) {
      const menu = document.getElementById('ctxMenu');
      if (!menu) return;
      state.ctxTargetId = activityId;
      state.selectedId = activityId;
      menu.classList.add('show');
      const pad = 8;
      const mw = menu.offsetWidth || 160;
      const mh = menu.offsetHeight || 200;
      let left = x;
      let top = y;
      if (left + mw > window.innerWidth - pad) left = window.innerWidth - mw - pad;
      if (top + mh > window.innerHeight - pad) top = window.innerHeight - mh - pad;
      menu.style.left = Math.max(pad, left) + 'px';
      menu.style.top = Math.max(pad, top) + 'px';
    }
    function renderWatch(snapshot) {
      if (!els.watchView) return;
      const vars = snapshot || state.playback?.liveVars || state.playback?.finalVars || {};
      const keys = Object.keys(vars).sort();
      if (els.watchCount) els.watchCount.textContent = String(keys.length);
      if (!keys.length) {
        els.watchView.innerHTML = '<div class="empty">No variables in this step.</div>';
        return;
      }
      els.watchView.innerHTML = keys.map(k => {
        let val;
        try { val = JSON.stringify(vars[k]); } catch (_) { val = String(vars[k]); }
        return '<div class="watch-row"><label title="' + escapeAttr(k) + '">' + escapeHtml(k) + '</label>' +
          '<input data-watch-key="' + escapeAttr(k) + '" value="' + escapeAttr(val === undefined ? '' : val) + '" /></div>';
      }).join('');
      els.watchView.querySelectorAll('[data-watch-key]').forEach(input => {
        input.addEventListener('change', () => {
          const key = input.getAttribute('data-watch-key');
          if (!key) return;
          let parsed = input.value;
          try { parsed = JSON.parse(input.value); } catch (_) {}
          state.playback = state.playback || { liveVars: {} };
          state.playback.liveVars = state.playback.liveVars || Object.assign({}, vars);
          state.playback.liveVars[key] = parsed;
          toast('Watch: ' + key + ' updated');
        });
      });
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

    /** Ancestor chain from root to the node (inclusive), for nested breadcrumbs. */
    function walkAncestors(list, id, trail) {
      const path = trail || [];
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        const next = path.concat(node);
        if (node.id === id) return next;
        if (node.children) {
          const hit = walkAncestors(node.children, id, next);
          if (hit) return hit;
        }
        if (node.elseChildren) {
          const hit = walkAncestors(node.elseChildren, id, next);
          if (hit) return hit;
        }
      }
      return null;
    }

    function walkCollect(list, out) {
      const acc = out || [];
      for (const node of list || []) {
        acc.push(node);
        if (node.children) walkCollect(node.children, acc);
        if (node.elseChildren) walkCollect(node.elseChildren, acc);
      }
      return acc;
    }

    function summary(node) {
      const p = node.properties || {};
      switch (node.type) {
        case 'System.LogMessage': return String(p.message || '');
        case 'Programming.Assign': return (p.to || '') + ' := ' + (p.value || '');
        case 'Flowchart.FlowDecision': return String(p.condition || '');
        case 'REFramework.InvokeWorkflow': return String(p.workflowPath || '');
        case 'UI.UseApplicationBrowser':
          return (p.mode || 'Browser') + ' ' + String(p.urlOrPath || '').slice(0, 36);
        case 'UI.ExtractTableData': return '→ ' + (p.result || 'extractedTable');
        case 'UI.Click':
        case 'UI.TypeInto':
        case 'UI.GetText':
          return String(p.selector || '').replace(/\\s+/g, ' ').slice(0, 42);
        case 'ControlFlow.If':
        case 'ControlFlow.While': return 'when ' + (p.condition || '');
        case 'Messaging.HttpRequest': return (p.method || 'GET') + ' ' + (p.url || '');
        default: {
          const first = Object.values(p)[0];
          return first === undefined ? node.type : String(first).slice(0, 42);
        }
      }
    }

    function escSel(value) {
      return String(value || '').replace(/'/g, "''");
    }
    function parseSelAttrs(raw) {
      const out = {};
      const re = /([:@\\w.-]+)\\s*=\\s*(?:'([^']*)'|"([^"]*)"|([^\\s"'=<>\`]+))/g;
      let m;
      while ((m = re.exec(raw || ''))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
      return out;
    }
    function emptySelParts(kind) {
      if (kind === 'desktop') {
        return { kind: 'desktop', app: '', title: '', tag: '', id: '', aaname: '', cls: '', name: '', idx: '' };
      }
      return { kind: 'browser', app: 'chrome.exe', title: '*', tag: '', id: '', aaname: '', cls: '', name: '', idx: '' };
    }
    function isPlaceholderSel(raw) {
      const q = scoreSelector(raw);
      return q.level === 'empty' || q.level === 'placeholder';
    }
    function scoreSelector(raw) {
      const s = String(raw || '').trim();
      const stock = new Set(['btnsubmit','input','label','popup','chkagree','menu','cmbcountry','element']);
      if (!s) {
        return { score: 0, level: 'empty', label: 'Empty', hints: ['Paste a Studio UI Explorer selector or use a template.'], cardMessage: 'Windows TODO · missing selector' };
      }
      if (/<target\\b/i.test(s)) {
        return { score: 8, level: 'placeholder', label: 'Placeholder', hints: ['Replace <target> with classic <html>/<webctrl> or <wnd>.'], cardMessage: 'Windows TODO · <target> placeholder' };
      }
      const parts = parseWindowsSelector(s);
      if (stock.has(String(parts.id || '').toLowerCase())) {
        return { score: 15, level: 'placeholder', label: 'Starter example', hints: ['Id "' + parts.id + '" is a demo value — set a real Id / aaname.'], cardMessage: 'Windows TODO · starter selector' };
      }
      let score = 20;
      if (/<(html|webctrl|wnd)\\b/i.test(s)) score += 15;
      const hints = [];
      if (parts.kind === 'browser') {
        if (parts.tag && parts.tag !== '*') score += 10; else hints.push('Set a Tag (BUTTON, INPUT, A…).');
        if (parts.id) score += 30;
        if (parts.aaname) score += 22;
        if (parts.name) score += 18;
        if (parts.cls) score += 8;
        if (parts.idx) {
          score += 6;
          if (!parts.id && !parts.aaname && !parts.name) hints.push('Index-only selectors are brittle — add Id or aaname.');
        }
        if (parts.title && parts.title !== '*') score += 6;
        if (!parts.id && !parts.aaname && !parts.name && !parts.idx) {
          return { score: Math.min(score, 28), level: 'placeholder', label: 'Under-specified', hints: ['Set Id, aaname, Name, or Index before Windows run.'], cardMessage: 'Windows TODO · under-specified selector' };
        }
      } else {
        if (parts.app && parts.app !== 'app.exe') score += 20; else hints.push('Set a real App (e.g. notepad.exe).');
        if (parts.cls) score += 22;
        if (parts.title && parts.title !== '*') score += 18;
        else if (parts.title === '*') { score += 4; hints.push('A concrete window Title is more reliable than *.'); }
        if (parts.name) score += 16;
        if (parts.idx) score += 6;
        if ((!parts.app || parts.app === 'app.exe') && !parts.cls && (!parts.title || parts.title === '*') && !parts.name) {
          return { score: 12, level: 'placeholder', label: 'Generic window', hints: ['Set App + Title or cls for desktop selectors.'], cardMessage: 'Windows TODO · generic <wnd>' };
        }
      }
      score = Math.max(0, Math.min(100, score));
      if (score < 40) {
        if (!hints.length) hints.push('Add Id or aaname to raise specificity.');
        return { score: score, level: 'weak', label: 'Weak', hints: hints, cardMessage: 'Weak selector — add Id / aaname' };
      }
      if (score < 70) {
        if (!hints.length) hints.push('Good enough to try on Windows; Indicate Element if it misses.');
        return { score: score, level: 'ok', label: 'OK', hints: hints, cardMessage: '' };
      }
      if (!hints.length) hints.push('Specific classic selector — still verify on Windows.');
      return { score: score, level: 'strong', label: 'Strong', hints: hints, cardMessage: '' };
    }
    function tryDecodeSelectorPaste(raw) {
      const text = String(raw || '').trim();
      if (!text) return null;
      if (/<(html|webctrl|wnd|java|sap|ctrl)\\b/i.test(text)) return text;
      if (/<target\\b/i.test(text) || /^#[\\w.-]+$/.test(text) || /^[\\w.-]+$/.test(text)) {
        // mirror normalizeWindowsSelector lightly
        if (/^#[\\w.-]+$/.test(text)) {
          return "<html app='chrome.exe' title='*' />\\n<webctrl tag='*' id='" + escSel(text.slice(1)) + "' />";
        }
        if (/^[\\w.-]+$/.test(text) && text.length < 80) {
          return "<html app='chrome.exe' title='*' />\\n<webctrl tag='*' id='" + escSel(text) + "' />";
        }
        const tm = text.match(/<target\\b([^>]*)\\/?>/i);
        if (tm) {
          const attrs = parseSelAttrs(tm[1] || '');
          return buildWindowsSelector({
            kind: 'browser', app: attrs.app || 'chrome.exe', title: attrs.title || '*',
            tag: (attrs.tag || 'BUTTON').toUpperCase(), id: attrs.id || '',
            aaname: attrs.aaname || attrs.name || '', name: '', cls: '', idx: ''
          });
        }
      }
      const htmlWeb = text.match(/(<html\\b[^>]*\\/?>[\\s\\S]*?<webctrl\\b[^>]*\\/?>)/i);
      if (htmlWeb && htmlWeb[1]) return htmlWeb[1].replace(/>\\s*</g, '>\\n<');
      const wnd = text.match(/(<wnd\\b[^>]*\\/?>)/i);
      if (wnd && wnd[1]) return wnd[1];
      const webOnly = text.match(/<webctrl\\b([^>]*)\\/?>/i);
      if (webOnly) {
        const attrs = parseSelAttrs(webOnly[1] || '');
        return buildWindowsSelector({
          kind: 'browser', app: 'chrome.exe', title: '*',
          tag: attrs.tag || '*', id: attrs.id || '', aaname: attrs.aaname || '',
          name: attrs.name || '', cls: attrs.class || attrs.cls || '', idx: attrs.idx || ''
        });
      }
      const idMatch = text.match(/\\bid\\s*[=:]\\s*['"]?([\\w.-]+)/i);
      const tagMatch = text.match(/\\btag\\s*[=:]\\s*['"]?([\\w.-]+)/i);
      const aanameMatch = text.match(/\\b(?:aaname|name)\\s*[=:]\\s*['"]([^'"]+)/i);
      if (idMatch || aanameMatch) {
        return buildWindowsSelector({
          kind: 'browser', app: 'chrome.exe', title: '*',
          tag: String(tagMatch && tagMatch[1] || '*').toUpperCase(),
          id: idMatch && idMatch[1] || '', aaname: aanameMatch && aanameMatch[1] || ''
        });
      }
      return null;
    }
    function selectorCardWarn(node) {
      if (!node || !String(node.type || '').startsWith('UI.')) return null;
      if (node.type === 'UI.OpenApplication' || node.type === 'UI.TakeScreenshot') return null;
      const def = findDef(node.type);
      const hasSelectorProp = !!(def?.properties || []).some(p => p.name === 'selector');
      if (!hasSelectorProp) return null;
      const q = scoreSelector(node.properties?.selector);
      if (q.cardMessage) return { text: q.cardMessage, level: q.level };
      return null;
    }
    function collectSiblingSelectors(excludeId) {
      const out = [];
      const visit = (list) => {
        (list || []).forEach(n => {
          if (n.id !== excludeId) {
            const sel = String(n.properties?.selector || '').trim();
            if (sel && !isPlaceholderSel(sel)) {
              out.push({ id: n.id, name: n.displayName, type: n.type, selector: sel });
            }
          }
          if (n.children) visit(n.children);
          if (n.elseChildren) visit(n.elseChildren);
        });
      };
      visit(state.workflow.activities || []);
      return out;
    }
    function buildWindowsSelector(parts) {
      const kind = parts.kind || 'browser';
      if (kind === 'desktop') {
        const attrs = ["app='" + escSel(parts.app || 'app.exe') + "'"];
        if (parts.cls) attrs.push("cls='" + escSel(parts.cls) + "'");
        if (parts.title) attrs.push("title='" + escSel(parts.title) + "'");
        if (parts.name) attrs.push("name='" + escSel(parts.name) + "'");
        if (parts.idx) attrs.push("idx='" + escSel(parts.idx) + "'");
        return '<wnd ' + attrs.join(' ') + ' />';
      }
      const tag = String(parts.tag || '*').toUpperCase();
      const web = ["tag='" + escSel(tag) + "'"];
      if (parts.id) web.push("id='" + escSel(parts.id) + "'");
      if (parts.aaname) web.push("aaname='" + escSel(parts.aaname) + "'");
      if (parts.name) web.push("name='" + escSel(parts.name) + "'");
      if (parts.cls) web.push("class='" + escSel(parts.cls) + "'");
      if (parts.idx) web.push("idx='" + escSel(parts.idx) + "'");
      return "<html app='" + escSel(parts.app || 'chrome.exe') + "' title='" + escSel(parts.title || '*') + "' />\\n<webctrl " + web.join(' ') + ' />';
    }
    function parseWindowsSelector(raw) {
      const text = String(raw || '').trim();
      if (!text) return emptySelParts('browser');
      if (/<wnd\\b/i.test(text)) {
        const m = text.match(/<wnd\\b([^>]*)\\/?>/i);
        const attrs = parseSelAttrs(m && m[1] || '');
        return { kind: 'desktop', app: attrs.app || '', title: attrs.title || '', tag: '', id: '', aaname: attrs.aaname || '', cls: attrs.cls || '', name: attrs.name || '', idx: attrs.idx || '' };
      }
      const html = text.match(/<html\\b([^>]*)\\/?>/i);
      const web = text.match(/<webctrl\\b([^>]*)\\/?>/i);
      const htmlAttrs = parseSelAttrs(html && html[1] || '');
      const webAttrs = parseSelAttrs(web && web[1] || '');
      return {
        kind: 'browser',
        app: htmlAttrs.app || 'chrome.exe',
        title: htmlAttrs.title || '*',
        tag: String(webAttrs.tag || '').toUpperCase(),
        id: webAttrs.id || '',
        aaname: webAttrs.aaname || '',
        cls: webAttrs.class || webAttrs.cls || '',
        name: webAttrs.name || '',
        idx: webAttrs.idx || ''
      };
    }
    function selectorBuilderHtml(propName, currentValue) {
      const parts = parseWindowsSelector(currentValue);
      const quality = scoreSelector(currentValue);
      const tplOpts = SELECTOR_TEMPLATES.map(t =>
        '<option value="' + escapeAttr(t.id) + '">' + escapeHtml(t.label) + '</option>'
      ).join('');
      const kindOpts = ['browser', 'desktop'].map(k =>
        '<option value="' + k + '"' + (parts.kind === k ? ' selected' : '') + '>' + k + '</option>'
      ).join('');
      const warnClass = quality.level === 'ok' || quality.level === 'strong' ? 'ok' : (quality.level === 'weak' ? 'weak' : '');
      const warn = '<div class="selector-warn ' + warnClass + '" data-sb-warn>' + escapeHtml(
        quality.level === 'ok' || quality.level === 'strong'
          ? quality.hints[0] || 'Selector looks specific enough to try on Windows.'
          : (quality.hints[0] || 'Selector needs work before Windows run.')
      ) + '</div>';
      const hints = (quality.hints || []).slice(0, 3).map(h => '<li>' + escapeHtml(h) + '</li>').join('');
      return '<div class="selector-builder" data-sel-for="' + escapeAttr(propName) + '">' +
        '<div class="sb-title">Selector Builder</div>' +
        fieldHtml('Template', '<select data-sb="template"><option value="">— choose template —</option>' + tplOpts + '</select>') +
        '<div class="sb-grid" style="margin-top:8px">' +
          fieldHtml('Kind', '<select data-sb="kind">' + kindOpts + '</select>') +
          fieldHtml('App', '<input data-sb="app" value="' + escapeAttr(parts.app) + '" placeholder="chrome.exe / notepad.exe" />') +
          fieldHtml('Title', '<input data-sb="title" value="' + escapeAttr(parts.title) + '" placeholder="Window title *" />') +
          fieldHtml('Tag', '<input data-sb="tag" value="' + escapeAttr(parts.tag) + '" placeholder="BUTTON / INPUT / A" />') +
          fieldHtml('Id', '<input data-sb="id" value="' + escapeAttr(parts.id) + '" placeholder="element id" />') +
          fieldHtml('aaname', '<input data-sb="aaname" value="' + escapeAttr(parts.aaname) + '" placeholder="accessible name" />') +
          fieldHtml('Class / cls', '<input data-sb="cls" value="' + escapeAttr(parts.cls) + '" />') +
          fieldHtml('Name', '<input data-sb="name" value="' + escapeAttr(parts.name) + '" />') +
          fieldHtml('Index', '<input data-sb="idx" value="' + escapeAttr(parts.idx) + '" placeholder="1" />') +
        '</div>' +
        '<div class="sb-score ' + escapeAttr(quality.level) + '" data-sb-score>' +
          '<span class="sb-score-label" data-sb-score-label>' + escapeHtml(quality.label) + ' · ' + quality.score + '</span>' +
          '<div class="sb-meter"><span data-sb-meter style="width:' + quality.score + '%"></span></div>' +
        '</div>' +
        '<ul class="sb-hints" data-sb-hints>' + hints + '</ul>' +
        warn +
        '<div class="sb-paste-row">' +
          '<textarea data-sb-paste placeholder="Paste Studio UI Explorer / modern selector / #id…"></textarea>' +
          '<button class="btn" type="button" data-sb-decode title="Decode paste into classic selector">Decode</button>' +
        '</div>' +
        '<div class="sb-actions">' +
          '<button class="btn primary" type="button" data-sb-apply>Apply</button>' +
          '<button class="btn" type="button" data-sb-copy-sibling title="Copy selector from another activity">Copy sibling</button>' +
          '<span class="sb-hint">Edits apply live · Mac browser vs Windows desktop paths differ</span>' +
        '</div>' +
        '<pre class="sb-preview" data-sb-preview>' + escapeHtml(String(currentValue || '').trim() ? String(currentValue) : buildWindowsSelector(parts)) + '</pre>' +
      '</div>';
    }
    function wireSelectorBuilder(root, node, propName) {
      const box = root.querySelector('.selector-builder[data-sel-for="' + propName + '"]');
      if (!box) return;
      const preview = box.querySelector('[data-sb-preview]');
      const warnEl = box.querySelector('[data-sb-warn]');
      const scoreEl = box.querySelector('[data-sb-score]');
      const scoreLabel = box.querySelector('[data-sb-score-label]');
      const meter = box.querySelector('[data-sb-meter]');
      const hintsEl = box.querySelector('[data-sb-hints]');
      const readParts = () => ({
        kind: box.querySelector('[data-sb="kind"]').value || 'browser',
        app: box.querySelector('[data-sb="app"]').value || '',
        title: box.querySelector('[data-sb="title"]').value || '',
        tag: box.querySelector('[data-sb="tag"]').value || '',
        id: box.querySelector('[data-sb="id"]').value || '',
        aaname: box.querySelector('[data-sb="aaname"]').value || '',
        cls: box.querySelector('[data-sb="cls"]').value || '',
        name: box.querySelector('[data-sb="name"]').value || '',
        idx: box.querySelector('[data-sb="idx"]').value || ''
      });
      const fillParts = (parts) => {
        Object.keys(parts).forEach(k => {
          const input = box.querySelector('[data-sb="' + k + '"]');
          if (input) input.value = parts[k] == null ? '' : String(parts[k]);
        });
      };
      const syncQuality = (built) => {
        const q = scoreSelector(built);
        if (warnEl) {
          warnEl.className = 'selector-warn' + (q.level === 'ok' || q.level === 'strong' ? ' ok' : (q.level === 'weak' ? ' weak' : ''));
          warnEl.textContent = q.level === 'ok' || q.level === 'strong'
            ? (q.hints[0] || 'Selector looks specific enough to try on Windows.')
            : (q.hints[0] || 'Selector needs work before Windows run.');
        }
        if (scoreEl) {
          scoreEl.className = 'sb-score ' + q.level;
          if (scoreLabel) scoreLabel.textContent = q.label + ' · ' + q.score;
          if (meter) meter.style.width = q.score + '%';
        }
        if (hintsEl) {
          hintsEl.innerHTML = (q.hints || []).slice(0, 3).map(h => '<li>' + escapeHtml(h) + '</li>').join('');
        }
      };
      const applyLive = (opts) => {
        const built = buildWindowsSelector(readParts());
        const target = root.querySelector('[data-prop="' + propName + '"]');
        if (target) target.value = built;
        node.properties[propName] = built;
        if (preview) preview.textContent = built;
        syncQuality(built);
        const cardSum = document.querySelector('.card.selected .card-summary');
        if (cardSum) cardSum.textContent = summary(node);
        const cardWarn = document.querySelector('.card.selected .card-warn');
        const cw = selectorCardWarn(node);
        if (cardWarn) {
          if (cw) {
            cardWarn.style.display = '';
            cardWarn.textContent = cw.text;
            cardWarn.className = 'card-warn' + (cw.level === 'weak' ? ' weak' : '');
          } else {
            cardWarn.style.display = 'none';
          }
        }
        vscode.postMessage({ type: 'edit', workflow: state.workflow });
        if (opts && opts.toast) toast('Selector applied');
      };
      const refreshPreview = () => {
        if (preview) preview.textContent = buildWindowsSelector(readParts());
      };
      box.querySelectorAll('[data-sb]').forEach(el => {
        el.addEventListener('input', () => {
          if (el.getAttribute('data-sb') === 'template') return;
          applyLive();
        });
        el.addEventListener('change', () => {
          if (el.getAttribute('data-sb') === 'template' && el.value) {
            const tpl = SELECTOR_TEMPLATES.find(t => t.id === el.value);
            if (tpl) {
              const base = emptySelParts(tpl.kind);
              const merged = Object.assign({}, base, tpl.parts, { kind: tpl.kind });
              fillParts(merged);
              applyLive({ toast: true });
            }
            return;
          }
          applyLive();
        });
      });
      box.querySelector('[data-sb-apply]')?.addEventListener('click', () => applyLive({ toast: true }));
      box.querySelector('[data-sb-decode]')?.addEventListener('click', () => {
        const paste = box.querySelector('[data-sb-paste]');
        const decoded = tryDecodeSelectorPaste(paste?.value || '');
        if (!decoded) {
          toast('Could not decode paste — try classic <html>/<webctrl>, #id, or tag/id pairs');
          return;
        }
        fillParts(parseWindowsSelector(decoded));
        if (paste) paste.value = '';
        applyLive({ toast: true });
        toast('Decoded paste → classic selector');
      });
      box.querySelector('[data-sb-copy-sibling]')?.addEventListener('click', async () => {
        const siblings = collectSiblingSelectors(node.id);
        if (!siblings.length) {
          toast('No sibling activities with a real selector yet');
          return;
        }
        // Lightweight picker via prompt when few; otherwise first strong match
        const labels = siblings.map((s, i) => (i + 1) + '. ' + s.name + ' (' + s.type + ')');
        const pick = window.prompt('Copy selector from sibling:\\n' + labels.join('\\n') + '\\n\\nEnter number:', '1');
        const idx = Math.max(1, parseInt(String(pick || '1'), 10) || 1) - 1;
        const hit = siblings[idx];
        if (!hit) { toast('Invalid sibling'); return; }
        fillParts(parseWindowsSelector(hit.selector));
        applyLive({ toast: true });
        toast('Copied selector from ' + hit.name);
      });
      syncQuality(node.properties[propName] || '');
      refreshPreview();
    }

    function persistFrameState() {
      try {
        vscode.setState({
          propsMode: state.propsMode,
          propsWidth: state.propsWidth,
          propsHeight: state.propsHeight,
          propsFloatPos: state.propsFloatPos,
          leftMode: state.leftMode,
          leftWidth: state.leftWidth,
          leftHeight: state.leftHeight,
          leftFloatPos: state.leftFloatPos
        });
      } catch (e) {}
    }
    function syncDockActive() {
      if (els.dockLeft) els.dockLeft.classList.toggle('active', state.leftMode !== 'collapsed');
      if (els.dockProps) els.dockProps.classList.toggle('active', state.propsMode !== 'collapsed');
    }
    function applyFrameLayouts() {
      const app = els.app;
      const props = els.propsPanel;
      const left = els.toolbox;
      if (!app || !props || !left) return;
      document.documentElement.style.setProperty('--props-width', state.propsWidth + 'px');
      document.documentElement.style.setProperty('--props-height', state.propsHeight + 'px');
      document.documentElement.style.setProperty('--left-width', state.leftWidth + 'px');
      document.documentElement.style.setProperty('--left-height', state.leftHeight + 'px');

      app.classList.remove('props-floating', 'props-collapsed', 'left-floating', 'left-collapsed');
      props.classList.remove('floating', 'collapsed-strip', 'frame-docked');
      left.classList.remove('floating', 'collapsed-strip', 'frame-docked');
      props.style.left = ''; props.style.top = ''; props.style.right = ''; props.style.width = ''; props.style.height = '';
      left.style.left = ''; left.style.top = ''; left.style.right = ''; left.style.width = ''; left.style.height = '';

      if (state.propsMode === 'floating') {
        props.classList.add('floating');
        app.classList.add('props-floating');
        props.style.width = state.propsWidth + 'px';
        props.style.height = state.propsHeight + 'px';
        if (state.propsFloatPos.x != null) {
          props.style.left = state.propsFloatPos.x + 'px';
          props.style.top = state.propsFloatPos.y + 'px';
          props.style.right = 'auto';
        }
      } else if (state.propsMode === 'collapsed') {
        props.classList.add('collapsed-strip');
        app.classList.add('props-collapsed');
      } else {
        props.classList.add('frame-docked');
      }

      if (state.leftMode === 'floating') {
        left.classList.add('floating');
        app.classList.add('left-floating');
        left.style.width = state.leftWidth + 'px';
        left.style.height = state.leftHeight + 'px';
        if (state.leftFloatPos.x != null) {
          left.style.left = state.leftFloatPos.x + 'px';
          left.style.top = state.leftFloatPos.y + 'px';
        }
      } else if (state.leftMode === 'collapsed') {
        left.classList.add('collapsed-strip');
        app.classList.add('left-collapsed');
      } else {
        left.classList.add('frame-docked');
      }

      syncDockActive();
      persistFrameState();
    }
    function applyPropsPanelLayout() { applyFrameLayouts(); }
    function restorePropsPanelState() {
      try {
        const saved = vscode.getState && vscode.getState();
        if (!saved) return;
        if (saved.propsMode) state.propsMode = saved.propsMode;
        if (saved.propsWidth) state.propsWidth = saved.propsWidth;
        if (saved.propsHeight) state.propsHeight = saved.propsHeight;
        if (saved.propsFloatPos) state.propsFloatPos = saved.propsFloatPos;
        if (saved.leftMode) state.leftMode = saved.leftMode;
        if (saved.leftWidth) state.leftWidth = saved.leftWidth;
        if (saved.leftHeight) state.leftHeight = saved.leftHeight;
        if (saved.leftFloatPos) state.leftFloatPos = saved.leftFloatPos;
      } catch (e) {}
    }

    function applyZoom() {
      els.canvasZoom.style.transform = 'scale(' + state.zoom + ')';
      els.zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
    }
    function setZoom(next) {
      state.zoom = Math.min(1.75, Math.max(0.5, Math.round(next * 100) / 100));
      applyZoom();
    }
    function stagePoint(e) {
      const rect = els.flowStage.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / state.zoom,
        y: (e.clientY - rect.top) / state.zoom
      };
    }
    function showTip(html, clientX, clientY) {
      els.hoverTip.innerHTML = html;
      els.hoverTip.classList.add('show');
      const pad = 12;
      let left = clientX + pad;
      let top = clientY + pad;
      const tipRect = els.hoverTip.getBoundingClientRect();
      if (left + tipRect.width > window.innerWidth - 8) left = clientX - tipRect.width - pad;
      if (top + tipRect.height > window.innerHeight - 8) top = clientY - tipRect.height - pad;
      els.hoverTip.style.left = left + 'px';
      els.hoverTip.style.top = top + 'px';
    }
    function hideTip() {
      els.hoverTip.classList.remove('show');
    }
    function tipHtml(node) {
      return '<div class="tip-title">' + escapeHtml(node.displayName) + '</div>' +
        '<div class="tip-meta">' + escapeHtml(node.type) + '</div>' +
        (summary(node) ? '<div class="tip-meta" style="margin-top:4px">' + escapeHtml(summary(node)) + '</div>' : '');
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
        const collapsed = !!state.collapsedCats[cat] && !q;
        return '<div class="cat' + (collapsed ? ' collapsed' : '') + '" data-cat="' + escapeAttr(cat) + '">' +
          '<div class="cat-title"><span class="chev">' + (collapsed ? '▸' : '▾') + '</span>' + escapeHtml(cat) +
          ' <span style="opacity:.55;font-weight:500">(' + items.length + ')</span></div>' +
          '<div class="cat-items">' +
          items.map(a => (
            '<div class="activity-item" draggable="true" data-type="' + escapeAttr(a.type) + '" data-tip="' + escapeAttr(a.displayName + ' — ' + a.type) + '">' +
              '<span class="dot" style="background:' + a.color + '"></span>' +
              '<div class="meta"><div class="title">' + escapeHtml(a.displayName) + '</div>' +
              '<div class="type">' + escapeHtml(a.type) + '</div></div></div>'
          )).join('') + '</div></div>';
      }).join('');

      els.catalog.querySelectorAll('.cat-title').forEach(el => {
        el.addEventListener('click', () => {
          const cat = el.parentElement.getAttribute('data-cat');
          state.collapsedCats[cat] = !state.collapsedCats[cat];
          renderCatalog();
        });
      });
      els.catalog.querySelectorAll('.activity-item').forEach(el => {
        el.addEventListener('dragstart', (e) => {
          state.dragType = el.getAttribute('data-type');
          e.dataTransfer.setData('text/plain', state.dragType);
          e.dataTransfer.effectAllowed = 'copy';
          hideTip();
        });
        el.addEventListener('mouseenter', (e) => {
          const def = findDef(el.getAttribute('data-type'));
          if (!def) return;
          showTip('<div class="tip-title">' + escapeHtml(def.displayName) + '</div><div class="tip-meta">' + escapeHtml(def.type) + '</div>', e.clientX, e.clientY);
        });
        el.addEventListener('mousemove', (e) => {
          const def = findDef(el.getAttribute('data-type'));
          if (!def) return;
          showTip('<div class="tip-title">' + escapeHtml(def.displayName) + '</div><div class="tip-meta">' + escapeHtml(def.type) + '</div>', e.clientX, e.clientY);
        });
        el.addEventListener('mouseleave', hideTip);
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
      z.title = 'Drop activity here, or click + to insert';
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
      z.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.insertPath = pathKey;
        openPalette();
        toast('Pick an activity to insert');
      });
      return z;
    }

    function renderNode(node, stepNo) {
      const def = findDef(node.type);
      const color = node.color || def?.color || '#64748B';
      const wrap = document.createElement('div');
      const card = document.createElement('div');
      card.dataset.id = node.id;
      card.className = 'card' + (state.selectedId === node.id ? ' selected' : '') + dryRunClass(node.id);
      const openBtn = node.type === 'REFramework.InvokeWorkflow'
        ? '<button class="icon-btn" data-act="open" title="Open workflow in new tab">↗</button>'
        : '';
      const bpOn = !!state.breakpoints[node.id];
      const selWarn = selectorCardWarn(node);
      if (bpOn) card.classList.add('has-bp');
      card.innerHTML =
        '<div class="card-accent" style="background:' + color + '"></div>' +
        '<div class="card-actions">' +
          '<button type="button" class="card-bp' + (bpOn ? ' on' : '') + '" data-act="bp" title="Toggle breakpoint"></button>' +
          openBtn +
          '<button class="icon-btn" data-act="runto" title="Run to here">⏭</button>' +
          '<button class="icon-btn" data-act="up" title="Move up">↑</button>' +
          '<button class="icon-btn" data-act="down" title="Move down">↓</button>' +
          '<button class="icon-btn" data-act="dup" title="Duplicate">⧉</button>' +
          '<button class="icon-btn" data-act="delete" title="Delete">✕</button>' +
        '</div>' +
        '<div class="card-head"><span class="step">#' + stepNo + '</span>' +
        '<div class="card-title">' + escapeHtml(node.displayName) + '</div></div>' +
        '<div class="card-summary">' + escapeHtml(summary(node)) + '</div>' +
        (selWarn
          ? '<div class="card-warn' + (selWarn.level === 'weak' ? ' weak' : '') + '">' + escapeHtml(selWarn.text) + '</div>'
          : '<div class="card-warn" style="display:none"></div>');
      card.addEventListener('mouseenter', (e) => showTip(tipHtml(node), e.clientX, e.clientY));
      card.addEventListener('mousemove', (e) => showTip(tipHtml(node), e.clientX, e.clientY));
      card.addEventListener('mouseleave', hideTip);
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-act]')) return;
        state.selectedId = node.id;
        hideTip();
        hideCtxMenu();
        renderAll();
      });
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.selectedId = node.id;
        hideTip();
        showCtxMenu(e.clientX, e.clientY, node.id);
      });
      card.addEventListener('dblclick', (e) => {
        if (node.type === 'REFramework.InvokeWorkflow' && node.properties?.workflowPath) {
          e.stopPropagation();
          vscode.postMessage({ type: 'openWorkflow', workflowPath: String(node.properties.workflowPath) });
        }
      });
      card.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const act = btn.getAttribute('data-act');
          if (act === 'bp') {
            toggleBreakpoint(node.id);
            return;
          }
          if (act === 'runto') {
            state.selectedId = node.id;
            postDryRun({ stepThrough: true, runToActivityId: node.id });
            return;
          }
          if (act === 'delete') {
            deleteActivityById(node.id);
            return;
          }
          if (act === 'open') {
            vscode.postMessage({
              type: 'openWorkflow',
              workflowPath: String(node.properties?.workflowPath || '')
            });
            return;
          }
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
      if (!state.workflow.activities.length) {
        const empty = document.createElement('div');
        empty.className = 'canvas-empty';
        empty.innerHTML =
          '<h3>Start your sequence</h3>' +
          '<p>Drag from Activities, click the + between steps, or press ⌘/Ctrl+K to insert.</p>';
        els.sequence.appendChild(empty);
        els.sequence.appendChild(dropZone('root'));
        return;
      }
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
        const selWarn = selectorCardWarn(node);
        const warnHtml = selWarn
          ? '<div class="card-warn' + (selWarn.level === 'weak' ? ' weak' : '') + '" style="margin-top:4px;">' + escapeHtml(selWarn.text) + '</div>'
          : '';
        el.dataset.id = node.id;
        el.className = 'flow-node' +
          (state.selectedId === node.id ? ' selected' : '') +
          (isDecision ? ' decision' : '') +
          (isStart ? ' start' : '') +
          (isEnd ? ' end' : '') +
          (selWarn && (selWarn.level === 'empty' || selWarn.level === 'placeholder') ? ' selector-missing' : '') +
          dryRunClass(node.id);
        el.style.left = (node.x || 40) + 'px';
        el.style.top = (node.y || 40) + 'px';
        el.style.borderColor = node.color || def?.color || undefined;
        const bpOn = !!state.breakpoints[node.id];
        const bpBtn = '<button type="button" class="card-bp' + (bpOn ? ' on' : '') + '" data-flow-bp="1" title="Toggle breakpoint"></button>';
        if (bpOn) el.classList.add('has-bp');
        if (isDecision) {
          el.innerHTML = bpBtn + '<div class="inner"><div class="title">' + escapeHtml(node.displayName) + '</div><div class="summary">' + escapeHtml(summary(node)) + '</div></div><div class="port" title="Drag to connect"></div>';
        } else {
          el.innerHTML = bpBtn + '<div class="title">' + escapeHtml(node.displayName) + '</div>' +
            (isStart || isEnd ? '' : '<div class="summary">' + escapeHtml(summary(node)) + '</div>') +
            warnHtml +
            (isEnd ? '' : '<div class="port" title="Drag to connect"></div>');
        }
        el.querySelector('[data-flow-bp]')?.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleBreakpoint(node.id);
        });
        el.querySelector('[data-flow-bp]')?.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          state.selectedId = node.id;
          postDryRun({ stepThrough: true, runToActivityId: node.id });
        });
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          state.selectedId = node.id;
          showCtxMenu(e.clientX, e.clientY, node.id);
        });

        el.addEventListener('mousedown', (e) => {
          if (e.target.classList.contains('port')) return;
          state.selectedId = node.id;
          state.draggingId = node.id;
          const pt = stagePoint(e);
          state.dragOffset = { x: pt.x - (node.x || 0), y: pt.y - (node.y || 0) };
          hideTip();
          renderProps();
          renderConnectionsPanel();
          document.querySelectorAll('.flow-node').forEach(n => n.classList.remove('selected'));
          el.classList.add('selected');
        });

        el.addEventListener('mouseenter', (e) => {
          if (state.draggingId) return;
          showTip(tipHtml(node), e.clientX, e.clientY);
        });
        el.addEventListener('mousemove', (e) => {
          if (state.draggingId) return;
          showTip(tipHtml(node), e.clientX, e.clientY);
        });
        el.addEventListener('mouseleave', hideTip);

        el.addEventListener('dblclick', () => {
          if (node.type === 'REFramework.InvokeWorkflow' && node.properties?.workflowPath) {
            vscode.postMessage({ type: 'openWorkflow', workflowPath: String(node.properties.workflowPath) });
          }
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
        const pt = stagePoint(e);
        const node = createActivity(type, pt.x - 60, pt.y - 20);
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
      const pt = stagePoint(e);
      node.x = Math.max(0, pt.x - state.dragOffset.x);
      node.y = Math.max(0, pt.y - state.dragOffset.y);
      hideTip();
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

    function propSection(id, title, bodyHtml) {
      const collapsed = !!state.collapsedPropSections[id];
      return '<div class="prop-section' + (collapsed ? ' collapsed' : '') + '" data-section="' + escapeAttr(id) + '">' +
        '<button type="button" class="prop-section-head"><span class="chev">' + (collapsed ? '▸' : '▾') + '</span> ' +
        escapeHtml(title) + '</button>' +
        '<div class="prop-section-body">' + bodyHtml + '</div></div>';
    }
    function fieldHtml(label, inner, required) {
      return '<div class="field"><label>' + escapeHtml(label) + (required ? ' *' : '') + '</label>' + inner + '</div>';
    }
    function suggestionListFor(node, p) {
      const s = state.suggestions || {};
      const name = p.name || '';
      const type = p.type || '';
      if (node.type === 'REFramework.InvokeWorkflow' && name === 'workflowPath') {
        return s.workflowPaths || [];
      }
      if (name === 'to' || name === 'result' || name === 'item' || name === 'row' || name === 'dataTable' || name === 'values' || name === 'argumentMappings') {
        const vars = s.variables || [];
        const args = (state.workflow.arguments || []).map(a => a.name);
        return [...vars, ...args];
      }
      if (type === 'expression' || name === 'condition' || name === 'message' || name === 'text' || name === 'url' || name === 'value' || name === 'jsonString' || name === 'arrayRow' || name === 'subject' || name === 'body') {
        const vars = s.variables || [];
        const args = (state.workflow.arguments || []).map(a => a.name);
        const cfg = s.configExpressions || [];
        return [...vars, ...args, ...cfg].slice(0, 40);
      }
      if (name.toLowerCase().includes('config') || name === 'path' || name === 'workbookPath' || name === 'file') {
        return [...(s.configKeys || []), ...(s.workflowPaths || [])].slice(0, 40);
      }
      return [];
    }
    function suggestChipsHtml(node, p) {
      const list = suggestionListFor(node, p).slice(0, 8);
      if (!list.length) return '';
      return '<div class="suggest-chips" data-suggest-for="' + escapeAttr(p.name) + '">' +
        list.map(v => '<button type="button" data-suggest-value="' + escapeAttr(v) + '" title="' + escapeAttr(v) + '">' + escapeHtml(v) + '</button>').join('') +
        '</div>';
    }
    function renderPropInput(p, val, node) {
      const listId = 'dl_' + p.name;
      const suggestions = suggestionListFor(node, p);
      const datalist = suggestions.length
        ? '<datalist id="' + escapeAttr(listId) + '">' +
          suggestions.map(v => '<option value="' + escapeAttr(v) + '"></option>').join('') +
          '</datalist>'
        : '';
      const listAttr = suggestions.length ? ' list="' + escapeAttr(listId) + '"' : '';
      if (p.type === 'enum') {
        return '<select data-prop="' + escapeAttr(p.name) + '">' +
          (p.options || []).map(o => '<option value="' + escapeAttr(o) + '"' + (String(val) === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>').join('') +
          '</select>';
      }
      if (p.type === 'boolean') {
        return '<select data-prop="' + escapeAttr(p.name) + '"><option value="true"' + (val === true || val === 'true' ? ' selected' : '') + '>true</option><option value="false"' + (val === false || val === 'false' ? ' selected' : '') + '>false</option></select>';
      }
      if (p.type === 'multiline') {
        return '<div class="field-with-expand"><textarea data-prop="' + escapeAttr(p.name) + '">' + escapeHtml(String(val)) + '</textarea>' +
          '<button type="button" class="btn-expand-expr" data-expand-prop="' + escapeAttr(p.name) + '" title="Expand editor">⛶</button></div>' + suggestChipsHtml(node, p);
      }
      if (p.type === 'number') {
        return '<input type="number" data-prop="' + escapeAttr(p.name) + '" value="' + escapeAttr(String(val)) + '" />';
      }
      if (p.type === 'expression') {
        return '<div class="field-with-expand"><input data-prop="' + escapeAttr(p.name) + '" value="' + escapeAttr(String(val)) + '"' + listAttr + ' />' +
          '<button type="button" class="btn-expand-expr" data-expand-prop="' + escapeAttr(p.name) + '" title="Expand editor">⛶</button></div>' + datalist + suggestChipsHtml(node, p);
      }
      return '<input data-prop="' + escapeAttr(p.name) + '" value="' + escapeAttr(String(val)) + '"' + listAttr + ' />' + datalist + suggestChipsHtml(node, p);
    }

    function studioWebChecklistHtml(node, def) {
      const items = [];
      const props = def?.properties || [];
      for (const p of props) {
        if (!p.required) continue;
        if (node.type === 'UI.UseApplicationBrowser' && p.name === 'browserType' && String(node.properties?.mode || 'Browser') !== 'Browser') {
          continue;
        }
        const val = node.properties?.[p.name];
        const ok = val !== undefined && val !== null && String(val).trim() !== '';
        items.push({
          ok: ok,
          text: ok
            ? 'Required “' + p.label + '” is set'
            : 'Set required “' + p.label + '” before Studio Web publish'
        });
      }
      const hasSelector = props.some(p => p.name === 'selector');
      if (hasSelector && String(node.type || '').startsWith('UI.') && node.type !== 'UI.OpenApplication' && node.type !== 'UI.TakeScreenshot') {
        const q = scoreSelector(node.properties?.selector);
        const ok = q.level === 'ok' || q.level === 'strong';
        items.push({
          ok: ok,
          text: ok
            ? 'Selector looks ready for Windows (score ' + q.score + ')'
            : (q.cardMessage || 'Fix selector for Studio Web / Windows robot')
        });
      }
      if (node.type === 'REFramework.InvokeWorkflow') {
        const wp = String(node.properties?.workflowPath || '').trim();
        const known = (state.suggestions?.workflowPaths || []).map(String);
        const ok = !!wp && (known.length === 0 || known.some(k => k === wp || k.endsWith('/' + wp) || k.endsWith('\\\\' + wp)));
        items.push({
          ok: !!wp,
          text: wp
            ? (ok ? 'Invoke path set: ' + wp : 'Invoke path set — confirm file exists in project')
            : 'Invoke Workflow needs a workflow path'
        });
      }
      if (String(node.type || '').startsWith('Imported.')) {
        items.push({
          ok: false,
          text: 'Imported.* type — map to a real LCS activity before Studio Web round-trip'
        });
      }
      if (!def) {
        items.push({ ok: false, text: 'Unknown activity type — Studio Web may not restore it' });
      }
      if (!items.length) {
        return '<div class="studio-web-check"><div class="swc-summary">No Studio Web blockers for this activity.</div>' +
          '<div class="swc-row ok"><span class="swc-mark">✓</span><span class="swc-text">Ready to sync / publish</span></div></div>';
      }
      const bad = items.filter(i => !i.ok).length;
      const summary = bad
        ? bad + ' item(s) to fix before Studio Web is happy with this step'
        : 'All checks passed for this activity';
      return '<div class="studio-web-check"><div class="swc-summary">' + escapeHtml(summary) + '</div>' +
        items.map(i =>
          '<div class="swc-row ' + (i.ok ? 'ok' : 'bad') + '"><span class="swc-mark">' + (i.ok ? '✓' : '!') +
          '</span><span class="swc-text">' + escapeHtml(i.text) + '</span></div>'
        ).join('') +
        '</div>';
    }

    function renderProps() {
      syncSuggestionVariables();
      const hit = state.selectedId ? walkFind(state.workflow.activities, state.selectedId) : null;
      els.btnDelete.disabled = !hit;
      if (!hit) {
        els.props.innerHTML = '<div class="empty">Select a step to edit properties. In Flowchart mode, drag the blue port to connect nodes.</div>';
        renderBreadcrumbs();
        return;
      }
      const node = hit.node;
      const def = findDef(node.type);
      const currentColor = node.color || def?.color || '#64748B';
      const presets = ['#3B82F6','#8B5CF6','#F59E0B','#10B981','#EF4444','#64748B'];

      let general = fieldHtml('Display Name', '<input id="prop_displayName" value="' + escapeAttr(node.displayName) + '" />');
      general += fieldHtml('Type', '<input value="' + escapeAttr(node.type) + '" disabled />');
      general += '<div class="field"><label>Container color</label>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
        presets.map(c => '<button type="button" class="icon-btn" data-color="' + c + '" title="' + c + '" style="background:' + c + ';border-color:transparent;width:22px;height:22px;"></button>').join('') +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input type="color" id="prop_color" value="' + escapeAttr(currentColor) + '" style="width:48px;height:32px;padding:0;border:none;background:transparent;" />' +
        '<input id="prop_color_hex" value="' + escapeAttr(currentColor) + '" placeholder="#RRGGBB" />' +
        '<button class="btn" id="btnResetColor" type="button">Reset</button>' +
        '</div></div>';

      let activity = '';
      const selectorProps = [];
      const mode = String(node.properties?.mode || 'Browser');
      for (const p of (def?.properties || [])) {
        if (node.type === 'UI.UseApplicationBrowser') {
          if (p.name === 'browserType' && mode !== 'Browser') continue;
        }
        const val = node.properties?.[p.name] ?? '';
        let label = p.label;
        if (node.type === 'UI.UseApplicationBrowser' && p.name === 'urlOrPath') {
          label = mode === 'Application' ? 'Application Path' : 'URL';
        }
        if (p.name === 'selectorModern') {
          const hasModern = String(val || '').trim();
          const body = fieldHtml(label, renderPropInput(p, val, node));
          if (hasModern) {
            activity += body;
          } else {
            activity += '<details class="modern-sel"><summary>Modern Selector (advanced) — usually leave blank</summary>' + body + '</details>';
          }
          continue;
        }
        activity += fieldHtml(label, renderPropInput(p, val, node), p.required);
        if (p.name === 'selector') {
          activity += selectorBuilderHtml(p.name, val);
          selectorProps.push(p.name);
        }
        if (node.type === 'REFramework.InvokeWorkflow' && p.name === 'workflowPath') {
          activity += '<div class="field"><button class="btn primary" id="btnOpenWorkflow" type="button">Open Workflow in New Tab</button></div>';
        }
      }
      if (!activity) activity = '<div class="empty">No activity-specific properties.</div>';

      let flow = '';
      if (isFlow()) {
        flow += fieldHtml('Position', '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><input value="x=' + Math.round(node.x || 0) + '" disabled /><input value="y=' + Math.round(node.y || 0) + '" disabled /></div>');
        flow += '<div class="field"><button class="btn" id="btnSetStart" type="button">Use as flowchart start</button></div>';
      }

      const studioWeb = studioWebChecklistHtml(node, def);

      let html = propSection('general', 'General', general);
      html += propSection('activity', 'Activity', activity);
      html += propSection('studioWeb', 'Required for Studio Web', studioWeb);
      if (flow) html += propSection('flow', 'Flowchart', flow);
      els.props.innerHTML = html;

      els.props.querySelectorAll('.prop-section-head').forEach(btn => {
        btn.addEventListener('click', () => {
          const section = btn.parentElement.getAttribute('data-section');
          state.collapsedPropSections[section] = !state.collapsedPropSections[section];
          renderProps();
        });
      });

      document.getElementById('prop_displayName')?.addEventListener('change', (e) => {
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
        // Keep in-memory state current while typing so Cmd+S / Save flush latest values
        input.addEventListener('input', () => {
          const key = input.getAttribute('data-prop');
          if (!key) return;
          let value = input.value;
          const pdef = def?.properties.find(p => p.name === key);
          if (pdef?.type === 'number') value = Number(value);
          if (pdef?.type === 'boolean') value = value === 'true';
          node.properties[key] = value;
        });
      });
      document.getElementById('btnSetStart')?.addEventListener('click', () => {
        state.workflow.startActivityId = node.id;
        toast('Start node set');
        persist(false);
      });
      document.getElementById('btnOpenWorkflow')?.addEventListener('click', () => {
        vscode.postMessage({
          type: 'openWorkflow',
          workflowPath: String(node.properties?.workflowPath || '')
        });
      });
      selectorProps.forEach(propName => wireSelectorBuilder(els.props, node, propName));
      els.props.querySelectorAll('[data-suggest-value]').forEach(btn => {
        btn.addEventListener('click', () => {
          const prop = btn.closest('[data-suggest-for]')?.getAttribute('data-suggest-for');
          const value = btn.getAttribute('data-suggest-value') || '';
          if (!prop) return;
          const input = els.props.querySelector('[data-prop="' + prop + '"]');
          if (input) input.value = value;
          node.properties[prop] = value;
          toast('Applied ' + value);
          persist(true);
        });
      });
      els.props.querySelectorAll('[data-expand-prop]').forEach(btn => {
        btn.addEventListener('click', () => {
          const prop = btn.getAttribute('data-expand-prop');
          if (!prop) return;
          openExprEditor(node, prop, def);
        });
      });
      renderBreadcrumbs();
    }

    function openExprEditor(node, propName, def) {
      const pdef = (def?.properties || []).find(p => p.name === propName);
      const label = pdef?.label || propName;
      state.exprEdit = { nodeId: node.id, prop: propName };
      if (els.exprDialogTitle) els.exprDialogTitle.textContent = label + ' — ' + (node.displayName || node.type);
      if (els.exprDialogValue) els.exprDialogValue.value = String(node.properties?.[propName] ?? '');
      els.exprOverlay?.classList.add('show');
      els.exprDialogValue?.focus();
    }
    function closeExprEditor() {
      state.exprEdit = null;
      els.exprOverlay?.classList.remove('show');
    }
    function applyExprEditor() {
      if (!state.exprEdit) return;
      const hit = walkFind(state.workflow.activities, state.exprEdit.nodeId);
      if (!hit) { closeExprEditor(); return; }
      const prop = state.exprEdit.prop;
      hit.node.properties = hit.node.properties || {};
      hit.node.properties[prop] = els.exprDialogValue?.value ?? '';
      closeExprEditor();
      persist(true);
      toast('Expression updated');
    }

    function renderBreadcrumbs() {
      if (!els.breadcrumbs) return;
      const rootLabel = state.workflow.name || 'Root';
      if (!state.selectedId) {
        els.breadcrumbs.innerHTML = '<span class="crumb-current">' + escapeHtml(rootLabel) + '</span>';
        return;
      }
      const chain = walkAncestors(state.workflow.activities, state.selectedId) || [];
      if (!chain.length) {
        els.breadcrumbs.innerHTML = '<span class="crumb-current">' + escapeHtml(rootLabel) + '</span>';
        return;
      }
      let html = '<button type="button" data-crumb="">' + escapeHtml(rootLabel) + '</button>';
      chain.forEach((n, i) => {
        html += '<span class="crumb-sep">›</span>';
        if (i === chain.length - 1) {
          html += '<span class="crumb-current">' + escapeHtml(n.displayName || n.type) + '</span>';
        } else {
          html += '<button type="button" data-crumb="' + escapeAttr(n.id) + '">' + escapeHtml(n.displayName || n.type) + '</button>';
        }
      });
      els.breadcrumbs.innerHTML = html;
      els.breadcrumbs.querySelectorAll('[data-crumb]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-crumb');
          state.selectedId = id || null;
          persist(true);
          if (id) highlightSearchHit(id);
        });
      });
    }

    function highlightSearchHit(id) {
      const el = document.querySelector('[data-id="' + id + '"]');
      if (!el) return;
      el.classList.add('search-hit');
      if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setTimeout(() => el.classList.remove('search-hit'), 900);
    }

    function findInWorkflow(query) {
      const q = String(query || '').trim().toLowerCase();
      if (!q) return null;
      const all = walkCollect(state.workflow.activities);
      return all.find(n =>
        String(n.displayName || '').toLowerCase().includes(q) ||
        String(n.type || '').toLowerCase().includes(q) ||
        String(summary(n) || '').toLowerCase().includes(q)
      ) || null;
    }

    function renderVariables() {
      const vars = state.workflow.variables || [];
      if (els.variablesCount) els.variablesCount.textContent = String(vars.length);
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

    function renderArguments() {
      if (!els.argumentsView) return;
      state.workflow.arguments ||= [];
      const args = state.workflow.arguments;
      if (els.argumentsCount) els.argumentsCount.textContent = String(args.length);
      if (!args.length) {
        els.argumentsView.innerHTML = '<div class="empty">No arguments yet. Add In / Out / InOut for this workflow.</div>';
        return;
      }
      const types = ['String','Int32','Boolean','Double','Object','DataTable','Array'];
      const dirs = ['In','Out','InOut'];
      els.argumentsView.innerHTML = args.map((a, i) => (
        '<div class="field arg-card" data-arg-card="' + i + '">' +
          '<div style="display:grid;grid-template-columns:1fr 28px;gap:6px;align-items:end;">' +
            '<div><label>Name</label><input data-arg="' + i + '" data-field="name" value="' + escapeAttr(a.name || '') + '" /></div>' +
            '<button class="icon-btn" data-del-arg="' + i + '" title="Remove">✕</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">' +
            '<div><label>Direction</label><select data-arg="' + i + '" data-field="direction">' +
              dirs.map(d => '<option' + ((a.direction || 'In') === d ? ' selected' : '') + '>' + d + '</option>').join('') +
            '</select></div>' +
            '<div><label>Type</label><select data-arg="' + i + '" data-field="type">' +
              types.map(t => '<option' + (a.type === t ? ' selected' : '') + '>' + t + '</option>').join('') +
            '</select></div>' +
          '</div>' +
          '<div class="field" style="margin-top:6px;margin-bottom:0"><label>Default</label><input data-arg="' + i + '" data-field="defaultValue" value="' + escapeAttr(a.defaultValue === undefined || a.defaultValue === null ? '' : String(a.defaultValue)) + '" /></div>' +
        '</div>'
      )).join('<div style="height:10px"></div>');
      const applyArgField = (input) => {
        const i = Number(input.getAttribute('data-arg'));
        const field = input.getAttribute('data-field');
        if (!state.workflow.arguments || !state.workflow.arguments[i] || !field) return;
        if (field === 'defaultValue') {
          const t = state.workflow.arguments[i].type;
          let val = input.value;
          if (t === 'Int32' || t === 'Double') val = Number(val || 0);
          if (t === 'Boolean') val = val === 'true';
          state.workflow.arguments[i].defaultValue = val;
        } else {
          state.workflow.arguments[i][field] = input.value;
        }
        vscode.postMessage({ type: 'edit', workflow: state.workflow });
        vscode.postMessage({ type: 'argumentsChanged', workflowArguments: state.workflow.arguments });
      };
      els.argumentsView.querySelectorAll('[data-arg]').forEach(input => {
        input.addEventListener('change', () => applyArgField(input));
        input.addEventListener('blur', () => applyArgField(input));
      });
      els.argumentsView.querySelectorAll('[data-del-arg]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = Number(btn.getAttribute('data-del-arg'));
          if (!Array.isArray(state.workflow.arguments)) return;
          state.workflow.arguments.splice(idx, 1);
          persist(true);
          vscode.postMessage({ type: 'argumentsChanged', workflowArguments: state.workflow.arguments });
          toast('Argument removed');
        });
      });
    }

    function renderConnectionsPanel() {
      if (!isFlow()) {
        if (els.connectionsSection) els.connectionsSection.style.display = 'none';
        return;
      }
      if (els.connectionsSection) els.connectionsSection.style.display = '';
      const conns = state.workflow.connections || [];
      if (els.connectionsCount) els.connectionsCount.textContent = String(conns.length);
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

    function toggleSideSection(sectionEl) {
      if (!sectionEl) return;
      sectionEl.classList.toggle('collapsed');
      const chev = sectionEl.querySelector('.chev');
      if (chev) chev.textContent = sectionEl.classList.contains('collapsed') ? '▸' : '▾';
    }

    function autoLayout() {
      if (!isFlow()) {
        toast('Tidy is for Flowchart workflows');
        return;
      }
      const nodes = state.workflow.activities || [];
      if (!nodes.length) return;
      const COL_GAP = 240;
      const ROW_GAP = 168;
      const ORIGIN_X = 72;
      const ORIGIN_Y = 48;
      nodes.forEach((n, i) => {
        n.x = ORIGIN_X + (i % 3) * COL_GAP;
        n.y = ORIGIN_Y + Math.floor(i / 3) * ROW_GAP;
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
        // Orphan nodes (unreachable) get a trailing depth bucket
        let maxD = 0;
        for (const d of depth.values()) maxD = Math.max(maxD, d);
        for (const n of nodes) {
          if (!depth.has(n.id)) depth.set(n.id, maxD + 1);
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
          // Stable order: Start first, End last, then displayName
          list.sort((a, b) => {
            const rank = (n) => n.type === 'Flowchart.Start' ? -1 : n.type === 'Flowchart.End' ? 1 : 0;
            const r = rank(a) - rank(b);
            if (r) return r;
            return String(a.displayName || '').localeCompare(String(b.displayName || ''));
          });
          const rowWidth = Math.max(0, (list.length - 1) * COL_GAP);
          const startX = ORIGIN_X + Math.max(0, (COL_GAP * 2 - rowWidth) / 2);
          list.forEach((n, i) => {
            n.x = Math.round(startX + i * COL_GAP);
            n.y = ORIGIN_Y + d * ROW_GAP;
          });
        });
      }
      persist(true);
      toast('Tidy applied');
    }

    function renderAll() {
      state.workflow.variables ||= [];
      state.workflow.arguments ||= [];
      els.workflowName.value = state.workflow.name || '';
      els.workflowType.textContent = state.workflow.type || 'Sequence';
      els.workflowType.classList.toggle('flow', isFlow());
      els.btnLink.style.display = isFlow() ? '' : 'none';
      els.btnAutoLayout.style.display = isFlow() ? '' : 'none';
      els.canvasHelp.textContent = isFlow()
        ? 'Flowchart · drag nodes · blue ports to link · bottom dock for zoom & run'
        : 'Sequence · drag activities onto the board · bottom dock for zoom, insert & run';
      applyZoom();
      renderCatalog();
      renderProjectTree();
      if (isFlow()) renderFlowchart(); else renderSequence();
      renderProps();
      renderVariables();
      renderArguments();
      renderBreadcrumbs();
      renderConnectionsPanel();
      syncDockActive();
    }

    function persist(rerender) {
      try {
        if (!Array.isArray(state.workflow.variables)) state.workflow.variables = [];
        if (!Array.isArray(state.workflow.arguments)) state.workflow.arguments = [];
        vscode.postMessage({ type: 'edit', workflow: state.workflow });
        if (rerender) renderAll();
        else if (isFlow()) {
          renderVariables();
          renderArguments();
          renderBreadcrumbs();
        } else {
          renderSequence();
          renderProps();
          renderVariables();
          renderArguments();
          renderBreadcrumbs();
        }
      } catch (err) {
        toast('Edit failed: ' + (err && err.message ? err.message : String(err)));
      }
    }

    els.workflowName.addEventListener('change', () => {
      state.workflow.name = els.workflowName.value || 'Untitled';
      persist(false);
    });
    els.search.addEventListener('input', renderCatalog);
    document.getElementById('btnExpandCats')?.addEventListener('click', () => {
      state.collapsedCats = {};
      renderCatalog();
    });
    document.getElementById('btnCollapseCats')?.addEventListener('click', () => {
      const cats = new Set(state.catalog.map(a => a.category));
      state.collapsedCats = {};
      for (const c of cats) state.collapsedCats[c] = true;
      renderCatalog();
    });
    document.getElementById('btnExpandProps')?.addEventListener('click', () => {
      state.collapsedPropSections = {};
      renderProps();
    });
    document.getElementById('btnCollapseProps')?.addEventListener('click', () => {
      state.collapsedPropSections = { general: true, activity: true, studioWeb: true, flow: true };
      renderProps();
    });
    document.getElementById('btnToggleConnections')?.addEventListener('click', () => {
      toggleSideSection(els.connectionsSection);
    });
    document.getElementById('btnPropsFloat')?.addEventListener('click', () => {
      state.propsMode = 'floating';
      applyFrameLayouts();
      toast('Properties floating');
    });
    document.getElementById('btnPropsDock')?.addEventListener('click', () => {
      state.propsMode = 'docked';
      state.propsFloatPos = { x: null, y: null };
      applyFrameLayouts();
      toast('Properties docked');
    });
    document.getElementById('btnPropsExpand')?.addEventListener('click', () => {
      state.propsMode = 'docked';
      applyFrameLayouts();
    });
    document.getElementById('btnLeftFloat')?.addEventListener('click', () => {
      state.leftMode = 'floating';
      applyFrameLayouts();
      toast('Toolbox floating');
    });
    document.getElementById('btnLeftDock')?.addEventListener('click', () => {
      state.leftMode = 'docked';
      state.leftFloatPos = { x: null, y: null };
      applyFrameLayouts();
      toast('Toolbox docked');
    });
    document.getElementById('btnLeftExpand')?.addEventListener('click', () => {
      state.leftMode = 'docked';
      applyFrameLayouts();
    });
    document.getElementById('dockLeft')?.addEventListener('click', () => {
      state.leftMode = state.leftMode === 'collapsed' ? 'docked' : 'collapsed';
      applyFrameLayouts();
    });
    document.getElementById('dockProps')?.addEventListener('click', () => {
      state.propsMode = state.propsMode === 'collapsed' ? 'docked' : 'collapsed';
      applyFrameLayouts();
    });

    (function bindFrameInteractions() {
      const propsX = document.getElementById('propsResizeX');
      const propsY = document.getElementById('propsResizeY');
      const propsChrome = document.getElementById('propsChrome');
      const leftX = document.getElementById('leftResizeX');
      const leftY = document.getElementById('leftResizeY');
      const leftChrome = document.getElementById('leftChrome');
      let mode = null;
      let start = { x: 0, y: 0, w: 0, h: 0, left: 0, top: 0 };
      const begin = (nextMode, e, handle) => {
        e.preventDefault();
        mode = nextMode;
        handle?.classList.add('dragging');
        start = {
          x: e.clientX, y: e.clientY,
          w: nextMode.startsWith('left') ? state.leftWidth : state.propsWidth,
          h: nextMode.startsWith('left') ? state.leftHeight : state.propsHeight,
          left: 0, top: 0
        };
      };
      propsX?.addEventListener('mousedown', (e) => begin('props-x', e, propsX));
      propsY?.addEventListener('mousedown', (e) => {
        if (state.propsMode !== 'floating') return;
        begin('props-y', e, propsY);
      });
      propsChrome?.addEventListener('mousedown', (e) => {
        if (state.propsMode !== 'floating') return;
        if (e.target.closest('button')) return;
        mode = 'props-move';
        const rect = els.propsPanel.getBoundingClientRect();
        start = { x: e.clientX, y: e.clientY, w: state.propsWidth, h: state.propsHeight, left: rect.left, top: rect.top };
      });
      leftX?.addEventListener('mousedown', (e) => begin('left-x', e, leftX));
      leftY?.addEventListener('mousedown', (e) => {
        if (state.leftMode !== 'floating') return;
        begin('left-y', e, leftY);
      });
      leftChrome?.addEventListener('mousedown', (e) => {
        if (state.leftMode !== 'floating') return;
        if (e.target.closest('button')) return;
        mode = 'left-move';
        const rect = els.toolbox.getBoundingClientRect();
        start = { x: e.clientX, y: e.clientY, w: state.leftWidth, h: state.leftHeight, left: rect.left, top: rect.top };
      });
      window.addEventListener('mousemove', (e) => {
        if (!mode) return;
        if (mode === 'props-x') {
          state.propsWidth = Math.min(560, Math.max(240, start.w + (start.x - e.clientX)));
        } else if (mode === 'props-y') {
          state.propsHeight = Math.min(window.innerHeight - 90, Math.max(280, start.h + (e.clientY - start.y)));
        } else if (mode === 'props-move') {
          state.propsFloatPos = {
            x: Math.max(8, start.left + (e.clientX - start.x)),
            y: Math.max(8, start.top + (e.clientY - start.y))
          };
        } else if (mode === 'left-x') {
          state.leftWidth = Math.min(480, Math.max(220, start.w + (e.clientX - start.x)));
        } else if (mode === 'left-y') {
          state.leftHeight = Math.min(window.innerHeight - 90, Math.max(280, start.h + (e.clientY - start.y)));
        } else if (mode === 'left-move') {
          state.leftFloatPos = {
            x: Math.max(8, start.left + (e.clientX - start.x)),
            y: Math.max(8, start.top + (e.clientY - start.y))
          };
        }
        applyFrameLayouts();
      });
      window.addEventListener('mouseup', () => {
        if (!mode) return;
        mode = null;
        propsX?.classList.remove('dragging');
        propsY?.classList.remove('dragging');
        leftX?.classList.remove('dragging');
        leftY?.classList.remove('dragging');
        applyFrameLayouts();
      });
    })();

    document.getElementById('btnZoomIn')?.addEventListener('click', () => setZoom(state.zoom + 0.1));
    document.getElementById('btnZoomOut')?.addEventListener('click', () => setZoom(state.zoom - 0.1));
    document.getElementById('btnZoomReset')?.addEventListener('click', () => setZoom(1));
    document.getElementById('canvasWrap')?.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(state.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    }, { passive: false });
    document.getElementById('btnSave').addEventListener('click', () => {
      // Flush current workflow with Save so Studio Web Local sync sees latest edits
      vscode.postMessage({ type: 'save', workflow: state.workflow });
    });
    document.getElementById('btnValidate').addEventListener('click', () => {
      vscode.postMessage({ type: 'validate', workflow: state.workflow });
    });
    function dryRunClass(id) {
      if (!state.playback) return '';
      const step = state.playback.steps[state.playback.index];
      if (step && step.activityId === id) {
        if (step.status === 'error') return ' dry-run-active dry-run-error';
        if (step.status === 'warn') return ' dry-run-active dry-run-warn';
        return ' dry-run-active';
      }
      if (state.playback.doneIds && state.playback.doneIds.has(id)) return ' dry-run-done';
      return '';
    }
    function stopPlayback() {
      if (state.playback?.timer) clearInterval(state.playback.timer);
      state.playback = null;
      const bar = document.getElementById('playbackBar');
      if (bar) bar.classList.remove('show');
      renderAll();
    }
    function showPlaybackStep() {
      const pb = state.playback;
      if (!pb) return;
      const bar = document.getElementById('playbackBar');
      const label = document.getElementById('playbackLabel');
      const varsEl = document.getElementById('playbackVars');
      if (!bar) return;
      bar.classList.add('show');
      pb.doneIds = new Set(pb.steps.slice(0, Math.max(0, pb.index)).map(s => s.activityId));
      if (pb.index >= pb.steps.length) {
        pb.doneIds = new Set(pb.steps.map(s => s.activityId));
        if (label) label.textContent = 'Done — ' + pb.steps.length + ' steps';
        if (varsEl) varsEl.textContent = pb.finalVars
          ? Object.keys(pb.finalVars).slice(0, 8).map(k => k + '=' + JSON.stringify(pb.finalVars[k])).join(' · ')
          : '';
        pb.liveVars = pb.finalVars || pb.liveVars;
        renderWatch(pb.liveVars);
        if (pb.timer) { clearInterval(pb.timer); pb.timer = null; }
        renderAll();
        toast('Step-through complete');
        return;
      }
      const step = pb.steps[pb.index];
      state.selectedId = step.activityId;
      const kind = step.executionKind || '';
      const kindHtml = kind ? ' <span class="pb-kind kind-badge ' + kind + '">' + kind + '</span>' : '';
      if (label) {
        label.innerHTML = '[' + step.index + '/' + pb.steps.length + '] ' + escapeHtml(step.displayName) + ' — ' + escapeHtml(step.action) + kindHtml;
      }
      if (varsEl) {
        const keys = step.changedKeys || [];
        varsEl.textContent = keys.length
          ? ('Δ ' + keys.map(k => k + '=' + JSON.stringify((step.variablesSnapshot || {})[k])).join(' · '))
          : 'no variable changes';
      }
      pb.liveVars = Object.assign({}, step.variablesSnapshot || pb.liveVars || {});
      renderWatch(pb.liveVars);
      setLeftTab('watch');
      renderAll();
      const el = document.querySelector('[data-id="' + step.activityId + '"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // Pause when hitting a breakpoint (except the very first shown step unless continuing)
      if (pb.timer && pb.index > 0 && state.breakpoints[step.activityId]) {
        clearInterval(pb.timer);
        pb.timer = null;
        toast('Breakpoint · ' + step.displayName);
      }
      // Run-to-here target reached
      if (pb.runToActivityId && step.activityId === pb.runToActivityId) {
        if (pb.timer) { clearInterval(pb.timer); pb.timer = null; }
        pb.runToActivityId = null;
        toast('Stopped at target');
      }
    }
    function stepPlayback() {
      if (!state.playback) return;
      if (state.playback.index >= state.playback.steps.length) {
        stopPlayback();
        return;
      }
      state.playback.index += 1;
      showPlaybackStep();
    }
    function startPlayback(result, opts) {
      const o = opts || {};
      if (state.playback?.timer) clearInterval(state.playback.timer);
      state.playback = {
        steps: result.steps || [],
        index: 0,
        timer: null,
        doneIds: new Set(),
        finalVars: result.variables || {},
        liveVars: Object.assign({}, result.variables || {}),
        runToActivityId: o.runToActivityId || null
      };
      if (!state.playback.steps.length) {
        toast('No steps to play');
        stopPlayback();
        return;
      }
      showPlaybackStep();
      // Auto-continue to run-to-here or first breakpoint after start
      if (state.playback.runToActivityId || Object.keys(state.breakpoints).length) {
        continuePlayback();
      }
    }
    function continuePlayback() {
      if (!state.playback) return;
      if (state.playback.timer) return;
      state.playback.timer = setInterval(() => {
        if (!state.playback) return;
        if (state.playback.index >= state.playback.steps.length - 1) {
          state.playback.index = state.playback.steps.length;
          showPlaybackStep();
          return;
        }
        stepPlayback();
      }, 650);
    }

    document.getElementById('btnDryRun').addEventListener('click', () => {
      postDryRun({ stepThrough: false });
    });
    document.getElementById('btnStepThrough').addEventListener('click', () => {
      postDryRun({ stepThrough: true });
    });
    document.getElementById('btnPbRunTo')?.addEventListener('click', () => {
      if (!state.selectedId) { toast('Select an activity first'); return; }
      postDryRun({ stepThrough: true, runToActivityId: state.selectedId });
    });
    document.getElementById('btnFixturesApply')?.addEventListener('click', () => {
      state.fixtures = parseFixturesEditor();
      toast('Fixtures applied (' + Object.keys(state.fixtures).length + ' keys)');
    });
    document.getElementById('btnFixturesClear')?.addEventListener('click', () => {
      state.fixtures = {};
      if (els.fixturesEditor) els.fixturesEditor.value = '';
      toast('Fixtures cleared');
    });
    document.getElementById('btnWatchApply')?.addEventListener('click', () => {
      const seeds = state.playback?.liveVars;
      if (!seeds || !Object.keys(seeds).length) { toast('No watch values'); return; }
      postDryRun({ stepThrough: true, initialVariables: seeds });
    });
    document.getElementById('btnPbStep')?.addEventListener('click', () => stepPlayback());
    document.getElementById('btnPbContinue')?.addEventListener('click', () => continuePlayback());
    document.getElementById('btnPbStop')?.addEventListener('click', () => stopPlayback());
    document.getElementById('btnAddVar').addEventListener('click', () => {
      try {
        if (!Array.isArray(state.workflow.variables)) state.workflow.variables = [];
        const n = state.workflow.variables.length + 1;
        state.workflow.variables.push({ name: 'var' + n, type: 'String', defaultValue: '' });
        openLeftSectionExclusive('variables');
        persist(true);
        vscode.postMessage({ type: 'variablesChanged', variables: state.workflow.variables });
        toast('Variable added');
      } catch (err) {
        toast('Add variable failed: ' + (err && err.message ? err.message : String(err)));
      }
    });
    document.getElementById('btnAddArg')?.addEventListener('click', () => {
      try {
        if (!Array.isArray(state.workflow.arguments)) state.workflow.arguments = [];
        const n = state.workflow.arguments.length + 1;
        state.workflow.arguments.push({
          name: 'in_Arg' + n,
          type: 'String',
          direction: 'In',
          defaultValue: ''
        });
        openLeftSectionExclusive('arguments');
        persist(true);
        vscode.postMessage({ type: 'argumentsChanged', workflowArguments: state.workflow.arguments });
        toast('Argument added');
      } catch (err) {
        toast('Add argument failed: ' + (err && err.message ? err.message : String(err)));
      }
    });
    document.getElementById('exprDialogApply')?.addEventListener('click', () => applyExprEditor());
    document.getElementById('btnSettings')?.addEventListener('click', () => openSettings());
    document.getElementById('settingsDialogCancel')?.addEventListener('click', () => closeSettings());
    document.getElementById('settingsDialogDismiss')?.addEventListener('click', () => closeSettings());
    document.getElementById('settingsDialogApply')?.addEventListener('click', () => saveSettingsFromForm());
    els.settingsOverlay?.addEventListener('click', (e) => {
      if (e.target === els.settingsOverlay) closeSettings();
    });
    els.btnAssistHelp?.addEventListener('click', () => toggleAssistHelp());
    document.getElementById('assistHelpClose')?.addEventListener('click', () => closeAssistHelp());
    document.getElementById('assistHelpDone')?.addEventListener('click', () => closeAssistHelp());
    els.assistHelpOverlay?.addEventListener('click', (e) => {
      if (e.target === els.assistHelpOverlay) closeAssistHelp();
    });
    document.getElementById('exprDialogCancel')?.addEventListener('click', () => closeExprEditor());
    document.getElementById('exprDialogDismiss')?.addEventListener('click', () => closeExprEditor());
    els.exprOverlay?.addEventListener('click', (e) => {
      if (e.target === els.exprOverlay) closeExprEditor();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.assistHelpOpen) {
        e.preventDefault();
        closeAssistHelp();
        return;
      }
      if (e.key === 'Escape' && state.settingsOpen) {
        e.preventDefault();
        closeSettings();
        return;
      }
      if (e.key === 'Escape' && state.exprEdit) {
        e.preventDefault();
        closeExprEditor();
      }
    });
    let searchTimer = null;
    els.workflowSearch?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = els.workflowSearch.value;
        if (!String(q || '').trim()) return;
        const hit = findInWorkflow(q);
        if (!hit) {
          toast('No match for “' + q + '”');
          return;
        }
        state.selectedId = hit.id;
        persist(true);
        highlightSearchHit(hit.id);
      }, 220);
    });
    els.workflowSearch?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const hit = findInWorkflow(els.workflowSearch.value);
      if (!hit) {
        toast('No match');
        return;
      }
      state.selectedId = hit.id;
      persist(true);
      highlightSearchHit(hit.id);
    });
    els.btnDelete.addEventListener('click', () => {
      if (!state.selectedId) return;
      deleteActivityById(state.selectedId);
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
        state.workflow = msg.workflow || {};
        state.workflow.variables ||= [];
        state.workflow.arguments ||= [];
        state.selectedId = null;
        closeExprEditor();
        renderAll();
      }
      if (msg.type === 'insertActivity' && msg.activityType) {
        insertActivityType(msg.activityType, false);
      }
      if (msg.type === 'openActivityPalette') openPalette();
      if (msg.type === 'paletteState' && msg.palette) {
        state.palette = msg.palette;
        if (state.paletteOpen) renderPaletteList();
      }
      if (msg.type === 'projectTree' && Array.isArray(msg.projects)) {
        state.projects = msg.projects;
        renderProjectTree();
      }
      if (msg.type === 'settings' && msg.settings) {
        state.settings = Object.assign({}, state.settings, msg.settings);
        applyDesignerSettings();
        if (state.settingsOpen) fillSettingsForm();
      }
      if (msg.type === 'toast' && msg.message) toast(msg.message, { skipLog: !!msg.logged });
      if (msg.type === 'requestFlush') {
        // Flush typed-but-not-blurred property values into state.workflow before Cmd+S
        vscode.postMessage({ type: 'flushState', workflow: state.workflow });
      }
      if (msg.type === 'dryRunPlayback' && msg.result) {
        if (Array.isArray(msg.breakpoints)) {
          state.breakpoints = {};
          msg.breakpoints.forEach(id => { state.breakpoints[id] = true; });
        }
        startPlayback(msg.result, { runToActivityId: msg.runToActivityId });
      }
      if (msg.type === 'dryRunDone' && msg.result?.warnings?.length) {
        toast(msg.result.warnings.length + ' dry-run warning(s) — see Output');
      }
    });

    function syncSuggestionVariables() {
      state.suggestions = state.suggestions || {};
      state.suggestions.variables = (state.workflow.variables || []).map(v => v.name).filter(Boolean);
    }
    function paletteEntries() {
      const fav = new Set(state.palette?.favorites || []);
      const recent = (state.palette?.recent || []).filter(t => !fav.has(t));
      const byType = new Map(state.catalog.map(a => [a.type, a]));
      const q = (state.paletteQuery || '').trim().toLowerCase();
      const match = (a) => {
        if (!q) return true;
        return (a.displayName + ' ' + a.type + ' ' + a.category + ' ' + (a.description || '')).toLowerCase().includes(q);
      };
      const entries = [];
      for (const type of (state.palette?.favorites || [])) {
        const a = byType.get(type);
        if (a && match(a)) entries.push({ def: a, section: 'Favorites', pinned: true });
      }
      for (const type of recent) {
        const a = byType.get(type);
        if (a && match(a)) entries.push({ def: a, section: 'Recent', pinned: false });
      }
      const used = new Set([...(state.palette?.favorites || []), ...recent]);
      const rest = state.catalog
        .filter(a => !used.has(a.type) && !(a.category === 'Flowchart' && !isFlow()) && match(a))
        .sort((a, b) => (a.category + a.displayName).localeCompare(b.category + b.displayName));
      for (const a of rest) entries.push({ def: a, section: 'All', pinned: false });
      return entries;
    }
    function renderPaletteList() {
      const list = document.getElementById('paletteList');
      if (!list) return;
      const entries = paletteEntries();
      if (state.paletteActive >= entries.length) state.paletteActive = Math.max(0, entries.length - 1);
      if (!entries.length) {
        list.innerHTML = '<div class="empty" style="padding:12px">No activities match.</div>';
        return;
      }
      let html = '';
      let lastSection = '';
      entries.forEach((e, i) => {
        if (e.section !== lastSection) {
          lastSection = e.section;
          html += '<div class="palette-section">' + escapeHtml(e.section) + '</div>';
        }
        html += '<div class="palette-item' + (i === state.paletteActive ? ' active' : '') + '" data-palette-idx="' + i + '" data-type="' + escapeAttr(e.def.type) + '" role="option">' +
          '<div><div class="pi-name">' + escapeHtml(e.def.displayName) + '</div>' +
          '<div class="pi-meta">' + escapeHtml(e.def.category) + ' · ' + escapeHtml(e.def.type) + '</div></div>' +
          '<button type="button" class="pi-pin' + (e.pinned ? ' on' : '') + '" data-pin="' + escapeAttr(e.def.type) + '" title="Pin favorite">' + (e.pinned ? '★' : '☆') + '</button>' +
          '</div>';
      });
      list.innerHTML = html;
      list.querySelectorAll('.palette-item').forEach(row => {
        row.addEventListener('click', (ev) => {
          if (ev.target.closest('[data-pin]')) return;
          insertActivityType(row.getAttribute('data-type'), true);
        });
        row.addEventListener('mousemove', () => {
          state.paletteActive = Number(row.getAttribute('data-palette-idx') || 0);
          list.querySelectorAll('.palette-item').forEach((el, i) => el.classList.toggle('active', i === state.paletteActive));
        });
      });
      list.querySelectorAll('[data-pin]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          vscode.postMessage({ type: 'toggleFavorite', activityType: btn.getAttribute('data-pin') });
        });
      });
      const active = list.querySelector('.palette-item.active');
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
    }
    function openPalette() {
      state.paletteOpen = true;
      state.paletteQuery = '';
      state.paletteActive = 0;
      const overlay = document.getElementById('paletteOverlay');
      const input = document.getElementById('paletteSearch');
      if (overlay) overlay.classList.add('show');
      if (input) { input.value = ''; input.focus(); }
      renderPaletteList();
    }
    function closePalette() {
      state.paletteOpen = false;
      const overlay = document.getElementById('paletteOverlay');
      if (overlay) overlay.classList.remove('show');
    }
    function insertActivityType(type, fromPalette) {
      const node = createActivity(type);
      if (!node) return;
      syncSuggestionVariables();
      if (isFlow()) {
        node.x = 220;
        node.y = 120 + state.workflow.activities.length * 24;
        state.workflow.activities.push(node);
      } else if (state.insertPath) {
        insertAtPath(state.insertPath, node);
        state.insertPath = null;
      } else if (state.selectedId) {
        const hit = walkFind(state.workflow.activities, state.selectedId);
        if (hit) {
          const def = findDef(hit.node.type);
          if (state._insertBefore) {
            hit.list.splice(hit.index, 0, node);
            state._insertBefore = false;
          } else if (def?.container && Array.isArray(hit.node.children) && !state.insertPath) {
            hit.node.children.push(node);
          } else {
            hit.list.splice(hit.index + 1, 0, node);
          }
        } else {
          state.workflow.activities.push(node);
        }
      } else {
        state.workflow.activities.push(node);
      }
      state.selectedId = node.id;
      if (fromPalette) closePalette();
      persist(true);
      toast('Added ' + node.displayName);
      vscode.postMessage({ type: 'activityUsed', activityType: type });
    }

    
    (function wireCtxMenu() {
      const menu = document.getElementById('ctxMenu');
      if (!menu) return;
      menu.querySelectorAll('[data-ctx]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const act = btn.getAttribute('data-ctx');
          const id = state.ctxTargetId || state.selectedId;
          hideCtxMenu();
          if (!id && act !== 'insert-before' && act !== 'insert-after') return;
          if (act === 'delete') { deleteActivityById(id); return; }
          if (act === 'bp') { toggleBreakpoint(id); return; }
          if (act === 'runto') {
            state.selectedId = id;
            postDryRun({ stepThrough: true, runToActivityId: id });
            return;
          }
          if (act === 'dup') {
            const hit = walkFind(state.workflow.activities, id);
            if (!hit) return;
            const clone = JSON.parse(JSON.stringify(hit.node));
            clone.id = 'act_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            hit.list.splice(hit.index + 1, 0, clone);
            state.selectedId = clone.id;
            persist(true);
            toast('Duplicated');
            return;
          }
          if (act === 'insert-before' || act === 'insert-after') {
            const hit = walkFind(state.workflow.activities, id);
            if (!hit) {
              state.insertPath = 'root';
            } else {
              // find path key for list - use root@index style when possible
              const idx = hit.index + (act === 'insert-after' ? 1 : 0);
              // Prefer parent path: if list is root activities
              if (hit.list === state.workflow.activities) {
                state.insertPath = 'root@' + idx;
              } else {
                // Nested: insert relative via selected + splice after open palette
                state.insertPath = null;
                state.selectedId = id;
                state._insertBefore = act === 'insert-before';
              }
            }
            openPalette();
            toast('Pick an activity to insert');
          }
        });
      });
      document.addEventListener('click', () => hideCtxMenu());
      document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.card') && !e.target.closest('.flow-node')) hideCtxMenu();
      });
    })();

    document.getElementById('btnInsert')?.addEventListener('click', () => openPalette());
    document.getElementById('paletteOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'paletteOverlay') closePalette();
    });
    document.getElementById('paletteSearch')?.addEventListener('input', (e) => {
      state.paletteQuery = e.target.value || '';
      state.paletteActive = 0;
      renderPaletteList();
    });
    document.addEventListener('keydown', (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'k') {
        // Designer-local Cmd/Ctrl+K insert palette (does not steal VS Code chord outside webview)
        e.preventDefault();
        if (state.paletteOpen) closePalette();
        else openPalette();
        return;
      }
      if (!state.paletteOpen) return;
      const entries = paletteEntries();
      if (e.key === 'Escape') {
        if (state.settingsOpen) { e.preventDefault(); closeSettings(); return; }
        e.preventDefault(); closePalette(); return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.paletteActive = Math.min(entries.length - 1, state.paletteActive + 1);
        renderPaletteList();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.paletteActive = Math.max(0, state.paletteActive - 1);
        renderPaletteList();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const hit = entries[state.paletteActive];
        if (hit) insertActivityType(hit.def.type, true);
        return;
      }
      if (meta && e.shiftKey && String(e.key).toLowerCase() === 'p') {
        e.preventDefault();
        const hit = entries[state.paletteActive];
        if (hit) vscode.postMessage({ type: 'toggleFavorite', activityType: hit.def.type });
      }
    });

    restorePropsPanelState();
    applyPropsPanelLayout();
    syncSuggestionVariables();
    renderAll();
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
