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
  assert.ok(html.includes('data-assist-tab="scaffold"'), 'Assist Scaffold (F2) tab');
  assert.ok(html.includes('assistScaffoldPropose'), 'Assist scaffold propose button');
  assert.ok(html.includes('collectLiveAssistProposals'), 'live Assist proposals');

  console.log('designerUxFixes.test.ts: ok');
}

run();
