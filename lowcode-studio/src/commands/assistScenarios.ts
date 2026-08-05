import { DryRunScenario, ScenariosFile, upsertScenario } from './refDryRun';

/**
 * F1 Assist — heuristic scenario generator from a short process description.
 * No LLM: keyword → templates that match DryRunScenario schema.
 */
export function generateScenariosFromDescription(
  description: string,
  projectName: string
): DryRunScenario[] {
  const text = String(description || '').toLowerCase();
  const generated: DryRunScenario[] = [];
  const stamp = projectName || 'project';

  const wantsQueue =
    /queue|transaction|reframework|orchestrator|gettransaction/.test(text) || !text.trim();
  const wantsHttp = /http|api|rest|webhook|endpoint/.test(text);
  const wantsUi = /login|browser|click|type into|selector|ui |web /.test(text);
  const wantsExcel = /excel|xlsx|spreadsheet|datatable|csv/.test(text);
  const wantsEmpty = /empty|zero|no item|no transaction/.test(text);
  const wantsFail = /fail|error|retry|exception/.test(text);

  if (wantsQueue) {
    generated.push({
      name: 'assist-happy-path',
      description: `Assist: happy path from “${trimDesc(description)}” (${stamp})`,
      variables: {
        MaxTransactions: 3,
        MaxRetryNumber: 2,
        TransactionNumber: 1,
        RetryNumber: 0
      },
      expect: {
        ok: true,
        minSteps: 4,
        logIncludes: ['InvokeWorkflow']
      }
    });
  }

  if (wantsEmpty || wantsQueue) {
    generated.push({
      name: 'assist-no-transactions',
      description: `Assist: empty queue / MaxTransactions=0 (${stamp})`,
      variables: {
        MaxTransactions: 0,
        TransactionNumber: 1,
        TransactionItem: null
      },
      expect: {
        ok: true,
        variables: { TransactionItem: null }
      }
    });
  }

  if (wantsHttp) {
    generated.push({
      name: 'assist-http-ok',
      description: `Assist: HTTP 200 fixture (${stamp})`,
      fixtures: {
        http: {
          'api.example.com': { status: 200, body: { ok: true, source: 'assist' } }
        }
      },
      expect: {
        ok: true,
        logIncludes: ['HTTP']
      }
    });
    generated.push({
      name: 'assist-http-error',
      description: `Assist: HTTP 500 fixture (${stamp})`,
      fixtures: {
        http: {
          'api.example.com': { status: 500, body: { ok: false, error: 'assist-simulated' } }
        }
      },
      expect: {
        ok: true,
        logIncludes: ['HTTP']
      }
    });
  }

  if (wantsUi) {
    generated.push({
      name: 'assist-ui-fixtures',
      description: `Assist: UI text / element fixtures for login-style flows (${stamp})`,
      fixtures: {
        uiText: { label: 'Welcome', extractedText: 'Welcome' },
        elementExists: { exists: true }
      },
      expect: { ok: true, minSteps: 1 }
    });
  }

  if (wantsExcel) {
    generated.push({
      name: 'assist-table-fixture',
      description: `Assist: sample DataTable fixture (${stamp})`,
      fixtures: {
        tables: {
          dt: {
            columns: ['Id', 'Name'],
            rows: [
              [1, 'Alpha'],
              [2, 'Beta']
            ]
          }
        }
      },
      expect: { ok: true }
    });
  }

  if (wantsFail) {
    generated.push({
      name: 'assist-expect-failure',
      description: `Assist: expects dry-run errors (tune for your Throw path) (${stamp})`,
      variables: { MaxTransactions: 1 },
      expect: { ok: false }
    });
  }

  if (!generated.length) {
    generated.push({
      name: 'assist-smoke',
      description: `Assist smoke from “${trimDesc(description)}” (${stamp})`,
      variables: { MaxTransactions: 1 },
      expect: { ok: true, minSteps: 1 }
    });
  }

  return generated;
}

export function applyGeneratedScenarios(
  file: ScenariosFile,
  generated: DryRunScenario[]
): ScenariosFile {
  let next = file;
  for (const s of generated) {
    next = upsertScenario(next, s);
  }
  return next;
}

function trimDesc(description: string): string {
  const t = String(description || '').trim().replace(/\s+/g, ' ');
  if (!t) {
    return 'process';
  }
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
}
