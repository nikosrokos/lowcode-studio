import {
  ActivityNode,
  FlowConnection,
  WorkflowDocument,
  createProjectManifest,
  newId,
  stringifyWorkflow
} from '../models/workflow';
import { resolveUiPathDependencies } from '../interop/uipathDependencies';

export interface GeneratedFile {
  relativePath: string;
  content: string;
}

/**
 * Generates a Mac-friendly REFramework-style project:
 * Main flowchart + Framework sequences + Config.json + folders.
 */
export function generateREFrameworkProject(projectName: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const mainName = 'Main.lcs.json';
  const frameworkWorkflows = [
    'Framework/InitAllSettings.lcs.json',
    'Framework/InitAllApplications.lcs.json',
    'Framework/GetTransactionData.lcs.json',
    'Framework/Process.lcs.json',
    'Framework/SetTransactionStatus.lcs.json',
    'Framework/CloseAllApplications.lcs.json',
    'Framework/KillAllProcesses.lcs.json',
    'Framework/TakeScreenshot.lcs.json'
  ];

  const allWorkflows = [mainName, ...frameworkWorkflows];

  files.push({
    relativePath: 'project.json',
    content:
      JSON.stringify(
        {
          ...createProjectManifest(projectName, mainName, allWorkflows, 'reframework'),
          uipathDependencies: resolveUiPathDependencies({
            activityTypes: [
              'System.LogMessage',
              'Programming.Assign',
              'ControlFlow.If',
              'ControlFlow.TryCatch',
              'UI.OpenApplication',
              'Messaging.HttpRequest',
              'REFramework.InvokeWorkflow',
              'Flowchart.FlowDecision'
            ],
            includeBaseline: true
          })
        },
        null,
        2
      ) + '\n'
  });

  files.push({
    relativePath: mainName,
    content: stringifyWorkflow(buildMainFlowchart(projectName))
  });

  files.push({
    relativePath: 'Framework/InitAllSettings.lcs.json',
    content: stringifyWorkflow(buildInitAllSettings())
  });
  files.push({
    relativePath: 'Framework/InitAllApplications.lcs.json',
    content: stringifyWorkflow(buildInitAllApplications())
  });
  files.push({
    relativePath: 'Framework/GetTransactionData.lcs.json',
    content: stringifyWorkflow(buildGetTransactionData())
  });
  files.push({
    relativePath: 'Framework/Process.lcs.json',
    content: stringifyWorkflow(buildProcess())
  });
  files.push({
    relativePath: 'Framework/SetTransactionStatus.lcs.json',
    content: stringifyWorkflow(buildSetTransactionStatus())
  });
  files.push({
    relativePath: 'Framework/CloseAllApplications.lcs.json',
    content: stringifyWorkflow(buildCloseAllApplications())
  });
  files.push({
    relativePath: 'Framework/KillAllProcesses.lcs.json',
    content: stringifyWorkflow(buildKillAllProcesses())
  });
  files.push({
    relativePath: 'Framework/TakeScreenshot.lcs.json',
    content: stringifyWorkflow(buildTakeScreenshot())
  });

  files.push({
    relativePath: 'Data/Config.json',
    content: JSON.stringify(defaultConfig(projectName), null, 2) + '\n'
  });

  files.push({
    relativePath: 'Data/Test/scenarios.json',
    content: JSON.stringify(defaultTestScenarios(projectName), null, 2) + '\n'
  });

  files.push({
    relativePath: 'activities.custom.json',
    content:
      JSON.stringify(
        {
          schemaVersion: '1.0',
          activities: []
        },
        null,
        2
      ) + '\n'
  });

  files.push({
    relativePath: 'Data/Input/.gitkeep',
    content: ''
  });
  files.push({
    relativePath: 'Data/Output/.gitkeep',
    content: ''
  });
  files.push({
    relativePath: 'Data/Temp/.gitkeep',
    content: ''
  });

  files.push({
    relativePath: 'README.md',
    content: reframeworkReadme(projectName)
  });

  return files;
}

