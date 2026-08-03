import assert from 'assert';
import { dryRunWorkflow, toPseudocode, validateWorkflow } from '../commands/simulator';
import { parseWorkflow } from '../models/workflow';

const sample = `{
  "schemaVersion": "1.0",
  "name": "TestFlow",
  "type": "Sequence",
  "variables": [{ "name": "counter", "type": "Int32", "defaultValue": 0 }],
  "arguments": [],
  "activities": [
    {
      "id": "a1",
      "type": "Programming.Assign",
      "displayName": "Assign",
      "properties": { "to": "counter", "value": "3" }
    },
    {
      "id": "a2",
      "type": "System.LogMessage",
      "displayName": "Log Message",
      "properties": { "message": "\\"done\\"", "level": "Info" }
    },
    {
      "id": "a3",
      "type": "ControlFlow.If",
      "displayName": "If",
      "properties": { "condition": "true" },
      "children": [
        {
          "id": "a4",
          "type": "System.LogMessage",
          "displayName": "Then Log",
          "properties": { "message": "\\"yes\\"", "level": "Info" }
        }
      ],
      "elseChildren": []
    }
  ]
}`;

function run(): void {
  const doc = parseWorkflow(sample);
  const issues = validateWorkflow(doc);
  assert.strictEqual(issues.filter((i) => i.severity === 'error').length, 0);

  const result = dryRunWorkflow(doc);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.variables.counter, 3);
  assert.ok(result.log.some((l) => l.includes('done')));
  assert.ok(result.log.some((l) => l.includes('yes')));

  const pseudo = toPseudocode(doc);
  assert.ok(pseudo.includes('counter = 3'));
  assert.ok(pseudo.includes('If (true)'));

  console.log('simulator.test.ts: all assertions passed');
}

run();
