export type ActivityCategory =
  | 'System'
  | 'Control Flow'
  | 'UI Automation'
  | 'Data'
  | 'Programming'
  | 'Messaging';

export interface ActivityPropertyDef {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'expression' | 'multiline';
  defaultValue?: unknown;
  options?: string[];
  description?: string;
  required?: boolean;
}

export interface ActivityDefinition {
  type: string;
  displayName: string;
  category: ActivityCategory;
  description: string;
  icon: string;
  color: string;
  container?: boolean;
  hasElse?: boolean;
  properties: ActivityPropertyDef[];
}

export const ACTIVITY_CATALOG: ActivityDefinition[] = [
  {
    type: 'System.LogMessage',
    displayName: 'Log Message',
    category: 'System',
    description: 'Writes a message to the execution log.',
    icon: '$(output)',
    color: '#3B82F6',
    properties: [
      {
        name: 'message',
        label: 'Message',
        type: 'expression',
        defaultValue: '"Message"',
        required: true
      },
      {
        name: 'level',
        label: 'Level',
        type: 'enum',
        options: ['Trace', 'Info', 'Warn', 'Error'],
        defaultValue: 'Info'
      }
    ]
  },
  {
    type: 'System.Delay',
    displayName: 'Delay',
    category: 'System',
    description: 'Pauses execution for a duration in milliseconds.',
    icon: '$(watch)',
    color: '#64748B',
    properties: [
      {
        name: 'durationMs',
        label: 'Duration (ms)',
        type: 'number',
        defaultValue: 1000,
        required: true
      }
    ]
  },
  {
    type: 'System.Comment',
    displayName: 'Comment',
    category: 'System',
    description: 'Adds a design-time note. Ignored at runtime.',
    icon: '$(comment)',
    color: '#94A3B8',
    properties: [
      {
        name: 'text',
        label: 'Text',
        type: 'multiline',
        defaultValue: 'Add a note...'
      }
    ]
  },
  {
    type: 'Programming.Assign',
    displayName: 'Assign',
    category: 'Programming',
    description: 'Assigns a value to a variable.',
    icon: '$(symbol-variable)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'to',
        label: 'To',
        type: 'expression',
        defaultValue: 'myVar',
        required: true
      },
      {
        name: 'value',
        label: 'Value',
        type: 'expression',
        defaultValue: '""',
        required: true
      }
    ]
  },
  {
    type: 'ControlFlow.If',
    displayName: 'If',
    category: 'Control Flow',
    description: 'Executes Then or Else based on a condition.',
    icon: '$(debug-breakpoint-conditional)',
    color: '#F59E0B',
    container: true,
    hasElse: true,
    properties: [
      {
        name: 'condition',
        label: 'Condition',
        type: 'expression',
        defaultValue: 'true',
        required: true
      }
    ]
  },
  {
    type: 'ControlFlow.While',
    displayName: 'While',
    category: 'Control Flow',
    description: 'Repeats child activities while condition is true.',
    icon: '$(sync)',
    color: '#F59E0B',
    container: true,
    properties: [
      {
        name: 'condition',
        label: 'Condition',
        type: 'expression',
        defaultValue: 'true',
        required: true
      }
    ]
  },
  {
    type: 'ControlFlow.ForEach',
    displayName: 'For Each',
    category: 'Control Flow',
    description: 'Iterates over a collection.',
    icon: '$(list-ordered)',
    color: '#F59E0B',
    container: true,
    properties: [
      {
        name: 'item',
        label: 'Item',
        type: 'expression',
        defaultValue: 'item',
        required: true
      },
      {
        name: 'values',
        label: 'Values',
        type: 'expression',
        defaultValue: 'collection',
        required: true
      }
    ]
  },
  {
    type: 'ControlFlow.TryCatch',
    displayName: 'Try Catch',
    category: 'Control Flow',
    description: 'Handles errors in a Try block with Catch/Finally.',
    icon: '$(shield)',
    color: '#EF4444',
    container: true,
    hasElse: true,
    properties: [
      {
        name: 'exceptionType',
        label: 'Exception Type',
        type: 'string',
        defaultValue: 'System.Exception'
      }
    ]
  },
  {
    type: 'ControlFlow.Sequence',
    displayName: 'Sequence',
    category: 'Control Flow',
    description: 'Groups activities that run one after another.',
    icon: '$(list-flat)',
    color: '#0EA5E9',
    container: true,
    properties: []
  },
  {
    type: 'UI.OpenApplication',
    displayName: 'Open Application',
    category: 'UI Automation',
    description: 'Launches an application or URL (design-time stub on Mac).',
    icon: '$(window)',
    color: '#10B981',
    properties: [
      {
        name: 'pathOrUrl',
        label: 'Path / URL',
        type: 'string',
        defaultValue: 'https://example.com',
        required: true
      },
      {
        name: 'arguments',
        label: 'Arguments',
        type: 'string',
        defaultValue: ''
      }
    ]
  },
  {
    type: 'UI.Click',
    displayName: 'Click',
    category: 'UI Automation',
    description: 'Clicks a UI target described by a selector.',
    icon: '$(inspect)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector',
        type: 'multiline',
        defaultValue: '<target id=\"btnSubmit\" />',
        required: true
      },
      {
        name: 'clickType',
        label: 'Click Type',
        type: 'enum',
        options: ['Single', 'Double', 'Right'],
        defaultValue: 'Single'
      },
      {
        name: 'simulateClick',
        label: 'Simulate Click',
        type: 'boolean',
        defaultValue: true
      }
    ]
  },
  {
    type: 'UI.TypeInto',
    displayName: 'Type Into',
    category: 'UI Automation',
    description: 'Types text into a UI field.',
    icon: '$(keyboard)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector',
        type: 'multiline',
        defaultValue: '<target id=\"input\" />',
        required: true
      },
      {
        name: 'text',
        label: 'Text',
        type: 'expression',
        defaultValue: '""',
        required: true
      },
      {
        name: 'emptyField',
        label: 'Empty Field',
        type: 'boolean',
        defaultValue: true
      }
    ]
  },
  {
    type: 'UI.GetText',
    displayName: 'Get Text',
    category: 'UI Automation',
    description: 'Reads text from a UI element into a variable.',
    icon: '$(selection)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector',
        type: 'multiline',
        defaultValue: '<target id=\"label\" />',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'extractedText',
        required: true
      }
    ]
  },
  {
    type: 'UI.ElementExists',
    displayName: 'Element Exists',
    category: 'UI Automation',
    description: 'Checks whether a UI element is present.',
    icon: '$(eye)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector',
        type: 'multiline',
        defaultValue: '<target id=\"popup\" />',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'exists',
        required: true
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 3000
      }
    ]
  },
  {
    type: 'Data.ReadCsv',
    displayName: 'Read CSV',
    category: 'Data',
    description: 'Reads a CSV file into a DataTable-like structure.',
    icon: '$(file)',
    color: '#06B6D4',
    properties: [
      {
        name: 'path',
        label: 'File Path',
        type: 'string',
        defaultValue: 'data.csv',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'hasHeaders',
        label: 'Has Headers',
        type: 'boolean',
        defaultValue: true
      }
    ]
  },
  {
    type: 'Data.WriteCsv',
    displayName: 'Write CSV',
    category: 'Data',
    description: 'Writes a DataTable-like structure to a CSV file.',
    icon: '$(save)',
    color: '#06B6D4',
    properties: [
      {
        name: 'path',
        label: 'File Path',
        type: 'string',
        defaultValue: 'output.csv',
        required: true
      },
      {
        name: 'data',
        label: 'Data',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      }
    ]
  },
  {
    type: 'Data.BuildDataTable',
    displayName: 'Build Data Table',
    category: 'Data',
    description: 'Creates an in-memory table structure.',
    icon: '$(table)',
    color: '#06B6D4',
    properties: [
      {
        name: 'columns',
        label: 'Columns (comma-separated)',
        type: 'string',
        defaultValue: 'Name,Amount,Status',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      }
    ]
  },
  {
    type: 'Messaging.SendEmail',
    displayName: 'Send Email',
    category: 'Messaging',
    description: 'Drafts/sends an email (simulated in dry-run).',
    icon: '$(mail)',
    color: '#EC4899',
    properties: [
      {
        name: 'to',
        label: 'To',
        type: 'string',
        defaultValue: 'user@example.com',
        required: true
      },
      {
        name: 'subject',
        label: 'Subject',
        type: 'expression',
        defaultValue: '"Automation result"',
        required: true
      },
      {
        name: 'body',
        label: 'Body',
        type: 'multiline',
        defaultValue: 'Processed successfully.'
      }
    ]
  },
  {
    type: 'Messaging.HttpRequest',
    displayName: 'HTTP Request',
    category: 'Messaging',
    description: 'Calls an HTTP endpoint and stores the response.',
    icon: '$(globe)',
    color: '#EC4899',
    properties: [
      {
        name: 'method',
        label: 'Method',
        type: 'enum',
        options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        defaultValue: 'GET'
      },
      {
        name: 'url',
        label: 'URL',
        type: 'expression',
        defaultValue: '"https://api.example.com/items"',
        required: true
      },
      {
        name: 'body',
        label: 'Body',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'response'
      }
    ]
  }
];

export function getActivityDefinition(type: string): ActivityDefinition | undefined {
  return ACTIVITY_CATALOG.find((a) => a.type === type);
}

export function createActivityFromDefinition(def: ActivityDefinition) {
  const properties: Record<string, unknown> = {};
  for (const prop of def.properties) {
    properties[prop.name] = prop.defaultValue ?? '';
  }

  return {
    id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: def.type,
    displayName: def.displayName,
    properties,
    ...(def.container ? { children: [] as unknown[] } : {}),
    ...(def.hasElse ? { elseChildren: [] as unknown[] } : {})
  };
}

export function groupActivitiesByCategory(): Map<ActivityCategory, ActivityDefinition[]> {
  const map = new Map<ActivityCategory, ActivityDefinition[]>();
  for (const activity of ACTIVITY_CATALOG) {
    const list = map.get(activity.category) || [];
    list.push(activity);
    map.set(activity.category, list);
  }
  return map;
}
