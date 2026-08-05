import {
  ActivityNode,
  VariableType,
  WorkflowDocument,
  WorkflowVariable,
  createProjectManifest,
  newId,
  stringifyWorkflow
} from '../models/workflow';
import {
  collectActivityTypes,
  resolveUiPathDependencies
} from '../interop/uipathDependencies';
import { GeneratedFile } from './reframework';

export type BlueprintId =
  | 'web-scrape-excel'
  | 'login-extract-email'
  | 'api-datatable-process'
  | 'queue-orchestrator';

export interface RobotBlueprint {
  id: BlueprintId;
  label: string;
  description: string;
  detail: string;
  defaultProjectName: string;
}

export const ROBOT_BLUEPRINTS: RobotBlueprint[] = [
  {
    id: 'web-scrape-excel',
    label: 'Web scrape → Excel',
    description: 'Open browser → Extract Table → write Excel',
    detail: 'Use Application/Browser, Extract Table Data, Excel Write Range',
    defaultProjectName: 'WebScrapeExcel'
  },
  {
    id: 'login-extract-email',
    label: 'Login → Extract table → Email',
    description: 'Login form → extract grid → email summary',
    detail: 'Type Into / Click login, Extract Table Data, Send Email',
    defaultProjectName: 'LoginExtractEmail'
  },
  {
    id: 'api-datatable-process',
    label: 'API → DataTable → Process',
    description: 'HTTP GET → JSON → table → for each row',
    detail: 'HttpRequest, Deserialize JSON, Build Data Table, For Each Row',
    defaultProjectName: 'ApiDataTableProcess'
  },
  {
    id: 'queue-orchestrator',
    label: 'Queue → Process → Set Status',
    description: 'Get Transaction Item → process → Set Transaction Status',
    detail: 'Orchestrator queue/asset activities with scenario fixtures',
    defaultProjectName: 'QueueOrchestrator'
  }
];

export function getBlueprint(id: string): RobotBlueprint | undefined {
  return ROBOT_BLUEPRINTS.find((b) => b.id === id);
}

/**
 * One-click robot scaffolds beyond REFramework.
 * Each blueprint is a Windows-target Sequence with scenarios + fixtures.
 */
export function generateBlueprintProject(
  projectName: string,
  blueprintId: BlueprintId
): GeneratedFile[] {
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) {
    throw new Error(`Unknown blueprint: ${blueprintId}`);
  }

  const main = buildMainWorkflow(projectName, blueprintId);
  const activityTypes = collectActivityTypes([main]);
  const scenarios = buildScenarios(projectName, blueprintId);

  const files: GeneratedFile[] = [
    {
      relativePath: 'project.json',
      content:
        JSON.stringify(
          {
            ...createProjectManifest(projectName, 'Main.lcs.json', ['Main.lcs.json'], 'blueprint'),
            blueprintId,
            description: `${projectName} — ${blueprint.label} blueprint (Windows target)`,
            uipathDependencies: resolveUiPathDependencies({
              activityTypes,
              includeBaseline: true
            })
          },
          null,
          2
        ) + '\n'
    },
    {
      relativePath: 'Main.lcs.json',
      content: stringifyWorkflow(main)
    },
    {
      relativePath: 'Data/Test/scenarios.json',
      content: JSON.stringify(scenarios, null, 2) + '\n'
    },
    {
      relativePath: 'README.md',
      content: buildReadme(projectName, blueprint)
    }
  ];

  if (blueprintId === 'web-scrape-excel') {
    files.push({
      relativePath: 'Data/Output/.gitkeep',
      content: ''
    });
  }

  return files;
}

function buildMainWorkflow(projectName: string, id: BlueprintId): WorkflowDocument {
  const now = new Date().toISOString();
  const { variables, activities } = buildBody(id);
  return {
    schemaVersion: '1.0',
    name: 'Main',
    description: `${projectName} — ${getBlueprint(id)?.label}`,
    type: 'Sequence',
    variables,
    arguments: [],
    activities,
    metadata: {
      createdAt: now,
      updatedAt: now,
      template: id
    }
  };
}

