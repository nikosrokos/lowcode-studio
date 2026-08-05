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
import {
  dryRunWorkflow,
  formatDryRunReport,
  toPseudocode,
  validateWorkflow
} from './commands/simulator';
import {
  createQuickScenario,
  duplicateScenario,
  ensureScenariosFile,
  formatScenarioReport,
  loadScenariosFile,
  runAllScenarios,
  runScenario,
  saveScenariosFile,
  scenariosFilePath,
  upsertScenario
} from './commands/refDryRun';
import {
  connectToStudioWeb,
  STUDIO_WEB_URL,
  studioWebSyncGuideMarkdown
} from './interop/studioWebConnect';
import {
  getStudioWebLocalLink,
  trySyncToStudioWebLocal,
  unlinkStudioWebLocalWorkspace,
  validateStudioWebLocalOpenability
} from './interop/studioWebLocal';
import {
  formatPackageValidationReport,
  validateProjectPackages
} from './interop/packageValidation';
import {
  buildWindowsTodoChecklist,
  formatWindowsTodoReport,
  writeWindowsTodoFile
} from './interop/windowsTodo';
import {
  getActivityCatalog,
  getActivityDefinition,
  setCustomActivityOverlay
} from './models/activities';
import { buildPaletteEntries } from './interop/activityPalette';
import {
  createCustomActivityDraft,
  CUSTOM_ACTIVITIES_FILENAME,
  loadProjectCustomActivities,
  saveProjectCustomActivities,
  upsertCustomActivity,
  USER_CUSTOM_ACTIVITIES_KEY,
  CustomActivityDefinition
} from './models/customActivities';
import { generateREFrameworkProject } from './templates/reframework';
import {
  BlueprintId,
  generateBlueprintProject,
  getBlueprint,
  ROBOT_BLUEPRINTS
} from './templates/blueprints';
import {
  exportToStudioWebProject,
  importUiPathNupkg,
  importUiPathProjectFolder
} from './interop/studioProject';
import {
  CONFIG_JSON_REL,
  CONFIG_XLSX_REL,
  exportJsonToXlsx,
  importXlsxToJson
} from './interop/configBridge';
import {
  findAllLcsProjects,
  findProjectRoot,
  isLcsProjectDir
} from './interop/projectResolve';
import { ProjectTreeItem } from './providers/projectTreeProvider';

