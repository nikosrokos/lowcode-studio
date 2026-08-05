# Changelog

All notable changes to **LowCode Studio** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

Use **LowCode Studio: What's New** in the command palette (or the Output channel after an upgrade) to see the latest sections.

## [0.6.33] — 2026-08-05

### Fixed
- **Use Application/Browser** Studio Web “activity missing / could not be loaded”: export now uses real `NApplicationCard` shape (`TargetApp` for Url/BrowserType, `AttachMode=ByInstance|SingleWindow`, `ActivityAction` body) — no more hallucinated card-level `Url` / `AttachMode="Browser"`
- **Build Data Table** on Studio Web Local (Portable): UiPath marks it Windows-only; Save now rewrites to `New DataTable` + **Add Data Column** so Studio Web can open the workflow

### Added
- Studio Web checklist / package validation notes for Windows-only activities

## [0.6.32] — 2026-08-05

### Added
- Properties panel shows **VB repair hints in red** under expression fields, with one-click Apply
- Activity **right-click** menu: Move up/down, Open workflow, Apply VB repairs (card icon buttons removed)

### Fixed
- Variables panel not listing variables (`variablesPanel` typo broke render)
- Add Argument / Add Variable persistence racing a stale document read

## [0.6.31] — 2026-08-05

### Added
- **F4** Assist — **Repair VB expressions** for UiPath Visual Basic (e.g. `TRim(x)` → `x.Trim()`, JS-style `.toUpperCase()` / `== null` / `&&`, confirm before apply)
- Assist help popup documents F4

## [0.6.30] — 2026-08-05

### Added
- **F3** Assist — **Suggest / repair selectors** from HTML / Explorer paste, or propose repairs for empty / placeholder / weak UI steps (confirm before apply)
- Assist help popup documents F3

## [0.6.29] — 2026-08-05

### Added
- **A2** Import map shrink — File IO (`ReadTextFile`, `WriteTextFile`, `AppendLine`, `PathExists`, `CreateDirectory`, `CopyFile`, `DeleteFile`) and **FlowSwitch** map to real LCS types (not `Imported.*`)
- **C2** Opt-in real HTTP + local Python in dry-run (`lowcodeStudio.dryRun.realHttp` / `realPython`, host allow list; fixtures always win)
- **F0** Assist — **Explain / critique workflow** (deterministic report in Output)
- **F1** Assist — **Generate scenarios from description** (Manage Scenarios + command palette)
- Designer toolbar **✦ Assist** button — open/close popup with how-to for Assist commands and where to run them

### Changed
- Dry-run uses project directory for real File IO stubs; File IO steps classify as `real`

## [0.6.28] — 2026-08-05

### Added
- **A4** Out-of-sync badge on linked Studio Web Local Workspace (Project Explorer)
- **D2** “Required for Studio Web” checklist on the selected activity (Properties)
- **E2** Manage Packages UI — edit NuGet pins; stop treating silent `[1.0.0]` as fine
- **D3** First-run wizard: REF → Scenario → Connect (also offered on first activate)

## [0.6.27] — 2026-08-05

### Added
- **A3 Selectors** — specificity score meter in Selector Builder; Decode paste (UI Explorer / `#id` / embedded classic); Copy sibling selector
- Canvas cards show **Windows TODO** selector messages (missing / starter / weak), not only “Needs a real selector”
- Workflow Validate warns on missing, placeholder, and weak UI selectors
- Package Validate writes `WINDOWS_TODO.md` and prints the Windows TODO report to Output (also on Connect)
- **CHANGELOG.md** + in-extension **What's New** (shows in Output when the extension version changes)

### Changed
- Activity color presets remain 6 defaults with custom picker (from 0.6.26)
- Settings popup (canvas + defaults) from 0.6.26

## [0.6.26] — 2026-08-05

### Added
- Toolbar **Settings** popup — step numbers, canvas plain/dots, default workflow type, auto-open designer, Studio Web sync, UiPath target

### Changed
- Activity color presets trimmed to **6** defaults; custom hex / color picker unchanged
- Designer UX: accordion left rail, breakpoints top-right, right-click menu, insert +, Arguments/Variables fix

## [0.6.25] — 2026-08-05

### Fixed
- Add/edit/delete Arguments & Variables in the side panel

### Changed
- Accordion left rail (Watch/Fixtures get full height); breakpoints top-right; right-click delete/insert; + between activities

## [0.6.24] — 2026-08-05

### Added
- **Dry-run 2.0 (C1)** — breakpoints, run-to-here, Watch panel, Fixtures session editor, per-step `real` · `simulated` · `unsupported`
- **VS Code Output** — dry-run logs and button notifications go to **LowCode Studio** Output

## [0.6.23] — 2026-08-05

### Added
- Phase B activities (Orchestrator queue/assets, Excel Append/Scope, Data Join/Lookup/Sort, Parallel, Timeout, HTTP auth, Get Email, Select Token)
- Blueprint: Queue → Process → Set Status

## [0.6.22] — 2026-08-05

### Added
- Workflow Arguments panel + Invoke argument mappings
- Expression expand editor, find-in-workflow, breadcrumbs, Flowchart Tidy

## [0.6.21] — 2026-08-04

### Changed
- Dock chrome polish; side panel show/hide via bottom dock; expand/collapse symbols

## [0.6.20] — 2026-08-04

### Added
- Maestro-inspired canvas chrome — framed panels, traffic lights, bottom dock

## [0.6.19] — 2026-08-04

### Added
- Use Application/Browser as real container; stronger placeholder detection; Selector Builder live apply
- Sequence board surface, spine drop-zones, card selector warnings

## [0.6.18] – [0.6.0]

Earlier Studio Web Local Workspace, Connect, scenarios, packages, and XAML fidelity releases — see git history and prior README notes.
