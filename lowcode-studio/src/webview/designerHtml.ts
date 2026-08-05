import { ActivityDefinition } from '../models/activities';
import { WorkflowDocument } from '../models/workflow';
import { SELECTOR_TEMPLATES } from '../interop/selectorBuilder';
import { ActivityPaletteState } from '../interop/activityPalette';
import { PropertySuggestions } from '../interop/propertySuggestions';
import { DesignerProjectEntry } from '../interop/projectResolve';

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
  projects: DesignerProjectEntry[] = []
): string {
  const workflowJson = JSON.stringify(workflow).replace(/</g, '\\u003c');
  const catalogJson = JSON.stringify(catalog).replace(/</g, '\\u003c');
  const selectorTemplatesJson = JSON.stringify(SELECTOR_TEMPLATES).replace(/</g, '\\u003c');
  const suggestionsJson = JSON.stringify(suggestions).replace(/</g, '\\u003c');
  const paletteJson = JSON.stringify(palette).replace(/</g, '\\u003c');
  const projectsJson = JSON.stringify(projects).replace(/</g, '\\u003c');

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
      grid-template-columns: 280px 1fr var(--props-width, 300px);
      grid-template-rows: 52px 1fr;
      height: 100%;
      --props-width: 300px;
    }
    .app.props-floating { grid-template-columns: 280px 1fr; }
    .app.props-collapsed { grid-template-columns: 280px 1fr 40px; }
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
      position: relative;
      min-height: 0;
    }
    .panel.left-rail {
      display: flex; flex-direction: column; overflow: hidden;
    }
    .left-tabs {
      display: flex; gap: 2px; padding: 8px 8px 0; flex: 0 0 auto;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 90%, transparent);
    }
    .left-tab {
      flex: 1; border: none; background: transparent; color: var(--muted);
      font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .04em;
      text-transform: uppercase; padding: 8px 4px 10px; cursor: pointer;
      border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0;
    }
    .left-tab:hover { color: var(--text); background: var(--hover); }
    .left-tab.active {
      color: var(--text);
      border-bottom-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }
    .left-pane { display: none; flex: 1; min-height: 0; overflow: auto; flex-direction: column; }
    .left-pane.active { display: flex; }
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
      border-right: none; border-left: 1px solid var(--border);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .panel.right .panel-scroll { flex: 1; overflow: auto; min-height: 0; }
    .panel.right .panel-resize-x {
      position: absolute; left: 0; top: 0; bottom: 0; width: 5px; cursor: ew-resize;
      z-index: 6; background: transparent;
    }
    .panel.right .panel-resize-x:hover,
    .panel.right .panel-resize-x.dragging {
      background: color-mix(in srgb, var(--focus) 55%, transparent);
    }
    .panel.right .panel-resize-y {
      height: 6px; cursor: ns-resize; flex: 0 0 auto;
      background: transparent; border-top: 1px solid var(--border);
    }
    .panel.right .panel-resize-y:hover,
    .panel.right .panel-resize-y.dragging {
      background: color-mix(in srgb, var(--focus) 45%, transparent);
    }
    .panel-chrome {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px 4px; flex: 0 0 auto;
      cursor: default; user-select: none;
    }
    .panel.right.floating .panel-chrome { cursor: grab; }
    .panel.right.floating .panel-chrome:active { cursor: grabbing; }
    .panel-chrome h2 { padding: 0; margin: 0; flex: 1; }
    .panel-chrome-actions { display: flex; gap: 4px; }
    .panel.right.floating {
      position: fixed; z-index: 30;
      right: 18px; top: 64px;
      width: var(--props-width, 340px);
      height: var(--props-height, 70vh);
      max-height: calc(100vh - 80px);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow);
      background: color-mix(in srgb, var(--panel) 97%, transparent);
      backdrop-filter: blur(10px);
    }
    .panel.right.collapsed-strip {
      overflow: hidden; padding: 0;
      display: flex; flex-direction: column; align-items: center;
      justify-content: flex-start; gap: 8px; padding-top: 10px;
    }
    .panel.right.collapsed-strip > *:not(.collapsed-only) { display: none !important; }
    .collapsed-only { display: none; }
    .panel.right.collapsed-strip .collapsed-only { display: flex; flex-direction: column; gap: 6px; align-items: center; }
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
    .canvas-wrap { position: relative; overflow: auto; padding: 12px 16px 80px; }
    .canvas-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-bottom: 10px; position: sticky; top: 0; z-index: 3;
      padding: 6px 0; background: color-mix(in srgb, var(--bg) 88%, transparent);
      backdrop-filter: blur(6px);
    }
    .canvas-help { color: var(--muted); font-size: 12px; flex: 1; min-width: 180px; }
    .zoom-tools { display: flex; align-items: center; gap: 4px; }
    .zoom-label {
      min-width: 48px; text-align: center; font-size: 11px; font-family: var(--mono); color: var(--muted);
    }
    .canvas-zoom {
      transform-origin: 0 0;
      transition: transform .12s ease;
      width: max-content; min-width: 100%;
    }
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
      transition: border-color .15s ease, box-shadow .15s ease, transform .12s ease;
    }
    .card:hover {
      border-color: color-mix(in srgb, var(--focus) 55%, var(--border));
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus) 35%, transparent), var(--shadow);
      transform: translateY(-1px);
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
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 14px;
      background-color: color-mix(in srgb, var(--bg) 94%, transparent);
      background-image:
        radial-gradient(circle, color-mix(in srgb, var(--muted) 28%, transparent) 1px, transparent 1.5px),
        linear-gradient(color-mix(in srgb, var(--muted) 8%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--muted) 8%, transparent) 1px, transparent 1px);
      background-size: 20px 20px, 100px 100px, 100px 100px;
      background-position: 0 0, 0 0, 0 0;
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
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    .flow-node:hover {
      border-color: color-mix(in srgb, var(--focus) 55%, var(--border));
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus) 30%, transparent), var(--shadow);
      z-index: 2;
    }
    .flow-node.selected { border-color: var(--focus); box-shadow: 0 0 0 1px var(--focus), var(--shadow); z-index: 3; }
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
      <button class="btn" id="btnAutoLayout" style="display:none">Auto Layout</button>
      <button class="btn" id="btnPropsPanel" title="Show / focus properties panel" style="display:none">Properties</button>
      <button class="btn" id="btnInsert" title="Insert activity (⌘K / Ctrl+K)">Insert</button>
      <button class="btn" id="btnValidate">Validate</button>
      <button class="btn" id="btnDryRun" title="Run All dry-run">Dry Run</button>
      <button class="btn" id="btnStepThrough" title="Step through activities on the canvas">Step Through</button>
      <button class="btn primary" id="btnSave">Save</button>
    </div>

    <aside class="panel left-rail" id="toolbox">
      <div class="left-tabs" role="tablist" aria-label="Designer left panes">
        <button class="left-tab" type="button" data-left-tab="project" role="tab">Project</button>
        <button class="left-tab active" type="button" data-left-tab="activities" role="tab">Activities</button>
        <button class="left-tab" type="button" data-left-tab="variables" role="tab">Variables</button>
      </div>
      <div class="left-pane" id="paneProject" data-left-pane="project">
        <h2><span class="grow">Project Explorer</span></h2>
        <div class="project-tree" id="projectTree"></div>
      </div>
      <div class="left-pane active" id="paneActivities" data-left-pane="activities">
        <h2><span class="grow">Activities</span></h2>
        <div class="panel-tools">
          <button class="btn" id="btnExpandCats" type="button" title="Expand all categories">Expand</button>
          <button class="btn" id="btnCollapseCats" type="button" title="Collapse all categories">Collapse</button>
        </div>
        <input class="search" id="search" placeholder="Search activities..." />
        <div id="catalog"></div>
      </div>
      <div class="left-pane" id="paneVariables" data-left-pane="variables">
        <h2>
          <span class="grow">Variables</span>
          <span class="count" id="variablesCount" style="font-size:11px;color:var(--muted);normal-case;letter-spacing:0;text-transform:none;">0</span>
        </h2>
        <div class="props" id="variablesPanel" style="padding:0 10px;"></div>
        <div style="padding:0 12px 16px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" id="btnAddVar">Add Variable</button>
        </div>
      </div>
    </aside>

    <main class="canvas-wrap" id="canvasWrap">
      <div class="playback-bar" id="playbackBar">
        <span class="pb-label" id="playbackLabel">Step-through</span>
        <button class="btn" id="btnPbStep" type="button">Step</button>
        <button class="btn primary" id="btnPbContinue" type="button">Continue</button>
        <button class="btn" id="btnPbStop" type="button">Stop</button>
        <div class="pb-vars" id="playbackVars"></div>
      </div>
      <div class="canvas-bar">
        <div class="canvas-help" id="canvasHelp"></div>
        <div class="zoom-tools">
          <button class="btn" id="btnZoomOut" type="button" title="Zoom out">−</button>
          <span class="zoom-label" id="zoomLabel">100%</span>
          <button class="btn" id="btnZoomIn" type="button" title="Zoom in">+</button>
          <button class="btn" id="btnZoomReset" type="button" title="Reset zoom">100%</button>
        </div>
      </div>
      <div class="canvas-zoom" id="canvasZoom">
        <div class="sequence" id="sequence"></div>
        <div class="flow-stage" id="flowStage" style="display:none"></div>
      </div>
      <div class="toast" id="toast"></div>
      <div class="hover-tip" id="hoverTip"></div>
    </main>

    <div class="palette-overlay" id="paletteOverlay">
      <div class="palette" role="dialog" aria-label="Insert activity">
        <div class="palette-head">
          <input id="paletteSearch" placeholder="Search activities… (favorites · recent · all)" autocomplete="off" />
          <div class="palette-hint">Enter insert · ↑↓ navigate · ⌘/Ctrl+⇧+P pin favorite (max 10) · Esc close</div>
        </div>
        <div class="palette-list" id="paletteList"></div>
      </div>
    </div>

    <aside class="panel right" id="propsPanel">
      <div class="panel-resize-x" id="propsResizeX" title="Drag to resize width"></div>
      <div class="panel-chrome" id="propsChrome">
        <h2><span class="grow">Properties</span></h2>
        <div class="panel-chrome-actions">
          <button class="icon-btn" id="btnPropsFloat" type="button" title="Float panel">⧉</button>
          <button class="icon-btn" id="btnPropsDock" type="button" title="Dock panel" style="display:none">▣</button>
          <button class="icon-btn" id="btnPropsCollapse" type="button" title="Collapse panel">—</button>
        </div>
      </div>
      <div class="panel-scroll" id="propsScroll">
        <div class="panel-tools">
          <button class="btn" id="btnExpandProps" type="button" title="Expand all property groups">Expand</button>
          <button class="btn" id="btnCollapseProps" type="button" title="Collapse all property groups">Collapse</button>
        </div>
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
      <div class="panel-resize-y" id="propsResizeY" title="Drag to resize height (float mode)"></div>
      <div class="collapsed-only">
        <button class="btn" id="btnPropsExpand" type="button" title="Expand properties panel">Properties</button>
      </div>
    </aside>
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
      leftTab: 'activities',
      selectedId: null,
      dragType: null,
      linkFrom: null,
      draggingId: null,
      dragOffset: { x: 0, y: 0 },
      zoom: 1,
      collapsedCats: {},
      collapsedPropSections: {},
      propsMode: 'docked', // docked | floating | collapsed
      propsWidth: 300,
      propsHeight: Math.round(window.innerHeight * 0.7),
      propsFloatPos: { x: null, y: null },
      playback: null, // { steps, index, timer, doneIds }
      paletteOpen: false,
      paletteQuery: '',
      paletteActive: 0
    };

    const els = {
      app: document.querySelector('.app'),
      propsPanel: document.getElementById('propsPanel'),
      propsScroll: document.getElementById('propsScroll'),
      catalog: document.getElementById('catalog'),
      projectTree: document.getElementById('projectTree'),
      sequence: document.getElementById('sequence'),
      flowStage: document.getElementById('flowStage'),
      canvasZoom: document.getElementById('canvasZoom'),
      props: document.getElementById('props'),
      variablesPanel: document.getElementById('variablesPanel'),
      connectionsPanel: document.getElementById('connectionsPanel'),
      connectionsSection: document.getElementById('connectionsSection'),
      variablesCount: document.getElementById('variablesCount'),
      connectionsCount: document.getElementById('connectionsCount'),
      workflowName: document.getElementById('workflowName'),
      workflowType: document.getElementById('workflowType'),
      canvasHelp: document.getElementById('canvasHelp'),
      search: document.getElementById('search'),
      toast: document.getElementById('toast'),
      hoverTip: document.getElementById('hoverTip'),
      zoomLabel: document.getElementById('zoomLabel'),
      btnDelete: document.getElementById('btnDelete'),
      btnLink: document.getElementById('btnLink'),
      btnAutoLayout: document.getElementById('btnAutoLayout')
    };

    function setLeftTab(tab) {
      state.leftTab = tab || 'activities';
      document.querySelectorAll('.left-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-left-tab') === state.leftTab);
      });
      document.querySelectorAll('.left-pane').forEach((pane) => {
        pane.classList.toggle('active', pane.getAttribute('data-left-pane') === state.leftTab);
      });
    }
    document.querySelectorAll('.left-tab').forEach((btn) => {
      btn.addEventListener('click', () => setLeftTab(btn.getAttribute('data-left-tab')));
    });

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
        return { kind: 'desktop', app: 'notepad.exe', title: '*', tag: '', id: '', aaname: '', cls: 'Notepad', name: '', idx: '' };
      }
      return { kind: 'browser', app: 'chrome.exe', title: '*', tag: 'BUTTON', id: '', aaname: '', cls: '', name: '', idx: '' };
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
      if (!parts.id && !parts.aaname && !parts.name && tag === '*') web.push("id='element'");
      return "<html app='" + escSel(parts.app || 'chrome.exe') + "' title='" + escSel(parts.title || '*') + "' />\\n<webctrl " + web.join(' ') + ' />';
    }
    function parseWindowsSelector(raw) {
      const text = String(raw || '').trim();
      if (!text) return emptySelParts('browser');
      if (/<wnd\\b/i.test(text)) {
        const m = text.match(/<wnd\\b([^>]*)\\/?>/i);
        const attrs = parseSelAttrs(m && m[1] || '');
        return { kind: 'desktop', app: attrs.app || 'app.exe', title: attrs.title || '*', tag: '', id: '', aaname: attrs.aaname || '', cls: attrs.cls || '', name: attrs.name || '', idx: attrs.idx || '' };
      }
      const html = text.match(/<html\\b([^>]*)\\/?>/i);
      const web = text.match(/<webctrl\\b([^>]*)\\/?>/i);
      const htmlAttrs = parseSelAttrs(html && html[1] || '');
      const webAttrs = parseSelAttrs(web && web[1] || '');
      return {
        kind: 'browser',
        app: htmlAttrs.app || 'chrome.exe',
        title: htmlAttrs.title || '*',
        tag: String(webAttrs.tag || 'BUTTON').toUpperCase(),
        id: webAttrs.id || '',
        aaname: webAttrs.aaname || '',
        cls: webAttrs.class || webAttrs.cls || '',
        name: webAttrs.name || '',
        idx: webAttrs.idx || ''
      };
    }
    function selectorBuilderHtml(propName, currentValue) {
      const parts = parseWindowsSelector(currentValue);
      const tplOpts = SELECTOR_TEMPLATES.map(t =>
        '<option value="' + escapeAttr(t.id) + '">' + escapeHtml(t.label) + '</option>'
      ).join('');
      const kindOpts = ['browser', 'desktop'].map(k =>
        '<option value="' + k + '"' + (parts.kind === k ? ' selected' : '') + '>' + k + '</option>'
      ).join('');
      return '<div class="selector-builder" data-sel-for="' + escapeAttr(propName) + '">' +
        '<div class="sb-title">Selector Builder</div>' +
        fieldHtml('Template', '<select data-sb="template"><option value="">— choose template —</option>' + tplOpts + '</select>') +
        '<div class="sb-grid" style="margin-top:8px">' +
          fieldHtml('Kind', '<select data-sb="kind">' + kindOpts + '</select>') +
          fieldHtml('App', '<input data-sb="app" value="' + escapeAttr(parts.app) + '" />') +
          fieldHtml('Title', '<input data-sb="title" value="' + escapeAttr(parts.title) + '" />') +
          fieldHtml('Tag', '<input data-sb="tag" value="' + escapeAttr(parts.tag) + '" />') +
          fieldHtml('Id', '<input data-sb="id" value="' + escapeAttr(parts.id) + '" />') +
          fieldHtml('aaname', '<input data-sb="aaname" value="' + escapeAttr(parts.aaname) + '" />') +
          fieldHtml('Class / cls', '<input data-sb="cls" value="' + escapeAttr(parts.cls) + '" />') +
          fieldHtml('Name', '<input data-sb="name" value="' + escapeAttr(parts.name) + '" />') +
          fieldHtml('Index', '<input data-sb="idx" value="' + escapeAttr(parts.idx) + '" />') +
        '</div>' +
        '<div class="sb-actions">' +
          '<button class="btn primary" type="button" data-sb-apply>Apply to selector</button>' +
        '</div>' +
        '<pre class="sb-preview" data-sb-preview>' + escapeHtml(buildWindowsSelector(parts)) + '</pre>' +
      '</div>';
    }
    function wireSelectorBuilder(root, node, propName) {
      const box = root.querySelector('.selector-builder[data-sel-for="' + propName + '"]');
      if (!box) return;
      const preview = box.querySelector('[data-sb-preview]');
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
      const refreshPreview = () => {
        if (preview) preview.textContent = buildWindowsSelector(readParts());
      };
      box.querySelectorAll('[data-sb]').forEach(el => {
        el.addEventListener('input', refreshPreview);
        el.addEventListener('change', () => {
          if (el.getAttribute('data-sb') === 'template' && el.value) {
            const tpl = SELECTOR_TEMPLATES.find(t => t.id === el.value);
            if (tpl) {
              const base = emptySelParts(tpl.kind);
              const merged = Object.assign({}, base, tpl.parts, { kind: tpl.kind });
              Object.keys(merged).forEach(k => {
                const input = box.querySelector('[data-sb="' + k + '"]');
                if (input) input.value = merged[k] == null ? '' : String(merged[k]);
              });
              refreshPreview();
            }
          } else if (el.getAttribute('data-sb') === 'kind') {
            const next = emptySelParts(el.value);
            Object.keys(next).forEach(k => {
              const input = box.querySelector('[data-sb="' + k + '"]');
              if (input && k !== 'kind') input.value = next[k];
            });
            refreshPreview();
          } else {
            refreshPreview();
          }
        });
      });
      box.querySelector('[data-sb-apply]')?.addEventListener('click', () => {
        const built = buildWindowsSelector(readParts());
        const target = root.querySelector('[data-prop="' + propName + '"]');
        if (target) target.value = built;
        node.properties[propName] = built;
        refreshPreview();
        toast('Selector applied');
        persist(true);
      });
    }

    function applyPropsPanelLayout() {
      const panel = els.propsPanel;
      const app = els.app;
      if (!panel || !app) return;
      document.documentElement.style.setProperty('--props-width', state.propsWidth + 'px');
      document.documentElement.style.setProperty('--props-height', state.propsHeight + 'px');
      panel.classList.remove('floating', 'collapsed-strip');
      app.classList.remove('props-floating', 'props-collapsed');
      panel.style.left = '';
      panel.style.top = '';
      panel.style.right = '';
      panel.style.width = '';
      panel.style.height = '';
      const btnFloat = document.getElementById('btnPropsFloat');
      const btnDock = document.getElementById('btnPropsDock');
      const btnToolbar = document.getElementById('btnPropsPanel');
      if (state.propsMode === 'floating') {
        panel.classList.add('floating');
        app.classList.add('props-floating');
        panel.style.width = state.propsWidth + 'px';
        panel.style.height = state.propsHeight + 'px';
        if (state.propsFloatPos.x != null) {
          panel.style.left = state.propsFloatPos.x + 'px';
          panel.style.top = state.propsFloatPos.y + 'px';
          panel.style.right = 'auto';
        }
        if (btnFloat) btnFloat.style.display = 'none';
        if (btnDock) btnDock.style.display = '';
        if (btnToolbar) btnToolbar.style.display = 'none';
      } else if (state.propsMode === 'collapsed') {
        panel.classList.add('collapsed-strip');
        app.classList.add('props-collapsed');
        if (btnFloat) btnFloat.style.display = '';
        if (btnDock) btnDock.style.display = 'none';
        if (btnToolbar) btnToolbar.style.display = '';
      } else {
        if (btnFloat) btnFloat.style.display = '';
        if (btnDock) btnDock.style.display = 'none';
        if (btnToolbar) btnToolbar.style.display = 'none';
      }
      try { vscode.setState({ propsMode: state.propsMode, propsWidth: state.propsWidth, propsHeight: state.propsHeight, propsFloatPos: state.propsFloatPos }); } catch (e) {}
    }
    function restorePropsPanelState() {
      try {
        const saved = vscode.getState && vscode.getState();
        if (!saved) return;
        if (saved.propsMode) state.propsMode = saved.propsMode;
        if (saved.propsWidth) state.propsWidth = saved.propsWidth;
        if (saved.propsHeight) state.propsHeight = saved.propsHeight;
        if (saved.propsFloatPos) state.propsFloatPos = saved.propsFloatPos;
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
      card.dataset.id = node.id;
      card.className = 'card' + (state.selectedId === node.id ? ' selected' : '') + dryRunClass(node.id);
      const openBtn = node.type === 'REFramework.InvokeWorkflow'
        ? '<button class="icon-btn" data-act="open" title="Open workflow in new tab">↗</button>'
        : '';
      card.innerHTML =
        '<div class="card-accent" style="background:' + color + '"></div>' +
        '<div class="card-actions">' +
          openBtn +
          '<button class="icon-btn" data-act="up" title="Move up">↑</button>' +
          '<button class="icon-btn" data-act="down" title="Move down">↓</button>' +
          '<button class="icon-btn" data-act="dup" title="Duplicate">⧉</button>' +
        '</div>' +
        '<div class="card-head"><span class="step">#' + stepNo + '</span>' +
        '<div class="card-title">' + escapeHtml(node.displayName) + '</div></div>' +
        '<div class="card-summary">' + escapeHtml(summary(node)) + '</div>';
      card.addEventListener('mouseenter', (e) => showTip(tipHtml(node), e.clientX, e.clientY));
      card.addEventListener('mousemove', (e) => showTip(tipHtml(node), e.clientX, e.clientY));
      card.addEventListener('mouseleave', hideTip);
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-act]')) return;
        state.selectedId = node.id;
        hideTip();
        renderAll();
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
        el.dataset.id = node.id;
        el.className = 'flow-node' +
          (state.selectedId === node.id ? ' selected' : '') +
          (isDecision ? ' decision' : '') +
          (isStart ? ' start' : '') +
          (isEnd ? ' end' : '') +
          dryRunClass(node.id);
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
      if (name === 'to' || name === 'result' || name === 'item' || name === 'row' || name === 'dataTable' || name === 'values') {
        return s.variables || [];
      }
      if (type === 'expression' || name === 'condition' || name === 'message' || name === 'text' || name === 'url' || name === 'value' || name === 'jsonString' || name === 'arrayRow' || name === 'subject' || name === 'body') {
        const vars = s.variables || [];
        const cfg = s.configExpressions || [];
        return [...vars, ...cfg].slice(0, 40);
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
        return '<textarea data-prop="' + escapeAttr(p.name) + '">' + escapeHtml(String(val)) + '</textarea>' + suggestChipsHtml(node, p);
      }
      if (p.type === 'number') {
        return '<input type="number" data-prop="' + escapeAttr(p.name) + '" value="' + escapeAttr(String(val)) + '" />';
      }
      return '<input data-prop="' + escapeAttr(p.name) + '" value="' + escapeAttr(String(val)) + '"' + listAttr + ' />' + datalist + suggestChipsHtml(node, p);
    }

    function renderProps() {
      syncSuggestionVariables();
      const hit = state.selectedId ? walkFind(state.workflow.activities, state.selectedId) : null;
      els.btnDelete.disabled = !hit;
      if (!hit) {
        els.props.innerHTML = '<div class="empty">Select a step to edit properties. In Flowchart mode, drag the blue port to connect nodes.</div>';
        return;
      }
      const node = hit.node;
      const def = findDef(node.type);
      const currentColor = node.color || def?.color || '#64748B';
      const presets = ['#3B82F6','#8B5CF6','#F59E0B','#10B981','#EF4444','#0EA5E9','#EC4899','#64748B','#22C55E','#A855F7'];

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
      for (const p of (def?.properties || [])) {
        const val = node.properties?.[p.name] ?? '';
        activity += fieldHtml(p.label, renderPropInput(p, val, node), p.required);
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

      let html = propSection('general', 'General', general);
      html += propSection('activity', 'Activity', activity);
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
        ? 'Flowchart mode: drop on the grid, drag nodes, use blue ports for links. Hover for details. Zoom with +/−.'
        : 'Sequence mode: drag activities onto the sequence. Hover for details. Double-click Invoke Workflow to open it.';
      applyZoom();
      renderCatalog();
      renderProjectTree();
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
      state.collapsedPropSections = { general: true, activity: true, flow: true };
      renderProps();
    });
    document.getElementById('btnToggleConnections')?.addEventListener('click', () => {
      toggleSideSection(els.connectionsSection);
    });
    document.getElementById('btnPropsFloat')?.addEventListener('click', () => {
      state.propsMode = 'floating';
      applyPropsPanelLayout();
      toast('Properties panel floating');
    });
    document.getElementById('btnPropsDock')?.addEventListener('click', () => {
      state.propsMode = 'docked';
      state.propsFloatPos = { x: null, y: null };
      applyPropsPanelLayout();
      toast('Properties panel docked');
    });
    document.getElementById('btnPropsCollapse')?.addEventListener('click', () => {
      state.propsMode = 'collapsed';
      applyPropsPanelLayout();
    });
    document.getElementById('btnPropsExpand')?.addEventListener('click', () => {
      state.propsMode = 'docked';
      applyPropsPanelLayout();
    });
    document.getElementById('btnPropsPanel')?.addEventListener('click', () => {
      state.propsMode = state.propsMode === 'collapsed' ? 'docked' : state.propsMode;
      if (state.propsMode === 'collapsed') state.propsMode = 'docked';
      applyPropsPanelLayout();
    });

    // Width resize
    (function bindPropsResize() {
      const handleX = document.getElementById('propsResizeX');
      const handleY = document.getElementById('propsResizeY');
      const chrome = document.getElementById('propsChrome');
      let mode = null; // 'x' | 'y' | 'move'
      let start = { x: 0, y: 0, w: 0, h: 0, left: 0, top: 0 };
      handleX?.addEventListener('mousedown', (e) => {
        e.preventDefault();
        mode = 'x';
        handleX.classList.add('dragging');
        start = { x: e.clientX, y: e.clientY, w: state.propsWidth, h: state.propsHeight, left: 0, top: 0 };
      });
      handleY?.addEventListener('mousedown', (e) => {
        if (state.propsMode !== 'floating') return;
        e.preventDefault();
        mode = 'y';
        handleY.classList.add('dragging');
        start = { x: e.clientX, y: e.clientY, w: state.propsWidth, h: state.propsHeight, left: 0, top: 0 };
      });
      chrome?.addEventListener('mousedown', (e) => {
        if (state.propsMode !== 'floating') return;
        if (e.target.closest('button')) return;
        mode = 'move';
        const rect = els.propsPanel.getBoundingClientRect();
        start = { x: e.clientX, y: e.clientY, w: state.propsWidth, h: state.propsHeight, left: rect.left, top: rect.top };
      });
      window.addEventListener('mousemove', (e) => {
        if (!mode) return;
        if (mode === 'x') {
          // Left-edge handle: drag left → wider
          state.propsWidth = Math.min(560, Math.max(240, start.w + (start.x - e.clientX)));
          applyPropsPanelLayout();
        } else if (mode === 'y') {
          state.propsHeight = Math.min(window.innerHeight - 90, Math.max(280, start.h + (e.clientY - start.y)));
          applyPropsPanelLayout();
        } else if (mode === 'move') {
          state.propsFloatPos = {
            x: Math.max(8, start.left + (e.clientX - start.x)),
            y: Math.max(8, start.top + (e.clientY - start.y))
          };
          applyPropsPanelLayout();
        }
      });
      window.addEventListener('mouseup', () => {
        if (!mode) return;
        mode = null;
        handleX?.classList.remove('dragging');
        handleY?.classList.remove('dragging');
        applyPropsPanelLayout();
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
        if (pb.timer) { clearInterval(pb.timer); pb.timer = null; }
        renderAll();
        toast('Step-through complete');
        return;
      }
      const step = pb.steps[pb.index];
      state.selectedId = step.activityId;
      if (label) {
        label.textContent = '[' + step.index + '/' + pb.steps.length + '] ' + step.displayName + ' — ' + step.action;
      }
      if (varsEl) {
        const keys = step.changedKeys || [];
        varsEl.textContent = keys.length
          ? ('Δ ' + keys.map(k => k + '=' + JSON.stringify((step.variablesSnapshot || {})[k])).join(' · '))
          : 'no variable changes';
      }
      setLeftTab('variables');
      renderAll();
      const el = document.querySelector('[data-id="' + step.activityId + '"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
    function startPlayback(result) {
      if (state.playback?.timer) clearInterval(state.playback.timer);
      state.playback = {
        steps: result.steps || [],
        index: 0,
        timer: null,
        doneIds: new Set(),
        finalVars: result.variables || {}
      };
      if (!state.playback.steps.length) {
        toast('No steps to play');
        stopPlayback();
        return;
      }
      showPlaybackStep();
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
      vscode.postMessage({ type: 'dryRun', workflow: state.workflow, stepThrough: false });
    });
    document.getElementById('btnStepThrough').addEventListener('click', () => {
      vscode.postMessage({ type: 'dryRun', workflow: state.workflow, stepThrough: true });
    });
    document.getElementById('btnPbStep')?.addEventListener('click', () => stepPlayback());
    document.getElementById('btnPbContinue')?.addEventListener('click', () => continuePlayback());
    document.getElementById('btnPbStop')?.addEventListener('click', () => stopPlayback());
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
      if (msg.type === 'toast' && msg.message) toast(msg.message);
      if (msg.type === 'requestFlush') {
        // Flush typed-but-not-blurred property values into state.workflow before Cmd+S
        vscode.postMessage({ type: 'flushState', workflow: state.workflow });
      }
      if (msg.type === 'dryRunPlayback' && msg.result) {
        startPlayback(msg.result);
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
      } else if (state.selectedId) {
        const hit = walkFind(state.workflow.activities, state.selectedId);
        if (hit) {
          const def = findDef(hit.node.type);
          if (def?.container && Array.isArray(hit.node.children)) {
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
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
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