let editorProvider: WorkflowEditorProvider;
let variablesProvider: VariablesTreeProvider;
let projectProvider: ProjectTreeProvider;
let activityProvider: ActivityTreeProvider;
let projectsTreeView: vscode.TreeView<ProjectTreeItem>;
let outputChannel: vscode.OutputChannel;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  variablesProvider = new VariablesTreeProvider();
  projectProvider = new ProjectTreeProvider(workspaceRoot);
  activityProvider = new ActivityTreeProvider();
  refreshCustomActivityOverlay();

  projectsTreeView = vscode.window.createTreeView('lowcodeStudio.projects', {
    treeDataProvider: projectProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(
    projectsTreeView,
    vscode.window.createTreeView('lowcodeStudio.activities', {
      treeDataProvider: activityProvider
    }),
    vscode.window.createTreeView('lowcodeStudio.variables', {
      treeDataProvider: variablesProvider
    }),
    projectsTreeView.onDidChangeSelection((e) => {
      const dir = projectDirFromTreeItem(e.selection[0]);
      if (dir) {
        void setActiveProjectDir(dir);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      projectProvider.refresh();
      refreshCustomActivityOverlay();
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
    vscode.commands.registerCommand('lowcodeStudio.newBlueprint', () =>
      newProject('blueprint')
    ),
    vscode.commands.registerCommand('lowcodeStudio.openLocalProject', () =>
      openLocalProjectCommand()
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
    vscode.commands.registerCommand('lowcodeStudio.validatePackages', () =>
      validatePackagesCommand()
    ),
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
      const mode = await vscode.window.showQuickPick(
        [
          {
            label: 'Run All',
            description: 'Full dry-run with step diffs in Output',
            mode: 'all' as const
          },
          {
            label: 'Step Through',
            description: 'Highlight each activity in the designer',
            mode: 'step' as const
          }
        ],
        { placeHolder: 'Dry Run mode' }
      );
      if (!mode) {
        return;
      }
      const result = dryRunWorkflow(doc);
      const channel = getOutput();
      channel.clear();
      channel.appendLine(formatDryRunReport(result, `Dry Run — ${doc.name}`));
      channel.appendLine('');
      channel.appendLine('Log:');
      for (const line of result.log) {
        channel.appendLine(line);
      }
      channel.show(true);
      if (mode.mode === 'step') {
        editorProvider.playDryRun(result);
        vscode.window.showInformationMessage(
          `Step-through ready (${result.steps.length} steps). Use Step / Continue in the designer.`
        );
      } else {
        vscode.window.showInformationMessage(
          result.ok
            ? `Dry run completed (${result.steps.length} steps${result.warnings.length ? `, ${result.warnings.length} warning(s)` : ''}).`
            : 'Dry run finished with errors.'
        );
      }
    }),
    vscode.commands.registerCommand('lowcodeStudio.dryRunScenario', () =>
      dryRunScenarioCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.manageScenarios', () =>
      manageScenariosCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.registerCustomActivity', () =>
      registerCustomActivityCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.manageCustomActivities', () =>
      manageCustomActivitiesCommand()
    ),
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
      async (activityType?: string) => {
        const type =
          typeof activityType === 'string'
            ? activityType
            : undefined;
        if (!type) {
          await activityPaletteCommand();
          return;
        }
        const def = getActivityDefinition(type);
        if (!def) {
          return;
        }
        editorProvider.insertActivity(type);
      }
    ),
    vscode.commands.registerCommand('lowcodeStudio.activityPalette', () =>
      activityPaletteCommand()
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
    vscode.commands.registerCommand('lowcodeStudio.connectStudioWeb', (item?: ProjectTreeItem) =>
      connectStudioWebCommand(item)
    ),
    vscode.commands.registerCommand(
      'lowcodeStudio.setActiveProject',
      async (item?: ProjectTreeItem | string) => {
        const dir = typeof item === 'string' ? item : projectDirFromTreeItem(item);
        if (dir && isLcsProjectDir(dir)) {
          await setActiveProjectDir(dir);
          void vscode.window.setStatusBarMessage(
            `LowCode Studio: active project → ${path.basename(dir)}`,
            2500
          );
        }
      }
    ),
    vscode.commands.registerCommand(
      'lowcodeStudio.removeFromExplorer',
      async (itemOrPath?: ProjectTreeItem | string, kindHint?: string) => {
        await removeFromExplorerCommand(itemOrPath, kindHint);
      }
    ),
    vscode.commands.registerCommand(
      'lowcodeStudio.unlinkStudioWebLocal',
      async (item?: ProjectTreeItem) => {
        const dir = projectDirFromTreeItem(item) || (await resolveLcsProjectDir());
        if (!dir) {
          return;
        }
        if (!getStudioWebLocalLink(dir)) {
          void vscode.window.showInformationMessage(
            'This project is not linked to a Studio Web Local Workspace.'
          );
          return;
        }
        const ok = await vscode.window.showWarningMessage(
          `Unlink Studio Web Local Workspace from "${path.basename(dir)}"? Solution files on disk are kept.`,
          { modal: true },
          'Unlink'
        );
        if (ok !== 'Unlink') {
          return;
        }
        unlinkStudioWebLocalWorkspace(dir);
        projectProvider.refresh();
        editorProvider?.refreshProjectTree?.();
        void vscode.window.showInformationMessage('Studio Web Local Workspace unlinked.');
      }
    ),
    vscode.commands.registerCommand('lowcodeStudio.exportConfigXlsx', () =>
      exportConfigXlsxCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.importConfigXlsx', () =>
      importConfigXlsxCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.openStudioWeb', () => {
      void vscode.env.openExternal(vscode.Uri.parse(STUDIO_WEB_URL));
    }),
    vscode.commands.registerCommand('lowcodeStudio.showStudioWebGuide', async () => {
      const doc = await vscode.workspace.openTextDocument({
        content: studioWebSyncGuideMarkdown(),
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    }),
    vscode.commands.registerCommand('lowcodeStudio.showGettingStarted', () => {
      showGettingStarted();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith('.lcs.json') || path.basename(doc.fileName) === 'project.json') {
        projectProvider.refresh();
        editorProvider?.refreshProjectTree?.();
        const syncOnSave = vscode.workspace
          .getConfiguration('lowcodeStudio')
          .get<boolean>('syncStudioWebOnSave', true);
        if (syncOnSave) {
          const projectRoot = findProjectRoot(path.dirname(doc.fileName));
          if (projectRoot && getStudioWebLocalLink(projectRoot)) {
            try {
              const synced = trySyncToStudioWebLocal(projectRoot);
              if (synced) {
                void vscode.window.setStatusBarMessage(
                  `Synced → Studio Web Local (${path.basename(synced.link.solutionDir)})`,
                  2500
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
        }
      }
      if (path.basename(doc.fileName) === CUSTOM_ACTIVITIES_FILENAME) {
        refreshCustomActivityOverlay();
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

async function openLocalProjectCommand(): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Open LowCode Studio Project',
    title: 'Select a LowCode Studio project folder (contains project.json)'
  });
  const folderUri = picked?.[0];
  if (!folderUri) {
    return;
  }

  const projectDir = resolveLcsProjectFromFolder(folderUri.fsPath);
  if (!projectDir) {
    const importInstead = await vscode.window.showWarningMessage(
      'No LowCode Studio project.json (schemaVersion 1.0) found in that folder.',
      'Import as UiPath Project',
      'Cancel'
    );
    if (importInstead === 'Import as UiPath Project') {
      await importUiPathProjectCommand(folderUri);
    }
    return;
  }

  const alreadyOpen = vscode.workspace.workspaceFolders?.some(
    (f) =>
      projectDir === f.uri.fsPath ||
      projectDir.startsWith(f.uri.fsPath + path.sep) ||
      f.uri.fsPath.startsWith(projectDir + path.sep)
  );

  if (!alreadyOpen) {
    const choice = await vscode.window.showInformationMessage(
      `Open project "${path.basename(projectDir)}" in this window?`,
      'Open Folder',
      'Add to Workspace',
      'Cancel'
    );
    if (!choice || choice === 'Cancel') {
      return;
    }
    if (choice === 'Open Folder') {
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectDir), {
        forceNewWindow: false
      });
      return; // window reloads
    }
    const folders = vscode.workspace.workspaceFolders;
    const index = folders?.length ?? 0;
    const added = vscode.workspace.updateWorkspaceFolders(index, 0, {
      uri: vscode.Uri.file(projectDir),
      name: path.basename(projectDir)
    });
    if (!added) {
      // Fallback: open folder
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectDir), false);
      return;
    }
  }

  await setActiveProjectDir(projectDir);
  refreshCustomActivityOverlay();

  const main = readProjectMainWorkflow(projectDir);
  if (main) {
    const uri = vscode.Uri.file(main);
    await vscode.commands.executeCommand(
      'vscode.openWith',
      uri,
      WorkflowEditorProvider.viewType,
      { preview: false }
    );
  }

  void vscode.window.showInformationMessage(
    `Opened LowCode Studio project "${path.basename(projectDir)}".`
  );
}

function resolveLcsProjectFromFolder(folder: string): string | undefined {
  const direct = path.join(folder, 'project.json');
  if (fs.existsSync(direct)) {
    try {
      const content = JSON.parse(fs.readFileSync(direct, 'utf8')) as {
        schemaVersion?: string;
      };
      if (content.schemaVersion === '1.0') {
        return folder;
      }
    } catch {
      // continue search
    }
  }
  const nested = findNearestProject(folder);
  return nested ? path.dirname(nested) : undefined;
}

function readProjectMainWorkflow(projectDir: string): string | undefined {
  const manifestPath = path.join(projectDir, 'project.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      main?: string;
      workflows?: string[];
    };
    const candidates = [
      manifest.main,
      ...(manifest.workflows || []),
      'Main.lcs.json',
      'Framework/Process.lcs.json'
    ].filter(Boolean) as string[];
    for (const rel of candidates) {
      const abs = path.join(projectDir, rel);
      if (fs.existsSync(abs)) {
        return abs;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function validatePackagesCommand(): Promise<void> {
  const projectDir = await resolveLcsProjectDir();
  if (!projectDir) {
    return;
  }
  try {
    const result = validateProjectPackages(projectDir);
    const report = formatPackageValidationReport(result);
    const channel = getOutput();
    channel.clear();
    channel.appendLine(report);
    channel.show(true);

    const warnCount = result.warnings.filter((w) => w.severity === 'warning').length;
    const infoCount = result.warnings.filter((w) => w.severity === 'info').length;
    if (!result.warnings.length) {
      void vscode.window.showInformationMessage(
        `Packages OK — ${Object.keys(result.dependencies).length} NuGet deps for Studio Web.`
      );
      return;
    }
    const open = await vscode.window.showWarningMessage(
      `Package validation: ${warnCount} warning(s), ${infoCount} info. See LowCode Studio output.`,
      'Open Output'
    );
    if (open === 'Open Output') {
      channel.show(true);
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Package validation failed'
    );
  }
}

async function activityPaletteCommand(): Promise<void> {
  // Prefer in-designer Cmd+K palette when the webview is open
  if (editorProvider.activeWorkflow) {
    editorProvider.openActivityPalette();
    return;
  }

  const state = editorProvider.getPaletteState();
  const entries = buildPaletteEntries(state, getActivityCatalog());
  const items = entries.map((e) => ({
    label: `${e.pinned ? '$(star-full) ' : ''}${e.displayName}`,
    description: `${e.section} · ${e.category}`,
    detail: e.type,
    type: e.type
  }));
  const picked = await vscode.window.showQuickPick(items, {
    matchOnDescription: true,
    matchOnDetail: true,
    placeHolder: 'Insert activity (pin favorites in the designer with ⌘K)'
  });
  if (!picked) {
    return;
  }
  editorProvider.insertActivity(picked.type);
}

async function newProject(
  forcedTemplate?: 'blank' | 'reframework' | 'blueprint'
): Promise<void> {
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
            label: 'Robot Blueprint',
            description: 'One-click scaffolds: scrape→Excel, login→email, API→table',
            value: 'blueprint' as const
          },
          {
            label: 'REFramework',
            description: 'UiPath-style Init → Get Data → Process → End (recommended)',
            value: 'reframework' as const
          },
          {
            label: 'Blank Project',
            description: 'Empty Sequence or Flowchart',
            value: 'blank' as const
          }
        ],
        { placeHolder: 'Choose a project template' }
      )
    )?.value;

  if (!templatePick) {
    return;
  }

  let blueprintId: BlueprintId | undefined;
  if (templatePick === 'blueprint') {
    const pick = await vscode.window.showQuickPick(
      ROBOT_BLUEPRINTS.map((b) => ({
        label: b.label,
        description: b.description,
        detail: b.detail,
        id: b.id,
        defaultProjectName: b.defaultProjectName
      })),
      { placeHolder: 'Choose a robot blueprint' }
    );
    if (!pick) {
      return;
    }
    blueprintId = pick.id;
  }

  const defaultName =
    templatePick === 'reframework'
      ? 'MyREFramework'
      : templatePick === 'blueprint' && blueprintId
        ? getBlueprint(blueprintId)?.defaultProjectName || 'MyRobot'
        : 'MyAutomation';

  const name = await vscode.window.showInputBox({
    prompt: 'Project name',
    value: defaultName,
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
    writeGeneratedFiles(projectDir, generateREFrameworkProject(name.trim()));
  } else if (templatePick === 'blueprint' && blueprintId) {
    writeGeneratedFiles(projectDir, generateBlueprintProject(name.trim(), blueprintId));
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
  const blueprintLabel = blueprintId ? getBlueprint(blueprintId)?.label : undefined;
  vscode.window.showInformationMessage(
    templatePick === 'reframework'
      ? `Created REFramework project "${name.trim()}". Open Process.lcs.json to add business logic.`
      : templatePick === 'blueprint'
        ? `Created blueprint "${blueprintLabel}" → ${name.trim()}. Dry Run (F5) or Step Through next.`
        : `Created project "${name.trim()}".`
  );
}

function writeGeneratedFiles(
  projectDir: string,
  files: { relativePath: string; content: string | Buffer }[]
): void {
  for (const file of files) {
    const full = path.join(projectDir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }
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

async function importUiPathProjectCommand(preselected?: vscode.Uri): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showErrorMessage('Open a workspace folder first.');
    return;
  }
  let sourceUri = preselected;
  if (!sourceUri) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Import UiPath project folder'
    });
    sourceUri = picked?.[0];
  }
  if (!sourceUri) {
    return;
  }
  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing UiPath project…'
      },
      async () => importUiPathProjectFolder(sourceUri!.fsPath, workspace.uri.fsPath)
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

async function exportConfigXlsxCommand(): Promise<void> {
  const projectDir = await resolveLcsProjectDir();
  if (!projectDir) {
    return;
  }
  try {
    const result = exportJsonToXlsx(projectDir);
    projectProvider.refresh();
    const open = await vscode.window.showInformationMessage(
      `Exported classic Config.xlsx (${result.sheets.join(', ')})`,
      'Open Folder'
    );
    if (open === 'Open Folder') {
      await vscode.commands.executeCommand(
        'revealFileInOS',
        vscode.Uri.file(result.targetPath)
      );
    }
  } catch (err) {
    vscode.window.showErrorMessage(err instanceof Error ? err.message : 'Export Config.xlsx failed');
  }
}

async function importConfigXlsxCommand(): Promise<void> {
  const projectDir = await resolveLcsProjectDir();
  if (!projectDir) {
    return;
  }
  const defaultXlsx = path.join(projectDir, CONFIG_XLSX_REL);
  let xlsxPath = fs.existsSync(defaultXlsx) ? defaultXlsx : undefined;
  if (!xlsxPath) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { Excel: ['xlsx'] },
      openLabel: 'Import Config.xlsx'
    });
    if (!picked?.[0]) {
      return;
    }
    xlsxPath = picked[0].fsPath;
  } else {
    const choice = await vscode.window.showQuickPick(
      [
        { label: `Use project ${CONFIG_XLSX_REL}`, value: 'project' },
        { label: 'Pick another .xlsx…', value: 'pick' }
      ],
      { placeHolder: 'Import classic REFramework Config.xlsx → Config.json' }
    );
    if (!choice) {
      return;
    }
    if (choice.value === 'pick') {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { Excel: ['xlsx'] },
        openLabel: 'Import Config.xlsx'
      });
      if (!picked?.[0]) {
        return;
      }
      xlsxPath = picked[0].fsPath;
    }
  }

  try {
    const result = importXlsxToJson(projectDir, xlsxPath);
    projectProvider.refresh();
    const doc = await vscode.workspace.openTextDocument(result.targetPath);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(
      `Imported Config.xlsx → ${CONFIG_JSON_REL} (${result.sheets.join(', ')})`
    );
  } catch (err) {
    vscode.window.showErrorMessage(err instanceof Error ? err.message : 'Import Config.xlsx failed');
  }
}

