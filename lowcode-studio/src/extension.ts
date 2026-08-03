import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ActivityTreeProvider } from './providers/activityTreeProvider';
import { ProjectTreeProvider } from './providers/projectTreeProvider';
import { VariablesTreeProvider } from './providers/variablesTreeProvider';
import { WorkflowEditorProvider } from './providers/workflowEditorProvider';
import {
  createEmptyWorkflow,
  createProjectManifest,
  parseWorkflow,
  stringifyWorkflow,
  WorkflowDocument
} from './models/workflow';
import { dryRunWorkflow, toPseudocode, validateWorkflow } from './commands/simulator';
import { getActivityDefinition } from './models/activities';
import { generateREFrameworkProject } from './templates/reframework';
import {
  exportToStudioWebProject,
  importUiPathNupkg,
  importUiPathProjectFolder
} from './interop/studioProject';

let editorProvider: WorkflowEditorProvider;
let variablesProvider: VariablesTreeProvider;
let projectProvider: ProjectTreeProvider;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  variablesProvider = new VariablesTreeProvider();
  projectProvider = new ProjectTreeProvider(workspaceRoot);
  const activityProvider = new ActivityTreeProvider();

  context.subscriptions.push(
    vscode.window.createTreeView('lowcodeStudio.projects', {
      treeDataProvider: projectProvider,
      showCollapseAll: true
    }),
    vscode.window.createTreeView('lowcodeStudio.activities', {
      treeDataProvider: activityProvider
    }),
    vscode.window.createTreeView('lowcodeStudio.variables', {
      treeDataProvider: variablesProvider
    })
  );

  editorProvider = new WorkflowEditorProvider(context, (doc) => {
    variablesProvider.setWorkflow(doc);
  });

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      WorkflowEditorProvider.viewType,
      editorProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lowcodeStudio.newProject', () => newProject()),
    vscode.commands.registerCommand('lowcodeStudio.newREFramework', () =>
      newProject('reframework')
    ),
    vscode.commands.registerCommand('lowcodeStudio.newWorkflow', () => newWorkflow()),
    vscode.commands.registerCommand('lowcodeStudio.openDesigner', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.fileName.endsWith('.lcs.json')) {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          editor.document.uri,
          WorkflowEditorProvider.viewType
        );
      } else {
        vscode.window.showInformationMessage('Open a .lcs.json file first.');
      }
    }),
    vscode.commands.registerCommand('lowcodeStudio.validateWorkflow', async () => {
      const doc = await getActiveWorkflowDocument();
      if (!doc) {
        return;
      }
      const issues = validateWorkflow(doc);
      const channel = getOutput();
      channel.clear();
      channel.appendLine(`Validation — ${doc.name}`);
      if (!issues.length) {
        channel.appendLine('OK: no issues found.');
        channel.show(true);
        vscode.window.showInformationMessage('Workflow is valid.');
        return;
      }
      for (const issue of issues) {
        channel.appendLine(`[${issue.severity}] ${issue.message}`);
      }
      channel.show(true);
      vscode.window.showWarningMessage(
        `Validation found ${issues.length} issue(s). See LowCode Studio output.`
      );
    }),
    vscode.commands.registerCommand('lowcodeStudio.dryRun', async () => {
      const doc = await getActiveWorkflowDocument();
      if (!doc) {
        return;
      }
      const result = dryRunWorkflow(doc);
      const channel = getOutput();
      channel.clear();
      channel.appendLine(`Dry Run — ${doc.name}`);
      channel.appendLine('─'.repeat(48));
      for (const line of result.log) {
        channel.appendLine(line);
      }
      channel.appendLine('─'.repeat(48));
      channel.appendLine(JSON.stringify(result.variables, null, 2));
      channel.show(true);
      vscode.window.showInformationMessage(
        result.ok
          ? `Dry run completed (${result.steps.length} steps).`
          : 'Dry run finished with errors.'
      );
    }),
    vscode.commands.registerCommand('lowcodeStudio.addVariable', async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      const target =
        uri && uri.fsPath.endsWith('.lcs.json')
          ? uri
          : editorProvider.activeWorkflow
            ? vscode.window.activeTextEditor?.document.uri
            : undefined;

      // Prefer updating via open text document
      const docUri = await pickWorkflowUri();
      if (!docUri) {
        vscode.window.showInformationMessage('Open a workflow to add variables.');
        return;
      }
      const textDoc = await vscode.workspace.openTextDocument(docUri);
      const workflow = parseWorkflow(textDoc.getText());
      const name = await vscode.window.showInputBox({
        prompt: 'Variable name',
        value: `var${workflow.variables.length + 1}`,
        validateInput: (v) =>
          /^[A-Za-z_][A-Za-z0-9_]*$/.test(v) ? undefined : 'Use a valid identifier'
      });
      if (!name) {
        return;
      }
      const type = await vscode.window.showQuickPick(
        ['String', 'Int32', 'Boolean', 'Double', 'Object', 'DataTable', 'Array'],
        { placeHolder: 'Variable type' }
      );
      if (!type) {
        return;
      }
      workflow.variables.push({ name, type: type as WorkflowDocument['variables'][number]['type'] });
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        textDoc.uri,
        new vscode.Range(0, 0, textDoc.lineCount, 0),
        stringifyWorkflow(workflow)
      );
      await vscode.workspace.applyEdit(edit);
      await textDoc.save();
      variablesProvider.setWorkflow(workflow);
      void target;
    }),
    vscode.commands.registerCommand('lowcodeStudio.refreshExplorer', () => {
      projectProvider.refresh();
    }),
    vscode.commands.registerCommand(
      'lowcodeStudio.insertActivity',
      (activityType?: string) => {
        const type =
          typeof activityType === 'string'
            ? activityType
            : undefined;
        if (!type) {
          return;
        }
        const def = getActivityDefinition(type);
        if (!def) {
          return;
        }
        editorProvider.insertActivity(type);
      }
    ),
    vscode.commands.registerCommand('lowcodeStudio.exportPseudocode', async () => {
      const doc = await getActiveWorkflowDocument();
      if (!doc) {
        return;
      }
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!folder) {
        vscode.window.showErrorMessage('Open a workspace folder first.');
        return;
      }
      const outUri = vscode.Uri.joinPath(folder, `${doc.name}.pseudo.txt`);
      await vscode.workspace.fs.writeFile(
        outUri,
        Buffer.from(toPseudocode(doc), 'utf8')
      );
      const opened = await vscode.workspace.openTextDocument(outUri);
      await vscode.window.showTextDocument(opened);
    }),
    vscode.commands.registerCommand('lowcodeStudio.importUiPathProject', () =>
      importUiPathProjectCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.importUiPathPackage', () =>
      importUiPathPackageCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.exportStudioWeb', () =>
      exportStudioWebCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.openStudioWeb', () => {
      void vscode.env.openExternal(vscode.Uri.parse('https://studio.uipath.com'));
    }),
    vscode.commands.registerCommand('lowcodeStudio.showGettingStarted', () => {
      showGettingStarted();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith('.lcs.json') || path.basename(doc.fileName) === 'project.json') {
        projectProvider.refresh();
      }
    })
  );

  const showWelcome = vscode.workspace
    .getConfiguration('lowcodeStudio')
    .get<boolean>('autoOpenDesigner', true);
  if (showWelcome && !context.globalState.get('lowcodeStudio.welcomeShown')) {
    showGettingStarted();
    void context.globalState.update('lowcodeStudio.welcomeShown', true);
  }
}

