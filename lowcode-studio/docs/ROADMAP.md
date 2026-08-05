# LowCode Studio — Roadmap

**Goal:** Make LowCode Studio the place you **design, test, and iterate** most RPA work on Mac — with Studio Web used mainly to **publish / Orchestrator**, not to finish the workflow.

> Living document. Priorities shift with real Studio Web round-trip pain. Version at time of writing: **0.6.21**.

---

## North star

| Today | Target |
|---|---|
| Design in LCS → fix selectors / gaps in Studio Web → publish | Design + dry-run + validate in LCS → **one Save sync** → publish in Studio Web |
| ~59 activities, best-effort XAML | Cover the **80% REF / browser / Excel / API** set with faithful export |
| Selectors typed by hand | Selectors that feel **done** before leave LCS (builder + validation + optional remote capture) |
| Dry-run stubs for UI/Python/code | Stronger local simulation + optional real runners where Mac allows |

Studio Desktop / Windows robots remain the home for deep desktop UI, Citrix, and some package-only activities — LCS should make that handoff **checklist-clear**, not surprising.

---

## What already works (keep investing)

- Sequence + Flowchart designer, Maestro-style frames / dock
- REFramework scaffold, scenarios (Shift+F5), blueprints
- Studio Web **Local Workspace** (Portable) + Save → `.xaml` sync
- UI Automation core (Use Application/Browser, Click, Type, GetText, Extract Table…) + Selector Builder
- Config.json ↔ Config.xlsx, package validation, `WINDOWS_TODO.md`
- Custom activity stubs, Cmd+K palette, Input Method

---

## Principles

1. **LCS-first loop** — anything that forces a Studio Web round-trip for a routine edit is a bug or a roadmap item.
2. **Honest dry-run** — never pretend a stub is a robot; surface *simulated* clearly; grow real runners carefully.
3. **Export fidelity over catalog vanity** — better 80 well-exported activities than 200 half-mapped `Imported.*`.
4. **Portable by default** for Mac Studio Web; Windows path stays explicit for Desktop robots.
5. **Mac design-time, Windows capture** — bridge the gap with builder UX, validation, and optional remote indicate.

---

## Phase A — “Stay in LCS for the daily path”

Highest leverage for *not opening Studio Web to finish work*.

### A1. Workflow contracts
- **Arguments panel** (In/Out/InOut) in designer — model already has `WorkflowArgument`; wire UI + XAML export/import
- **Invoke Workflow** argument mapping (today: path only → bare `InvokeWorkflowFile`)
- Cross-workflow argument chips / validation (“missing Out: `out_TransactionItem`”)

### A2. Import / export fidelity
- Shrink `Imported.*` → real LCS types for top Studio Web activities
- Preserve more properties on round-trip (HTTP, Excel, UI modern fields)
- Flowchart: FlowSwitch / multi-branch fidelity; fewer Comment placeholders
- Keep Studio Web-only triggers out of designer (already partially done)

### A3. Selectors that ship — **shipped in 0.6.27**
- Stronger Selector Builder: specificity score, Decode paste, copy from sibling
- Inline validation + Windows TODO messages on canvas cards
- Validate / Packages / Connect surface Windows TODO in Output
- Paste helper for UI Explorer / `#id` / embedded classic (modern blob: best-effort extract)
- Still later: richer modern FullSelectorEncoding decode; remote Indicate Element bridge

### A3 (historical notes)
- Document clear Mac browser vs Windows desktop selector paths (partially in builder hint)

### A4. Project explorer as the hub
- Multi-file edit without friction (tabs already VS Code — deepen LCS project tree actions)
- Diff / “out of sync with Local Workspace” badge — **shipped in 0.6.28**
- One-click Validate + Windows TODO + package check from explorer (Validate Packages + Manage Packages)

---

## Phase B — “Activities you’d otherwise add in Studio Web”

### B1. Orchestrator / REF depth
- Get Transaction Item / Add Queue Item / Get Asset / Set Asset (design + dry-run fixtures)
- Set Transaction Status already present — align properties with Studio
- Queue-based REF blueprints with scenario fixtures for queue items

### B2. Excel & data (Studio Web common set)
- Excel Application Scope (or modern Excel equivalent that Studio Web accepts)
- Read/Write Range property parity; Append; filters
- DataTable activities already strong — fill gaps (Join, Lookup, Sort) if export maps cleanly

### B3. Control flow & structure
- Parallel / Parallel For Each (even if dry-run is sequential with a warning)
- Switch / FlowSwitch full case editor in props
- Retry Scope property parity; Timeout Scope if mappable