async function setActiveProjectDir(projectDir: string): Promise<void> {
  await extensionContext.workspaceState.update('lowcodeStudio.activeProjectDir', projectDir);
  projectProvider?.setActiveProject(projectDir);
  projectProvider?.refresh();
  editorProvider?.refreshProjectTree?.();
}

async function ensureFolderInWorkspace(folderPath: string, name?: string): Promise<void> {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return;
  }
  const resolved = path.resolve(folderPath);
  const folders = vscode.workspace.workspaceFolders || [];
  const already = folders.some(
    (f) =>
      path.resolve(f.uri.fsPath) === resolved ||
      resolved.startsWith(path.resolve(f.uri.fsPath) + path.sep)
  );
  if (already) {
    return;
  }
  const added = vscode.workspace.updateWorkspaceFolders(folders.length, 0, {
    uri: vscode.Uri.file(resolved),
    name: name || path.basename(resolved)
  });
  if (!added) {
    // Multi-root may be unavailable; ignore quietly
  }
}

async function removeFromExplorerCommand(
  itemOrPath?: ProjectTreeItem | string,
  kindHint?: string
): Promise<void> {
  const targetPath =
    typeof itemOrPath === 'string'
      ? itemOrPath
      : itemOrPath?.resourcePath
        ? itemOrPath.contextValue === 'project' || itemOrPath.contextValue === 'solution'
          ? itemOrPath.contextValue === 'project'
            ? path.dirname(itemOrPath.resourcePath)
            : itemOrPath.resourcePath
          : projectDirFromTreeItem(itemOrPath)
        : undefined;
  const kind =
    kindHint ||
    (typeof itemOrPath === 'object' && itemOrPath?.contextValue) ||
    (targetPath && getStudioWebLocalLink(
      (await resolveLcsProjectDir()) || ''
    )?.solutionDir === targetPath
      ? 'solution'
      : 'project');

  if (!targetPath) {
    void vscode.window.showWarningMessage('Nothing selected to remove.');
    return;
  }

  // Unlink Studio Web solution from active LCS project
  if (kind === 'solution' || kind === 'workspace') {
    const lcsDir =
      (await resolveLcsProjectDir()) ||
      extensionContext.workspaceState.get<string>('lowcodeStudio.activeProjectDir');
    const link = lcsDir ? getStudioWebLocalLink(lcsDir) : undefined;
    if (link && path.resolve(link.solutionDir) === path.resolve(targetPath)) {
      const ok = await vscode.window.showWarningMessage(
        `Remove Studio Web solution "${path.basename(targetPath)}" from explorer and unlink it? Files on disk are kept.`,
        { modal: true },
        'Remove'
      );
      if (ok !== 'Remove') {
        return;
      }
      if (lcsDir) {
        unlinkStudioWebLocalWorkspace(lcsDir);
      }
    }
  } else {
    const ok = await vscode.window.showWarningMessage(
      `Remove "${path.basename(targetPath)}" from the explorer? Files on disk are kept.`,
      { modal: true },
      'Remove'
    );
    if (ok !== 'Remove') {
      return;
    }
    if (
      extensionContext.workspaceState.get<string>('lowcodeStudio.activeProjectDir') === targetPath
    ) {
      await extensionContext.workspaceState.update('lowcodeStudio.activeProjectDir', undefined);
      projectProvider?.setActiveProject(undefined);
    }
  }

  // Drop matching multi-root workspace folder
  const folders = vscode.workspace.workspaceFolders || [];
  const idx = folders.findIndex(
    (f) =>
      path.resolve(f.uri.fsPath) === path.resolve(targetPath) ||
      path.resolve(targetPath).startsWith(path.resolve(f.uri.fsPath) + path.sep)
  );
  if (idx >= 0) {
    vscode.workspace.updateWorkspaceFolders(idx, 1);
  }

  projectProvider.refresh();
  editorProvider?.refreshProjectTree?.();
  void vscode.window.showInformationMessage(`Removed ${path.basename(targetPath)} from explorer.`);
}

