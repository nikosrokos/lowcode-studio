import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { importXaml } from '../interop/xamlImport';
import { exportWorkflowToXaml } from '../interop/xamlExport';
import { lcsTypeFromXamlName } from '../interop/activityMap';
import { ACTIVITY_CATALOG } from '../models/activities';
import { dryRunWorkflow, classifyExecutionKind } from '../commands/simulator';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  linkStudioWebLocalWorkspace,
  SYNC_TRASH_DIR
} from '../interop/studioWebLocal';
import { writeUiPathProjectToDir } from '../interop/studioProject';
import { stringifyWorkflow, parseWorkflow } from '../models/workflow';

function fixture(name: string): string {
  const fromOut = path.join(__dirname, 'fixtures', name);
  const fromSrc = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', name);
  return fs.readFileSync(fs.existsSync(fromOut) ? fromOut : fromSrc, 'utf8');
}

function run(): void {
  const expected: Array<[string, string]> = [
    ['Continue', 'ControlFlow.Continue'],
    ['MoveFile', 'System.MoveFile'],
    ['RenameFile', 'System.RenameFile'],
    ['Matches', 'System.Matches'],
    ['IsMatch', 'System.IsMatch'],
    ['Replace', 'System.Replace'],
    ['KillProcess', 'System.KillProcess'],
    ['MergeDataTable', 'Data.MergeDataTable'],
    ['RemoveDataRow', 'Data.RemoveDataRow'],
    ['RemoveDataColumn', 'Data.RemoveDataColumn'],
    ['GetRowItem', 'Data.GetRowItem'],
    ['UpdateRowItem', 'Data.UpdateRowItem'],
    ['WaitQueueItem', 'Orchestrator.WaitQueueItem'],
    ['GetCredential', 'Orchestrator.GetCredential'],
    ['GetOrchestratorCredential', 'Orchestrator.GetCredential'],
    ['SendHotkey', 'UI.SendHotkey'],
    ['KeyboardShortcuts', 'UI.SendHotkey'],
    ['NKeyboardShortcuts', 'UI.SendHotkey']
  ];
  for (const [xaml, lcs] of expected) {
    assert.strictEqual(lcsTypeFromXamlName(xaml), lcs, xaml);
    assert.ok(
      ACTIVITY_CATALOG.some((a) => a.type === lcs),
      `missing catalog ${lcs}`
    );
    assert.notStrictEqual(classifyExecutionKind(lcs), 'unsupported', lcs);
  }

  const { workflow, warnings } = importXaml(fixture('deeper-import.xaml'), 'Deeper');
  const types = workflow.activities.map((a) => a.type);
  assert.ok(!types.some((t) => t.startsWith('Imported.')), `Imported: ${types.join(',')}`);
  assert.ok(types.includes('ControlFlow.Continue'));
  assert.ok(types.includes('System.MoveFile'));
  assert.ok(types.includes('System.RenameFile'));
  assert.ok(types.includes('System.Matches'));
  assert.ok(types.includes('System.IsMatch'));
  assert.ok(types.includes('System.Replace'));
  assert.ok(types.includes('System.KillProcess'));
  assert.ok(types.includes('Data.MergeDataTable'));
  assert.ok(types.includes('Data.RemoveDataRow'));
  assert.ok(types.includes('Data.RemoveDataColumn'));
  assert.ok(types.includes('Data.GetRowItem'));
  assert.ok(types.includes('Data.UpdateRowItem'));
  assert.ok(types.includes('Orchestrator.WaitQueueItem'));
  assert.ok(types.includes('Orchestrator.GetCredential'));
  assert.ok(types.includes('UI.SendHotkey'));
  assert.ok(!warnings.some((w) => /Unknown activity/i.test(w.message)));

  const exported = exportWorkflowToXaml(workflow);
  assert.ok(exported.includes('<Continue'));
  assert.ok(exported.includes('ui:MoveFile'));
  assert.ok(exported.includes('ui:RenameFile'));
  assert.ok(exported.includes('ui:Matches'));
  assert.ok(exported.includes('ui:IsMatch'));
  assert.ok(exported.includes('ui:Replace'));
  assert.ok(exported.includes('ui:KillProcess'));
  assert.ok(exported.includes('ui:MergeDataTable'));
  assert.ok(exported.includes('ui:WaitQueueItem'));
  assert.ok(exported.includes('ui:GetCredential'));
  assert.ok(exported.includes('uia:NKeyboardShortcuts'));

  const dry = dryRunWorkflow({
    ...workflow,
    variables: [
      { name: 'text', type: 'String', defaultValue: 'ab 12' },
      { name: 'dt', type: 'DataTable', defaultValue: { columns: ['Id'], rows: [['1'], ['2']] } },
      {
        name: 'dtSource',
        type: 'DataTable',
        defaultValue: { columns: ['Id'], rows: [['3']] }
      }
    ]
  });
  assert.strictEqual(dry.ok, true, dry.log.join('\n'));
  assert.ok(Array.isArray(dry.variables.matches));
  assert.strictEqual(dry.variables.isMatch, true);

  // Trash backups must never be pushed into Studio Web as workflows
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-min-files-'));
  const lcsDir = path.join(root, 'Proj');
  for (const file of generateREFrameworkProject('MinFiles')) {
    const full = path.join(lcsDir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }
  const trashRel = path.join(SYNC_TRASH_DIR, 'stamp1', 'Main.lcs.json');
  const trashAbs = path.join(lcsDir, trashRel);
  fs.mkdirSync(path.dirname(trashAbs), { recursive: true });
  const main = parseWorkflow(fs.readFileSync(path.join(lcsDir, 'Main.lcs.json'), 'utf8'));
  fs.writeFileSync(trashAbs, stringifyWorkflow(main), 'utf8');

  const swOut = path.join(root, 'sw-out');
  const exportedSw = writeUiPathProjectToDir(lcsDir, swOut, {
    writeReadme: false,
    targetFramework: 'Portable'
  });
  assert.ok(
    !exportedSw.files.some((f) => f.includes('.lcs-sync-trash') || f.includes('stamp1')),
    `trash leaked into SW: ${exportedSw.files.join(',')}`
  );
  assert.ok(!fs.existsSync(path.join(swOut, SYNC_TRASH_DIR)));

  const linked = linkStudioWebLocalWorkspace(lcsDir, {
    mode: 'create',
    targetDir: path.join(root, 'workspace'),
    solutionName: 'MinFilesSol'
  });
  const guide = path.join(linked.link.solutionDir, 'OPEN_IN_STUDIO_WEB_LOCAL.md');
  assert.ok(fs.existsSync(guide));
  const first = fs.readFileSync(guide, 'utf8');
  fs.writeFileSync(guide, first + '\n# custom note\n', 'utf8');
  // Re-link / adopt path should not clobber a customized guide
  linkStudioWebLocalWorkspace(lcsDir, {
    mode: 'create',
    targetDir: path.join(root, 'workspace'),
    solutionName: 'MinFilesSol'
  });
  assert.ok(fs.readFileSync(guide, 'utf8').includes('# custom note'));

  // Portable SW project stays lean: no README inside RPA folder
  assert.ok(!fs.existsSync(path.join(linked.targetDir, 'README_STUDIO_WEB.md')));
  assert.ok(!fs.existsSync(path.join(linked.targetDir, 'activities.custom.json')));
  assert.ok(!fs.existsSync(path.join(linked.targetDir, 'Data', 'Test', 'scenarios.json')));

  fs.rmSync(root, { recursive: true, force: true });
  console.log('deeperImportMap.test.ts OK');
}

run();
