import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

type ItemKind = 'project' | 'folder' | 'workflow' | 'file' | 'info' | 'solution';

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    ProjectTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private activeProjectDir: string | undefined;

  constructor(_workspaceRoot?: string) {
    // workspace roots are read live so Open Local Project refreshes correctly
  }

  setActiveProject(projectDir: string | undefined): void {
    this.activeProjectDir = projectDir;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private workspaceRoots(): string[] {
    return (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
  }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectTreeItem): ProjectTreeItem[] {
    const roots = this.workspaceRoots();
    if (!roots.length) {
      return [
        (() => {
          const tip = new ProjectTreeItem(
            'Open Local Project (title bar) or File → Open Folder',
            '',
            vscode.TreeItemCollapsibleState.None,
            'info'
          );
          tip.command = {
            command: 'lowcodeStudio.openLocalProject',
            title: 'Open Local Project'
          };
          return tip;
        })()
      ];
    }

    if (!element) {
      const projects = roots.flatMap((root) => this.findProjects(root));
      const unique = [...new Set(projects)].sort();
      const items: ProjectTreeItem[] = [];

      if (!unique.length) {
        items.push(
          new ProjectTreeItem(
            'No LCS project yet — Open Local Project or New REFramework',
            roots[0],
            vscode.TreeItemCollapsibleState.None,
            'info'
          )
        );
      } else {
        for (const p of unique) {
          const dir = path.dirname(p);
          const item = new ProjectTreeItem(
            path.basename(dir),
            p,
            vscode.TreeItemCollapsibleState.Expanded,
            'project'
          );
          if (
            this.activeProjectDir &&
            path.resolve(this.activeProjectDir) === path.resolve(dir)
          ) {
            item.description = 'active';
            item.iconPath = new vscode.ThemeIcon('root-folder-opened');
          }
          item.command = {
            command: 'lowcodeStudio.setActiveProject',
            title: 'Set Active Project',
            arguments: [item]
          };
          items.push(item);

          // Show linked Studio Web Local Workspace under the active/each project
          const linked = readLinkedSolution(dir);
          if (linked) {
            const sol = new ProjectTreeItem(
              `${path.basename(linked)} (Studio Web)`,
              linked,
              vscode.TreeItemCollapsibleState.Collapsed,
              'solution'
            );
            sol.description = 'linked';
            sol.iconPath = new vscode.ThemeIcon('cloud');
            sol.tooltip = linked;
            items.push(sol);
          }
        }
      }

      // Workspace folders that are Studio Web solutions (opened via Connect) but not LCS
      for (const root of roots) {
        if (findUipx(root) && !unique.some((p) => path.resolve(path.dirname(p)) === path.resolve(root))) {
          const already = items.some(
            (i) => i.contextValue === 'solution' && path.resolve(i.resourcePath) === path.resolve(root)
          );
          if (!already) {
            const sol = new ProjectTreeItem(
              `${path.basename(root)} (Studio Web)`,
              root,
              vscode.TreeItemCollapsibleState.Collapsed,
              'solution'
            );
            sol.iconPath = new vscode.ThemeIcon('cloud');
            sol.tooltip = root;
            items.push(sol);
          }
        }
      }

      return items;
    }

    if (element.contextValue === 'project') {
      const dir = path.dirname(element.resourcePath);
      const items: ProjectTreeItem[] = [];

      const folders = collectProjectFolders(dir);
      for (const folder of folders) {
        items.push(
          new ProjectTreeItem(
            folder.name,
            folder.path,
            vscode.TreeItemCollapsibleState.Expanded,
            'folder'
          )
        );
      }

      for (const file of listRootProjectFiles(dir)) {
        items.push(fileTreeItem(file.label, file.path, file.kind));
      }
      return items;
    }

    if (element.contextValue === 'solution') {
      return listSolutionChildren(element.resourcePath);
    }

    if (element.contextValue === 'folder') {
      return listFolderChildren(element.resourcePath);
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
            // ignore
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
    contextValue: ItemKind
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    if (contextValue === 'project') {
      this.iconPath = new vscode.ThemeIcon('root-folder');
      this.tooltip = resourcePath;
    } else if (contextValue === 'folder') {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.tooltip = resourcePath;
    } else if (contextValue === 'solution') {
      this.iconPath = new vscode.ThemeIcon('cloud');
      this.tooltip = resourcePath;
    }
  }
}

function readLinkedSolution(lcsProjectDir: string): string | undefined {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(lcsProjectDir, 'project.json'), 'utf8')
    ) as { studioWebLocal?: { solutionDir?: string } };
    const dir = manifest.studioWebLocal?.solutionDir;
    return dir && fs.existsSync(dir) ? dir : undefined;
  } catch {
    return undefined;
  }
}

