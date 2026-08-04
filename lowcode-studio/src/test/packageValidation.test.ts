import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  formatPackageValidationReport,
  validateProjectPackages
} from '../interop/packageValidation';
import { parseWorkflow, stringifyWorkflow } from '../models/workflow';

function run(): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-pkg-'));
  for (const file of generateREFrameworkProject('PkgValidate')) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }

  const ok = validateProjectPackages(dir);
  assert.ok(ok.workflowCount >= 1);
  assert.ok(Object.keys(ok.dependencies).includes('UiPath.System.Activities'));
  assert.ok(Object.keys(ok.dependencies).includes('UiPath.UIAutomation.Activities'));
  const report = formatPackageValidationReport(ok);
  assert.ok(report.includes('Package validation'));
  assert.ok(report.includes('Resolved NuGet packages'));

  // Inject an Imported.* placeholder and a broken Invoke path
  const processPath = path.join(dir, 'Framework', 'Process.lcs.json');
  const process = parseWorkflow(fs.readFileSync(processPath, 'utf8'));
  process.activities.push({
    id: 'imp1',
    type: 'Imported.Click',
    displayName: 'Legacy Click',
    properties: { selector: '', hint: 'Imported.Click' }
  });
  process.activities.push({
    id: 'inv1',
    type: 'REFramework.InvokeWorkflow',
    displayName: 'Broken Invoke',
    properties: { workflowPath: 'Framework/Missing.lcs.json' }
  });
  fs.writeFileSync(processPath, stringifyWorkflow(process), 'utf8');

  const warned = validateProjectPackages(dir);
  assert.ok(warned.warnings.some((w) => w.code === 'imported-placeholder'));
  assert.ok(warned.warnings.some((w) => w.code === 'invoke-missing-file'));
  assert.ok(warned.warnings.some((w) => w.severity === 'warning'));

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('packageValidation.test.ts: all assertions passed');
}

run();
