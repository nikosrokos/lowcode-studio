# Connect LowCode Studio ↔ UiPath Studio Web

LowCode Studio is optimized for **Mac design + dry-run**. Studio Web is the **cloud publish** path.

## Recommended loop

```
Design on Mac (LowCode Studio)
   → Dry Run / Scenarios (F5 / Shift+F5)
   → Connect to Studio Web (exports .uip + .uis)
   → Import .uip in studio.uipath.com
   → Publish to Orchestrator
```

## One-command handoff

1. Open your LowCode Studio project
2. Run **LowCode Studio: Connect to Studio Web**
3. Prefer **Reveal .uip** then **Open Studio Web**
4. In Studio Web: **Automations → New → Import project** → select the `.uip` file
5. Wait for packages to restore, open the main `.xaml`, publish

## Packages produced

| File | Use |
|---|---|
| **`.uip`** | Studio Web **Import project** (recommended) |
| **`.uis`** | Solution / CLI `uip solution upload` |
| **`*.StudioWeb/` folder** | Unpacked Portable project for Git-linked tenants |
| `OPEN_IN_STUDIO_WEB.md` | Checklist written next to the export |

## What the export includes

| Item | Purpose |
|---|---|
| `*.xaml` workflows | Open in Studio Web designer |
| `project.json` | Portable project + activity NuGet deps |
| `Data/Config.json` / `Config.xlsx` | REFramework settings |
| `Data/Test/scenarios.json` | Copied for reference (dry-run stays in LCS) |

## Git with Studio Web

If your tenant links Studio Web to Git:

1. Export with **Connect to Studio Web**
2. Copy/commit the `*.StudioWeb` folder into the Git repo Studio Web uses
3. Pull in Studio Web and publish

## Tips for a clean import

- Prefer activities that map to real UiPath packages (see [ACTIVITIES.md](ACTIVITIES.md))
- Review `Imported.*` / Comment placeholders after import
- Keep scenario dry-runs in LowCode Studio — they do not run in Studio Web automatically
- Publish stays in Studio Web (by design)

> Not an official UiPath product — community tooling for Mac-first REFramework design.