function projectDirFromTreeItem(item?: ProjectTreeItem): string | undefined {
  if (!item || !item.resourcePath) {
    return undefined;
  }
  if (item.contextValue === 'project') {
    // resourcePath is project.json
    return path.dirname(item.resourcePath);
  }
  if (item.contextValue === 'solution') {
    // Find LCS project that links to this Studio Web solution
    const roots = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
    for (const root of roots) {
      for (const projectDir of findAllLcsProjects([root])) {
        const link = getStudioWebLocalLink(projectDir);
        if (link && path.resolve(link.solutionDir) === path.resolve(item.resourcePath)) {
          return projectDir;
        }
      }
    }
    return extensionContext.workspaceState.get<string>('lowcodeStudio.activeProjectDir');
  }
  if (
    item.contextValue === 'folder' ||
    item.contextValue === 'workflow' ||
    item.contextValue === 'file'
  ) {
    const start = fs.existsSync(item.resourcePath) && fs.statSync(item.resourcePath).isDirectory()
      ? item.resourcePath
      : path.dirname(item.resourcePath);
    return findProjectRoot(start);
  }
  return undefined;
}

function projectDirFromOpenDocument(): string | undefined {
  const docPath =
    editorProvider?.getActiveDocumentPath?.() ||
    vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!docPath) {
    return undefined;
  }
  return findProjectRoot(path.dirname(docPath));
}

