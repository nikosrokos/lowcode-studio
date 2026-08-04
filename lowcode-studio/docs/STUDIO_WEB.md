# Connect LowCode Studio ↔ UiPath Studio Web Local Workspace

LowCode Studio is optimized for **Mac design + dry-run**. Link a project to a **Studio Web Local Workspace** solution folder; every **Save** syncs Windows `.xaml` into that folder so Studio Web stays up to date — **no `.uip` export required**.

## Recommended loop

```
Design on Mac (LowCode Studio)
   → Dry Run / Scenarios (F5 / Shift+F5)
   → Connect / Open Studio Web Local Workspace (once)
   → Open that folder in Studio Web → Local Workspace (Allow file access)
   → Save in LowCode Studio → files sync on disk
   → Publish from Studio Web → run on Windows robot
```

## One-time connect

1. Select your LowCode Studio project (Project Explorer or open a workflow)
2. Run **Connect / Open Studio Web Local Workspace**
3. Choose:
   - **Create new** — pick a parent folder; LCS writes `{Name}/` with `.uipx` + project
   - **Open existing** — pick a folder that already has a `.uipx`
   - **Sync & open** — if already linked
4. **Reveal Solution**, then in Studio Web: **Local Workspace → Open solution → Allow**
5. Keep designing in LowCode Studio — **Save** refreshes the linked `.xaml` / `project.json`

Link metadata is stored in LowCode Studio `project.json` → `studioWebLocal`.

## Sync on Save

| Setting | Default |
|---|---|
| `lowcodeStudio.syncStudioWebOnSave` | **true** |

When enabled and the project is linked, saving a `.lcs.json` or `project.json` rewrites the UiPath project under the solution’s project folder.

## Windows compatibility

| Setting | Value |
|---|---|
| `targetFramework` | **Windows** |
| .NET TFM | `net8.0-windows` |
| UI selectors | Classic `<html>/<webctrl>` (browser) or `<wnd>` (desktop) |
| Activities | `UiPath.UIAutomation.Activities` modern (`uia:NClick`, …) |
| Input method | Set in designer; exports as `InteractionMode` |

## Legacy one-off `.uip`

From the Connect picker choose **Legacy: export .uip package once** if you still need Automations → Import project. Prefer Local Workspace sync for day-to-day work.

## Tips

- Prefer activities mapped to real UiPath packages (see [ACTIVITIES.md](ACTIVITIES.md))
- Use the designer **Selector Builder** before publishing
- Nest UI steps under **Use Application/Browser** when targeting a modern app/browser scope
- Review `WINDOWS_TODO.md` for Mac → Windows handoff items
- Capture / refine remaining selectors on Windows with UI Explorer

> Not an official UiPath product — community tooling for Mac-first REFramework design targeting Windows execution.
