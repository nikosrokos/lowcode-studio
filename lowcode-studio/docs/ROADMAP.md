# LowCode Studio — Roadmap

**Goal:** Design, test, and iterate most RPA work in LowCode Studio — then **Save sync** into Studio Web Local Workspace for publish / Orchestrator. Studio Web is the ship path, not the daily editor.

> Living document · current product version **0.7.1**

---

## Where we are (0.7.1)

| Layer | Status |
|---|---|
| Designer | Sequence + Flowchart, Maestro frames/dock, mini-map, Fit/Find/Align, Home, **light/dark/auto theme** |
| Properties / SW reopen | Select + edit after Studio Web Sync (ids, PascalCase, ExpressionText, delegated editors) |
| Assist | F0–F4 + Live/Scaffold popup + expr VB Assist + Invoke argument mapping |
| Sync | Local Workspace ↔ Save, adopt/open, sync banner/pull, lean footprint |
| Catalog / import | Core UI / data / HTTP / REF / Excel / Orchestrator maps (fewer `Imported.*`) |
| Dry-run | Scenarios (Shift+F5), step-through, fixtures, opt-in real HTTP/Python |

**Next chapter:** end-to-end confidence — fewer reasons to leave LCS before publish, and zero surprise when Studio Web opens the same folder.

---

## Hard constraint: Local Workspace as-is

1. **One solution on disk** — LCS ↔ Studio Web Local Workspace (`.uipx` + Portable). No parallel “export-only” tree as the default.
2. **Save = sync** — LCS edits update what Studio Web already has; pull keeps the designer honest.
3. **Round-trip fidelity** — shrink `Imported.*`; prefer activities that import and export cleanly.
4. **Portable by default** on Mac; Windows-target is explicit.
5. **Never break open-in-Studio-Web** — no trash, editor junk, or LCS-only clutter in the synced folder.

---

## Shipped (do not re-plan)

Already in product — keep investing only as polish, not as roadmap themes:

- Sequence + Flowchart, Maestro frames / dock, mini-map, Fit / Find / Align, breadcrumbs, Home
- Designer **Appearance**: Auto / Light / Dark + toolbar ☀/☽ toggle
- Arguments / variables panels; Invoke Workflow mapping UI + Out/InOut XAML
- Expression editor with VB Assist; “Required for Studio Web” checklist; Selector Builder
- Assist F0–F4 + Live / Scaffold propose→Apply
- Studio Web Local Workspace sync (Save, pull, adopt, conflict trash)
- REFramework scaffold, scenarios, blueprints, package validation / Manage Packages
- Deeper import map (file I/O, Excel/Orch modern locals, UI / data / HTTP / REF)
- Opt-in real HTTP / Python dry-run runners; Windows TODO surface

---

## Open backlog

### Theme 1 — End-to-end daily path (highest priority)

#### T1. Multi-file project flow
- Project tree hub: rename, duplicate, reveal-in-Studio-Web-folder
- Cross-file navigation (Invoke → jump; missing path warnings)
- **Bulk Assist** across the open project (VB, empty required, weak selectors) with propose → Apply

#### T3. Publish-ready gate
- One command / dock action: **Ready for Studio Web?** (packages, Portable, selectors, required props, `Imported.*`, Windows TODO)
- Project-wide surface of Assist Live issues + Apply all where safe
- After green: Reveal Local Workspace / open Studio Web is publish, not repair

#### T4. Sync conflict clarity
- Clearer In sync / Out of sync / conflict when Studio Web edited the same `.xaml`
- Deeper conflict copy and “what changed” after pull
- Keep lean sync discipline (zero surprise files in `.uipx`)

---

### Theme 2 — Designer editing depth

#### T5. Canvas polish (remaining)
- Flowchart distribute / deeper align
- Clearer drop ghosts / reorder affordances
- Nested container breadcrumbs keep investing

