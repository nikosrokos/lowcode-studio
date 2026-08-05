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
  dryRunWorkflowAsync,
  formatDryRunReport,
  toPseudocode,
  validateWorkflow
} from './commands/simulator';
import { getLowCodeOutput } from './util/outputChannel';
import { readDryRunSettings } from './util/dryRunSettings';
import { maybeShowWhatsNew, showWhatsNewCommand } from './util/whatsNew';
import { explainWorkflow } from './commands/assistExplain';
import {
  applyGeneratedScenarios,
  generateScenariosFromDescription
} from './commands/assistScenarios';
import {
  applySelectorRepairs,
  formatSelectorAssistReport,
  proposeSelectorRepairs,
  suggestSelectorsFromHtml
} from './commands/assistSelectors';
import {
  applyExpressionRepairs,
  formatExpressionAssistReport,
  proposeExpressionRepairs
} from './commands/assistExpressions';
import {
  applyScaffoldToWorkflow,
  formatScaffoldReport,
  scaffoldSequenceFromDescription
} from './commands/assistScaffold';
import {
  applyTraceRepairs,
  formatTraceRepairReport,
  proposeRepairsFromDryRunTrace
} from './commands/assistTraceRepair';
import { HomeViewProvider } from './providers/homeViewProvider';
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
  adoptStudioWebSolutionAsLcsProject,
  getStudioWebLocalLink,
  isStudioWebSolutionDir,
  SYNC_TRASH_DIR,
  trySyncFromStudioWebLocal,
  trySyncToStudioWebLocal,
  unlinkStudioWebLocalWorkspace,
  validateStudioWebLocalOpenability
} from './interop/studioWebLocal';
import {
  formatPackageValidationReport,
  validateProjectPackages
} from './interop/packageValidation';
import {
  loadPackageInventory,
  writeManifestPackagePins
} from './interop/packageManager';
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
import { ProjectTreeItem, HIDDEN_EXPLORER_PATHS_KEY } from './providers/projectTreeProvider';

