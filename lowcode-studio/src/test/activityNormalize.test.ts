import assert from 'assert';
import {
  normalizeActivityNode,
  normalizeWorkflowDocument,
  migrateWorkflowDocument,
  rawWorkflowHasMissingIds
} from '../interop/activityNormalize';
import { parseWorkflow, stringifyWorkflow } from '../models/workflow';

function run(): void {
  {
    const node = normalizeActivityNode({
      id: 'a1',
      type: 'System.LogMessage',
      displayName: 'Log Message',
      properties: {
        Message: 'name.toUpperCase()',
        Level: 'TraceLevel.Warn'
      }
    });
    assert.strictEqual(node.properties.message, 'name.toUpperCase()');
    assert.strictEqual(node.properties.level, 'Warn');
    assert.strictEqual(node.properties.Message, undefined);
    assert.strictEqual(node.properties.Level, undefined);
  }

  {
    const node = normalizeActivityNode({
      id: 'a2',
      type: 'Imported.LogMessage',
      displayName: 'Log Message (imported)',
      properties: {
        originalType: 'LogMessage',
        hint: 'placeholder',
        Message: '"hi"'
      }
    });
    assert.strictEqual(node.type, 'System.LogMessage');
    assert.strictEqual(node.properties.message, '"hi"');
    assert.ok(!/\(imported\)/i.test(node.displayName));
  }

  {
    const doc = parseWorkflow(
      stringifyWorkflow({
        schemaVersion: '1.0',
        name: 'T',
        description: '',
        type: 'Sequence',
        variables: [],
        arguments: [],
        activities: [
          {
            id: 'root',
            type: 'ControlFlow.Sequence',
            displayName: 'Seq',
            properties: {},
            children: [
              {
                id: 'child',
                type: 'System.LogMessage',
                displayName: 'Log',
                properties: { Message: 'x', Level: 'information' }
              }
            ]
          }
        ],
        metadata: {}
      })
    );
    // Singleton Sequence unwraps so Log Message is a top-level click target
    assert.strictEqual(doc.activities.length, 1);
    assert.strictEqual(doc.activities[0].type, 'System.LogMessage');
    assert.strictEqual(doc.activities[0].properties.message, 'x');
    assert.strictEqual(doc.activities[0].properties.level, 'Info');
  }

  {
    const node = normalizeActivityNode({
      id: 'bdt',
      type: 'Data.BuildDataTable',
      displayName: 'Build Data Table',
      properties: { Columns: 'A,B', Result: 'dtOrders', note: 'Imported from BuildDataTable' }
    });
    assert.strictEqual(node.properties.columns, 'A,B');
    assert.strictEqual(node.properties.result, 'dtOrders');
    assert.strictEqual(node.properties.Columns, undefined);
  }

  {
    const once = normalizeWorkflowDocument({
      schemaVersion: '1.0',
      name: 'T',
      description: '',
      type: 'Sequence',
      variables: [],
      arguments: [],
      activities: [
        {
          id: 'a',
          type: 'Programming.Assign',
          displayName: 'Assign',
          properties: { To: 'x', Value: '1' }
        }
      ],
      metadata: {}
    });
    const twice = normalizeWorkflowDocument(JSON.parse(JSON.stringify(once)));
    assert.deepStrictEqual(twice.activities[0].properties, {
      to: 'x',
      value: '1'
    });
  }

  {
    const node = normalizeActivityNode({
      id: '',
      type: 'System.LogMessage',
      displayName: 'Log Message',
      properties: { Message: '"hi"', Level: 'Info' }
    } as any);
    assert.ok(String(node.id || '').trim(), 'missing id is healed');
    assert.strictEqual(node.properties.message, '"hi"');
  }

  {
    const doc = parseWorkflow(
      JSON.stringify({
        schemaVersion: '1.0',
        name: 'NoIds',
        type: 'Sequence',
        variables: [],
        arguments: [],
        activities: [
          {
            type: 'System.LogMessage',
            displayName: 'Log Message',
            properties: { Message: '"from studio web"', Level: 'Info' }
          }
        ],
        metadata: {}
      })
    );
    assert.ok(doc.activities[0].id, 'parseWorkflow assigns id when Studio Web omitted it');
    assert.strictEqual(doc.activities[0].properties.message, '"from studio web"');
  }

  {
    assert.strictEqual(
      rawWorkflowHasMissingIds(
        JSON.stringify({
          schemaVersion: '1.0',
          activities: [{ type: 'System.LogMessage', displayName: 'Log', properties: {} }]
        })
      ),
      true
    );
    const wrapped = {
      schemaVersion: '1.0' as const,
      name: 'W',
      description: '',
      type: 'Sequence' as const,
      variables: [],
      arguments: [],
      activities: [
        {
          id: 'seq1',
          type: 'ControlFlow.Sequence',
          displayName: 'Sequence',
          properties: {},
          children: [
            {
              id: 'log1',
              type: 'System.LogMessage',
              displayName: 'Log Message',
              properties: { Message: '"x"', Level: 'Info' }
            }
          ]
        }
      ],
      metadata: {}
    };
    const { doc, changed } = migrateWorkflowDocument(wrapped as any);
    assert.ok(changed, 'singleton Sequence unwrap changes doc');
    assert.strictEqual(doc.activities[0].type, 'System.LogMessage');
    assert.strictEqual(doc.activities[0].properties.message, '"x"');
  }

  {
    const node = normalizeActivityNode({
      id: 'expr',
      type: 'System.LogMessage',
      displayName: 'Log Message',
      properties: {
        message: { ExpressionText: '"from object"' },
        level: 'Info'
      }
    } as any);
    assert.strictEqual(node.properties.message, '"from object"');
  }

  // SW reopen: migrate RAW disk JSON (no ids, PascalCase, ExpressionText, Sequence wrap)
  {
    const rawText = JSON.stringify({
      schemaVersion: '1.0',
      name: 'Main',
      type: 'Sequence',
      variables: [],
      activities: [
        {
          type: 'ControlFlow.Sequence',
          displayName: 'Main',
          properties: {},
          children: [
            {
              type: 'System.LogMessage',
              displayName: 'Log Message',
              properties: {
                Message: { ExpressionText: '"hello from SW"' },
                Level: 'Info'
              }
            }
          ]
        }
      ]
    });
    assert.ok(rawWorkflowHasMissingIds(rawText), 'SW pull often omits ids');
    const raw = JSON.parse(rawText);
    const { doc, changed } = migrateWorkflowDocument(raw);
    assert.ok(changed, 'raw SW migrate must report changed');
    assert.strictEqual(doc.activities.length, 1);
    assert.strictEqual(doc.activities[0].type, 'System.LogMessage');
    assert.ok(String(doc.activities[0].id || '').trim(), 'healed id');
    assert.strictEqual(doc.activities[0].properties.message, '"hello from SW"');
    assert.strictEqual(doc.activities[0].properties.Message, undefined);
    // parseWorkflow first then migrate would hide the change — raw path is required
    const alreadyParsed = parseWorkflow(rawText);
    const second = migrateWorkflowDocument(alreadyParsed);
    assert.strictEqual(
      second.changed,
      false,
      'parseWorkflow-first migrate is a no-op (must migrate raw disk JSON instead)'
    );
  }

  // Excel / Orchestrator PascalCase + ExpressionText round-trip (SW-edited props)
  {
    const node = normalizeActivityNode({
      id: 'ex1',
      type: 'Excel.ReadRange',
      displayName: 'Read Range',
      properties: {
        WorkbookPath: { ExpressionText: '"Data/in.xlsx"' },
        SheetName: 'Sheet1',
        Result: 'dt'
      }
    });
    assert.strictEqual(node.properties.workbookPath, '"Data/in.xlsx"');
    assert.strictEqual(node.properties.WorkbookPath, undefined);
    assert.strictEqual(node.properties.result, 'dt');

    const orch = normalizeActivityNode({
      id: 'oq1',
      type: 'Orchestrator.AddQueueItem',
      displayName: 'Add Queue Item',
      properties: {
        QueueName: 'MainQueue',
        ItemInformation: { ExpressionText: '{}' }
      }
    });
    assert.strictEqual(orch.properties.queueName, 'MainQueue');
    assert.strictEqual(orch.properties.itemInformation, '{}');
  }

  // Mutate after migrate → stringify → parse must keep edits (SW reopen Properties)
  {
    const rawText = JSON.stringify({
      schemaVersion: '1.0',
      name: 'Main',
      type: 'Sequence',
      variables: [],
      activities: [
        {
          type: 'System.LogMessage',
          displayName: 'Log Message',
          properties: {
            Message: { ExpressionText: '"from SW"' },
            Level: 'Info'
          }
        }
      ]
    });
    const raw = JSON.parse(rawText);
    const { doc } = migrateWorkflowDocument(raw);
    doc.activities[0].properties.message = '"edited in LCS"';
    const round = parseWorkflow(stringifyWorkflow(doc));
    assert.strictEqual(round.activities[0].properties.message, '"edited in LCS"');
    assert.ok(String(round.activities[0].id || '').trim());
  }

  // Non-string ids must be healed (break walkFind / Properties select)
  {
    const rawText = JSON.stringify({
      schemaVersion: '1.0',
      name: 'Main',
      type: 'Sequence',
      variables: [],
      activities: [
        {
          id: { ExpressionText: 'bad' },
          type: 'System.LogMessage',
          displayName: 'Log Message',
          properties: { Message: '"x"', Level: 'Info' }
        }
      ]
    });
    assert.ok(rawWorkflowHasMissingIds(rawText), 'object id counts as missing');
    const raw = JSON.parse(rawText);
    const { doc, changed } = migrateWorkflowDocument(raw);
    assert.ok(changed);
    assert.strictEqual(typeof doc.activities[0].id, 'string');
    assert.ok(doc.activities[0].id.trim());
    assert.strictEqual(doc.activities[0].properties.message, '"x"');
  }

  console.log('activityNormalize.test.ts OK');
}

run();
