export type ActivityCategory =
  | 'System'
  | 'Control Flow'
  | 'UI Automation'
  | 'Data'
  | 'Excel'
  | 'Python'
  | 'Programming'
  | 'Messaging'
  | 'Flowchart'
  | 'REFramework'
  | 'Custom';

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
    type: 'System.MessageBox',
    displayName: 'Message Box',
    category: 'System',
    description: 'Shows a message box (simulated in dry-run).',
    icon: '$(comment-discussion)',
    color: '#3B82F6',
    properties: [
      {
        name: 'text',
        label: 'Text',
        type: 'expression',
        defaultValue: '"Hello"',
        required: true
      },
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        defaultValue: 'LowCode Studio'
      }
    ]
  },
  {
    type: 'System.WriteLine',
    displayName: 'Write Line',
    category: 'System',
    description: 'Writes a line to the output panel / console.',
    icon: '$(terminal)',
    color: '#3B82F6',
    properties: [
      {
        name: 'text',
        label: 'Text',
        type: 'expression',
        defaultValue: '"Line"',
        required: true
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
    type: 'ControlFlow.DoWhile',
    displayName: 'Do While',
    category: 'Control Flow',
    description: 'Runs body once, then repeats while condition is true.',
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
    type: 'ControlFlow.RetryScope',
    displayName: 'Retry Scope',
    category: 'Control Flow',
    description: 'Retries child activities on failure.',
    icon: '$(debug-restart)',
    color: '#EF4444',
    container: true,
    properties: [
      {
        name: 'numberOfRetries',
        label: 'Number Of Retries',
        type: 'number',
        defaultValue: 3
      },
      {
        name: 'retryIntervalMs',
        label: 'Retry Interval (ms)',
        type: 'number',
        defaultValue: 1000
      }
    ]
  },
  {
    type: 'ControlFlow.Break',
    displayName: 'Break',
    category: 'Control Flow',
    description: 'Exits the nearest loop.',
    icon: '$(debug-pause)',
    color: '#F59E0B',
    properties: []
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
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: '',
        description: 'Preserved FullSelectorEncoding from Studio (round-trip).'
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
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: '',
        description: 'Preserved FullSelectorEncoding from Studio (round-trip).'
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
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: '',
        description: 'Preserved FullSelectorEncoding from Studio (round-trip).'
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
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: ''
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
    type: 'UI.Check',
    displayName: 'Check',
    category: 'UI Automation',
    description: 'Checks or unchecks a checkbox / radio.',
    icon: '$(check)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector',
        type: 'multiline',
        defaultValue: '<target id=\"chkAgree\" />',
        required: true
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'action',
        label: 'Action',
        type: 'enum',
        options: ['Check', 'Uncheck', 'Toggle'],
        defaultValue: 'Check'
      }
    ]
  },
  {
    type: 'UI.Hover',
    displayName: 'Hover',
    category: 'UI Automation',
    description: 'Hovers the mouse over a UI element.',
    icon: '$(inspect)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector',
        type: 'multiline',
        defaultValue: '<target id=\"menu\" />',
        required: true
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: ''
      }
    ]
  },
  {
    type: 'UI.SelectItem',
    displayName: 'Select Item',
    category: 'UI Automation',
    description: 'Selects an item from a drop-down / list.',
    icon: '$(list-selection)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector',
        type: 'multiline',
        defaultValue: '<target id=\"cmbCountry\" />',
        required: true
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'item',
        label: 'Item',
        type: 'expression',
        defaultValue: '"Option"',
        required: true
      }
    ]
  },
  {
    type: 'UI.TakeScreenshot',
    displayName: 'Take Screenshot',
    category: 'UI Automation',
    description: 'Captures a screenshot (simulated in dry-run).',
    icon: '$(device-camera)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector (optional)',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'filePath',
        label: 'File Path',
        type: 'string',
        defaultValue: 'Data/Temp/screenshot.png'
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
    type: 'Excel.ReadRange',
    displayName: 'Excel Read Range',
    category: 'Excel',
    description: 'Reads a range from an Excel workbook.',
    icon: '$(table)',
    color: '#16A34A',
    properties: [
      {
        name: 'workbookPath',
        label: 'Workbook Path',
        type: 'string',
        defaultValue: 'Data/Input/data.xlsx',
        required: true
      },
      {
        name: 'sheetName',
        label: 'Sheet Name',
        type: 'string',
        defaultValue: 'Sheet1'
      },
      {
        name: 'range',
        label: 'Range',
        type: 'string',
        defaultValue: ''
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
    type: 'Excel.WriteRange',
    displayName: 'Excel Write Range',
    category: 'Excel',
    description: 'Writes a data table to an Excel range.',
    icon: '$(save)',
    color: '#16A34A',
    properties: [
      {
        name: 'workbookPath',
        label: 'Workbook Path',
        type: 'string',
        defaultValue: 'Data/Output/out.xlsx',
        required: true
      },
      {
        name: 'sheetName',
        label: 'Sheet Name',
        type: 'string',
        defaultValue: 'Sheet1'
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
    type: 'Excel.ReadCell',
    displayName: 'Excel Read Cell',
    category: 'Excel',
    description: 'Reads a single Excel cell.',
    icon: '$(symbol-key)',
    color: '#16A34A',
    properties: [
      {
        name: 'workbookPath',
        label: 'Workbook Path',
        type: 'string',
        defaultValue: 'Data/Input/data.xlsx',
        required: true
      },
      {
        name: 'sheetName',
        label: 'Sheet Name',
        type: 'string',
        defaultValue: 'Sheet1'
      },
      {
        name: 'cell',
        label: 'Cell',
        type: 'string',
        defaultValue: 'A1',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'cellValue',
        required: true
      }
    ]
  },
  {
    type: 'Excel.WriteCell',
    displayName: 'Excel Write Cell',
    category: 'Excel',
    description: 'Writes a value to an Excel cell.',
    icon: '$(edit)',
    color: '#16A34A',
    properties: [
      {
        name: 'workbookPath',
        label: 'Workbook Path',
        type: 'string',
        defaultValue: 'Data/Output/out.xlsx',
        required: true
      },
      {
        name: 'sheetName',
        label: 'Sheet Name',
        type: 'string',
        defaultValue: 'Sheet1'
      },
      {
        name: 'cell',
        label: 'Cell',
        type: 'string',
        defaultValue: 'A1',
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
  },
  {
    type: 'Python.PythonScope',
    displayName: 'Python Scope',
    category: 'Python',
    description: 'Initializes a Python environment (UiPath.Python.Activities). Child Python activities run inside this scope.',
    icon: '$(symbol-misc)',
    color: '#3776AB',
    container: true,
    properties: [
      {
        name: 'path',
        label: 'Python Path',
        type: 'string',
        defaultValue: '',
        description: 'Path to the Python installation folder.'
      },
      {
        name: 'libraryPath',
        label: 'Library Path',
        type: 'string',
        defaultValue: '',
        description: 'libpython / python dll path when required.'
      },
      {
        name: 'target',
        label: 'Target',
        type: 'enum',
        options: ['x64', 'x86'],
        defaultValue: 'x64'
      },
      {
        name: 'workingFolder',
        label: 'Working Folder',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'version',
        label: 'Version',
        type: 'string',
        defaultValue: 'Python 3.10'
      }
    ]
  },
  {
    type: 'Python.LoadScript',
    displayName: 'Load Python Script',
    category: 'Python',
    description: 'Loads a .py file (or inline code) into a PythonObject handler. Use inside Python Scope.',
    icon: '$(file-code)',
    color: '#3776AB',
    properties: [
      {
        name: 'file',
        label: 'File',
        type: 'string',
        defaultValue: 'scripts/main.py',
        description: 'Path to the .py script.'
      },
      {
        name: 'code',
        label: 'Code',
        type: 'multiline',
        defaultValue: '',
        description: 'Optional inline Python code (alternative to File).'
      },
      {
        name: 'result',
        label: 'Result (PythonObject)',
        type: 'expression',
        defaultValue: 'pythonScript',
        required: true
      }
    ]
  },
  {
    type: 'Python.RunScript',
    displayName: 'Run Python Script',
    category: 'Python',
    description: 'Runs a Python script file or inline code inside Python Scope.',
    icon: '$(play)',
    color: '#3776AB',
    properties: [
      {
        name: 'file',
        label: 'File',
        type: 'string',
        defaultValue: 'scripts/run.py'
      },
      {
        name: 'code',
        label: 'Code',
        type: 'multiline',
        defaultValue: 'print("Hello from Python")'
      }
    ]
  },
  {
    type: 'Python.InvokeMethod',
    displayName: 'Invoke Python Method',
    category: 'Python',
    description: 'Invokes a method from a loaded Python script. Use inside Python Scope.',
    icon: '$(symbol-method)',
    color: '#3776AB',
    properties: [
      {
        name: 'instance',
        label: 'Instance (PythonObject)',
        type: 'expression',
        defaultValue: 'pythonScript',
        required: true
      },
      {
        name: 'name',
        label: 'Method Name',
        type: 'string',
        defaultValue: 'main',
        required: true
      },
      {
        name: 'inputParameters',
        label: 'Input Parameters',
        type: 'expression',
        defaultValue: '{}',
        description: 'JSON-like map or expression of arguments passed to the method.'
      },
      {
        name: 'result',
        label: 'Result (PythonObject)',
        type: 'expression',
        defaultValue: 'pythonResult',
        required: true
      }
    ]
  },
  {
    type: 'Python.GetObject',
    displayName: 'Get Python Object',
    category: 'Python',
    description: 'Converts a PythonObject to a .NET / workflow type. Use inside Python Scope.',
    icon: '$(symbol-variable)',
    color: '#3776AB',
    properties: [
      {
        name: 'pythonObject',
        label: 'Python Object',
        type: 'expression',
        defaultValue: 'pythonResult',
        required: true
      },
      {
        name: 'type',
        label: 'Type',
        type: 'enum',
        options: ['String', 'Int32', 'Boolean', 'Double', 'Object', 'Array'],
        defaultValue: 'String'
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'netValue',
        required: true
      }
    ]
  },
  {
    type: 'Flowchart.Start',
    displayName: 'Start',
    category: 'Flowchart',
    description: 'Entry point for a flowchart.',
    icon: '$(debug-start)',
    color: '#22C55E',
    properties: []
  },
  {
    type: 'Flowchart.FlowDecision',
    displayName: 'Flow Decision',
    category: 'Flowchart',
    description: 'Diamond decision with True/False outgoing links.',
    icon: '$(debug-breakpoint-conditional)',
    color: '#F59E0B',
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
    type: 'Flowchart.End',
    displayName: 'End',
    category: 'Flowchart',
    description: 'Terminal node for a flowchart path.',
    icon: '$(debug-stop)',
    color: '#EF4444',
    properties: []
  },
  {
    type: 'REFramework.InvokeWorkflow',
    displayName: 'Invoke Workflow',
    category: 'REFramework',
    description: 'Calls another .lcs.json workflow (REFramework building block).',
    icon: '$(run-all)',
    color: '#0EA5E9',
    properties: [
      {
        name: 'workflowPath',
        label: 'Workflow Path',
        type: 'string',
        defaultValue: 'Framework/Process.lcs.json',
        required: true
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        defaultValue: ''
      }
    ]
  },
  {
    type: 'REFramework.SetTransactionStatus',
    displayName: 'Set Transaction Status',
    category: 'REFramework',
    description: 'Marks the current transaction Success / Business / System exception.',
    icon: '$(checklist)',
    color: '#0EA5E9',
    properties: [
      {
        name: 'status',
        label: 'Status',
        type: 'enum',
        options: ['Success', 'BusinessRuleException', 'SystemException'],
        defaultValue: 'Success',
        required: true
      },
      {
        name: 'reason',
        label: 'Reason',
        type: 'expression',
        defaultValue: '""'
      }
    ]
  }
];

/** Runtime overlay from project + user custom activity registrations. */
let customOverlay: ActivityDefinition[] = [];

export function setCustomActivityOverlay(defs: ActivityDefinition[]): void {
  customOverlay = defs.map((d) => ({ ...d }));
}

export function getCustomActivityOverlay(): ActivityDefinition[] {
  return [...customOverlay];
}

/** Built-in + registered custom activities (custom wins on type collision). */
export function getActivityCatalog(): ActivityDefinition[] {
  const map = new Map<string, ActivityDefinition>();
  for (const a of ACTIVITY_CATALOG) {
    map.set(a.type, a);
  }
  for (const a of customOverlay) {
    map.set(a.type, a);
  }
  return [...map.values()];
}

export function getActivityDefinition(type: string): ActivityDefinition | undefined {
  return customOverlay.find((a) => a.type === type) || ACTIVITY_CATALOG.find((a) => a.type === type);
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
  for (const activity of getActivityCatalog()) {
    const list = map.get(activity.category) || [];
    list.push(activity);
    map.set(activity.category, list);
  }
  return map;
}