async function resolveLcsProjectDir(
  treeItem?: ProjectTreeItem
): Promise<string | undefined> {
  // 1) Explicit Project Explorer item (title action may pass nothing; context menu can)
  const fromArg = projectDirFromTreeItem(treeItem);
  if (fromArg && isLcsProjectDir(fromArg)) {
    await setActiveProjectDir(fromArg);
    return fromArg;
  }

  // 2) Current Project Explorer selection
  const fromSelection = projectDirFromTreeItem(projectsTreeView?.selection?.[0]);
  if (fromSelection && isLcsProjectDir(fromSelection)) {
    await setActiveProjectDir(fromSelection);
    return fromSelection;
  }

  // 3) Open designer / editor document's project
  const fromDoc = projectDirFromOpenDocument();
  if (fromDoc && isLcsProjectDir(fromDoc)) {
    await setActiveProjectDir(fromDoc);
    return fromDoc;
  }

  // 4) Remembered active project (only if still present)
  const remembered = extensionContext.workspaceState.get<string>(
    'lowcodeStudio.activeProjectDir'
  );
  if (remembered && isLcsProjectDir(remembered)) {
    return remembered;
  }

  const roots = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
  if (!roots.length) {
    const open = await vscode.window.showInformationMessage(
      'No folder open. Open a local LowCode Studio project?',
      'Open Local Project'
    );
    if (open === 'Open Local Project') {
      await openLocalProjectCommand();
      return extensionContext.workspaceState.get<string>('lowcodeStudio.activeProjectDir');
    }
    return undefined;
  }

  // 5) Discover projects — never silently pick the wrong sibling
  const all = findAllLcsProjects(roots);
  if (all.length === 1) {
    await setActiveProjectDir(all[0]);
    return all[0];
  }
  if (all.length > 1) {
    const picked = await vscode.window.showQuickPick(
      all.map((p) => ({
        label: path.basename(p),
        description: p,
        projectDir: p
      })),
      {
        title: 'Select LowCode Studio project',
        placeHolder: 'Multiple projects found — choose which to export'
      }
    );
    if (!picked) {
      return undefined;
    }
    await setActiveProjectDir(picked.projectDir);
    return picked.projectDir;
  }

  const folderPick = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select LowCode Studio project folder'
  });
  const chosen = folderPick?.[0]?.fsPath;
  if (chosen && isLcsProjectDir(chosen)) {
    await setActiveProjectDir(chosen);
    return chosen;
  }
  return chosen;
}

async function exportStudioWebCommand(): Promise<void> {
  // Keep classic export; guided flow is Connect to Studio Web
  const projectDir = await resolveLcsProjectDir();
  if (!projectDir) {
    return;
  }
  try {
    const result = exportToStudioWebProject(projectDir);
    await extensionContext.workspaceState.update(
      'lowcodeStudio.lastStudioWebExport',
      result.targetDir
    );
    const open = await vscode.window.showInformationMessage(
      `Exported Studio Web project to ${path.basename(result.targetDir)}`,
      'Open Folder',
      'Open Studio Web',
      'Show Guide'
    );
    if (open === 'Open Folder') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(result.targetDir));
    }
    if (open === 'Open Studio Web') {
      await vscode.env.openExternal(vscode.Uri.parse(STUDIO_WEB_URL));
    }
    if (open === 'Show Guide') {
      await vscode.commands.executeCommand('lowcodeStudio.showStudioWebGuide');
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Export failed'
    );
  }
}

