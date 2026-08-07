# Changelog

All notable changes to **LowCode Studio** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

Use **LowCode Studio: What's New** in the command palette (or the Output channel after an upgrade) to see the latest sections.

## [0.7.4] — 2026-08-07

## [0.7.2] — 2026-08-06

### Added
- **Theme 1 — End-to-end daily path**
  - **Ready for Studio Web?** gate (command + designer dock ◉) — packages, Portable openability, selectors, `Imported.*`, Invoke paths, Windows TODO; green → Reveal Local Workspace / Open Studio Web
  - **Project Assist** — scan VB (F4) + selectors (F3) across the whole project; propose → Apply all / VB only / selectors only
  - **Project tree** — Duplicate / Rename / Reveal in Studio Web folder (⋯ menu + right-click)
  - **Sync conflict clarity** — distinct conflict reason when both sides changed; per-file stale list in alert + **Sync Status** command; pull report lists updated / conflicts / trash backups
  - Invoke path check uses real disk resolve (`.xaml` → `.lcs.json` remap) in validation + Properties checklist

### Changed
- Sync pill shows **Conflict · N** when both LCS and Studio Web diverged

## [0.7.1] — 2026-08-06

### Added
- **Light theme** for the designer — cool slate light chrome (not cream)
- **Theme toggle** (☀ / ☽) on the top-right toolbar; also **Settings → Appearance** (Auto / Light / Dark)
- Setting `lowcodeStudio.designerTheme` (persists with other designer prefs)

### Changed
- Minor UI polish: clearer panel/card borders, tip contrast, toolbar button borders and tooltips

## [0.6.55] — 2026-08-06

### Fixed
- **Studio Web–edited activities: select + edit Properties** (high priority)
  - Select by **object identity** (card click) so id mismatches no longer blank the panel while Delete still worked
  - Avoid full `renderAll` on every card click (was destroying the card mid-`pointerdown` and racing prop wiring)
  - **Delegated** property `input`/`change`/`blur` listeners — edits work even if Assist/VB wiring throws after paint
  - Sanitize non-string activity ids; coerce PascalCase / ExpressionText before paint

## [0.6.54] — 2026-08-06

### Fixed
- **Activity icons showing `$("`** — template-literal broke the `$(codicon)` strip regex; strip with `indexOf`/`slice` instead. Known icons keep ASCII badges (`LG`, `T`, …); unknown icons fall back to a **circle** (`●`)
- **Studio Web–reopened Properties** — never select/paint/edit detached orphans; soft-rematch by type/name/summary into the live tree; Excel/Orchestrator PascalCase aliases on migrate

### Added
- **Import map** — Excel/Orchestrator modern locals (`WriteDataTableToExcel`, `ReadCellValueX`, `BulkAddQueueItems`, `GetQueueItems`, `SetCredential`, …) map to catalog types (fewer `Imported.*`)

## [0.6.53] — 2026-08-06

### Fixed
- **Canvas icons** — replace emoji/● badges with ASCII labels (`LG`, `T`, `C`, …) that always paint in Electron webviews (emoji rendered as white circles)
- **Properties on Studio Web–reopened activities** — prop edits mutate the live tree node (`liveTreeNode` / `persistPropEdit`); stop preferring a detached click copy; migrate **raw** disk JSON on open so missing ids / PascalCase / Sequence wraps are written durably

## [0.6.52] — 2026-08-06

### Fixed
- **Workspace Explorer** — hide `.lcs-sync-trash` (and other dotfolders) from the designer Explorer panel
- **Activity / canvas icons** — paint system-font glyph badges only (codicon class on the wrapper made ☰/⏱ render as empty tofu squares)
- **Properties after Studio Save** — Save→pull reload uses full migrate path; setWorkflow rematches softly and calls `selectActivity` so Message/Level paint again

### Added
- **Home** button (⌂) on the designer top-right toolbar

## [0.6.51] — 2026-08-06

### Fixed
- **Activity icons actually visible** — restore always-on glyph badges (☰ / ⏱ / 💬 …); embed `codicon.ttf` as a `data:` font (webview URI fonts still failed in Cursor → empty colored squares). CSP allows `font-src data:`
- **Properties on card press** — select on `pointerdown` (draggable cards were eating `click`); optimistic `setSelectedNode` + paint props before full re-render so Studio Web activities show Message/Level immediately

## [0.6.50] — 2026-08-06

### Fixed
- **Activity icons in designer** — inject codicon CSS with a webview-safe `@font-face` URL for `codicon.ttf` (relative `./codicon.ttf` in linked CSS never loaded → empty colored squares in the Activities toolbox / canvas)
- **Properties after Studio Web Sync** — selection uses `idsEqual` + live node + DOM `data-id` recovery; Sync rematches by type/name/summary when ids rewrite; all selection writers go through `setSelectedNode`