function buildMainFlowchart(projectName: string): WorkflowDocument {
  const start = node('Flowchart.Start', 'Start', {}, 300, 30);
  const init = node(
    'REFramework.InvokeWorkflow',
    'Initialization',
    {
      workflowPath: 'Framework/InitAllSettings.lcs.json',
      description: 'Load Config + InitAllApplications'
    },
    250,
    140
  );
  const getTx = node(
    'REFramework.InvokeWorkflow',
    'Get Transaction Data',
    {
      workflowPath: 'Framework/GetTransactionData.lcs.json',
      description: 'Fetch next TransactionItem'
    },
    250,
    270
  );
  const hasData = node(
    'Flowchart.FlowDecision',
    'Transaction exists?',
    {
      condition: 'TransactionItem != null'
    },
    250,
    400
  );
  const process = node(
    'REFramework.InvokeWorkflow',
    'Process Transaction',
    {
      workflowPath: 'Framework/Process.lcs.json',
      description: 'Business process for current item'
    },
    80,
    540
  );
  const setStatus = node(
    'REFramework.InvokeWorkflow',
    'Set Transaction Status',
    {
      workflowPath: 'Framework/SetTransactionStatus.lcs.json',
      description: 'Success / Business / System exception'
    },
    80,
    670
  );
  const endProcess = node(
    'REFramework.InvokeWorkflow',
    'End Process',
    {
      workflowPath: 'Framework/CloseAllApplications.lcs.json',
      description: 'Close apps and finish'
    },
    420,
    540
  );

  const connections: FlowConnection[] = [
    conn(start, init),
    conn(init, getTx),
    conn(getTx, hasData),
    conn(hasData, process, 'True'),
    conn(hasData, endProcess, 'False'),
    conn(process, setStatus),
    conn(setStatus, getTx, 'Next')
  ];

  return {
    schemaVersion: '1.0',
    name: 'Main',
    description: `REFramework main flowchart for ${projectName}`,
    type: 'Flowchart',
    startActivityId: start.id,
    variables: [
      {
        name: 'Config',
        type: 'Object',
        defaultValue: {},
        description: 'Settings loaded from Data/Config.json'
      },
      {
        name: 'TransactionItem',
        type: 'Object',
        defaultValue: null,
        description: 'Current work item'
      },
      {
        name: 'TransactionNumber',
        type: 'Int32',
        defaultValue: 1
      },
      {
        name: 'RetryNumber',
        type: 'Int32',
        defaultValue: 0
      },
      {
        name: 'TransactionResult',
        type: 'String',
        defaultValue: 'Success'
      },
      {
        name: 'ShouldStop',
        type: 'Boolean',
        defaultValue: false
      }
    ],
    arguments: [],
    activities: [start, init, getTx, hasData, process, setStatus, endProcess],
    connections,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      template: 'reframework'
    }
  };
}

function buildInitAllSettings(): WorkflowDocument {
  return sequence('InitAllSettings', [
    log('Loading Config.json from Data folder', 'Info'),
    assign('Config', 'ConfigFile'),
    log('"Settings loaded: MaxRetryNumber, OrchestratorQueueName, ..."', 'Info')
  ], [
    { name: 'Config', type: 'Object', defaultValue: {} },
    { name: 'ConfigFile', type: 'String', defaultValue: 'Data/Config.json' }
  ]);
}

function buildInitAllApplications(): WorkflowDocument {
  return sequence('InitAllApplications', [
    log('"Opening applications required by the process"', 'Info'),
    {
      id: newId(),
      type: 'UI.OpenApplication',
      displayName: 'Open Application',
      properties: {
        pathOrUrl: 'https://example.com',
        arguments: ''
      }
    },
    log('"Applications ready"', 'Info')
  ]);
}

function buildGetTransactionData(): WorkflowDocument {
  return sequence(
    'GetTransactionData',
    [
      log('"Getting next transaction item"', 'Info'),
      assign('TransactionItem', 'NextItem'),
      {
        id: newId(),
        type: 'ControlFlow.If',
        displayName: 'If no more items',
        properties: { condition: 'TransactionNumber > MaxTransactions' },
        children: [assign('TransactionItem', 'null')],
        elseChildren: [
          log('"TransactionItem ready for processing"', 'Info')
        ]
      }
    ],
    [
      { name: 'TransactionItem', type: 'Object', defaultValue: { id: 1, data: 'Sample' } },
      { name: 'TransactionNumber', type: 'Int32', defaultValue: 1 },
      { name: 'MaxTransactions', type: 'Int32', defaultValue: 3 },
      { name: 'NextItem', type: 'Object', defaultValue: { id: 1, data: 'Sample' } }
    ]
  );
}

