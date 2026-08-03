import * as vscode from 'vscode';
import {
  ActivityDefinition,
  getActivityCatalog,
  groupActivitiesByCategory
} from '../models/activities';

export class ActivityTreeProvider implements vscode.TreeDataProvider<ActivityTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    ActivityTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ActivityTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ActivityTreeItem): ActivityTreeItem[] {
    if (!element) {
      return [...groupActivitiesByCategory().keys()].map(
        (category) =>
          new ActivityTreeItem(
            category,
            category,
            vscode.TreeItemCollapsibleState.Expanded,
            'category'
          )
      );
    }

    if (element.contextValue === 'category') {
      return getActivityCatalog()
        .filter((a) => a.category === element.category)
        .map(
          (activity) =>
            new ActivityTreeItem(
              activity.displayName,
              activity.category,
              vscode.TreeItemCollapsibleState.None,
              'activity',
              activity
            )
        );
    }

    return [];
  }
}

export class ActivityTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly category: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue: 'category' | 'activity',
    public readonly activity?: ActivityDefinition
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    this.tooltip = activity?.description || category;
    this.description = activity ? activity.type : undefined;
    this.iconPath = new vscode.ThemeIcon(
      contextValue === 'category' ? 'folder' : iconName(activity?.icon)
    );

    if (activity) {
      this.command = {
        command: 'lowcodeStudio.insertActivity',
        title: 'Insert Activity',
        arguments: [activity.type]
      };
    }
  }
}

function iconName(codicon?: string): string {
  if (!codicon) {
    return 'symbol-event';
  }
  return codicon.replace('$(', '').replace(')', '');
}