async function connectStudioWebCommand(treeItem?: ProjectTreeItem): Promise<void> {
  const projectDir = await resolveLcsProjectDir(treeItem);
  if (!projectDir) {
    return;
  }
  try {
    const existing = getStudioWebLocalLink(projectDir);
    const choices: Array<vscode.QuickPickItem & { id: string }> = [];
    if (existing && fs.existsSync(existing.solutionDir)) {
      choices.push({
        id: 'sync',
        label: `$(sync) Sync & open linked Local Workspace`,
        description: path.basename(existing.solutionDir),
        detail: existing.solutionDir
      });
    }
    choices.push(
      {
        id: 'create',
        label: '$(new-folder) Create new Studio Web Local Workspace solution',
        detail: 'Writes a .uipx solution folder; open it in Studio Web → Local Workspace'
      },
      {
        id: 'open',
        label: '$(folder-opened) Open existing Studio Web Local Workspace solution',
        detail: 'Pick a folder that already contains a .uipx solution'
      },
      {
        id: 'legacy',
        label: '$(file-zip) Legacy: export .uip package once',
        detail: 'One-off Import project handoff (no sync-on-save)'
      }
    );

    const picked = await vscode.window.showQuickPick(choices, {
      title: `Studio Web — ${path.basename(projectDir)}`,
      placeHolder: 'Open/create Local Workspace (recommended) or legacy .uip export'
    });
    if (!picked) {
      return;
    }

    if (picked.id === 'legacy') {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Exporting .uip for ${path.basename(projectDir)}…`
        },
        async () => connectToStudioWeb(projectDir, { legacyUip: true })
      );
      const uip = result.archives?.uipPath;
      const next = await vscode.window.showInformationMessage(
        uip ? `Exported ${path.basename(uip)}` : 'Exported Studio Web package',
        'Reveal .uip',
        'Open Studio Web',
        'Open Folder'
      );
      if (next === 'Reveal .uip' && uip) {
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(uip));
      }
      if (next === 'Open Studio Web') {
        await vscode.env.openExternal(vscode.Uri.parse(STUDIO_WEB_URL));
      }
      if (next === 'Open Folder') {
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(result.targetDir));
      }
      return;
    }

    let connectOptions: Parameters<typeof connectToStudioWeb>[1];
    if (picked.id === 'sync') {
      connectOptions = undefined; // uses existing link
    } else if (picked.id === 'create') {
      const parent = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Create solution here',
        title: 'Parent folder for the new Studio Web Local Workspace solution'
      });
      if (!parent?.[0]) {
        return;
      }
      connectOptions = {
        local: {
          mode: 'create',
          targetDir: parent[0].fsPath,
          solutionName: path.basename(projectDir)
        }
      };
    } else {
      const folder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Use this solution',
        title: 'Select an existing Studio Web Local Workspace solution folder (.uipx)'
      });
      if (!folder?.[0]) {
        return;
      }
      connectOptions = {
        local: {
          mode: 'open',
          targetDir: folder[0].fsPath
        }
      };
    }

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Linking Studio Web Local Workspace for ${path.basename(projectDir)}…`
      },
      async () => connectToStudioWeb(projectDir, connectOptions)
    );

    await extensionContext.workspaceState.update(
      'lowcodeStudio.lastStudioWebExport',
      result.local?.link.solutionDir || result.targetDir
    );

    try {
      const todo = buildWindowsTodoChecklist(projectDir);
      writeWindowsTodoFile(result.local?.link.solutionDir || result.targetDir, todo);
      writeWindowsTodoFile(projectDir, todo);
    } catch {
      // ignore
    }

    const solutionDir = result.local?.link.solutionDir || result.targetDir;
    // Surface the solution in Project Explorer (workspace + designer rail)
    await ensureFolderInWorkspace(solutionDir, path.basename(solutionDir) + ' (Studio Web)');
    projectProvider.refresh();
    editorProvider?.refreshProjectTree?.();

    const openability = validateStudioWebLocalOpenability(projectDir);
    const channel = getOutput();
    channel.clear();
    channel.appendLine('Studio Web Local Workspace');
    channel.appendLine('─'.repeat(48));
    channel.appendLine(`LCS project: ${projectDir}`);
    channel.appendLine(`Solution:    ${solutionDir}`);
    channel.appendLine(`Project dir: ${result.targetDir}`);
    channel.appendLine(`Main:        ${result.mainXaml}`);
    channel.appendLine(
      `Openable:    ${openability.ok ? 'yes' : 'NO'} (${openability.workflows.length} workflows)`
    );
    if (!openability.ok) {
      openability.errors.forEach((e) => channel.appendLine(`  ! ${e}`));
    } else {
      openability.workflows.slice(0, 12).forEach((w) => channel.appendLine(`  · ${w}`));
    }
    channel.appendLine('');
    channel.appendLine('Checklist:');
    result.checklist.forEach((c, i) => channel.appendLine(`  ${i + 1}. ${c}`));
    channel.show(true);

    if (!openability.ok) {
      void vscode.window.showWarningMessage(
        `Local Workspace linked, but open checks failed: ${openability.errors[0]}`
      );
    }

    const next = await vscode.window.showInformationMessage(
      `Linked Local Workspace → ${path.basename(solutionDir)}. Save syncs automatically.`,
      'Reveal Solution',
      'Open Studio Web',
      'Open Checklist',
      'Show Guide'
    );
    if (next === 'Reveal Solution') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(solutionDir));
    }
    if (next === 'Open Studio Web') {
      await vscode.env.openExternal(vscode.Uri.parse(STUDIO_WEB_URL));
    }
    if (next === 'Open Checklist' && fs.existsSync(result.guidePath)) {
      const doc = await vscode.workspace.openTextDocument(result.guidePath);
      await vscode.window.showTextDocument(doc);
    }
    if (next === 'Show Guide') {
      await vscode.commands.executeCommand('lowcodeStudio.showStudioWebGuide');
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Studio Web connect failed'
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

function getUserCustomActivities(): CustomActivityDefinition[] {
  return (
    extensionContext.globalState.get<CustomActivityDefinition[]>(USER_CUSTOM_ACTIVITIES_KEY) ||
    []
  );
}

async function setUserCustomActivities(list: CustomActivityDefinition[]): Promise<void> {
  await extensionContext.globalState.update(USER_CUSTOM_ACTIVITIES_KEY, list);
}

function refreshCustomActivityOverlay(): void {
  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const projectJson = workspace ? findNearestProject(workspace) : undefined;
  const projectCustoms = projectJson
    ? loadProjectCustomActivities(path.dirname(projectJson))
    : [];
  const userCustoms = getUserCustomActivities();
  // Project wins on type collision
  const map = new Map<string, CustomActivityDefinition>();
  for (const a of userCustoms) {
    map.set(a.type, { ...a, source: 'user' });
  }
  for (const a of projectCustoms) {
    map.set(a.type, { ...a, source: 'project' });
  }
  setCustomActivityOverlay([...map.values()]);
  activityProvider?.refresh();
}

async function registerCustomActivityCommand(): Promise<void> {
  const type = await vscode.window.showInputBox({
    prompt: 'Activity type (Namespace.Name)',
    value: 'Custom.MyLib.DoWork',
    validateInput: (v) =>
      /^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)+$/.test(v)
        ? undefined
        : 'Use Namespace.Activity form'
  });
  if (!type) {
    return;
  }
  const displayName = await vscode.window.showInputBox({
    prompt: 'Display name',
    value: type.split('.').pop() || type
  });
  if (!displayName) {
    return;
  }
  const description = await vscode.window.showInputBox({
    prompt: 'Description (optional)',
    value: 'Custom activity for dry-run + Studio export'
  });
  const nugetPackage = await vscode.window.showInputBox({
    prompt: 'NuGet package id (optional, for Studio Web export)',
    value: ''
  });
  const nugetVersion = nugetPackage
    ? await vscode.window.showInputBox({
        prompt: 'NuGet version',
        value: '1.0.0'
      })
    : undefined;

  const scope = await vscode.window.showQuickPick(
    [
      {
        label: 'This project',
        description: `Save to ${CUSTOM_ACTIVITIES_FILENAME} (shared with team)`,
        value: 'project' as const
      },
      {
        label: 'All my projects',
        description: 'Save to user library on this machine',
        value: 'user' as const
      }
    ],
    { placeHolder: 'Where should this activity be stored?' }
  );
  if (!scope) {
    return;
  }

  let draft: CustomActivityDefinition;
  try {
    draft = createCustomActivityDraft({
      type,
      displayName,
      description: description || undefined,
      nugetPackage: nugetPackage || undefined,
      nugetVersion: nugetVersion || undefined,
      source: scope.value
    });
  } catch (err) {
    vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
    return;
  }

  if (scope.value === 'project') {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) {
      vscode.window.showErrorMessage('Open a workspace folder first.');
      return;
    }
    const projectJson = findNearestProject(workspace.uri.fsPath);
    if (!projectJson) {
      vscode.window.showErrorMessage('No LowCode Studio project.json found.');
      return;
    }
    const projectDir = path.dirname(projectJson);
    const list = upsertCustomActivity(loadProjectCustomActivities(projectDir), draft);
    saveProjectCustomActivities(projectDir, list);
    vscode.window.showInformationMessage(
      `Saved ${draft.type} to project ${CUSTOM_ACTIVITIES_FILENAME}`
    );
  } else {
    const list = upsertCustomActivity(getUserCustomActivities(), draft);
    await setUserCustomActivities(list);
    vscode.window.showInformationMessage(`Saved ${draft.type} to your user activity library`);
  }

  refreshCustomActivityOverlay();
}