let editorProvider: WorkflowEditorProvider;
let variablesProvider: VariablesTreeProvider;
let projectProvider: ProjectTreeProvider;
let activityProvider: ActivityTreeProvider;
let projectsTreeView: vscode.TreeView<ProjectTreeItem>;
let homeProviderRef: HomeViewProvider | undefined;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  variablesProvider = new VariablesTreeProvider();
  projectProvider = new ProjectTreeProvider(workspaceRoot);
  projectProvider.setHiddenPaths(
    context.workspaceState.get<string[]>(HIDDEN_EXPLORER_PATHS_KEY) || []
  );
  activityProvider = new ActivityTreeProvider();
  refreshCustomActivityOverlay();

  const homeProvider = new HomeViewProvider(
    context,
    () =>
      extensionContext.workspaceState.get<string>('lowcodeStudio.activeProjectDir') ||
      projectDirFromOpenDocument() ||
      undefined,
    async (command) => {
      const map: Record<string, string> = {
        openLocalProject: 'lowcodeStudio.openLocalProject',
        newREFramework: 'lowcodeStudio.newREFramework',
        newBlueprint: 'lowcodeStudio.newBlueprint',
        connectStudioWeb: 'lowcodeStudio.connectStudioWeb',
        openStudioWeb: 'lowcodeStudio.openStudioWeb',
        firstRunWizard: 'lowcodeStudio.firstRunWizard',
        scaffoldFromDescription: 'lowcodeStudio.scaffoldFromDescription',
        repairFromDryRunTrace: 'lowcodeStudio.repairFromDryRunTrace',
        showWhatsNew: 'lowcodeStudio.showWhatsNew',
        openHome: 'lowcodeStudio.openHome'
      };
      const id = map[command] || command;
      await vscode.commands.executeCommand(id);
      homeProvider.refresh();
    },
    async (projectPath) => {
      if (!projectPath || !fs.existsSync(projectPath)) {
        vscode.window.showWarningMessage('Recent project folder is missing.');
        homeProvider.refresh();
        return;
      }
      await setActiveProjectDir(projectPath);
      const opened = await ensureFolderInWorkspace(projectPath, path.basename(projectPath));
      if (opened === 'reloading') {
        return;
      }
      const main =
        readProjectMainWorkflow(projectPath) ||
        path.join(projectPath, 'Main.lcs.json');
      if (fs.existsSync(main)) {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          vscode.Uri.file(main),
          WorkflowEditorProvider.viewType
        );
      }
      homeProvider.refresh();
    }
  );
  homeProviderRef = homeProvider;
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(HomeViewProvider.viewType, homeProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  projectsTreeView = vscode.window.createTreeView('lowcodeStudio.projects', {
    treeDataProvider: projectProvider,
    showCollapseAll: true
  });
  const activitiesTreeView = vscode.window.createTreeView('lowcodeStudio.activities', {
    treeDataProvider: activityProvider
  });
  const variablesTreeView = vscode.window.createTreeView('lowcodeStudio.variables', {
    treeDataProvider: variablesProvider
  });

  // When the activity-bar container was hidden and any LCS view becomes visible,
  // focus Home so clicking the extension icon lands on the Home Screen.
  let lcsContainerVisible = false;
  let homeViewVisible = false;
  const preferHomeOnContainerShow = () =>
    vscode.workspace
      .getConfiguration('lowcodeStudio')
      .get<boolean>('openHomeOnStartup', true);
  const recomputeContainerHidden = () => {
    lcsContainerVisible =
      homeViewVisible ||
      projectsTreeView.visible ||
      activitiesTreeView.visible ||
      variablesTreeView.visible;
  };
  const onLcsViewVisibility = (visible: boolean) => {
    const wasHidden = !lcsContainerVisible;
    if (visible) {
      lcsContainerVisible = true;
      if (wasHidden && preferHomeOnContainerShow()) {
        void homeProvider.focusSidebar();
      } else {
        homeProvider.refresh();
      }
    } else {
      recomputeContainerHidden();
    }
  };
  homeProvider.setVisibilityListener((visible) => {
    homeViewVisible = visible;
    if (visible) {
      lcsContainerVisible = true;
      homeProvider.refresh();
    } else {
      recomputeContainerHidden();
    }
  });
  context.subscriptions.push(
    projectsTreeView,
    activitiesTreeView,
    variablesTreeView,
    projectsTreeView.onDidChangeVisibility((e) => onLcsViewVisibility(e.visible)),
    activitiesTreeView.onDidChangeVisibility((e) => onLcsViewVisibility(e.visible)),
    variablesTreeView.onDidChangeVisibility((e) => onLcsViewVisibility(e.visible)),
    projectsTreeView.onDidChangeSelection((e) => {
      const dir = projectDirFromTreeItem(e.selection[0]);
      if (dir) {
        void setActiveProjectDir(dir);
        homeProvider.refresh();
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

  // Finish a quiet open after workspace reload (no auto-open Main / dialog cascade)
  void consumePendingQuietOpen();

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(context.extensionPath, 'package.json'), 'utf8')
  ) as { version?: string };
  const packageVersion = packageJson.version || '0.0.0';
  void maybeShowWhatsNew(context, packageVersion);

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
      const projectDir =
        projectDirFromOpenDocument() ||
        (await resolveLcsProjectDirQuiet()) ||
        undefined;
      const drySettings = readDryRunSettings(
        vscode.workspace.getConfiguration('lowcodeStudio')
      );
      const result = await dryRunWorkflowAsync(doc, {
        projectDir,
        ...drySettings
      });
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
    vscode.commands.registerCommand('lowcodeStudio.explainWorkflow', () =>
      explainWorkflowCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.generateScenarios', () =>
      generateScenariosCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.suggestSelectors', () =>
      suggestSelectorsCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.repairExpressions', () =>
      repairExpressionsCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.scaffoldFromDescription', () =>
      scaffoldFromDescriptionCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.repairFromDryRunTrace', () =>
      repairFromDryRunTraceCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.openHome', () =>
      homeProvider.focusSidebar()
    ),
    vscode.commands.registerCommand('lowcodeStudio.openHomePanel', () =>
      homeProvider.showPanel()
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
    vscode.commands.registerCommand(
      'lowcodeStudio.pullStudioWebLocal',
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
        try {
          const pulled = trySyncFromStudioWebLocal(dir, { force: false });
          projectProvider.refresh();
          editorProvider?.refreshProjectTree?.();
          if (!pulled) {
            return;
          }
          const msg =
            pulled.updated.length === 0
              ? pulled.conflicts.length
                ? `No pull — ${pulled.conflicts.length} conflict(s) (both sides changed). Use Save to keep LCS, or force via trash review.`
                : 'Already in sync — nothing to pull from Studio Web Local.'
              : `Pulled ${pulled.updated.length} workflow(s) from Studio Web Local` +
                (pulled.created.length ? ` (${pulled.created.length} new)` : '') +
                (pulled.backups.length ? ` · backups in ${SYNC_TRASH_DIR}/` : '');
          void vscode.window.showInformationMessage(msg);
          if (pulled.conflicts.length) {
            void vscode.window.showWarningMessage(
              `Skipped ${pulled.conflicts.length} conflict(s) where both LCS and Studio Web changed. Save to push LCS (Studio Web copy → ${SYNC_TRASH_DIR}/).`
            );
          }
        } catch (err) {
          void vscode.window.showErrorMessage(
            err instanceof Error ? err.message : 'Pull from Studio Web Local failed'
          );
        }
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
      void homeProvider.focusSidebar();
    }),
    vscode.commands.registerCommand('lowcodeStudio.showWhatsNew', () => {
      void showWhatsNewCommand(context, packageVersion);
    }),
    vscode.commands.registerCommand('lowcodeStudio.managePackages', () =>
      managePackagesCommand()
    ),
    vscode.commands.registerCommand('lowcodeStudio.firstRunWizard', () =>
      firstRunWizardCommand()
    )
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
          // Designer Save path syncs after save with in-memory overrides
          if (editorProvider?.consumeSkipDidSaveSync?.(doc.uri.fsPath)) {
            return;
          }
          const projectRoot = findProjectRoot(path.dirname(doc.fileName));
          if (projectRoot && getStudioWebLocalLink(projectRoot)) {
            try {
              const rel = path.relative(projectRoot, doc.uri.fsPath).replace(/\\/g, '/');
              const overrides =
                rel.endsWith('.lcs.json') && !rel.startsWith('..')
                  ? { [rel]: doc.getText() }
                  : undefined;
              const synced = trySyncToStudioWebLocal(projectRoot, {
                contentOverrides: overrides,
                pullFirst: true
              });
              if (synced) {
                const pulled = synced.pulled?.length || 0;
                void vscode.window.setStatusBarMessage(
                  `Synced ↔ Studio Web Local (${path.basename(synced.link.solutionDir)})` +
                    (pulled ? ` · pulled ${pulled}` : ''),
                  4000
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

  const openHome = vscode.workspace
    .getConfiguration('lowcodeStudio')
    .get<boolean>('openHomeOnStartup', true);
  if (openHome) {
    void homeProvider.focusSidebar();
  }
  if (!context.globalState.get('lowcodeStudio.welcomeShown')) {
    void context.globalState.update('lowcodeStudio.welcomeShown', true);
    // First run: also open the full Home tab once for discoverability
    void homeProvider.showPanel();
  }
}

export function deactivate(): void {
  // no-op
}

const PENDING_OPEN_KEY = 'lowcodeStudio.pendingQuietOpen';

async function openLocalProjectCommand(): Promise<void> {
  const mode = await vscode.window.showQuickPick(
    [
      {
        id: 'folder',
        label: '$(folder-opened) Open folder',
        detail:
          'Pick an LCS project or a Studio Web .uipx solution — imports .lcs.json and opens Main'
      },
      {
        id: 'create',
        label: '$(cloud-upload) Create / link Studio Web Local Workspace',
        detail: 'From the active LCS project: create or link a .uipx solution'
      }
    ] as Array<vscode.QuickPickItem & { id: string }>,
    {
      title: 'LowCode Studio',
      placeHolder: 'Open a local project or Studio Web solution'
    }
  );
  if (!mode) {
    return;
  }

  if (mode.id === 'create') {
    await connectStudioWebCommand();
    return;
  }

  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Open',
    title: 'Select LowCode Studio project or Studio Web Local Workspace (.uipx)'
  });
  const folderUri = picked?.[0];
  if (!folderUri) {
    return;
  }

  // Studio Web solution → adopt (import .xaml → .lcs.json) + open Main
  if (isStudioWebSolutionDir(folderUri.fsPath)) {
    await openStudioWebSolutionFolder(folderUri.fsPath);
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

  await openLcsProjectAndMain(projectDir);
}

/** Open an LCS project in explorer and open its main .lcs.json in the designer. */
async function openLcsProjectAndMain(
  projectDir: string,
  options: { openMain?: boolean; mainAbs?: string } = {}
): Promise<void> {
  const openMain = options.openMain !== false;
  projectProvider.unhidePath(projectDir);
  const linked = getStudioWebLocalLink(projectDir);
  if (linked?.solutionDir) {
    projectProvider.unhidePath(linked.solutionDir);
  }
  await persistHiddenExplorerPaths();

  const folders = vscode.workspace.workspaceFolders || [];
  if (!folders.length) {
    await extensionContext.workspaceState.update(PENDING_OPEN_KEY, {
      kind: 'lcs',
      path: projectDir,
      openMain,
      mainAbs: options.mainAbs
    });
  }

  const opened = await ensureFolderInWorkspace(projectDir, path.basename(projectDir));
  if (opened === 'reloading') {
    return;
  }

  await setActiveProjectDir(projectDir);
  refreshCustomActivityOverlay();
  projectProvider.refresh();
  editorProvider?.refreshProjectTree?.();
  void vscode.window.setStatusBarMessage(
    `LowCode Studio: ${path.basename(projectDir)}`,
    4000
  );

  if (openMain) {
    await openMainWorkflowInDesigner(projectDir, options.mainAbs);
  }
}

/** Open Main (or preferred) .lcs.json with the LowCode Studio designer. */
async function openMainWorkflowInDesigner(
  projectDir: string,
  preferredAbs?: string
): Promise<void> {
  const mainAbs =
    (preferredAbs && fs.existsSync(preferredAbs) && preferredAbs) ||
    readProjectMainWorkflow(projectDir);
  if (!mainAbs) {
    return;
  }
  try {
    await vscode.commands.executeCommand(
      'vscode.openWith',
      vscode.Uri.file(mainAbs),
      WorkflowEditorProvider.viewType
    );
  } catch {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(mainAbs));
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
      // ignore
    }
  }
}

/**
 * Open a Studio Web .uipx solution: import .xaml → .lcs.json, link, open Main designer.
 */
async function openStudioWebSolutionFolder(solutionDir: string): Promise<void> {
  const activeLcs =
    extensionContext.workspaceState.get<string>('lowcodeStudio.activeProjectDir') ||
    (await resolveLcsProjectDirQuiet());

  try {
    const adopted = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Opening ${path.basename(solutionDir)}…`
      },
      async () => {
        const searchRoots = (vscode.workspace.workspaceFolders || []).map(
          (f) => f.uri.fsPath
        );
        // Prefer the active LCS only when it is already linked to this solution
        // (or has no workflows yet — safe to fill from Studio Web).
        let lcsProjectDir: string | undefined;
        if (activeLcs && isLcsProjectDir(activeLcs)) {
          const existing = getStudioWebLocalLink(activeLcs);
          const linkedHere =
            existing &&
            path.resolve(existing.solutionDir) === path.resolve(solutionDir);
          const emptyLcs = !readProjectMainWorkflow(activeLcs);
          if (linkedHere || emptyLcs) {
            lcsProjectDir = activeLcs;
          }
        }
        return adoptStudioWebSolutionAsLcsProject(solutionDir, {
          lcsProjectDir,
          searchRoots
        });
      }
    );

    projectProvider.unhidePath(adopted.solutionDir);
    await openLcsProjectAndMain(adopted.lcsProjectDir, {
      openMain: true,
      mainAbs: adopted.mainWorkflowAbs
    });
    void vscode.window.setStatusBarMessage(
      `Opened ${path.basename(solutionDir)} → ${adopted.workflows.length} workflow(s)`,
      5000
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Failed to open Studio Web solution'
    );
  }
}

/** After a workspace reload, finish pending open (including Main designer). */
async function consumePendingQuietOpen(): Promise<void> {
  const pending = extensionContext.workspaceState.get<{
    kind?: string;
    path?: string;
    openMain?: boolean;
    mainAbs?: string;
  }>(PENDING_OPEN_KEY);
  if (!pending?.path) {
    return;
  }
  await extensionContext.workspaceState.update(PENDING_OPEN_KEY, undefined);
  if (pending.kind === 'lcs' && isLcsProjectDir(pending.path)) {
    await setActiveProjectDir(pending.path);
    refreshCustomActivityOverlay();
    projectProvider.unhidePath(pending.path);
    const linked = getStudioWebLocalLink(pending.path);
    if (linked?.solutionDir) {
      projectProvider.unhidePath(linked.solutionDir);
    }
    await persistHiddenExplorerPaths();
    projectProvider.refresh();
    editorProvider?.refreshProjectTree?.();
    if (pending.openMain !== false) {
      await openMainWorkflowInDesigner(pending.path, pending.mainAbs);
    }
    void vscode.window.setStatusBarMessage(
      `LowCode Studio: ${path.basename(pending.path)}`,
      4000
    );
    return;
  }
  // Legacy pending solution open — adopt now
  if (pending.kind === 'solution' && isStudioWebSolutionDir(pending.path)) {
    await openStudioWebSolutionFolder(pending.path);
    return;
  }
  projectProvider.unhidePath(pending.path);
  await persistHiddenExplorerPaths();
  projectProvider.refresh();
  editorProvider?.refreshProjectTree?.();
}

async function persistHiddenExplorerPaths(): Promise<void> {
  await extensionContext.workspaceState.update(
    HIDDEN_EXPLORER_PATHS_KEY,
    projectProvider.getHiddenPaths()
  );
}

/** Resolve LCS project without prompting the user to open anything. */
async function resolveLcsProjectDirQuiet(): Promise<string | undefined> {
  const fromDoc = projectDirFromOpenDocument();
  if (fromDoc && isLcsProjectDir(fromDoc)) {
    return fromDoc;
  }
  const remembered = extensionContext.workspaceState.get<string>(
    'lowcodeStudio.activeProjectDir'
  );
  if (remembered && isLcsProjectDir(remembered)) {
    return remembered;
  }
  const roots = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
  const all = findAllLcsProjects(roots);
  return all.length === 1 ? all[0] : undefined;
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
    const todo = buildWindowsTodoChecklist(projectDir);
    writeWindowsTodoFile(projectDir, todo);
    const report = [
      formatPackageValidationReport(result),
      '',
      formatWindowsTodoReport(todo)
    ].join('\n');
    const channel = getOutput();
    channel.clear();
    channel.appendLine(report);
    channel.show(true);

    const warnCount = result.warnings.filter((w) => w.severity === 'warning').length;
    const infoCount = result.warnings.filter((w) => w.severity === 'info').length;
    if (!result.warnings.length || todo.readyForWindows) {
      void vscode.window.showInformationMessage(
        todo.readyForWindows
          ? `Packages OK — Windows TODO clean · ${Object.keys(result.dependencies).length} NuGet deps.`
          : `Packages: ${warnCount} warning(s). See Output + WINDOWS_TODO.md.`
      );
      return;
    }
    const open = await vscode.window.showWarningMessage(
      `Package validation: ${warnCount} warning(s), ${infoCount} info · ${todo.summary}`,
      'Manage Packages',
      'Open Output',
      'Open WINDOWS_TODO'
    );
    if (open === 'Manage Packages') {
      await managePackagesCommand(projectDir);
    } else if (open === 'Open Output') {
      channel.show(true);
    } else if (open === 'Open WINDOWS_TODO') {
      const todoUri = vscode.Uri.file(path.join(projectDir, 'WINDOWS_TODO.md'));
      await vscode.window.showTextDocument(todoUri, { preview: true });
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Package validation failed'
    );
  }
}

async function managePackagesCommand(forcedProjectDir?: string): Promise<void> {
  const projectDir = forcedProjectDir || (await resolveLcsProjectDir());
  if (!projectDir) {
    return;
  }
  try {
    let inventory = loadPackageInventory(projectDir);
    const channel = getOutput();
    const printInventory = () => {
      channel.appendLine('');
      channel.appendLine(`Packages — ${inventory.projectName}`);
      channel.appendLine('─'.repeat(48));
      for (const pin of inventory.pins) {
        const flag = pin.isDefaultPin ? ' ⚠ [1.0.0]' : '';
        const src = pin.source === 'manifest' ? 'manifest' : 'resolved';
        channel.appendLine(`  ${pin.name}: ${pin.version}${flag} (${src})`);
      }
      if (inventory.defaultPinCount) {
        channel.appendLine('');
        channel.appendLine(
          `${inventory.defaultPinCount} placeholder [1.0.0] pin(s) — set Studio Web–compatible versions.`
        );
      }
    };
    printInventory();
    channel.show(true);

    for (;;) {
      const picks: Array<vscode.QuickPickItem & { id: string; pkg?: string }> = [
        {
          id: 'fix-defaults',
          label: '$(sparkle) Apply catalog defaults for [1.0.0] pins',
          description:
            inventory.defaultPinCount > 0
              ? `${inventory.defaultPinCount} pin(s)`
              : 'none to fix'
        },
        {
          id: 'add',
          label: '$(add) Add / override package pin',
          description: 'Write into project.json → uipathDependencies'
        },
        {
          id: 'refresh',
          label: '$(refresh) Refresh list',
          description: 'Re-read project.json'
        },
        {
          id: 'done',
          label: '$(check) Done',
          description: 'Close package UI'
        },
        ...inventory.pins.map((p) => ({
          id: 'edit',
          pkg: p.name,
          label: `${p.isDefaultPin ? '$(warning) ' : ''}${p.name}`,
          description: p.version,
          detail: p.hasCatalogDefault
            ? `Catalog default ${p.catalogDefault} · ${p.source}`
            : `No catalog default · ${p.source}`
        }))
      ];
      const picked = await vscode.window.showQuickPick(picks, {
        title: `Manage Packages — ${inventory.projectName}`,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Edit NuGet pins used on Connect / Export'
      });
      if (!picked || picked.id === 'done') {
        break;
      }
      if (picked.id === 'refresh') {
        inventory = loadPackageInventory(projectDir);
        printInventory();
        continue;
      }
      if (picked.id === 'fix-defaults') {
        const pins = { ...inventory.manifestPins };
        const changed: string[] = [];
        for (const pin of inventory.pins) {
          if (!pin.isDefaultPin || !pin.catalogDefault) {
            continue;
          }
          pins[pin.name] = pin.catalogDefault;
          changed.push(pin.name);
        }
        if (!changed.length) {
          void vscode.window.showInformationMessage(
            'No [1.0.0] pins have a catalog default. Edit custom packages manually.'
          );
          continue;
        }
        writeManifestPackagePins(projectDir, pins);
        inventory = loadPackageInventory(projectDir);
        printInventory();
        void vscode.window.showInformationMessage(
          `Updated ${changed.length} package pin(s) from catalog defaults.`
        );
        continue;
      }
      if (picked.id === 'add') {
        const name = await vscode.window.showInputBox({
          prompt: 'NuGet package id',
          placeHolder: 'UiPath.System.Activities'
        });
        if (!name?.trim()) {
          continue;
        }
        const ver = await vscode.window.showInputBox({
          prompt: `Version for ${name.trim()}`,
          value: inventory.resolved[name.trim()] || '[25.4.1]',
          placeHolder: '[25.4.1]'
        });
        if (!ver?.trim()) {
          continue;
        }
        const next = {
          ...inventory.manifestPins,
          [name.trim()]: ver.trim()
        };
        writeManifestPackagePins(projectDir, next);
        inventory = loadPackageInventory(projectDir);
        printInventory();
        continue;
      }
      if (picked.id === 'edit' && picked.pkg) {
        const current = inventory.pins.find((p) => p.name === picked.pkg);
        const ver = await vscode.window.showInputBox({
          prompt: `Version for ${picked.pkg}`,
          value: current?.version || '[1.0.0]',
          placeHolder: current?.catalogDefault || '[25.4.1]',
          validateInput: (v) => (String(v || '').trim() ? undefined : 'Version required')
        });
        if (!ver?.trim()) {
          continue;
        }
        const next = {
          ...inventory.manifestPins,
          [picked.pkg]: ver.trim()
        };
        writeManifestPackagePins(projectDir, next);
        inventory = loadPackageInventory(projectDir);
        printInventory();
      }
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      err instanceof Error ? err.message : 'Manage Packages failed'
    );
  }
}

async function firstRunWizardCommand(): Promise<void> {
  const step = (extensionContext.globalState.get<number>('lowcodeStudio.firstRunStep') || 0) as number;
  const steps = [
    {
      id: 'ref',
      label: '$(new-folder) 1 · Create REFramework project',
      detail: 'Scaffold Main + Framework + Config + scenarios.json',
      command: 'lowcodeStudio.newREFramework'
    },
    {
      id: 'scenario',
      label: '$(play) 2 · Run a dry-run scenario',
      detail: 'Shift+F5 — prove the Mac loop before Studio Web',
      command: 'lowcodeStudio.dryRunScenario'
    },
    {
      id: 'connect',
      label: '$(cloud-upload) 3 · Connect Local Workspace',
      detail: 'Link a Studio Web folder and sync .xaml on Save',
      command: 'lowcodeStudio.connectStudioWeb'
    },
    {
      id: 'guide',
      label: '$(book) Read Getting Started',
      detail: 'Markdown overview (optional)',
      command: 'lowcodeStudio.showGettingStarted'
    }
  ];

  const picked = await vscode.window.showQuickPick(
    steps.map((s, i) => ({
      ...s,
      description: i < step ? 'done' : i === step ? 'next' : ''
    })),
    {
      title: 'LowCode Studio — First-run wizard',
      placeHolder: 'REF → Scenario → Connect (pick a step)'
    }
  );
  if (!picked) {
    return;
  }
  const index = steps.findIndex((s) => s.id === picked.id);
  await vscode.commands.executeCommand(picked.command);
  if (index >= 0 && index < 3) {
    const next = Math.max(step, index + 1);
    await extensionContext.globalState.update('lowcodeStudio.firstRunStep', next);
    if (next >= 3) {
      void vscode.window.showInformationMessage(
        'First-run loop complete — design in LCS, Save to sync, publish in Studio Web.'
      );
    } else {
      const cont = await vscode.window.showInformationMessage(
        `Step ${index + 1} started. Continue the wizard?`,
        'Next step',
        'Later'
      );
      if (cont === 'Next step') {
        await firstRunWizardCommand();
      }
    }
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

  // Prefer an existing workspace root; otherwise ask where to place the import
  let destRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!destRoot) {
    if (isStudioWebSolutionDir(sourceUri.fsPath)) {
      await openStudioWebSolutionFolder(sourceUri.fsPath);
      return;
    }
    const dest = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Import into this folder',
      title: 'Choose a destination folder for the imported LowCode Studio project'
    });
    if (!dest?.[0]) {
      return;
    }
    destRoot = dest[0].fsPath;
  }

  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing UiPath project…'
      },
      async () => importUiPathProjectFolder(sourceUri!.fsPath, destRoot!)
    );

    const opened = await ensureFolderInWorkspace(
      result.targetDir,
      path.basename(result.targetDir)
    );
    if (opened === 'reloading') {
      return;
    }

    await setActiveProjectDir(result.targetDir);
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

  let destRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!destRoot) {
    const dest = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Import into this folder',
      title: 'Choose a destination folder for the imported LowCode Studio project'
    });
    if (!dest?.[0]) {
      return;
    }
    destRoot = dest[0].fsPath;
  }

  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing UiPath package…'
      },
      async () => importUiPathNupkg(picked[0].fsPath, destRoot!)
    );
    const opened = await ensureFolderInWorkspace(
      result.targetDir,
      path.basename(result.targetDir)
    );
    if (opened === 'reloading') {
      return;
    }
    await setActiveProjectDir(result.targetDir);
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
  homeProviderRef?.rememberProject(projectDir);
  homeProviderRef?.refresh();
}

/**
 * Ensure a folder is visible in the VS Code / Cursor workspace (Project Explorer).
 * Returns `reloading` when the window will reload (caller should stop).
 */
async function ensureFolderInWorkspace(
  folderPath: string,
  name?: string
): Promise<'ok' | 'reloading' | 'skipped'> {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return 'skipped';
  }
  const resolved = path.resolve(folderPath);
  const folders = vscode.workspace.workspaceFolders || [];
  const already = folders.some(
    (f) =>
      path.resolve(f.uri.fsPath) === resolved ||
      resolved.startsWith(path.resolve(f.uri.fsPath) + path.sep)
  );
  if (already) {
    return 'ok';
  }

  // Prefer adding without openFolder (avoids full window reload when possible)
  if (!folders.length) {
    const addedFirst = vscode.workspace.updateWorkspaceFolders(0, null, {
      uri: vscode.Uri.file(resolved),
      name: name || path.basename(resolved)
    });
    if (addedFirst) {
      return 'ok';
    }
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(resolved), false);
    return 'reloading';
  }

  const added = vscode.workspace.updateWorkspaceFolders(folders.length, 0, {
    uri: vscode.Uri.file(resolved),
    name: name || path.basename(resolved)
  });
  if (added) {
    return 'ok';
  }

  // Multi-root unavailable — write a .code-workspace and reopen
  try {
    const wsDir = path.dirname(resolved);
    const wsName = `${path.basename(resolved)}.code-workspace`;
    const wsPath = path.join(wsDir, wsName);
    const entries = [
      ...folders.map((f) => ({
        path: f.uri.fsPath,
        name: f.name
      })),
      { path: resolved, name: name || path.basename(resolved) }
    ];
    const payload = {
      folders: entries.map((e) => ({
        path: e.path,
        ...(e.name ? { name: e.name } : {})
      }))
    };
    fs.writeFileSync(wsPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(wsPath), false);
    return 'reloading';
  } catch {
    void vscode.window.showWarningMessage(
      `Could not add "${path.basename(resolved)}" to the workspace. Use File → Add Folder to Workspace.`
    );
    return 'skipped';
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
    (targetPath &&
    getStudioWebLocalLink((await resolveLcsProjectDirQuiet()) || '')?.solutionDir ===
      targetPath
      ? 'solution'
      : 'project');

  if (!targetPath) {
    void vscode.window.showWarningMessage('Nothing selected to remove.');
    return;
  }

  const label = path.basename(targetPath);
  if (kind === 'solution' || kind === 'workspace') {
    const ok = await vscode.window.showWarningMessage(
      `Remove Studio Web solution "${label}" from explorer? Files on disk are kept.`,
      { modal: true },
      'Remove'
    );
    if (ok !== 'Remove') {
      return;
    }
    // Unlink from any LCS project that points here
    const roots = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
    for (const projectDir of findAllLcsProjects(roots)) {
      const link = getStudioWebLocalLink(projectDir);
      if (link && path.resolve(link.solutionDir) === path.resolve(targetPath)) {
        unlinkStudioWebLocalWorkspace(projectDir);
      }
    }
    const remembered = extensionContext.workspaceState.get<string>(
      'lowcodeStudio.activeProjectDir'
    );
    if (remembered) {
      const link = getStudioWebLocalLink(remembered);
      if (link && path.resolve(link.solutionDir) === path.resolve(targetPath)) {
        unlinkStudioWebLocalWorkspace(remembered);
      }
    }
  } else {
    const ok = await vscode.window.showWarningMessage(
      `Remove "${label}" from the explorer? Files on disk are kept.`,
      { modal: true },
      'Remove'
    );
    if (ok !== 'Remove') {
      return;
    }
    if (
      extensionContext.workspaceState.get<string>('lowcodeStudio.activeProjectDir') ===
      targetPath
    ) {
      await extensionContext.workspaceState.update(
        'lowcodeStudio.activeProjectDir',
        undefined
      );
      projectProvider?.setActiveProject(undefined);
    }
  }

  // Soft-hide so it stays gone even if multi-root remove fails
  projectProvider.hidePath(targetPath);
  await persistHiddenExplorerPaths();

  // Drop exact matching multi-root workspace folder only (never the parent of a nested path)
  const folders = vscode.workspace.workspaceFolders || [];
  const idx = folders.findIndex(
    (f) => path.resolve(f.uri.fsPath) === path.resolve(targetPath)
  );
  if (idx >= 0) {
    const removed = vscode.workspace.updateWorkspaceFolders(idx, 1);
    if (!removed && folders.length === 1) {
      void vscode.window.showInformationMessage(
        `Hidden "${label}" in LowCode Studio explorer. Use File → Close Folder to clear the VS Code workspace.`
      );
    }
  }

  projectProvider.refresh();
  editorProvider?.refreshProjectTree?.();
  void vscode.window.showInformationMessage(`Removed ${label} from explorer.`);
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
        label: `$(sync) Sync linked Local Workspace`,
        description: path.basename(existing.solutionDir),
        detail: `${existing.solutionDir} — then open Main.lcs.json`
      });
    }
    choices.push(
      {
        id: 'open',
        label: '$(folder-opened) Open existing Studio Web solution',
        detail: 'Import .xaml → .lcs.json, link, open Main designer'
      },
      {
        id: 'create',
        label: '$(new-folder) Create new Studio Web Local Workspace',
        detail: 'Write a .uipx solution folder next to this project'
      },
      {
        id: 'legacy',
        label: '$(file-zip) Legacy: export .uip once',
        detail: 'One-off Import project handoff (no sync-on-save)'
      }
    );

    const picked = await vscode.window.showQuickPick(choices, {
      title: `Studio Web — ${path.basename(projectDir)}`,
      placeHolder: 'Open or create a Local Workspace solution'
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
      const channel = getOutput();
      channel.appendLine('');
      channel.appendLine(formatWindowsTodoReport(todo));
      if (!todo.readyForWindows) {
        channel.show(true);
      }
    } catch {
      // ignore
    }

    const solutionDir = result.local?.link.solutionDir || result.targetDir;
    // Show under the LCS project in Project Explorer (do not add a second workspace root)
    projectProvider.unhidePath(solutionDir);
    await persistHiddenExplorerPaths();
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

    if (!openability.ok) {
      channel.show(true);
      void vscode.window.showWarningMessage(
        `Linked, but open checks failed: ${openability.errors[0]} — see LowCode Studio output.`
      );
      return;
    }

    void vscode.window.setStatusBarMessage(
      `Linked → ${path.basename(solutionDir)}. Save syncs .xaml`,
      5000
    );
    await openMainWorkflowInDesigner(projectDir);
    const next = await vscode.window.showInformationMessage(
      `Linked Local Workspace → ${path.basename(solutionDir)}`,
      'Open Studio Web',
      'Reveal Solution'
    );
    if (next === 'Reveal Solution') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(solutionDir));
    }
    if (next === 'Open Studio Web') {
      await vscode.env.openExternal(vscode.Uri.parse(STUDIO_WEB_URL));
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
        label: '$(sparkle) Generate from description…',
        description: 'Assist F1 — keyword templates → scenarios.json',
        value: 'generate'
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
  if (action.value === 'generate') {
    await generateScenariosCommand(projectDir);
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

async function scaffoldFromDescriptionCommand(): Promise<void> {
  const doc = await getActiveWorkflowDocument();
  if (!doc) {
    return;
  }
  const description = await vscode.window.showInputBox({
    title: 'Assist F2 — Scaffold sequence',
    prompt: 'Describe steps (newlines, “then”, or “;”). Keywords map to catalog activities.',
    placeHolder: 'use browser https://example.com then type into then click then log message "done"',
    ignoreFocusOut: true
  });
  if (description === undefined) {
    return;
  }
  const proposal = scaffoldSequenceFromDescription(description);
  const channel = getOutput();
  channel.clear();
  channel.appendLine(formatScaffoldReport(proposal));
  channel.show(true);

  const mode = await vscode.window.showQuickPick(
    [
      {
        label: `$(add) Append ${proposal.activities.length} activity(ies)`,
        value: 'append' as const
      },
      {
        label: '$(replace) Replace entire sequence',
        value: 'replace' as const
      },
      { label: '$(book) Report only', value: 'none' as const }
    ],
    { placeHolder: 'Assist F2 — apply scaffold?' }
  );
  if (!mode || mode.value === 'none') {
    return;
  }
  const next = applyScaffoldToWorkflow(doc, proposal, mode.value);
  const applied = await editorProvider.applyWorkflowDocument(next);
  if (!applied) {
    vscode.window.showWarningMessage(
      'Open the workflow in the LowCode Studio designer to apply the scaffold.'
    );
    return;
  }
  vscode.window.showInformationMessage(
    `Assist F2: ${mode.value === 'replace' ? 'replaced with' : 'appended'} ${proposal.activities.length} activity(ies).`
  );
}

async function repairFromDryRunTraceCommand(): Promise<void> {
  const doc = await getActiveWorkflowDocument();
  if (!doc) {
    return;
  }
  const projectDir =
    projectDirFromOpenDocument() || (await resolveLcsProjectDirQuiet()) || undefined;
  const dryCfg = readDryRunSettings(
    vscode.workspace.getConfiguration('lowcodeStudio')
  );
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Assist F2 — dry-run for trace repair…'
    },
    async () =>
      dryRunWorkflowAsync(doc, {
        projectDir,
        realHttp: dryCfg.realHttp,
        httpAllowHosts: dryCfg.httpAllowHosts,
        httpTimeoutMs: dryCfg.httpTimeoutMs,
        realPython: dryCfg.realPython,
        pythonTimeoutMs: dryCfg.pythonTimeoutMs
      })
  );
  const repairs = proposeRepairsFromDryRunTrace(doc, result);
  const channel = getOutput();
  channel.clear();
  channel.appendLine(formatDryRunReport(result));
  channel.appendLine('');
  channel.appendLine(formatTraceRepairReport(repairs, result));
  channel.show(true);

  if (!repairs.length) {
    vscode.window.showInformationMessage(
      result.ok
        ? 'Assist F2: dry-run OK — no trace repairs needed.'
        : 'Assist F2: dry-run had issues but no automatic repairs were proposed — see Output.'
    );
    return;
  }

  const pick = await vscode.window.showQuickPick(
    [
      {
        label: `$(check) Apply all ${repairs.length} repair(s)`,
        value: 'all' as const
      },
      {
        label: '$(list-selection) Pick which to apply…',
        value: 'pick' as const
      },
      { label: '$(book) Report only', value: 'none' as const }
    ],
    { placeHolder: `Assist F2 — ${repairs.length} dry-run trace repair(s)` }
  );
  if (!pick || pick.value === 'none') {
    return;
  }
  let toApply = repairs;
  if (pick.value === 'pick') {
    const chosen = await vscode.window.showQuickPick(
      repairs.map((r) => ({
        label: `${r.displayName} · ${r.kind}`,
        description: r.property || r.type,
        detail: r.reason,
        repair: r
      })),
      { canPickMany: true, placeHolder: 'Select trace repairs to apply' }
    );
    if (!chosen?.length) {
      return;
    }
    toApply = chosen.map((c) => c.repair);
  }
  const next = applyTraceRepairs(doc, toApply);
  const applied = await editorProvider.applyWorkflowDocument(next);
  if (!applied) {
    vscode.window.showWarningMessage(
      'Open the workflow in the LowCode Studio designer to apply repairs.'
    );
    return;
  }
  vscode.window.showInformationMessage(
    `Assist F2: applied ${toApply.length} dry-run trace repair(s).`
  );
}

async function explainWorkflowCommand(): Promise<void> {
  const doc = await getActiveWorkflowDocument();
  if (!doc) {
    return;
  }
  const projectDir =
    projectDirFromOpenDocument() || (await resolveLcsProjectDirQuiet()) || undefined;
  let workflowRel: string | undefined;
  const active = vscode.window.activeTextEditor?.document;
  if (projectDir && active?.fileName.endsWith('.lcs.json')) {
    workflowRel = path.relative(projectDir, active.fileName).replace(/\\/g, '/');
  }
  const report = explainWorkflow(doc, { projectDir, workflowRel });
  const channel = getOutput();
  channel.clear();
  channel.appendLine(report.markdown);
  channel.show(true);
  vscode.window.showInformationMessage(
    report.critiqueCount
      ? `Explain: ${report.critiqueCount} critique item(s) — see Output`
      : 'Explain: no local critique items — see Output'
  );
}

async function repairExpressionsCommand(): Promise<void> {
  const doc = await getActiveWorkflowDocument();
  if (!doc) {
    return;
  }
  const proposals = proposeExpressionRepairs(doc);
  const channel = getOutput();
  channel.clear();
  channel.appendLine(formatExpressionAssistReport(proposals));
  channel.show(true);

  if (!proposals.length) {
    vscode.window.showInformationMessage(
      'Assist F4: no VB expression typos / function wrappers found.'
    );
    return;
  }

  const pick = await vscode.window.showQuickPick(
    [
      {
        label: `$(check) Apply all ${proposals.length} repair(s)`,
        value: 'all' as const
      },
      {
        label: '$(list-selection) Pick which to apply…',
        value: 'pick' as const
      },
      {
        label: '$(book) Report only (no changes)',
        value: 'none' as const
      }
    ],
    {
      placeHolder: `Assist F4 — ${proposals.length} UiPath VB expression repair(s)`
    }
  );
  if (!pick || pick.value === 'none') {
    return;
  }

  let toApply = proposals;
  if (pick.value === 'pick') {
    const chosen = await vscode.window.showQuickPick(
      proposals.map((p) => ({
        label: `${p.displayName} · ${p.propertyLabel}`,
        description: p.fixes.map((f) => f.label).join('; '),
        detail: `${oneLineExpr(p.original)} → ${oneLineExpr(p.proposed)}`,
        proposal: p
      })),
      { canPickMany: true, placeHolder: 'Select expression repairs to apply' }
    );
    if (!chosen?.length) {
      return;
    }
    toApply = chosen.map((c) => c.proposal);
  }

  const next = applyExpressionRepairs(doc, toApply);
  const applied = await editorProvider.applyWorkflowDocument(next);
  if (!applied) {
    const active = vscode.window.activeTextEditor?.document;
    if (active?.fileName.endsWith('.lcs.json')) {
      const edit = new vscode.WorkspaceEdit();
      const full = new vscode.Range(
        active.positionAt(0),
        active.positionAt(active.getText().length)
      );
      edit.replace(active.uri, full, stringifyWorkflow(next));
      await vscode.workspace.applyEdit(edit);
    } else {
      vscode.window.showWarningMessage(
        'Open the workflow in the LowCode Studio designer to apply repairs.'
      );
      return;
    }
  }
  vscode.window.showInformationMessage(
    `Assist F4: applied ${toApply.length} VB expression repair(s). Spot-check in Studio Web.`
  );
}

function oneLineExpr(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function suggestSelectorsCommand(): Promise<void> {
  const mode = await vscode.window.showQuickPick(
    [
      {
        label: '$(code) From HTML / Explorer paste',
        description: 'Paste HTML snippet, #id, or UI Explorer dump → classic selector',
        value: 'html' as const
      },
      {
        label: '$(tools) Repair weak selectors in workflow',
        description: 'Propose fixes for empty / placeholder / weak UI steps (confirm to apply)',
        value: 'repair' as const
      }
    ],
    { placeHolder: 'Assist F3 — suggest / repair selectors' }
  );
  if (!mode) {
    return;
  }

  const channel = getOutput();

  if (mode.value === 'html') {
    const paste = await vscode.window.showInputBox({
      prompt: 'Paste HTML element, #id, or UI Explorer selector dump',
      placeHolder: '<button id="login" aria-label="Sign in">Sign in</button>',
      ignoreFocusOut: true
    });
    if (paste == null) {
      return;
    }
    const suggestions = suggestSelectorsFromHtml(paste);
    const report = formatSelectorAssistReport('Assist F3 — selectors from paste', suggestions, []);
    channel.clear();
    channel.appendLine(report);
    channel.show(true);
    if (!suggestions.length) {
      vscode.window.showWarningMessage('Assist F3: could not build a selector from that paste.');
      return;
    }
    const best = suggestions[0];
    const action = await vscode.window.showInformationMessage(
      `Best: ${best.quality.label} (score ${best.quality.score}) — ${best.rationale}`,
      'Copy selector',
      'Dismiss'
    );
    if (action === 'Copy selector') {
      await vscode.env.clipboard.writeText(best.selector);
      vscode.window.showInformationMessage('Selector copied — paste into Selector Builder.');
    }
    return;
  }

  const doc = await getActiveWorkflowDocument();
  if (!doc) {
    return;
  }
  const repairs = proposeSelectorRepairs(doc);
  const report = formatSelectorAssistReport('Assist F3 — selector repairs', [], repairs);
  channel.clear();
  channel.appendLine(report);
  channel.show(true);

  const actionable = repairs.filter((r) => r.actionable);
  if (!repairs.length) {
    vscode.window.showInformationMessage('Assist F3: no empty/placeholder/weak UI selectors found.');
    return;
  }
  if (!actionable.length) {
    vscode.window.showInformationMessage(
      `Assist F3: ${repairs.length} weak selector(s) noted — see Output (nothing safer to auto-propose).`
    );
    return;
  }

  const pick = await vscode.window.showQuickPick(
    [
      {
        label: `$(check) Apply all ${actionable.length} proposal(s)`,
        value: 'all' as const
      },
      {
        label: '$(list-selection) Pick which to apply…',
        value: 'pick' as const
      },
      {
        label: '$(book) Report only (no changes)',
        value: 'none' as const
      }
    ],
    { placeHolder: `${actionable.length} actionable selector repair(s)` }
  );
  if (!pick || pick.value === 'none') {
    return;
  }

  let toApply = actionable;
  if (pick.value === 'pick') {
    const chosen = await vscode.window.showQuickPick(
      actionable.map((r) => ({
        label: r.displayName,
        description: `${r.currentQuality.label} → ${r.proposedQuality.label}`,
        detail: r.rationale,
        proposal: r
      })),
      { canPickMany: true, placeHolder: 'Select repairs to apply' }
    );
    if (!chosen?.length) {
      return;
    }
    toApply = chosen.map((c) => c.proposal);
  }

  const next = applySelectorRepairs(doc, toApply);
  const applied = await editorProvider.applyWorkflowDocument(next);
  if (!applied) {
    // Designer not active — write active text editor if it is the workflow
    const active = vscode.window.activeTextEditor?.document;
    if (active?.fileName.endsWith('.lcs.json')) {
      const edit = new vscode.WorkspaceEdit();
      const full = new vscode.Range(
        active.positionAt(0),
        active.positionAt(active.getText().length)
      );
      edit.replace(active.uri, full, stringifyWorkflow(next));
      await vscode.workspace.applyEdit(edit);
    } else {
      vscode.window.showWarningMessage(
        'Open the workflow in the LowCode Studio designer to apply repairs.'
      );
      return;
    }
  }
  vscode.window.showInformationMessage(
    `Assist F3: applied ${toApply.length} selector repair(s). Verify on Windows.`
  );
}

async function generateScenariosCommand(projectDirArg?: string): Promise<void> {
  const projectDir = projectDirArg || (await resolveLcsProjectDir());
  if (!projectDir) {
    return;
  }
  const description = await vscode.window.showInputBox({
    prompt: 'Describe the process (queue, HTTP, login, Excel, fail…)',
    placeHolder: 'e.g. REFramework queue with HTTP API and login UI',
    ignoreFocusOut: true
  });
  if (description == null) {
    return;
  }
  const projectName = path.basename(projectDir);
  const generated = generateScenariosFromDescription(description, projectName);
  const file = ensureScenariosFile(projectDir, projectName);
  const next = applyGeneratedScenarios(file, generated);
  saveScenariosFile(projectDir, next);
  projectProvider.refresh();
  const channel = getOutput();
  channel.clear();
  channel.appendLine(`Assist F1 — generated ${generated.length} scenario(s) for ${projectName}`);
  for (const s of generated) {
    channel.appendLine(`- ${s.name}: ${s.description || ''}`);
  }
  channel.show(true);
  const runNow = await vscode.window.showInformationMessage(
    `Generated ${generated.length} scenario(s) into Data/Test/scenarios.json`,
    'Run all',
    'Open file'
  );
  if (runNow === 'Run all') {
    await showScenarioResults(runAllScenarios(projectDir));
  }
  if (runNow === 'Open file') {
    const doc = await vscode.workspace.openTextDocument(scenariosFilePath(projectDir));
    await vscode.window.showTextDocument(doc);
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
  return getLowCodeOutput();
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
