import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getStudioWebLocalLink } from '../interop/studioWebLocal';
import { isLcsProjectDir } from '../interop/projectResolve';
import { parseChangelogSections } from '../util/changelogParse';
import { getHomeHtml, HOME_NEXT_STEPS, HomeScreenModel } from '../webview/homeHtml';

/**
 * Activity-bar Home webview + optional editor-tab Home panel.
 * Clicking the LowCode Studio activity icon shows this view first.
 */
export class HomeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'lowcodeStudio.home';
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly resolveProjectDir: () => string | undefined,
    private readonly onCommand: (command: string) => void | Promise<void>
  ) {}

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

  private handleMessage(msg: { type?: string; command?: string }): void {
    if (msg?.type === 'command' && msg.command) {
      void this.onCommand(msg.command);
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
    // Keep bodies short on the home cards
    changelog = changelog.map((s) => ({
      version: s.version,
      body: s.body.length > 900 ? s.body.slice(0, 900) + '…' : s.body
    }));

    const projectDir = this.resolveProjectDir();
    let projectName: string | undefined;
    let studioWebLinked = false;
    let studioWebSolution: string | undefined;
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
      if (link) {
        studioWebLinked = true;
        studioWebSolution = path.basename(link.solutionDir);
      }
    }

    return {
      version: packageJson.version || '0.0.0',
      projectName,
      projectPath: projectDir,
      studioWebLinked,
      studioWebSolution,
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
