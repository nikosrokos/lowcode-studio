import * as fs from 'fs';
import * as path from 'path';
import { exportToStudioWebProject, ExportedStudioWebProject } from './studioProject';
import { packageStudioWebArchives, PackagedStudioArchives } from './studioPackage';

export const STUDIO_WEB_URL = 'https://studio.uipath.com';

export interface StudioWebConnectResult extends ExportedStudioWebProject {
  guidePath: string;
  checklist: string[];
  archives: PackagedStudioArchives;
}

/**
 * Export for Studio Web, package `.uip` + `.uis`, and write an import checklist.
 */
export function connectToStudioWeb(
  lcsProjectDir: string,
  destinationParent?: string
): StudioWebConnectResult {
  const exported = exportToStudioWebProject(lcsProjectDir, destinationParent);
  const archives = packageStudioWebArchives(exported.targetDir, path.dirname(exported.targetDir));

  const checklist = [
    'Open Studio Web (studio.uipath.com) and sign in',
    `Import project: use ${path.basename(archives.uipPath)} (Automations → New → Import project)`,
    `Or upload solution archive: ${path.basename(archives.uisPath)} (.uis)`,
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

Exported from **LowCode Studio** as importable packages.

## Fastest path — import \`.uip\`

1. Go to [${STUDIO_WEB_URL}](${STUDIO_WEB_URL})
2. Automations → arrow next to **New project** → **Import project**
3. Choose **\`${path.basename(archives.uipPath)}\`** (next to the \`.StudioWeb\` folder)
4. Let packages restore, open \`${exported.mainXaml}\`, publish when ready

## Alternative — \`.uis\` solution archive

Use **\`${path.basename(archives.uisPath)}\`** with UiPath CLI \`uip solution upload\` or solution import flows.

## Folder export (Git)

\`${path.basename(exported.targetDir)}\` remains available for Git-linked Studio Web tenants.

## Checklist

${checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Packages included

${depLines || '_No dependencies listed_'}

## Files produced

| File | Use |
|---|---|
| \`${path.basename(archives.uipPath)}\` | Studio Web **Import project** (Windows-compatible) |
| \`${path.basename(archives.uisPath)}\` | Solution / CLI upload |
| \`${path.basename(exported.targetDir)}/\` | Unpacked **Windows** UiPath project (Git / Studio Desktop) |

> Projects export with \`targetFramework: Windows\` and classic Windows UI selectors so they run on **Windows robots**. Refine selectors with UI Explorer on a Windows machine.

Publish remains in **Studio Web** / Studio Desktop by design.
`,
    'utf8'
  );

  const readmePath = path.join(exported.targetDir, 'README_STUDIO_WEB.md');
  if (fs.existsSync(readmePath)) {
    fs.appendFileSync(
      readmePath,
      `\n## Import packages\n\n- \`.uip\`: \`${archives.uipPath}\`\n- \`.uis\`: \`${archives.uisPath}\`\n`,
      'utf8'
    );
  }

  return {
    ...exported,
    guidePath,
    checklist,
    archives,
    files: [
      ...exported.files,
      'OPEN_IN_STUDIO_WEB.md',
      path.basename(archives.uipPath),
      path.basename(archives.uisPath)
    ]
  };
}

export function studioWebSyncGuideMarkdown(): string {
  return `# Connect LowCode Studio ↔ UiPath Studio Web

LowCode Studio is optimized for **Mac design + dry-run**. Exports target **Windows** so automations run on **Windows robots**.

## Recommended loop

\`\`\`
Design on Mac (LowCode Studio)
   → Dry Run / Scenarios (F5 / Shift+F5)
   → Connect to Studio Web (exports Windows .uip + .uis)
   → Import .uip / open in Studio Desktop (Windows)
   → Refine selectors with UI Explorer on Windows
   → Publish → run on Windows robot
\`\`\`

## One-command handoff

1. Open your LowCode Studio project
2. Run **LowCode Studio: Connect to Studio Web**
3. Prefer **Reveal .uip** then **Open Studio Web**
4. In Studio Web: **Import project** → select the \`.uip\` file (or open the folder in Studio Desktop)

| Package | Use |
|---|---|
| **\`.uip\`** | Studio Web Automations → Import project |
| **\`.uis\`** | Solution / CLI \`uip solution upload\` |
| **\`.StudioWeb/\` folder** | Windows project for Git / Studio Desktop |

## Tips

- Prefer activities mapped to real UiPath packages (see ACTIVITIES.md)
- UI selectors are **Windows classic** (\`<html>/<webctrl>\`, \`<wnd>\`) — capture/refine on Windows
- Review Comment / \`Imported.*\` placeholders after import
- Keep scenario dry-runs in LowCode Studio
- Publish stays in Studio Web / Studio Desktop (by design)

> Not an official UiPath product.
`;
}
