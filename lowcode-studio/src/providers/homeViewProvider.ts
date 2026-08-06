import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  getStudioWebLocalLink,
  getStudioWebLocalSyncStatus
} from '../interop/studioWebLocal';
import { isLcsProjectDir } from '../interop/projectResolve';
import { parseChangelogSections } from '../util/changelogParse';
import {
  enrichRecentProjects,
  pushRecentProject,
  readRecentProjects,
  RECENT_PROJECTS_KEY
} from '../util/recentProjects';
import { getHomeHtml, HOME_NEXT_STEPS, HomeScreenModel } from '../webview/homeHtml';

/**
 * Activity-bar Home webview + optional editor-tab Home panel.
 */
export class HomeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'lowcodeStudio.home';
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;
  private visibilityListener?: (visible: boolean) => void;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly resolveProjectDir: () => string | undefined,
    private readonly onCommand: (command: string) => void | Promise<void>,
    private readonly onOpenRecent: (projectPath: string) => void | Promise<void>
  ) {}

  setVisibilityListener(listener: (visible: boolean) => void): void {
    this.visibilityListener = listener;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    webviewView.onDidChangeVisibility(() => {
      this.visibilityListener?.(webviewView.visible);
      if (webviewView.visible) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    if (this.view) {
      this.view.webview.html = this.renderHtml(this.view.webview);
    }
    if (this.panel) {
      this.panel.webview.html = this.renderHtml(this.panel.webview);
    }
  }

  /** Focus the sidebar Home webview (preferred when clicking the activity icon). */
  async focusSidebar(): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.view.extension.lowcodeStudio');
    } catch {
      // ignore
    }
    try {
      await vscode.commands.executeCommand('lowcodeStudio.home.focus');
    } catch {
      // ignore
    }
    try {
      this.view?.show?.(false);
    } catch {
      // ignore
    }
    this.refresh();
  }

  async showPanel(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.refresh();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(
      'lowcodeStudio.homePanel',
      'LowCode Studio Home',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );
    this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.png');
    this.panel.webview.html = this.renderHtml(this.panel.webview);
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  rememberProject(projectDir: string, name?: string): void {
    if (!projectDir || !isLcsProjectDir(projectDir)) {
      return;
    }
    const prev = readRecentProjects(this.context.globalState.get(RECENT_PROJECTS_KEY));
    const next = pushRecentProject(prev, projectDir, name);
    void this.context.globalState.update(RECENT_PROJECTS_KEY, next);
    this.refresh();
  }

  private handleMessage(msg: {
    type?: string;
    command?: string;
    path?: string;
  }): void {
    if (msg?.type === 'command' && msg.command) {
      void this.onCommand(msg.command);
      return;
    }
    if (msg?.type === 'openRecent' && msg.path) {
      void this.onOpenRecent(msg.path);
    }
  }

  private buildModel(): HomeScreenModel {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.context.extensionPath, 'package.json'), 'utf8')
    ) as { version?: string };
    const changelogPath = path.join(this.context.extensionPath, 'CHANGELOG.md');
    let changelog = parseChangelogSections(
      fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '',
      4
    );
    changelog = changelog.map((s) => ({
      version: s.version,
      body: s.body.length > 900 ? s.body.slice(0, 900) + '…' : s.body
    }));

    const projectDir = this.resolveProjectDir();
    let projectName: string | undefined;
    let studioWebLinked = false;
    let studioWebSolution: string | undefined;
    let syncBadge: HomeScreenModel['syncBadge'] = 'unlinked';
    let syncSummary = 'Not linked to Studio Web Local Workspace';
    if (projectDir && isLcsProjectDir(projectDir)) {
      try {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8')
        ) as { name?: string };
        projectName = manifest.name || path.basename(projectDir);
      } catch {
        projectName = path.basename(projectDir);
      }
      const link = getStudioWebLocalLink(projectDir);
      const status = getStudioWebLocalSyncStatus(projectDir);
      syncSummary = status.summary;
      if (link) {
        studioWebLinked = true;
        studioWebSolution = path.basename(link.solutionDir);
      }
      if (status.linked && status.inSync) {
        syncBadge = 'ok';
      } else if (status.linked) {
        syncBadge = 'stale';
      }
    }

    const recent = enrichRecentProjects(
      readRecentProjects(this.context.globalState.get(RECENT_PROJECTS_KEY))
    );

    return {
      version: packageJson.version || '0.0.0',
      projectName,
      projectPath: projectDir,
      studioWebLinked,
      studioWebSolution,
      syncBadge,
      syncSummary,
      recent,
      changelog,
      nextSteps: HOME_NEXT_STEPS
    };
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = String(Date.now()) + Math.random().toString(36).slice(2);
    const logoUri = webview
      .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'logo.png'))
      .toString();
    return getHomeHtml(nonce, webview.cspSource, logoUri, this.buildModel());
  }
}