export function deactivate(): void {
  // no-op
}

async function newProject(forcedTemplate?: 'blank' | 'reframework'): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showErrorMessage('Open a folder in VS Code / Cursor first.');
    return;
  }

  const templatePick =
    forcedTemplate ||
    (
      await vscode.window.showQuickPick(
        [
          {
            label: 'Blank Project',
            description: 'Empty Sequence or Flowchart',
            value: 'blank' as const
          },
          {
            label: 'REFramework',
            description: 'UiPath-style Init → Get Data → Process → End (recommended)',
            value: 'reframework' as const
          }
        ],
        { placeHolder: 'Choose a project template' }
      )
    )?.value;

  if (!templatePick) {
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt: 'Project name',
    value: templatePick === 'reframework' ? 'MyREFramework' : 'MyAutomation',
    validateInput: (v) => (v.trim() ? undefined : 'Name is required')
  });
  if (!name) {
    return;
  }

  const projectDir = path.join(workspace.uri.fsPath, name.trim());
  if (fs.existsSync(projectDir)) {
    vscode.window.showErrorMessage(`Folder already exists: ${name}`);
    return;
  }

  fs.mkdirSync(projectDir, { recursive: true });

  if (templatePick === 'reframework') {
    const files = generateREFrameworkProject(name.trim());
    for (const file of files) {
      const full = path.join(projectDir, file.relativePath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, file.content, 'utf8');
    }
  } else {
    const mainWorkflow = 'Main.lcs.json';
    const workflowType =
      (await vscode.window.showQuickPick(['Sequence', 'Flowchart'], {
        placeHolder: 'Default workflow type'
      })) ||
      vscode.workspace
        .getConfiguration('lowcodeStudio')
        .get<'Sequence' | 'Flowchart'>('defaultWorkflowType', 'Sequence') ||
      'Sequence';

    fs.writeFileSync(
      path.join(projectDir, 'project.json'),
      JSON.stringify(createProjectManifest(name.trim(), mainWorkflow), null, 2) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(projectDir, mainWorkflow),
      stringifyWorkflow(createEmptyWorkflow('Main', workflowType as 'Sequence' | 'Flowchart')),
      'utf8'
    );
    fs.writeFileSync(
      path.join(projectDir, 'README.md'),
      `# ${name.trim()}

LowCode Studio project (Studio-like low-code workflows for VS Code / Cursor on Mac).

## Getting started

1. Open \`Main.lcs.json\` — the visual designer loads automatically.
2. Drag activities from the **Activities** panel onto the canvas.
3. Configure properties on the right.
4. Press **F5** or run **LowCode Studio: Dry Run**.

> Independent community tooling inspired by classic Studio workflows.
`,
      'utf8'
    );
  }

  projectProvider.refresh();

  const uri = vscode.Uri.file(path.join(projectDir, 'Main.lcs.json'));
  await vscode.commands.executeCommand(
    'vscode.openWith',
    uri,
    WorkflowEditorProvider.viewType
  );
  vscode.window.showInformationMessage(
    templatePick === 'reframework'
      ? `Created REFramework project "${name.trim()}". Open Process.lcs.json to add business logic.`
      : `Created project "${name.trim()}".`
  );
}