function buildProcess(): WorkflowDocument {
  return sequence(
    'Process',
    [
      log('"Processing TransactionItem"', 'Info'),
      {
        id: newId(),
        type: 'ControlFlow.TryCatch',
        displayName: 'Try Catch',
        properties: { exceptionType: 'System.Exception' },
        children: [
          log('"=== Business steps go here ==="', 'Info'),
          {
            id: newId(),
            type: 'Messaging.HttpRequest',
            displayName: 'HTTP Request',
            properties: {
              method: 'GET',
              url: '"https://api.example.com/items"',
              body: '',
              result: 'response'
            }
          },
          assign('TransactionResult', '"Success"')
        ],
        elseChildren: [
          log('"Business/System exception captured"', 'Error'),
          assign('TransactionResult', '"SystemException"')
        ]
      }
    ],
    [
      { name: 'TransactionItem', type: 'Object', defaultValue: {} },
      { name: 'TransactionResult', type: 'String', defaultValue: 'Success' },
      { name: 'response', type: 'Object', defaultValue: {} }
    ]
  );
}

function buildSetTransactionStatus(): WorkflowDocument {
  return sequence(
    'SetTransactionStatus',
    [
      {
        id: newId(),
        type: 'ControlFlow.If',
        displayName: 'If Success',
        properties: { condition: 'TransactionResult == "Success"' },
        children: [
          log('"Set status: Successful"', 'Info'),
          assign('RetryNumber', '0'),
          assign('TransactionNumber', 'TransactionNumber + 1')
        ],
        elseChildren: [
          {
            id: newId(),
            type: 'ControlFlow.If',
            displayName: 'If retryable',
            properties: { condition: 'RetryNumber < MaxRetryNumber' },
            children: [
              log('"Retrying current transaction"', 'Warn'),
              assign('RetryNumber', 'RetryNumber + 1')
            ],
            elseChildren: [
              log('"Max retries reached — mark failed and continue"', 'Error'),
              assign('RetryNumber', '0'),
              assign('TransactionNumber', 'TransactionNumber + 1')
            ]
          }
        ]
      }
    ],
    [
      { name: 'TransactionResult', type: 'String', defaultValue: 'Success' },
      { name: 'RetryNumber', type: 'Int32', defaultValue: 0 },
      { name: 'MaxRetryNumber', type: 'Int32', defaultValue: 2 },
      { name: 'TransactionNumber', type: 'Int32', defaultValue: 1 }
    ]
  );
}

function buildCloseAllApplications(): WorkflowDocument {
  return sequence('CloseAllApplications', [
    log('"Closing applications gracefully"', 'Info'),
    log('"End Process complete"', 'Info')
  ]);
}

function buildKillAllProcesses(): WorkflowDocument {
  return sequence('KillAllProcesses', [
    log('"KillAllProcesses — cleanup stubborn apps (simulated)"', 'Warn')
  ]);
}

function buildTakeScreenshot(): WorkflowDocument {
  return sequence('TakeScreenshot', [
    log('"Screenshot saved to Data/Temp (simulated)"', 'Info')
  ]);
}

function sequence(
  name: string,
  activities: ActivityNode[],
  variables: WorkflowDocument['variables'] = []
): WorkflowDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: '1.0',
    name,
    description: `REFramework — ${name}`,
    type: 'Sequence',
    variables,
    arguments: [],
    activities,
    metadata: {
      createdAt: now,
      updatedAt: now,
      template: 'reframework'
    }
  };
}

function node(
  type: string,
  displayName: string,
  properties: Record<string, unknown>,
  x: number,
  y: number
): ActivityNode {
  return {
    id: newId(),
    type,
    displayName,
    properties,
    x,
    y
  };
}

function conn(from: ActivityNode, to: ActivityNode, label = ''): FlowConnection {
  return {
    id: newId('conn'),
    from: from.id,
    to: to.id,
    label
  };
}

function log(message: string, level: string): ActivityNode {
  return {
    id: newId(),
    type: 'System.LogMessage',
    displayName: 'Log Message',
    properties: { message, level }
  };
}

