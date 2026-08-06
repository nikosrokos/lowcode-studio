import { normalizeWorkflowDocument } from '../interop/activityNormalize';

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
  /** Flowchart canvas position */
  x?: number;
  y?: number;
  /** Custom accent color (hex), overrides activity-type default */
  color?: string;
}

export interface FlowConnection {
  id: string;
  from: string;
  to: string;
  /** Optional label such as True / False / Default */
  label?: string;
}

export interface WorkflowDocument {
  schemaVersion: '1.0';
  name: string;
  description?: string;
  type: WorkflowType;
  variables: WorkflowVariable[];
  arguments: WorkflowArgument[];
  activities: ActivityNode[];
  /** Used when type === Flowchart */
  connections?: FlowConnection[];
  startActivityId?: string;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    template?: string;
  };
}

export type ProjectTemplate = 'blank' | 'reframework' | 'blueprint';

export interface ProjectManifest {
  schemaVersion: '1.0';
  name: string;
  description?: string;
  main: string;
  workflows: string[];
  template?: ProjectTemplate;
  /** Set when template === 'blueprint' (web-scrape-excel, …) */
  blueprintId?: string;
  createdAt: string;
  /** UiPath NuGet activity packages preserved from import / used on Studio Web export */
  uipathDependencies?: Record<string, string>;
  /**
   * UiPath compatibility for Connect / Export.
   * Windows (default) = run on Windows robots with classic UI selectors.
   * Portable = cross-platform / cloud-friendly.
   */
  uipathTargetFramework?: 'Windows' | 'Portable';
  /**
   * Linked Studio Web Local Workspace solution (sync-on-save target).
   */
  studioWebLocal?: {
    solutionDir: string;
    projectFolder: string;
    solutionId: string;
    projectId: string;
  };
}

export function createEmptyWorkflow(
  name: string,
  type: WorkflowType = 'Sequence'
): WorkflowDocument {
  const now = new Date().toISOString();
  if (type === 'Flowchart') {
    const startId = newId();
    const logId = newId();
    return {
      schemaVersion: '1.0',
      name,
      description: '',
      type: 'Flowchart',
      variables: [],
      arguments: [],
      startActivityId: startId,
      activities: [
        {
          id: startId,
          type: 'Flowchart.Start',
          displayName: 'Start',
          properties: {},
          x: 280,
          y: 40
        },
        {
          id: logId,
          type: 'System.LogMessage',
          displayName: 'Log Message',
          properties: {
            message: `"Hello from ${name}"`,
            level: 'Info'
          },
          x: 240,
          y: 160
        }
      ],
      connections: [
        {
          id: newId('conn'),
          from: startId,
          to: logId,
          label: ''
        }
      ],
      metadata: {
        createdAt: now,
        updatedAt: now
      }
    };
  }

  return {
    schemaVersion: '1.0',
    name,
    description: '',
    type: 'Sequence',
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

export function createProjectManifest(
  name: string,
  mainWorkflow: string,
  workflows: string[] = [mainWorkflow],
  template: ProjectTemplate = 'blank'
): ProjectManifest {
  return {
    schemaVersion: '1.0',
    name,
    description:
      template === 'reframework'
        ? `${name} — UiPath-style REFramework project (Windows target)`
        : template === 'blueprint'
          ? `${name} — Robot blueprint project (Windows target)`
          : `${name} LowCode Studio project (Windows target)`,
    main: mainWorkflow,
    workflows,
    template,
    createdAt: new Date().toISOString(),
    uipathTargetFramework: 'Windows'
  };
}

export function newId(prefix = 'act'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseWorkflow(text: string): WorkflowDocument {
  const raw = JSON.parse(text) as WorkflowDocument;
  if (!raw || raw.schemaVersion !== '1.0' || !Array.isArray(raw.activities)) {
    throw new Error('Invalid LowCode Studio workflow document.');
  }
  return normalizeWorkflowDocument({
    schemaVersion: '1.0',
    name: raw.name || 'Untitled',
    description: raw.description || '',
    type: raw.type === 'Flowchart' ? 'Flowchart' : 'Sequence',
    variables: Array.isArray(raw.variables) ? raw.variables : [],
    arguments: Array.isArray(raw.arguments) ? raw.arguments : [],
    activities: raw.activities.map((a) => normalizeActivity(a)),
    connections: Array.isArray(raw.connections) ? raw.connections : [],
    startActivityId: raw.startActivityId,
    metadata: raw.metadata || {}
  });
}

function normalizeActivity(a: ActivityNode): ActivityNode {
  return {
    ...a,
    x: typeof a.x === 'number' ? a.x : undefined,
    y: typeof a.y === 'number' ? a.y : undefined,
    color: typeof a.color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(a.color)
      ? a.color
      : undefined,
    children: Array.isArray(a.children) ? a.children.map(normalizeActivity) : a.children,
    elseChildren: Array.isArray(a.elseChildren)
      ? a.elseChildren.map(normalizeActivity)
      : a.elseChildren
  };
}

export function stringifyWorkflow(doc: WorkflowDocument): string {
  const updated: WorkflowDocument = {
    ...doc,
    connections: doc.type === 'Flowchart' ? doc.connections || [] : doc.connections,
    metadata: {
      ...doc.metadata,
      updatedAt: new Date().toISOString(),
      createdAt: doc.metadata?.createdAt || new Date().toISOString()
    }
  };
  return JSON.stringify(updated, null, 2) + '\n';
}
