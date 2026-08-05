# Connect LowCode Studio ↔ UiPath Studio Web Local Workspace

LowCode Studio is optimized for **Mac design + dry-run**. Link a project to a **Studio Web Local Workspace** solution folder; every **Save** syncs `.xaml` into that folder so Studio Web stays up to date — **no `.uip` export required**.

## Important: Portable (not Windows)

Studio Web Local Workspace shows this error for Windows-target projects:

> This project targets Windows  
> Windows projects can only be opened in Studio Web on a Windows machine or in Studio Desktop.

LowCode Studio therefore always writes the linked Local Workspace project as **`targetFramework: Portable`** (`net8.0`) so it opens on Mac Studio Web.

| Path | Target | Use |
|---|---|---|
| **Local Workspace** (Connect / Save sync) | **Portable** | Design/open in Studio Web on Mac |
| Legacy `.uip` / Export Windows folder | **Windows** | Studio Desktop / Windows robots |

If you already linked a project before this fix: run **Connect → Sync & open** (or Save once) to rewrite `project.json` as Portable.

## Recommended loop

```
Design on Mac (LowCode Studio)
   → Dry Run / Scenarios (F5 / Shift+F5)
   → Connect / Open Studio Web Local Workspace (once)
   → Open that folder in Studio Web → Local Workspace (Allow file access)
   → Save in LowCode Studio → Portable .xaml syncs on disk
   → Publish from Studio Web
```

## One-time connect

1. Select your LowCode Studio project (Project Explorer or open a workflow)
2. Run **Connect / Open Studio Web Local Workspace**
3. Choose:
   - **Create new** — pick a parent folder; LCS writes `{Name}/` with `.uipx` + Portable project
   - **Open existing** — pick a folder that already has a `.uipx`
   - **Sync & open** — if already linked (also rewrites Portable)
4. **Reveal Solution**, then in Studio Web: **Local Workspace → Open solution → Allow**
5. Keep designing in LowCode Studio — **Save** refreshes the linked `.xaml` / `project.json`

Link metadata is stored in LowCode Studio `project.json` → `studioWebLocal`.

## Sync on Save

| Setting | Default |
|---|---|
| `lowcodeStudio.syncStudioWebOnSave` | **true** |

When enabled and the project is linked, saving a `.lcs.json` or `project.json` rewrites the UiPath **Portable** project under the solution’s project folder.

## Legacy Windows handoff

From the Connect picker choose **Legacy: export .uip package once** or **Export for Studio Web (Windows project folder)** when you need a Windows-target package for Studio Desktop / Windows robots.

## Tips

- Prefer activities mapped to real UiPath packages (see [ACTIVITIES.md](ACTIVITIES.md))
- Use the designer **Selector Builder** before publishing
- Nest UI steps under **Use Application/Browser** when targeting a browser scope
- Desktop UI (`<wnd>`) still needs a Windows machine / Studio Desktop for reliable capture
- Review `WINDOWS_TODO.md` for Mac → Windows robot handoff items

> Not an official UiPath product — community tooling for Mac-first REFramework design with Studio Web Local Workspace sync.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Failed to parse JSON` / `uniqueId` Guid error | Update to **0.6.13+** and **Save** or Connect → Sync (rewrites a valid Guid) |
| "targets Windows" on Mac | Update to **0.6.12+** and Sync (rewrites Portable) |
| Solution not in Project Explorer | Connect → Sync/Open again, or **Open** and pick the `.uipx` solution folder (works with no workspace open) |
| `'sapc' prefix is not defined` when opening .xaml | Update to **0.6.16+** and **Save** (rewrites Ignorable to `sap sap2010`) |
| Duplicate / stuck projects in Project Explorer | Update to **0.6.16+**; Remove hides + unlinks; Connect no longer adds a second workspace root for the solution |
| Changes in LCS not visible in Studio Web | Update to **0.6.15+**, ensure project is **linked** (Save toast says `synced .xaml`), then reopen the workflow in Studio Web if it still shows a cached copy |
| "Open a workspace folder first" when opening a solution | Update to **0.6.14+** — Open accepts Studio Web `.uipx` solutions without a prior workspace |
