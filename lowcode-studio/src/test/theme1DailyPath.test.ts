import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  evaluateReadyForStudioWeb,
  formatReadyForStudioWebReport
} from '../interop/readyForStudioWeb';
import {
  applyProjectAssistScan,
  formatProjectAssistReport,
  scanProjectAssist
} from '../interop/projectAssist';
import {
  resolveInvokeWorkflowPath,
  validateProjectPackages
} from '../interop/packageValidation';
import { parseWorkflow, stringifyWorkflow } from '../models/workflow';

function writeProject(dir: string, name = 'Theme1Gate'): void {
  for (const file of generateREFrameworkProject(name)) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }
}

function run(): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-t1-'));
  writeProject(dir);

  // T1b — .xaml path remaps to sibling .lcs.json
  const processLcs = path.join(dir, 'Framework', 'Process.lcs.json');
  assert.ok(fs.existsSync(processLcs));
  const remapped = resolveInvokeWorkflowPath(dir, 'Framework/Process.xaml', 'Main.lcs.json');
  assert.ok(remapped && remapped.endsWith('Process.lcs.json'), 'xaml→lcs remap');
  assert.ok(!resolveInvokeWorkflowPath(dir, 'Framework/Missing.xaml', 'Main.lcs.json'));

  // Gate on clean REF project (may warn on not-linked / Windows TODO but should not block on packages)
  const gate = evaluateReadyForStudioWeb(dir);
  assert.equal(gate.projectName, 'Theme1Gate');
  assert.ok(formatReadyForStudioWebReport(gate).includes('Ready for Studio Web'));
  assert.ok(gate.items.some((i) => i.id === 'packages' && i.severity === 'ok'));
  assert.ok(gate.items.some((i) => i.id === 'imported' && i.severity === 'ok'));

  // Inject Imported.* → gate blocks
  const process = parseWorkflow(fs.readFileSync(processLcs, 'utf8'));
  process.activities.push({
    id: 'imp1',
    type: 'Imported.MysteryWidget',
    displayName: 'Legacy Mystery',
    properties: {}
  });
  process.activities.push({
    id: 'inv1',
    type: 'REFramework.InvokeWorkflow',
    displayName: 'Broken Invoke',
    properties: { workflowPath: 'Framework/Missing.xaml' }
  });
  // Valid invoke via .xaml alias should NOT warn
  process.activities.push({
    id: 'inv2',
    type: 'REFramework.InvokeWorkflow',
    displayName: 'Good Invoke',
    properties: { workflowPath: 'Framework/Process.xaml' }
  });
  fs.writeFileSync(processLcs, stringifyWorkflow(process), 'utf8');

  const warned = validateProjectPackages(dir);
  assert.ok(warned.warnings.some((w) => w.code === 'imported-placeholder'));
  assert.ok(warned.warnings.some((w) => w.code === 'invoke-missing-file'));
  assert.ok(
    !warned.warnings.some(
      (w) => w.code === 'invoke-missing-file' && w.message.includes('Process.xaml')
    ),
    'Process.xaml should resolve via remap'
  );

  const blocked = evaluateReadyForStudioWeb(dir);
  assert.equal(blocked.ready, false);
  assert.ok(blocked.items.some((i) => i.id === 'imported' && i.severity === 'block'));

  // Project Assist scan (may be empty on REF — inject a VB typo)
  process.activities.push({
    id: 'log1',
    type: 'System.LogMessage',
    displayName: 'Log',
    properties: { message: 'TRim(name)', level: 'Info' }
  });
  fs.writeFileSync(processLcs, stringifyWorkflow(process), 'utf8');

  const scan = scanProjectAssist(dir);
  assert.ok(scan.expressionCount >= 1, 'expected VB repair hit');
  assert.ok(formatProjectAssistReport(scan).includes('Project Assist'));
  const applied = applyProjectAssistScan(scan, { expressions: true, selectors: false });
  assert.ok(applied.appliedFiles.includes('Framework/Process.lcs.json'));
  const after = fs.readFileSync(processLcs, 'utf8');
  assert.ok(after.includes('name.Trim()') || after.includes('.Trim('), 'VB repair applied');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('theme1DailyPath.test.ts: all assertions passed');
}

run();
