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
  assert.ok(html.includes('id="exprDialogAssist"'), 'Assist button in expression dialog');
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

  console.log('designerUxFixes.test.ts: ok');
}

run();
