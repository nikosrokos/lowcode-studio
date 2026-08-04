import * as fs from 'fs';
import * as path from 'path';
import { exportToStudioWebProject, ExportedStudioWebProject } from './studioProject';

export const STUDIO_WEB_URL = 'https://studio.uipath.com';

export interface StudioWebConnectResult extends ExportedStudioWebProject {
  guidePath: string;
  checklist: string[];
}

/**
 * Export for Studio Web and write a short open/import checklist beside the package.
 * Designed as the easiest Mac → Studio Web handoff.
 */
export function connectToStudioWeb(
  lcsProjectDir: string,
  destinationParent?: string
): StudioWebConnectResult {
  const exported = exportToStudioWebProject(lcsProjectDir, destinationParent);
  const checklist = [
    'Open Studio Web (studio.uipath.com) and sign in to your tenant',
    `Import / upload the folder: ${path.basename(exported.targetDir)}`,
    'Wait for NuGet packages in project.json to restore',
    'Open the main .xaml and replace any Comment placeholders if needed',
    'Publish from Studio Web to Orchestrator when ready'
  ];

  const guidePath = path.join(exported.targetDir, 'OPEN_IN_STUDIO_WEB.md');
  const depLines = Object.entries(exported.dependencies)
    .map(([name, ver]) => `- \`${name}\`: ${ver}`)
    .join('\n');

  fs.writeFileSync(
    guidePath,
    `# Open in UiPath Studio Web

This folder was exported from **LowCode Studio** for the easiest Studio Web handoff.

## Fast path (2 minutes)

1. Go to [${STUDIO_WEB_URL}](${STUDIO_WEB_URL})
2. Create or open a **Solution**
3. **Import / upload this whole folder** (\`${path.basename(exported.targetDir)}\`)
4. Let Studio restore packages from \`project.json\`
5. Open \`${exported.mainXaml}\` and run / publish from Studio Web

## Git-friendly path (recommended for teams)

If your Automation Cloud tenant uses **Git with Studio Web**:

1. Push this \`.StudioWeb\` folder (or its contents) to the repo branch Studio Web tracks
2. In Studio Web → open the solution from Git
3. Pull latest, restore packages, publish

> Keep designing + dry-running in LowCode Studio on Mac. Use Studio Web for cloud design polish and Orchestrator publish.

## Checklist

${checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Packages included

${depLines || '_No dependencies listed_'}

## What stays in LowCode Studio

- Visual Sequence / Flowchart design (\`.lcs.json\`)
- REFramework scenario dry-runs (\`Data/Test/scenarios.json\`)
- Config.json ↔ Config.xlsx bridge
- Custom activity registration

Publish remains in **Studio Web** by design (no local Robot / Orchestrator publish from Mac).
`,
    'utf8'
  );

  // Also refresh the longer README if present
  const readmePath = path.join(exported.targetDir, 'README_STUDIO_WEB.md');
  if (fs.existsSync(readmePath)) {
    const extra = `

## Easy connection from LowCode Studio

Use command **LowCode Studio: Connect to Studio Web** for export + checklist + open links.

See also \`OPEN_IN_STUDIO_WEB.md\` in this folder.
`;
    fs.appendFileSync(readmePath, extra, 'utf8');
  }

  return {
    ...exported,
    guidePath,
    checklist,
    files: [...exported.files, 'OPEN_IN_STUDIO_WEB.md']
  };
}

export function studioWebSyncGuideMarkdown(): string {
  return `# Connect LowCode Studio ↔ UiPath Studio Web

LowCode Studio is optimized for **Mac design + dry-run**. Studio Web is the **cloud publish** path.

## Recommended loop

\`\`\`
Design on Mac (LowCode Studio)
   → Dry Run / Scenarios (F5 / Shift+F5)
   → Connect to Studio Web (export Portable project)
   → Import in studio.uipath.com
   → Publish to Orchestrator
\`\`\`

## One-command handoff

1. Open your LowCode Studio project
2. Run **LowCode Studio: Connect to Studio Web**
3. Choose **Open Folder** (reveal the \`*.StudioWeb\` export)
4. Choose **Open Studio Web**
5. In Studio Web: **Import** that folder (or pull via Git)

## What the export includes

| Item | Purpose |
|---|---|
| \`*.xaml\` workflows | Open in Studio Web designer |
| \`project.json\` | Portable project + activity NuGet deps |
| \`Data/Config.json\` / \`Config.xlsx\` | REFramework settings |
| \`OPEN_IN_STUDIO_WEB.md\` | Checklist for import/publish |

## Git with Studio Web

If your tenant links Studio Web to Git:

1. Export with **Connect to Studio Web**
2. Copy/commit the export into the Git repo Studio Web uses
3. Pull in Studio Web and publish

## Tips for a clean import

- Prefer activities that map to real UiPath packages (see ACTIVITIES.md)
- Review \`Imported.*\` / Comment placeholders after import
- Keep scenario dry-runs in LowCode Studio — they do not run in Studio Web automatically
- Publish stays in Studio Web (by design)

> Not an official UiPath product — community tooling for Mac-first REFramework design.
`;
}
