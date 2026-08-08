export type ActivityCategory =
  | 'System'
  | 'Control Flow'
  | 'UI Automation'
  | 'Data'
  | 'Excel'
  | 'Python'
  | 'Programming'
  | 'Messaging'
  | 'Orchestrator'
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

/** Modern UI input method — exports as InteractionMode on Studio XAML. */
const UI_INPUT_METHOD_PROP: ActivityPropertyDef = {
  name: 'inputMethod',
  label: 'Input Method',
  type: 'enum',
  options: [
    'Same as App/Browser',
    'Simulate',
    'Chromium API',
    'Window Messages',
    'Hardware Events'
  ],
  defaultValue: 'Same as App/Browser',
  description:
    'How the Windows robot interacts with the target: Simulate (background APIs), Chromium API (Chrome/Edge), Window Messages, Hardware Events, or inherit from Use Application/Browser.'
};

const SCOPE_INPUT_METHOD_PROP: ActivityPropertyDef = {
  name: 'inputMethod',
  label: 'Input Method',
  type: 'enum',
  options: [
    'Simulate',
    'Chromium API',
    'Window Messages',
    'Hardware Events',
    'Background'
  ],
  defaultValue: 'Simulate',
  description:
    'Default input mode for nested UI activities. Background tries Simulate/Chromium API where possible.'
};

