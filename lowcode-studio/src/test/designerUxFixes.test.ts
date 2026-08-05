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

  console.log('designerUxFixes.test.ts: ok');
}

run();
