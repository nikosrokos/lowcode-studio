import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getActivityCatalog } from '../models/activities';
import {
  parseWorkflow,
  stringifyWorkflow,
  WorkflowDocument
} from '../models/workflow';
import { dryRunWorkflow, validateWorkflow } from '../commands/simulator';
import { getDesignerHtml } from '../webview/designerHtml';

export class WorkflowEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'lowcodeStudio.workflowEditor';

  private activePanel: vscode.WebviewPanel | undefined;
  private activeDocument: vscode.TextDocument | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onWorkflowChanged: (doc: WorkflowDocument | undefined) => void
  ) {}

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

  insertActivity(activityType: string): void {
    if (!this.activePanel) {
      vscode.window.showInformationMessage(
        'Open a .lcs.json workflow in the LowCode Studio designer first.'
      );
      return;
    }
    this.activePanel.webview.postMessage({
      type: 'insertActivity',
      activityType
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
        webviewPanel.webview.html = this.getHtml(webviewPanel.webview, workflow);
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

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
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
      }
    });

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'edit': {
          const workflow = message.workflow as WorkflowDocument;
          await this.updateTextDocument(document, workflow);
          this.onWorkflowChanged(workflow);
          break;
        }
        case 'save': {
          await document.save();
          break;
        }
        case 'validate': {
          const issues = validateWorkflow(message.workflow as WorkflowDocument);
          if (!issues.length) {
            vscode.window.showInformationMessage('Workflow is valid.');
            webviewPanel.webview.postMessage({
              type: 'toast',
              message: 'Workflow is valid'
            });
          } else {
            const errors = issues.filter((i) => i.severity === 'error').length;
            const warnings = issues.filter((i) => i.severity === 'warning').length;
            const channel = vscode.window.createOutputChannel('LowCode Studio');
            channel.clear();
            channel.appendLine(`Validation for ${document.fileName}`);
            for (const issue of issues) {
              channel.appendLine(
                `[${issue.severity}] ${issue.activityId ? issue.activityId + ' — ' : ''}${issue.message}`
              );
            }
            channel.show(true);
            vscode.window.showWarningMessage(
              `Validation: ${errors} error(s), ${warnings} warning(s). See LowCode Studio output.`
            );
          }
          break;
        }
        case 'dryRun': {
          const result = dryRunWorkflow(message.workflow as WorkflowDocument);
          const channel = vscode.window.createOutputChannel('LowCode Studio');
          channel.clear();
          channel.appendLine(`Dry Run — ${document.fileName}`);
          channel.appendLine('─'.repeat(48));
          for (const line of result.log) {
            channel.appendLine(line);
          }
          channel.appendLine('─'.repeat(48));
          channel.appendLine('Variables snapshot:');
          channel.appendLine(JSON.stringify(result.variables, null, 2));
          channel.show(true);
          vscode.window.showInformationMessage(
            result.ok
              ? `Dry run completed (${result.steps.length} steps).`
              : 'Dry run finished with errors. See output.'
          );
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
        case 'openWorkflow': {
          await this.openInvokedWorkflow(document, String(message.workflowPath || ''));
          break;
        }
        case 'ready':
          break;
      }
    });
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
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      next
    );
    await vscode.workspace.applyEdit(edit);
  }

  private getHtml(webview: vscode.Webview, workflow: WorkflowDocument): string {
    const nonce = getNonce();
    return getDesignerHtml(nonce, webview.cspSource, workflow, getActivityCatalog());
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

function findProjectRoot(startDir: string): string | undefined {
  let current = startDir;
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(current, 'project.json');
    if (fs.existsSync(candidate)) {
      try {
        const content = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          schemaVersion?: string;
        };
        if (content.schemaVersion === '1.0') {
          return current;
        }
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
}