async function manageCustomActivitiesCommand(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const projectJson = workspace ? findNearestProject(workspace) : undefined;
  const projectDir = projectJson ? path.dirname(projectJson) : undefined;
  const projectList = projectDir ? loadProjectCustomActivities(projectDir) : [];
  const userList = getUserCustomActivities();

  const items = [
    ...projectList.map((a) => ({
      label: a.displayName,
      description: `${a.type} · project`,
      detail: a.description,
      activity: a,
      scope: 'project' as const
    })),
    ...userList.map((a) => ({
      label: a.displayName,
      description: `${a.type} · user library`,
      detail: a.description,
      activity: a,
      scope: 'user' as const
    }))
  ];

  if (!items.length) {
    const create = await vscode.window.showInformationMessage(
      'No custom activities registered yet.',
      'Register one'
    );
    if (create) {
      await registerCustomActivityCommand();
    }
    return;
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Custom activities — select to remove, or Esc to cancel'
  });
  if (!picked) {
    return;
  }

  const action = await vscode.window.showQuickPick(
    [
      { label: 'Insert into open designer', value: 'insert' },
      { label: 'Remove registration', value: 'remove' }
    ],
    { placeHolder: picked.activity.type }
  );
  if (!action) {
    return;
  }

  if (action.value === 'insert') {
    editorProvider.insertActivity(picked.activity.type);
    return;
  }

  if (picked.scope === 'project' && projectDir) {
    saveProjectCustomActivities(
      projectDir,
      projectList.filter((a) => a.type !== picked.activity.type)
    );
  } else {
    await setUserCustomActivities(userList.filter((a) => a.type !== picked.activity.type));
  }
  refreshCustomActivityOverlay();
  vscode.window.showInformationMessage(`Removed ${picked.activity.type}`);
}

async function dryRunScenarioCommand(): Promise<void> {
  const projectDir = await resolveLcsProjectDir();
  if (!projectDir) {
    return;
  }
  const mainPath = path.join(projectDir, 'Main.lcs.json');
  if (!fs.existsSync(mainPath)) {
    vscode.window.showErrorMessage('REFramework Main.lcs.json not found in project.');
    return;
  }

  const projectName = path.basename(projectDir);
  let scenarios = ensureScenariosFile(projectDir, projectName).scenarios;
  if (!scenarios.length) {
    scenarios = runAllScenarios(projectDir).map((r) => r.scenario);
  }

  const last =
    extensionContext.workspaceState.get<string>('lowcodeStudio.lastScenario') || '';

  const pick = await vscode.window.showQuickPick(
    [
      ...(last && scenarios.some((s) => s.name === last)
        ? [
            {
              label: `$(history) Run last: ${last}`,
              description: 'Fastest path',
              value: last
            }
          ]
        : []),
      {
        label: '$(run-all) All scenarios',
        description: 'Run every test in Data/Test/scenarios.json',
        value: '__all__'
      },
      {
        label: '$(add) Add quick scenario…',
        description: 'Create a MaxTransactions smoke test',
        value: '__add__'
      },
      {
        label: '$(checklist) Manage scenarios…',
        description: 'Duplicate / open / organize',
        value: '__manage__'
      },
      ...scenarios.map((s) => ({
        label: `$(beaker) ${s.name}`,
        description: s.description || '',
        value: s.name
      }))
    ],
    { placeHolder: 'Dry-run scenario — easiest way to test REFramework on Mac' }
  );
  if (!pick) {
    return;
  }
  if (pick.value === '__manage__') {
    await manageScenariosCommand();
    return;
  }
  if (pick.value === '__add__') {
    await addQuickScenarioCommand(projectDir);
    return;
  }

  const results =
    pick.value === '__all__'
      ? runAllScenarios(projectDir)
      : [runScenario(projectDir, scenarios.find((s) => s.name === pick.value)!)];

  if (pick.value !== '__all__') {
    await extensionContext.workspaceState.update('lowcodeStudio.lastScenario', pick.value);
  }

  await showScenarioResults(results);
}

