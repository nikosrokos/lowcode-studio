# LowCode Studio — Roadmap

**Goal:** Make LowCode Studio the place you **design, test, and iterate** most RPA work — so you choose it over Studio Web for the daily loop — while **every solution stays continuously synced with Studio Web Local Workspace as-is** (Portable `.uipx` / `.xaml` on disk). Studio Web remains the path to **publish / Orchestrator**, not the place you finish ordinary workflow work.

> Living document. Priorities follow real end-to-end friction (designer → dry-run → Save sync → open in Studio Web → publish). Version at time of writing: **0.6.42**.

---

## Milestone (0.6.42)

We have a credible Mac-first Studio loop:

| Layer | Status |
|---|---|
| Designer UX | Sequence + Flowchart, Maestro frames/dock, mini-map, icons, Fit/Find/Align, Home |
| Assist | F0–F4 + compact Live/Scaffold popup + expr VB Assist + Invoke mapping UI |
| Sync | Studio Web Local Workspace ↔ Save, adopt/open, leaner sync footprint |
| Catalog / import | Core UI / data / HTTP / REF + deeper import map (fewer `Imported.*`) |
| Dry-run | Scenarios (Shift+F5), step-through, fixtures, opt-in real HTTP/Python |

**Next chapter is not “more features in isolation”** — it is **end-to-end UX**: fewer reasons to leave LCS, and zero surprise when Studio Web opens the same solution.

---

## North star

| Today (good) | Target (choose LCS) |
|---|---|
| Design in LCS → sometimes finish gaps in Studio Web → publish | Design + dry-run + validate in LCS → **Save sync** → publish in Studio Web |
| Local Workspace linked; Save pushes Portable XAML | **Always** the same solution folder Studio Web already has — bidirectional, no parallel “export copy” |
| Assist helps on the selected activity | Assist feels like a **real-time co-pilot** across the open project |
| Selectors / VB / required props guided in Properties | The workflow feels **publish-ready** before first Studio Web open |
| Dry-run strong for data/API; UI simulated | Honest simulation + clearer “ready for Windows robot” checklist |

Studio Desktop / Windows robots remain the home for deep desktop UI, Citrix, and some package-only activities — LCS should make that handoff **checklist-clear**, not surprising.

---

## Hard constraint: Local Workspace as-is

These are non-negotiable for every roadmap item:

1. **One solution on disk** — LCS project ↔ Studio Web Local Workspace folder (`.uipx` + Portable project). No second “publish-only” tree as the default path.
2. **Save = sync** — editing in LCS updates what Studio Web already has open; pull/reload keeps the designer honest.
3. **Round-trip fidelity** — prefer activities and properties that **import and export cleanly**; shrinking `Imported.*` beats catalog vanity.
4. **Portable by default** for Mac Studio Web; Windows-target remains an explicit legacy / Desktop-robot path.
5. **Never break open-in-Studio-Web** — sync must not push trash, editor junk, or LCS-only clutter that confuses Local Workspace.

If a feature cannot survive “open the same folder in Studio Web after Save,” it is not done.

---

## Principles

1. **LCS-first daily path** — anything that forces a Studio Web round-trip for a routine edit is a bug or a roadmap item.
2. **E2E over surface area** — optimize the loop (open project → edit → Assist → dry-run → Save → publish), not isolated panels.
3. **Honest dry-run** — never pretend a stub is a robot; surface *simulated* clearly; grow real runners carefully.
4. **Export fidelity over catalog vanity** — better 80 well-exported activities than 200 half-mapped `Imported.*`.
5. **Mac design-time, Windows capture** — bridge with builder UX, validation, and optional remote indicate later.
6. **Assist is deterministic first** — propose → Apply; no Autopilot theater that writes without confirmation.

---

## What already works (keep investing)

