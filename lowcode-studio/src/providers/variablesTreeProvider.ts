import * as vscode from 'vscode';
import { WorkflowDocument, WorkflowVariable } from '../models/workflow';

export class VariablesTreeProvider implements vscode.TreeDataProvider<VariableTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    VariableTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private variables: WorkflowVariable[] = [];
  private workflowName = 'No workflow open';

  setWorkflow(doc: WorkflowDocument | undefined): void {
    if (!doc) {
      this.variables = [];
      this.workflowName = 'No workflow open';
    } else {
      this.variables = doc.variables || [];
      this.workflowName = doc.name;
    }
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: VariableTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: VariableTreeItem): VariableTreeItem[] {
    if (element) {
      return [];
    }

    if (!this.variables.length) {
      return [
        new VariableTreeItem(
          this.workflowName === 'No workflow open'
            ? 'Open a .lcs.json workflow'
            : 'No variables — click + to add',
          '',
          'info'
        )
      ];
    }

    return this.variables.map(
      (v) =>
        new VariableTreeItem(
          v.name,
          `${v.type}${v.defaultValue !== undefined ? ` = ${JSON.stringify(v.defaultValue)}` : ''}`,
          'variable',
          v
        )
    );
  }
}

export class VariableTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    contextValue: 'variable' | 'info',
    public readonly variable?: WorkflowVariable
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = contextValue;
    this.iconPath = new vscode.ThemeIcon(
      contextValue === 'variable' ? 'symbol-variable' : 'info'
    );
  }
}
