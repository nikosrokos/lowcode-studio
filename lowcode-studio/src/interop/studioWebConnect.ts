import * as fs from 'fs';
import * as path from 'path';
import { exportToStudioWebProject, ExportedStudioWebProject } from './studioProject';
import { packageStudioWebArchives, PackagedStudioArchives } from './studioPackage';
import {
  getStudioWebLocalLink,
  linkStudioWebLocalWorkspace,
  studioWebLocalGuideMarkdown,
  STUDIO_WEB_LOCAL_URL,
  syncToStudioWebLocal,
  StudioWebLocalSyncResult
} from './studioWebLocal';

export const STUDIO_WEB_URL = STUDIO_WEB_LOCAL_URL;

export interface StudioWebConnectResult extends ExportedStudioWebProject {
  guidePath: string;
  checklist: string[];
  archives?: PackagedStudioArchives;
  local?: StudioWebLocalSyncResult;
  mode: 'local-workspace' | 'uip-package';
}

export type LinkLocalMode = 'create' | 'open' | 'sync';

/**
 * Preferred path: open/create a Studio Web Local Workspace solution and sync into it.
 * Optional legacy path still packages `.uip` when `legacyUip` is true.
 */
export function connectToStudioWeb(
  lcsProjectDir: string,
  options?: {
    destinationParent?: string;
    legacyUip?: boolean;
    local?: {
      mode: 'create' | 'open';
      targetDir: string;
      solutionName?: string;
    };
  }
): StudioWebConnectResult {
  if (options?.legacyUip) {
    return connectLegacyUip(lcsProjectDir, options.destinationParent);
  }

  const existing = getStudioWebLocalLink(lcsProjectDir);
  let local: StudioWebLocalSyncResult;
  if (options?.local) {
    local = linkStudioWebLocalWorkspace(lcsProjectDir, options.local);
  } else if (existing) {
    local = syncToStudioWebLocal(lcsProjectDir);
  } else {
    throw new Error(
      'No Studio Web Local Workspace linked. Choose Create or Open when connecting.'
    );
  }

  const guidePath = path.join(local.link.solutionDir, 'OPEN_IN_STUDIO_WEB_LOCAL.md');
  const checklist = [
    'Open Studio Web → Local Workspace',
    `Open solution folder: ${local.link.solutionDir}`,
    'Allow the browser to edit files when prompted',
    'Save workflows in LowCode Studio — they sync into this folder automatically',
    'Publish from Studio Web when ready'
  ];

  return {
    targetDir: local.targetDir,
    mainXaml: local.mainXaml,
    files: local.files,
    dependencies: local.dependencies,
    guidePath,
    checklist,
    local,
    mode: 'local-workspace'
  };
}

function connectLegacyUip(
  lcsProjectDir: string,
  destinationParent?: string
): StudioWebConnectResult {
  const exported = exportToStudioWebProject(lcsProjectDir, destinationParent);
  const archives = packageStudioWebArchives(exported.targetDir, path.dirname(exported.targetDir), {
    includeUis: false
  });

  const checklist = [
    'Open Studio Web (studio.uipath.com) and sign in',
    `Import project: use ${path.basename(archives.uipPath)} (Automations → New → Import project)`,
    'Wait for NuGet packages in project.json to restore',
    'Open the main .xaml, replace Comment placeholders if needed, then publish'
  ];

  const guidePath = path.join(exported.targetDir, 'OPEN_IN_STUDIO_WEB.md');
  const depLines = Object.entries(exported.dependencies)
    .map(([name, ver]) => `- \`${name}\`: ${ver}`)
    .join('\n');

  fs.writeFileSync(
    guidePath,
    `# Open in UiPath Studio Web

Legacy \`.uip\` package export from LowCode Studio.

Prefer **Connect / Open Studio Web Local Workspace** (sync-on-save) instead of importing \`.uip\` each time.

## Import \`.uip\`

1. Go to [${STUDIO_WEB_URL}](${STUDIO_WEB_URL})
2. Automations → **Import project** → \`${path.basename(archives.uipPath)}\`

## Checklist

${checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Packages

${depLines || '_No dependencies listed_'}
`,
    'utf8'
  );

  return {
    ...exported,
    guidePath,
    checklist,
    archives,
    mode: 'uip-package',
    files: [...exported.files, 'OPEN_IN_STUDIO_WEB.md', path.basename(archives.uipPath)]
  };
}

export function studioWebSyncGuideMarkdown(): string {
  return studioWebLocalGuideMarkdown();
}
