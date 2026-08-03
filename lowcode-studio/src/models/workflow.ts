export type WorkflowType = 'Sequence' | 'Flowchart';

export type VariableType =
  | 'String'
  | 'Int32'
  | 'Boolean'
  | 'Double'
  | 'Object'
  | 'DataTable'
  | 'Array';

export type ArgumentDirection = 'In' | 'Out' | 'InOut';

export interface WorkflowVariable {
  name: string;
  type: VariableType;
  defaultValue?: unknown;
  scope?: string;
  description?: string;
}

export interface WorkflowArgument {
  name: string;
  type: VariableType | string;
  direction: ArgumentDirection;
  defaultValue?: unknown;
}

export interface ActivityNode {
  id: string;
  type: string;
  displayName: string;
  properties: Record<string, unknown>;
  children?: ActivityNode[];
  elseChildren?: ActivityNode[];
}

export interface WorkflowDocument {
  schemaVersion: '1.0';
  name: string;
  description?: string;
  type: WorkflowType;
  variables: WorkflowVariable[];
  arguments: WorkflowArgument[];
  activities: ActivityNode[];
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
  };
}

export interface ProjectManifest {
  schemaVersion: '1.0';
  name: string;
  description?: string;
  main: string;
  workflows: string[];
  createdAt: string;
}

export function createEmptyWorkflow(
  name: string,
  type: WorkflowType = 'Sequence'
): WorkflowDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: '1.0',
    name,
    description: '',
    type,
    variables: [],
    arguments: [],
    activities: [
      {
        id: newId(),
        type: 'System.LogMessage',
        displayName: 'Log Message',
        properties: {
          message: `"Hello from ${name}"`,
          level: 'Info'
        }
      }
    ],
    metadata: {
      createdAt: now,
      updatedAt: now
    }
  };
}

export function createProjectManifest(name: string, mainWorkflow: string): ProjectManifest {
  return {
    schemaVersion: '1.0',
    name,
    description: `${name} LowCode Studio project`,
    main: mainWorkflow,
    workflows: [mainWorkflow],
    createdAt: new Date().toISOString()
  };
}

export function newId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseWorkflow(text: string): WorkflowDocument {
  const raw = JSON.parse(text) as WorkflowDocument;
  if (!raw || raw.schemaVersion !== '1.0' || !Array.isArray(raw.activities)) {
    throw new Error('Invalid LowCode Studio workflow document.');
  }
  return {
    schemaVersion: '1.0',
    name: raw.name || 'Untitled',
    description: raw.description || '',
    type: raw.type === 'Flowchart' ? 'Flowchart' : 'Sequence',
    variables: Array.isArray(raw.variables) ? raw.variables : [],
    arguments: Array.isArray(raw.arguments) ? raw.arguments : [],
    activities: raw.activities,
    metadata: raw.metadata || {}
  };
}

export function stringifyWorkflow(doc: WorkflowDocument): string {
  const updated: WorkflowDocument = {
    ...doc,
    metadata: {
      ...doc.metadata,
      updatedAt: new Date().toISOString(),
      createdAt: doc.metadata?.createdAt || new Date().toISOString()
    }
  };
  return JSON.stringify(updated, null, 2) + '\n';
}