export const ACTIVITY_CATALOG: ActivityDefinition[] = [
  {
    type: 'System.LogMessage',
    displayName: 'Log Message',
    category: 'System',
    description: 'Writes a message to the execution log.',
    icon: '$(selection)',
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
        options: ['Trace', 'Info', 'Warn', 'Error', 'Fatal'],
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
    type: 'System.ReadTextFile',
    displayName: 'Read Text File',
    category: 'System',
    description: 'Reads a text file into a string variable (real in dry-run when path exists).',
    icon: '$(file-text)',
    color: '#3B82F6',
    properties: [
      {
        name: 'fileName',
        label: 'File Name',
        type: 'expression',
        defaultValue: '"data.txt"',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'fileText',
        required: true
      }
    ]
  },
  {
    type: 'System.WriteTextFile',
    displayName: 'Write Text File',
    category: 'System',
    description: 'Writes text to a file (real in dry-run when path is writable).',
    icon: '$(save)',
    color: '#3B82F6',
    properties: [
      {
        name: 'fileName',
        label: 'File Name',
        type: 'expression',
        defaultValue: '"out.txt"',
        required: true
      },
      {
        name: 'text',
        label: 'Text',
        type: 'expression',
        defaultValue: '"Hello"',
        required: true
      }
    ]
  },
  {
    type: 'System.AppendLine',
    displayName: 'Append Line',
    category: 'System',
    description: 'Appends a line to a text file.',
    icon: '$(diff-added)',
    color: '#3B82F6',
    properties: [
      {
        name: 'fileName',
        label: 'File Name',
        type: 'expression',
        defaultValue: '"log.txt"',
        required: true
      },
      {
        name: 'text',
        label: 'Text',
        type: 'expression',
        defaultValue: '"line"',
        required: true
      }
    ]
  },
  {
    type: 'System.PathExists',
    displayName: 'Path Exists',
    category: 'System',
    description: 'Checks whether a file or folder exists.',
    icon: '$(search)',
    color: '#64748B',
    properties: [
      {
        name: 'path',
        label: 'Path',
        type: 'expression',
        defaultValue: '"data.txt"',
        required: true
      },
      {
        name: 'pathType',
        label: 'Path Type',
        type: 'enum',
        options: ['File', 'Folder', 'Any'],
        defaultValue: 'Any'
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'exists',
        required: true
      }
    ]
  },
  {
    type: 'System.CreateDirectory',
    displayName: 'Create Directory',
    category: 'System',
    description: 'Creates a folder if it does not exist.',
    icon: '$(new-folder)',
    color: '#64748B',
    properties: [
      {
        name: 'path',
        label: 'Path',
        type: 'expression',
        defaultValue: '"output"',
        required: true
      }
    ]
  },
  {
    type: 'System.CopyFile',
    displayName: 'Copy File',
    category: 'System',
    description: 'Copies a file to a destination path.',
    icon: '$(files)',
    color: '#64748B',
    properties: [
      {
        name: 'path',
        label: 'Source',
        type: 'expression',
        defaultValue: '"in.txt"',
        required: true
      },
      {
        name: 'destination',
        label: 'Destination',
        type: 'expression',
        defaultValue: '"out.txt"',
        required: true
      },
      {
        name: 'overwrite',
        label: 'Overwrite',
        type: 'boolean',
        defaultValue: true
      }
    ]
  },
  {
    type: 'System.DeleteFile',
    displayName: 'Delete File',
    category: 'System',
    description: 'Deletes a file if it exists.',
    icon: '$(trash)',
    color: '#EF4444',
    properties: [
      {
        name: 'path',
        label: 'Path',
        type: 'expression',
        defaultValue: '"temp.txt"',
        required: true
      }
    ]
  },
  {
    type: 'System.MoveFile',
    displayName: 'Move File',
    category: 'System',
    description: 'Moves a file to a destination path.',
    icon: '$(file-symlink-file)',
    color: '#64748B',
    properties: [
      {
        name: 'path',
        label: 'Source',
        type: 'expression',
        defaultValue: '"in.txt"',
        required: true
      },
      {
        name: 'destination',
        label: 'Destination',
        type: 'expression',
        defaultValue: '"out.txt"',
        required: true
      },
      {
        name: 'overwrite',
        label: 'Overwrite',
        type: 'boolean',
        defaultValue: true
      }
    ]
  },
  {
    type: 'System.RenameFile',
    displayName: 'Rename File',
    category: 'System',
    description: 'Renames a file (optionally moving it).',
    icon: '$(edit)',
    color: '#64748B',
    properties: [
      {
        name: 'path',
        label: 'File',
        type: 'expression',
        defaultValue: '"old.txt"',
        required: true
      },
      {
        name: 'newName',
        label: 'New Name',
        type: 'expression',
        defaultValue: '"new.txt"',
        required: true
      }
    ]
  },
  {
    type: 'System.Matches',
    displayName: 'Matches',
    category: 'System',
    description: 'Finds all regex matches in a text (dry-run returns match strings).',
    icon: '$(search)',
    color: '#3B82F6',
    properties: [
      {
        name: 'input',
        label: 'Input',
        type: 'expression',
        defaultValue: 'text',
        required: true
      },
      {
        name: 'pattern',
        label: 'Pattern',
        type: 'expression',
        defaultValue: '"\\\\w+"',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'matches',
        required: true
      }
    ]
  },
  {
    type: 'System.IsMatch',
    displayName: 'Is Match',
    category: 'System',
    description: 'Tests whether text matches a regex pattern.',
    icon: '$(search)',
    color: '#3B82F6',
    properties: [
      {
        name: 'input',
        label: 'Input',
        type: 'expression',
        defaultValue: 'text',
        required: true
      },
      {
        name: 'pattern',
        label: 'Pattern',
        type: 'expression',
        defaultValue: '"\\\\d+"',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'isMatch',
        required: true
      }
    ]
  },
  {
    type: 'System.Replace',
    displayName: 'Replace',
    category: 'System',
    description: 'Regex replace in a text string.',
    icon: '$(find-replace)',
    color: '#3B82F6',
    properties: [
      {
        name: 'input',
        label: 'Input',
        type: 'expression',
        defaultValue: 'text',
        required: true
      },
      {
        name: 'pattern',
        label: 'Pattern',
        type: 'expression',
        defaultValue: '"\\\\s+"',
        required: true
      },
      {
        name: 'replacement',
        label: 'Replacement',
        type: 'expression',
        defaultValue: '" "',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'replaced',
        required: true
      }
    ]
  },
  {
    type: 'System.KillProcess',
    displayName: 'Kill Process',
    category: 'System',
    description: 'Terminates a process by name (simulated in dry-run).',
    icon: '$(close)',
    color: '#EF4444',
    properties: [
      {
        name: 'processName',
        label: 'Process Name',
        type: 'expression',
        defaultValue: '"notepad"',
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
    type: 'Programming.MultipleAssign',
    displayName: 'Multiple Assign',
    category: 'Programming',
    description: 'Assigns values to multiple variables in one step (one pair per line: name = value).',
    icon: '$(symbol-namespace)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'assignments',
        label: 'Assignments',
        type: 'multiline',
        defaultValue: 'counter = 0\nstatus = "Ready"',
        required: true,
        description: 'One assignment per line: variable = expression'
      }
    ]
  },
  {
    type: 'Programming.InvokeCode',
    displayName: 'Invoke Code',
    category: 'Programming',
    description: 'Runs VB.NET or C# code (simulated in dry-run; real execution in Studio/Robot).',
    icon: '$(code)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'code',
        label: 'Code',
        type: 'multiline',
        defaultValue: 'Console.WriteLine("Hello from Invoke Code");',
        required: true
      },
      {
        name: 'language',
        label: 'Language',
        type: 'enum',
        options: ['VBNet', 'CSharp'],
        defaultValue: 'CSharp'
      },
      {
        name: 'arguments',
        label: 'Arguments',
        type: 'multiline',
        defaultValue: '',
        description: 'Optional In/Out argument names (comma or line separated)'
      }
    ]
  },
  {
    type: 'System.Throw',
    displayName: 'Throw',
    category: 'System',
    description: 'Throws an exception (BusinessRuleException / SystemException style).',
    icon: '$(error)',
    color: '#EF4444',
    properties: [
      {
        name: 'exceptionType',
        label: 'Exception Type',
        type: 'enum',
        options: ['System.Exception', 'BusinessRuleException', 'SystemException'],
        defaultValue: 'System.Exception',
        required: true
      },
      {
        name: 'message',
        label: 'Message',
        type: 'expression',
        defaultValue: '"An error occurred"',
        required: true
      }
    ]
  },
  {
    type: 'System.TerminateWorkflow',
    displayName: 'Terminate Workflow',
    category: 'System',
    description: 'Stops the workflow with a reason (End Process style).',
    icon: '$(debug-stop)',
    color: '#EF4444',
    properties: [
      {
        name: 'reason',
        label: 'Reason',
        type: 'expression',
        defaultValue: '"Terminated"',
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
    type: 'ControlFlow.Continue',
    displayName: 'Continue',
    category: 'Control Flow',
    description: 'Skips to the next iteration of the nearest loop.',
    icon: '$(debug-continue)',
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
    type: 'ControlFlow.Switch',
    displayName: 'Switch',
    category: 'Control Flow',
    description: 'Branches on an expression value (cases listed as comma-separated labels).',
    icon: '$(type-hierarchy-sub)',
    color: '#F59E0B',
    container: true,
    properties: [
      {
        name: 'expression',
        label: 'Expression',
        type: 'expression',
        defaultValue: 'status',
        required: true
      },
      {
        name: 'cases',
        label: 'Cases',
        type: 'string',
        defaultValue: 'Success,Failed,Default',
        description: 'Comma-separated case labels (Default is the fallback)'
      }
    ]
  },
  {
    type: 'ControlFlow.Parallel',
    displayName: 'Parallel',
    category: 'Control Flow',
    description: 'Runs child branches conceptually in parallel (dry-run runs them sequentially with a warning).',
    icon: '$(split-horizontal)',
    color: '#F59E0B',
    container: true,
    properties: []
  },
  {
    type: 'ControlFlow.ParallelForEach',
    displayName: 'Parallel For Each',
    category: 'Control Flow',
    description: 'Iterates a collection in parallel conceptually (dry-run is sequential with a warning).',
    icon: '$(list-tree)',
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
    type: 'ControlFlow.TimeoutScope',
    displayName: 'Timeout Scope',
    category: 'Control Flow',
    description: 'Runs children with a timeout budget (dry-run logs timeout; does not cancel mid-activity).',
    icon: '$(watch)',
    color: '#EF4444',
    container: true,
    properties: [
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000,
        required: true
      }
    ]
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
    type: 'UI.UseApplicationBrowser',
    displayName: 'Use Application/Browser',
    category: 'UI Automation',
    description:
      'Modern UI scope (Studio Web: Use Browser). Opens/attaches a browser or app; nested UI activities run inside. Exports as NApplicationCard + TargetApp.',
    icon: '$(browser)',
    color: '#059669',
    container: true,
    properties: [
      {
        name: 'mode',
        label: 'Mode',
        type: 'enum',
        options: ['Browser', 'Application'],
        defaultValue: 'Browser'
      },
      {
        name: 'urlOrPath',
        label: 'URL / Path',
        type: 'string',
        defaultValue: 'https://example.com',
        required: true,
        description: 'Browser: page URL. Application: .exe path.'
      },
      {
        name: 'browserType',
        label: 'Browser',
        type: 'enum',
        options: ['Chrome', 'Edge', 'Firefox', 'IE'],
        defaultValue: 'Chrome',
        description: 'Used when Mode = Browser.'
      },
      { ...SCOPE_INPUT_METHOD_PROP },
      {
        name: 'selector',
        label: 'Window Selector (optional)',
        type: 'multiline',
        defaultValue: '',
        description: 'Attach to an already-open window. Leave empty to open URL/path. Capture on Windows.'
      },
      {
        name: 'open',
        label: 'Open',
        type: 'enum',
        options: ['IfNotOpen', 'Always', 'Never'],
        defaultValue: 'IfNotOpen'
      },
      {
        name: 'close',
        label: 'Close',
        type: 'enum',
        options: ['Never', 'Always', 'IfOpenedByAppCard'],
        defaultValue: 'Never'
      }
    ]
  },
  {
    type: 'UI.Click',
    displayName: 'Click',
    category: 'UI Automation',
    description: 'Clicks a Windows UI / browser target using a classic UiPath selector.',
    icon: '$(inspect)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
        required: true,
        description: 'Classic UiPath selector (<html>/<webctrl> or <wnd>). Use Selector Builder or capture on Windows.'
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector (advanced)',
        type: 'multiline',
        defaultValue: '',
        description: 'Optional FullSelectorEncoding from Studio — leave blank if using classic selector.'
      },
      {
        name: 'clickType',
        label: 'Click Type',
        type: 'enum',
        options: ['Single', 'Double', 'Right'],
        defaultValue: 'Single'
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000,
        description: 'How long to wait for the target before failing.'
      },
      { ...UI_INPUT_METHOD_PROP, defaultValue: 'Simulate' }
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
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
        required: true,
        description: 'Classic UiPath selector. Use Selector Builder or capture on Windows.'
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector (advanced)',
        type: 'multiline',
        defaultValue: '',
        description: 'Optional FullSelectorEncoding from Studio — leave blank if using classic selector.'
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
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000
      },
      { ...UI_INPUT_METHOD_PROP, defaultValue: 'Simulate' }
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
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
        required: true
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector (advanced)',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'extractedText',
        required: true
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000
      },
      { ...UI_INPUT_METHOD_PROP, defaultValue: 'Simulate' }
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
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
        required: true
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector (advanced)',
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
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
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
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000
      },
      { ...UI_INPUT_METHOD_PROP }
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
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
        required: true
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000
      },
      { ...UI_INPUT_METHOD_PROP }
    ]
  },
  {
    type: 'UI.SendHotkey',
    displayName: 'Send Hotkey',
    category: 'UI Automation',
    description: 'Sends a keyboard shortcut (Send Hotkey / Keyboard Shortcuts).',
    icon: '$(keyboard)',
    color: '#10B981',
    properties: [
      {
        name: 'key',
        label: 'Key / Shortcut',
        type: 'expression',
        defaultValue: '"enter"',
        required: true,
        description: 'e.g. enter, tab, ctrl+s, or a Keyboard Shortcuts string'
      },
      {
        name: 'selector',
        label: 'Selector (optional)',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000
      },
      { ...UI_INPUT_METHOD_PROP }
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
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
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
      },
      { ...UI_INPUT_METHOD_PROP }
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
    type: 'UI.GetAttribute',
    displayName: 'Get Attribute',
    category: 'UI Automation',
    description: 'Reads a UI element attribute into a variable.',
    icon: '$(symbol-property)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
        required: true
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector (JSON)',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'attribute',
        label: 'Attribute',
        type: 'string',
        defaultValue: 'aaname',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'attributeValue',
        required: true
      }
    ]
  },
  {
    type: 'UI.WaitElement',
    displayName: 'Wait Element',
    category: 'UI Automation',
    description: 'Waits for an element to appear or vanish (simulated delay in dry-run).',
    icon: '$(watch)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
        required: true
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector (JSON)',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'action',
        label: 'Wait For',
        type: 'enum',
        options: ['Appear', 'Vanish'],
        defaultValue: 'Appear'
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000
      }
    ]
  },
  {
    type: 'UI.ExtractTableData',
    displayName: 'Extract Table Data',
    category: 'UI Automation',
    description:
      'Smart extraction of a table from the page into a DataTable (Windows UI Automation Extract Table Data).',
    icon: '$(table)',
    color: '#10B981',
    properties: [
      {
        name: 'selector',
        label: 'Table Selector (Windows)',
        type: 'multiline',
        defaultValue: '',
        required: true,
        description: 'Classic UiPath selector for the table/grid root. Capture on Windows.'
      },
      {
        name: 'selectorModern',
        label: 'Modern Selector (advanced)',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'extractionMetadata',
        label: 'Extraction Metadata (JSON)',
        type: 'multiline',
        defaultValue: '',
        description:
          'Optional UiPath column map JSON. Leave empty when Smart Extraction is on — Studio will infer columns.'
      },
      {
        name: 'includeHeaders',
        label: 'Include Headers',
        type: 'boolean',
        defaultValue: true
      },
      {
        name: 'maxResults',
        label: 'Max Results',
        type: 'number',
        defaultValue: 100
      },
      {
        name: 'smartExtraction',
        label: 'Smart Extraction',
        type: 'boolean',
        defaultValue: true,
        description: 'Infer columns from the page table when metadata is incomplete.'
      },
      {
        name: 'result',
        label: 'Result DataTable',
        type: 'expression',
        defaultValue: 'extractedTable',
        required: true
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
    description:
      'Creates an in-memory table structure. Windows-only in UiPath — Studio Web (Portable) Save rewrites to New DataTable + Add Data Column.',
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
    type: 'Data.AddDataRow',
    displayName: 'Add Data Row',
    category: 'Data',
    description: 'Appends a row (array values) to a DataTable.',
    icon: '$(add)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'arrayRow',
        label: 'Array Row',
        type: 'expression',
        defaultValue: '["A", "1", "New"]',
        required: true,
        description: 'JSON array or expression of row values'
      }
    ]
  },
  {
    type: 'Data.AddDataColumn',
    displayName: 'Add Data Column',
    category: 'Data',
    description: 'Adds a column to a DataTable.',
    icon: '$(diff-added)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'columnName',
        label: 'Column Name',
        type: 'string',
        defaultValue: 'NewColumn',
        required: true
      },
      {
        name: 'columnType',
        label: 'Column Type',
        type: 'enum',
        options: ['String', 'Int32', 'Boolean', 'Double', 'Object'],
        defaultValue: 'String'
      }
    ]
  },
  {
    type: 'Data.FilterDataTable',
    displayName: 'Filter Data Table',
    category: 'Data',
    description: 'Filters rows from a DataTable into an output table (simple column/value match in dry-run).',
    icon: '$(filter)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'Input DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'columnName',
        label: 'Column',
        type: 'string',
        defaultValue: 'Status',
        required: true
      },
      {
        name: 'operator',
        label: 'Operator',
        type: 'enum',
        options: ['=', '!=', 'Contains', 'StartsWith', '>', '<'],
        defaultValue: '='
      },
      {
        name: 'value',
        label: 'Value',
        type: 'expression',
        defaultValue: '"Success"',
        required: true
      },
      {
        name: 'result',
        label: 'Output DataTable',
        type: 'expression',
        defaultValue: 'filteredDt',
        required: true
      }
    ]
  },
  {
    type: 'Data.ForEachRow',
    displayName: 'For Each Row',
    category: 'Data',
    description: 'Iterates each row of a DataTable (up to 5 rows in dry-run).',
    icon: '$(arrow-swap)',
    color: '#06B6D4',
    container: true,
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'row',
        label: 'Current Row',
        type: 'expression',
        defaultValue: 'row',
        required: true
      }
    ]
  },
  {
    type: 'Data.ClearDataTable',
    displayName: 'Clear Data Table',
    category: 'Data',
    description: 'Removes all rows from a DataTable.',
    icon: '$(clear-all)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      }
    ]
  },
  {
    type: 'Data.OutputDataTable',
    displayName: 'Output Data Table',
    category: 'Data',
    description: 'Converts a DataTable to a string (CSV-like) for logging.',
    icon: '$(export)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'tableText',
        required: true
      }
    ]
  },
  {
    type: 'Data.MergeDataTable',
    displayName: 'Merge Data Table',
    category: 'Data',
    description: 'Merges a source DataTable into a destination DataTable.',
    icon: '$(git-merge)',
    color: '#06B6D4',
    properties: [
      {
        name: 'destination',
        label: 'Destination',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'source',
        label: 'Source',
        type: 'expression',
        defaultValue: 'dtSource',
        required: true
      },
      {
        name: 'missingSchemaAction',
        label: 'Missing Schema Action',
        type: 'enum',
        options: ['Add', 'Ignore', 'Error', 'AddWithKey'],
        defaultValue: 'Add'
      }
    ]
  },
  {
    type: 'Data.RemoveDataRow',
    displayName: 'Remove Data Row',
    category: 'Data',
    description: 'Removes a row from a DataTable by index.',
    icon: '$(trash)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'rowIndex',
        label: 'Row Index',
        type: 'expression',
        defaultValue: '0',
        required: true
      }
    ]
  },
  {
    type: 'Data.RemoveDataColumn',
    displayName: 'Remove Data Column',
    category: 'Data',
    description: 'Removes a column from a DataTable by name.',
    icon: '$(trash)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'columnName',
        label: 'Column Name',
        type: 'string',
        defaultValue: 'Column1',
        required: true
      }
    ]
  },
  {
    type: 'Data.GetRowItem',
    displayName: 'Get Row Item',
    category: 'Data',
    description: 'Reads a cell value from a DataRow.',
    icon: '$(symbol-field)',
    color: '#06B6D4',
    properties: [
      {
        name: 'row',
        label: 'Row',
        type: 'expression',
        defaultValue: 'row',
        required: true
      },
      {
        name: 'columnName',
        label: 'Column',
        type: 'string',
        defaultValue: 'Column1',
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
    type: 'Data.UpdateRowItem',
    displayName: 'Update Row Item',
    category: 'Data',
    description: 'Writes a cell value on a DataRow.',
    icon: '$(edit)',
    color: '#06B6D4',
    properties: [
      {
        name: 'row',
        label: 'Row',
        type: 'expression',
        defaultValue: 'row',
        required: true
      },
      {
        name: 'columnName',
        label: 'Column',
        type: 'string',
        defaultValue: 'Column1',
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
    type: 'Data.JoinDataTable',
    displayName: 'Join Data Tables',
    category: 'Data',
    description: 'Joins two DataTables on a key column (inner join in dry-run).',
    icon: '$(git-merge)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable1',
        label: 'DataTable 1',
        type: 'expression',
        defaultValue: 'dtLeft',
        required: true
      },
      {
        name: 'dataTable2',
        label: 'DataTable 2',
        type: 'expression',
        defaultValue: 'dtRight',
        required: true
      },
      {
        name: 'joinType',
        label: 'Join Type',
        type: 'enum',
        options: ['Inner', 'Left', 'Full'],
        defaultValue: 'Inner'
      },
      {
        name: 'column1',
        label: 'Column (Table 1)',
        type: 'string',
        defaultValue: 'Id',
        required: true
      },
      {
        name: 'column2',
        label: 'Column (Table 2)',
        type: 'string',
        defaultValue: 'Id',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'joinedDt',
        required: true
      }
    ]
  },
  {
    type: 'Data.LookupDataTable',
    displayName: 'Lookup Data Table',
    category: 'Data',
    description: 'Looks up a value in a DataTable column and returns a cell from another column.',
    icon: '$(search)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'lookupColumn',
        label: 'Lookup Column',
        type: 'string',
        defaultValue: 'Id',
        required: true
      },
      {
        name: 'lookupValue',
        label: 'Lookup Value',
        type: 'expression',
        defaultValue: '""',
        required: true
      },
      {
        name: 'targetColumn',
        label: 'Target Column',
        type: 'string',
        defaultValue: 'Name',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'lookupResult',
        required: true
      }
    ]
  },
  {
    type: 'Data.SortDataTable',
    displayName: 'Sort Data Table',
    category: 'Data',
    description: 'Sorts a DataTable by a column.',
    icon: '$(arrow-both)',
    color: '#06B6D4',
    properties: [
      {
        name: 'dataTable',
        label: 'DataTable',
        type: 'expression',
        defaultValue: 'dt',
        required: true
      },
      {
        name: 'columnName',
        label: 'Column',
        type: 'string',
        defaultValue: 'Id',
        required: true
      },
      {
        name: 'order',
        label: 'Order',
        type: 'enum',
        options: ['Ascending', 'Descending'],
        defaultValue: 'Ascending'
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'sortedDt',
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
    type: 'Excel.AppendRange',
    displayName: 'Excel Append Range',
    category: 'Excel',
    description: 'Appends a DataTable to the end of an Excel sheet.',
    icon: '$(add)',
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
    type: 'Excel.ExcelApplicationScope',
    displayName: 'Excel Application Scope',
    category: 'Excel',
    description: 'Opens a workbook once and runs nested Excel activities (classic scope for Studio Web).',
    icon: '$(file)',
    color: '#16A34A',
    container: true,
    properties: [
      {
        name: 'workbookPath',
        label: 'Workbook Path',
        type: 'string',
        defaultValue: 'Data/Input/data.xlsx',
        required: true
      },
      {
        name: 'createIfNotExists',
        label: 'Create If Not Exists',
        type: 'boolean',
        defaultValue: true
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
    description: 'Calls an HTTP endpoint with optional auth/headers; stores body and status.',
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
        name: 'headers',
        label: 'Headers',
        type: 'multiline',
        defaultValue: '',
        description: 'One header per line: Name: Value'
      },
      {
        name: 'authType',
        label: 'Auth',
        type: 'enum',
        options: ['None', 'Bearer', 'Basic'],
        defaultValue: 'None'
      },
      {
        name: 'token',
        label: 'Bearer Token / Password',
        type: 'expression',
        defaultValue: '""',
        description: 'Bearer token, or Basic password (with Username).'
      },
      {
        name: 'username',
        label: 'Username (Basic)',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'body',
        label: 'Body',
        type: 'multiline',
        defaultValue: ''
      },
      {
        name: 'result',
        label: 'Result (body)',
        type: 'expression',
        defaultValue: 'response'
      },
      {
        name: 'statusCode',
        label: 'Status Code',
        type: 'expression',
        defaultValue: 'statusCode',
        description: 'Variable to store HTTP status code from dry-run / robot.'
      }
    ]
  },
  {
    type: 'Messaging.GetEmail',
    displayName: 'Get Email',
    category: 'Messaging',
    description: 'Retrieves mail messages (IMAP/Outlook-style; simulated in dry-run).',
    icon: '$(inbox)',
    color: '#EC4899',
    properties: [
      {
        name: 'mailFolder',
        label: 'Mail Folder',
        type: 'string',
        defaultValue: 'Inbox'
      },
      {
        name: 'top',
        label: 'Top',
        type: 'number',
        defaultValue: 10
      },
      {
        name: 'filter',
        label: 'Filter',
        type: 'string',
        defaultValue: '',
        description: 'Optional subject/from filter expression.'
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'mails',
        required: true
      }
    ]
  },
  {
    type: 'Messaging.SelectToken',
    displayName: 'Select Token (JSON Path)',
    category: 'Messaging',
    description: 'Selects a value from JSON using a simple path (e.g. data.items[0].id).',
    icon: '$(symbol-namespace)',
    color: '#EC4899',
    properties: [
      {
        name: 'json',
        label: 'JSON / Object',
        type: 'expression',
        defaultValue: 'jsonObj',
        required: true
      },
      {
        name: 'path',
        label: 'Path',
        type: 'string',
        defaultValue: 'data.id',
        required: true,
        description: 'Dot path with optional [index], e.g. items[0].name'
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'tokenValue',
        required: true
      }
    ]
  },
  {
    type: 'Messaging.DeserializeJson',
    displayName: 'Deserialize JSON',
    category: 'Messaging',
    description: 'Parses a JSON string into an object (dry-run uses JSON.parse).',
    icon: '$(json)',
    color: '#EC4899',
    properties: [
      {
        name: 'jsonString',
        label: 'JSON String',
        type: 'expression',
        defaultValue: '"{\\"ok\\":true}"',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'jsonObj',
        required: true
      }
    ]
  },
  {
    type: 'Messaging.SerializeJson',
    displayName: 'Serialize JSON',
    category: 'Messaging',
    description: 'Serializes an object to a JSON string.',
    icon: '$(bracket-dot)',
    color: '#EC4899',
    properties: [
      {
        name: 'value',
        label: 'Value',
        type: 'expression',
        defaultValue: 'jsonObj',
        required: true
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'jsonText',
        required: true
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
    type: 'Flowchart.FlowSwitch',
    displayName: 'Flow Switch',
    category: 'Flowchart',
    description: 'Multi-branch flowchart switch (expression → labeled outgoing links).',
    icon: '$(type-hierarchy-sub)',
    color: '#F59E0B',
    properties: [
      {
        name: 'expression',
        label: 'Expression',
        type: 'expression',
        defaultValue: 'key',
        required: true
      },
      {
        name: 'cases',
        label: 'Cases (comma-separated labels)',
        type: 'string',
        defaultValue: 'A,B,Default'
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
        name: 'argumentMappings',
        label: 'Arguments (name = expression)',
        type: 'multiline',
        defaultValue: '',
        description:
          'One mapping per line, e.g. in_Config = Config. Exported as InvokeWorkflowFile.Arguments.'
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
    type: 'Orchestrator.GetTransactionItem',
    displayName: 'Get Transaction Item',
    category: 'Orchestrator',
    description: 'Gets the next queue item (Get Queue Item). Dry-run uses scenario fixtures.',
    icon: '$(inbox)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'queueName',
        label: 'Queue Name',
        type: 'string',
        defaultValue: 'MainQueue',
        required: true
      },
      {
        name: 'folderPath',
        label: 'Folder Path',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'reference',
        label: 'Reference',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'result',
        label: 'Transaction Item',
        type: 'expression',
        defaultValue: 'TransactionItem',
        required: true
      }
    ]
  },
  {
    type: 'Orchestrator.WaitQueueItem',
    displayName: 'Wait Queue Item',
    category: 'Orchestrator',
    description: 'Waits for the next queue item (timeout in dry-run uses fixtures).',
    icon: '$(watch)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'queueName',
        label: 'Queue Name',
        type: 'string',
        defaultValue: 'MainQueue',
        required: true
      },
      {
        name: 'folderPath',
        label: 'Folder Path',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 60000
      },
      {
        name: 'result',
        label: 'Transaction Item',
        type: 'expression',
        defaultValue: 'TransactionItem',
        required: true
      }
    ]
  },
  {
    type: 'Orchestrator.AddQueueItem',
    displayName: 'Add Queue Item',
    category: 'Orchestrator',
    description: 'Adds an item to an Orchestrator queue.',
    icon: '$(add)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'queueName',
        label: 'Queue Name',
        type: 'string',
        defaultValue: 'MainQueue',
        required: true
      },
      {
        name: 'folderPath',
        label: 'Folder Path',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'reference',
        label: 'Reference',
        type: 'expression',
        defaultValue: '""'
      },
      {
        name: 'itemInformation',
        label: 'Item Information (JSON)',
        type: 'multiline',
        defaultValue: '{\n  "Name": "Sample"\n}',
        description: 'Specific content as JSON object / expression.'
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'enum',
        options: ['Low', 'Normal', 'High'],
        defaultValue: 'Normal'
      }
    ]
  },
  {
    type: 'Orchestrator.GetAsset',
    displayName: 'Get Asset',
    category: 'Orchestrator',
    description: 'Reads an Orchestrator asset value (dry-run uses Config Assets / fixtures).',
    icon: '$(key)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'assetName',
        label: 'Asset Name',
        type: 'string',
        defaultValue: 'AssetName',
        required: true
      },
      {
        name: 'folderPath',
        label: 'Folder Path',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'result',
        label: 'Result',
        type: 'expression',
        defaultValue: 'assetValue',
        required: true
      }
    ]
  },
  {
    type: 'Orchestrator.GetCredential',
    displayName: 'Get Credential',
    category: 'Orchestrator',
    description: 'Reads an Orchestrator credential asset (username/password; simulated in dry-run).',
    icon: '$(lock)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'assetName',
        label: 'Credential Name',
        type: 'string',
        defaultValue: 'Credential',
        required: true
      },
      {
        name: 'folderPath',
        label: 'Folder Path',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'username',
        label: 'Username',
        type: 'expression',
        defaultValue: 'username',
        required: true
      },
      {
        name: 'password',
        label: 'Password',
        type: 'expression',
        defaultValue: 'password',
        required: true
      }
    ]
  },
  {
    type: 'Orchestrator.SetAsset',
    displayName: 'Set Asset',
    category: 'Orchestrator',
    description: 'Updates an Orchestrator asset value (simulated in dry-run).',
    icon: '$(key)',
    color: '#8B5CF6',
    properties: [
      {
        name: 'assetName',
        label: 'Asset Name',
        type: 'string',
        defaultValue: 'AssetName',
        required: true
      },
      {
        name: 'value',
        label: 'Value',
        type: 'expression',
        defaultValue: '""',
        required: true
      },
      {
        name: 'folderPath',
        label: 'Folder Path',
        type: 'string',
        defaultValue: ''
      }
    ]
  },
  {
    type: 'REFramework.SetTransactionStatus',
    displayName: 'Set Transaction Status',
    category: 'REFramework',
    description: 'Marks the current Orchestrator transaction Success / Business / System exception.',
    icon: '$(checklist)',
    color: '#0EA5E9',
    properties: [
      {
        name: 'transactionItem',
        label: 'Transaction Item',
        type: 'expression',
        defaultValue: 'TransactionItem',
        required: true
      },
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
  const varBinding = (name: string) =>
    /^(to|result|item|row|values|argumentMappings)$/i.test(name) || /dataTable/i.test(name);
  for (const prop of def.properties) {
    // Leave variable bindings blank — do not auto-create / prefill dt, result, etc.
    properties[prop.name] = varBinding(prop.name) ? '' : prop.defaultValue ?? '';
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
