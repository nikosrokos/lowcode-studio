import assert from 'assert';
import {
  applyScaffoldToWorkflow,
  scaffoldSequenceFromDescription
} from '../commands/assistScaffold';
import {
  applyTraceRepairs,
  proposeRepairsFromDryRunTrace
} from '../commands/assistTraceRepair';
import { DryRunResult } from '../commands/simulator';
import { createEmptyWorkflow } from '../models/workflow';
import { HOME_NEXT_STEPS } from '../webview/homeHtml';

function run(): void {
  const proposal = scaffoldSequenceFromDescription(
    'use browser https://example.com then type into then click then log message "done"'
  );
  assert.ok(proposal.activities.length >= 3, JSON.stringify(proposal.summary));
  assert.ok(proposal.activities.some((a) => a.type === 'UI.UseApplicationBrowser'));
  assert.ok(proposal.activities.some((a) => a.type === 'UI.TypeInto'));
  assert.ok(proposal.activities.some((a) => a.type === 'UI.Click'));
  assert.ok(proposal.activities.some((a) => a.type === 'System.LogMessage'));

  const base = createEmptyWorkflow('Main');
  const appended = applyScaffoldToWorkflow(base, proposal, 'append');
  assert.ok(appended.activities.length >= proposal.activities.length);

  const doc = createEmptyWorkflow('Broken');
  doc.activities = [
    {
      id: 'act_1',
      type: 'UI.Click',
      displayName: 'Click',
      properties: { selector: '' }
    },
    {
      id: 'act_2',
      type: 'Imported.Mystery',
      displayName: 'Mystery',
      properties: { originalType: 'Mystery', hint: 'todo' }
    },
    {
      id: 'act_3',
      type: 'System.LogMessage',
      displayName: 'Log',
      properties: { level: 'Info', message: '' }
    }
  ];
  const result: DryRunResult = {
    ok: false,
    steps: [
      {
        index: 0,
        activityId: 'act_1',
        displayName: 'Click',
        type: 'UI.Click',
        action: 'click',
        status: 'error'
      },
      {
        index: 1,
        activityId: 'act_2',
        displayName: 'Mystery',
        type: 'Imported.Mystery',
        action: 'skip',
        status: 'warn'
      },
      {
        index: 2,
        activityId: 'act_3',
        displayName: 'Log',
        type: 'System.LogMessage',
        action: 'log',
        status: 'warn'
      }
    ],
    variables: {},
    log: [],
    warnings: []
  };
  const repairs = proposeRepairsFromDryRunTrace(doc, result);
  assert.ok(repairs.some((r) => r.kind === 'selector-placeholder'));
  assert.ok(repairs.some((r) => r.kind === 'imported-comment'));
  assert.ok(repairs.some((r) => r.kind === 'log-message'));

  const fixed = applyTraceRepairs(doc, repairs);
  const click = fixed.activities.find((a) => a.id === 'act_1')!;
  assert.ok(String(click.properties.selector).includes('webctrl'));
  const mystery = fixed.activities.find((a) => a.id === 'act_2')!;
  assert.strictEqual(mystery.type, 'System.Comment');
  const log = fixed.activities.find((a) => a.id === 'act_3')!;
  assert.ok(String(log.properties.message).length > 0);

  assert.strictEqual(HOME_NEXT_STEPS.length, 5);

  console.log('assistF2.test.ts: ok');
}

run();
