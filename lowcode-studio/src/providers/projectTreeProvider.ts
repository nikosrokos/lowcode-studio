import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    ProjectTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly workspaceRoot: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectTreeItem): ProjectTreeItem[] {
    if (!this.workspaceRoot) {
      return [
        new ProjectTreeItem(
          'Open a folder to start a LowCode Studio project',
          '',
          vscode.TreeItemCollapsibleState.None,
          'info'
        )
      ];
    }

    if (!element) {
      const projects = this.findProjects(this.workspaceRoot);
      if (!projects.length) {
        return [
          new ProjectTreeItem(
            'No project yet — use New Project',
            this.workspaceRoot,
            vscode.TreeItemCollapsibleState.None,
            'info'
          )
        ];
      }
      return projects.map(
        (p) =>
          new ProjectTreeItem(
            path.basename(path.dirname(p)),
            p,
            vscode.TreeItemCollapsibleState.Expanded,
            'project'
          )
      );
    }

    if (element.contextValue === 'project') {
      try {
        const manifest = JSON.parse(fs.readFileSync(element.resourcePath, 'utf8')) as {
          workflows?: string[];
          main?: string;
        };
        const dir = path.dirname(element.resourcePath);
        const workflows = manifest.workflows || [];
        return workflows.map((wf) => {
          const full = path.join(dir, wf);
          const item = new ProjectTreeItem(
            wf,
            full,
            vscode.TreeItemCollapsibleState.None,
            'workflow'
          );
          item.description = wf === manifest.main ? 'main' : undefined;
          item.command = {
            command: 'vscode.open',
            title: 'Open Workflow',
            arguments: [vscode.Uri.file(full)]
          };
          item.iconPath = new vscode.ThemeIcon('file-code');
          return item;
        });
      } catch {
        return [
          new ProjectTreeItem(
            'Invalid project.json',
            element.resourcePath,
            vscode.TreeItemCollapsibleState.None,
            'info'
          )
        ];
      }
    }

    return [];
  }

  private findProjects(root: string): string[] {
    const results: string[] = [];
    const stack = [root];
    while (stack.length) {
      const current = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out') {
          continue;
        }
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile() && entry.name === 'project.json') {
          try {
            const content = JSON.parse(fs.readFileSync(full, 'utf8')) as {
              schemaVersion?: string;
            };
            if (content.schemaVersion === '1.0') {
              results.push(full);
            }
          } catch {
            // ignore non-studio project.json files
          }
        }
      }
    }
    return results.sort();
  }
}

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly resourcePath: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue: 'project' | 'workflow' | 'info'
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    if (contextValue === 'project') {
      this.iconPath = new vscode.ThemeIcon('root-folder');
      this.tooltip = resourcePath;
    }
  }
}
