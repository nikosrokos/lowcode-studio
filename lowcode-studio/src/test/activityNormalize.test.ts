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

  console.log('activityNormalize.test.ts OK');
}

run();
