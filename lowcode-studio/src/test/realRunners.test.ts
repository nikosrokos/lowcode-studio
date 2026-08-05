import assert from 'assert';
import * as http from 'http';
import { AddressInfo } from 'net';
import {
  dryRunWorkflow,
  dryRunWorkflowAsync
} from '../commands/simulator';
import { isHostAllowed, isPrivateOrLocalHost } from '../interop/realRunners';
import { readDryRunSettings } from '../util/dryRunSettings';
import { WorkflowDocument } from '../models/workflow';

function httpDoc(url: string): WorkflowDocument {
  return {
    schemaVersion: '1.0',
    name: 'HttpDemo',
    type: 'Sequence',
    variables: [],
    arguments: [],
    activities: [
      {
        id: 'h1',
        type: 'Messaging.HttpRequest',
        displayName: 'HTTP',
        properties: {
          method: 'GET',
          url: `"${url}"`,
          result: 'response',
          statusCode: 'status'
        }
      }
    ]
  };
}

function pythonDoc(scopePath: string, code: string): WorkflowDocument {
  return {
    schemaVersion: '1.0',
    name: 'PyDemo',
    type: 'Sequence',
    variables: [],
    arguments: [],
    activities: [
      {
        id: 'scope',
        type: 'Python.PythonScope',
        displayName: 'Python Scope',
        properties: { path: scopePath, target: 'x64' },
        children: [
          {
            id: 'run',
            type: 'Python.RunScript',
            displayName: 'Run',
            properties: { code, result: 'pythonResult' }
          }
        ]
      }
    ]
  };
}

async function withLocalServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  fn: (url: string) => Promise<void>
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${addr.port}/ok`;
  try {
    await fn(url);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

async function run(): Promise<void> {
  assert.strictEqual(isHostAllowed('api.example.com', ['example.com']), true);
  assert.strictEqual(isHostAllowed('evil.com', ['example.com']), false);
  assert.strictEqual(isHostAllowed('api.example.com', []), false);
  assert.ok(isPrivateOrLocalHost('127.0.0.1'));
  assert.ok(isPrivateOrLocalHost('localhost'));

  const settings = readDryRunSettings({
    get<T>(key: string, def: T): T {
      if (key === 'dryRun.realHttp') return true as T;
      if (key === 'dryRun.httpAllowHosts') return ['example.com'] as T;
      return def;
    }
  });
  assert.strictEqual(settings.realHttp, true);
  assert.deepStrictEqual(settings.httpAllowHosts, ['example.com']);

  // Allow-list miss → simulated default body, warning
  const miss = await dryRunWorkflowAsync(httpDoc('https://api.example.com/v1'), {
    realHttp: true,
    httpAllowHosts: ['other.com']
  });
  assert.strictEqual(miss.ok, true);
  assert.ok(
    miss.warnings.some((w) => /not in allow list/i.test(w)),
    miss.warnings.join('; ')
  );
  assert.deepStrictEqual((miss.variables.response as { status: number }).status, 200);

  // Fixture wins over real HTTP
  await withLocalServer(
    (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ from: 'server' }));
    },
    async (url) => {
      const host = new URL(url).hostname;
      const result = await dryRunWorkflowAsync(httpDoc(url), {
        realHttp: true,
        httpAllowHosts: [host, '127.0.0.1'],
        fixtures: {
          http: {
            h1: { status: 201, body: { from: 'fixture' } }
          }
        }
      });
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.variables.response, {
        status: 201,
        body: { from: 'fixture' }
      });
      assert.ok(!result.log.some((l) => /Real HTTP/.test(l)));
    }
  );

  // Real HTTP against allow-listed local server
  await withLocalServer(
    (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ from: 'server' }));
    },
    async (url) => {
      const host = new URL(url).hostname;
      const result = await dryRunWorkflowAsync(httpDoc(url), {
        realHttp: true,
        httpAllowHosts: [host, '127.0.0.1']
      });
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.variables.response, {
        status: 200,
        body: { from: 'server' }
      });
      const httpStep = result.steps.find((s) => s.type === 'Messaging.HttpRequest');
      assert.strictEqual(httpStep?.executionKind, 'real');
    }
  );

  // Real Python when interpreter available
  const py = await dryRunWorkflowAsync(pythonDoc('/usr/bin', "print('lcs-real-py')"), {
    realPython: true
  });
  if (py.variables.pythonResult === 'lcs-real-py') {
    assert.strictEqual(py.ok, true);
    const step = py.steps.find((s) => s.type === 'Python.RunScript');
    assert.strictEqual(step?.executionKind, 'real');
  } else {
    // Environment without python — still must not crash; default simulated
    assert.strictEqual(dryRunWorkflow(pythonDoc('', '')).ok, true);
  }

  console.log('realRunners.test.ts OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
