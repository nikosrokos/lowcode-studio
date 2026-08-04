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
            'No project yet — use New REFramework Project',
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
          template?: string;
        };
        const dir = path.dirname(element.resourcePath);
        const items: ProjectTreeItem[] = [];

        // Hero actions — dry-run + Studio Web first
        items.push(
          actionItem(
            '▶ Dry Run Scenarios',
            dir,
            'lowcodeStudio.dryRunScenario',
            'beaker',
            'Run Data/Test/scenarios.json'
          )
        );
        items.push(
          actionItem(
            '✎ Manage Scenarios',
            dir,
            'lowcodeStudio.manageScenarios',
            'checklist',
            'Add / duplicate / open scenarios'
          )
        );
        items.push(
          actionItem(
            '☁ Connect to Studio Web',
            dir,
            'lowcodeStudio.connectStudioWeb',
            'cloud-upload',
            'Export Portable project + open studio.uipath.com'
          )
        );

        const configJson = path.join(dir, 'Data', 'Config.json');
        if (fs.existsSync(configJson)) {
          items.push(fileItem('Data/Config.json', configJson, 'settings-gear'));
        }
        const scenarios = path.join(dir, 'Data', 'Test', 'scenarios.json');
        if (fs.existsSync(scenarios)) {
          items.push(fileItem('Data/Test/scenarios.json', scenarios, 'beaker'));
        }

        const workflows = manifest.workflows || [];
        for (const wf of workflows) {
          const full = path.join(dir, wf);
          const item = new ProjectTreeItem(
            wf,
            full,
            vscode.TreeItemCollapsibleState.None,
            'workflow'
          );
          item.description = wf === manifest.main ? 'main' : undefined;
          item.command = {
            command: 'vscode.openWith',
            title: 'Open Designer',
            arguments: [vscode.Uri.file(full), 'lowcodeStudio.workflowEditor']
          };
          item.iconPath = new vscode.ThemeIcon('file-code');
          items.push(item);
        }
        return items;
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
    contextValue: 'project' | 'workflow' | 'info' | 'action' | 'file'
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    if (contextValue === 'project') {
      this.iconPath = new vscode.ThemeIcon('root-folder');
      this.tooltip = resourcePath;
    }
  }
}

function actionItem(
  label: string,
  projectDir: string,
  command: string,
  icon: string,
  tooltip: string
): ProjectTreeItem {
  const item = new ProjectTreeItem(
    label,
    projectDir,
    vscode.TreeItemCollapsibleState.None,
    'action'
  );
  item.command = { command, title: label };
  item.iconPath = new vscode.ThemeIcon(icon);
  item.tooltip = tooltip;
  return item;
}

function fileItem(label: string, fullPath: string, icon: string): ProjectTreeItem {
  const item = new ProjectTreeItem(
    label,
    fullPath,
    vscode.TreeItemCollapsibleState.None,
    'file'
  );
  item.command = {
    command: 'vscode.open',
    title: 'Open',
    arguments: [vscode.Uri.file(fullPath)]
  };
  item.iconPath = new vscode.ThemeIcon(icon);
  return item;
}