async function newWorkflow(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showErrorMessage('Open a folder first.');
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt: 'Workflow name (without extension)',
    value: 'NewWorkflow',
    validateInput: (v) =>
      /^[A-Za-z_][A-Za-z0-9_-]*$/.test(v) ? undefined : 'Use letters, numbers, _ or -'
  });
  if (!name) {
    return;
  }

  const workflowType =
    (await vscode.window.showQuickPick(['Sequence', 'Flowchart'], {
      placeHolder: 'Workflow type'
    })) ||
    vscode.workspace
      .getConfiguration('lowcodeStudio')
      .get<'Sequence' | 'Flowchart'>('defaultWorkflowType', 'Sequence') ||
    'Sequence';

  // Prefer saving beside an existing project
  const projectJson = findNearestProject(workspace.uri.fsPath);
  const dir = projectJson ? path.dirname(projectJson) : workspace.uri.fsPath;
  const fileName = `${name}.lcs.json`;
  const fullPath = path.join(dir, fileName);
  if (fs.existsSync(fullPath)) {
    vscode.window.showErrorMessage('A workflow with that name already exists.');
    return;
  }

  const workflow = createEmptyWorkflow(name, workflowType as 'Sequence' | 'Flowchart');
  fs.writeFileSync(fullPath, stringifyWorkflow(workflow), 'utf8');

  if (projectJson) {
    try {
      const manifest = JSON.parse(fs.readFileSync(projectJson, 'utf8')) as {
        workflows?: string[];
      };
      manifest.workflows = [...new Set([...(manifest.workflows || []), fileName])];
      fs.writeFileSync(projectJson, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    } catch {
      // ignore manifest update errors
    }
  }

  projectProvider.refresh();
  const uri = vscode.Uri.file(fullPath);
  await vscode.commands.executeCommand(
    'vscode.openWith',
    uri,
    WorkflowEditorProvider.viewType
  );
}

async function importUiPathProjectCommand(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showErrorMessage('Open a workspace folder first.');
    return;
  }
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Import UiPath project folder'
  });
  if (!picked?.[0]) {
    return;
  }
  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing UiPath project…'
      },
      async () => importUiPathProjectFolder(picked[0].fsPath, workspace.uri.fsPath)
    );
    projectProvider.refresh();
    const mainUri = vscode.Uri.file(path.join(result.targetDir, result.mainWorkflow));
    await vscode.commands.executeCommand(
      'vscode.openWith',
      mainUri,
      WorkflowEditorProvider.viewType
    );
    const channel = getOutput();
    channel.appendLine(`Imported UiPath folder → ${result.targetDir}`);
    for (const w of result.warnings.slice(0, 50)) {
      channel.appendLine(`⚠ ${w.message}`);
    }
    vscode.window.showInformationMessage(
      `Imported "${result.projectName}" (${result.workflows.length} workflows). Review IMPORT_NOTES.md for warnings.`
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Import failed'
    );
  }
}

async function importUiPathPackageCommand(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showErrorMessage('Open a workspace folder first.');
    return;
  }
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { 'UiPath Package': ['nupkg'] },
    openLabel: 'Import .nupkg'
  });
  if (!picked?.[0]) {
    return;
  }
  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing UiPath package…'
      },
      async () => importUiPathNupkg(picked[0].fsPath, workspace.uri.fsPath)
    );
    projectProvider.refresh();
    const mainUri = vscode.Uri.file(path.join(result.targetDir, result.mainWorkflow));
    await vscode.commands.executeCommand(
      'vscode.openWith',
      mainUri,
      WorkflowEditorProvider.viewType
    );
    const channel = getOutput();
    channel.appendLine(`Imported UiPath package → ${result.targetDir}`);
    for (const w of result.warnings.slice(0, 50)) {
      channel.appendLine(`⚠ ${w.message}`);
    }
    vscode.window.showInformationMessage(
      `Imported package "${result.projectName}". Open IMPORT_NOTES.md if activities need cleanup.`
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Package import failed'
    );
  }
}