## [0.6.49] — 2026-08-06

### Security
- Replaced SheetJS **`xlsx`** (high: prototype pollution + ReDoS; no upstream fix) with a minimal Config.xlsx OOXML bridge on **adm-zip** + **fast-xml-parser** already used by the extension — `npm audit` no longer reports the xlsx advisories

## [0.6.48] — 2026-08-06

### Fixed
- **Studio Web–edited activity Properties** — import now reads `VisualBasicValue` / `ExpressionText` (and Literals), so Message / Assign values from Studio Web Sync populate Properties instead of blank fields
- Properties paint coerces leftover expression objects (no more `[object Object]`)

### Changed
- Activities toolbox, canvas cards, flowchart nodes, and mini-map use the same **codicon** glyphs as the VS Code Activities tree (`media/codicons`)

## [0.6.47] — 2026-08-06

### Fixed
- **Studio Web activities** (added/changed in SW) — Properties, edits, and right-click work after Sync without reopen
  - Migrate/heal on Sync reload + pull write (ids, PascalCase, singleton Sequence unwrap)
  - Context menu / ⋯ pass live node; Properties paint from `selectedNode` when walkFind races
  - XAML import no longer drops Log Message / Build Data Table when a nested Sequence is present
  - Build Data Table maps `Columns` / `Result` / `DataTable` onto catalog props

## [0.6.46] — 2026-08-06

### Added
- **Studio Web sync alert** — when Studio Web has newer `.xaml` while the designer is open, a banner + VS Code toast offer **Sync now** (no close/reopen)
- Toolbar **↻ Sync** button (linked projects) pulls Studio Web → reloads the open designer in place
- Live watch of the linked solution folder + 4s status poll; sync pill shows In sync / Studio Web newer

### Fixed
- **Pull from Studio Web Local** command also reloads the open designer (was requiring close/reopen)

## [0.6.45] — 2026-08-06

### Fixed
- **Properties expand / collapse** — section headers toggle in place (no longer re-forced open on every re-render)
- **Existing activities** — selection id matching hardened; General + Activity open on select so Log Message / Build Data Table props and Delete work
- Find activity starts **collapsed** (⌕); opens in the same canvas-bar spot; Esc closes

### Changed
- Adding an activity no longer prefills variable bindings (`dt`, `result`, …) — create / pick variables yourself
- Hide `.lcs-sync-trash` from VS Code Explorer and Project Explorer

## [0.6.44] — 2026-08-06

### Fixed
- **Studio Web Properties (existing projects)** — on designer open, migrate `.lcs.json` on disk (heal missing ids, PascalCase props, unwrap singleton Sequence); selection uses live node refs so clicks always paint Properties — **no need to recreate in Studio Web**
- Right-click menu flips upward near the bottom of the canvas and scrolls if tall

### Changed
- Mini-map shows **#step + icon + name** (not color bars only); flowchart dots include a short label
- Activity column width **560 → 480** for more left/right canvas space

## [0.6.43] — 2026-08-06

### Fixed
- **Home** — Open Home focuses sidebar with retries and falls back to an editor-tab Home; title action opens the full Home tab
- **Studio Web activities** — missing activity `id`s are healed on parse/normalize/select so Properties work when clicking imported Log Message (etc.)
- Flowchart selection expands Properties (same as sequence cards)

### Changed
- **T5** — Fit + Align live in the canvas bar (not buried); Find ↑↓ stays next to search
- Expression expand dialog: head **✦ Assist** replaces Close (Cancel + Apply remain in the footer)

## [0.6.42] — 2026-08-06

### Added
- **T2 Invoke argument mapping** — row editor loads target workflow args; Add missing; Out/InOut XAML fidelity; Studio Web checklist for gaps
- **T6 Expression editor VB Assist** — inline propose → Apply repair inside the expand dialog
- **T5 Canvas navigation** — Fit ⤢ (content/selection), search ↑↓ next/prev, flowchart Align
- **Cleaner Assist popup** — compact Live filters (Selected/All · VB/Required/Selector), Scaffold examples under details, Help demoted to **?**

### Changed
- Arguments panel trims names and warns on duplicates

## [0.6.41] — 2026-08-06

### Added
- **Mini-map** under Properties (right panel) — sequence bars / flowchart dots; click to select + scroll
- **Activity icons** on canvas cards, flowchart nodes, Activities toolbox, and Insert palette (same catalog glyphs as the VS Code Activities tree)
- **Assist Live** (toolbar ✦) — real-time VB / required / selector proposals with **Apply** / **Apply all**
- **Assist Scaffold (F2)** tab — propose from description, then **Apply append** or **Apply replace** in the designer

