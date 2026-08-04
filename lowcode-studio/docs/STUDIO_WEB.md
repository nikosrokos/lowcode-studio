# Connect LowCode Studio ↔ UiPath Studio Web

LowCode Studio is optimized for **Mac design + dry-run**. Studio Web is the **cloud publish** path.

## Recommended loop

```
Design on Mac (LowCode Studio)
   → Dry Run / Scenarios (F5 / Shift+F5)
   → Connect to Studio Web (export Portable project)
   → Import in studio.uipath.com
   → Publish to Orchestrator
```

## One-command handoff

1. Open your LowCode Studio project
2. Run **LowCode Studio: Connect to Studio Web**
3. Choose **Open Folder** (reveal the `*.StudioWeb` export)
4. Choose **Open Studio Web**
5. In Studio Web: **Import** that folder (or pull via Git)

## What the export includes

| Item | Purpose |
|---|---|
| `*.xaml` workflows | Open in Studio Web designer |
| `project.json` | Portable project + activity NuGet deps |
| `Data/Config.json` / `Config.xlsx` | REFramework settings |
| `Data/Test/scenarios.json` | Copied for reference (dry-run stays in LCS) |
| `OPEN_IN_STUDIO_WEB.md` | Checklist for import/publish |

## Git with Studio Web

If your tenant links Studio Web to Git:

1. Export with **Connect to Studio Web**
2. Copy/commit the export into the Git repo Studio Web uses
3. Pull in Studio Web and publish

## Tips for a clean import

- Prefer activities that map to real UiPath packages (see [ACTIVITIES.md](ACTIVITIES.md))
- Review `Imported.*` / Comment placeholders after import
- Keep scenario dry-runs in LowCode Studio — they do not run in Studio Web automatically
- Publish stays in Studio Web (by design)

> Not an official UiPath product — community tooling for Mac-first REFramework design.