#### T6. Typed property editors
- DataTable columns, dictionary, secret-as-variable editors
- Keep tying “Required for Studio Web” into T3 gate

#### T7. Onboarding copy
- Tighten first-run / empty canvas around Local Workspace as the only ship path
- Empty CTAs: blueprint → scenario → Connect (not “explore menus”)

---

### Theme 3 — Catalog & fidelity

#### T8. Next import-map slice
- Integration Service / Testing / mail variants (fewer `Imported.*`)
- Preserve more properties on round-trip (HTTP auth/headers, Excel modern, UI modern)
- FlowSwitch case editor parity in Properties

#### T9. Activities you’d otherwise add in Studio Web
- Orchestrator / REF depth (queue/asset property parity + scenario fixtures)
- Excel Application Scope / modern Excel parity Studio Web accepts
- Parallel / Retry / Timeout where mappable (honest dry-run warnings)
- Testing pack design-time maps so pinned packages aren’t empty

---

### Theme 4 — Run & debug in Cursor

#### T10. Dry-run 2.0
- Breakpoints / run-to-here beyond step-through
- Watch panel editable mid-run for scenarios
- Fixture library UI (HTTP, selectors, tables)
- Per-activity badge: `simulated` | `real` | `unsupported`

#### T11. Traces → Assist
- Structured run log; jump to failing activity + props
- Failed dry-run → Live proposals in one click from the dock

---

### Theme 5 — Assist depth

#### T12. Richer Assist
- Richer F2 scaffolds (containers / branches / nested Use Browser from description)
- Multi-file scaffold + project-wide VB / selector pass
- Never emit LCS-only types that become `Imported.*` after Save
- Optional later: constrained LLM behind the same propose→Apply contract

---

### Theme 6 — Closer to Orchestrator

#### T13. Publish path
- One-click “Open / reveal Local Workspace for publish”
- Longer-term: Orchestrator publish API if UiPath exposes a Mac-friendly path (**explore; don’t promise**)

#### T14. Packages & targets
- Keep Studio Web–compatible version ranges honest
- Portable vs Windows switcher with consequences explained

---

## Suggested next (impact × fit)

```
T3   Ready-for-Studio-Web gate        ← E2E confidence before publish
T1   Multi-file / project-wide Assist ← daily-path speed
T4   Sync conflict clarity            ← trust Local Workspace as-is
T10  Dry-run breakpoints + watch      ← stay in Cursor to verify
T12  Richer scaffolds / multi-file F2 ← Assist depth
T8   Next import-map slice            ← fewer Imported.*
T9   Excel / Orchestrator depth       ← fewer Studio Web activity adds
T13  Publish reveal / deep link       ← last mile
T6   Typed property editors           ← remaining expression UX
```

---

## Non-goals (for now)

| Not prioritizing | Why |
|---|---|
| Full Studio Desktop parity | Windows-only (Citrix, deep UI Explorer, coded workflows) |
| Replacing Maestro `.flow` | Separate product; LCS stays classic workflow / REF |
| Robot-identical dry-run for all UI | Needs Windows robot; LCS = design + simulate |
| A second sync format | Local Workspace **as-is** is the contract |
| Marketplace before fidelity | Round-trip + E2E UX first |

---

## Success metrics

- Hours in LCS before first Studio Web open ↑
- Save → open same Local Workspace with zero XAML parse errors ↑
- Edits finished only in Studio Web (per project) ↓
- `Imported.*` / Comment placeholders per imported Main ↓
- Placeholder / weak selectors left at Connect ↓
- Scenario dry-runs used as gate before publish ↑
- Ready-for-Studio-Web gate green rate before Reveal ↑

---

## How to use this doc

- Prefer **one Theme 1 item** per release when possible.
- Pair every new activity with: catalog · dry-run · XAML import · XAML export · package pin · Local Workspace round-trip test.
- Never invent a ship path around Local Workspace.
- When something ships: move it under **Shipped**, drop it from Open backlog, refresh the sequencing list.