async function manageScenariosCommand(): Promise<void> {
  const projectDir = await resolveLcsProjectDir();
  if (!projectDir) {
    return;
  }
  const projectName = path.basename(projectDir);
  const file = ensureScenariosFile(projectDir, projectName);

  const action = await vscode.window.showQuickPick(
    [
      {
        label: '$(run-all) Run all scenarios',
        value: 'run-all'
      },
      {
        label: '$(add) Add quick scenario',
        description: 'Name + MaxTransactions → saved to scenarios.json',
        value: 'add'
      },
      {
        label: '$(copy) Duplicate scenario',
        value: 'duplicate'
      },
      {
        label: '$(go-to-file) Open scenarios.json',
        value: 'open'
      },
      {
        label: '$(play) Run one scenario',
        value: 'run-one'
      }
    ],
    { placeHolder: 'Manage REFramework dry-run scenarios' }
  );
  if (!action) {
    return;
  }

  if (action.value === 'run-all') {
    await showScenarioResults(runAllScenarios(projectDir));
    return;
  }
  if (action.value === 'add') {
    await addQuickScenarioCommand(projectDir);
    return;
  }
  if (action.value === 'open') {
    const doc = await vscode.workspace.openTextDocument(scenariosFilePath(projectDir));
    await vscode.window.showTextDocument(doc);
    return;
  }
  if (action.value === 'duplicate') {
    if (!file.scenarios.length) {
      vscode.window.showInformationMessage('No scenarios to duplicate yet.');
      return;
    }
    const source = await vscode.window.showQuickPick(
      file.scenarios.map((s) => ({ label: s.name, description: s.description, scenario: s })),
      { placeHolder: 'Scenario to duplicate' }
    );
    if (!source) {
      return;
    }
    const newName = await vscode.window.showInputBox({
      prompt: 'New scenario name',
      value: `${source.scenario.name}-copy`,
      validateInput: (v) =>
        /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v) ? undefined : 'Use letters, numbers, _ or -'
    });
    if (!newName) {
      return;
    }
    const next = upsertScenario(file, duplicateScenario(source.scenario, newName));
    saveScenariosFile(projectDir, next);
    projectProvider.refresh();
    vscode.window.showInformationMessage(`Duplicated scenario → ${newName}`);
    return;
  }
  if (action.value === 'run-one') {
    await dryRunScenarioCommand();
  }
}

async function addQuickScenarioCommand(projectDir: string): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Scenario name',
    value: 'smoke',
    validateInput: (v) =>
      /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v) ? undefined : 'Use letters, numbers, _ or -'
  });
  if (!name) {
    return;
  }
  const maxText = await vscode.window.showInputBox({
    prompt: 'MaxTransactions (0 = empty queue)',
    value: '1',
    validateInput: (v) => (/^\d+$/.test(v) ? undefined : 'Enter a non-negative integer')
  });
  if (maxText == null) {
    return;
  }
  const projectName = path.basename(projectDir);
  const file = ensureScenariosFile(projectDir, projectName);
  const scenario = createQuickScenario({
    name,
    maxTransactions: Number(maxText)
  });
  saveScenariosFile(projectDir, upsertScenario(file, scenario));
  await extensionContext.workspaceState.update('lowcodeStudio.lastScenario', name);
  projectProvider.refresh();

  const runNow = await vscode.window.showInformationMessage(
    `Saved scenario "${name}" (MaxTransactions=${maxText})`,
    'Dry Run now',
    'Open file'
  );
  if (runNow === 'Dry Run now') {
    await showScenarioResults([runScenario(projectDir, scenario)]);
  }
  if (runNow === 'Open file') {
    const doc = await vscode.workspace.openTextDocument(scenariosFilePath(projectDir));
    await vscode.window.showTextDocument(doc);
  }
}

async function showScenarioResults(
  results: ReturnType<typeof runAllScenarios>
): Promise<void> {
  const channel = getOutput();
  channel.clear();
  channel.appendLine(formatScenarioReport(results));
  channel.appendLine('─'.repeat(48));
  for (const r of results) {
    channel.appendLine(`--- Log: ${r.scenario.name} ---`);
    for (const line of r.dryRun.log) {
      channel.appendLine(line);
    }
    channel.appendLine('');
  }
  channel.show(true);

  const passed = results.filter((r) => r.passed).length;
  if (passed === results.length) {
    vscode.window.showInformationMessage(
      `Scenarios: ${passed}/${results.length} passed`
    );
  } else {
    vscode.window.showWarningMessage(
      `Scenarios: ${passed}/${results.length} passed — see LowCode Studio output`
    );
  }
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

## The easy loop (keys of this extension)

\`\`\`
1. New Robot Blueprint (or REFramework)
2. Dry Run / Scenarios   ← Shift+F5  (fastest local testing)
3. Connect to Studio Web ← export + open studio.uipath.com
4. Publish from Studio Web to Orchestrator
\`\`\`

| Priority | Command | Shortcut |
|---|---|---|
| **1. Test** | Dry Run / Dry Run Scenarios / Manage Scenarios | F5 / **Shift+F5** |
| **2. Ship** | **Connect to Studio Web** | — |
| Design | **New Robot Blueprint** / REFramework / Open Designer | — |
| Config | Import/Export Config.xlsx | — |

## Quick start

1. **New Robot Blueprint** (scrape→Excel, login→email, API→table) *or* **New REFramework Project**
2. Edit \`Main.lcs.json\` (blueprint) or \`Framework/Process.lcs.json\` (REFramework)
3. Tune selectors / \`Data/Config.json\` as needed
4. **F5** / **Shift+F5** → dry-run or scenarios — PASS/FAIL in Output
5. **Connect to Studio Web** → Open Folder → Import in [studio.uipath.com](https://studio.uipath.com)

Project Explorer shows **▶ Dry Run Scenarios**, **✎ Manage Scenarios**, and **☁ Connect to Studio Web** on every project.

## Studio Web connection

Use **Connect to Studio Web** (not only Export). It:

1. Builds a Portable \`*.StudioWeb\` folder (XAML + \`project.json\` + packages + Config)
2. Writes \`OPEN_IN_STUDIO_WEB.md\` checklist
3. Offers Open Folder / Open Studio Web / Open Checklist

Guide: command **Show Studio Web Guide** or \`docs/STUDIO_WEB.md\`.

## Scenarios (easiest dry-run)

- File: \`Data/Test/scenarios.json\`
- **Manage Scenarios** → add quick MaxTransactions smoke tests, duplicate, open file
- Last scenario is remembered for one-click re-run

## Also available

- Custom activities (project or user library)
- Import UiPath folder / \`.nupkg\`
- Sequence + Flowchart designer, container colors

## About UiPath Maestro

UiPath's official **Maestro** extension targets Maestro Flows (\`.flow\`).
LowCode Studio covers classic Studio / REFramework design on Mac.

> Not an official UiPath product.
`;
  void vscode.workspace
    .openTextDocument({ content: md, language: 'markdown' })
    .then((doc) => vscode.window.showTextDocument(doc, { preview: true }));
}