### B4. Messaging & integrations
- HTTP Request auth / headers / status handling in props + dry-run
- Mail: richer Send Mail / Get Outlook-equivalent portable activities Studio Web supports
- Deserialize/Serialize already there — add JSON Path / JObject helpers if useful

### B5. Testing pack (design-time)
- Map key `UiPath.Testing.Activities` (Verify Expression, etc.) so pinned package isn’t empty
- Bridge scenarios.json ↔ something Studio Test Cases can consume (even one-way export)

---

## Phase C — “Run & debug without leaving Cursor”

### C1. Dry-run 2.0
- Breakpoints / run-to-here (beyond step-through)
- Variable watch panel (editable mid-run for scenarios)
- Fixture library UI (HTTP, UI selectors, tables) instead of only JSON
- Clear per-activity: `simulated` | `real` | `unsupported`

### C2. Real local runners (Mac-capable)
- Real HTTP in dry-run (opt-in)
- Real Python via local interpreter when Python Scope path is set
- Optional headless browser smoke for Click/Type/GetText against a URL (experimental; not UiPath robot)

### C3. Logs & traces
- Structured run log exportable to Studio Web / text
- Highlight failing activity + jump to props (already partial) + suggested fix chips

---

## Phase D — “UI / UX that feels like Maestro + Studio”

### D1. Canvas
- Mini-map / fit selection; tidy / align for flowchart
- Search-in-workflow (“find Log Message”)
- Breadcrumbs for nested containers (Use App / If / Try)
- Drag to reorder with clearer drop ghosts (sequence already has spine — refine)

### D2. Properties
- Expression editor (larger, expand dialog — Maestro pattern)
- Typed editors (DataTable columns, dictionary, secret-as-variable)
- “Required for Studio Web” checklist per selected activity — **shipped in 0.6.28**

### D3. Onboarding
- First-run: Create REF → Dry Run scenario → Connect Local Workspace wizard — **shipped in 0.6.28**
- In-product tips tied to `WINDOWS_TODO` / Portable

### D4. Visual system
- Keep Maestro dock / frames; refine empty states, icons, density
- Light/dark polish vs VS Code theme tokens
- Accessibility: keyboard path for dock + float frames

---

## Phase E — “Ship closer to Orchestrator”

### E1. Publish path
- Documented one-click “Open in Studio Web to publish” (deep link / reveal)
- Longer-term: Orchestrator publish API if UiPath exposes a Mac-friendly path (explore; don’t promise)

### E2. Packages
- UI to add/remove NuGet deps with Studio Web–compatible versions — **Manage Packages in 0.6.28**
- Warn on default `[1.0.0]` pins and unknown custom packages — **shipped in 0.6.28**

### E3. Dual target clarity
- Portable (Studio Web Mac) vs Windows (Desktop robot) switcher with consequences explained
- Generate both artifacts when needed without confusing Local Workspace

---

## Phase F — “Assist (AI) — greenfield”

Only after A–C foundations; avoid Autopilot theater.

- Generate sequence from natural language → LCS activities (constrained to catalog)
- Suggest selectors / repair placeholders from page HTML snippet or failed dry-run
- Scenario generator from Process description
- “Explain this workflow” / “why Studio Web will reject this Save”

---

## Explicit non-goals (for now)

| Not prioritizing | Why |
|---|---|
| Full Studio Desktop feature parity | Windows-only surface area (Citrix, deep UI Explorer, coded workflows) |
| Replacing Maestro `.flow` | Separate UiPath product; LCS stays classic workflow / REF |
| Guaranteeing robot-identical dry-run for all UI | Needs Windows robot / Studio; LCS remains design + simulate |
| Marketplace publisher | Nice later; fidelity first |

---

## Suggested sequencing (impact × fit)

```
A1 Arguments + Invoke mapping
A2 Import map shrink (Imported.*)
A3 Selector validation in-canvas
B1 Orchestrator queue/asset activities
B2 Excel Scope / parity
C1 Dry-run breakpoints + watch
D2 Expression editor
E2 Package UI
C2 Optional real HTTP/Python
F  Assist (after catalog + contracts solid)
```

---

## Success metrics (practical)

- **Hours in LCS before first Studio Web open** ↑
- **Save → Studio Web open** with zero XAML parse errors ↑
- **`Imported.*` / Comment placeholders** per imported Main ↓
- **Placeholder selectors** left at Connect ↓
- **Scenario dry-runs** used as gate before Connect ↑

---

## How to use this doc

- Pick **one Phase A item** per release when possible — daily-path friction first.
- Pair every new activity with: catalog entry · dry-run behavior · XAML import · XAML export · package pin · test.
- Update this file when a phase item ships (move to “What already works” or strike through).
