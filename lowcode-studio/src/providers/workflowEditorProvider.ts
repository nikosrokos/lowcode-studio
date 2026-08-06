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
  dryRunWorkflowAsync,
  formatDryRunReport,
  validateWorkflow
} from '../commands/simulator';
import { readDryRunSettings } from '../util/dryRunSettings';
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
  migrateWorkflowDocument,
  rawWorkflowHasMissingIds
} from '../interop/activityNormalize';
import {
  buildCurrentProjectTree,
  findProjectRoot
} from '../interop/projectResolve';
import {
  getStudioWebLocalLink,
  getStudioWebLocalSyncStatus,
  trySyncFromStudioWebLocal,
  trySyncToStudioWebLocal
} from '../interop/studioWebLocal';

export class WorkflowEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'lowcodeStudio.workflowEditor';

  private activePanel: vscode.WebviewPanel | undefined;
  private activeDocument: vscode.TextDocument | undefined;
  private lastSyncLabel = '';
  /** Designer Save will sync after document.save(); skip the parallel onDidSave sync. */
  private readonly skipNextDidSaveSync = new Set<string>();
  /** Avoid spamming the VS Code toast when Studio Web is newer. */
  private syncAlertNotifiedFor = '';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onWorkflowChanged: (doc: WorkflowDocument | undefined) => void
  ) {}

  getActiveDocumentPath(): string | undefined {
    return this.activeDocument?.uri.fsPath;
  }

  /** Reload the open designer from disk after an external pull/sync. */
  async reloadActiveDesignerFromDisk(): Promise<boolean> {
    const document = this.activeDocument;
    const panel = this.activePanel;
    if (!document || !panel) {
      return false;
    }
    return this.reloadDesignerFromDisk(document, panel);
  }

  /** Push current Studio Web sync status into the open designer (banner + Sync btn). */
  pushSyncStatusToActive(): void {
    const document = this.activeDocument;
    const panel = this.activePanel;
    if (!document || !panel) {
      return;
    }
    this.pushSyncStatus(document, panel);
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
   * After Save: bidirectional sync with linked Studio Web Local Workspace
   * (pull Studio Web edits into .lcs.json when LCS unchanged, then push .xaml).
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
        contentOverrides: overrides,
        pullFirst: true
      });
      if (synced) {
        this.lastSyncLabel = path.basename(synced.link.solutionDir);
        const pulled = synced.pulled?.length || 0;
        const conflicts = synced.conflicts?.length || 0;
        let status = `Synced ↔ Studio Web Local (${this.lastSyncLabel})`;
        if (pulled) {
          status += ` · pulled ${pulled}`;
        }
        if (conflicts) {
          status += ` · ${conflicts} conflict(s)→trash`;
        }
        void vscode.window.setStatusBarMessage(status, 4500);

        // If Save preferred Studio Web for this file, reload designer (migrate + setWorkflow)
        if (pulled && rel.endsWith('.lcs.json') && synced.pulled!.includes(rel)) {
          if (this.activePanel) {
            await this.reloadDesignerFromDisk(document, this.activePanel);
            this.activePanel.webview.postMessage({
              type: 'toast',
              message: 'Reloaded from Studio Web Local edits',
              logged: true
            });
          }
        }
        if (conflicts) {
          void vscode.window.showWarningMessage(
            `Studio Web and LowCode Studio both changed ${conflicts} workflow(s). LCS Save kept; Studio Web copies are in .lcs-sync-trash/.`
          );
        }
      }
    } catch (err) {
      void vscode.window.showWarningMessage(
        err instanceof Error
          ? `Studio Web Local sync failed: ${err.message}`
          : 'Studio Web Local sync failed'
      );
    }
  }

  /** Pull Studio Web Local edits into LCS before opening the designer when XAML is newer. */
  async pullIfStudioWebNewer(document: vscode.TextDocument): Promise<boolean> {
    const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
    if (!projectRoot) {
      return false;
    }
    const rel = path.relative(projectRoot, document.uri.fsPath).replace(/\\/g, '/');
    if (!rel.endsWith('.lcs.json') || rel.startsWith('..')) {
      return false;
    }
    try {
      const pulled = trySyncFromStudioWebLocal(projectRoot, {
        workflowRels: [rel],
        force: false
      });
      return Boolean(pulled?.updated.includes(rel));
    } catch {
      return false;
    }
  }

  /**
   * Pull Studio Web → LCS for the open workflow (or whole project), then reload designer.
   * Used by the designer Sync button / alert — no close/reopen needed.
   */
  async pullStudioWebForActiveDesigner(opts?: {
    force?: boolean;
    wholeProject?: boolean;
  }): Promise<{ ok: boolean; message: string }> {
    const document = this.activeDocument;
    const panel = this.activePanel;
    if (!document || !panel) {
      return { ok: false, message: 'Open a workflow in the designer first.' };
    }
    const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
    if (!projectRoot || !getStudioWebLocalLink(projectRoot)) {
      return { ok: false, message: 'Not linked to a Studio Web Local Workspace.' };
    }
    const rel = path.relative(projectRoot, document.uri.fsPath).replace(/\\/g, '/');
    try {
      // Flush in-memory edits first so we don't silently lose them on pull
      await this.flushWebviewBeforeSave(document);
      const pulled = trySyncFromStudioWebLocal(projectRoot, {
        force: Boolean(opts?.force),
        workflowRels: opts?.wholeProject || !rel.endsWith('.lcs.json') ? undefined : [rel]
      });
      if (!pulled) {
        return { ok: false, message: 'Pull failed.' };
      }
      let reloaded = false;
      if (pulled.updated.length || pulled.created.length) {
        reloaded = await this.reloadDesignerFromDisk(document, panel);
      }
      this.pushSyncStatus(document, panel);
      this.refreshProjectTree();
      if (pulled.updated.length === 0 && pulled.conflicts.length === 0) {
        return { ok: true, message: 'Already in sync with Studio Web Local.' };
      }
      if (pulled.conflicts.length && !pulled.updated.length) {
        return {
          ok: false,
          message: `${pulled.conflicts.length} conflict(s) — both sides changed. Save to keep LCS, or Sync with force.`
        };
      }
      const msg =
        `Pulled ${pulled.updated.length} workflow(s)` +
        (pulled.created.length ? ` (${pulled.created.length} new)` : '') +
        (reloaded ? ' · designer reloaded' : '') +
        (pulled.conflicts.length ? ` · ${pulled.conflicts.length} conflict(s) skipped` : '');
      return { ok: true, message: msg };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Pull from Studio Web Local failed'
      };
    }
  }

  private async reloadDesignerFromDisk(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel
  ): Promise<boolean> {
    try {
      const disk = await vscode.workspace.fs.readFile(document.uri);
      const text = Buffer.from(disk).toString('utf8');
      if (text !== document.getText()) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          document.uri,
          new vscode.Range(0, 0, document.lineCount, 0),
          text
        );
        await vscode.workspace.applyEdit(edit);
      }
      // Heal SW pull shapes (ids / PascalCase / singleton Sequence) onto disk + designer
      try {
        await this.migrateDocumentIfNeeded(document);
      } catch {
        // paint whatever is on disk
      }
      const workflow = parseWorkflow(document.getText());
      this.onWorkflowChanged(workflow);
      panel.webview.postMessage({ type: 'setWorkflow', workflow });
      return true;
    } catch {
      return false;
    }
  }

  private pushSyncStatus(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel
  ): void {
    const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
    if (!projectRoot) {
      panel.webview.postMessage({
        type: 'syncStatus',
        linked: false,
        inSync: true,
        summary: 'No LCS project',
        thisWorkflow: null
      });
      return;
    }
    const status = getStudioWebLocalSyncStatus(projectRoot);
    const rel = path.relative(projectRoot, document.uri.fsPath).replace(/\\/g, '/');
    const thisStale = status.stale.find((s) => s.workflowRel === rel);
    const xamlNewerHere = thisStale?.reason === 'xaml-newer';
    const lcsNewerHere = thisStale?.reason === 'lcs-newer';
    const anyXamlNewer = status.stale.some((s) => s.reason === 'xaml-newer');
    panel.webview.postMessage({
      type: 'syncStatus',
      linked: status.linked,
      inSync: status.inSync,
      summary: status.summary,
      solutionLabel: status.link ? path.basename(status.link.solutionDir) : '',
      thisWorkflow: thisStale
        ? { rel, reason: thisStale.reason }
        : status.linked
          ? { rel, reason: 'in-sync' }
          : null,
      needsPull: Boolean(xamlNewerHere || (anyXamlNewer && !lcsNewerHere)),
      xamlNewerCount: status.stale.filter((s) => s.reason === 'xaml-newer').length,
      lcsNewerCount: status.stale.filter((s) => s.reason === 'lcs-newer').length
    });

    // One VS Code toast per stale fingerprint (Sync action → pull + reload)
    if (status.linked && anyXamlNewer) {
      const key = status.stale
        .filter((s) => s.reason === 'xaml-newer')
        .map((s) => s.workflowRel)
        .sort()
        .join('|');
      if (key && key !== this.syncAlertNotifiedFor) {
        this.syncAlertNotifiedFor = key;
        void vscode.window
          .showWarningMessage(
            `Studio Web has newer changes (${status.stale.filter((s) => s.reason === 'xaml-newer').length}). Sync without reopening?`,
            'Sync now',
            'Dismiss'
          )
          .then(async (choice) => {
            if (choice === 'Sync now') {
              const result = await this.pullStudioWebForActiveDesigner({
                wholeProject: true
              });
              void vscode.window.showInformationMessage(result.message);
              panel.webview.postMessage({
                type: 'toast',
                message: result.message,
                logged: true
              });
            }
          });
      }
    } else if (status.inSync) {
      this.syncAlertNotifiedFor = '';
    }
  }

  private attachSyncWatchers(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel
  ): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];
    const tick = () => {
      if (this.activePanel === panel) {
        this.pushSyncStatus(document, panel);
      }
    };
    tick();
    const interval = setInterval(tick, 4000);
    disposables.push({ dispose: () => clearInterval(interval) });

    const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
    const link = projectRoot ? getStudioWebLocalLink(projectRoot) : undefined;
    if (link?.solutionDir && fs.existsSync(link.solutionDir)) {
      const pattern = new vscode.RelativePattern(link.solutionDir, '**/*.{xaml,json}');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const onFs = () => {
        // Debounce burst writes from Studio Web
        setTimeout(tick, 600);
      };
      watcher.onDidChange(onFs);
      watcher.onDidCreate(onFs);
      watcher.onDidDelete(onFs);
      disposables.push(watcher);
    }

    return vscode.Disposable.from(...disposables);
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

  /** Apply a workflow edit (e.g. Assist F3 selector repairs) and refresh the designer. */
  async applyWorkflowDocument(workflow: WorkflowDocument): Promise<boolean> {
    const document = this.activeDocument;
    if (!document) {
      return false;
    }
    await this.updateTextDocument(document, workflow);
    this.onWorkflowChanged(workflow);
    this.activePanel?.webview.postMessage({ type: 'setWorkflow', workflow });
    return true;
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

    // Receive Studio Web Local edits before painting the designer
    try {
      const pulled = await this.pullIfStudioWebNewer(document);
      if (pulled) {
        const disk = await vscode.workspace.fs.readFile(document.uri);
        const text = Buffer.from(disk).toString('utf8');
        if (text !== document.getText()) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            text
          );
          await vscode.workspace.applyEdit(edit);
        }
      }
    } catch {
      // open with current LCS content
    }

    // Existing projects: heal missing ids / PascalCase / singleton Sequence onto disk
    // so Properties clicks work without recreating in Studio Web.
    try {
      await this.migrateDocumentIfNeeded(document);
    } catch {
      // paint whatever is on disk
    }

    updateWebview();

    const syncWatch = this.attachSyncWatchers(document, webviewPanel);

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length) {
        // External disk reload while designer tab is not focused — avoid fighting in-memory edits
        if (this.activePanel === webviewPanel && !webviewPanel.active) {
          try {
            const workflow = parseWorkflow(document.getText());
            this.onWorkflowChanged(workflow);
            webviewPanel.webview.postMessage({ type: 'setWorkflow', workflow });
          } catch {
            updateWebview();
          }
        }
        // Keep sync banner current after local edits / pulls
        if (this.activePanel === webviewPanel) {
          this.pushSyncStatus(document, webviewPanel);
        }
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
      syncWatch.dispose();
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
        // Recheck Studio Web when returning to the designer tab
        this.pushSyncStatus(document, webviewPanel);
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
            ? `Saved · synced ↔ ${this.lastSyncLabel}`
            : 'Saved · not linked — Connect to Studio Web to sync .xaml';
          logNotification(saveMsg, true);
          webviewPanel.webview.postMessage({
            type: 'toast',
            message: saveMsg,
            logged: true
          });
          this.pushSyncStatus(document, webviewPanel);
          break;
        }
        case 'openHome': {
          await vscode.commands.executeCommand('lowcodeStudio.openHome');
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
          const projectDir =
            findProjectRoot(path.dirname(document.uri.fsPath)) || undefined;
          const drySettings = readDryRunSettings(
            vscode.workspace.getConfiguration('lowcodeStudio')
          );
          const result = await dryRunWorkflowAsync(message.workflow as WorkflowDocument, {
            fixtures: message.fixtures,
            initialVariables: message.initialVariables,
            projectDir,
            ...drySettings
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
            // Prefer full workflow from the designer (avoids racing a stale document read)
            const workflow = message.workflow
              ? (message.workflow as WorkflowDocument)
              : parseWorkflow(document.getText());
            if (Array.isArray(message.variables)) {
              workflow.variables = message.variables;
            }
            workflow.variables = Array.isArray(workflow.variables) ? workflow.variables : [];
            workflow.arguments = Array.isArray(workflow.arguments) ? workflow.arguments : [];
            await this.updateTextDocument(document, workflow);
            this.onWorkflowChanged(workflow);
          } catch {
            // ignore
          }
          break;
        }
        case 'argumentsChanged': {
          try {
            const workflow = message.workflow
              ? (message.workflow as WorkflowDocument)
              : parseWorkflow(document.getText());
            const args = message.workflowArguments ?? message.arguments;
            if (Array.isArray(args)) {
              workflow.arguments = args;
            }
            workflow.variables = Array.isArray(workflow.variables) ? workflow.variables : [];
            workflow.arguments = Array.isArray(workflow.arguments) ? workflow.arguments : [];
            await this.updateTextDocument(document, workflow);
            this.onWorkflowChanged(workflow);
          } catch {
            // ignore
          }
          break;
        }
        case 'openWorkflow': {
          await this.openInvokedWorkflow(document, String(message.workflowPath || ''));
          break;
        }
        case 'loadWorkflowArguments': {
          const result = this.resolveWorkflowArguments(
            document,
            String(message.workflowPath || '')
          );
          webviewPanel.webview.postMessage({
            type: 'workflowArguments',
            workflowPath: String(message.workflowPath || ''),
            requestId: message.requestId,
            ok: result.ok,
            arguments: result.arguments,
            message: result.message
          });
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
          this.pushSyncStatus(document, webviewPanel);
          break;
        case 'pullStudioWeb': {
          const result = await this.pullStudioWebForActiveDesigner({
            wholeProject: Boolean(message.wholeProject),
            force: Boolean(message.force)
          });
          webviewPanel.webview.postMessage({
            type: 'toast',
            message: result.message,
            logged: true
          });
          webviewPanel.webview.postMessage({
            type: 'syncPullResult',
            ok: result.ok,
            message: result.message
          });
          break;
        }
        case 'checkSyncStatus': {
          this.pushSyncStatus(document, webviewPanel);
          break;
        }
      }
    });
  }

  private readDesignerSettings(): DesignerSettings {
    const cfg = vscode.workspace.getConfiguration('lowcodeStudio');
    const workflowType = cfg.get<string>('defaultWorkflowType', 'Sequence');
    const framework = cfg.get<string>('uipathTargetFramework', 'Windows');
    const canvasStyle = cfg.get<string>('canvasStyle', 'plain');
    const zoom = Number(cfg.get<number>('defaultZoom', 1));
    const theme = cfg.get<string>('designerTheme', 'auto');
    return {
      showLineNumbers: cfg.get<boolean>('showLineNumbers', true),
      defaultWorkflowType: workflowType === 'Flowchart' ? 'Flowchart' : 'Sequence',
      autoOpenDesigner: cfg.get<boolean>('autoOpenDesigner', true),
      syncStudioWebOnSave: cfg.get<boolean>('syncStudioWebOnSave', true),
      uipathTargetFramework: framework === 'Portable' ? 'Portable' : 'Windows',
      canvasStyle: canvasStyle === 'dots' ? 'dots' : 'plain',
      showCardSummaries: cfg.get<boolean>('showCardSummaries', true),
      compactCards: cfg.get<boolean>('compactCards', false),
      showConnectors: cfg.get<boolean>('showConnectors', true),
      defaultZoom: zoom === 0.75 || zoom === 1.25 ? zoom : 1,
      openHomeOnStartup: cfg.get<boolean>('openHomeOnStartup', true),
      designerTheme: theme === 'light' || theme === 'dark' ? theme : 'auto'
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
      ['canvasStyle', patch.canvasStyle],
      ['showCardSummaries', patch.showCardSummaries],
      ['compactCards', patch.compactCards],
      ['showConnectors', patch.showConnectors],
      ['defaultZoom', patch.defaultZoom],
      ['openHomeOnStartup', patch.openHomeOnStartup],
      ['designerTheme', patch.designerTheme]
    ];
    for (const [key, value] of entries) {
      if (value === undefined) {
        continue;
      }
      await cfg.update(key, value, vscode.ConfigurationTarget.Global);
    }
  }

  private async migrateDocumentIfNeeded(document: vscode.TextDocument): Promise<boolean> {
    const text = document.getText();
    let raw: WorkflowDocument;
    try {
      raw = JSON.parse(text) as WorkflowDocument;
    } catch {
      return false;
    }
    if (!raw || raw.schemaVersion !== '1.0') {
      return false;
    }
    // Migrate RAW disk JSON (not parseWorkflow result) so PascalCase / missing ids /
    // singleton Sequence are detected and written back for durable Properties edits.
    const missingIds = rawWorkflowHasMissingIds(text);
    const { doc, changed } = migrateWorkflowDocument(raw);
    if (!missingIds && !changed) {
      return false;
    }
    await this.updateTextDocument(document, doc);
    return true;
  }

  private resolveWorkflowPath(
    document: vscode.TextDocument,
    workflowPath: string
  ): string | undefined {
    const relative = workflowPath.trim().replace(/\\/g, '/');
    if (!relative) {
      return undefined;
    }
    const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
    const withLcs =
      relative.endsWith('.xaml') && !relative.endsWith('.lcs.json')
        ? relative.replace(/\.xaml$/i, '.lcs.json')
        : relative;
    const candidates = [
      path.isAbsolute(relative) ? relative : undefined,
      path.isAbsolute(withLcs) ? withLcs : undefined,
      projectRoot ? path.join(projectRoot, withLcs) : undefined,
      projectRoot ? path.join(projectRoot, relative) : undefined,
      path.join(path.dirname(document.uri.fsPath), withLcs),
      path.join(path.dirname(document.uri.fsPath), relative)
    ].filter((p): p is string => Boolean(p));
    return candidates.find((p) => fs.existsSync(p));
  }

  private resolveWorkflowArguments(
    document: vscode.TextDocument,
    workflowPath: string
  ): { ok: boolean; arguments: WorkflowDocument['arguments']; message?: string } {
    const resolved = this.resolveWorkflowPath(document, workflowPath);
    if (!resolved) {
      return {
        ok: false,
        arguments: [],
        message: `Could not find workflow: ${workflowPath || '(empty path)'}`
      };
    }
    try {
      if (resolved.endsWith('.lcs.json')) {
        const doc = parseWorkflow(fs.readFileSync(resolved, 'utf8'));
        return { ok: true, arguments: Array.isArray(doc.arguments) ? doc.arguments : [] };
      }
      // XAML-only target: no LCS sibling — return empty contract (UI still works)
      return {
        ok: true,
        arguments: [],
        message: 'Target has no .lcs.json arguments contract yet'
      };
    } catch (err) {
      return {
        ok: false,
        arguments: [],
        message: err instanceof Error ? err.message : String(err)
      };
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

    const resolved = this.resolveWorkflowPath(document, workflowPath);
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
      this.readDesignerSettings(),
      this.getCodiconCssText(webview)
    );
  }

  /**
   * Codicon CSS with @font-face embedding the TTF as a data: URI.
   * External webview font URLs still fail in some Cursor/VS Code hosts
   * (empty colored activity icon squares) — base64 is reliable.
   */
  private getCodiconCssText(_webview: vscode.Webview): string {
    const cssPath = path.join(
      this.context.extensionPath,
      'media',
      'codicons',
      'codicon.css'
    );
    const fontPath = path.join(
      this.context.extensionPath,
      'media',
      'codicons',
      'codicon.ttf'
    );
    try {
      const raw = fs.readFileSync(cssPath, 'utf8');
      const b64 = fs.readFileSync(fontPath).toString('base64');
      const dataUri = `data:font/truetype;base64,${b64}`;
      return raw
        .replace(/url\(\s*["']?\.\/codicon\.ttf[^"')]*["']?\s*\)/gi, `url("${dataUri}")`)
        .replace(/font-display:\s*block/gi, 'font-display: swap');
    } catch {
      return '';
    }
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
