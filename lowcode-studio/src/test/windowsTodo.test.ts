import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import { parseWorkflow, stringifyWorkflow } from '../models/workflow';
import {
  buildWindowsTodoChecklist,
  formatWindowsTodoMarkdown,
  formatWindowsTodoReport,
  writeWindowsTodoFile
} from '../interop/windowsTodo';
import { getActivityDefinition } from '../models/activities';
import { dryRunWorkflow } from '../commands/simulator';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { createEmptyWorkflow } from '../models/workflow';
import { packagesForActivityType } from '../interop/uipathDependencies';

function run(): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-todo-'));
  for (const file of generateREFrameworkProject('TodoCheck')) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }

  const clean = buildWindowsTodoChecklist(dir);
  assert.ok(clean.readyForWindows || clean.items.every((i) => i.priority !== 'high'));

  const processPath = path.join(dir, 'Framework', 'Process.lcs.json');
  const process = parseWorkflow(fs.readFileSync(processPath, 'utf8'));
  process.activities.push({
    id: 'click1',
    type: 'UI.Click',
    displayName: 'Broken Click',
    properties: { selector: '' }
  });
  process.activities.push({
    id: 'imp1',
    type: 'Imported.TypeInto',
    displayName: 'Legacy Type',
    properties: { selector: '<target id="x" />' }
  });
  fs.writeFileSync(processPath, stringifyWorkflow(process), 'utf8');

  const todo = buildWindowsTodoChecklist(dir);
  assert.ok(!todo.readyForWindows);
  assert.ok(todo.items.some((i) => i.priority === 'high'));
  assert.ok(todo.items.some((i) => i.code === 'ui-missing-selector' || i.code === 'imported-placeholder' || i.code === 'ui-placeholder-selector'));

  const md = formatWindowsTodoMarkdown(todo);
  assert.ok(md.includes('# Windows TODO'));
  assert.ok(md.includes('Selector Builder'));

  const report = formatWindowsTodoReport(todo);
  assert.ok(report.includes('[high]'));

  const written = writeWindowsTodoFile(dir, todo);
  assert.ok(fs.existsSync(written));
  assert.ok(fs.readFileSync(written, 'utf8').includes('Windows TODO'));

  // Use Application/Browser activity + export + dry-run
  const uab = getActivityDefinition('UI.UseApplicationBrowser');
  assert.ok(uab?.container);
  assert.ok(packagesForActivityType('UI.UseApplicationBrowser').includes('UiPath.UIAutomation.Activities'));

  const wf = createEmptyWorkflow('ScopeDemo', 'Sequence');
  wf.activities = [
    {
      id: 'scope1',
      type: 'UI.UseApplicationBrowser',
      displayName: 'Open Chrome',
      properties: {
        mode: 'Browser',
        urlOrPath: 'https://example.com',
        browserType: 'Chrome',
        open: 'IfNotOpen',
        close: 'Never',
        selector: "<html app='chrome.exe' title='*' />"
      },
      children: [
        {
          id: 'c1',
          type: 'UI.Click',
          displayName: 'Click Submit',
          properties: {
            selector:
              "<html app='chrome.exe' title='*' />\n<webctrl tag='BUTTON' id='btnSubmit' />"
          }
        }
      ]
    }
  ];
  const dry = dryRunWorkflow(wf);
  assert.ok(dry.ok);
  assert.ok(dry.log.some((l) => l.includes('UseApplicationBrowser')));
  assert.ok(dry.log.some((l) => l.includes('Click')));

  const xaml = exportWorkflowToXaml(wf);
  assert.ok(xaml.includes('NApplicationCard'));
  assert.ok(xaml.includes('example.com'));
  assert.ok(xaml.includes('NClick'));

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('windowsTodo.test.ts: all assertions passed');
}

run();
