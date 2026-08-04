# LowCode Studio

**Version 0.6.1** · Studio-like **low-code RPA designer** for VS Code and Cursor on **Mac**, Windows, and Linux.

Built for UiPath practitioners who design, framework, develop, deploy, and test automations, but cannot run UiPath Studio Desktop on macOS. UiPath’s official **Maestro** extension covers Maestro Flows (`.flow`). This extension covers classic **Studio workflows**, **Flowcharts**, and **REFramework** locally — with the easiest path to **Studio Web** publish.

> Not an official UiPath product.

![version](https://img.shields.io/badge/version-0.6.1-0ea5e9)
![platform](https://img.shields.io/badge/platform-Mac%20%7C%20Windows%20%7C%20Linux-22c55e)
![vscode](https://img.shields.io/badge/VS%20Code%20%2F%20Cursor-1.85%2B-3b82f6)

**Full activity list:** [docs/ACTIVITIES.md](docs/ACTIVITIES.md) · **Studio Web guide:** [docs/STUDIO_WEB.md](docs/STUDIO_WEB.md)

## The easy loop (what this extension is for)

```
Design on Mac (REFramework)
   → Dry Run / Scenarios   (F5 / Shift+F5)
   → Connect to Studio Web (Cmd+Shift+U)
   → Import at studio.uipath.com
   → Publish to Orchestrator
```

| Priority | What | Shortcut |
|---|---|---|
| **1. Test** | Dry Run + **Manage Scenarios** | F5 / **Shift+F5** / Cmd+Shift+T |
| **2. Ship** | **Connect to Studio Web** | **Cmd+Shift+U** |
| Design | New REFramework / Designer | — |
| Config | Config.json ↔ Config.xlsx | — |

## In action

### 1. Sequence designer + custom container colors

![Sequence designer with custom colors](docs/images/vscode-sequence-colors.png)

### 2. Import UiPath / Export for Studio Web (with activity packages)

![Import and Studio Web export](docs/images/vscode-import-export-studioweb.png)

### 3. REFramework flowchart

![REFramework flowchart in VS Code](docs/images/vscode-reframework-flowchart.png)

### 4. REFramework scenario testing (Config + scenarios)

![REFramework scenario dry-run testing](docs/images/vscode-reframework-testing.png)

### 5. REFramework Process with Invoke Code & top activities

![REFramework Process with Invoke Code](docs/images/vscode-reframework-process-activities.png)

## What’s in 0.6.1

- **Studio Web packages** — Connect exports **`.uip`** (Import project) + **`.uis`** (solution/CLI)
- **Project Explorer** grouped by folders (Framework, Data, …)
- **Invoke Workflow** opens the target workflow in a new designer tab
- Designer UX: expand/collapse on Activities + Properties (grouped categories), canvas zoom, friendlier grid, hover highlight + tooltips

### Also in 0.6.0

- **Connect to Studio Web** — guided export + checklist + open studio.uipath.com ([guide](docs/STUDIO_WEB.md))
- **Dry Run Scenarios** as a first-class path — Shift+F5, last-scenario recall, Manage Scenarios (add / duplicate / open)
- Project Explorer actions: ▶ Dry Run Scenarios · ✎ Manage Scenarios · ☁ Connect to Studio Web
- Config.xlsx bridge, custom activities, Invoke Code + top-use activities, Python pack, XAML import/export
- Activity catalog: [docs/ACTIVITIES.md](docs/ACTIVITIES.md) (**57** activities)

## Install

```bash
cd lowcode-studio
npm install
npm run compile
npm test
npm run package
```

In Cursor / VS Code: **Extensions: Install from VSIX…** → `lowcode-studio-0.6.1.vsix` → reload.

## Easy path (REFramework)

1. **New REFramework Project**
2. Edit `Framework/Process.lcs.json`
3. Tune `Data/Config.json` (or import classic `Config.xlsx`)
4. **Shift+F5** → run scenarios (or **Manage Scenarios** to add a quick smoke test)
5. **Connect to Studio Web** → **Reveal .uip** → Import in [studio.uipath.com](https://studio.uipath.com)

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
| **F5** | Dry-run the open workflow |
| **Shift+F5** | Pick scenario / All / Add quick / Manage |
| **Manage Scenarios** | Add MaxTransactions smoke tests, duplicate, open file |
| `Data/Test/scenarios.json` | Named seeds + PASS/FAIL expects |

Last scenario is remembered for one-click re-run.

### Connect to Studio Web (key feature)

| Step | Action |
|---|---|
| 1 | **Connect to Studio Web** (exports `.uip` + `.uis` + Portable folder) |
| 2 | **Reveal .uip** / Open Checklist (`OPEN_IN_STUDIO_WEB.md`) |
| 3 | Open [studio.uipath.com](https://studio.uipath.com) → **Import project** → select `.uip` |
| 4 | Restore packages → publish to Orchestrator |

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
| UI | Click, Type Into, Get Attribute, Wait Element, … |
| Messaging | HTTP, Email, Deserialize/Serialize JSON |
| Python | Scope, Load/Run Script, Invoke Method, Get Object |
| REFramework | Invoke Workflow, Set Transaction Status |

See [docs/ACTIVITIES.md](docs/ACTIVITIES.md). Invoke Code / UI steps are dry-run stubs on Mac (real run in Studio/Robot).

## Commands

| Command | Shortcut |
|---|---|
| Dry Run | F5 |
| **Dry Run Scenarios** | **Shift+F5** |
| **Manage Scenarios** | Cmd+Shift+T |
| **Connect to Studio Web** | **Cmd+Shift+U** |
| Show Studio Web Guide | — |
| Export for Studio Web | — |
| Export / Import Config.xlsx | — |
| New REFramework Project | — |
| Getting Started | — |

## Roadmap

### Done
- Scenario dry-runs + Manage Scenarios UX
- **Connect to Studio Web** guided handoff + Git notes
- Config.xlsx bridge, custom activities, Invoke Code / top activities, Python pack

### Next
1. Import polish for `Imported.*` placeholders
2. Package validation warnings
3. Deeper modern UI scopes
4. Marketplace publish

## License

MIT
