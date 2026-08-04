# Connect LowCode Studio ↔ UiPath Studio Web / Windows robots

LowCode Studio is optimized for **Mac design + dry-run**. Exported projects target **Windows** so they run on **Windows robots** (Studio Desktop or Orchestrator).

## Recommended loop

```
Design on Mac (LowCode Studio)
   → Dry Run / Scenarios (F5 / Shift+F5)
   → Validate Packages / review Windows TODO
   → Connect to Studio Web (exports Windows .uip + WINDOWS_TODO.md)
   → Import .uip / open in Studio Desktop (Windows)
   → Refine selectors with UI Explorer / Indicate Element on Windows
   → Publish → run on Windows robot
```

## One-command handoff

1. Open your LowCode Studio project
2. Select the project in **Project Explorer** (or open one of its workflows)
3. Run **Export .uip** / **Connect to Studio Web**
4. Prefer **Reveal .uip** then **Open Studio Web**
5. In Studio Web: **Automations → New → Import project** → select the `.uip` file  
   — or open the unpacked folder in **Studio Desktop (Windows)**
6. Wait for packages to restore, refine UI selectors on Windows, publish

## Windows compatibility

| Setting | Value |
|---|---|
| `targetFramework` | **Windows** |
| .NET TFM | `net8.0-windows` |
| UI selectors | Classic `<html>/<webctrl>` (browser) or `<wnd>` (desktop) |
| Activities | `UiPath.UIAutomation.Activities` modern (`uia:NClick`, …) |
| Input method | Set in designer (**Simulate** / **Chromium API** / Window Messages / Hardware Events); exports as `InteractionMode` |

Override per project with `"uipathTargetFramework": "Portable"` in LowCode Studio `project.json` only if you need cross-platform (not recommended for UI/web automation).

## Packages produced

| File | Use |
|---|---|
| **`.uip`** | Studio Web **Import project** (only archive Export .uip creates) |
| **`*.StudioWeb/` folder** | Unpacked Windows project for Git / Studio Desktop |
| `OPEN_IN_STUDIO_WEB.md` | Checklist written next to the export |
| `WINDOWS_TODO.md` | Mac → Windows handoff TODOs (selectors, invokes, placeholders) |
| `PACKAGE_WARNINGS.md` | Package / selector validation notes (when present) |

## What the export includes

| Item | Purpose |
|---|---|
| `*.xaml` workflows | Open in Studio Web / Studio Desktop |
| `project.json` | Windows project + activity NuGet deps |
| `Data/Config.json` / `Config.xlsx` | REFramework settings |
| `Data/Test/scenarios.json` | Copied for reference (dry-run stays in LCS) |

## Tips for a clean Windows run

- Prefer activities that map to real UiPath packages (see [ACTIVITIES.md](ACTIVITIES.md))
- Use the designer **Selector Builder** for classic Windows selectors before Connect
- Nest UI steps under **Use Application/Browser** when targeting a modern app/browser scope
- Review `WINDOWS_TODO.md` after Connect — fix high-priority items before robot run
- Capture / refine remaining selectors on a **Windows** machine with UI Explorer
- Review `Imported.*` / Comment placeholders after import
- Keep scenario dry-runs in LowCode Studio — they do not run in Studio Web automatically
- Publish from Studio Web or Studio Desktop; execute on a Windows robot

> Not an official UiPath product — community tooling for Mac-first REFramework design targeting Windows execution.
