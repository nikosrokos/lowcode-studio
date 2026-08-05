# Changelog

All notable changes to **LowCode Studio** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

Use **LowCode Studio: What's New** in the command palette (or the Output channel after an upgrade) to see the latest sections.

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