- Sequence + Flowchart designer, Maestro-style frames / dock, **mini-map**, canvas **activity icons**
- Home screen, recent projects, sync badges
- REFramework scaffold, scenarios (Shift+F5), blueprints
- Studio Web **Local Workspace** (Portable) + Save ↔ sync, adopt/open, lean sync rules
- UI Automation core + Selector Builder + Windows TODO
- Config.json ↔ Config.xlsx, package validation / Manage Packages
- Arguments & variables panels (compact), Cmd+K palette, Input Method
- Assist F0–F4 + **Live / Scaffold** propose→Apply in designer
- Opt-in real HTTP / Python dry-run runners

---

## Theme 1 — End-to-end daily path (highest priority)

Make “I never needed Studio Web until publish” the default experience.

### T1. Multi-file project flow
- Project tree as the hub: open, rename, duplicate, reveal-in-Studio-Web-folder
- Cross-file navigation (Invoke → jump; missing path warnings)
- **Bulk Assist** across the open project (VB pass, empty required, weak selectors) with propose → Apply
- Keep explorer / designer / Local Workspace paths aligned (one mental model)

### T2. Workflow contracts — **partially shipped (0.6.42)**
- **Arguments** polish: clear In/Out/InOut editing, defaults, duplicate-name warning — **shipped**
- **Invoke Workflow** argument mapping UI + Out/InOut XAML export/import — **shipped**
- Cross-workflow chips (“missing Out: …”) in Invoke checklist — **shipped**; project-wide gate still T3

### T3. Publish-ready gate in LCS
- One command / dock action: **Ready for Studio Web?** (packages, Portable, selectors, required props, `Imported.*`, Windows TODO)
- Surface the same issues Assist Live already finds — project-wide, with Apply all where safe
- After green gate: **Reveal Local Workspace** / open Studio Web is a publish step, not a repair step

### T4. Sync UX that disappears
- Clearer In sync / Out of sync / conflict when Studio Web edited the same `.xaml`
- Pull → designer reload already exists — deepen conflict copy and “what changed”
- Zero surprise files in the `.uipx` folder (continue lean sync discipline)

---

## Theme 2 — Designer UX that beats Studio Web for editing

### T5. Canvas & navigation — **shipped core (0.6.41–0.6.42)**
- Mini-map — **shipped**
- Fit content / selection (⤢), zoom-to-activity on search — **shipped**
- Search-in-workflow next/prev (↑↓ / Enter) — **shipped**
- Flowchart Align to selection — **shipped**; deeper distribute later
- Breadcrumbs for nested containers — keep investing
- Clearer drop ghosts / reorder affordances

### T6. Properties & expressions — **partially shipped (0.6.42)**
- Expression editor with **VB Assist inline** (propose → Apply in dialog) — **shipped**
- Typed editors (DataTable columns, dictionary, secret-as-variable) — later
- “Required for Studio Web” checklist — **shipped**; keep tying it to T3 gate

### T7. Onboarding & empty states
- First-run wizard — **shipped**; tighten copy around Local Workspace as the only ship path
- Empty canvas / empty project CTAs that push blueprint → scenario → Connect (not “explore menus”)

---

## Theme 3 — Catalog & fidelity (so you don’t add steps in Studio Web)

### T8. Import / export map — **ongoing (0.6.29 → 0.6.40+)**
- Keep shrinking `Imported.*` for the next Studio Web–common set (Integration Service / Testing / mail variants)
- Preserve more properties on round-trip (HTTP auth/headers, Excel modern fields, UI modern)
- Flowchart multi-branch / FlowSwitch case editor parity in props

### T9. Activities you’d otherwise add in Studio Web
- Orchestrator / REF depth (queue/asset property parity + scenario fixtures)
- Excel Application Scope / modern Excel parity Studio Web accepts
- Parallel / Retry / Timeout where mappable (honest dry-run warnings)
- Testing pack design-time maps so pinned packages aren’t empty

---

## Theme 4 — Run & debug without leaving Cursor

