import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { importXaml } from '../interop/xamlImport';
import { exportWorkflowToXaml, exportUiPathProjectJson, normalizeLogLevel } from '../interop/xamlExport';
import { validateWorkflow, dryRunWorkflow } from '../commands/simulator';
import {
  collectActivityTypes,
  resolveUiPathDependencies
} from '../interop/uipathDependencies';

function run(): void {
  const fixture = path.join(__dirname, 'fixtures', 'sample.xaml');
  // When running from out/test, fixtures are not copied — load from src
  const srcFixture = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'sample.xaml');
  const xamlPath = fs.existsSync(fixture) ? fixture : srcFixture;
  const xaml = fs.readFileSync(xamlPath, 'utf8');

  const { workflow, warnings } = importXaml(xaml, 'Main');
  assert.strictEqual(workflow.type, 'Sequence');
  assert.ok(workflow.variables.some((v) => v.name === 'message'));
  assert.ok(workflow.variables.some((v) => v.name === 'counter'));
  assert.ok(workflow.activities.some((a) => a.type === 'System.LogMessage'));
  assert.ok(workflow.activities.some((a) => a.type === 'Programming.Assign'));
  assert.ok(workflow.activities.some((a) => a.type === 'ControlFlow.If'));
  assert.ok(workflow.activities.some((a) => a.type === 'REFramework.InvokeWorkflow'));
  assert.ok(workflow.activities.some((a) => a.type === 'System.Delay'));

  const errors = validateWorkflow(workflow).filter((i) => i.severity === 'error');
  assert.strictEqual(errors.length, 0, errors.map((e) => e.message).join('; '));

  const dry = dryRunWorkflow(workflow);
  assert.strictEqual(dry.ok, true);

  // Custom color round-trip via JSON shape
  workflow.activities[0].color = '#F59E0B';
  assert.strictEqual(workflow.activities[0].color, '#F59E0B');

  const exported = exportWorkflowToXaml(workflow);
  assert.ok(exported.includes('ui:LogMessage'));
  assert.ok(exported.includes('<Sequence'));
  assert.ok(exported.includes('Variable'));
  // Studio Web rejects mc:Ignorable prefixes that are not xmlns-declared (e.g. bare "sapc")
  assert.ok(
    /mc:Ignorable="sap sap2010"/.test(exported),
    'Ignorable must list declared sap/sap2010 prefixes only'
  );
  assert.ok(!/\bsapc\b/.test(exported), 'sapc must not appear without xmlns:sapc');
  assert.ok(exported.includes('xmlns:sap='));
  assert.ok(exported.includes('xmlns:sap2010='));
  assert.ok(
    /Level="Info"/.test(exported),
    'Studio Web rejects Level="TraceLevel.Info" — emit bare enum name'
  );
  assert.ok(!/TraceLevel\./.test(exported), 'TraceLevel. prefix must not appear in Level');

  assert.strictEqual(normalizeLogLevel('Info'), 'Info');
  assert.strictEqual(normalizeLogLevel('TraceLevel.Info'), 'Info');
  assert.strictEqual(normalizeLogLevel('TraceLevel.Warn'), 'Warn');
  assert.strictEqual(normalizeLogLevel('warning'), 'Warn');
  assert.strictEqual(normalizeLogLevel(''), 'Info');

  const deps = resolveUiPathDependencies({
    activityTypes: collectActivityTypes([workflow]),
    preserved: { 'UiPath.System.Activities': '24.10.7' },
    includeBaseline: true
  });
  assert.ok(deps['UiPath.System.Activities']);
  assert.ok(deps['UiPath.UIAutomation.Activities']);
  assert.strictEqual(deps['UiPath.System.Activities'], '[24.10.7]');

  // HTTP activity should pull WebAPI package
  const withHttp = resolveUiPathDependencies({
    activityTypes: ['Messaging.HttpRequest', 'Messaging.SendEmail'],
    includeBaseline: true
  });
  assert.ok(withHttp['UiPath.WebAPI.Activities']);
  assert.ok(withHttp['UiPath.Mail.Activities']);

  const projectJson = exportUiPathProjectJson({
    name: 'Demo',
    main: 'Main.xaml',
    dependencies: deps
  });
  const parsed = JSON.parse(projectJson) as {
    targetFramework: string;
    main: string;
    dependencies: Record<string, string>;
  };
  assert.strictEqual(parsed.targetFramework, 'Windows');
  assert.strictEqual(
    (parsed as { runtimeOptions?: { netCore?: { targetFramework?: string } } }).runtimeOptions
      ?.netCore?.targetFramework,
    'net8.0-windows'
  );
  assert.strictEqual(parsed.main, 'Main.xaml');
  assert.ok(parsed.dependencies['UiPath.System.Activities']);

  // Re-import exported XAML still parses
  const again = importXaml(exported, 'RoundTrip');
  assert.ok(again.workflow.activities.length > 0);

  console.log(
    `xamlImport.test.ts: ok (${workflow.activities.length} activities, ${warnings.length} warnings)`
  );
}

run();
