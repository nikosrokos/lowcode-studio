import assert from 'assert';
import {
  normalizeActivityNode,
  normalizeWorkflowDocument
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
    const child = doc.activities[0].children![0];
    assert.strictEqual(child.properties.message, 'x');
    assert.strictEqual(child.properties.level, 'Info');
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

  console.log('activityNormalize.test.ts OK');
}

run();