## [0.6.40] — 2026-08-06

### Added
- **Deeper Studio Web import map** — Continue, Move/Rename File, Matches/IsMatch/Replace, Kill Process, Merge/Remove/Get/Update DataTable row helpers, Wait Queue Item, Get Credential, Send Hotkey / Keyboard Shortcuts (fewer `Imported.*`)

### Fixed
- Sync discovery **skips `.lcs-sync-trash`** (and editor/build junk) so trash backups never push into Studio Web as workflows
- `OPEN_IN_STUDIO_WEB_LOCAL.md` written **once** (not rewritten on every link/adopt)
- Adopt copies only Config assets into LCS (no README / `.gitignore` clutter)

## [0.6.39] — 2026-08-05

### Added
- **Home: recent projects** with Studio Web sync badges (In sync / Out of sync / Not linked)
- Variables / Arguments: compact row + **collapsed Default value** per item
- Properties: **VB repair banner** + Apply all when Assist detects JS-style expressions; red hints on expression fields (including leftover Studio Web keys)

### Fixed
- Clicking the **activity-bar icon** focuses Home (when the container was hidden)
- Studio Web–origin activities (e.g. Log Message `Message`/`Level`) normalize onto catalog keys so Properties + right-click / ⋯ work
- Save pull from Studio Web Local **reloads the open designer** via `setWorkflow`
- Flowchart nodes get ⋯ menu + reliable right-click → Properties

## [0.6.38] — 2026-08-05

### Added
- **Home Screen** — activity-bar Home webview + full-tab Home (open project, Studio Web, latest changes collapsed, next 5 steps)
- **Assist F2** — scaffold sequence from description; repair from dry-run trace
- New canvas/default settings: card summaries, compact cards, connectors, default zoom, open Home on startup
- Refreshed **logo** (`media/icon.png`, `media/logo.png`)

### Changed
- Variables / Arguments panels are compact **single-row** (name + type; args also show direction)
- Settings / Assist toolbar icons are slightly larger

## [0.6.37] — 2026-08-05

### Fixed
- **Activity context menu** no longer disappears immediately (right-click / ⋯) — ignored the trailing click that hid the menu
- **Properties** for unknown / `Imported.*` activities show editable raw fields; selecting a step re-opens a collapsed Properties panel
- **Drag & drop**: sequence cards can be reordered onto drop targets; failed drops toast instead of silent no-op; larger drop zones
- Imported unknown containers keep **Body** children when present

### Changed
- Slightly **narrower** activity column (560px) and flowchart nodes (156px)
- Each activity card has a **⋯** menu button (same actions as right-click)

## [0.6.36] — 2026-08-05

### Fixed
- **Open Studio Web Local Workspace solution** now **imports `.xaml` → `.lcs.json`** (creates a sibling `*.lcs` project when needed) instead of only adding the `.uipx` folder with no designer files
- Opening/linking an existing solution **prefers Studio Web content** (does not overwrite `.xaml` with an empty LCS project)
- **Main `.lcs.json` opens automatically** in the designer after Connect / Open solution

### Changed
- **Open Local Project** simplified to: Open folder (auto-detects LCS vs `.uipx`) or Create/link Studio Web Local Workspace

## [0.6.35] — 2026-08-05

### Added
- **Bidirectional Studio Web Local sync** — Save pulls Studio Web `.xaml` edits into `.lcs.json` when LCS did not change, then pushes; command **Pull from Studio Web Local Workspace**
- **`.lcs-sync-trash/`** — backups of overwritten `.lcs.json` / `.xaml` (last 10 sync generations)
- Content fingerprints on the link so Studio Web–newer workflows show in Project Explorer

### Fixed
- Editing in Studio Web Local then Saving in LCS no longer silently restores the older LCS version

## [0.6.34] — 2026-08-05

### Fixed
- Full Studio Web Portable audit of the activity catalog:
  - **Multiple Assign** → Sequence of Assign; **Message Box** → Log Message
  - **Delete File**, **Excel Application Scope**, **Python.*** → Comment placeholders (Windows-only / not cross-platform)
  - **Open Application** → `NApplicationCard`+`TargetApp` (never fake `NOpenApplication`)
  - **Element Exists / Wait Element** → modern `NCheckState` (not classic tags in `uia:` ns)
  - **Type Into** → `EmptyFieldMode` (bool `EmptyField` broke Studio Web load)
  - **FlowSwitch** in Sequence export → `Switch`; **Read/Write CSV** emit FilePath/DataTable

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