async function exportStudioWebCommand(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showErrorMessage('Open a workspace folder first.');
    return;
  }

  const projectJson = findNearestProject(workspace.uri.fsPath);
  let projectDir = projectJson ? path.dirname(projectJson) : undefined;

  if (!projectDir) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select LowCode Studio project folder'
    });
    if (!picked?.[0]) {
      return;
    }
    projectDir = picked[0].fsPath;
  }

  try {
    const result = exportToStudioWebProject(projectDir);
    const open = await vscode.window.showInformationMessage(
      `Exported Studio Web project to ${path.basename(result.targetDir)}`,
      'Open Folder',
      'Open Studio Web'
    );
    if (open === 'Open Folder') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(result.targetDir));
    }
    if (open === 'Open Studio Web') {
      await vscode.env.openExternal(vscode.Uri.parse('https://studio.uipath.com'));
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Export failed'
    );
  }
}

function findNearestProject(root: string): string | undefined {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    const candidate = path.join(current, 'project.json');
    if (fs.existsSync(candidate)) {
      try {
        const content = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          schemaVersion?: string;
        };
        if (content.schemaVersion === '1.0') {
          return candidate;
        }
      } catch {
        // continue
      }
    }
    try {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (
          entry.isDirectory() &&
          entry.name !== 'node_modules' &&
          entry.name !== '.git' &&
          entry.name !== 'out'
        ) {
          stack.push(path.join(current, entry.name));
        }
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

async function getActiveWorkflowDocument(): Promise<WorkflowDocument | undefined> {
  const fromProvider = editorProvider?.activeWorkflow;
  if (fromProvider) {
    return fromProvider;
  }
  const active = vscode.window.activeTextEditor?.document;
  if (active?.fileName.endsWith('.lcs.json')) {
    try {
      return parseWorkflow(active.getText());
    } catch (err) {
      vscode.window.showErrorMessage(
        err instanceof Error ? err.message : 'Failed to parse workflow'
      );
      return undefined;
    }
  }
  vscode.window.showInformationMessage('Open a .lcs.json workflow first.');
  return undefined;
}

async function pickWorkflowUri(): Promise<vscode.Uri | undefined> {
  const active = vscode.window.activeTextEditor?.document;
  if (active?.fileName.endsWith('.lcs.json')) {
    return active.uri;
  }
  const files = await vscode.workspace.findFiles('**/*.lcs.json', '**/node_modules/**', 20);
  if (!files.length) {
    return undefined;
  }
  if (files.length === 1) {
    return files[0];
  }
  const picked = await vscode.window.showQuickPick(
    files.map((f) => ({ label: vscode.workspace.asRelativePath(f), uri: f })),
    { placeHolder: 'Select workflow' }
  );
  return picked?.uri;
}

function getOutput(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('LowCode Studio');
  }
  return outputChannel;
}

function showGettingStarted(): void {
  const md = `# LowCode Studio

A **Studio-like low-code designer** for VS Code and Cursor — built for Mac users who cannot run UiPath Studio Desktop.

## What you get

| Studio concept | In this extension |
|---|---|
| Sequence designer | Vertical activity list for \`.lcs.json\` |
| Flowchart designer | Free-form canvas + True/False links |
| REFramework | One-click Init → Get Data → Process → End |
| Activities panel | Drag/drop toolbox + sidebar |
| Properties / Variables | Right-side editors |
| Run / Debug | Dry Run simulator (F5) |

## Quick start

1. **LowCode Studio: New REFramework Project** (easiest path)
2. Open \`Main.lcs.json\` — flowchart of the framework states
3. Edit \`Framework/Process.lcs.json\` for business logic
4. Edit \`Data/Config.json\` for retries / endpoints
5. Press **F5** to dry-run Main

**Import UiPath:** \`Import UiPath Package (.nupkg)\` or \`Import UiPath Project Folder\`

**Studio Web:** \`Export for Studio Web\` then open [studio.uipath.com](https://studio.uipath.com)

Or use **New Project → Blank** and pick Sequence or Flowchart.

Tip: select any activity → **Container color** to customize sequence/flowchart colors.

## About UiPath Maestro

UiPath's official **Maestro** VS Code extension targets **Maestro Flows** (\`.flow\`).
LowCode Studio covers classic Studio / REFramework-style low-code design on Mac.

> Not an official UiPath product.
`;
  void vscode.workspace
    .openTextDocument({ content: md, language: 'markdown' })
    .then((doc) => vscode.window.showTextDocument(doc, { preview: true }));
}