### T10. Dry-run 2.0
- Breakpoints / run-to-here beyond step-through
- Watch panel editable mid-run for scenarios
- Fixture library UI (HTTP, selectors, tables)
- Per-activity badge: `simulated` | `real` | `unsupported`

### T11. Traces → Assist
- Structured run log; jump to failing activity + props
- Failed dry-run → Live proposals (already started with F2 repair) — make it one click from the dock

---

## Theme 5 — Assist as real-time co-pilot

Deterministic, propose→Apply. **F0–F4 + Live/Scaffold shipped through 0.6.41.**

### T12. Deeper Assist UX — **popup UX shipped (0.6.42)**
- Compact Assist dialog (Live filters, Scaffold examples, Help as ?) — **shipped**
- Richer F2 scaffolds (containers / branches / nested Use Browser from description)
- Multi-file scaffold + project-wide VB / selector pass
- Assist results that respect Local Workspace sync (never emit LCS-only types that become `Imported.*` after Save)
- Optional later: constrained LLM *behind* the same propose→Apply contract (not free-form chat edits)

---

## Theme 6 — Ship closer to Orchestrator

### T13. Publish path
- Documented one-click “Open / reveal Local Workspace for publish”
- Longer-term: Orchestrator publish API if UiPath exposes a Mac-friendly path (**explore; don’t promise**)

### T14. Packages & targets
- Manage Packages — **shipped**; keep Studio Web–compatible version ranges honest
- Portable vs Windows switcher with consequences explained; never silently break Mac Local Workspace

---

## Explicit non-goals (for now)

| Not prioritizing | Why |
|---|---|
| Full Studio Desktop feature parity | Windows-only surface (Citrix, deep UI Explorer, coded workflows) |
| Replacing Maestro `.flow` | Separate UiPath product; LCS stays classic workflow / REF |
| Guaranteeing robot-identical dry-run for all UI | Needs Windows robot / Studio; LCS remains design + simulate |
| A second sync format beside Local Workspace | Local Workspace **as-is** is the product contract |
| Marketplace publisher before fidelity | Nice later; round-trip + E2E UX first |

---

## Suggested sequencing (impact × fit)

```
T3  Ready-for-Studio-Web gate           ← E2E confidence before publish
T1  Multi-file / project-wide Assist    ← daily-path speed
T4  Sync conflict clarity               ← trust Local Workspace as-is
T8  Next import-map slice               ← fewer Imported.* (**0.6.54**: Excel/Orch modern locals)
T10 Dry-run breakpoints + watch         ← stay in Cursor to verify
T12 Richer scaffolds / multi-file F2    ← Assist depth
T9  Excel / Orchestrator parity         ← fewer Studio Web activity adds (**0.6.54**: import aliases + prop PascalCase)
T13 Publish reveal / deep link          ← last mile
T6  Typed property editors              ← remaining expression UX
```

Shipped recently: T2 Invoke mapping · T5 Fit/Find/Align · T6 VB in expr editor · Assist popup cleanup (0.6.42)

---

## Success metrics (practical)

- **Hours in LCS before first Studio Web open** ↑
- **Save → open same Local Workspace in Studio Web** with zero XAML parse errors ↑
- **Edits made only to finish work in Studio Web** (per project) ↓
- **`Imported.*` / Comment placeholders** per imported Main ↓
- **Placeholder / weak selectors** left at Connect ↓
- **Scenario dry-runs** used as gate before publish ↑
- **Ready-for-Studio-Web gate** green rate before Reveal ↑

---

## How to use this doc

- Prefer **one Theme 1 (E2E daily path) item** per release when possible.
- Pair every new activity with: catalog · dry-run · XAML import · XAML export · package pin · **Local Workspace round-trip test**.
- Never land a feature that invents a parallel ship path around Local Workspace.
- Update this file when a theme item ships (move under “What already works” or mark **shipped**).
