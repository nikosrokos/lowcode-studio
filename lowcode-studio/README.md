# LowCode Studio

**Version 0.7.2** · Studio-like **low-code RPA designer** for VS Code and Cursor on **Mac**, Windows, and Linux.

Built for UiPath practitioners who design, framework, develop, deploy, and test automations, but cannot run UiPath Studio Desktop on macOS. UiPath’s official **Maestro** extension covers Maestro Flows (`.flow`). This extension covers classic **Studio workflows**, **Flowcharts**, and **REFramework** locally — with the easiest path to **Studio Web** publish.

> Not an official UiPath product.

![version](https://img.shields.io/badge/version-0.7.2-0ea5e9)
![platform](https://img.shields.io/badge/platform-Mac%20%7C%20Windows%20%7C%20Linux-22c55e)
![vscode](https://img.shields.io/badge/VS%20Code%20%2F%20Cursor-1.85%2B-3b82f6)

**Full activity list:** [docs/ACTIVITIES.md](docs/ACTIVITIES.md) · **Studio Web guide:** [docs/STUDIO_WEB.md](docs/STUDIO_WEB.md) · **Roadmap:** [docs/ROADMAP.md](docs/ROADMAP.md)

## The easy loop (what this extension is for)

```
Design on Mac (REFramework)
   → Dry Run / Scenarios   (F5 / Shift+F5)
   → Connect Local Workspace (Cmd+Shift+U)
   → Open folder in Studio Web → Local Workspace
   → Save in LCS (↔ bidirectional sync) → Publish
```

| Priority | What | Shortcut |
|---|---|---|
| **1. Test** | Dry Run + **Manage Scenarios** | F5 / **Shift+F5** / Cmd+Shift+T |
| **2. Ship** | **Studio Web Local Workspace** (↔ sync on Save) | **Cmd+Shift+U** |
| Design | **Insert (⌘K)** / Blueprint / REFramework / Assist | **⌘K** in designer |
| Config | Config.json ↔ Config.xlsx | — |

## In action

<p>
  <img src="docs/images/designer-overview.png" alt="Maestro-style canvas with framed toolbox, properties, and macOS dock" width="720" />
</p>

<p>
  <img src="docs/images/project-explorer.png" alt="Floating toolbox and properties frames over the canvas" width="720" />
</p>

1. **Designer** — framed toolbox + properties, sequence board, macOS-style bottom dock  
2. **Floating frames** — traffic-light controls to float / dock / collapse either side panel  

## What’s in 0.6.44

- **Existing Studio Web projects** migrate on open (ids / props / Sequence unwrap) — reopen the `.lcs.json`, no Web recreate
- Richer mini-map rows; narrower activity column; right-click menu no longer clips at the bottom

Full history: [CHANGELOG.md](CHANGELOG.md)


## Install

```bash
cd lowcode-studio
npm install
npm run compile
npm test
npm run package
```

In Cursor / VS Code: **Extensions: Install from VSIX…** → `lowcode-studio-0.6.44.vsix` → reload.

## Easy path

**Fastest start:** **New Robot Blueprint** → pick scrape→Excel / login→email / API→table → **F5**.

**REFramework path:**

1. **Open folder** (LCS project *or* Studio Web `.uipx` solution — Main opens automatically) *or* **New REFramework Project**
2. Edit `Framework/Process.lcs.json`
3. Tune `Data/Config.json` (or import classic `Config.xlsx`)
4. **Shift+F5** → run scenarios (or **Manage Scenarios** to add a quick smoke test)
5. **Validate Packages** (optional) → **Create / link Studio Web Local Workspace** → open that folder in Studio Web → **Save** to sync

```
MyREFramework/
  Main.lcs.json
  Framework/Process.lcs.json
  Data/
    Config.json + Config.xlsx
    Test/scenarios.json      ← easiest local tests
  activities.custom.json
```

### Dry-run & scenarios (key feature)

| Piece | Purpose |
|---|---|
| **F5** | Dry-run the open workflow (Run All or Step Through) |
| **Step Through** | Designer button — highlight steps + variable deltas |
| **Shift+F5** | Pick scenario / All / Add quick / Manage |
| **Manage Scenarios** | Add MaxTransactions smoke tests, duplicate, open file |
| `Data/Test/scenarios.json` | Named seeds + PASS/FAIL expects |

Last scenario is remembered for one-click re-run.

### Studio Web Local Workspace (key feature)

| Step | Action |
|---|---|
| 1 | **Connect / Open Studio Web Local Workspace** (create or open a `.uipx` solution) |
| 2 | **Reveal Solution** → Studio Web → **Local Workspace** → Open solution → Allow |
| 3 | **Save** in LowCode Studio — `.xaml` syncs into the linked folder |
| 4 | Publish from Studio Web → run on a Windows robot |

Git tenants: commit the `*.StudioWeb` folder into the repo Studio Web tracks, then pull in Studio Web. Full notes: [docs/STUDIO_WEB.md](docs/STUDIO_WEB.md).

Export includes XAML, `project.json` (NuGet deps), Config.json/xlsx, and `scenarios.json` for handoff reference.

### Config.xlsx bridge

| Command | Direction |
|---|---|
| **Export Config.xlsx** | JSON → classic Settings / Constants / Assets |
| **Import Config.xlsx** | classic Excel → JSON |

### Custom activities

**Register Custom Activity** → This project (`activities.custom.json`) or All my projects (user library).

## Activity catalog (summary)

| Category | Highlights |
|---|---|
| Programming | Assign, Multiple Assign, **Invoke Code** |
| Data | Build/Filter/ForEach Row, Add Row/Column, CSV |
| System | Log, Throw, Terminate Workflow |
| UI | Use Application/Browser, Click, Type Into, Extract Table, … |
| Messaging | HTTP, Email, Deserialize/Serialize JSON |
| Python | Scope, Load/Run Script, Invoke Method, Get Object |
| REFramework | Invoke Workflow, Set Transaction Status |

See [docs/ACTIVITIES.md](docs/ACTIVITIES.md). Invoke Code / UI steps are dry-run stubs on Mac (real run in Studio/Robot).

## Commands

| Command | Shortcut |
|---|---|
| Dry Run | F5 |
| **Dry Run Scenarios** | **Shift+F5** |
| **Activity Palette** | **⌘K** (designer) / Cmd+Shift+A |
| **Manage Scenarios** | Cmd+Shift+T |
| **Connect to Studio Web** | **Cmd+Shift+U** |
| Show Studio Web Guide | — |
| Export for Studio Web | — |
| Export / Import Config.xlsx | — |
| **New Robot Blueprint** | — |
| New REFramework Project | — |
| Getting Started | — |

## Roadmap

### Done
- Scenario dry-runs + Manage Scenarios UX
- **Connect to Studio Web** guided handoff + Git notes
- Config.xlsx bridge, custom activities, Invoke Code / top activities, Python pack
- Package validation warnings + Open Local Project + Project Explorer title actions
- Windows project target + classic Windows UI selectors for robot execution
- Floating/resizable properties panel, Extract Table Data, title-action tooltips
- Selector Builder, Use Application/Browser scope, Windows TODO on Connect
- Stronger Mac dry-run (fixtures, step-through, scenario diffs)
- Robot blueprint gallery (scrape→Excel, login→email, API→table)
- Cmd+K activity palette (favorites/recent) + smart property suggestions
- UI Input Method (Simulate / Chromium API / Window Messages / Hardware Events) exported to Studio Web
- **A2** File IO + FlowSwitch import map (fewer `Imported.*`)
- **C2** Opt-in real HTTP / Python dry-run runners
- **F0–F4** Assist: Explain, scenarios, **F2 scaffold + dry-run-trace repair**, selectors, VB repairs
- Designer **Assist Live / Scaffold** tabs with propose → Apply
- **Invoke argument mapping**, expr **VB Assist**, canvas Fit/Find/Align, cleaner Assist popup

### Shipped recently (0.7.2)
- **Ready for Studio Web?** gate (command + dock) → Reveal Local Workspace when green
- **Project Assist** — VB + selector scan across the whole project
- Project tree Duplicate / Rename / Reveal in Studio Web folder
- Sync **conflict clarity** (per-file stale list + pull “what changed” report)

### Next (5) — stay in Cursor longer
1. Dry-run breakpoints + watch panel
2. Richer F2 scaffolds / multi-file scaffold
3. Next import-map / Excel–Orchestrator parity (fewer `Imported.*`)
4. Canvas distribute / drop polish
5. Typed property editors (DataTable, dictionary, secrets)

Full plan: [docs/ROADMAP.md](docs/ROADMAP.md)

## License

MIT