function buildBody(id: BlueprintId): {
  variables: WorkflowVariable[];
  activities: ActivityNode[];
} {
  switch (id) {
    case 'web-scrape-excel':
      return webScrapeExcel();
    case 'login-extract-email':
      return loginExtractEmail();
    case 'api-datatable-process':
      return apiDataTableProcess();
    case 'queue-orchestrator':
      return queueOrchestrator();
  }
}

function webScrapeExcel(): {
  variables: WorkflowVariable[];
  activities: ActivityNode[];
} {
  const extractedTable = 'extractedTable';
  return {
    variables: [
      v('pageUrl', 'String', '"https://example.com/orders"'),
      v(extractedTable, 'DataTable', null),
      v('outputPath', 'String', '"Data/Output/orders.xlsx"')
    ],
    activities: [
      log('"Starting web scrape → Excel"', 'Info'),
      act(
        'UI.UseApplicationBrowser',
        'Use Browser — Orders page',
        {
          mode: 'Browser',
          urlOrPath: 'https://example.com/orders',
          browserType: 'Chrome',
          open: 'IfNotOpen',
          close: 'Never',
          selector: "<html app='chrome.exe' title='*Orders*' />"
        },
        [
          act('UI.WaitElement', 'Wait for table', {
            selector:
              "<html app='chrome.exe' title='*Orders*' />\n<webctrl tag='TABLE' />",
            action: 'Appear',
            timeoutMs: 30000
          }),
          act('UI.ExtractTableData', 'Extract orders table', {
            selector:
              "<html app='chrome.exe' title='*Orders*' />\n<webctrl tag='TABLE' />",
            result: extractedTable,
            includeHeaders: true,
            maxResults: 50,
            smartExtraction: true,
            extractionMetadata:
              '{"Columns":[{"Name":"OrderId"},{"Name":"Customer"},{"Name":"Amount"}],"SmartExtraction":true}'
          })
        ]
      ),
      act('Excel.WriteRange', 'Write Excel output', {
        workbookPath: 'Data/Output/orders.xlsx',
        sheetName: 'Orders',
        data: extractedTable
      }),
      log('"Wrote scraped table to Data/Output/orders.xlsx"', 'Info')
    ]
  };
}

function loginExtractEmail(): {
  variables: WorkflowVariable[];
  activities: ActivityNode[];
} {
  const extractedTable = 'extractedTable';
  const tableText = 'tableText';
  return {
    variables: [
      v('username', 'String', '"demo.user"'),
      v('password', 'String', '"demo.pass"'),
      v(extractedTable, 'DataTable', null),
      v(tableText, 'String', '""'),
      v('emailTo', 'String', '"ops@example.com"')
    ],
    activities: [
      log('"Starting login → extract → email"', 'Info'),
      act(
        'UI.UseApplicationBrowser',
        'Use Browser — App login',
        {
          mode: 'Browser',
          urlOrPath: 'https://example.com/login',
          browserType: 'Chrome',
          open: 'IfNotOpen',
          close: 'Never',
          selector: "<html app='chrome.exe' title='*Login*' />"
        },
        [
          act('UI.TypeInto', 'Type username', {
            selector:
              "<html app='chrome.exe' title='*Login*' />\n<webctrl tag='INPUT' id='username' />",
            text: 'username'
          }),
          act('UI.TypeInto', 'Type password', {
            selector:
              "<html app='chrome.exe' title='*Login*' />\n<webctrl tag='INPUT' id='password' />",
            text: 'password'
          }),
          act('UI.Click', 'Click Login', {
            selector:
              "<html app='chrome.exe' title='*Login*' />\n<webctrl tag='BUTTON' id='btnLogin' />"
          }),
          act('UI.WaitElement', 'Wait for dashboard table', {
            selector:
              "<html app='chrome.exe' title='*Dashboard*' />\n<webctrl tag='TABLE' />",
            action: 'Appear',
            timeoutMs: 30000
          }),
          act('UI.ExtractTableData', 'Extract results table', {
            selector:
              "<html app='chrome.exe' title='*Dashboard*' />\n<webctrl tag='TABLE' />",
            result: extractedTable,
            includeHeaders: true,
            maxResults: 25,
            smartExtraction: true,
            extractionMetadata:
              '{"Columns":[{"Name":"Id"},{"Name":"Status"},{"Name":"Owner"}],"SmartExtraction":true}'
          })
        ]
      ),
      act('Data.OutputDataTable', 'Table to text', {
        dataTable: extractedTable,
        result: tableText
      }),
      act('Messaging.SendEmail', 'Email summary', {
        to: 'ops@example.com',
        subject: '"Automation extract complete"',
        body: 'Extract finished. See tableText variable for rows (refine on Windows).'
      }),
      log('"Email drafted with extract summary"', 'Info')
    ]
  };
}

