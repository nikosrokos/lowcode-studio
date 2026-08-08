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
  showCardSummaries: boolean;
  compactCards: boolean;
  showConnectors: boolean;
  defaultZoom: number;
  openHomeOnStartup: boolean;
  /** Designer chrome theme — auto follows VS Code; light/dark force LCS tokens. */
  designerTheme: 'auto' | 'light' | 'dark';
};

const DEFAULT_DESIGNER_SETTINGS: DesignerSettings = {
  showLineNumbers: true,
  defaultWorkflowType: 'Sequence',
  autoOpenDesigner: true,
  syncStudioWebOnSave: true,
  uipathTargetFramework: 'Windows',
  canvasStyle: 'plain',
  showCardSummaries: true,
  compactCards: false,
  showConnectors: true,
  defaultZoom: 1,
  openHomeOnStartup: true,
  designerTheme: 'auto'
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
  settings: DesignerSettings = DEFAULT_DESIGNER_SETTINGS,
  /** Codicon stylesheet with @font-face src rewritten to a webview-safe font URI. */
  codiconCssText = ''
): string {
  const workflowJson = JSON.stringify(workflow).replace(/</g, '\\u003c');
  const catalogJson = JSON.stringify(catalog).replace(/</g, '\\u003c');
  const selectorTemplatesJson = JSON.stringify(SELECTOR_TEMPLATES).replace(/</g, '\\u003c');
  const suggestionsJson = JSON.stringify(suggestions).replace(/</g, '\\u003c');
  const paletteJson = JSON.stringify(palette).replace(/</g, '\\u003c');
  const projectsJson = JSON.stringify(projects).replace(/</g, '\\u003c');
  const settingsJson = JSON.stringify(settings).replace(/</g, '\\u003c');
  // Inline (not <link>) so @font-face url() is an absolute webview URI — relative
  // urls inside linked CSS fail under vscode-webview:// and leave empty colored squares.
  const codiconStyle = codiconCssText
    ? `<style nonce="${nonce}">${codiconCssText}</style>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource} data:; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LowCode Studio Designer</title>
  ${codiconStyle}
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
      --activity-column-width: 480px;
      --flow-node-width: 148px;
      --tip-bg: color-mix(in srgb, var(--panel) 92%, var(--text) 8%);
      --tip-border: color-mix(in srgb, var(--border) 80%, var(--text) 20%);
    }
    /* Forced light — cool slate, not cream/terracotta */
    html[data-theme="light"] {
      --bg: #f3f5f8;
      --panel: #ffffff;
      --border: #cfd6e0;
      --text: #1a2332;
      --muted: #5b6575;
      --accent: #0284c7;
      --accent-fg: #ffffff;
      --input-bg: #ffffff;
      --input-border: #b8c0cc;
      --hover: #e8eef5;
      --focus: #0284c7;
      --card: #ffffff;
      --board: #eef1f5;
      --shadow: 0 1px 2px rgba(26,35,50,.06), 0 4px 14px rgba(26,35,50,.08);
      --shadow-sm: 0 1px 2px rgba(26,35,50,.07);
      --shadow-frame: 0 12px 36px rgba(26,35,50,.14), 0 2px 8px rgba(26,35,50,.08);
      --spine: color-mix(in srgb, #5b6575 35%, transparent);
      --tip-bg: #ffffff;
      --tip-border: #aeb8c6;
    }
      
    * {
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--muted) 55%, transparent) transparent;
    }
    *::-webkit-scrollbar { width: 12px; height: 12px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb {
      background-color: color-mix(in srgb, var(--muted) 45%, transparent);
      border-radius: 999px;
      border: 3px solid transparent;
      background-clip: content-box;
    }
    *::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--muted) 70%, transparent); }
    *::-webkit-scrollbar-corner { background: transparent; }

    /* Forced dark — stable tokens independent of host theme */
    html[data-theme="dark"] {
      --bg: #1a1d23;
      --panel: #22262e;
      --border: #3a4150;
      --text: #e6e9ef;
      --muted: #9aa3b2;
      --accent: #0ea5e9;
      --accent-fg: #041018;
      --input-bg: #161920;
      --input-border: #3a4150;
      --hover: #2a303a;
      --focus: #38bdf8;
      --card: #262b34;
      --board: #1e2229;
      --shadow: 0 1px 2px rgba(0,0,0,.28), 0 6px 18px rgba(0,0,0,.22);
      --shadow-sm: 0 1px 2px rgba(0,0,0,.22);
      --shadow-frame: 0 14px 40px rgba(0,0,0,.4), 0 2px 8px rgba(0,0,0,.24);
      --spine: color-mix(in srgb, #9aa3b2 38%, transparent);
      --tip-bg: #2a303a;
      --tip-border: #4a5568;
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
      grid-template-rows: auto 1fr;
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
    .top-chrome {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      z-index: 20;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 0 14px;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
      background: color-mix(in srgb, var(--panel) 88%, transparent);
      backdrop-filter: blur(14px) saturate(1.2);
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; min-width: 170px; }
    .brand-mark {
      width: 28px; height: 28px; border-radius: 8px;
      background: linear-gradient(135deg, #0ea5e9, #14b8a6);
      box-shadow: 0 0 0 1px rgba(255,255,255,.08), var(--shadow);
      position: relative; overflow: hidden;
    }
    .brand-mark::before {
      content: ''; position: absolute; left: 6px; top: 8px; width: 14px; height: 2px;
      border-radius: 1px; background: rgba(255,255,255,.92);
      box-shadow: 0 5px 0 rgba(255,255,255,.92), 0 10px 0 rgba(255,255,255,.92);
    }
    .brand-mark::after {
      content: ''; position: absolute; left: 17px; top: 16px;
      width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,.95);
    }
    .toolbar .btn.symbol {
      min-width: 36px; min-height: 34px; padding: 6px 10px;
      font-size: 16px; line-height: 1;
      border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
    }
    .toolbar .btn.symbol:hover {
      border-color: color-mix(in srgb, var(--focus) 45%, var(--border));
    }
    .toolbar .btn.symbol.active-theme {
      border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .sync-pill {
      display: none; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px;
      border: 1px solid var(--border); color: var(--muted); max-width: 220px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sync-pill.show { display: inline-flex; }
    .sync-pill.ok { color: #059669; border-color: color-mix(in srgb, #10b981 50%, var(--border)); }
    .sync-pill.warn {
      color: #b45309; border-color: color-mix(in srgb, #f59e0b 55%, var(--border));
      background: color-mix(in srgb, #f59e0b 12%, transparent);
    }
    .sync-alert {
      display: none; align-items: center; gap: 12px; flex-wrap: wrap;
      padding: 8px 14px;
      border-bottom: 1px solid color-mix(in srgb, #f59e0b 45%, var(--border));
      background: color-mix(in srgb, #f59e0b 14%, var(--panel));
      color: var(--text); font-size: 12px;
    }
    .sync-alert.show { display: flex; }
    .sync-alert .sync-alert-text { flex: 1; min-width: 160px; line-height: 1.35; }
    .sync-alert .sync-alert-text strong { font-weight: 700; }
    .toolbar #btnSync.pulse {
      border-color: #f59e0b; color: #b45309;
      box-shadow: 0 0 0 1px color-mix(in srgb, #f59e0b 40%, transparent);
    }
    .var-block, .arg-block { margin-bottom: 8px; }
    .var-row, .arg-row {
      display: grid; grid-template-columns: 1fr 86px 28px; gap: 6px; align-items: center;
    }
    .arg-row { grid-template-columns: 1fr 64px 78px 28px; }
    .var-row input, .var-row select, .arg-row input, .arg-row select,
    .var-default input, .arg-default input {
      width: 100%; font-size: 11px; padding: 5px 7px; border-radius: 6px;
      border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text);
      font-family: var(--mono);
    }
    .var-default, .arg-default {
      margin-top: 4px; border-radius: 6px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      background: color-mix(in srgb, var(--input-bg) 55%, transparent);
      padding: 2px 8px 6px;
    }
    .var-default summary, .arg-default summary {
      cursor: pointer; list-style: none; font-size: 10px; font-weight: 650;
      color: var(--muted); padding: 4px 0; user-select: none;
    }
    .var-default summary::-webkit-details-marker,
    .arg-default summary::-webkit-details-marker { display: none; }
    .var-default summary::before, .arg-default summary::before {
      content: '▸ '; font-size: 9px;
    }
    .var-default[open] summary::before, .arg-default[open] summary::before { content: '▾ '; }
    .app.hide-summaries .card-summary { display: none; }
    .app.compact-cards .card { padding: 7px 8px 7px 10px; }
    .app.compact-cards .card-title { font-size: 12px; }
    .app.hide-connectors .connector, .app.hide-connectors .drop-zone::before { display: none; }
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
      border: 1px solid color-mix(in srgb, var(--border) 92%, var(--text) 8%);
      border-radius: var(--radius-frame);
      box-shadow: var(--shadow-sm);
      background: color-mix(in srgb, var(--panel) 96%, transparent);
      backdrop-filter: blur(10px);
    }
    .panel.right.frame-docked {
      margin: 8px 8px 8px 0;
      border-right: 1px solid color-mix(in srgb, var(--border) 92%, var(--text) 8%);
      border-left: 1px solid color-mix(in srgb, var(--border) 92%, var(--text) 8%);
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
      border-radius: 4px; opacity: 0;
    }
    .project-node:hover .project-remove { opacity: 1; }
    .project-node .project-remove:hover {
      color: #ef4444; background: color-mix(in srgb, #ef4444 12%, transparent);
    }
    .project-node .project-more {
      border: none; background: transparent; color: var(--muted);
      cursor: pointer; font-size: 12px; line-height: 1; padding: 0 4px;
      border-radius: 4px; opacity: 0;
    }
    .project-node:hover .project-more { opacity: 1; }
    .project-node .project-more:hover {
      color: var(--text); background: var(--hover);
    }
    .project-ctx {
      position: fixed; z-index: 90; min-width: 190px; display: none;
      background: var(--panel); border: 1px solid var(--border);
      box-shadow: 0 8px 24px rgba(0,0,0,.28); padding: 4px 0; border-radius: 6px;
    }
    .project-ctx.show { display: block; }
    .project-ctx button {
      display: block; width: 100%; text-align: left; border: none; background: transparent;
      color: var(--text); font: inherit; font-size: 12px; padding: 6px 12px; cursor: pointer;
    }
    .project-ctx button:hover { background: var(--hover); }
    .project-children { margin-left: 12px; border-left: 1px solid var(--border); padding-left: 4px; }
    .project-empty { padding: 16px 12px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .panel.right {
      border-right: none; border-left: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .panel.right .panel-scroll { flex: 1; overflow: auto; min-height: 0; }
    .panel.right { display: flex; flex-direction: column; min-height: 0; }
    .act-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 6px; flex: 0 0 auto;
      font-size: 12px; line-height: 1; font-weight: 700;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #fff; background: var(--ico, #64748B);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
    }
    /* Glyphs must NOT inherit codicon — that font has no ☰/⏱/💬 → empty tofu squares */
    .act-icon .act-fb {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: 9px; font-weight: 800; line-height: 1; color: #fff;
      display: inline-block; letter-spacing: -0.02em;
    }
    .card-head .act-icon { width: 20px; height: 20px; font-size: 11px; }
    .card-head .act-icon .act-fb { font-size: 11px; }
    .flow-node .act-icon {
      width: 18px; height: 18px; font-size: 10px; margin-right: 4px; vertical-align: -3px;
    }
    .flow-node .act-icon .act-fb { font-size: 10px; }
    .activity-item .act-icon { width: 20px; height: 20px; font-size: 11px; }
    .activity-item .act-icon .act-fb { font-size: 11px; }
    .palette-item .act-icon { width: 18px; height: 18px; font-size: 10px; margin-right: 6px; }
    .palette-item .act-icon .act-fb { font-size: 10px; }
    .mm-ico {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; border-radius: 4px; flex: 0 0 auto;
      color: #fff; font-size: 10px; font-weight: 700;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .mm-ico .act-fb { font-size: 10px; color: #fff; }
    .minimap-dock {
      flex: 0 0 auto; border-top: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      background: color-mix(in srgb, var(--panel) 92%, transparent);
    }
    .minimap-dock.collapsed .minimap-body { display: none; }
    .minimap-dock .minimap-head {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 7px 12px; border: none; background: transparent; color: var(--text);
      font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .04em;
      text-transform: uppercase; cursor: pointer; color: var(--muted);
    }
    .minimap-dock .minimap-head .grow { flex: 1; text-align: left; color: var(--text); }
    .minimap-dock .minimap-head .count {
      font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px;
      border: 1px solid var(--border);
    }
    .minimap-body { padding: 0 10px 10px; }
    .minimap-stage {
      position: relative; min-height: 96px; max-height: 180px; overflow: auto;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 8px; background:
        linear-gradient(180deg, color-mix(in srgb, var(--input-bg) 80%, transparent), transparent),
        var(--board);
    }
    .minimap-empty { padding: 28px 10px; text-align: center; font-size: 11px; color: var(--muted); }
    .minimap-seq { display: flex; flex-direction: column; gap: 3px; padding: 6px; }
    .mm-row {
      appearance: none; border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 6px; cursor: pointer; padding: 0; width: 100%;
      display: grid; grid-template-columns: 4px 22px 1fr; align-items: center; gap: 6px;
      background: color-mix(in srgb, var(--input-bg) 70%, transparent); color: var(--text);
      text-align: left; min-height: 26px; opacity: .92;
    }
    .mm-row .mm-accent { align-self: stretch; border-radius: 6px 0 0 6px; }
    .mm-row .mm-ico {
      width: 18px; height: 18px; border-radius: 5px; display: inline-flex;
      align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff;
    }
    .mm-row .mm-label {
      font-size: 10px; font-weight: 650; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; padding-right: 6px;
    }
    .mm-row .mm-step { color: var(--muted); font-weight: 600; margin-right: 4px; }
    .mm-bar {
      appearance: none; border: none; height: 8px; border-radius: 3px; cursor: pointer;
      opacity: .85; padding: 0; width: 100%;
    }
    .mm-row.selected, .mm-bar.selected, .mm-node.selected {
      outline: 2px solid var(--focus); outline-offset: 1px; opacity: 1;
    }
    .mm-row:hover, .mm-bar:hover, .mm-node:hover { opacity: 1; filter: brightness(1.06); }
    .mm-branch-label {
      font-size: 8.5px; font-weight: 700; color: var(--muted);
      letter-spacing: .05em; text-transform: uppercase;
      padding: 3px 0 1px 8px; border-left: 2px solid color-mix(in srgb, var(--focus) 30%, var(--muted));
      margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .minimap-flow { position: relative; margin: 8px auto; }
    .mm-node {
      position: absolute; min-width: 28px; max-width: 72px; height: 18px; border-radius: 4px;
      border: none; cursor: pointer; padding: 0 4px; opacity: .95;
      font-size: 8px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; line-height: 18px; text-align: center;
    }
    .assist-live {
      margin: 0 0 10px; padding: 8px 10px; border-radius: 8px;
      border: 1px solid color-mix(in srgb, #0ea5e9 45%, var(--border));
      background: color-mix(in srgb, #0ea5e9 10%, transparent);
    }
    .assist-live .al-title {
      font-size: 11px; font-weight: 750; color: #0284c7; margin-bottom: 6px;
      display: flex; justify-content: space-between; gap: 8px; align-items: center;
    }
    .assist-live .al-item {
      display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: start;
      padding: 5px 0; border-top: 1px solid color-mix(in srgb, #0ea5e9 22%, transparent);
      font-size: 11px;
    }
    .assist-live .al-item:first-of-type { border-top: none; }
    .assist-live .al-label { font-weight: 650; color: var(--text); }
    .assist-live .al-detail { color: var(--muted); margin-top: 2px; word-break: break-word; }
    .assist-live .al-apply, .assist-panel .al-apply {
      border: 1px solid color-mix(in srgb, #0ea5e9 50%, var(--border));
      background: color-mix(in srgb, #0ea5e9 14%, transparent); color: #0284c7;
      border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    .assist-live .al-apply:hover, .assist-panel .al-apply:hover {
      background: color-mix(in srgb, #0ea5e9 24%, transparent);
    }
    .assist-panel-dialog {
      width: min(440px, 94vw); max-height: min(72vh, 560px);
      display: flex; flex-direction: column;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 14px; box-shadow: var(--shadow-frame); overflow: hidden;
    }
    .assist-tabs {
      display: flex; gap: 2px; padding: 8px 12px 0; align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .assist-tabs button {
      appearance: none; border: 1px solid transparent; background: transparent; color: var(--muted);
      border-radius: 8px 8px 0 0; padding: 7px 12px; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer;
    }
    .assist-tabs button.active {
      color: var(--text); background: color-mix(in srgb, var(--input-bg) 80%, transparent);
      border-color: var(--border); border-bottom-color: transparent; margin-bottom: -1px;
    }
    .assist-tabs .assist-help-link {
      margin-left: auto; border: none; background: transparent; color: var(--muted);
      font-size: 11px; font-weight: 650; cursor: pointer; padding: 6px 8px;
    }
    .assist-tabs .assist-help-link:hover { color: var(--text); }
    .assist-tab-body { display: none; overflow: auto; padding: 10px 12px 12px; flex: 1; min-height: 0; }
    .assist-tab-body.active { display: flex; flex-direction: column; gap: 8px; }
    .assist-toolbar {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center; position: sticky; top: 0;
      background: var(--panel); padding-bottom: 4px; z-index: 1;
    }
    .assist-toolbar .count {
      margin-left: auto; font-size: 11px; font-weight: 700; color: var(--muted);
    }
    .assist-filter {
      display: flex; flex-wrap: wrap; gap: 4px;
    }
    .assist-filter button {
      appearance: none; border: 1px solid var(--border); background: transparent; color: var(--muted);
      border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 700; cursor: pointer;
    }
    .assist-filter button.on {
      color: #0284c7; border-color: color-mix(in srgb, #0ea5e9 50%, var(--border));
      background: color-mix(in srgb, #0ea5e9 12%, transparent);
    }
    .assist-scaffold-input {
      width: 100%; min-height: 72px; resize: vertical; font: inherit; font-size: 12px;
      border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg);
      color: var(--text); padding: 8px 10px; font-family: var(--mono);
    }
    .assist-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .assist-proposal-list { display: grid; gap: 4px; flex: 1; min-height: 0; }
    .assist-proposal {
      display: grid; grid-template-columns: 1fr auto; gap: 6px 8px; align-items: center;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 8px; padding: 6px 8px; background: color-mix(in srgb, var(--input-bg) 55%, transparent);
      font-size: 11px;
    }
    .assist-proposal .ap-title { font-weight: 650; line-height: 1.3; }
    .assist-proposal .ap-meta {
      color: var(--muted); font-size: 10px; margin-top: 1px; word-break: break-word;
      grid-column: 1 / 2;
    }
    .assist-proposal .al-apply { grid-row: 1 / span 2; align-self: center; }
    .assist-group-label {
      font-size: 10px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase;
      color: var(--muted); margin: 6px 0 2px;
    }
    .assist-help-details { font-size: 12px; }
    .assist-help-details > summary {
      cursor: pointer; color: var(--muted); font-weight: 650; font-size: 11px; margin-bottom: 6px;
    }
    .invoke-map {
      border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      border-radius: 8px; padding: 8px; background: color-mix(in srgb, var(--input-bg) 40%, transparent);
    }
    .invoke-map-toolbar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .invoke-map-row {
      display: grid; grid-template-columns: 88px 1fr; gap: 6px; align-items: center;
      margin-bottom: 6px;
    }
    .invoke-map-row .im-name {
      font-size: 11px; font-weight: 650; font-family: var(--mono); overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .invoke-map-row .im-dir {
      display: inline-block; font-size: 9px; font-weight: 750; letter-spacing: .03em;
      padding: 1px 5px; border-radius: 4px; margin-right: 4px;
      border: 1px solid var(--border); color: var(--muted);
    }
    .invoke-map-row .im-dir.Out { color: #b45309; border-color: color-mix(in srgb, #f59e0b 50%, var(--border)); }
    .invoke-map-row .im-dir.InOut { color: #7c3aed; border-color: color-mix(in srgb, #8b5cf6 50%, var(--border)); }
    .invoke-map-missing {
      font-size: 11px; color: #b45309; margin: 0 0 8px; line-height: 1.35;
    }
    .expr-vb-assist {
      border-top: 1px solid var(--border); padding: 8px 12px; font-size: 11px;
      background: color-mix(in srgb, #0ea5e9 8%, transparent);
      display: none;
    }
    .expr-vb-assist.show { display: block; }
    .expr-vb-assist .ev-label { font-weight: 700; color: #0284c7; margin-bottom: 4px; }
    .expr-vb-assist .ev-proposed {
      font-family: var(--mono); font-size: 11px; color: var(--text);
      word-break: break-word; margin-bottom: 6px;
    }
    .canvas-search-wrap { display: flex; align-items: center; gap: 4px; min-width: 0; }
    .canvas-search-wrap .workflow-search { flex: 1; min-width: 100px; max-width: 180px; }
    .canvas-search-wrap .sr-nav {
      appearance: none; border: 1px solid var(--border); background: var(--input-bg);
      color: var(--muted); border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-size: 12px;
      display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
    }
    .canvas-search-wrap .sr-nav:hover { color: var(--text); border-color: var(--focus); }
    .canvas-search-wrap .sr-nav.active { color: var(--focus); border-color: var(--focus); }
    .canvas-search-wrap .sr-count { font-size: 10px; color: var(--muted); min-width: 28px; text-align: center; }
    .canvas-search-wrap:not(.open) .canvas-search-fields { display: none; }
    .canvas-search-fields { display: flex; align-items: center; gap: 4px; min-width: 0; }
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
    .canvas-help { color: var(--muted); font-size: 12px; flex: 1 1 140px; min-width: 100px; }
    .canvas-nav-tools {
      display: flex; align-items: center; gap: 4px; flex: 0 0 auto;
    }
    .canvas-nav-tools .btn {
      padding: 5px 9px; font-size: 11px; font-weight: 650;
    }
    .workflow-search {
      width: min(220px, 36vw); min-width: 120px;
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
    .assist-help-body { font-size: 12px; line-height: 1.45; }
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
      width: 100%; min-height: 200px; border: none; resize: vertical;
      background: var(--input-bg); color: var(--text); padding: 14px;
      font-family: var(--mono); font-size: 13px; line-height: 1.45;
    }
    .expr-dialog-foot {
      display: flex; gap: 8px; justify-content: flex-end; align-items: center; padding: 10px 14px;
      border-top: 1px solid var(--border);
    }
    .expr-dialog-foot .grow { flex: 1; }
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
      max-width: var(--activity-column-width, 480px); margin: 0 auto;
      background: var(--board);
      border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      border-radius: 12px;
      padding: 16px 18px 24px;
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
      position: relative; height: 24px; margin: 2px 0;
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
      height: 36px;
    }
    .drop-zone.active::before { opacity: .85; background: var(--accent); }
    .ctx-menu {
      position: fixed; z-index: 80; min-width: 160px;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 10px; box-shadow: var(--shadow-frame);
      padding: 4px; display: none;
      max-height: min(70vh, 420px); overflow-y: auto;
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
      border: 1px solid color-mix(in srgb, var(--border) 92%, var(--text) 8%);
      border-radius: var(--radius); box-shadow: var(--shadow-sm);
      padding: 9px 10px 9px 12px; cursor: grab;
      transition: border-color .14s ease, background .14s ease, box-shadow .14s ease, transform .14s ease;
      animation: rise .22s ease both;
    }
    .card.dragging {
      opacity: .55;
      cursor: grabbing;
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
    .card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; padding-right: 28px; }
    .card-menu {
      position: absolute; top: 6px; right: 6px; z-index: 2;
      width: 26px; height: 26px; border-radius: 6px;
      border: 1px solid transparent; background: transparent; color: var(--muted);
      font-size: 16px; line-height: 1; cursor: pointer; padding: 0;
    }
    .card-menu:hover, .card.selected .card-menu, .flow-node.selected .card-menu {
      color: var(--text);
      background: var(--hover);
      border-color: color-mix(in srgb, var(--border) 80%, transparent);
    }
    .flow-node .card-menu { top: 4px; right: 4px; }
    .step { font-size: 10px; color: var(--muted); font-family: var(--mono); min-width: 26px; opacity: .75; }
    .card-title { font-size: 12.5px; font-weight: 650; }
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
    .card-bp-dot {
      position: absolute; right: 8px; top: 8px; z-index: 3;
      width: 9px; height: 9px; border-radius: 50%;
      background: #ef4444; border: 1px solid color-mix(in srgb, #ef4444 40%, #fff);
      box-shadow: 0 0 0 2px color-mix(in srgb, #ef4444 25%, transparent);
      pointer-events: none;
    }
    .vb-repair-banner {
      margin: 0 0 10px; padding: 8px 10px; border-radius: 8px;
      border: 1px solid color-mix(in srgb, #ef4444 55%, var(--border));
      background: color-mix(in srgb, #ef4444 10%, transparent);
      color: #ef4444; font-size: 11px; font-weight: 650; line-height: 1.4;
    }
    .vb-repair-banner .vb-apply-all {
      margin-top: 6px; display: inline-block;
      border: 1px solid color-mix(in srgb, #ef4444 55%, var(--border));
      background: color-mix(in srgb, #ef4444 16%, transparent); color: #ef4444;
      border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    .vb-repair-banner .vb-apply-all:hover { background: color-mix(in srgb, #ef4444 26%, transparent); }
    .vb-repair-hint {
      margin-top: 5px; font-size: 11px; line-height: 1.4; color: #ef4444;
      font-weight: 600;
    }
    .vb-repair-hint .vb-proposed {
      display: block; margin-top: 2px; font-family: var(--mono); font-weight: 500;
      color: #ef4444; word-break: break-word; white-space: pre-wrap;
    }
    .vb-repair-hint .vb-apply {
      margin-top: 4px; border: 1px solid color-mix(in srgb, #ef4444 55%, var(--border));
      background: color-mix(in srgb, #ef4444 12%, transparent); color: #ef4444;
      border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 600; cursor: pointer;
    }
    .vb-repair-hint .vb-apply:hover { background: color-mix(in srgb, #ef4444 22%, transparent); }
    .ctx-menu .ctx-sep {
      height: 1px; margin: 4px 8px; background: var(--border); pointer-events: none;
    }
    .ctx-menu button[hidden] { display: none !important; }
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
      position: absolute; width: var(--flow-node-width, 156px); min-height: 58px;
      background: var(--card); border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: 10px; box-shadow: var(--shadow-sm); padding: 8px 10px 10px;
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
      width: 148px; height: 148px; border-radius: 16px;
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
    .flow-node .title {
      font-size: 12px; font-weight: 650; padding-right: 28px;
      display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
    }
    .flow-node.decision .inner .act-icon { display: inline-flex; margin: 0 auto 4px; }
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
      background: var(--tip-bg); color: var(--text); border: 1px solid var(--tip-border);
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
      display: grid; grid-template-columns: auto 1fr auto; gap: 4px 8px; align-items: center;
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
    <div class="top-chrome">
    <div class="toolbar">
      <div class="brand"><div class="brand-mark"></div><span>LowCode Studio</span></div>
      <input class="workflow-name" id="workflowName" />
      <span class="mode-pill" id="workflowType">Sequence</span>
      <span class="sync-pill" id="syncPill" title="Studio Web Local sync status"></span>
      <div class="spacer"></div>
      <button class="btn" id="btnLink" title="Connect two flowchart nodes" style="display:none">Link</button>
      <button class="btn" id="btnAutoLayout" style="display:none" title="Tidy flowchart layout">Tidy</button>
      <button class="btn" id="btnSync" type="button" title="Pull changes from Studio Web Local (no reopen)" style="display:none">↻ Sync</button>
      <button class="btn symbol" id="btnThemeToggle" type="button" title="Toggle light / dark theme" aria-label="Toggle theme">☽</button>
      <button class="btn symbol" id="btnHome" type="button" title="Home — projects &amp; templates">⌂</button>
      <button class="btn symbol" id="btnAssistHelp" type="button" title="Assist — Live proposals / Scaffold" aria-expanded="false">✦</button>
      <button class="btn symbol" id="btnSettings" type="button" title="Settings — canvas, theme, sync">⚙</button>
      <button class="btn primary" id="btnSave" title="Save workflow (⌘/Ctrl+S)">Save</button>
    </div>
    <div class="sync-alert" id="syncAlert" role="status">
      <span class="sync-alert-text" id="syncAlertText"></span>
      <button class="btn primary" id="btnSyncNow" type="button">Sync now</button>
      <button class="btn" id="btnSyncDismiss" type="button">Dismiss</button>
    </div>
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
            <div class="project-ctx" id="projectCtx" role="menu">
              <button type="button" data-proj-act="open">Open</button>
              <button type="button" data-proj-act="duplicate">Duplicate</button>
              <button type="button" data-proj-act="rename">Rename</button>
              <button type="button" data-proj-act="reveal-sw">Reveal in Studio Web folder</button>
              <button type="button" data-proj-act="reveal-os">Reveal in OS</button>
            </div>
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
        <div class="canvas-nav-tools">
          <button class="btn" id="btnFitCanvas" type="button" title="Fit content / selection (⤢)">Fit</button>
          <button class="btn" id="btnAlignSelection" type="button" title="Align flowchart nodes to selection" style="display:none">Align</button>
        </div>
        <div class="canvas-search-wrap" id="canvasSearchWrap">
          <button type="button" class="sr-nav" id="btnToggleSearch" title="Find activity">⌕</button>
          <div class="canvas-search-fields" id="canvasSearchFields">
            <input class="workflow-search" id="workflowSearch" placeholder="Find activity…" title="Find in workflow — Enter / ↓ next · ↑ previous · Esc close" />
            <button type="button" class="sr-nav" id="btnSearchPrev" title="Previous match (↑)">↑</button>
            <span class="sr-count" id="searchHitCount"></span>
            <button type="button" class="sr-nav" id="btnSearchNext" title="Next match (Enter / ↓)">↓</button>
          </div>
        </div>
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
        <div class="ctx-sep"></div>
        <button type="button" data-ctx="up">Move up</button>
        <button type="button" data-ctx="down">Move down</button>
        <button type="button" data-ctx="dup">Duplicate</button>
        <div class="ctx-sep"></div>
        <button type="button" data-ctx="bp">Toggle breakpoint</button>
        <button type="button" data-ctx="runto">Run to here</button>
        <button type="button" data-ctx="open" hidden>Open workflow</button>
        <button type="button" data-ctx="vb-repair" hidden>Apply VB expression repairs</button>
        <div class="ctx-sep"></div>
        <button type="button" class="danger" data-ctx="delete">Delete</button>
      </div>
    </main>

    <div class="expr-overlay" id="exprOverlay">
      <div class="expr-dialog" role="dialog" aria-label="Expression editor">
        <div class="expr-dialog-head">
          <div class="title" id="exprDialogTitle">Expression</div>
          <button class="btn symbol" type="button" id="exprDialogAssist" title="Assist — Live proposals for this activity">✦</button>
        </div>
        <textarea id="exprDialogValue" spellcheck="false"></textarea>
        <div class="expr-vb-assist" id="exprVbAssist">
          <div class="ev-label">VB Assist</div>
          <div class="ev-proposed" id="exprVbProposed"></div>
          <button type="button" class="al-apply" id="exprVbApply">Apply VB repair</button>
        </div>
        <div class="expr-dialog-foot">
          <span class="grow"></span>
          <button class="btn" type="button" id="exprDialogDismiss">Cancel</button>
          <button class="btn primary" type="button" id="exprDialogApply">Apply</button>
        </div>
      </div>
    </div>

    <div class="settings-overlay" id="assistHelpOverlay">
      <div class="assist-panel-dialog" role="dialog" aria-label="Assist" aria-modal="true">
        <div class="settings-dialog-head">
          <div class="title">Assist</div>
          <button class="btn" type="button" id="assistHelpClose">Close</button>
        </div>
        <div class="assist-tabs" role="tablist">
          <button type="button" class="active" data-assist-tab="live" role="tab" aria-selected="true">Live</button>
          <button type="button" data-assist-tab="scaffold" role="tab" aria-selected="false">Scaffold</button>
          <button type="button" class="assist-help-link" data-assist-tab="help" role="tab" aria-selected="false" title="How Assist works">?</button>
        </div>
        <div class="assist-tab-body active" data-assist-body="live" id="assistLiveBody">
          <div class="assist-toolbar">
            <button type="button" class="btn primary" id="assistLiveRefresh">Refresh</button>
            <button type="button" class="btn" id="assistLiveApplyAll">Apply all</button>
            <span class="count" id="assistLiveCount">0</span>
          </div>
          <div class="assist-filter" id="assistLiveFilter">
            <button type="button" class="on" data-al-scope="selected">Selected</button>
            <button type="button" data-al-scope="all">All</button>
            <button type="button" class="on" data-al-kind="vb">VB</button>
            <button type="button" class="on" data-al-kind="required">Required</button>
            <button type="button" class="on" data-al-kind="selector">Selector</button>
          </div>
          <div class="assist-proposal-list" id="assistLiveList"></div>
        </div>
        <div class="assist-tab-body" data-assist-body="scaffold" id="assistScaffoldBody">
          <textarea class="assist-scaffold-input" id="assistScaffoldInput" placeholder='use browser https://example.com then type into then click then log "done"'></textarea>
          <div class="assist-actions">
            <button type="button" class="btn primary" id="assistScaffoldPropose">Propose</button>
            <button type="button" class="btn" id="assistScaffoldAppend" disabled>Append</button>
            <button type="button" class="btn" id="assistScaffoldReplace" disabled>Replace</button>
          </div>
          <details class="assist-help-details">
            <summary>Examples</summary>
            <div class="assist-help-body">
              <span class="cmd">use browser https://example.com then type into then click then log message "done"</span>
              <span class="cmd">read csv then for each row then http then write csv</span>
            </div>
          </details>
          <div class="assist-proposal-list" id="assistScaffoldList"></div>
        </div>
        <div class="assist-tab-body" data-assist-body="help">
          <div class="assist-help-body">
            <p class="lead" style="margin-top:0">
              Deterministic helpers (no chat LLM). Nothing writes until you press <strong>Apply</strong>.
            </p>
            <details class="assist-help-details" open>
              <summary>In this dialog</summary>
              <ul>
                <li><strong>Live</strong> — VB / required / selector proposals for the open workflow</li>
                <li><strong>Scaffold</strong> — describe steps → Propose → Append or Replace</li>
              </ul>
            </details>
            <details class="assist-help-details">
              <summary>Command Palette (F0–F4)</summary>
              <ul>
                <li>Explain / critique · Generate scenarios · Scaffold · Repair from dry-run · Selectors · VB</li>
                <li>Results also go to <strong>Output → LowCode Studio</strong></li>
              </ul>
            </details>
            <details class="assist-help-details">
              <summary>VB repair examples</summary>
              <ul>
                <li><code>TRim(name)</code> → <code>name.Trim()</code></li>
                <li><code>name.toUpperCase()</code> → <code>name.ToUpper()</code></li>
                <li><code>x == null</code> → <code>x Is Nothing</code></li>
              </ul>
            </details>
          </div>
          <div class="settings-dialog-foot" style="border-top:none;padding:4px 0 0">
            <button class="btn primary" type="button" id="assistHelpDone">Got it</button>
          </div>
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
            <h3>Appearance</h3>
            <div class="settings-row">
              <div class="label">
                <span class="name">Theme</span>
                <span class="hint">Auto follows VS Code · Light / Dark force LowCode Studio colors</span>
              </div>
              <select id="set_designerTheme">
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
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
            <div class="settings-row">
              <div class="label">
                <span class="name">Card summaries</span>
                <span class="hint">One-line property preview under each activity title</span>
              </div>
              <input type="checkbox" id="set_showCardSummaries" />
            </div>
            <div class="settings-row">
              <div class="label">
                <span class="name">Compact activity cards</span>
                <span class="hint">Tighter padding for dense sequences</span>
              </div>
              <input type="checkbox" id="set_compactCards" />
            </div>
            <div class="settings-row">
              <div class="label">
                <span class="name">Show connectors</span>
                <span class="hint">Spine / lines between sequence steps</span>
              </div>
              <input type="checkbox" id="set_showConnectors" />
            </div>
            <div class="settings-row">
              <div class="label">
                <span class="name">Default zoom</span>
                <span class="hint">Applied when opening a workflow</span>
              </div>
              <select id="set_defaultZoom">
                <option value="0.75">75%</option>
                <option value="1">100%</option>
                <option value="1.25">125%</option>
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
                <span class="name">Open Home on startup</span>
                <span class="hint">Show LowCode Studio Home when the extension activates</span>
              </div>
              <input type="checkbox" id="set_openHomeOnStartup" />
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
      <section class="minimap-dock" id="minimapDock" aria-label="Canvas mini-map">
        <button type="button" class="minimap-head" id="btnToggleMinimap">
          <span class="chev" id="minimapChev">▾</span>
          <span class="grow">Mini-map</span>
          <span class="count" id="minimapCount">0</span>
        </button>
        <div class="minimap-body">
          <div class="minimap-stage" id="minimapStage"></div>
        </div>
      </section>
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
        <button class="dock-btn" id="btnZoomFit" type="button" title="Fit content / selection">⤢</button>
        <button class="dock-btn" id="btnZoomReset" type="button" title="Reset zoom to 100%">⛶</button>
      </div>
      <span class="dock-sep" aria-hidden="true"></span>
      <button class="dock-btn" id="btnValidate" type="button" title="Validate workflow">✓</button>
      <button class="dock-btn" id="btnReadyGate" type="button" title="Ready for Studio Web? — packages, Portable, selectors, Imported.*">◉</button>
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
      assistTab: 'live',
      assistScaffoldProposal: null,
      assistLiveScope: 'selected',
      assistLiveKinds: { vb: true, required: true, selector: true },
      invokePathExists: {},
      invokePathPending: {},
      projectCtx: null,
      minimapCollapsed: false,
      searchHits: [],
      searchHitIndex: 0,
      targetArgsByPath: {},
      targetArgsStatus: {},
      collapsedLeftSections: { project: true, activities: false, variables: true, arguments: true, watch: true, fixtures: true },
      selectedId: null,
      selectedNode: null,
      dragType: null,
      dragActivityId: null,
      linkFrom: null,
      draggingId: null,
      dragOffset: { x: 0, y: 0 },
      zoom: 1,
      collapsedCats: {},
      collapsedPropSections: { studioWeb: true },
      syncLinked: false,
      syncNeedsPull: false,
      syncDismissedKey: '',
      syncStatusKey: '',
      syncBusy: false,
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
      ctxTargetId: null,
      ctxIgnoreClickUntil: 0
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
      assistLiveList: document.getElementById('assistLiveList'),
      assistLiveCount: document.getElementById('assistLiveCount'),
      assistScaffoldList: document.getElementById('assistScaffoldList'),
      assistScaffoldInput: document.getElementById('assistScaffoldInput'),
      minimapDock: document.getElementById('minimapDock'),
      minimapStage: document.getElementById('minimapStage'),
      minimapCount: document.getElementById('minimapCount'),
      searchHitCount: document.getElementById('searchHitCount'),
      exprVbAssist: document.getElementById('exprVbAssist'),
      exprVbProposed: document.getElementById('exprVbProposed'),
      btnAlignSelection: document.getElementById('btnAlignSelection'),
      watchView: document.getElementById('watchView'),
      watchCount: document.getElementById('watchCount'),
      fixturesEditor: document.getElementById('fixturesEditor'),
      syncPill: document.getElementById('syncPill'),
      syncAlert: document.getElementById('syncAlert'),
      syncAlertText: document.getElementById('syncAlertText'),
      btnSync: document.getElementById('btnSync'),
      btnSyncNow: document.getElementById('btnSyncNow'),
      btnSyncDismiss: document.getElementById('btnSyncDismiss'),
      btnThemeToggle: document.getElementById('btnThemeToggle'),
      btnHome: document.getElementById('btnHome'),
      btnSettings: document.getElementById('btnSettings')
    };

    function applySyncStatus(msg) {
      if (!msg) return;
      state.syncLinked = !!msg.linked;
      state.syncNeedsPull = !!msg.needsPull;
      const btn = els.btnSync;
      const pill = els.syncPill;
      const alert = els.syncAlert;
      if (btn) {
        btn.style.display = msg.linked ? '' : 'none';
        btn.classList.toggle('pulse', !!msg.needsPull);
        btn.disabled = !!state.syncBusy;
        btn.title = msg.linked
          ? (msg.needsPull
            ? 'Studio Web has newer changes — click to pull & reload'
            : 'Pull from Studio Web Local Workspace')
          : 'Not linked';
      }
      if (pill) {
        if (!msg.linked) {
          pill.classList.remove('show', 'ok', 'warn');
          pill.textContent = '';
        } else if (msg.inSync) {
          pill.classList.add('show', 'ok');
          pill.classList.remove('warn');
          pill.textContent = '↔ ' + (msg.solutionLabel || 'Studio Web');
          pill.title = msg.summary || 'In sync';
        } else {
          pill.classList.add('show', 'warn');
          pill.classList.remove('ok');
          const conflicts = msg.conflictCount || 0;
          const n = msg.xamlNewerCount || 0;
          pill.textContent = conflicts
            ? ('Conflict · ' + conflicts)
            : (n ? ('Studio Web newer · ' + n) : 'Out of sync');
          pill.title = msg.summary || 'Out of sync';
        }
      }
      if (alert && els.syncAlertText) {
        const key = (msg.summary || '') + '|' + (msg.xamlNewerCount || 0) + '|' + (msg.conflictCount || 0) + '|' + (msg.needsPull ? '1' : '0');
        state.syncStatusKey = key;
        const show = msg.linked && msg.needsPull && state.syncDismissedKey !== key;
        alert.classList.toggle('show', show);
        if (show) {
          const label = msg.solutionLabel ? (' “' + escapeHtml(msg.solutionLabel) + '”') : '';
          const conflicts = msg.conflictCount || 0;
          const files = Array.isArray(msg.staleFiles) ? msg.staleFiles : [];
          const preview = files.slice(0, 3).map((f) => {
            const reason = f.reason === 'conflict' ? 'conflict' : f.reason === 'xaml-newer' ? 'SW newer' : f.reason;
            return escapeHtml(f.rel) + ' (' + escapeHtml(reason) + ')';
          }).join(', ');
          const more = files.length > 3 ? (' +' + (files.length - 3) + ' more') : '';
          els.syncAlertText.innerHTML = conflicts
            ? ('<strong>Sync conflict</strong> — both sides changed' + label + '. Pull skips conflicts; Save keeps LCS (SW copy → trash). ' +
              (preview ? '<span style="opacity:.85">' + preview + more + '</span> · ' : '') +
              '<span style="opacity:.8">' + escapeHtml(msg.summary || '') + '</span>')
            : ('<strong>Studio Web changed</strong> — pull' + label + ' into this designer without closing the project. ' +
              (preview ? '<span style="opacity:.85">' + preview + more + '</span> · ' : '') +
              '<span style="opacity:.8">' + escapeHtml(msg.summary || '') + '</span>');
        }
      }
    }
    function requestInvokePathCheck(workflowPath) {
      const path = String(workflowPath || '').trim();
      if (!path) return;
      state.invokePathPending = state.invokePathPending || {};
      if (state.invokePathPending[path]) return;
      state.invokePathPending[path] = true;
      const requestId = 'inv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      vscode.postMessage({ type: 'checkWorkflowPath', workflowPath: path, requestId });
    }
    function requestStudioWebPull(opts) {
      if (state.syncBusy) return;
      state.syncBusy = true;
      if (els.btnSync) els.btnSync.disabled = true;
      if (els.btnSyncNow) els.btnSyncNow.disabled = true;
      vscode.postMessage({
        type: 'pullStudioWeb',
        wholeProject: !!(opts && opts.wholeProject),
        force: !!(opts && opts.force)
      });
    }

    function applyDesignerSettings() {
      const s = state.settings || {};
      els.app?.classList.toggle('hide-steps', s.showLineNumbers === false);
      els.app?.classList.toggle('hide-summaries', s.showCardSummaries === false);
      els.app?.classList.toggle('compact-cards', !!s.compactCards);
      els.app?.classList.toggle('hide-connectors', s.showConnectors === false);
      const dots = s.canvasStyle === 'dots';
      els.sequence?.classList.toggle('canvas-dots', dots);
      els.flowStage?.classList.toggle('canvas-dots', dots);
      if (typeof s.defaultZoom === 'number' && s.defaultZoom > 0 && !state._zoomUserTouched) {
        state.zoom = s.defaultZoom;
        applyZoom();
      }
      applyDesignerTheme();
    }
    function effectiveDesignerTheme() {
      const t = state.settings?.designerTheme;
      if (t === 'light' || t === 'dark') return t;
      // Auto: infer from computed body background (follows VS Code tokens)
      try {
        const bg = getComputedStyle(document.body).backgroundColor || '';
        const m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
        if (m) {
          const lum = (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) / 255;
          return lum > 0.55 ? 'light' : 'dark';
        }
      } catch (_) {}
      return 'dark';
    }
    function applyDesignerTheme() {
      const mode = state.settings?.designerTheme === 'light' || state.settings?.designerTheme === 'dark'
        ? state.settings.designerTheme
        : 'auto';
      if (mode === 'auto') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', mode);
      }
      const shown = mode === 'auto' ? effectiveDesignerTheme() : mode;
      const btn = els.btnThemeToggle;
      if (btn) {
        // Show the action: sun = switch to light, moon = switch to dark
        btn.textContent = shown === 'light' ? '☽' : '☀';
        btn.title = mode === 'auto'
          ? ('Theme: Auto (' + shown + ') — click for ' + (shown === 'light' ? 'dark' : 'light'))
          : ('Theme: ' + (shown === 'light' ? 'Light' : 'Dark') + ' — click to toggle · Settings for Auto');
        btn.setAttribute('aria-label', btn.title);
        btn.classList.toggle('active-theme', mode !== 'auto');
      }
    }
    function toggleDesignerTheme() {
      const shown = effectiveDesignerTheme();
      const next = shown === 'light' ? 'dark' : 'light';
      state.settings = Object.assign({}, state.settings, { designerTheme: next });
      applyDesignerTheme();
      vscode.postMessage({ type: 'updateSettings', settings: { designerTheme: next } });
      toast(next === 'light' ? 'Light theme' : 'Dark theme');
    }
    function fillSettingsForm() {
      const s = state.settings || {};
      const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
      const setSel = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      const theme = s.designerTheme === 'light' || s.designerTheme === 'dark' ? s.designerTheme : 'auto';
      setSel('set_designerTheme', theme);
      setChk('set_showLineNumbers', s.showLineNumbers !== false);
      setSel('set_canvasStyle', s.canvasStyle === 'dots' ? 'dots' : 'plain');
      setChk('set_showCardSummaries', s.showCardSummaries !== false);
      setChk('set_compactCards', !!s.compactCards);
      setChk('set_showConnectors', s.showConnectors !== false);
      const z = Number(s.defaultZoom);
      setSel('set_defaultZoom', z === 0.75 || z === 1.25 ? String(z) : '1');
      setSel('set_defaultWorkflowType', s.defaultWorkflowType === 'Flowchart' ? 'Flowchart' : 'Sequence');
      setChk('set_autoOpenDesigner', s.autoOpenDesigner !== false);
      setChk('set_openHomeOnStartup', s.openHomeOnStartup !== false);
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
    function setAssistTab(tab) {
      const next = tab === 'scaffold' || tab === 'help' ? tab : 'live';
      state.assistTab = next;
      document.querySelectorAll('[data-assist-tab]').forEach((btn) => {
        const on = btn.getAttribute('data-assist-tab') === next;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-assist-body]').forEach((body) => {
        body.classList.toggle('active', body.getAttribute('data-assist-body') === next);
      });
      if (next === 'live') renderAssistLivePanel();
    }
    function openAssistHelp(tab) {
      closeSettings();
      state.assistHelpOpen = true;
      els.assistHelpOverlay?.classList.add('show');
      els.btnAssistHelp?.classList.add('active-assist');
      els.btnAssistHelp?.setAttribute('aria-expanded', 'true');
      setAssistTab(tab || state.assistTab || 'live');
    }
    function closeAssistHelp() {
      state.assistHelpOpen = false;
      els.assistHelpOverlay?.classList.remove('show');
      els.btnAssistHelp?.classList.remove('active-assist');
      els.btnAssistHelp?.setAttribute('aria-expanded', 'false');
    }
    function toggleAssistHelp() {
      if (state.assistHelpOpen) closeAssistHelp();
      else openAssistHelp('live');
    }
    function applyMinimapCollapsed() {
      const dock = els.minimapDock;
      if (!dock) return;
      dock.classList.toggle('collapsed', !!state.minimapCollapsed);
      const chev = document.getElementById('minimapChev');
      if (chev) chev.textContent = state.minimapCollapsed ? '▸' : '▾';
    }
    function saveSettingsFromForm() {
      const chk = (id) => !!document.getElementById(id)?.checked;
      const sel = (id) => document.getElementById(id)?.value;
      const zoomRaw = Number(sel('set_defaultZoom'));
      const next = {
        showLineNumbers: chk('set_showLineNumbers'),
        canvasStyle: sel('set_canvasStyle') === 'dots' ? 'dots' : 'plain',
        showCardSummaries: chk('set_showCardSummaries'),
        compactCards: chk('set_compactCards'),
        showConnectors: chk('set_showConnectors'),
        defaultZoom: zoomRaw === 0.75 || zoomRaw === 1.25 ? zoomRaw : 1,
        defaultWorkflowType: sel('set_defaultWorkflowType') === 'Flowchart' ? 'Flowchart' : 'Sequence',
        autoOpenDesigner: chk('set_autoOpenDesigner'),
        openHomeOnStartup: chk('set_openHomeOnStartup'),
        syncStudioWebOnSave: chk('set_syncStudioWebOnSave'),
        uipathTargetFramework: sel('set_uipathTargetFramework') === 'Portable' ? 'Portable' : 'Windows',
        designerTheme: (() => {
          const t = sel('set_designerTheme');
          return t === 'light' || t === 'dark' ? t : 'auto';
        })()
      };
      state.settings = Object.assign({}, state.settings, next);
      state._zoomUserTouched = false;
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
        const moreBtn = (node.kind === 'workflow' || node.kind === 'file' || node.kind === 'project' || node.kind === 'solution')
          ? '<button type="button" class="project-more" data-kind="' + escapeAttr(node.kind) + '" data-path="' + escapeAttr(node.path) + '" title="More actions">⋯</button>'
          : '';
        let html = '<div class="project-node' + active + '" data-kind="' + escapeAttr(node.kind) + '" data-path="' + escapeAttr(node.path) + '">' +
          '<span class="ico">' + icon + '</span><span class="label">' + escapeHtml(node.name) + '</span>' + badge + moreBtn + removeBtn + '</div>';
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
      els.projectTree.querySelectorAll('.project-more').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          showProjectCtx(btn, btn.getAttribute('data-kind') || '', btn.getAttribute('data-path') || '');
        });
      });
      els.projectTree.querySelectorAll('.project-node').forEach((el) => {
        el.addEventListener('click', () => {
          hideProjectCtx();
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
        el.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          showProjectCtx(el, el.getAttribute('data-kind') || '', el.getAttribute('data-path') || '', ev.clientX, ev.clientY);
        });
      });
    }
    function hideProjectCtx() {
      const menu = document.getElementById('projectCtx');
      if (menu) menu.classList.remove('show');
      state.projectCtx = null;
    }
    function showProjectCtx(anchor, kind, filePath, x, y) {
      const menu = document.getElementById('projectCtx');
      if (!menu) return;
      state.projectCtx = { kind, path: filePath };
      const isWorkflow = kind === 'workflow' || (kind === 'file' && String(filePath).endsWith('.lcs.json'));
      menu.querySelectorAll('[data-proj-act]').forEach((btn) => {
        const act = btn.getAttribute('data-proj-act');
        let show = true;
        if (act === 'duplicate' || act === 'rename') show = isWorkflow;
        if (act === 'open') show = kind === 'workflow' || kind === 'file';
        if (act === 'reveal-sw') show = kind === 'workflow' || kind === 'file' || kind === 'project' || kind === 'solution';
        btn.style.display = show ? '' : 'none';
      });
      let left = x, top = y;
      if (left == null || top == null) {
        const r = anchor.getBoundingClientRect();
        left = r.right - 8;
        top = r.bottom + 2;
      }
      menu.style.left = Math.max(8, Math.min(left, window.innerWidth - 200)) + 'px';
      menu.style.top = Math.max(8, Math.min(top, window.innerHeight - 160)) + 'px';
      menu.classList.add('show');
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
      if (idsEqual(state.selectedId, id)) {
        setSelectedNode(null);
      }
      hideCtxMenu();
      persist(true);
      toast('Deleted activity');
    }
    function hideCtxMenu() {
      const menu = document.getElementById('ctxMenu');
      if (menu) menu.classList.remove('show');
      state.ctxTargetId = null;
    }
    function ensurePropsPanelVisible() {
      if (state.propsMode === 'collapsed') {
        state.propsMode = 'docked';
        applyFrameLayouts();
      }
    }
    function ensureActivityIds(list) {
  let changed = false;
  const visit = (nodes) => {
    const arr = Array.isArray(nodes) ? nodes : nodes ? [nodes] : [];
    for (const n of arr) {
      if (!n || typeof n !== 'object') continue;
      if (typeof n.id !== 'string' || !String(n.id).trim()) {
        n.id = newId();
        changed = true;
      }
      if (n.children != null && !Array.isArray(n.children)) {
        n.children = [n.children];
        changed = true;
      }
      if (n.elseChildren != null && !Array.isArray(n.elseChildren)) {
        n.elseChildren = [n.elseChildren];
        changed = true;
      }
      if (n.finallyChildren != null && !Array.isArray(n.finallyChildren)) {
        n.finallyChildren = [n.finallyChildren];
        changed = true;
      }
      if (n.catches != null && !Array.isArray(n.catches)) {
        n.catches = [n.catches];
        changed = true;
      }
      if (n.children) visit(n.children);
      if (n.elseChildren) visit(n.elseChildren);
      if (n.finallyChildren) visit(n.finallyChildren);
      for (const clause of n.catches || []) {
        if (clause && (typeof clause !== 'object')) continue;
        if (clause.children) visit(clause.children);
      }
    }
  };
  visit(list);
  return changed;
}
    /** Keep a live node ref so Properties can paint even if walkFind races after SW sync. */
    function idsEqual(a, b) {
      return a != null && b != null && String(a) === String(b);
    }
    function setSelectedNode(node) {
      state.selectedNode = node || null;
      state.selectedId = node && typeof node.id === 'string' && node.id.trim() ? String(node.id) : null;
    }
    /** Rematch after Sync/SW reopen when ids rewrite — never keep a detached orphan. */
    function softRematchNode(snap) {
      if (!snap || !snap.type) return null;
      const all = walkCollect(state.workflow.activities);
      const snapSum = snap.summary != null ? snap.summary : summary(snap);
      return (
        all.find((n) =>
          n.type === snap.type &&
          n.displayName === snap.displayName &&
          summary(n) === snapSum
        ) ||
        all.find((n) => n.type === snap.type && n.displayName === snap.displayName) ||
        all.find((n) => n.type === snap.type && summary(n) === snapSum) ||
        all.find((n) => n.type === snap.type) ||
        null
      );
    }
    /** Find by id string. */
    function walkFind(list, id) {
  const want = String(id ?? '');
  if (!want) return null;
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  for (let i = 0; i < arr.length; i++) {
    const node = arr[i];
    if (!node || typeof node !== 'object') continue;
    if (String(node.id ?? '') === want) return { node, list: arr, index: i };
    if (node.children) {
      const hit = walkFind(node.children, want);
      if (hit) return hit;
    }
    if (node.elseChildren) {
      const hit = walkFind(node.elseChildren, want);
      if (hit) return hit;
    }
    if (node.finallyChildren) {
      const hit = walkFind(node.finallyChildren, want);
      if (hit) return hit;
    }
    for (const clause of node.catches || []) {
      if (clause && clause.children) {
        const hit = walkFind(clause.children, want);
        if (hit) return hit;
      }
    }
  }
  return null;
}
    /** Find by object identity — card clicks pass the live tree node. */
    function walkFindRef(list, target) {
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  for (let i = 0; i < arr.length; i++) {
    const node = arr[i];
    if (!node || typeof node !== 'object') continue;
    if (node === target) return { node, list: arr, index: i };
    if (node.children) {
      const hit = walkFindRef(node.children, target);
      if (hit) return hit;
    }
    if (node.elseChildren) {
      const hit = walkFindRef(node.elseChildren, target);
      if (hit) return hit;
    }
    if (node.finallyChildren) {
      const hit = walkFindRef(node.finallyChildren, target);
      if (hit) return hit;
    }
    for (const clause of node.catches || []) {
      if (clause && clause.children) {
        const hit = walkFindRef(clause.children, target);
        if (hit) return hit;
      }
    }
  }
  return null;
}
    function updateSelectedChrome() {
      const sel = state.selectedId;
      document.querySelectorAll('.card[data-id], .flow-node[data-id]').forEach((el) => {
        el.classList.toggle('selected', idsEqual(el.getAttribute('data-id'), sel));
      });
    }
    /** Tree-backed node for the current selection (SW reopen safe). */
    function resolveEditTarget() {
      ensureActivityIds(state.workflow.activities);
      const hit = resolveSelectedNode();
      if (hit && hit.list != null && hit.node) return hit.node;
      if (state.selectedNode) {
        const byRef = walkFindRef(state.workflow.activities, state.selectedNode);
        if (byRef) {
          setSelectedNode(byRef.node);
          return byRef.node;
        }
        const rematch = softRematchNode(state.selectedNode);
        if (rematch) {
          setSelectedNode(rematch);
          return rematch;
        }
      }
      return null;
    }
    function resolveSelectedNode() {
      const sel = state.selectedId != null && String(state.selectedId).trim() !== '' ? String(state.selectedId) : null;
      if (sel) {
        const hit = walkFind(state.workflow.activities, sel);
        if (hit) {
          state.selectedNode = hit.node;
          state.selectedId = String(hit.node.id);
          return hit;
        }
      }
      if (state.selectedNode) {
        const byRef = walkFindRef(state.workflow.activities, state.selectedNode);
        if (byRef) {
          setSelectedNode(byRef.node);
          return byRef;
        }
        if (String(state.selectedNode.id || '').trim()) {
          const hit = walkFind(state.workflow.activities, String(state.selectedNode.id));
          if (hit) {
            setSelectedNode(hit.node);
            return hit;
          }
        }
        // Soft rematch — SW reopen / Sync id rewrite
        const rematch = softRematchNode(state.selectedNode);
        if (rematch) {
          const found = walkFindRef(state.workflow.activities, rematch) ||
            walkFind(state.workflow.activities, rematch.id);
          if (found) {
            setSelectedNode(found.node);
            return found;
          }
        }
      }
      // DOM still shows selection chrome after a Sync id rewrite — recover from data-id
      const dom = document.querySelector('.card.selected[data-id], .flow-node.selected[data-id]');
      const domId = dom && dom.getAttribute('data-id');
      if (domId) {
        const hit = walkFind(state.workflow.activities, domId);
        if (hit) {
          setSelectedNode(hit.node);
          return hit;
        }
      }
      return null;
    }
    function selectActivity(id, opts) {
      // Prefer tree-backed selection — card clicks pass the live node by reference
      if (opts && opts.node && (typeof opts.node.id !== 'string' || !String(opts.node.id).trim())) {
        opts.node.id = newId();
      }
      const heal = ensureActivityIds(state.workflow.activities);
      let hit = null;
      // 1) Object identity (most reliable for canvas card / flow node clicks)
      if (opts && opts.node) {
        hit = walkFindRef(state.workflow.activities, opts.node);
      }
      // 2) By id
      if (!hit && String(id || '').trim()) {
        hit = walkFind(state.workflow.activities, String(id));
      }
      // 3) Soft rematch when click ref is detached (SW reopen / Sync rewrite)
      if (!hit && opts && opts.node) {
        const rematch = softRematchNode(opts.node);
        if (rematch) {
          hit = walkFindRef(state.workflow.activities, rematch) ||
            walkFind(state.workflow.activities, rematch.id);
        }
      }
      if (!hit) {
        // Keep prior selection if any; do not blank the panel on a missed click
        if (heal) persist(false);
        return false;
      }
      setSelectedNode(hit.node);
      ensurePropsPanelVisible();
      state.collapsedPropSections.activity = false;
      state.collapsedPropSections.general = false;
      if (state.collapsedPropSections.studioWeb === undefined) {
        state.collapsedPropSections.studioWeb = true;
      }
      // Paint props first; avoid full renderAll on every click (destroyed the card mid-pointerdown)
      renderProps();
      updateSelectedChrome();
      if (opts?.rerender) renderAll();
      else {
        renderBreadcrumbs();
        renderMinimap();
      }
      requestAnimationFrame(() => {
        if (idsEqual(state.selectedId, hit.node.id) || state.selectedNode === hit.node) {
          renderProps();
          updateSelectedChrome();
        }
      });
      if (heal) {
        vscode.postMessage({ type: 'edit', workflow: state.workflow });
      }
      return true;
    }
    function showCtxMenu(x, y, activityId, nodeRef) {
      const menu = document.getElementById('ctxMenu');
      if (!menu) return;
      let node = nodeRef || null;
      if (!node && String(activityId || '').trim()) {
        node = walkFind(state.workflow.activities, String(activityId))?.node || null;
      }
      if (node && !String(node.id || '').trim()) node.id = newId();
      const id = node ? node.id : activityId;
      selectActivity(id, { rerender: false, node: node || undefined });
      state.ctxTargetId = state.selectedId || (node && node.id) || activityId;
      const hit = resolveSelectedNode();
      const resolved = hit?.node || node;
      const openBtn = menu.querySelector('[data-ctx="open"]');
      const vbBtn = menu.querySelector('[data-ctx="vb-repair"]');
      if (openBtn) {
        openBtn.hidden = !(resolved && resolved.type === 'REFramework.InvokeWorkflow' && resolved.properties?.workflowPath);
      }
      if (vbBtn) {
        const repairs = resolved ? vbRepairsForActivity(resolved) : [];
        vbBtn.hidden = !repairs.length;
        vbBtn.textContent = repairs.length
          ? ('Apply VB repairs (' + repairs.length + ')')
          : 'Apply VB expression repairs';
      }
      // Ignore the click that often follows contextmenu / ⋯ button (was hiding the menu instantly)
      state.ctxIgnoreClickUntil = Date.now() + 450;
      menu.classList.add('show');
      // Position after paint so offsetWidth/Height are accurate — flip up near bottom
      requestAnimationFrame(() => {
        const pad = 8;
        const mw = menu.offsetWidth || 180;
        const mh = menu.offsetHeight || 220;
        let left = x;
        let top = y;
        if (left + mw > window.innerWidth - pad) left = window.innerWidth - mw - pad;
        // Prefer opening upward when the menu would clip below the viewport
        if (top + mh > window.innerHeight - pad) {
          top = y - mh;
          if (top < pad) {
            top = Math.max(pad, window.innerHeight - mh - pad);
          }
        }
        menu.style.left = Math.max(pad, left) + 'px';
        menu.style.top = Math.max(pad, top) + 'px';
        menu.style.maxHeight = Math.min(mh, window.innerHeight - pad * 2) + 'px';
      });
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

    /**
     * Catalog $(codicon) → ASCII-safe badge text.
     * Emoji / exotic Unicode often renders as a white tofu circle in Electron webviews.
     */
    const ICON_GLYPHS = {
      output: 'LG', watch: 'T', comment: 'C', 'comment-discussion': 'MB', terminal: '>_',
      'file-text': 'F', save: 'S', 'diff-added': '+', search: '?', 'new-folder': 'D',
      files: 'Fs', trash: 'X', 'file-symlink-file': '>', edit: 'E', 'find-replace': 'R',
      close: 'x', 'symbol-variable': 'v', 'symbol-namespace': '{}', code: '</>',
      error: '!', 'debug-stop': '[]', 'debug-breakpoint-conditional': '?', sync: '@',
      'debug-restart': '@', 'debug-pause': '||', 'debug-continue': '>', 'list-ordered': '1.',
      shield: 'Sh', 'list-flat': '=', 'type-hierarchy-sub': 'Y', 'split-horizontal': 'H',
      'list-tree': 'Tr', window: 'W', browser: 'Br', inspect: 'i', keyboard: 'Kb',
      selection: 'Se', eye: 'Ey', check: 'ok', 'list-selection': 'ok', 'device-camera': 'Cam',
      'symbol-property': 'P', table: 'Tb', file: 'F', add: '+', filter: 'Fi',
      'arrow-swap': '<>', 'clear-all': 'Cl', export: '^', 'git-merge': 'M',
      'symbol-field': '.', 'arrow-both': '<>', 'symbol-key': 'K', mail: '@', globe: 'G',
      inbox: 'In', json: '{}', 'bracket-dot': '[.]', 'symbol-misc': '*', 'file-code': '</>',
      play: '>', 'symbol-method': 'f', 'debug-start': '>', 'run-all': '>>', key: 'K',
      lock: 'Lk', checklist: 'ok'
    };
    /** Strip $(codicon) — do NOT use /\$/ inside this template literal (\\$ becomes $ and breaks the regex → "$(" badges). */
    function iconCodiconName(icon) {
      let s = String(icon || '').trim();
      if (s.indexOf('$(') === 0) s = s.slice(2);
      if (s.endsWith(')')) s = s.slice(0, -1);
      return s.trim();
    }
    function iconGlyph(icon) {
      const key = iconCodiconName(icon);
      if (key && ICON_GLYPHS[key]) return ICON_GLYPHS[key];
      // Prefer a plain circle over garbage like "$(" when the map misses
      return '●';
    }
    function activityIconHtml(defOrType, color) {
      const def = typeof defOrType === 'string' ? findDef(defOrType) : defOrType;
      const c = color || def?.color || '#64748B';
      // Only catalog icon strings — never fall back to type ("System.LogMessage" → "$(" after broken strip)
      const glyph = iconGlyph(def?.icon || '');
      const title = escapeAttr((def?.displayName || '') + (def?.icon ? ' ' + def.icon : ''));
      return '<span class="act-icon" style="--ico:' + escapeAttr(c) + ';background:' + escapeAttr(c) +
        '" title="' + title + '"><span class="act-fb" aria-hidden="true">' + escapeHtml(glyph) +
        '</span></span>';
    }
    function coercePaintValue(val) {
      if (val == null || typeof val !== 'object' || Array.isArray(val)) return val;
      if (val.ExpressionText != null && String(val.ExpressionText).trim() !== '') return String(val.ExpressionText);
      if (val.expressionText != null && String(val.expressionText).trim() !== '') return String(val.expressionText);
      if (val.Expression != null) return String(val.Expression);
      if (val.expression != null) return String(val.expression);
      if (typeof val.Value === 'string' || typeof val.Value === 'number' || typeof val.Value === 'boolean') return val.Value;
      if (typeof val.value === 'string' || typeof val.value === 'number' || typeof val.value === 'boolean') return val.value;
      try { return JSON.stringify(val); } catch (_) { return String(val); }
    }

    /** Variable-binding props — leave empty on add (user creates / picks vars). */
    function isVarBindingProp(p) {
      const n = String(p?.name || '');
      if (/^(to|result|item|row|values|argumentMappings)$/i.test(n)) return true;
      if (/dataTable/i.test(n)) return true;
      if (/^(output|destination|source|target)$/i.test(n) && (p.type === 'string' || p.type === 'expression' || !p.type)) return true;
      return false;
    }
    function createActivity(type, x, y) {
      const def = findDef(type);
      if (!def) return null;
      const properties = {};
      for (const p of def.properties) {
        // Do not auto-seed variable names (dt, result, …) — Properties stay blank until user chooses
        if (isVarBindingProp(p)) {
          properties[p.name] = '';
        } else {
          properties[p.name] = p.defaultValue ?? '';
        }
      }
      const node = { id: newId(), type: def.type, displayName: def.displayName, properties };
      if (def.container) node.children = [];
      if (def.hasElse) node.elseChildren = [];
      if (isFlow()) {
        node.x = typeof x === 'number' ? x : 80 + (state.workflow.activities.length % 4) * 200;
        node.y = typeof y === 'number' ? y : 80 + Math.floor(state.workflow.activities.length / 4) * 140;
      }
      return node;
    }

    function parseArgumentMappings(raw) {
      const text = String(raw ?? '').trim();
      if (!text) return [];
      if (text.startsWith('{')) {
        try {
          const obj = JSON.parse(text);
          return Object.entries(obj).map(([name, value]) => {
            if (value && typeof value === 'object') {
              return {
                name: String(name).trim(),
                expression: String(value.expression ?? '').trim(),
                direction: value.direction === 'Out' || value.direction === 'InOut' ? value.direction : (value.direction === 'In' ? 'In' : undefined)
              };
            }
            return { name: String(name).trim(), expression: String(value ?? '').trim() };
          }).filter((m) => m.name);
        } catch (_) {}
      }
      const out = [];
      for (const line of text.split(/\\r?\\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const directed = trimmed.match(/^(In|Out|InOut)\\s*:\\s*([A-Za-z_][\\w]*)\\s*(?:=|:)\\s*(.+)$/i);
        if (directed) {
          const dirRaw = directed[1];
          const direction = /^out$/i.test(dirRaw) ? 'Out' : /^inout$/i.test(dirRaw) ? 'InOut' : 'In';
          out.push({ name: directed[2], expression: directed[3].trim(), direction });
          continue;
        }
        const m = trimmed.match(/^([A-Za-z_][\\w]*)\\s*(?:=|:)\\s*(.+)$/);
        if (m) out.push({ name: m[1], expression: m[2].trim() });
      }
      return out;
    }
    function formatArgumentMappings(mappings) {
      return (mappings || []).filter((m) => m.name).map((m) => {
        const expr = m.expression || '""';
        if (m.direction === 'Out' || m.direction === 'InOut') return m.direction + ':' + m.name + ' = ' + expr;
        return m.name + ' = ' + expr;
      }).join('\\n');
    }
    function mergeInvokeMappings(targetArgs, existing) {
      const byName = new Map((existing || []).map((m) => [m.name, m]));
      const out = [];
      for (const arg of targetArgs || []) {
        const name = String(arg.name || '').trim();
        if (!name) continue;
        const prev = byName.get(name);
        out.push({
          name,
          expression: prev?.expression ?? '',
          direction: arg.direction || prev?.direction || 'In'
        });
        byName.delete(name);
      }
      for (const m of byName.values()) out.push(m);
      return out;
    }
    function requestTargetArguments(workflowPath) {
      const path = String(workflowPath || '').trim();
      if (!path) return;
      vscode.postMessage({ type: 'loadWorkflowArguments', workflowPath: path });
    }

    /** Ancestor chain from root to the node (inclusive), for nested breadcrumbs. */
    function walkAncestors(list, id, trail) {
      const path = trail || [];
      const want = String(id ?? '');
      if (!want) return null;
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        const next = path.concat(node);
        if (String(node.id ?? '') === want) return next;
        if (node.children) {
          const hit = walkAncestors(node.children, want, next);
          if (hit) return hit;
        }
        if (node.elseChildren) {
          const hit = walkAncestors(node.elseChildren, want, next);
          if (hit) return hit;
        }
        if (node.finallyChildren) {
          const hit = walkAncestors(node.finallyChildren, want, next);
          if (hit) return hit;
        }
        for (const clause of node.catches || []) {
          if (clause && clause.children) {
            const hit = walkAncestors(clause.children, want, next);
            if (hit) return hit;
          }
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
        if (node.finallyChildren) walkCollect(node.finallyChildren, acc);
        for (const clause of node.catches || []) {
          if (clause && clause.children) walkCollect(clause.children, acc);
        }
      }
      return acc;
    }

    function summary(node) {
      const p = node.properties || {};
      switch (node.type) {
        case 'System.LogMessage': return String(coercePaintValue(p.message ?? p.Message) || '');
        case 'Programming.Assign': return (coercePaintValue(p.to) || '') + ' := ' + (coercePaintValue(p.value) || '');
        case 'Flowchart.FlowDecision': return String(coercePaintValue(p.condition) || '');
        case 'REFramework.InvokeWorkflow': return String(coercePaintValue(p.workflowPath ?? p.WorkflowFileName) || '');
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
      state._zoomUserTouched = true;
      state.zoom = Math.min(1.75, Math.max(0.5, Math.round(next * 100) / 100));
      applyZoom();
    }
    function zoomToActivity(id) {
      const el = document.querySelector('[data-id="' + id + '"]');
      if (!el) return;
      if (state.zoom < 0.9) setZoom(1);
      highlightSearchHit(id);
    }
    function fitCanvasView() {
      const wrap = document.getElementById('canvasWrap');
      if (!wrap) { setZoom(1); return; }
      const wrapW = Math.max(200, wrap.clientWidth - 48);
      const wrapH = Math.max(160, wrap.clientHeight - 120);
      if (isFlow()) {
        const nodes = state.workflow.activities || [];
        if (!nodes.length) { setZoom(1); return; }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const focus = state.selectedId
          ? nodes.filter((n) => n.id === state.selectedId)
          : nodes;
        const list = focus.length ? focus : nodes;
        for (const n of list) {
          const x = n.x || 0, y = n.y || 0;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + 180); maxY = Math.max(maxY, y + 90);
        }
        const spanX = Math.max(160, maxX - minX + 80);
        const spanY = Math.max(120, maxY - minY + 80);
        const next = Math.min(1.5, Math.max(0.5, Math.min(wrapW / spanX, wrapH / spanY)));
        setZoom(next);
        requestAnimationFrame(() => {
          if (state.selectedId) highlightSearchHit(state.selectedId);
          else toast('Fit · ' + Math.round(next * 100) + '%');
        });
        return;
      }
      const target = state.selectedId
        ? document.querySelector('.card[data-id="' + state.selectedId + '"]')
        : null;
      if (target) {
        setZoom(Math.max(state.zoom, 1));
        requestAnimationFrame(() => highlightSearchHit(state.selectedId));
        toast('Focused selection');
        return;
      }
      const cards = els.sequence?.querySelectorAll('.card');
      if (!cards || !cards.length) { setZoom(1); return; }
      let maxBottom = 0;
      cards.forEach((c) => { maxBottom = Math.max(maxBottom, c.offsetTop + c.offsetHeight); });
      const next = Math.min(1.25, Math.max(0.55, wrapH / Math.max(maxBottom + 80, wrapH)));
      setZoom(next);
      toast('Fit · ' + Math.round(next * 100) + '%');
    }
    function alignSelectedFlowNodes() {
      if (!isFlow() || !state.selectedId) { toast('Select a flowchart node first'); return; }
      const selected = state.workflow.activities.find((a) => a.id === state.selectedId);
      if (!selected) return;
      const targetX = selected.x || 0;
      let n = 0;
      for (const a of state.workflow.activities) {
        if (a.id === selected.id) continue;
        // Align nodes roughly on the same row (±40px) to the selected X
        if (Math.abs((a.y || 0) - (selected.y || 0)) <= 48) {
          a.x = targetX;
          n++;
        }
      }
      if (!n) {
        // Fallback: align all to selected X
        for (const a of state.workflow.activities) {
          if (a.id === selected.id) continue;
          a.x = targetX;
          n++;
        }
      }
      persist(true);
      toast('Aligned ' + n + ' node(s) to selection');
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
              activityIconHtml(a) +
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
          state.dragActivityId = null;
          e.dataTransfer.setData('text/plain', state.dragType || '');
          try { e.dataTransfer.setData('application/lcs-activity-id', ''); } catch (_) {}
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
          setSelectedNode(node);
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
      if (branch === 'finally') { hit.node.finallyChildren ||= []; return hit.node.finallyChildren; }
      if (branch && branch.indexOf('catch') === 0) {
      const idx = Number(branch.slice(5));
      hit.node.catches = Array.isArray(hit.node.catches) ? hit.node.catches : [];
      if (!hit.node.catches[idx]) {
        hit.node.catches[idx] = { exceptionType: 'System.Exception', exceptionVariable: 'exception', children: [] };
      }
      hit.node.catches[idx].children ||= [];
      return hit.node.catches[idx].children;
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
    function pathContainsActivity(pathKey, activityId) {
      if (!pathKey || !activityId) return false;
      const base = String(pathKey).split('@')[0];
      if (base === activityId || base.startsWith(activityId + ':')) return true;
      return false;
    }
    function moveActivityToPath(activityId, pathKey) {
      if (!activityId || pathContainsActivity(pathKey, activityId)) return false;
      const hit = walkFind(state.workflow.activities, activityId);
      if (!hit) return false;
      const [item] = hit.list.splice(hit.index, 1);
      insertAtPath(pathKey, item);
      setSelectedNode(item);
      return true;
    }
    function dropZone(pathKey) {
      const z = document.createElement('div');
      z.className = 'drop-zone';
      z.dataset.path = pathKey;
      z.title = 'Drop activity here, or click + to insert';
      z.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = state.dragActivityId ? 'move' : 'copy';
        z.classList.add('active');
      });
      z.addEventListener('dragleave', () => z.classList.remove('active'));
      z.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        z.classList.remove('active');
        const moveId =
          e.dataTransfer.getData('application/lcs-activity-id') || state.dragActivityId;
        if (moveId) {
          if (moveActivityToPath(moveId, pathKey)) {
            state.dragActivityId = null;
            persist(true);
            toast('Moved activity');
          }
          return;
        }
        const type = e.dataTransfer.getData('text/plain') || state.dragType;
        if (!type) {
          toast('Drop an activity from the toolbox');
          return;
        }
        const node = createActivity(type);
        if (!node) {
          toast('Unknown activity type — pick from Activities');
          return;
        }
        insertAtPath(pathKey, node);
        setSelectedNode(node);
        ensurePropsPanelVisible();
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
      card.draggable = true;
      card.className = 'card' + (idsEqual(state.selectedId, node.id) ? ' selected' : '') + dryRunClass(node.id);
      const bpOn = !!state.breakpoints[node.id];
      const selWarn = selectorCardWarn(node);
      if (bpOn) card.classList.add('has-bp');
      card.innerHTML =
        '<div class="card-accent" style="background:' + color + '"></div>' +
        (bpOn ? '<span class="card-bp-dot" title="Breakpoint set — right-click or ⋯ to toggle"></span>' : '') +
        '<button type="button" class="card-menu" data-card-menu title="Activity menu">⋯</button>' +
        '<div class="card-head"><span class="step">#' + stepNo + '</span>' +
        activityIconHtml(def || node.type, color) +
        '<div class="card-title">' + escapeHtml(node.displayName) + '</div></div>' +
        '<div class="card-summary">' + escapeHtml(summary(node)) + '</div>' +
        (selWarn
          ? '<div class="card-warn' + (selWarn.level === 'weak' ? ' weak' : '') + '">' + escapeHtml(selWarn.text) + '</div>'
          : '<div class="card-warn" style="display:none"></div>');
      card.addEventListener('mouseenter', (e) => showTip(tipHtml(node), e.clientX, e.clientY));
      card.addEventListener('mousemove', (e) => showTip(tipHtml(node), e.clientX, e.clientY));
      card.addEventListener('mouseleave', hideTip);
      // pointerdown: draggable cards often swallow click after a tiny move
      const selectThis = (e) => {
        if (e.target.closest('[data-card-menu]')) return;
        if (typeof node.id !== 'string' || !String(node.id).trim()) node.id = newId();
        // rerender:false — full renderAll mid-pointerdown destroyed the card and raced props wiring
        selectActivity(node.id, { rerender: false, node: node });
        hideTip();
        hideCtxMenu();
      };
      card.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        selectThis(e);
      });
      card.addEventListener('click', (e) => {
        // Re-assert selection if pointerdown was skipped (keyboard / accessibility)
        if (!idsEqual(state.selectedId, node.id)) selectThis(e);
      });
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!String(node.id || '').trim()) node.id = newId();
        hideTip();
        showCtxMenu(e.clientX, e.clientY, node.id, node);
      });
      card.querySelector('[data-card-menu]')?.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      card.querySelector('[data-card-menu]')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideTip();
        const rect = e.currentTarget.getBoundingClientRect();
        showCtxMenu(rect.left, rect.bottom + 4, node.id, node);
        renderProps();
      });
      card.addEventListener('dragstart', (e) => {
        if (e.target.closest('[data-card-menu]')) {
          e.preventDefault();
          return;
        }
        state.dragActivityId = node.id;
        state.dragType = null;
        try {
          e.dataTransfer.setData('application/lcs-activity-id', node.id);
          e.dataTransfer.setData('text/plain', '');
        } catch (_) {}
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
        hideTip();
        hideCtxMenu();
      });
      card.addEventListener('dragend', () => {
        state.dragActivityId = null;
        card.classList.remove('dragging');
      });
      card.addEventListener('dblclick', (e) => {
        if (node.type === 'REFramework.InvokeWorkflow' && node.properties?.workflowPath) {
          e.stopPropagation();
          vscode.postMessage({ type: 'openWorkflow', workflowPath: String(node.properties.workflowPath) });
        }
      });
      wrap.appendChild(card);
      const showBody = !!(def?.container || (node.children && node.children.length) || (node.elseChildren && node.elseChildren.length));
      if (showBody) {
  const children = document.createElement('div');
  children.className = 'children';
  children.appendChild(Object.assign(document.createElement('div'), { className: 'branch-label', textContent: node.type === 'ControlFlow.TryCatch' ? 'Try' : (def?.hasElse ? 'Then' : 'Body') }));
  renderList(node.children || [], children, node.id + ':then');
  wrap.appendChild(children);

  if (node.type === 'ControlFlow.TryCatch') {
    const catches = Array.isArray(node.catches) && node.catches.length
      ? node.catches
      : [{ exceptionType: node.properties?.exceptionType || 'System.Exception', exceptionVariable: 'exception', children: node.elseChildren || [] }];
    catches.forEach((clause, ci) => {
      const catchWrap = document.createElement('div');
      catchWrap.className = 'else-children';
      const label = document.createElement('div');
      label.className = 'branch-label';
      label.textContent = 'Catch (' + (clause.exceptionType || 'System.Exception') + ')';
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-btn';
      delBtn.title = 'Remove this catch clause';
      delBtn.textContent = '✕';
      delBtn.style.marginLeft = '8px';
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = walkFind(state.workflow.activities, node.id)?.node;
        if (!target || !Array.isArray(target.catches)) return;
        target.catches.splice(ci, 1);
        persist(true);
        toast('Removed catch clause');
      });
      label.appendChild(delBtn);
      catchWrap.appendChild(label);
      renderList(clause.children || [], catchWrap, node.id + ':catch' + ci);
      wrap.appendChild(catchWrap);
    });

    const addCatchBtn = document.createElement('button');
    addCatchBtn.type = 'button';
    addCatchBtn.className = 'btn';
    addCatchBtn.style.margin = '4px 0 8px 10px';
    addCatchBtn.textContent = '+ Add Catch';
    addCatchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = walkFind(state.workflow.activities, node.id)?.node;
      if (!target) return;
      target.catches = Array.isArray(target.catches) ? target.catches : [];
      target.catches.push({ exceptionType: 'System.Exception', exceptionVariable: 'exception', children: [] });
      persist(true);
      toast('Catch clause added');
    });
    wrap.appendChild(addCatchBtn);

    const finallyWrap = document.createElement('div');
    finallyWrap.className = 'else-children';
    finallyWrap.appendChild(Object.assign(document.createElement('div'), { className: 'branch-label', textContent: 'Finally' }));
    renderList(node.finallyChildren || [], finallyWrap, node.id + ':finally');
    wrap.appendChild(finallyWrap);
      } else if (def?.hasElse || (node.elseChildren && node.elseChildren.length)) {
      const elseChildren = document.createElement('div');
      elseChildren.className = 'else-children';
      elseChildren.appendChild(Object.assign(document.createElement('div'), { className: 'branch-label', textContent: 'Else' }));
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
      const w = isDecision ? 148 : isTerminal ? 120 : 156;
      const h = isDecision ? 148 : isTerminal ? 48 : 64;
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
          (idsEqual(state.selectedId, node.id) ? ' selected' : '') +
          (isDecision ? ' decision' : '') +
          (isStart ? ' start' : '') +
          (isEnd ? ' end' : '') +
          (selWarn && (selWarn.level === 'empty' || selWarn.level === 'placeholder') ? ' selector-missing' : '') +
          dryRunClass(node.id);
        el.style.left = (node.x || 40) + 'px';
        el.style.top = (node.y || 40) + 'px';
        el.style.borderColor = node.color || def?.color || undefined;
        const bpOn = !!state.breakpoints[node.id];
        const bpDot = bpOn ? '<span class="card-bp-dot" title="Breakpoint set — right-click to toggle"></span>' : '';
        if (bpOn) el.classList.add('has-bp');
        const menuBtn = '<button type="button" class="card-menu" data-card-menu title="Activity menu">⋯</button>';
        const ico = activityIconHtml(def || node.type, node.color || def?.color);
        if (isDecision) {
          el.innerHTML = bpDot + menuBtn + '<div class="inner">' + ico + '<div class="title">' + escapeHtml(node.displayName) + '</div><div class="summary">' + escapeHtml(summary(node)) + '</div></div><div class="port" title="Drag to connect"></div>';
        } else {
          el.innerHTML = bpDot + menuBtn + '<div class="title">' + ico + escapeHtml(node.displayName) + '</div>' +
            (isStart || isEnd ? '' : '<div class="summary">' + escapeHtml(summary(node)) + '</div>') +
            warnHtml +
            (isEnd ? '' : '<div class="port" title="Drag to connect"></div>');
        }
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!String(node.id || '').trim()) node.id = newId();
          hideTip();
          showCtxMenu(e.clientX, e.clientY, node.id, node);
          renderProps();
        });
        el.querySelector('[data-card-menu]')?.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        el.querySelector('[data-card-menu]')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          hideTip();
          const rect = e.currentTarget.getBoundingClientRect();
          showCtxMenu(rect.left, rect.bottom + 4, node.id, node);
          renderProps();
        });

        el.addEventListener('mousedown', (e) => {
          if (e.target.classList.contains('port') || e.target.closest('[data-card-menu]')) return;
          if (!String(node.id || '').trim()) node.id = newId();
          state.draggingId = node.id;
          const pt = stagePoint(e);
          state.dragOffset = { x: pt.x - (node.x || 0), y: pt.y - (node.y || 0) };
          hideTip();
          selectActivity(node.id, { rerender: false, node: node });
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
        const node = createActivity(type, pt.x - 52, pt.y - 18);
        if (!node) return;
        state.workflow.activities.push(node);
        if (node.type === 'Flowchart.Start') state.workflow.startActivityId = node.id;
        setSelectedNode(node);
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
        const remapped = wp.endsWith('.xaml') ? wp.replace(/\.xaml$/i, '.lcs.json') : wp;
        const inSuggestions = !!wp && (known.length === 0 || known.some(k =>
          k === wp || k === remapped || k.endsWith('/' + wp) || k.endsWith('/' + remapped) ||
          k.endsWith('\\\\' + wp) || k.endsWith('\\\\' + remapped)
        ));
        const hostHit = state.invokePathExists && state.invokePathExists[wp];
        const exists = hostHit === true || (hostHit !== false && inSuggestions);
        if (wp && hostHit === undefined) {
          requestInvokePathCheck(wp);
        }
        items.push({
          ok: !!wp && exists,
          text: !wp
            ? 'Invoke Workflow needs a workflow path'
            : (exists
              ? 'Invoke path found: ' + wp
              : 'Invoke path missing on disk: ' + wp)
        });
        const target = state.targetArgsByPath[wp];
        if (target && target.length) {
          const mapped = parseArgumentMappings(node.properties?.argumentMappings);
          const missing = target.filter((a) => !mapped.some((m) => m.name === a.name && String(m.expression || '').trim()));
          items.push({
            ok: missing.length === 0,
            text: missing.length
              ? 'Missing argument mappings: ' + missing.map((a) => a.name).join(', ')
              : 'Argument mappings cover target contract (' + target.length + ')'
          });
        }
      }
      if (String(node.type || '').startsWith('Imported.')) {
        items.push({
          ok: false,
          text: 'Imported.* type — map to a real LCS activity before Studio Web round-trip'
        });
      }
      if (node.type === 'Data.BuildDataTable') {
        items.push({
          ok: true,
          text: 'Build Data Table is Windows-only — Save→Studio Web rewrites to New DataTable + Add Data Column'
        });
      }
      if (node.type === 'Programming.MultipleAssign') {
        items.push({
          ok: true,
          text: 'Multiple Assign is Windows-only — Save→Studio Web expands to Assign sequence'
        });
      }
      if (node.type === 'System.MessageBox') {
        items.push({
          ok: true,
          text: 'Message Box is Windows-only — Save→Studio Web rewrites to Log Message'
        });
      }
      if (node.type === 'System.DeleteFile' || node.type === 'Excel.ExcelApplicationScope' || String(node.type || '').startsWith('Python.')) {
        items.push({
          ok: false,
          text: 'Windows-only activity — Studio Web Save emits a Comment placeholder (use Windows export or replace)'
        });
      }
      if (node.type === 'UI.UseApplicationBrowser' || node.type === 'UI.OpenApplication') {
        items.push({
          ok: true,
          text: 'Exports as NApplicationCard + TargetApp (Studio Web–safe modern shape)'
        });
      }
      if (node.type === 'UI.ElementExists' || node.type === 'UI.WaitElement') {
        items.push({
          ok: true,
          text: 'Exports as modern NCheckState (classic ElementExists/OnElementAppear break Studio Web)'
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

    /** Compact UiPath VB rewrite for live Properties hints (mirrors Assist F4). */
    function rewriteVbExpression(input) {
      const original = String(input ?? '');
      if (!original.trim()) return { next: original, changed: false, labels: [] };
      const labels = [];
      const note = (label) => { if (!labels.includes(label)) labels.push(label); };
      const parts = [];
      let i = 0, code = '';
      while (i < original.length) {
        const ch = original[i];
        if (ch === '"' || ch === "'") {
          if (code) { parts.push({ kind: 'code', text: code }); code = ''; }
          const q = ch; let s = q; i++;
          while (i < original.length) {
            s += original[i];
            if (original[i] === q) {
              if (original[i + 1] === q) { s += original[i + 1]; i += 2; continue; }
              i++; break;
            }
            i++;
          }
          parts.push({ kind: 'string', text: s });
          continue;
        }
        code += ch; i++;
      }
      if (code) parts.push({ kind: 'code', text: code });
      const sub = (chunk, pattern, flags, repl, label) => {
        const re = new RegExp(pattern, flags);
        let hit = false;
        const next = chunk.replace(re, (...args) => {
          hit = true;
          return typeof repl === 'function' ? repl(...args) : String(repl);
        });
        if (hit) note(label);
        return next;
      };
      const unary = (chunk, name, wrap, label) =>
        sub(chunk, '(?<![\\\\w.])' + name + '\\\\s*\\\\(\\\\s*([^()]+?)\\\\s*\\\\)', 'gi', (_m, arg) => wrap(String(arg).trim()), label);
      for (let pi = 0; pi < parts.length; pi++) {
        if (parts[pi].kind === 'string') continue;
        let c = parts[pi].text;
        c = sub(c, '\\\\.toUpperCase\\\\s*\\\\(', 'gi', '.ToUpper(', '.toUpperCase() → .ToUpper()');
        c = sub(c, '\\\\.toLowerCase\\\\s*\\\\(', 'gi', '.ToLower(', '.toLowerCase() → .ToLower()');
        c = sub(c, '\\\\.trim\\\\s*\\\\(', 'gi', '.Trim(', '.trim() → .Trim()');
        c = sub(c, '\\\\.includes\\\\s*\\\\(', 'gi', '.Contains(', '.includes() → .Contains()');
        c = sub(c, '\\\\.startsWith\\\\s*\\\\(', 'gi', '.StartsWith(', '.startsWith() → .StartsWith()');
        c = sub(c, '\\\\.endsWith\\\\s*\\\\(', 'gi', '.EndsWith(', '.endsWith() → .EndsWith()');
        c = sub(c, '\\\\.length\\\\b', 'g', '.Length', '.length → .Length');
        c = unary(c, 'Trim', (a) => a + '.Trim()', 'Trim(x) → x.Trim()');
        c = unary(c, 'LTrim', (a) => a + '.TrimStart()', 'LTrim(x) → x.TrimStart()');
        c = unary(c, 'RTrim', (a) => a + '.TrimEnd()', 'RTrim(x) → x.TrimEnd()');
        c = unary(c, 'UCase', (a) => a + '.ToUpper()', 'UCase(x) → x.ToUpper()');
        c = unary(c, 'LCase', (a) => a + '.ToLower()', 'LCase(x) → x.ToLower()');
        c = unary(c, 'Len', (a) => a + '.Length', 'Len(x) → x.Length');
        const lhs = '([\\\\w.]+(?:\\\\([^)]*\\\\))?)';
        c = sub(c, lhs + '\\\\s*(?:===|==)\\\\s*(?:null|undefined)\\\\b', 'gi', (_m, a) => a + ' Is Nothing', '== null → Is Nothing');
        c = sub(c, lhs + '\\\\s*(?:!==|!=)\\\\s*(?:null|undefined)\\\\b', 'gi', (_m, a) => a + ' IsNot Nothing', '!= null → IsNot Nothing');
        c = sub(c, '\\\\bundefined\\\\b', 'g', 'Nothing', 'undefined → Nothing');
        c = sub(c, '\\\\bnull\\\\b', 'g', 'Nothing', 'null → Nothing');
        c = sub(c, lhs + '\\\\s*(?:==|=)\\\\s*Nothing\\\\b', 'gi', (_m, a) => a + ' Is Nothing', '= Nothing → Is Nothing');
        c = sub(c, '===', 'g', '=', '=== → =');
        c = sub(c, '!==', 'g', '<>', '!== → <>');
        c = sub(c, '!=', 'g', '<>', '!= → <>');
        c = sub(c, '&&', 'g', ' AndAlso ', '&& → AndAlso');
        c = sub(c, '\\\\|\\\\|', 'g', ' OrElse ', '|| → OrElse');
        c = sub(c, '\\\\btrue\\\\b', 'g', 'True', 'true → True');
        c = sub(c, '\\\\bfalse\\\\b', 'g', 'False', 'false → False');
        c = c.replace(/[ \t]{2,}/g, ' ');
        parts[pi] = { kind: 'code', text: c };
      }
      const next = parts.map((p) => p.text).join('');
      return { next, changed: next !== original, labels };
    }
    function vbRepairsForActivity(node) {
      const def = findDef(node.type);
      const out = [];
      const props = node.properties || {};
      for (const [name, raw] of Object.entries(props)) {
        if (typeof raw !== 'string') continue;
        if (name === 'selector' || name === 'selectorModern' || name === 'selectorXml') continue;
        const pdef = (def?.properties || []).find((p) => p.name === name);
        const expressionish = pdef
          ? (pdef.type === 'expression' || pdef.type === 'multiline' || name === 'condition' || name === 'expression' || name === 'assignments')
          : /^(condition|message|value|text|expression|url|jsonString|json|arrayRow|subject|body|assignments|argumentMappings)$/.test(name);
        if (!expressionish) continue;
        const r = rewriteVbExpression(raw);
        if (r.changed) out.push({ name, label: pdef?.label || name, original: raw, proposed: r.next, labels: r.labels });
      }
      return out;
    }
    function applyVbRepairsToActivity(node) {
      const repairs = vbRepairsForActivity(node);
      if (!repairs.length) return 0;
      for (const r of repairs) node.properties[r.name] = r.proposed;
      return repairs.length;
    }
    function vbRepairHintHtml(propName, currentValue) {
      const r = rewriteVbExpression(String(currentValue ?? ''));
      if (!r.changed) return '';
      return '<div class="vb-repair-hint" data-vb-for="' + escapeAttr(propName) + '">' +
        'UiPath VB repair: ' + escapeHtml(r.labels.join('; ') || 'expression fix') +
        '<span class="vb-proposed">' + escapeHtml(r.next) + '</span>' +
        '<button type="button" class="vb-apply" data-vb-apply="' + escapeAttr(propName) + '" data-vb-value="' + escapeAttr(r.next) + '">Apply repair</button>' +
        '</div>';
    }

    function defaultFillForProp(p) {
      if (p.defaultValue !== undefined && p.defaultValue !== null && String(p.defaultValue).trim() !== '') {
        return p.defaultValue;
      }
      const n = String(p.name || '').toLowerCase();
      if (n === 'message' || n === 'text') return '"TODO"';
      if (n === 'condition' || n === 'expression') return 'True';
      if (n === 'level') return 'Info';
      if (n === 'method') return 'GET';
      if (n === 'url' || n === 'urlorpath') return '"https://example.com"';
      if (n === 'duration' || n === 'durationms') return n === 'durationms' ? 2000 : '00:00:02';
      if (n === 'selector') return "<html app='chrome.exe' title='*' /><webctrl tag='BUTTON' id='' />";
      if (n === 'result' || n === 'to' || n === 'item' || n === 'row') return n === 'to' ? 'result' : n;
      return p.type === 'number' ? 0 : (p.type === 'boolean' ? true : '""');
    }

    /** Live Assist proposals (selected activity first, then workflow-wide VB / required / selectors). */
    function collectLiveAssistProposals(opts) {
      const selectedOnly = !!(opts && opts.selectedOnly);
      const nodes = selectedOnly && state.selectedId
        ? (() => {
            const hit = walkFind(state.workflow.activities, state.selectedId);
            return hit ? [hit.node] : [];
          })()
        : walkCollect(state.workflow.activities);
      const out = [];
      for (const node of nodes) {
        const def = findDef(node.type);
        for (const r of vbRepairsForActivity(node)) {
          out.push({
            id: 'vb:' + node.id + ':' + r.name,
            kind: 'vb',
            activityId: node.id,
            property: r.name,
            label: 'VB · ' + (node.displayName || node.type),
            detail: (r.label || r.name) + ': ' + (r.labels[0] || 'fix') + ' → ' + r.proposed,
            proposed: r.proposed,
            actionable: true
          });
        }
        for (const p of (def?.properties || [])) {
          if (!p.required) continue;
          const cur = node.properties?.[p.name];
          const empty = cur === undefined || cur === null || String(cur).trim() === '';
          if (!empty) continue;
          const proposed = defaultFillForProp(p);
          out.push({
            id: 'req:' + node.id + ':' + p.name,
            kind: 'required',
            activityId: node.id,
            property: p.name,
            label: 'Fill · ' + (node.displayName || node.type),
            detail: 'Required “' + (p.label || p.name) + '” → ' + String(proposed),
            proposed,
            actionable: true
          });
        }
        const sw = selectorCardWarn(node);
        if (sw && (sw.level === 'empty' || sw.level === 'placeholder' || sw.level === 'weak')) {
          const proposed = defaultFillForProp({ name: 'selector', type: 'string' });
          const actionable = sw.level === 'empty' || sw.level === 'placeholder';
          out.push({
            id: 'sel:' + node.id,
            kind: 'selector',
            activityId: node.id,
            property: 'selector',
            label: 'Selector · ' + (node.displayName || node.type),
            detail: sw.text + (actionable ? ' — Apply inserts a starter classic selector' : ' — tighten Id/aaname in Selector Builder'),
            proposed,
            actionable
          });
        }
      }
      return out;
    }

    function applyLiveProposal(p) {
      if (!p || !p.actionable) return false;
      const hit = walkFind(state.workflow.activities, p.activityId);
      if (!hit) return false;
      hit.node.properties = hit.node.properties || {};
      hit.node.properties[p.property] = p.proposed;
      return true;
    }

    function invokeMapEditorHtml(node) {
      const path = String(node.properties?.workflowPath || '').trim();
      const existing = parseArgumentMappings(node.properties?.argumentMappings);
      const target = state.targetArgsByPath[path];
      const status = state.targetArgsStatus[path];
      const rows = target && target.length
        ? mergeInvokeMappings(target, existing)
        : (existing.length
          ? existing
          : [{ name: '', expression: '', direction: 'In' }]);
      const missing = (target || []).filter((a) => {
        const hit = existing.find((m) => m.name === a.name && String(m.expression || '').trim());
        return !hit;
      });
      let html = '<div class="invoke-map" id="invokeMapEditor">';
      html += '<div class="invoke-map-toolbar">' +
        '<button type="button" class="btn" id="btnLoadTargetArgs"' + (path ? '' : ' disabled') + '>Load args from workflow</button>' +
        '<button type="button" class="btn" id="btnFillMissingMaps"' + (target && target.length ? '' : ' disabled') + '>Add missing</button>' +
        '</div>';
      if (!path) {
        html += '<div class="empty">Set Workflow Path first.</div>';
      } else if (status && status !== 'ok') {
        html += '<div class="invoke-map-missing">' + escapeHtml(status) + '</div>';
      } else if (target && missing.length) {
        html += '<div class="invoke-map-missing">Missing: ' +
          escapeHtml(missing.map((a) => (a.direction === 'Out' || a.direction === 'InOut' ? a.direction + ':' : '') + a.name).join(', ')) +
          '</div>';
      } else if (target && !target.length) {
        html += '<div class="empty">Target workflow has no arguments contract.</div>';
      }
      html += '<div id="invokeMapRows">' +
        rows.map((m, i) => {
          const dir = m.direction || 'In';
          const name = m.name || '';
          return '<div class="invoke-map-row" data-im-row="' + i + '">' +
            '<div class="im-name" title="' + escapeAttr(name) + '"><span class="im-dir ' + escapeAttr(dir) + '">' +
            escapeHtml(dir) + '</span>' + escapeHtml(name || '(name)') + '</div>' +
            '<input data-im-expr="' + i + '" data-im-name="' + escapeAttr(name) + '" data-im-dir="' + escapeAttr(dir) +
            '" value="' + escapeAttr(m.expression || '') + '" placeholder="Expression (caller var / arg)" list="dl_invoke_expr" />' +
            '</div>';
        }).join('') +
        '</div>';
      const suggest = [
        ...(state.suggestions?.variables || []),
        ...(state.workflow.arguments || []).map((a) => a.name)
      ].slice(0, 40);
      if (suggest.length) {
        html += '<datalist id="dl_invoke_expr">' +
          suggest.map((v) => '<option value="' + escapeAttr(v) + '"></option>').join('') +
          '</datalist>';
      }
      html += '<details class="modern-sel" style="margin-top:8px"><summary>Raw mappings</summary>' +
        '<textarea data-prop="argumentMappings" id="invokeMapRaw">' +
        escapeHtml(String(node.properties?.argumentMappings || '')) +
        '</textarea></details>';
      html += '</div>';
      return html;
    }
    function serializeInvokeMapFromDom() {
      const rows = [];
      els.props.querySelectorAll('[data-im-expr]').forEach((input) => {
        const name = input.getAttribute('data-im-name') || '';
        if (!name) return;
        const direction = input.getAttribute('data-im-dir') || 'In';
        rows.push({
          name,
          expression: input.value || '',
          direction: direction === 'Out' || direction === 'InOut' ? direction : 'In'
        });
      });
      return formatArgumentMappings(rows);
    }
    function wireInvokeMapEditor(node) {
      const path = String(node.properties?.workflowPath || '').trim();
      if (path && state.targetArgsByPath[path] === undefined) {
        requestTargetArguments(path);
      }
      document.getElementById('btnLoadTargetArgs')?.addEventListener('click', () => {
        if (!path) { toast('Set workflow path first'); return; }
        requestTargetArguments(path);
        toast('Loading target arguments…');
      });
      document.getElementById('btnFillMissingMaps')?.addEventListener('click', () => {
        const target = state.targetArgsByPath[path] || [];
        if (!target.length) { toast('Load target arguments first'); return; }
        const merged = mergeInvokeMappings(target, parseArgumentMappings(node.properties?.argumentMappings));
        for (const m of merged) {
          if (!String(m.expression || '').trim()) {
            // Prefer same-named caller arg/var
            const locals = [
              ...(state.workflow.arguments || []).map((a) => a.name),
              ...(state.suggestions?.variables || [])
            ];
            if (locals.includes(m.name)) m.expression = m.name;
            else if (m.direction === 'Out') m.expression = m.name.replace(/^out_?/i, '') || m.name;
            else m.expression = m.name;
          }
        }
        node.properties.argumentMappings = formatArgumentMappings(merged);
        persist(true);
        toast('Filled missing mappings');
      });
      const persistRows = () => {
        node.properties = node.properties || {};
        node.properties.argumentMappings = serializeInvokeMapFromDom();
        const raw = document.getElementById('invokeMapRaw');
        if (raw) raw.value = node.properties.argumentMappings;
        vscode.postMessage({ type: 'edit', workflow: state.workflow });
      };
      els.props.querySelectorAll('[data-im-expr]').forEach((input) => {
        input.addEventListener('change', persistRows);
        input.addEventListener('blur', persistRows);
      });
    }

    function wireCatchesEditor(node) {
  const persistClause = (idx, field, value) => {
    const target = resolveEditTarget();
    if (!target) return;
    target.catches = Array.isArray(target.catches) ? target.catches : [];
    if (!target.catches[idx]) {
      target.catches[idx] = { exceptionType: 'System.Exception', exceptionVariable: 'exception', children: [] };
    }
    if (field === 'type') target.catches[idx].exceptionType = value || 'System.Exception';
    if (field === 'var') target.catches[idx].exceptionVariable = value || 'exception';
    setSelectedNode(target);
    persistPropEdit(target);
  };
  els.props.querySelectorAll('[data-catch-type]').forEach((input) => {
    const idx = Number(input.getAttribute('data-catch-type'));
    input.addEventListener('change', () => persistClause(idx, 'type', input.value.trim()));
    input.addEventListener('blur', () => persistClause(idx, 'type', input.value.trim()));
  });
  els.props.querySelectorAll('[data-catch-var]').forEach((input) => {
    const idx = Number(input.getAttribute('data-catch-var'));
    input.addEventListener('change', () => persistClause(idx, 'var', input.value.trim()));
    input.addEventListener('blur', () => persistClause(idx, 'var', input.value.trim()));
  });
  els.props.querySelectorAll('[data-catch-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-catch-remove'));
      const target = resolveEditTarget();
      if (!target || !Array.isArray(target.catches) || target.catches.length <= 1) {
        toast('TryCatch needs at least one Catch clause');
        return;
      }
      target.catches.splice(idx, 1);
      setSelectedNode(target);
      persist(true);
      toast('Removed catch clause');
    });
  });
  document.getElementById('btnAddCatchClause')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const target = resolveEditTarget();
    if (!target) return;
    target.catches = Array.isArray(target.catches) ? target.catches : [];
    target.catches.push({ exceptionType: 'System.Exception', exceptionVariable: 'exception', children: [] });
    setSelectedNode(target);
    persist(true);
    toast('Catch clause added');
  });
}

    function assistLiveStripHtml(node) {
      if (!node) return '';
      try {
        const props = collectLiveAssistProposals({ selectedOnly: true }).filter((p) => p.activityId === node.id);
        if (!props.length) return '';
        return '<div class="assist-live" id="assistLiveStrip">' +
          '<div class="al-title"><span>Assist live · ' + props.length + ' proposal(s)</span>' +
          '<button type="button" class="al-apply" id="btnAssistLiveOpen">Open Assist</button></div>' +
          props.slice(0, 4).map((p) =>
            '<div class="al-item">' +
              '<div><div class="al-label">' + escapeHtml(p.label) + '</div>' +
              '<div class="al-detail">' + escapeHtml(p.detail) + '</div></div>' +
              (p.actionable
                ? '<button type="button" class="al-apply" data-al-apply="' + escapeAttr(p.id) + '">Apply</button>'
                : '<span></span>') +
            '</div>'
          ).join('') +
          (props.length > 4 ? '<div class="al-detail" style="margin-top:6px">+' + (props.length - 4) + ' more in Assist ✦ → Live</div>' : '') +
          '</div>';
      } catch (_) {
        return '';
      }
    }

    function wireAssistLiveStrip(node) {
      document.getElementById('btnAssistLiveOpen')?.addEventListener('click', () => openAssistHelp('live'));
      const proposals = collectLiveAssistProposals({ selectedOnly: true });
      els.props.querySelectorAll('[data-al-apply]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.getAttribute('data-al-apply');
          const p = proposals.find((x) => x.id === id);
          if (!p || !applyLiveProposal(p)) { toast('Could not apply proposal'); return; }
          setSelectedNode(node);
          persist(true);
          toast('Applied: ' + p.label);
        });
      });
    }

    function renderAssistLivePanel() {
      const list = els.assistLiveList;
      if (!list) return;
      const scopeSelected = state.assistLiveScope !== 'all';
      const kinds = state.assistLiveKinds || { vb: true, required: true, selector: true };
      let proposals = collectLiveAssistProposals({ selectedOnly: scopeSelected && !!state.selectedId });
      if (scopeSelected && !state.selectedId) {
        proposals = collectLiveAssistProposals({ selectedOnly: false }).slice(0, 12);
      }
      proposals = proposals.filter((p) => kinds[p.kind] !== false);
      if (els.assistLiveCount) els.assistLiveCount.textContent = String(proposals.length);
      document.querySelectorAll('[data-al-scope]').forEach((btn) => {
        btn.classList.toggle('on', btn.getAttribute('data-al-scope') === (scopeSelected ? 'selected' : 'all'));
      });
      document.querySelectorAll('[data-al-kind]').forEach((btn) => {
        const k = btn.getAttribute('data-al-kind');
        btn.classList.toggle('on', !!kinds[k]);
      });
      if (!proposals.length) {
        list.innerHTML = '<div class="empty">No proposals for this filter.</div>';
        return;
      }
      const groups = { vb: [], required: [], selector: [] };
      for (const p of proposals) (groups[p.kind] || groups.vb).push(p);
      const labels = { vb: 'VB', required: 'Required', selector: 'Selector' };
      let html = '';
      for (const key of ['vb', 'required', 'selector']) {
        if (!groups[key].length) continue;
        html += '<div class="assist-group-label">' + labels[key] + ' · ' + groups[key].length + '</div>';
        html += groups[key].map((p) =>
          '<div class="assist-proposal">' +
            '<div class="ap-title">' + escapeHtml(p.label) + '</div>' +
            (p.actionable
              ? '<button type="button" class="al-apply" data-al-panel-apply="' + escapeAttr(p.id) + '">Apply</button>'
              : '<span></span>') +
            '<div class="ap-meta">' + escapeHtml(p.detail) + '</div>' +
          '</div>'
        ).join('');
      }
      list.innerHTML = html;
      list.querySelectorAll('[data-al-panel-apply]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-al-panel-apply');
          const p = proposals.find((x) => x.id === id);
          if (!p || !applyLiveProposal(p)) { toast('Could not apply proposal'); return; }
          const hit = walkFind(state.workflow.activities, p.activityId);
          setSelectedNode(hit ? hit.node : null);
          persist(true);
          renderAssistLivePanel();
          toast('Applied: ' + p.label);
        });
      });
    }

    const SCAFFOLD_RULES = [
      { test: /\\b(log message|log\\b|write line)\\b/i, type: 'System.LogMessage', props: { level: 'Info', message: '"Hello from Assist scaffold"' } },
      { test: /\\b(message box|msgbox)\\b/i, type: 'System.MessageBox', props: { text: '"Hello"' } },
      { test: /\\b(assign|set variable)\\b/i, type: 'Programming.Assign', props: { to: 'result', value: '""' } },
      { test: /\\b(multiple assign)\\b/i, type: 'Programming.MultipleAssign', props: { assignments: 'a = 1\\nb = 2' } },
      { test: /\\b(if |condition|branch)\\b/i, type: 'ControlFlow.If', props: { condition: 'True' } },
      { test: /\\b(while|loop until)\\b/i, type: 'ControlFlow.While', props: { condition: 'True' } },
      { test: /\\b(for each row|foreach row)\\b/i, type: 'Data.ForEachRow', props: { dataTable: 'dt', row: 'row' } },
      { test: /\\b(for each|foreach)\\b/i, type: 'ControlFlow.ForEach', props: { values: 'items', item: 'item' } },
      { test: /\\b(try catch|try\\/catch)\\b/i, type: 'ControlFlow.TryCatch' },
      { test: /\\b(delay|wait seconds|sleep)\\b/i, type: 'System.Delay', props: { duration: '00:00:02' } },
      { test: /\\b(use browser|open browser|navigate)\\b/i, type: 'UI.UseApplicationBrowser', props: { mode: 'Browser', urlOrPath: 'https://example.com', browserType: 'Chrome' } },
      { test: /\\b(open application|use application)\\b/i, type: 'UI.UseApplicationBrowser', props: { mode: 'Application', urlOrPath: 'notepad.exe' } },
      { test: /\\b(click)\\b/i, type: 'UI.Click', props: { selector: '' } },
      { test: /\\b(type into|type text|enter text)\\b/i, type: 'UI.TypeInto', props: { selector: '', text: '""' } },
      { test: /\\b(get text)\\b/i, type: 'UI.GetText', props: { selector: '', result: 'textValue' } },
      { test: /\\b(element exists|check element)\\b/i, type: 'UI.ElementExists', props: { selector: '', result: 'exists' } },
      { test: /\\b(http|rest|api request|webhook)\\b/i, type: 'Messaging.HttpRequest', props: { method: 'GET', url: '"https://api.example.com"', result: 'httpResult' } },
      { test: /\\b(send email|email)\\b/i, type: 'Messaging.SendEmail', props: { to: 'user@example.com', subject: '"Hello"', body: '"Body"' } },
      { test: /\\b(read csv)\\b/i, type: 'Data.ReadCsv', props: { filePath: 'Data/input.csv', dataTable: 'dt' } },
      { test: /\\b(write csv)\\b/i, type: 'Data.WriteCsv', props: { filePath: 'Data/output.csv', dataTable: 'dt' } },
      { test: /\\b(build data table|new data table)\\b/i, type: 'Data.BuildDataTable', props: { dataTable: 'dt' } },
      { test: /\\b(excel|workbook)\\b/i, type: 'Excel.ExcelApplicationScope', props: { workbookPath: 'Data/Workbook.xlsx' } },
      { test: /\\b(get queue|queue item|transaction item)\\b/i, type: 'Orchestrator.GetTransactionItem', props: { queueName: 'MainQueue', result: 'TransactionItem' } },
      { test: /\\b(get asset)\\b/i, type: 'Orchestrator.GetAsset', props: { assetName: 'ConfigAsset', result: 'assetValue' } },
      { test: /\\b(invoke workflow|call workflow)\\b/i, type: 'REFramework.InvokeWorkflow', props: { workflowPath: 'Framework/Process.lcs.json' } },
      { test: /\\b(comment|note)\\b/i, type: 'System.Comment', props: { text: 'Assist scaffold note' } }
    ];

    function scaffoldFromDescription(description) {
      const text = String(description || '').trim();
      const chunks = text
        ? text.split(/\\n+|;|\\bthen\\b|\\band then\\b/i).map((s) => s.trim()).filter(Boolean)
        : ['log message hello'];
      const activities = [];
      const summaryLines = [];
      const unmatched = [];
      for (const chunk of chunks) {
        let matched = false;
        for (const rule of SCAFFOLD_RULES) {
          if (!rule.test.test(chunk)) continue;
          const node = createActivity(rule.type);
          if (!node) continue;
          Object.assign(node.properties, rule.props || {});
          if (node.type === 'System.LogMessage') {
            const q = chunk.match(/["“]([^"”]+)["”]/);
            if (q) node.properties.message = '"' + q[1].replace(/"/g, '""') + '"';
          }
          if (node.type === 'Messaging.HttpRequest') {
            const url = chunk.match(/https?:\\/\\/\\S+/i);
            if (url) node.properties.url = '"' + url[0] + '"';
          }
          if (node.type === 'UI.UseApplicationBrowser') {
            const url = chunk.match(/https?:\\/\\/\\S+/i);
            if (url) node.properties.urlOrPath = url[0];
          }
          activities.push(node);
          summaryLines.push(node.displayName + ' ← “' + chunk.slice(0, 60) + '”');
          matched = true;
          break;
        }
        if (!matched) unmatched.push(chunk);
      }
      if (!activities.length) {
        const fallback = createActivity('System.LogMessage');
        if (fallback) {
          fallback.properties.message = '"' + (text.slice(0, 80).replace(/"/g, '""') || 'Assist scaffold') + '"';
          activities.push(fallback);
          summaryLines.push('Fallback Log Message (no keyword match)');
        }
      }
      return { activities, summary: summaryLines, unmatched };
    }

    function renderAssistScaffoldPanel() {
      const list = els.assistScaffoldList;
      if (!list) return;
      const proposal = state.assistScaffoldProposal;
      const appendBtn = document.getElementById('assistScaffoldAppend');
      const replaceBtn = document.getElementById('assistScaffoldReplace');
      if (!proposal || !proposal.activities.length) {
        list.innerHTML = '<div class="empty">Press Propose to preview activities. Nothing is applied until Append or Replace.</div>';
        if (appendBtn) appendBtn.disabled = true;
        if (replaceBtn) replaceBtn.disabled = true;
        return;
      }
      if (appendBtn) appendBtn.disabled = false;
      if (replaceBtn) replaceBtn.disabled = false;
      list.innerHTML =
        '<div class="assist-proposal"><div class="ap-title">' + proposal.activities.length +
        ' activit' + (proposal.activities.length === 1 ? 'y' : 'ies') + '</div>' +
        proposal.summary.map((s) => '<div class="ap-meta">· ' + escapeHtml(s) + '</div>').join('') +
        (proposal.unmatched.length
          ? '<div class="ap-meta" style="margin-top:6px;color:#ef4444">Unmatched: ' +
            escapeHtml(proposal.unmatched.join('; ')) + '</div>'
          : '') +
        '</div>';
    }

    function proposeAssistScaffold() {
      const text = els.assistScaffoldInput?.value || '';
      state.assistScaffoldProposal = scaffoldFromDescription(text);
      renderAssistScaffoldPanel();
      toast('Proposed ' + state.assistScaffoldProposal.activities.length + ' activit' +
        (state.assistScaffoldProposal.activities.length === 1 ? 'y' : 'ies'));
    }

    function applyAssistScaffold(mode) {
      const proposal = state.assistScaffoldProposal;
      if (!proposal || !proposal.activities.length) { toast('Propose a scaffold first'); return; }
      const clones = proposal.activities.map((a) => JSON.parse(JSON.stringify(a)));
      for (const n of clones) n.id = newId();
      if (mode === 'replace') state.workflow.activities = clones;
      else state.workflow.activities = [...(state.workflow.activities || []), ...clones];
      setSelectedNode(clones[0] || null);
      state.assistScaffoldProposal = null;
      if (els.assistScaffoldInput) els.assistScaffoldInput.value = '';
      renderAssistScaffoldPanel();
      persist(true);
      toast((mode === 'replace' ? 'Replaced with ' : 'Appended ') + clones.length + ' scaffolded activit' +
        (clones.length === 1 ? 'y' : 'ies'));
      closeAssistHelp();
    }

    /** Render one minimap row for a node at a given nesting depth. */
    function mmRowHtml(n, depth) {
      const def = findDef(n.type);
      const color = n.color || def?.color || '#64748B';
      const sel = idsEqual(state.selectedId, n.id) ? ' selected' : '';
      const icoHtml = activityIconHtml(def || n.type, color).replace('act-icon', 'act-icon mm-ico');
      const name = n.displayName || n.type || 'Activity';
      const indent = Math.min(depth, 8) * 10;
      return '<button type="button" class="mm-row' + sel + '" data-mm-id="' + escapeAttr(n.id) +
        '" style="margin-left:' + indent + 'px;width:calc(100% - ' + indent + 'px)">' +
        '<span class="mm-accent" style="background:' + escapeAttr(color) + '"></span>' +
        icoHtml +
        '<span class="mm-label">' + escapeHtml(name) + '</span></button>';
    }
    /** Branch label chip (Then/Else/Try/Catch/Finally) shown above a nested group, mirroring the canvas. */
    function mmBranchLabelHtml(text, depth) {
      const indent = Math.min(depth, 8) * 10;
      return '<div class="mm-branch-label" style="margin-left:' + indent + 'px">' + escapeHtml(text) + '</div>';
    }
    /** Recursively render the real nested structure (Then/Else/Try/Catch/Finally) instead of a flat list. */
    function renderMinimapNodes(list, depth) {
      let html = '';
      for (const n of list || []) {
        html += mmRowHtml(n, depth);
        const def = findDef(n.type);
        const isTryCatch = n.type === 'ControlFlow.TryCatch';
        if (n.children && n.children.length) {
          html += mmBranchLabelHtml(isTryCatch ? 'Try' : (def?.hasElse ? 'Then' : 'Body'), depth + 1);
          html += renderMinimapNodes(n.children, depth + 1);
        }
        if (isTryCatch) {
          const catches = Array.isArray(n.catches) && n.catches.length
            ? n.catches
            : (n.elseChildren && n.elseChildren.length
              ? [{ exceptionType: n.properties?.exceptionType || 'System.Exception', children: n.elseChildren }]
              : []);
          for (const clause of catches) {
            if (clause?.children?.length) {
              html += mmBranchLabelHtml('Catch (' + (clause.exceptionType || 'System.Exception') + ')', depth + 1);
              html += renderMinimapNodes(clause.children, depth + 1);
            }
          }
          if (n.finallyChildren && n.finallyChildren.length) {
            html += mmBranchLabelHtml('Finally', depth + 1);
            html += renderMinimapNodes(n.finallyChildren, depth + 1);
          }
        } else if (n.elseChildren && n.elseChildren.length) {
          html += mmBranchLabelHtml('Else', depth + 1);
          html += renderMinimapNodes(n.elseChildren, depth + 1);
        }
      }
      return html;
    }
    function renderMinimap() {
      const stage = els.minimapStage;
      const countEl = els.minimapCount;
      if (!stage) return;
      applyMinimapCollapsed();
      const nodes = walkCollect(state.workflow.activities);
      if (countEl) countEl.textContent = String(nodes.length);
      if (!nodes.length) {
        stage.innerHTML = '<div class="minimap-empty">No activities yet</div>';
        return;
      }
      if (isFlow()) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodes) {
          const x = n.x || 0, y = n.y || 0;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + 160); maxY = Math.max(maxY, y + 70);
        }
        const pad = 12;
        const spanX = Math.max(180, maxX - minX + pad * 2);
        const spanY = Math.max(100, maxY - minY + pad * 2);
        const scale = Math.min(1, 220 / spanX, 120 / spanY);
        const w = Math.round(spanX * scale);
        const h = Math.round(spanY * scale);
        stage.innerHTML = '<div class="minimap-flow" style="width:' + w + 'px;height:' + h + 'px">' +
          nodes.map((n) => {
            const def = findDef(n.type);
            const color = n.color || def?.color || '#64748B';
            const left = Math.round(((n.x || 0) - minX + pad) * scale);
            const top = Math.round(((n.y || 0) - minY + pad) * scale);
            const sel = idsEqual(state.selectedId, n.id) ? ' selected' : '';
            const label = String(n.displayName || n.type || '').slice(0, 10);
            return '<button type="button" class="mm-node' + sel + '" data-mm-id="' + escapeAttr(n.id) +
              '" title="' + escapeAttr(n.displayName || n.type) + '" style="left:' + left + 'px;top:' + top +
              'px;background:' + escapeAttr(color) + '">' + escapeHtml(label) + '</button>';
          }).join('') + '</div>';
      } else {
        stage.innerHTML = '<div class="minimap-seq">' +
          renderMinimapNodes(state.workflow.activities, 0) +
          '</div>';
      }
      stage.querySelectorAll('[data-mm-id]').forEach((btn) => {
        const id = btn.getAttribute('data-mm-id');
        const hit = id ? walkFind(state.workflow.activities, id) : null;
        const node = hit?.node;
        btn.addEventListener('click', () => {
          if (!id) return;
          selectActivity(id, { rerender: true, node });
          highlightSearchHit(id);
        });
        if (node) {
          btn.addEventListener('mouseenter', (e) => showTip(tipHtml(node), e.clientX, e.clientY));
          btn.addEventListener('mousemove', (e) => showTip(tipHtml(node), e.clientX, e.clientY));
          btn.addEventListener('mouseleave', hideTip);
        }
      });
    }

    function persistPropEdit(target) {
      vscode.postMessage({ type: 'edit', workflow: state.workflow });
      const id = target && target.id;
      document.querySelectorAll('.card[data-id], .flow-node[data-id]').forEach((el) => {
        if (!idsEqual(el.getAttribute('data-id'), id)) return;
        const sum = el.querySelector('.card-summary');
        if (sum) sum.textContent = summary(target);
        const title = el.querySelector('.card-title');
        if (title && target.displayName) title.textContent = target.displayName;
      });
      renderBreadcrumbs();
      renderMinimap();
    }

    /** Coerce SW ExpressionText / PascalCase onto catalog keys before paint + edit. */
    function normalizeNodePropsForEdit(node) {
      node.properties = node.properties || {};
      for (const [k, v] of Object.entries(node.properties)) {
        const coerced = coercePaintValue(v);
        if (coerced !== v) node.properties[k] = coerced;
      }
      const pascalHints = {
        Message: 'message', Text: 'message', Level: 'level',
        Condition: 'condition', To: 'to', Value: 'value',
        Selector: 'selector', Duration: 'durationMs', Url: 'url', URL: 'url',
        Columns: 'columns', ColumnNames: 'columns', Result: 'result',
        DataTable: node.type === 'Data.BuildDataTable' ? 'result' : 'dataTable',
        ArrayRow: 'arrayRow', FilePath: 'filePath', WorkflowPath: 'workflowPath',
        WorkflowFileName: 'workflowPath', WorkbookPath: 'workbookPath',
        SheetName: 'sheetName', QueueName: 'queueName', AssetName: 'assetName',
        ItemInformation: 'itemInformation', TimeoutMS: 'timeoutMs'
      };
      for (const [from, to] of Object.entries(pascalHints)) {
        const fromVal = coercePaintValue(node.properties[from]);
        const toVal = node.properties[to];
        const toEmpty = toVal === undefined || toVal === null || String(toVal).trim() === '';
        if (toEmpty && fromVal != null && String(fromVal).trim() !== '' && typeof fromVal !== 'object') {
          node.properties[to] = fromVal;
        }
        if (node.properties[to] !== undefined && from !== to) delete node.properties[from];
      }
    }

    function renderProps() {
      try {
        syncSuggestionVariables();
      } catch (_) {}
      ensureActivityIds(state.workflow.activities);
      const node = resolveEditTarget();
      els.btnDelete.disabled = !node;
      if (!node) {
        els.props.innerHTML = '<div class="empty">Select a step to edit properties. In Flowchart mode, drag the blue port to connect nodes.</div>';
        renderBreadcrumbs();
        return;
      }
      ensurePropsPanelVisible();
      // Do NOT force-expand sections here — that broke expand/collapse. selectActivity opens them once.
      setSelectedNode(node);
      normalizeNodePropsForEdit(node);
      const def = findDef(node.type);
      const currentColor = node.color || def?.color || '#64748B';
      const presets = ['#3B82F6','#8B5CF6','#F59E0B','#10B981','#EF4444','#64748B'];

      let general = fieldHtml('Display Name', '<input id="prop_displayName" value="' + escapeAttr(node.displayName || '') + '" />');
      general += fieldHtml('Type', '<input value="' + escapeAttr(node.type || '') + '" disabled />');
      if (!def) {
        general += '<div class="empty" style="margin:0 0 8px">Unknown / imported type — properties below are editable raw fields. Replace with a catalog activity when possible.</div>';
      }
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
      const catalogPropNames = new Set((def?.properties || []).map((p) => p.name));
      let pendingRepairs = [];
      try { pendingRepairs = vbRepairsForActivity(node); } catch (_) { pendingRepairs = []; }
      if (pendingRepairs.length) {
        state.collapsedPropSections.activity = false;
        activity += '<div class="vb-repair-banner">' +
          pendingRepairs.length + ' UiPath VB expression repair(s) available' +
          '<div style="margin-top:4px;font-weight:500;opacity:.9">' +
          escapeHtml(pendingRepairs.map((r) => r.label + ': ' + (r.labels[0] || 'fix')).join(' · ')) +
          '</div>' +
          '<button type="button" class="vb-apply-all" id="btnVbApplyAll">Apply all repairs</button>' +
          '</div>';
      }
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
        if (node.type === 'REFramework.InvokeWorkflow' && p.name === 'argumentMappings') {
          activity += fieldHtml(label, invokeMapEditorHtml(node), p.required);
          continue;
        }
        activity += fieldHtml(label, renderPropInput(p, val, node), p.required);
        const isExprProp = p.type === 'expression' || p.type === 'multiline' || p.name === 'condition' || p.name === 'expression' || p.name === 'assignments' || p.name === 'argumentMappings';
        if (isExprProp && p.name !== 'selector') {
          try { activity += vbRepairHintHtml(p.name, val); } catch (_) {}
        }
        if (p.name === 'selector') {
          try { activity += selectorBuilderHtml(p.name, val); } catch (_) {}
          selectorProps.push(p.name);
        }
        if (node.type === 'REFramework.InvokeWorkflow' && p.name === 'workflowPath') {
          activity += '<div class="field"><button class="btn primary" id="btnOpenWorkflow" type="button">Open Workflow in New Tab</button></div>';
        }
      }
      // Show leftover / Imported.* keys so open-from-Studio-Web workflows are editable
      const extraKeys = Object.keys(node.properties || {}).filter((k) => !catalogPropNames.has(k));
      for (const key of extraKeys) {
        const val = node.properties[key];
        const strVal = val === undefined || val === null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
        const expressionish = /^(condition|message|value|text|expression|url|jsonString|json|arrayRow|subject|body|assignments|argumentMappings|Text|Message|Value|Condition)$/i.test(key)
          || (typeof val === 'string' && (val.includes('(') || /toUpperCase|toLowerCase|===|&&|\|\|/.test(val)));
        const synthetic = {
          name: key,
          label: key,
          type: typeof val === 'boolean' ? 'boolean' : (expressionish || strVal.length > 80 ? (expressionish ? 'expression' : 'multiline') : 'string')
        };
        activity += fieldHtml(key, renderPropInput(synthetic, typeof val === 'object' && val !== null ? strVal : (val ?? ''), node));
        if (expressionish && key.toLowerCase() !== 'selector') {
          try { activity += vbRepairHintHtml(key, typeof val === 'string' ? val : strVal); } catch (_) {}
        }
        if (key === 'selector') {
          try { activity += selectorBuilderHtml(key, val ?? ''); } catch (_) {}
          selectorProps.push(key);
        }
      }
      if (!activity) activity = '<div class="empty">No activity-specific properties.</div>';

      let flow = '';
      if (isFlow()) {
        flow += fieldHtml('Position', '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><input value="x=' + Math.round(node.x || 0) + '" disabled /><input value="y=' + Math.round(node.y || 0) + '" disabled /></div>');
        flow += '<div class="field"><button class="btn" id="btnSetStart" type="button">Use as flowchart start</button></div>';
      }

      let catchesSection = '';
if (node.type === 'ControlFlow.TryCatch') {
  const clauses = Array.isArray(node.catches) && node.catches.length
    ? node.catches
    : [{ exceptionType: node.properties?.exceptionType || 'System.Exception', exceptionVariable: 'exception' }];
  catchesSection += '<div class="invoke-map" id="catchesEditor">';
  catchesSection += '<div class="invoke-map-toolbar"><button type="button" class="btn" id="btnAddCatchClause">+ Add Catch</button></div>';
  clauses.forEach((clause, ci) => {
    catchesSection +=
      '<div class="invoke-map-row" data-catch-row="' + ci + '" style="grid-template-columns:1fr 1fr 28px;">' +
        '<input data-catch-type="' + ci + '" value="' + escapeAttr(clause.exceptionType || 'System.Exception') + '" placeholder="System.Exception" list="dl_exception_types" />' +
        '<input data-catch-var="' + ci + '" value="' + escapeAttr(clause.exceptionVariable || 'exception') + '" placeholder="exception" />' +
        '<button type="button" class="icon-btn" data-catch-remove="' + ci + '" title="Remove clause">✕</button>' +
      '</div>';
  });
  catchesSection +=
    '<datalist id="dl_exception_types">' +
    ['System.Exception', 'System.ArgumentException', 'System.ArgumentNullException', 'System.InvalidOperationException',
     'System.NullReferenceException', 'System.NotSupportedException', 'System.FormatException', 'System.TimeoutException',
     'System.IO.IOException', 'System.IO.FileNotFoundException', 'System.Net.Http.HttpRequestException',
     'UiPath.Core.BusinessRuleException'
    ].map(t => '<option value="' + escapeAttr(t) + '"></option>').join('') +
    '</datalist>';
  catchesSection += '</div>';
}

      let studioWeb = '';
      let assistStrip = '';
      try { studioWeb = studioWebChecklistHtml(node, def); } catch (_) { studioWeb = ''; }
      try { assistStrip = assistLiveStripHtml(node); } catch (_) { assistStrip = ''; }

      let html = assistStrip;
      html += propSection('general', 'General', general);
      html += propSection('activity', 'Activity', activity);
      if (catchesSection) html += propSection('catches', 'Catch Clauses', catchesSection);
      html += propSection('studioWeb', 'Required for Studio Web', studioWeb);
      if (flow) html += propSection('flow', 'Flowchart', flow);
      // Paint HTML first so fields exist even if wiring helpers throw (SW reopen)
      els.props.innerHTML = html;
      try { wireAssistLiveStrip(node); } catch (_) {}
      try {
        if (node.type === 'REFramework.InvokeWorkflow') wireInvokeMapEditor(node);
      } catch (_) {}
      try {
        if (node.type === 'ControlFlow.TryCatch') wireCatchesEditor(node);
      } catch (_) {}

      els.props.querySelectorAll('.prop-section-head').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const sectionEl = btn.parentElement;
          const section = sectionEl?.getAttribute('data-section');
          if (!section) return;
          const next = !state.collapsedPropSections[section];
          state.collapsedPropSections[section] = next;
          // Toggle in place — full re-render wiped inputs and re-forced open sections
          sectionEl.classList.toggle('collapsed', next);
          const chev = btn.querySelector('.chev');
          if (chev) chev.textContent = next ? '▸' : '▾';
        });
      });

      // Color / VB / selector extras — prop field edits use delegated listeners (wirePropsDelegation)
      document.getElementById('btnResetColor')?.addEventListener('click', () => {
        const target = resolveEditTarget();
        if (!target) return;
        delete target.color;
        setSelectedNode(target);
        persistPropEdit(target);
        renderProps();
      });
      els.props.querySelectorAll('[data-color]').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = btn.getAttribute('data-color');
          if (!value || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return;
          const target = resolveEditTarget();
          if (!target) return;
          target.color = value;
          setSelectedNode(target);
          persistPropEdit(target);
          const hex = document.getElementById('prop_color_hex');
          const picker = document.getElementById('prop_color');
          if (hex) hex.value = value;
          if (picker) picker.value = value;
        });
      });
      document.getElementById('prop_color')?.addEventListener('input', (e) => {
        const value = e.target.value;
        if (!value || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return;
        const target = resolveEditTarget();
        if (!target) return;
        target.color = value;
        setSelectedNode(target);
        persistPropEdit(target);
      });
      document.getElementById('prop_color_hex')?.addEventListener('change', (e) => {
        const value = String(e.target.value || '').trim();
        if (!value || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return;
        const target = resolveEditTarget();
        if (!target) return;
        target.color = value;
        setSelectedNode(target);
        persistPropEdit(target);
      });
      document.getElementById('btnSetStart')?.addEventListener('click', () => {
        const target = resolveEditTarget();
        if (!target) return;
        state.workflow.startActivityId = target.id;
        toast('Start node set');
        persist(false);
      });
      document.getElementById('btnOpenWorkflow')?.addEventListener('click', () => {
        const target = resolveEditTarget();
        vscode.postMessage({
          type: 'openWorkflow',
          workflowPath: String(target?.properties?.workflowPath || '')
        });
      });
      document.getElementById('btnVbApplyAll')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = resolveEditTarget();
        if (!target) return;
        const n = applyVbRepairsToActivity(target);
        if (!n) { toast('No VB repairs for this activity'); return; }
        persist(true);
        toast('Applied ' + n + ' VB expression repair(s)');
      });
      els.props.querySelectorAll('[data-vb-apply]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const key = btn.getAttribute('data-vb-apply');
          const value = btn.getAttribute('data-vb-value');
          if (!key || value == null) return;
          const target = resolveEditTarget();
          if (!target) return;
          target.properties = target.properties || {};
          target.properties[key] = value;
          const input = els.props.querySelector('[data-prop="' + key + '"]');
          if (input) input.value = value;
          setSelectedNode(target);
          persist(true);
          toast('Applied VB repair → ' + key);
        });
      });
      try {
        selectorProps.forEach(propName => wireSelectorBuilder(els.props, node, propName));
      } catch (_) {}
      els.props.querySelectorAll('[data-suggest-value]').forEach(btn => {
        btn.addEventListener('click', () => {
          const prop = btn.closest('[data-suggest-for]')?.getAttribute('data-suggest-for');
          const value = btn.getAttribute('data-suggest-value') || '';
          if (!prop) return;
          const input = els.props.querySelector('[data-prop="' + prop + '"]');
          if (input) {
            input.value = value;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const target = resolveEditTarget();
          if (target) {
            target.properties = target.properties || {};
            target.properties[prop] = value;
            persistPropEdit(target);
          }
          toast('Applied ' + value);
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

    /**
     * Delegated Properties editors — survive renderProps wiring failures (SW reopen).
     * Per-input listeners used to attach AFTER Assist/VB helpers; a throw left fields dead
     * while Delete (wired at startup) still worked.
     */
    function wirePropsDelegation() {
      if (state._propsDelegated) return;
      state._propsDelegated = true;
      const readPropValue = (input, key, target) => {
        let value = input.value;
        const def = findDef(target.type);
        const pdef = def?.properties?.find((p) => p.name === key);
        if (pdef?.type === 'number' || input.getAttribute('type') === 'number') value = Number(value);
        if (pdef?.type === 'boolean' || (input.tagName === 'SELECT' && (value === 'true' || value === 'false') && typeof (target.properties?.[key]) === 'boolean')) {
          value = value === 'true';
        }
        return value;
      };
      const applyPropInput = (input, persist) => {
        if (!input || input.disabled) return;
        const target = resolveEditTarget();
        if (!target) return;
        if (input.id === 'prop_displayName') {
          target.displayName = input.value || target.displayName;
          setSelectedNode(target);
          if (persist) persistPropEdit(target);
          return;
        }
        const key = input.getAttribute('data-prop');
        if (!key) return;
        target.properties = target.properties || {};
        target.properties[key] = readPropValue(input, key, target);
        setSelectedNode(target);
        if (target.type === 'REFramework.InvokeWorkflow' && key === 'workflowPath') {
          const path = String(target.properties[key] || '').trim();
          delete state.targetArgsByPath[path];
          delete state.targetArgsStatus[path];
          if (path) requestTargetArguments(path);
        }
        if (persist) persistPropEdit(target);
      };
      els.props.addEventListener('change', (e) => {
        const input = e.target && e.target.closest ? e.target.closest('#prop_displayName, [data-prop]') : null;
        if (!input || !els.props.contains(input)) return;
        applyPropInput(input, true);
      });
      els.props.addEventListener('input', (e) => {
        const input = e.target && e.target.closest ? e.target.closest('#prop_displayName, [data-prop]') : null;
        if (!input || !els.props.contains(input)) return;
        applyPropInput(input, false);
      });
      els.props.addEventListener('blur', (e) => {
        const input = e.target && e.target.closest ? e.target.closest('[data-prop]') : null;
        if (!input || !els.props.contains(input)) return;
        applyPropInput(input, true);
      }, true);
    }

    function refreshExprVbAssist() {
      const box = els.exprVbAssist;
      const proposed = els.exprVbProposed;
      if (!box || !proposed || !els.exprDialogValue) return;
      const r = rewriteVbExpression(els.exprDialogValue.value || '');
      if (!r.changed) {
        box.classList.remove('show');
        proposed.textContent = '';
        return;
      }
      proposed.textContent = (r.labels.join('; ') || 'expression fix') + ' → ' + r.next;
      box.dataset.vbNext = r.next;
      box.classList.add('show');
    }
    function openExprEditor(node, propName, def) {
      const pdef = (def?.properties || []).find(p => p.name === propName);
      const label = pdef?.label || propName;
      state.exprEdit = { nodeId: node.id, prop: propName };
      if (els.exprDialogTitle) els.exprDialogTitle.textContent = label + ' — ' + (node.displayName || node.type);
      if (els.exprDialogValue) els.exprDialogValue.value = String(node.properties?.[propName] ?? '');
      refreshExprVbAssist();
      els.exprOverlay?.classList.add('show');
      els.exprDialogValue?.focus();
    }
    function closeExprEditor() {
      state.exprEdit = null;
      els.exprOverlay?.classList.remove('show');
      els.exprVbAssist?.classList.remove('show');
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
          if (!id) {
            setSelectedNode(null);
          } else {
            const hit = walkFind(state.workflow.activities, id);
            setSelectedNode(hit ? hit.node : null);
          }
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

    function findAllInWorkflow(query) {
      const q = String(query || '').trim().toLowerCase();
      if (!q) return [];
      return walkCollect(state.workflow.activities).filter((n) =>
        String(n.displayName || '').toLowerCase().includes(q) ||
        String(n.type || '').toLowerCase().includes(q) ||
        String(summary(n) || '').toLowerCase().includes(q)
      );
    }
    function findInWorkflow(query) {
      return findAllInWorkflow(query)[0] || null;
    }
    function updateSearchHitCount() {
      if (!els.searchHitCount) return;
      const total = state.searchHits.length;
      if (!total) { els.searchHitCount.textContent = ''; return; }
      els.searchHitCount.textContent = (state.searchHitIndex + 1) + '/' + total;
    }
    function goToSearchHit(delta) {
      const q = els.workflowSearch?.value || '';
      state.searchHits = findAllInWorkflow(q);
      if (!state.searchHits.length) {
        updateSearchHitCount();
        toast('No match');
        return;
      }
      state.searchHitIndex = ((state.searchHitIndex + delta) % state.searchHits.length + state.searchHits.length) % state.searchHits.length;
      const hit = state.searchHits[state.searchHitIndex];
      setSelectedNode(hit);
      persist(true);
      zoomToActivity(hit.id);
      updateSearchHitCount();
    }
    function runWorkflowSearch(advance) {
      const q = els.workflowSearch?.value || '';
      state.searchHits = findAllInWorkflow(q);
      if (!state.searchHits.length) {
        state.searchHitIndex = 0;
        updateSearchHitCount();
        if (String(q || '').trim()) toast('No match for “' + q + '”');
        return;
      }
      if (advance) state.searchHitIndex = (state.searchHitIndex + 1) % state.searchHits.length;
      else state.searchHitIndex = Math.min(state.searchHitIndex, state.searchHits.length - 1);
      const hit = state.searchHits[state.searchHitIndex];
      setSelectedNode(hit);
      persist(true);
      zoomToActivity(hit.id);
      updateSearchHitCount();
    }

    function renderVariables() {
      if (!els.variablesView) return;
      state.workflow.variables = Array.isArray(state.workflow.variables) ? state.workflow.variables : [];
      const vars = state.workflow.variables;
      if (els.variablesCount) els.variablesCount.textContent = String(vars.length);
      if (!vars.length) {
        els.variablesView.innerHTML = '<div class="empty">No variables yet. Use Add Variable below.</div>';
        return;
      }
      // Compact name + type row; default value collapsed under each item
      els.variablesView.innerHTML = vars.map((v, i) => {
        const defVal = v.defaultValue === undefined || v.defaultValue === null ? '' : String(v.defaultValue);
        return '<div class="var-block">' +
          '<div class="var-row">' +
            '<input data-var="' + i + '" data-field="name" value="' + escapeAttr(v.name) + '" placeholder="Name" />' +
            '<select data-var="' + i + '" data-field="type" title="Type">' +
              ['String','Int32','Boolean','Double','Object','DataTable','Array'].map(t => '<option' + (v.type===t?' selected':'') + '>' + t + '</option>').join('') +
            '</select>' +
            '<button class="icon-btn" data-del-var="' + i + '" title="Remove">✕</button>' +
          '</div>' +
          '<details class="var-default">' +
            '<summary>Default value' + (defVal ? ' · set' : '') + '</summary>' +
            '<input data-var="' + i + '" data-field="defaultValue" value="' + escapeAttr(defVal) + '" placeholder="Default (optional)" />' +
          '</details>' +
        '</div>';
      }).join('');
      els.variablesView.querySelectorAll('[data-var]').forEach(input => {
        input.addEventListener('change', () => {
          const i = Number(input.getAttribute('data-var'));
          const field = input.getAttribute('data-field');
          state.workflow.variables[i][field] = input.value;
          persist(false);
          vscode.postMessage({ type: 'variablesChanged', variables: state.workflow.variables, workflow: state.workflow });
        });
      });
      els.variablesView.querySelectorAll('[data-del-var]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.workflow.variables.splice(Number(btn.getAttribute('data-del-var')), 1);
          persist(true);
          vscode.postMessage({ type: 'variablesChanged', variables: state.workflow.variables, workflow: state.workflow });
        });
      });
    }

    function renderArguments() {
      if (!els.argumentsView) return;
      state.workflow.arguments = Array.isArray(state.workflow.arguments) ? state.workflow.arguments : [];
      const args = state.workflow.arguments;
      if (els.argumentsCount) els.argumentsCount.textContent = String(args.length);
      if (!args.length) {
        els.argumentsView.innerHTML = '<div class="empty">No arguments yet. Use Add Argument below for In / Out / InOut.</div>';
        return;
      }
      const types = ['String','Int32','Boolean','Double','Object','DataTable','Array'];
      const dirs = ['In','Out','InOut'];
      // Compact name + direction + type; default value collapsed under each item
      els.argumentsView.innerHTML = args.map((a, i) => {
        const defVal = a.defaultValue === undefined || a.defaultValue === null ? '' : String(a.defaultValue);
        return '<div class="arg-block" data-arg-card="' + i + '">' +
          '<div class="arg-row">' +
            '<input data-arg="' + i + '" data-field="name" value="' + escapeAttr(a.name || '') + '" placeholder="Name" />' +
            '<select data-arg="' + i + '" data-field="direction" title="Direction">' +
              dirs.map(d => '<option' + ((a.direction || 'In') === d ? ' selected' : '') + '>' + d + '</option>').join('') +
            '</select>' +
            '<select data-arg="' + i + '" data-field="type" title="Type">' +
              types.map(t => '<option' + (a.type === t ? ' selected' : '') + '>' + t + '</option>').join('') +
            '</select>' +
            '<button class="icon-btn" data-del-arg="' + i + '" title="Remove">✕</button>' +
          '</div>' +
          '<details class="arg-default">' +
            '<summary>Default value' + (defVal ? ' · set' : '') + '</summary>' +
            '<input data-arg="' + i + '" data-field="defaultValue" value="' + escapeAttr(defVal) + '" placeholder="Default (optional)" />' +
          '</details>' +
        '</div>';
      }).join('');
      const applyArgField = (input) => {
        const i = Number(input.getAttribute('data-arg'));
        const field = input.getAttribute('data-field');
        if (!state.workflow.arguments || !state.workflow.arguments[i] || !field) return;
        let value = input.value;
        if (field === 'name') {
          value = String(value || '').trim().replace(/\\s+/g, '_');
          const dup = state.workflow.arguments.some((a, idx) => idx !== i && a.name === value);
          if (dup) {
            toast('Duplicate argument name: ' + value);
          }
          input.value = value;
        }
        state.workflow.arguments[i][field] = value;
        vscode.postMessage({ type: 'edit', workflow: state.workflow });
        vscode.postMessage({
          type: 'argumentsChanged',
          workflowArguments: state.workflow.arguments,
          workflow: state.workflow
        });
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
          vscode.postMessage({
            type: 'argumentsChanged',
            workflowArguments: state.workflow.arguments,
            workflow: state.workflow
          });
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
      if (ensureActivityIds(state.workflow.activities)) {
        vscode.postMessage({ type: 'edit', workflow: state.workflow });
      }
      els.workflowName.value = state.workflow.name || '';
      els.workflowType.textContent = state.workflow.type || 'Sequence';
      els.workflowType.classList.toggle('flow', isFlow());
      els.btnLink.style.display = isFlow() ? '' : 'none';
      els.btnAutoLayout.style.display = isFlow() ? '' : 'none';
      if (els.btnAlignSelection) els.btnAlignSelection.style.display = isFlow() ? '' : 'none';
      els.canvasHelp.textContent = isFlow()
        ? 'Flowchart · Fit / Align / Find in the bar · dock zoom & run'
        : 'Sequence · Fit / Find in the bar · dock zoom, insert & run';
      applyZoom();
      renderCatalog();
      renderProjectTree();
      if (isFlow()) renderFlowchart(); else renderSequence();
      renderProps();
      renderMinimap();
      renderVariables();
      renderArguments();
      renderBreadcrumbs();
      renderConnectionsPanel();
      syncDockActive();
      if (state.assistHelpOpen && state.assistTab === 'live') renderAssistLivePanel();
    }

    function persist(rerender) {
      try {
        if (!Array.isArray(state.workflow.variables)) state.workflow.variables = [];
        if (!Array.isArray(state.workflow.arguments)) state.workflow.arguments = [];
        vscode.postMessage({ type: 'edit', workflow: state.workflow });
        if (rerender) renderAll();
        else if (isFlow()) {
          renderMinimap();
          renderVariables();
          renderArguments();
          renderBreadcrumbs();
        } else {
          renderSequence();
          renderProps();
          renderMinimap();
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
      els.props.querySelectorAll('.prop-section').forEach((sec) => {
        sec.classList.remove('collapsed');
        const chev = sec.querySelector('.prop-section-head .chev');
        if (chev) chev.textContent = '▾';
      });
    });
    document.getElementById('btnCollapseProps')?.addEventListener('click', () => {
      state.collapsedPropSections = { general: true, activity: true, studioWeb: true, flow: true };
      els.props.querySelectorAll('.prop-section').forEach((sec) => {
        const id = sec.getAttribute('data-section');
        if (id) state.collapsedPropSections[id] = true;
        sec.classList.add('collapsed');
        const chev = sec.querySelector('.prop-section-head .chev');
        if (chev) chev.textContent = '▸';
      });
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
    document.getElementById('btnZoomFit')?.addEventListener('click', () => fitCanvasView());
    document.getElementById('btnFitCanvas')?.addEventListener('click', () => fitCanvasView());
    document.getElementById('btnZoomReset')?.addEventListener('click', () => setZoom(1));
    els.btnAlignSelection?.addEventListener('click', () => alignSelectedFlowNodes());
    document.getElementById('exprDialogAssist')?.addEventListener('click', () => {
      if (state.exprEdit?.nodeId) {
        const hit = walkFind(state.workflow.activities, state.exprEdit.nodeId);
        if (hit) setSelectedNode(hit.node);
        else state.selectedId = state.exprEdit.nodeId;
        state.assistLiveScope = 'selected';
      }
      openAssistHelp('live');
    });
    document.getElementById('exprVbApply')?.addEventListener('click', () => {
      const next = els.exprVbAssist?.dataset?.vbNext;
      if (!next || !els.exprDialogValue) return;
      els.exprDialogValue.value = next;
      refreshExprVbAssist();
      toast('VB repair applied in editor — press Apply to save');
    });
    els.exprDialogValue?.addEventListener('input', () => refreshExprVbAssist());
    document.querySelectorAll('[data-al-scope]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.assistLiveScope = btn.getAttribute('data-al-scope') === 'all' ? 'all' : 'selected';
        renderAssistLivePanel();
      });
    });
    document.querySelectorAll('[data-al-kind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-al-kind');
        if (!k) return;
        state.assistLiveKinds = state.assistLiveKinds || { vb: true, required: true, selector: true };
        state.assistLiveKinds[k] = !state.assistLiveKinds[k];
        renderAssistLivePanel();
      });
    });
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
    document.getElementById('btnReadyGate')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'readyForStudioWeb' });
    });
    document.getElementById('projectCtx')?.querySelectorAll('[data-proj-act]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const act = btn.getAttribute('data-proj-act');
        const ctx = state.projectCtx || {};
        hideProjectCtx();
        if (act === 'open' && ctx.path) {
          vscode.postMessage({ type: 'openProjectFile', path: ctx.path });
        } else if (act === 'duplicate' && ctx.path) {
          vscode.postMessage({ type: 'duplicateWorkflow', path: ctx.path });
        } else if (act === 'rename' && ctx.path) {
          vscode.postMessage({ type: 'renameWorkflow', path: ctx.path });
        } else if (act === 'reveal-sw') {
          vscode.postMessage({ type: 'revealStudioWebFolder', path: ctx.path || '' });
        } else if (act === 'reveal-os' && ctx.path) {
          vscode.postMessage({ type: 'revealInOs', path: ctx.path });
        }
      });
    });
    document.addEventListener('click', () => hideProjectCtx());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideProjectCtx();
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
      const stepHit = walkFind(state.workflow.activities, step.activityId);
      if (stepHit) setSelectedNode(stepHit.node);
      else state.selectedId = step.activityId;
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
    document.getElementById('btnAddVar')?.addEventListener('click', () => {
      try {
        state.workflow.variables = Array.isArray(state.workflow.variables) ? state.workflow.variables : [];
        const n = state.workflow.variables.length + 1;
        state.workflow.variables.push({ name: 'var' + n, type: 'String', defaultValue: '' });
        openLeftSectionExclusive('variables');
        renderVariables();
        vscode.postMessage({
          type: 'edit',
          workflow: state.workflow
        });
        vscode.postMessage({
          type: 'variablesChanged',
          variables: state.workflow.variables,
          workflow: state.workflow
        });
        toast('Variable added');
      } catch (err) {
        toast('Add variable failed: ' + (err && err.message ? err.message : String(err)));
      }
    });
    document.getElementById('btnAddArg')?.addEventListener('click', () => {
      try {
        state.workflow.arguments = Array.isArray(state.workflow.arguments) ? state.workflow.arguments : [];
        const n = state.workflow.arguments.length + 1;
        state.workflow.arguments.push({
          name: 'in_Arg' + n,
          type: 'String',
          direction: 'In',
          defaultValue: ''
        });
        openLeftSectionExclusive('arguments');
        renderArguments();
        vscode.postMessage({
          type: 'edit',
          workflow: state.workflow
        });
        vscode.postMessage({
          type: 'argumentsChanged',
          workflowArguments: state.workflow.arguments,
          workflow: state.workflow
        });
        toast('Argument added');
      } catch (err) {
        toast('Add argument failed: ' + (err && err.message ? err.message : String(err)));
      }
    });
    document.getElementById('exprDialogApply')?.addEventListener('click', () => applyExprEditor());
    document.getElementById('btnHome')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'openHome' });
    });
    els.btnThemeToggle?.addEventListener('click', () => toggleDesignerTheme());
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
    document.querySelectorAll('[data-assist-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setAssistTab(btn.getAttribute('data-assist-tab')));
    });
    document.getElementById('assistLiveRefresh')?.addEventListener('click', () => renderAssistLivePanel());
    document.getElementById('assistLiveApplyAll')?.addEventListener('click', () => {
      const scopeSelected = state.assistLiveScope !== 'all';
      const kinds = state.assistLiveKinds || { vb: true, required: true, selector: true };
      const proposals = collectLiveAssistProposals({ selectedOnly: scopeSelected && !!state.selectedId })
        .filter((p) => kinds[p.kind] !== false && p.actionable);
      let n = 0;
      for (const p of proposals) {
        if (applyLiveProposal(p)) n++;
      }
      if (!n) { toast('No actionable proposals'); return; }
      persist(true);
      renderAssistLivePanel();
      toast('Applied ' + n + ' Assist proposal(s)');
    });
    document.getElementById('assistScaffoldPropose')?.addEventListener('click', () => proposeAssistScaffold());
    document.getElementById('assistScaffoldAppend')?.addEventListener('click', () => applyAssistScaffold('append'));
    document.getElementById('assistScaffoldReplace')?.addEventListener('click', () => applyAssistScaffold('replace'));
    document.getElementById('btnToggleMinimap')?.addEventListener('click', () => {
      state.minimapCollapsed = !state.minimapCollapsed;
      applyMinimapCollapsed();
    });
    applyMinimapCollapsed();
    renderAssistScaffoldPanel();
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
    function setSearchOpen(open) {
      const wrap = document.getElementById('canvasSearchWrap');
      const btn = document.getElementById('btnToggleSearch');
      if (!wrap) return;
      wrap.classList.toggle('open', !!open);
      btn?.classList.toggle('active', !!open);
      if (open) {
        requestAnimationFrame(() => els.workflowSearch?.focus());
      } else if (els.workflowSearch) {
        els.workflowSearch.value = '';
        state.searchHits = [];
        state.searchHitIndex = 0;
        updateSearchHitCount();
      }
    }
    document.getElementById('btnToggleSearch')?.addEventListener('click', () => {
      const wrap = document.getElementById('canvasSearchWrap');
      setSearchOpen(!wrap?.classList.contains('open'));
    });
    // Collapsed by default — only ⌕ icon until user opens Find
    setSearchOpen(false);
    els.workflowSearch?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.searchHitIndex = 0;
        runWorkflowSearch(false);
      }, 220);
    });
    els.workflowSearch?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchOpen(false);
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      runWorkflowSearch(true);
    });
    document.getElementById('btnSearchNext')?.addEventListener('click', () => goToSearchHit(1));
    document.getElementById('btnSearchPrev')?.addEventListener('click', () => goToSearchHit(-1));
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
        const keepId = state.selectedId;
        const keepSnap = state.selectedNode
          ? {
              type: state.selectedNode.type,
              displayName: state.selectedNode.displayName,
              summary: summary(state.selectedNode)
            }
          : null;
        state.workflow = msg.workflow || {};
        state.workflow.variables ||= [];
        state.workflow.arguments ||= [];
        // Coerce / heal after Sync pull so SW activities are clickable immediately
        if (!Array.isArray(state.workflow.activities)) state.workflow.activities = [];
        ensureActivityIds(state.workflow.activities);
        // Unwrap lone root Sequence client-side (host migrate may still be racing)
        if (
          state.workflow.type !== 'Flowchart' &&
          state.workflow.activities.length === 1 &&
          state.workflow.activities[0]?.type === 'ControlFlow.Sequence' &&
          Array.isArray(state.workflow.activities[0].children) &&
          state.workflow.activities[0].children.length
        ) {
          state.workflow.activities = state.workflow.activities[0].children;
          ensureActivityIds(state.workflow.activities);
          vscode.postMessage({ type: 'edit', workflow: state.workflow });
        }
        let keepNode = keepId ? walkFind(state.workflow.activities, keepId)?.node : null;
        // Sync/import may rewrite ids — rematch soft → hard
        if (!keepNode && keepSnap) {
          keepNode = softRematchNode(keepSnap);
        }
        closeExprEditor();
        if (keepNode) {
          // Full select path paints Properties (setSelectedNode alone left empty panel after Save)
          selectActivity(keepNode.id, { rerender: true, node: keepNode });
        } else {
          setSelectedNode(null);
          renderAll();
        }
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
      if (msg.type === 'workflowArguments') {
        const path = String(msg.workflowPath || '').trim();
        if (path) {
          state.targetArgsByPath[path] = Array.isArray(msg.arguments) ? msg.arguments : [];
          state.targetArgsStatus[path] = msg.ok
            ? (msg.message || 'ok')
            : (msg.message || 'Failed to load arguments');
          const hit = state.selectedId ? walkFind(state.workflow.activities, state.selectedId) : null;
          if (hit?.node?.type === 'REFramework.InvokeWorkflow' &&
              String(hit.node.properties?.workflowPath || '').trim() === path) {
            renderProps();
          }
          if (msg.ok) toast('Loaded ' + (msg.arguments?.length || 0) + ' target argument(s)');
          else toast(msg.message || 'Could not load target arguments');
        }
      }
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
      if (msg.type === 'syncStatus') {
        applySyncStatus(msg);
      }
      if (msg.type === 'syncPullResult') {
        state.syncBusy = false;
        if (els.btnSync) els.btnSync.disabled = false;
        if (els.btnSyncNow) els.btnSyncNow.disabled = false;
        if (msg.ok) state.syncDismissedKey = '';
        const parts = [];
        if (Array.isArray(msg.updated) && msg.updated.length) {
          parts.push('updated: ' + msg.updated.slice(0, 3).join(', ') + (msg.updated.length > 3 ? '…' : ''));
        }
        if (Array.isArray(msg.conflicts) && msg.conflicts.length) {
          parts.push('conflicts: ' + msg.conflicts.slice(0, 3).join(', '));
        }
        if (parts.length) {
          toast((msg.message || 'Sync') + ' · ' + parts.join(' · '));
        }
      }
      if (msg.type === 'workflowPathResolved') {
        const wp = String(msg.workflowPath || '');
        state.invokePathExists = state.invokePathExists || {};
        state.invokePathPending = state.invokePathPending || {};
        if (wp) {
          state.invokePathExists[wp] = !!msg.exists;
          delete state.invokePathPending[wp];
          if (state.selectedId) {
            try { renderProps(); } catch (_) {}
          }
        }
      }
    });

    els.btnSync?.addEventListener('click', () => requestStudioWebPull({ wholeProject: true }));
    els.btnSyncNow?.addEventListener('click', () => requestStudioWebPull({ wholeProject: true }));
    els.btnSyncDismiss?.addEventListener('click', () => {
      state.syncDismissedKey = state.syncStatusKey || 'dismissed';
      els.syncAlert?.classList.remove('show');
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
          activityIconHtml(e.def) +
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
      setSelectedNode(node);
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
            const hit = walkFind(state.workflow.activities, id);
            if (hit) setSelectedNode(hit.node);
            else state.selectedId = id;
            postDryRun({ stepThrough: true, runToActivityId: id });
            return;
          }
          if (act === 'open') {
            const hit = walkFind(state.workflow.activities, id);
            const path = hit?.node?.properties?.workflowPath;
            if (path) vscode.postMessage({ type: 'openWorkflow', workflowPath: String(path) });
            return;
          }
          if (act === 'vb-repair') {
            const hit = walkFind(state.workflow.activities, id);
            if (!hit) return;
            const n = applyVbRepairsToActivity(hit.node);
            if (!n) { toast('No VB repairs for this activity'); return; }
            setSelectedNode(hit.node);
            persist(true);
            toast('Applied ' + n + ' VB expression repair(s)');
            return;
          }
          if (act === 'up' || act === 'down') {
            const hit = walkFind(state.workflow.activities, id);
            if (!hit) return;
            if (act === 'up' && hit.index > 0) {
              const [item] = hit.list.splice(hit.index, 1);
              hit.list.splice(hit.index - 1, 0, item);
              persist(true);
            } else if (act === 'down' && hit.index < hit.list.length - 1) {
              const [item] = hit.list.splice(hit.index, 1);
              hit.list.splice(hit.index + 1, 0, item);
              persist(true);
            }
            return;
          }
          if (act === 'dup') {
            const hit = walkFind(state.workflow.activities, id);
            if (!hit) return;
            const clone = JSON.parse(JSON.stringify(hit.node));
            const reid = (n) => { n.id = newId(); (n.children || []).forEach(reid); (n.elseChildren || []).forEach(reid); };
            reid(clone);
            hit.list.splice(hit.index + 1, 0, clone);
            setSelectedNode(clone);
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
                setSelectedNode(hit.node);
                state._insertBefore = act === 'insert-before';
              }
            }
            openPalette();
            toast('Pick an activity to insert');
          }
        });
      });
      document.addEventListener('click', (e) => {
        if (Date.now() < (state.ctxIgnoreClickUntil || 0)) return;
        if (e.target.closest('#ctxMenu') || e.target.closest('[data-card-menu]')) return;
        hideCtxMenu();
      });
      document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.card') && !e.target.closest('.flow-node') && !e.target.closest('#ctxMenu')) {
          hideCtxMenu();
        }
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
    wirePropsDelegation();
    syncSuggestionVariables();
    renderAll();
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
