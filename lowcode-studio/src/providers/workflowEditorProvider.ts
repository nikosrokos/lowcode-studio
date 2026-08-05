import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getActivityCatalog } from '../models/activities';
import {
  parseWorkflow,
  stringifyWorkflow,
  WorkflowDocument
} from '../models/workflow';
import {
  DryRunResult,
  dryRunWorkflow,
  formatDryRunReport,
  validateWorkflow
} from '../commands/simulator';
import { DesignerSettings, getDesignerHtml } from '../webview/designerHtml';
import {
  getLowCodeOutput,
  logNotification,
  logRunReport
} from '../util/outputChannel';
import {
  ACTIVITY_FAVORITES_KEY,
  ACTIVITY_RECENT_KEY,
  ActivityPaletteState,
  MAX_PINNED_FAVORITES,
  MAX_RECENT,
  normalizeActivityList,
  pushRecent,
  toggleFavorite
} from '../interop/activityPalette';
import { buildPropertySuggestions } from '../interop/propertySuggestions';
import {
  buildCurrentProjectTree,
  findProjectRoot
} from '../interop/projectResolve';
import { trySyncToStudioWebLocal } from '../interop/studioWebLocal';

export class WorkflowEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'lowcodeStudio.workflowEditor';

  private activePanel: vscode.WebviewPanel | undefined;
  private activeDocument: vscode.TextDocument | undefined;
  private lastSyncLabel = '';
  /** Designer Save will sync after document.save(); skip the parallel onDidSave sync. */
  private readonly skipNextDidSaveSync = new Set<string>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onWorkflowChanged: (doc: WorkflowDocument | undefined) => void
  ) {}

  getActiveDocumentPath(): string | undefined {
    return this.activeDocument?.uri.fsPath;
  }

  /** True if designer Save will handle sync — extension onDidSave should skip. */
  consumeSkipDidSaveSync(fsPath: string): boolean {
    if (this.skipNextDidSaveSync.has(fsPath)) {
      this.skipNextDidSaveSync.delete(fsPath);
      return true;
    }
    return false;
  }

  /**
   * After Save: rewrite linked Studio Web Local Workspace .xaml / project.json
   * so Studio Web Local Workspace reads the latest files on disk.
   */
  private async syncLinkedStudioWebLocal(document: vscode.TextDocument): Promise<void> {
    this.lastSyncLabel = '';
    const syncOnSave = vscode.workspace
      .getConfiguration('lowcodeStudio')
      .get<boolean>('syncStudioWebOnSave', true);
    if (!syncOnSave) {
      return;
    }
    const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
    if (!projectRoot) {
      return;
    }
    try {
      const rel = path.relative(projectRoot, document.uri.fsPath).replace(/\\/g, '/');
      const overrides =
        rel.endsWith('.lcs.json') && !rel.startsWith('..')
          ? { [rel]: document.getText() }
          : undefined;
      const synced = trySyncToStudioWebLocal(projectRoot, {
        contentOverrides: overrides
      });
      if (synced) {
        this.lastSyncLabel = path.basename(synced.link.solutionDir);
        void vscode.window.setStatusBarMessage(
          `Synced → Studio Web Local (${this.lastSyncLabel}) · ${synced.files.filter((f) => f.endsWith('.xaml')).length} xaml`,
          3500
        );
      }
    } catch (err) {
      void vscode.window.showWarningMessage(
        err instanceof Error
          ? `Studio Web Local sync failed: ${err.message}`
          : 'Studio Web Local sync failed'
      );
    }
  }

  /**
   * Ask the designer webview for the latest in-memory workflow before Cmd+S / native save.
   */
  private flushWebviewBeforeSave(document: vscode.TextDocument): Thenable<void> {
    const panel = this.activePanel;
    if (!panel || this.activeDocument?.uri.toString() !== document.uri.toString()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        resolve();
      }, 400);
      const disposable = panel.webview.onDidReceiveMessage(async (message) => {
        if (message?.type !== 'flushState' || !message.workflow) {
          return;
        }
        clearTimeout(timeout);
        disposable.dispose();
        try {
          await this.updateTextDocument(document, message.workflow as WorkflowDocument);
          this.onWorkflowChanged(message.workflow as WorkflowDocument);
        } finally {
          resolve();
        }
      });
      panel.webview.postMessage({ type: 'requestFlush' });
    });
  }

  refreshProjectTree(): void {
    if (!this.activePanel) {
      return;
    }
    this.activePanel.webview.postMessage({
      type: 'projectTree',
      projects: this.buildProjectTree()
    });
  }

  private buildProjectTree() {
    const active = this.context.workspaceState.get<string>('lowcodeStudio.activeProjectDir');
    const docPath = this.activeDocument?.uri.fsPath;
    const fromDoc = docPath ? findProjectRoot(path.dirname(docPath)) : undefined;
    return buildCurrentProjectTree(fromDoc || active);
  }

  get activeWorkflow(): WorkflowDocument | undefined {
    if (!this.activeDocument) {
      return undefined;
    }
    try {
      return parseWorkflow(this.activeDocument.getText());
    } catch {
      return undefined;
    }
  }

  getPaletteState(): ActivityPaletteState {
    return {
      favorites: normalizeActivityList(
        this.context.globalState.get<string[]>(ACTIVITY_FAVORITES_KEY),
        MAX_PINNED_FAVORITES
      ),
      recent: normalizeActivityList(
        this.context.globalState.get<string[]>(ACTIVITY_RECENT_KEY),
        MAX_RECENT
      )
    };
  }

  async rememberActivityUse(activityType: string): Promise<void> {
    const state = this.getPaletteState();
    const recent = pushRecent(state.recent, activityType);
    await this.context.globalState.update(ACTIVITY_RECENT_KEY, recent);
    this.activePanel?.webview.postMessage({
      type: 'paletteState',
      palette: { ...state, recent }
    });
  }

  async toggleActivityFavorite(activityType: string): Promise<string[]> {
    const state = this.getPaletteState();
    const favorites = toggleFavorite(state.favorites, activityType);
    await this.context.globalState.update(ACTIVITY_FAVORITES_KEY, favorites);
    this.activePanel?.webview.postMessage({
      type: 'paletteState',
      palette: { ...state, favorites }
    });
    return favorites;
  }

  openActivityPalette(): void {
    if (!this.activePanel) {
      vscode.window.showInformationMessage(
        'Open a .lcs.json workflow in the LowCode Studio designer first.'
      );
      return;
    }
    this.activePanel.webview.postMessage({ type: 'openActivityPalette' });
  }

  insertActivity(activityType: string): void {
    if (!this.activePanel) {
      vscode.window.showInformationMessage(
        'Open a .lcs.json workflow in the LowCode Studio designer first.'
      );
      return;
    }
    void this.rememberActivityUse(activityType);
    this.activePanel.webview.postMessage({
      type: 'insertActivity',
      activityType
    });
  }

  playDryRun(result: DryRunResult): void {
    if (!this.activePanel) {
      vscode.window.showInformationMessage(
        'Open a .lcs.json workflow in the LowCode Studio designer to step through.'
      );
      return;
    }
    this.activePanel.webview.postMessage({
      type: 'dryRunPlayback',
      result
    });
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.activePanel = webviewPanel;
    this.activeDocument = document;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    const updateWebview = () => {
      try {
        const workflow = parseWorkflow(document.getText());
        webviewPanel.webview.html = this.getHtml(
          webviewPanel.webview,
          workflow,
          document
        );
        this.onWorkflowChanged(workflow);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        webviewPanel.webview.html = this.getErrorHtml(message);
        this.onWorkflowChanged(undefined);
      }
    };

    updateWebview();

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length) {
        // External edits only — ignore our own writes by checking focused webview edits via flag
      }
    });

    const willSaveSubscription = vscode.workspace.onWillSaveTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) {
        return;
      }
      if (this.activePanel !== webviewPanel) {
        return;
      }
      e.waitUntil(this.flushWebviewBeforeSave(e.document));
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      willSaveSubscription.dispose();
      if (this.activePanel === webviewPanel) {
        this.activePanel = undefined;
        this.activeDocument = undefined;
        this.onWorkflowChanged(undefined);
      }
    });

    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        this.activePanel = webviewPanel;
        this.activeDocument = document;
        try {
          this.onWorkflowChanged(parseWorkflow(document.getText()));
        } catch {
          this.onWorkflowChanged(undefined);
        }
        const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
        if (projectRoot) {
          void vscode.commands.executeCommand('lowcodeStudio.setActiveProject', projectRoot);
        }
      }
    });

    // Selecting/opening a workflow marks its project active
    const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
    if (projectRoot) {
      void vscode.commands.executeCommand('lowcodeStudio.setActiveProject', projectRoot);
    }

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'edit': {
          const workflow = message.workflow as WorkflowDocument;
          await this.updateTextDocument(document, workflow);
          this.onWorkflowChanged(workflow);
          break;
        }
        case 'save': {
          // Flush latest designer state before disk save (Save button may not have persisted last keystroke)
          if (message.workflow) {
            await this.updateTextDocument(document, message.workflow as WorkflowDocument);
            this.onWorkflowChanged(message.workflow as WorkflowDocument);
          }
          // Claim sync so onDidSaveTextDocument does not race with a disk-only sync
          this.skipNextDidSaveSync.add(document.uri.fsPath);
          await document.save();
          await this.syncLinkedStudioWebLocal(document);
          const linked = Boolean(this.lastSyncLabel);
          const saveMsg = linked
            ? `Saved · synced .xaml → ${this.lastSyncLabel}`
            : 'Saved · not linked — Connect to Studio Web to sync .xaml';
          logNotification(saveMsg, true);
          webviewPanel.webview.postMessage({
            type: 'toast',
            message: saveMsg,
            logged: true
          });
          break;
        }
        case 'flushState': {
          if (message.workflow) {
            await this.updateTextDocument(document, message.workflow as WorkflowDocument);
            this.onWorkflowChanged(message.workflow as WorkflowDocument);
          }
          break;
        }
        case 'log': {
          const msg = String(message.message || '').trim();
          if (msg) {
            logNotification(msg, Boolean(message.show));
          }
          break;
        }
        case 'validate': {
          const issues = validateWorkflow(message.workflow as WorkflowDocument);
          if (!issues.length) {
            logNotification(`Validation OK — ${document.fileName}`, true);
            vscode.window.showInformationMessage('Workflow is valid.');
            webviewPanel.webview.postMessage({
              type: 'toast',
              message: 'Workflow is valid',
              logged: true
            });
          } else {
            const errors = issues.filter((i) => i.severity === 'error').length;
            const warnings = issues.filter((i) => i.severity === 'warning').length;
            const lines = [`Validation for ${document.fileName}`];
            for (const issue of issues) {
              lines.push(
                `[${issue.severity}] ${issue.activityId ? issue.activityId + ' — ' : ''}${issue.message}`
              );
            }
            logRunReport(`Validation — ${errors} error(s), ${warnings} warning(s)`, lines, true);
            vscode.window.showWarningMessage(
              `Validation: ${errors} error(s), ${warnings} warning(s). See LowCode Studio output.`
            );
          }
          break;
        }
        case 'dryRun': {
          const result = dryRunWorkflow(message.workflow as WorkflowDocument, {
            fixtures: message.fixtures,
            initialVariables: message.initialVariables
          });
          const title = message.runToActivityId
            ? `Dry Run (run-to-here) — ${document.fileName}`
            : message.stepThrough
              ? `Step-through — ${document.fileName}`
              : `Dry Run — ${document.fileName}`;
          const reportLines = [
            formatDryRunReport(result, title),
            '',
            'Log:',
            ...result.log
          ];
          // formatDryRunReport already has title; flatten for channel
          getLowCodeOutput().clear();
          for (const line of reportLines.join('\n').split('\n')) {
            getLowCodeOutput().appendLine(line);
          }
          getLowCodeOutput().show(true);
          logNotification(
            `${title}: ${result.ok ? 'OK' : 'ERRORS'} · ${result.steps.length} steps` +
              (result.warnings.length ? ` · ${result.warnings.length} warning(s)` : '')
          );
          const stepThrough = Boolean(message.stepThrough);
          if (stepThrough) {
            webviewPanel.webview.postMessage({
              type: 'dryRunPlayback',
              result,
              runToActivityId: message.runToActivityId || undefined,
              breakpoints: message.breakpoints || undefined
            });
            vscode.window.showInformationMessage(
              `Step-through ready (${result.steps.length} steps). Use Step / Continue in the designer — see Output for the full log.`
            );
          } else {
            webviewPanel.webview.postMessage({
              type: 'dryRunDone',
              result
            });
            vscode.window.showInformationMessage(
              result.ok
                ? `Dry run completed (${result.steps.length} steps${result.warnings.length ? `, ${result.warnings.length} warning(s)` : ''}). See Output.`
                : 'Dry run finished with errors. See Output.'
            );
          }
          break;
        }
        case 'variablesChanged': {
          try {
            const workflow = parseWorkflow(document.getText());
            workflow.variables = message.variables;
            this.onWorkflowChanged(workflow);
          } catch {
            // ignore
          }
          break;
        }
        case 'argumentsChanged': {
          try {
            const workflow = parseWorkflow(document.getText());
            const args = message.workflowArguments ?? message.arguments;
            if (Array.isArray(args)) {
              workflow.arguments = args;
              await this.updateTextDocument(document, workflow);
              this.onWorkflowChanged(workflow);
            }
          } catch {
            // ignore
          }
          break;
        }
        case 'openWorkflow': {
          await this.openInvokedWorkflow(document, String(message.workflowPath || ''));
          break;
        }
        case 'openProjectFile': {
          const filePath = String(message.path || '');
          if (!filePath || !fs.existsSync(filePath)) {
            vscode.window.showWarningMessage('File not found in project explorer.');
            break;
          }
          const projectDir = findProjectRoot(
            fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath)
          );
          if (projectDir) {
            await vscode.commands.executeCommand('lowcodeStudio.setActiveProject', projectDir);
          }
          if (filePath.endsWith('.lcs.json')) {
            await vscode.commands.executeCommand(
              'vscode.openWith',
              vscode.Uri.file(filePath),
              WorkflowEditorProvider.viewType,
              { preview: false }
            );
          } else if (!fs.statSync(filePath).isDirectory()) {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(doc, { preview: true });
          }
          break;
        }
        case 'setActiveProject': {
          const dir = String(message.path || '');
          if (dir) {
            await vscode.commands.executeCommand('lowcodeStudio.setActiveProject', dir);
          }
          break;
        }
        case 'revealInOs': {
          const revealPath = String(message.path || '');
          if (revealPath && fs.existsSync(revealPath)) {
            await vscode.commands.executeCommand(
              'revealFileInOS',
              vscode.Uri.file(revealPath)
            );
          }
          break;
        }
        case 'removeFromExplorer': {
          await vscode.commands.executeCommand(
            'lowcodeStudio.removeFromExplorer',
            String(message.path || ''),
            String(message.kind || '')
          );
          this.refreshProjectTree();
          break;
        }
        case 'activityUsed': {
          await this.rememberActivityUse(String(message.activityType || ''));
          break;
        }
        case 'toggleFavorite': {
          const favorites = await this.toggleActivityFavorite(
            String(message.activityType || '')
          );
          const pinned = favorites.includes(String(message.activityType || ''));
          webviewPanel.webview.postMessage({
            type: 'toast',
            message: pinned ? 'Pinned to favorites' : 'Removed from favorites'
          });
          break;
        }
        case 'updateSettings': {
          await this.applyDesignerSettings(message.settings as Partial<DesignerSettings>);
          webviewPanel.webview.postMessage({
            type: 'settings',
            settings: this.readDesignerSettings()
          });
          webviewPanel.webview.postMessage({
            type: 'toast',
            message: 'Settings saved'
          });
          break;
        }
        case 'ready':
          webviewPanel.webview.postMessage({
            type: 'settings',
            settings: this.readDesignerSettings()
          });
          break;
      }
    });
  }

  private readDesignerSettings(): DesignerSettings {
    const cfg = vscode.workspace.getConfiguration('lowcodeStudio');
    const workflowType = cfg.get<string>('defaultWorkflowType', 'Sequence');
    const framework = cfg.get<string>('uipathTargetFramework', 'Windows');
    const canvasStyle = cfg.get<string>('canvasStyle', 'plain');
    return {
      showLineNumbers: cfg.get<boolean>('showLineNumbers', true),
      defaultWorkflowType: workflowType === 'Flowchart' ? 'Flowchart' : 'Sequence',
      autoOpenDesigner: cfg.get<boolean>('autoOpenDesigner', true),
      syncStudioWebOnSave: cfg.get<boolean>('syncStudioWebOnSave', true),
      uipathTargetFramework: framework === 'Portable' ? 'Portable' : 'Windows',
      canvasStyle: canvasStyle === 'dots' ? 'dots' : 'plain'
    };
  }

  private async applyDesignerSettings(
    patch: Partial<DesignerSettings> | undefined
  ): Promise<void> {
    if (!patch || typeof patch !== 'object') {
      return;
    }
    const cfg = vscode.workspace.getConfiguration('lowcodeStudio');
    const entries: Array<[keyof DesignerSettings, unknown]> = [
      ['showLineNumbers', patch.showLineNumbers],
      ['defaultWorkflowType', patch.defaultWorkflowType],
      ['autoOpenDesigner', patch.autoOpenDesigner],
      ['syncStudioWebOnSave', patch.syncStudioWebOnSave],
      ['uipathTargetFramework', patch.uipathTargetFramework],
      ['canvasStyle', patch.canvasStyle]
    ];
    for (const [key, value] of entries) {
      if (value === undefined) {
        continue;
      }
      await cfg.update(key, value, vscode.ConfigurationTarget.Global);
    }
  }

  private async openInvokedWorkflow(
    document: vscode.TextDocument,
    workflowPath: string
  ): Promise<void> {
    const relative = workflowPath.trim().replace(/\\/g, '/');
    if (!relative) {
      vscode.window.showWarningMessage('Invoke Workflow has no workflow path set.');
      return;
    }

    const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
    const candidates = [
      path.isAbsolute(relative) ? relative : undefined,
      projectRoot ? path.join(projectRoot, relative) : undefined,
      path.join(path.dirname(document.uri.fsPath), relative)
    ].filter((p): p is string => Boolean(p));

    const resolved = candidates.find((p) => fs.existsSync(p));
    if (!resolved) {
      vscode.window.showErrorMessage(
        `Could not find invoked workflow: ${relative}`
      );
      return;
    }

    const uri = vscode.Uri.file(resolved);
    await vscode.commands.executeCommand(
      'vscode.openWith',
      uri,
      WorkflowEditorProvider.viewType,
      { preview: false, viewColumn: vscode.ViewColumn.Beside }
    );
  }

  private async updateTextDocument(
    document: vscode.TextDocument,
    workflow: WorkflowDocument
  ): Promise<void> {
    const next = stringifyWorkflow(workflow);
    if (document.getText() === next) {
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, next);
    await vscode.workspace.applyEdit(edit);
  }

  private getHtml(
    webview: vscode.Webview,
    workflow: WorkflowDocument,
    document?: vscode.TextDocument
  ): string {
    const nonce = getNonce();
    const docPath = document?.uri.fsPath || this.activeDocument?.uri.fsPath || '';
    const projectRoot = docPath ? findProjectRoot(path.dirname(docPath)) : undefined;
    const suggestions = buildPropertySuggestions(projectRoot, workflow);
    return getDesignerHtml(
      nonce,
      webview.cspSource,
      workflow,
      getActivityCatalog(),
      suggestions,
      this.getPaletteState(),
      this.buildProjectTree(),
      this.readDesignerSettings()
    );
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;color:var(--vscode-errorForeground);background:var(--vscode-editor-background);">
  <h2>Invalid workflow document</h2>
  <p>${escapeHtml(message)}</p>
  <p>Fix the JSON or create a new workflow with <b>LowCode Studio: New Workflow</b>.</p>
</body></html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