function apiDataTableProcess(): {
  variables: WorkflowVariable[];
  activities: ActivityNode[];
} {
  return {
    variables: [
      v('apiUrl', 'String', '"https://api.example.com/items"'),
      v('response', 'Object', null),
      v('jsonText', 'String', '""'),
      v('jsonObj', 'Object', null),
      v('dt', 'DataTable', null),
      v('processedCount', 'Int32', 0)
    ],
    activities: [
      log('"Starting API → DataTable → Process"', 'Info'),
      act('Messaging.HttpRequest', 'GET items API', {
        method: 'GET',
        url: 'apiUrl',
        body: '',
        result: 'response'
      }),
      act('Messaging.SerializeJson', 'Response to JSON text', {
        value: 'response',
        result: 'jsonText'
      }),
      act('Messaging.DeserializeJson', 'Parse JSON', {
        jsonString: 'jsonText',
        result: 'jsonObj'
      }),
      act('Data.BuildDataTable', 'Build items table', {
        columns: 'Id,Name,Status',
        result: 'dt'
      }),
      act('Data.AddDataRow', 'Seed row 1 (replace with API map)', {
        dataTable: 'dt',
        arrayRow: '["1","Item-A","New"]'
      }),
      act('Data.AddDataRow', 'Seed row 2 (replace with API map)', {
        dataTable: 'dt',
        arrayRow: '["2","Item-B","New"]'
      }),
      act(
        'Data.ForEachRow',
        'Process each row',
        {
          dataTable: 'dt',
          row: 'row'
        },
        [
          act('Programming.Assign', 'Increment processedCount', {
            to: 'processedCount',
            value: 'processedCount + 1'
          }),
          log('"Processed row"', 'Info')
        ]
      ),
      log('"API process complete"', 'Info')
    ]
  };
}

function queueOrchestrator(): {
  variables: WorkflowVariable[];
  activities: ActivityNode[];
} {
  return {
    variables: [
      v('TransactionItem', 'Object', null),
      v('assetValue', 'String', '""'),
      v('statusCode', 'Int32', 0),
      v('response', 'Object', null),
      v('MaxTransactions', 'Int32', 3),
      v('TransactionNumber', 'Int32', 1)
    ],
    activities: [
      log('"Queue orchestrator start"', 'Info'),
      act('Orchestrator.GetAsset', 'Get Config Asset', {
        assetName: 'AppUrl',
        result: 'assetValue'
      }),
      act('Orchestrator.GetTransactionItem', 'Get next queue item', {
        queueName: 'MainQueue',
        result: 'TransactionItem'
      }),
      act('Messaging.HttpRequest', 'Call process API', {
        method: 'POST',
        url: 'assetValue',
        authType: 'None',
        body: '',
        result: 'response',
        statusCode: 'statusCode'
      }),
      act('REFramework.SetTransactionStatus', 'Mark Success', {
        transactionItem: 'TransactionItem',
        status: 'Success',
        reason: '""'
      }),
      act('Orchestrator.AddQueueItem', 'Optional requeue example', {
        queueName: 'MainQueue',
        reference: '"follow-up"',
        itemInformation: '{ "Source": "LCS" }',
        priority: 'Normal'
      }),
      log('"Queue orchestrator done"', 'Info')
    ]
  };
}

