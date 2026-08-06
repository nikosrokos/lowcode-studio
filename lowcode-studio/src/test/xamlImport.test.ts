import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { importXaml } from '../interop/xamlImport';
import { exportWorkflowToXaml, exportUiPathProjectJson, normalizeLogLevel, toVbStringArgument, fromVbStringArgument, shouldSkipActivityOnExport, exportDisplayName } from '../interop/xamlExport';
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
  // LogMessage Message must be a VB string literal ["Starting"], not [Starting] or [["Starting"]]
  assert.ok(
    /Message="\[&quot;Starting&quot;\]"/.test(exported) ||
      /Message="\["Starting"\]"/.test(exported),
    `LogMessage Message should be quoted string, got snippet: ${exported.match(/Message="[^"]*"/)?.[0]}`
  );

  assert.strictEqual(normalizeLogLevel('Info'), 'Info');
  assert.strictEqual(normalizeLogLevel('TraceLevel.Info'), 'Info');
  assert.strictEqual(normalizeLogLevel('TraceLevel.Warn'), 'Warn');
  assert.strictEqual(normalizeLogLevel('warning'), 'Warn');
  assert.strictEqual(normalizeLogLevel(''), 'Info');

  assert.strictEqual(toVbStringArgument('12'), '"12"');
  assert.strictEqual(toVbStringArgument('"12"'), '"12"');
  assert.strictEqual(toVbStringArgument('["12"]'), '"12"');
  assert.strictEqual(toVbStringArgument('[["12"]]'), '"12"');
  assert.strictEqual(toVbStringArgument('Starting'), '"Starting"');
  assert.strictEqual(toVbStringArgument('[message]'), 'message');
  assert.strictEqual(fromVbStringArgument('["12"]'), '12');
  assert.strictEqual(fromVbStringArgument('&quot;12&quot;'), '12');
  assert.strictEqual(exportDisplayName('Manual Trigger (imported)'), 'Manual Trigger');
  assert.ok(
    shouldSkipActivityOnExport({
      id: 't1',
      type: 'Imported.ManualTrigger',
      displayName: 'Manual Trigger (imported)',
      properties: {}
    })
  );

  // Round-trip: plain designer text 12 → XAML ["12"] → plain 12
  const logOnly = exportWorkflowToXaml({
    schemaVersion: '1.0',
    name: 'LogProbe',
    type: 'Sequence',
    variables: [],
    arguments: [],
    activities: [
      {
        id: 'l1',
        type: 'System.LogMessage',
        displayName: 'Log',
        properties: { message: '12', level: 'Info' }
      },
      {
        id: 't1',
        type: 'Imported.ManualTrigger',
        displayName: 'Manual Trigger (imported)',
        properties: { hint: 'skip me' }
      }
    ]
  });
  assert.ok(logOnly.includes('Message="[&quot;12&quot;]"'), logOnly);
  assert.ok(!/Manual\s*Trigger/i.test(logOnly), 'Manual Trigger must be skipped on export');
  assert.ok(!/\(imported\)/i.test(logOnly), '(imported) must not appear in exported XAML');

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

  // Nested Sequence among siblings must NOT drop LogMessage / BuildDataTable
  const mixed = importXaml(
    `<?xml version="1.0" encoding="utf-8"?>
<Activity>
  <Sequence DisplayName="Main">
    <ui:LogMessage DisplayName="Log Message" Level="Info" Message="[&quot;hi&quot;]" />
    <ui:BuildDataTable DisplayName="Build Data Table">
      <ui:BuildDataTable.DataTable>
        <OutArgument x:TypeArguments="sd:DataTable">[dt]</OutArgument>
      </ui:BuildDataTable.DataTable>
    </ui:BuildDataTable>
    <Sequence DisplayName="Do">
      <ui:LogMessage DisplayName="Inner Log" Level="Info" Message="[&quot;inner&quot;]" />
    </Sequence>
  </Sequence>
</Activity>`,
    'Mixed'
  );
  const types = mixed.workflow.activities.map((a) => a.type);
  assert.ok(types.includes('System.LogMessage'), 'LogMessage kept beside nested Sequence: ' + types.join(','));
  assert.ok(types.includes('Data.BuildDataTable'), 'BuildDataTable kept: ' + types.join(','));
  assert.ok(types.includes('ControlFlow.Sequence'), 'nested Sequence kept as container: ' + types.join(','));
  const bdt = mixed.workflow.activities.find((a) => a.type === 'Data.BuildDataTable');
  assert.ok(bdt);
  assert.ok(
    bdt!.properties.result === 'dt' || bdt!.properties.columns,
    'BuildDataTable has catalog props, not only note: ' + JSON.stringify(bdt!.properties)
  );

  console.log(
    `xamlImport.test.ts: ok (${workflow.activities.length} activities, ${warnings.length} warnings)`
  );
}

run();
