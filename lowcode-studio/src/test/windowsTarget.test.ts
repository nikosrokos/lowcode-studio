import assert from 'assert';
import {
  isPlaceholderSelector,
  isWindowsClassicSelector,
  normalizeWindowsSelector,
  resolveUiPathTarget,
  WINDOWS_NET_TFM
} from '../interop/windowsTarget';
import { exportUiPathProjectJson, exportWorkflowToXaml } from '../interop/xamlExport';
import { createEmptyWorkflow } from '../models/workflow';
import { generateREFrameworkProject } from '../templates/reframework';
import { exportToStudioWebProject } from '../interop/studioProject';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function run(): void {
  assert.strictEqual(resolveUiPathTarget(undefined), 'Windows');
  assert.strictEqual(resolveUiPathTarget('Portable'), 'Portable');
  assert.ok(WINDOWS_NET_TFM.includes('windows'));

  const normalized = normalizeWindowsSelector('<target id="btnSubmit" />');
  assert.ok(normalized.includes('<html'));
  assert.ok(normalized.includes('<webctrl'));
  assert.ok(normalized.includes("id='btnSubmit'"));
  assert.ok(isWindowsClassicSelector(normalized));
  assert.ok(isPlaceholderSelector('<target id="x" />'));
  assert.ok(isPlaceholderSelector(normalized), 'stock btnSubmit id stays a placeholder');
  assert.ok(
    !isPlaceholderSelector(normalized.replace(/btnSubmit/g, 'checkoutBtn')),
    'real ids are not placeholders'
  );
  assert.ok(
    isPlaceholderSelector(
      "<html app='chrome.exe' title='*' />\n<webctrl tag='BUTTON' />"
    ),
    'tag-only webctrl is placeholder'
  );

  const projectJson = JSON.parse(
    exportUiPathProjectJson({
      name: 'WinDemo',
      main: 'Main.xaml',
      dependencies: { 'UiPath.System.Activities': '[25.4.1]' }
    })
  ) as {
    targetFramework: string;
    runtimeOptions: { netCore: { targetFramework: string }; requiresUserInteraction: boolean };
    entryPoints: Array<{ uniqueId: string }>;
  };
  assert.strictEqual(projectJson.targetFramework, 'Windows');
  assert.strictEqual(projectJson.runtimeOptions.netCore.targetFramework, 'net8.0-windows');
  assert.strictEqual(projectJson.runtimeOptions.requiresUserInteraction, true);
  // Studio Web requires a real Guid — the old pseudoUuid broke names like "RPA Workflow"
  const guidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.ok(
    guidRe.test(projectJson.entryPoints[0].uniqueId),
    `invalid entryPoints uniqueId: ${projectJson.entryPoints[0].uniqueId}`
  );

  const portable = JSON.parse(
    exportUiPathProjectJson({
      name: 'CloudDemo',
      main: 'Main.xaml',
      targetFramework: 'Portable',
      requiresUserInteraction: false
    })
  ) as { targetFramework: string; runtimeOptions: { netCore: { targetFramework: string } } };
  assert.strictEqual(portable.targetFramework, 'Portable');
  assert.strictEqual(portable.runtimeOptions.netCore.targetFramework, 'net8.0');

  const wf = createEmptyWorkflow('ClickDemo', 'Sequence');
  wf.activities = [
    {
      id: 'c1',
      type: 'UI.Click',
      displayName: 'Click Submit',
      properties: {
        selector: '<target id="btnSubmit" />',
        clickType: 'Single',
        simulateClick: true
      }
    }
  ];
  const xaml = exportWorkflowToXaml(wf);
  assert.ok(xaml.includes('uia:NClick'));
  assert.ok(xaml.includes('webctrl') || xaml.includes('btnSubmit'));
  assert.ok(xaml.includes('<html') || xaml.includes('Selector='));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-win-'));
  for (const file of generateREFrameworkProject('WinRef')) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }
  const exported = exportToStudioWebProject(dir);
  const exportedManifest = JSON.parse(
    fs.readFileSync(path.join(exported.targetDir, 'project.json'), 'utf8')
  ) as { targetFramework: string; runtimeOptions: { netCore: { targetFramework: string } } };
  assert.strictEqual(exportedManifest.targetFramework, 'Windows');
  assert.ok(exportedManifest.runtimeOptions.netCore.targetFramework.includes('windows'));

  const lcsManifest = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')) as {
    uipathTargetFramework?: string;
  };
  assert.strictEqual(lcsManifest.uipathTargetFramework, 'Windows');

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(exported.targetDir, { recursive: true, force: true });
  console.log('windowsTarget.test.ts: all assertions passed');
}

run();
