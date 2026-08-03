# LowCode Studio

Studio-like **low-code RPA designer** for VS Code and Cursor — works on **Mac**, Windows, and Linux.

Built for UiPath practitioners who design, framework, develop, deploy, and test automations, but cannot run UiPath Studio Desktop on macOS. UiPath’s official **Maestro** extension covers Maestro Flows (`.flow` orchestration). This extension covers the classic **Studio workflow / low-code** experience locally in your editor.

> Not an official UiPath product.

## Features

- Visual sequence designer (custom editor for `.lcs.json`)
- Activity toolbox: System, Control Flow, UI Automation, Data, Messaging
- Properties panel + Variables manager
- Project Explorer (`project.json`)
- Validate + Dry Run simulator (F5)
- Export to pseudocode
- Works in VS Code, Cursor, and other VS Code forks

## Install (Mac / Cursor / VS Code)

### From VSIX

```bash
cd lowcode-studio
npm install
npm run compile
npm run package
```

Then in Cursor / VS Code:

1. Command Palette → **Extensions: Install from VSIX…**
2. Select the generated `lowcode-studio-0.1.0.vsix`
3. Reload the window

### Develop

```bash
cd lowcode-studio
npm install
npm run compile
```

Open the `lowcode-studio` folder in VS Code/Cursor and press **F5** (Extension Development Host), or install the VSIX as above.

## Quick start

1. Open a workspace folder
2. Command Palette → **LowCode Studio: New Project**
3. `Main.lcs.json` opens in the visual designer
4. Drag activities onto the canvas, edit properties
5. Press **F5** for Dry Run (output channel shows the simulated execution)

Open the sample at `samples/HelloWorld.lcs.json` to explore.

## Activity catalog (v0.1)

| Category | Activities |
|---|---|
| System | Log Message, Delay, Comment |
| Programming | Assign |
| Control Flow | If, While, For Each, Try Catch, Sequence |
| UI Automation | Open Application, Click, Type Into, Get Text, Element Exists |
| Data | Read CSV, Write CSV, Build Data Table |
| Messaging | Send Email, HTTP Request |

UI and messaging activities are **design + dry-run stubs** on Mac (no local robot runtime). Use them to design/framework/test logic; wire real execution to Orchestrator / Studio Web / Agent later as needed.

## Workflow format

Workflows are JSON (`.lcs.json`) so they diff cleanly in Git and work well with AI coding agents:

```json
{
  "schemaVersion": "1.0",
  "name": "Main",
  "type": "Sequence",
  "variables": [],
  "arguments": [],
  "activities": []
}
```

## Commands

| Command | Shortcut |
|---|---|
| New Project | — |
| New Workflow | Cmd+Alt+N |
| Validate Workflow | Cmd+Shift+V |
| Dry Run | F5 |
| Export Pseudocode | — |
| Getting Started | — |

## How this relates to UiPath Maestro

| | UiPath Maestro (official) | LowCode Studio (this) |
|---|---|---|
| Focus | Maestro Flows / orchestration | Classic Studio-like low-code sequences |
| File type | `.flow` | `.lcs.json` |
| Mac support | Yes (VS Code) | Yes (VS Code / Cursor) |
| Cloud deploy | Orchestrator via `uip` CLI | Local design + dry-run (extensible) |

You can use both: Maestro for agentic/process orchestration, LowCode Studio for day-to-day low-code workflow design on Mac.

## Roadmap ideas

- Flowchart layout mode
- Selector recorder helpers
- Import/export bridges toward Studio Web / XAML-inspired interchange
- Real runner adapters (CLI / Orchestrator hooks)

## License

MIT