function findUipx(solutionDir: string): string | undefined {
  try {
    const named = path.join(solutionDir, `${path.basename(solutionDir)}.uipx`);
    if (fs.existsSync(named)) {
      return named;
    }
    const hit = fs.readdirSync(solutionDir).find((f) => f.endsWith('.uipx'));
    return hit ? path.join(solutionDir, hit) : undefined;
  } catch {
    return undefined;
  }
}

function fileTreeItem(
  label: string,
  fullPath: string,
  kind: 'workflow' | 'file'
): ProjectTreeItem {
  const item = new ProjectTreeItem(
    label,
    fullPath,
    vscode.TreeItemCollapsibleState.None,
    kind
  );
  if (kind === 'workflow') {
    item.command = {
      command: 'vscode.openWith',
      title: 'Open Designer',
      arguments: [vscode.Uri.file(fullPath), 'lowcodeStudio.workflowEditor']
    };
    item.iconPath = new vscode.ThemeIcon('file-code');
  } else {
    item.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [vscode.Uri.file(fullPath)]
    };
    item.iconPath = new vscode.ThemeIcon(
      fullPath.endsWith('.xlsx')
        ? 'file-binary'
        : fullPath.endsWith('scenarios.json')
          ? 'beaker'
          : fullPath.endsWith('.uipx')
            ? 'json'
            : fullPath.endsWith('.xaml')
              ? 'file-code'
              : 'settings-gear'
    );
  }
  return item;
}

function collectProjectFolders(projectDir: string): Array<{ name: string; path: string }> {
  const preferred = ['Framework', 'Data', 'Tests', 'Test', 'Library', 'Libraries'];
  const found: Array<{ name: string; path: string }> = [];
  for (const name of preferred) {
    const full = path.join(projectDir, name);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      found.push({ name, path: full });
    }
  }
  try {
    for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (preferred.includes(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      if (entry.name === 'node_modules' || entry.name === 'out' || entry.name.endsWith('.StudioWeb')) {
        continue;
      }
      const full = path.join(projectDir, entry.name);
      if (dirHasProjectContent(full)) {
        found.push({ name: entry.name, path: full });
      }
    }
  } catch {
    // ignore
  }
  return found;
}

function dirHasProjectContent(dir: string): boolean {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && (entry.name.endsWith('.lcs.json') || entry.name.endsWith('.json') || entry.name.endsWith('.xlsx') || entry.name.endsWith('.xaml'))) {
        return true;
      }
      if (entry.isDirectory()) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function listRootProjectFiles(
  projectDir: string
): Array<{ label: string; path: string; kind: 'workflow' | 'file' }> {
  const results: Array<{ label: string; path: string; kind: 'workflow' | 'file' }> = [];
  try {
    for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      const full = path.join(projectDir, entry.name);
      if (entry.name.endsWith('.lcs.json')) {
        results.push({ label: entry.name, path: full, kind: 'workflow' });
      } else if (
        entry.name === 'activities.custom.json' ||
        entry.name === 'project.json'
      ) {
        results.push({ label: entry.name, path: full, kind: 'file' });
      }
    }
  } catch {
    // ignore
  }
  return results.sort((a, b) => a.label.localeCompare(b.label));
}

function listSolutionChildren(solutionDir: string): ProjectTreeItem[] {
  const items: ProjectTreeItem[] = [];
  try {
    for (const entry of fs.readdirSync(solutionDir, { withFileTypes: true })) {
      const full = path.join(solutionDir, entry.name);
      if (entry.isDirectory()) {
        items.push(
          new ProjectTreeItem(
            entry.name,
            full,
            vscode.TreeItemCollapsibleState.Collapsed,
            'folder'
          )
        );
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.uipx') ||
          entry.name.endsWith('.json') ||
          entry.name.endsWith('.md') ||
          entry.name.endsWith('.xaml'))
      ) {
        items.push(fileTreeItem(entry.name, full, entry.name.endsWith('.xaml') ? 'workflow' : 'file'));
      }
    }
  } catch {
    // ignore
  }
  return items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function listFolderChildren(folderPath: string): ProjectTreeItem[] {
  const items: ProjectTreeItem[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return items;
  }

  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = entries
    .filter((e) => e.isFile())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const d of dirs) {
    const full = path.join(folderPath, d.name);
    items.push(
      new ProjectTreeItem(d.name, full, vscode.TreeItemCollapsibleState.Expanded, 'folder')
    );
  }
  for (const f of files) {
    if (f.name === '.gitkeep') {
      continue;
    }
    const full = path.join(folderPath, f.name);
    if (f.name.endsWith('.lcs.json') || f.name.endsWith('.xaml')) {
      items.push(fileTreeItem(f.name, full, 'workflow'));
    } else if (
      f.name.endsWith('.json') ||
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.md') ||
      f.name.endsWith('.csv') ||
      f.name.endsWith('.uipx')
    ) {
      items.push(fileTreeItem(f.name, full, 'file'));
    }
  }
  return items;
}
