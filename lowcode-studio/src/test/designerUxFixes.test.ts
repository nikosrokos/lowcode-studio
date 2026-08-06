import assert from 'assert';
import { createEmptyWorkflow } from '../models/workflow';
import { getActivityCatalog } from '../models/activities';
import { getDesignerHtml } from '../webview/designerHtml';

function run(): void {
  const html = getDesignerHtml(
    'nonce',
    'https://example',
    createEmptyWorkflow('Main'),
    getActivityCatalog()
  );

  assert.ok(html.includes('id="ctxMenu"'), 'context menu markup');
  assert.ok(html.includes('ctxIgnoreClickUntil'), 'menu must ignore trailing click after right-click');
  assert.ok(html.includes('data-card-menu'), '⋯ menu button on cards');
  assert.ok(html.includes('application/lcs-activity-id'), 'card reorder drag payload');
  assert.ok(html.includes('--activity-column-width'), 'narrower activity column');
  assert.ok(html.includes('--flow-node-width'), 'narrower flowchart nodes');
  assert.ok(html.includes('ensurePropsPanelVisible'), 'auto-expand properties on select');
  assert.ok(html.includes('Unknown / imported type'), 'imported type banner in props');
  assert.ok(html.includes('extraKeys'), 'orphan property keys rendered');
  assert.ok(html.includes('id="minimapDock"'), 'mini-map dock in properties panel');
  assert.ok(html.includes('function renderMinimap'), 'mini-map renderer');
  assert.ok(html.includes('activityIconHtml'), 'canvas / palette activity icons');
  assert.ok(html.includes('assistLiveStripHtml'), 'live Assist strip in Properties');
  assert.ok(html.includes('data-assist-tab="scaffold"'), 'Assist Scaffold tab');
  assert.ok(html.includes('assistScaffoldPropose'), 'Assist scaffold propose button');
  assert.ok(html.includes('collectLiveAssistProposals'), 'live Assist proposals');
  assert.ok(html.includes('invokeMapEditorHtml'), 'Invoke argument mapping editor');
  assert.ok(html.includes('loadWorkflowArguments'), 'host load for target workflow args');
  assert.ok(html.includes('refreshExprVbAssist'), 'expression editor VB Assist');
  assert.ok(html.includes('id="exprVbAssist"'), 'VB Assist strip in expression dialog');
  assert.ok(html.includes('fitCanvasView'), 'canvas fit content / selection');
  assert.ok(html.includes('id="btnFitCanvas"'), 'Fit button in canvas bar');
  assert.ok(html.includes('runWorkflowSearch'), 'search next / prev in workflow');
  assert.ok(html.includes('alignSelectedFlowNodes'), 'flowchart align');
  assert.ok(html.includes('assist-filter'), 'cleaner Assist live filters');
  assert.ok(html.includes('assist-help-link'), 'Assist help demoted to ? link');
  assert.ok(html.includes('id="btnReadyGate"'), 'Ready for Studio Web dock button');
  assert.ok(html.includes('duplicateWorkflow'), 'project tree duplicate action');
  assert.ok(html.includes('revealStudioWebFolder'), 'reveal Studio Web folder action');
  assert.ok(html.includes('checkWorkflowPath'), 'Invoke path exists host check');
  assert.ok(html.includes('conflictCount'), 'sync conflict clarity in pill/alert');
  assert.ok(html.includes('id="projectCtx"'), 'project tree context menu');
  assert.ok(html.includes('function selectActivity'), 'selectActivity heals Studio Web selection');
  assert.ok(html.includes('ensureActivityIds'), 'missing activity ids healed');
  assert.ok(html.includes('mm-row'), 'minimap shows labeled rows');
  assert.ok(html.includes('--activity-column-width: 480px'), 'narrower activity column');
  assert.ok(html.includes('max-height: min(70vh, 420px)'), 'context menu scrolls when near bottom');
  assert.ok(html.includes('id="btnToggleSearch"'), 'Find activity toggle icon');
  assert.ok(html.includes('function setSearchOpen'), 'Find collapses / opens in place');
  assert.ok(html.includes('isVarBindingProp'), 'activity add skips auto variable bindings');
  assert.ok(html.includes('Toggle in place'), 'prop sections collapse without full re-render');
  assert.ok(
    !html.includes('Always expand core sections when selecting'),
    'must not force-expand prop sections on every renderProps'
  );
  assert.ok(html.includes('id="syncAlert"'), 'Studio Web sync alert banner');
  assert.ok(html.includes('id="btnSync"'), 'Sync button in toolbar');
  assert.ok(html.includes('function applySyncStatus'), 'applies syncStatus from host');
  assert.ok(html.includes("type: 'pullStudioWeb'"), 'Sync posts pullStudioWeb');
  assert.ok(html.includes('id="syncPill"'), 'sync status pill');
  assert.ok(html.includes('function resolveSelectedNode'), 'props resolve via live selected node');
  assert.ok(html.includes('showCtxMenu(x, y, activityId, nodeRef)'), 'ctx menu receives live node');
  assert.ok(html.includes("showCtxMenu(e.clientX, e.clientY, node.id, node)"), 'card ctx passes node');
  assert.ok(html.includes('selectedNode'), 'selectedNode kept for SW sync props paint');
  assert.ok(html.includes('function idsEqual'), 'selection id compare is type-safe');
  assert.ok(html.includes('.card.selected[data-id]'), 'props recover selection from DOM after Sync');
  assert.ok(html.includes('rematch soft'), 'Sync rematches selection when ids rewrite');
  assert.ok(html.includes('ICON_GLYPHS'), 'visible glyph fallbacks for activity icons');
  assert.ok(html.includes('act-fb'), 'glyph fallback span always painted');
  assert.ok(html.includes("output: 'LG'"), 'ASCII Log Message badge (not emoji tofu)');
  assert.ok(html.includes("'●'"), 'unknown icons fall back to a circle (not "$(")');
  assert.ok(
    html.includes("indexOf('$(')") || html.includes('indexOf("$(")'),
    'codicon strip must not use template-broken /\\$/ regex'
  );
  assert.ok(!html.includes('slice(0, 2)'), 'must not derive badges via slice (produced "$(")');
  assert.ok(
    html.includes('font-family: ui-monospace') && html.includes('.act-icon .act-fb'),
    'glyph badges use monospace (readable ASCII)'
  );
  assert.ok(!html.includes('codicon-ready .act-fb'), 'must not hide glyph badges when font loads');
  assert.ok(html.includes('pointerdown'), 'select on pointerdown so draggable cards paint props');
  assert.ok(html.includes('softRematchNode'), 'SW reopen soft-rematches instead of orphan paint');
  assert.ok(html.includes('walkFindRef'), 'select by object identity for card clicks');
  assert.ok(html.includes('wirePropsDelegation'), 'delegated prop editors survive wiring failures');
  assert.ok(html.includes('resolveEditTarget'), 'prop edits resolve tree-backed node');
  assert.ok(html.includes('normalizeNodePropsForEdit'), 'coerce SW props before paint');
  assert.ok(html.includes('updateSelectedChrome'), 'selection chrome without full renderAll');
  assert.ok(html.includes('rerender: false'), 'card click avoids mid-pointerdown renderAll');
  assert.ok(html.includes('Never fall back to orphan') || html.includes('wirePropsDelegation') || html.includes('never keep a detached orphan'), 'no orphan props path');
  assert.ok(html.includes('liveTreeNode') || html.includes('resolveEditTarget'), 'prop edits target tree-backed node');
  assert.ok(html.includes('persistPropEdit'), 'prop edits persist without full re-render wipe');
  assert.ok(html.includes('SW reopen orphans broke edits') || html.includes('resolveEditTarget') || html.includes('wirePropsDelegation'), 'SW reopen edit path');
  assert.ok(html.includes('selectActivity(keepNode.id'), 'Save/Sync reload re-selects via selectActivity');
  assert.ok(html.includes('id="btnHome"'), 'Home button in top toolbar');
  assert.ok(html.includes("type: 'openHome'"), 'Home posts openHome to host');
  assert.ok(html.includes('function iconCodiconName'), 'codicon name helper for glyph map');
  assert.ok(html.includes('function coercePaintValue'), 'coerce SW ExpressionText before paint');
  assert.ok(html.includes('font-src') && html.includes('data:'), 'CSP allows data: font for embedded codicon');
  assert.ok(html.includes('id="btnThemeToggle"'), 'toolbar theme toggle');
  assert.ok(html.includes('function toggleDesignerTheme'), 'theme toggle handler');
  assert.ok(html.includes('function applyDesignerTheme'), 'applies data-theme');
  assert.ok(html.includes('html[data-theme="light"]'), 'forced light theme tokens');
  assert.ok(html.includes('html[data-theme="dark"]'), 'forced dark theme tokens');
  assert.ok(html.includes('id="set_designerTheme"'), 'settings Appearance theme select');
  assert.ok(html.includes('designerTheme'), 'designerTheme setting wired');
  assert.ok(html.includes('--tip-border'), 'tooltip border token');

  console.log('designerUxFixes.test.ts: ok');
}

run();