function buildScenarios(projectName: string, id: BlueprintId) {
  switch (id) {
    case 'web-scrape-excel':
      return {
        schemaVersion: '1.0',
        scenarios: [
          {
            name: 'scrape-happy',
            description: `Extract mock table and write Excel (${projectName})`,
            fixtures: {
              tables: {
                extractedTable: {
                  columns: ['OrderId', 'Customer', 'Amount'],
                  rows: [
                    ['ORD-1', 'Acme', '120'],
                    ['ORD-2', 'Globex', '85']
                  ]
                }
              }
            },
            expect: {
              ok: true,
              minSteps: 3,
              logIncludes: ['web scrape', 'Wrote scraped table']
            }
          }
        ]
      };
    case 'login-extract-email':
      return {
        schemaVersion: '1.0',
        scenarios: [
          {
            name: 'login-extract',
            description: `Login + extract + email dry-run (${projectName})`,
            variables: {
              username: 'demo.user',
              password: 'demo.pass'
            },
            fixtures: {
              tables: {
                extractedTable: {
                  columns: ['Id', 'Status', 'Owner'],
                  rows: [['10', 'Open', 'Ada']]
                }
              }
            },
            expect: {
              ok: true,
              minSteps: 4,
              logIncludes: ['login → extract', 'Email drafted']
            }
          }
        ]
      };
    case 'api-datatable-process':
      return {
        schemaVersion: '1.0',
        scenarios: [
          {
            name: 'api-process',
            description: `HTTP fixture → process rows (${projectName})`,
            fixtures: {
              http: {
                'api.example.com': {
                  status: 200,
                  body: {
                    items: [
                      { id: 1, name: 'Item-A' },
                      { id: 2, name: 'Item-B' }
                    ]
                  }
                }
              }
            },
            expect: {
              ok: true,
              minSteps: 5,
              variables: { processedCount: 2 },
              logIncludes: ['API → DataTable', 'API process complete']
            }
          }
        ]
      };
    case 'queue-orchestrator':
      return {
        schemaVersion: '1.0',
        scenarios: [
          {
            name: 'queue-happy',
            description: `Queue item + asset fixtures (${projectName})`,
            variables: { TransactionNumber: 1, MaxTransactions: 3 },
            fixtures: {
              assets: { AppUrl: 'https://api.example.com/process' },
              queueItems: {
                MainQueue: [{ Reference: 'REF-1', SpecificContent: { Id: 1 } }]
              },
              http: {
                'api.example.com': { status: 200, body: { ok: true } }
              }
            },
            expect: {
              ok: true,
              minSteps: 5,
              logIncludes: ['Queue orchestrator start', 'GetTransactionItem', 'SetTransactionStatus']
            }
          }
        ]
      };
  }
}

function buildReadme(projectName: string, blueprint: RobotBlueprint): string {
  return `# ${projectName}

**Robot blueprint:** ${blueprint.label}

${blueprint.description}

LowCode Studio scaffold for Mac design → dry-run → Connect to Studio Web → Windows robot.

## Flow

${blueprint.detail}

## Getting started

1. Open \`Main.lcs.json\` in the designer
2. Tune selectors with **Selector Builder** (Windows capture later)
3. **F5** Dry Run or **Step Through** — scenarios under \`Data/Test/scenarios.json\` include fixtures
4. **Shift+F5** for named scenarios
5. **Connect to Studio Web** → refine UI on Windows → publish

## Notes

- Selectors are classic Windows \`<html>/<webctrl>\` placeholders — mark/fix before robot run
- Nested UI steps use **Use Application/Browser** where applicable
- Not an official UiPath template — community Mac-first scaffold
`;
}

function v(name: string, type: VariableType, defaultValue: unknown): WorkflowVariable {
  return { name, type, defaultValue };
}

function log(message: string, level: string): ActivityNode {
  return act('System.LogMessage', 'Log Message', { message, level });
}

function act(
  type: string,
  displayName: string,
  properties: Record<string, unknown>,
  children?: ActivityNode[]
): ActivityNode {
  const node: ActivityNode = {
    id: newId(),
    type,
    displayName,
    properties
  };
  if (children?.length) {
    node.children = children;
  }
  return node;
}