function assign(to: string, value: string): ActivityNode {
  return {
    id: newId(),
    type: 'Programming.Assign',
    displayName: 'Assign',
    properties: { to, value }
  };
}

function defaultConfig(projectName: string) {
  return {
    Settings: {
      projectName,
      MaxRetryNumber: 2,
      MaxTransactions: 3,
      TimeoutMS: 30000,
      ExScreenshotsFolderPath: 'Data/Temp',
      LogLevel: 'Info'
    },
    Constants: {
      OrchestratorQueueName: `${projectName}.Queue`,
      ConfigPath: 'Data/Config.json'
    },
    Assets: {
      CredentialAsset: 'REFramework.Credential'
    },
    Endpoints: {
      ProcessApi: 'https://api.example.com/items'
    }
  };
}

function defaultTestScenarios(projectName: string) {
  return {
    schemaVersion: '1.0',
    scenarios: [
      {
        name: 'happy-path',
        description: `Process 3 items then end (${projectName})`,
        variables: {
          MaxTransactions: 3,
          MaxRetryNumber: 2,
          TransactionNumber: 1,
          RetryNumber: 0
        },
        expect: {
          ok: true,
          variables: { TransactionItem: null },
          logIncludes: ['InvokeWorkflow', 'no more items', 'CloseAllApplications'],
          minSteps: 5
        }
      },
      {
        name: 'no-transactions',
        description: 'Empty queue — skip Process',
        variables: {
          MaxTransactions: 0,
          TransactionNumber: 1,
          TransactionItem: null
        },
        expect: {
          ok: true,
          logIncludes: ['CloseAllApplications'],
          variables: { TransactionItem: null }
        }
      },
      {
        name: 'single-item',
        description: 'One transaction then stop',
        configOverrides: {
          Settings: { MaxTransactions: 1 }
        },
        variables: {
          MaxTransactions: 1,
          TransactionNumber: 1
        },
        expect: {
          ok: true,
          logIncludes: ['Process completed', 'CloseAllApplications'],
          minSteps: 4
        }
      }
    ]
  };
}

function reframeworkReadme(projectName: string): string {
  return `# ${projectName} (REFramework)

UiPath-style **Robotic Enterprise Framework** project for LowCode Studio on Mac / VS Code / Cursor.

## Structure

\`\`\`
${projectName}/
  Main.lcs.json                 ← Flowchart state machine
  Framework/
    InitAllSettings.lcs.json
    InitAllApplications.lcs.json
    GetTransactionData.lcs.json
    Process.lcs.json            ← put your business logic here
    SetTransactionStatus.lcs.json
    CloseAllApplications.lcs.json
    KillAllProcesses.lcs.json
    TakeScreenshot.lcs.json
  Data/
    Config.json                 ← settings (xlsx-free for Mac)
    Test/scenarios.json         ← simulated dry-run tests
    Input/ Output/ Temp/
  activities.custom.json        ← project custom activities
\`\`\`

## How to use (easy path)

1. Open **Main.lcs.json** — flowchart shows Init → Get Data → Process → End.
2. Edit **Data/Config.json** for retries, queue name, endpoints.
3. Put business steps in **Framework/Process.lcs.json**.
4. Adjust **GetTransactionData** for your queue / input source.
5. Press **F5** (Dry Run) on Main to simulate the transaction loop.
6. Run **LowCode Studio: Dry Run REFramework Scenario** for named tests in \`Data/Test/scenarios.json\`.

## Simulated tests (recommended)

Use **Config.json + scenario variables + expect assertions** — not a real robot:

| File | Role |
|---|---|
| \`Data/Config.json\` | Shared settings (retries, MaxTransactions, endpoints) |
| \`Data/Test/scenarios.json\` | Named dry-runs with variable seeds + assertions |

Edit a scenario, then run **Dry Run REFramework Scenario** and pick it (or All).

## Flowchart transitions

| From | Condition | To |
|---|---|---|
| Initialization | always | Get Transaction Data |
| Get Transaction Data | always | Decision |
| Transaction exists? | True | Process Transaction |
| Transaction exists? | False | End Process |
| Process Transaction | always | Set Transaction Status |
| Set Transaction Status | Next | Get Transaction Data |

> Inspired by UiPath REFramework. Not an official UiPath template — designed for local low-code design and dry-run on Mac.
`;
}
