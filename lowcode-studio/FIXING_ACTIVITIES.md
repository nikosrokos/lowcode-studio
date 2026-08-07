# Fixing / adding activities in the XAML ⇄ LCS pipeline

Method for finding and fixing bugs in this pipeline, repeatable for any broken
or new activity. Every fix must come from comparing against a **real XAML file
exported by UiPath Studio** (Web or Desktop) — never from assumption. (Studio
projects only — no VSCode extension in this workflow.)

## The three files

| File | Owns |
|---|---|
| `activities.ts` | Catalog: an activity's properties, shown in the properties panel |
| `activityMap.ts` | XAML tag → `lcsType` mapping for **generic** activities routed through `xamlInfoForLcsType()` |
| `xamlExport.ts` / `xamlImport.ts` | Convert activity tree ⇄ XAML. Most UI Automation / Excel / Queue activities have **hand-written `render*`/parse functions that bypass `activityMap.ts` entirely** — check here first |

Fixing `activityMap.ts` alone won't fix UI Automation, Excel, or Queue
activities — `xamlExport.ts`/`xamlImport.ts` hardcode their shapes directly.

## Diagnosing a broken activity

1. **Get a real sample.** In Studio, build a throwaway workflow with just the
   activity (plus any required container, e.g. Use Application/Browser).
   Export the `.xaml`.
2. **Find the real tag + namespace prefix.** Cross-check the prefix against
   `xmlns:` declarations — don't assume the prefix implies the namespace
   (see surprises below).
3. **Check the export side.** Find the `lcsType` in `xamlExport.ts`: either a
   dedicated `render*` function (diff every attribute against the sample) or
   the generic path (check `activityMap.ts`'s `exportName`). Confirm: flat
   attribute vs. nested property element, `ScopeIdentifier` if scoped, exact
   enum spelling.
4. **Check the import side.** Find the same `lcsType`/local name in
   `xamlImport.ts` (`pickCommonProps` or a dedicated `if` block). Confirm it
   reads the attribute name that actually exists on the real activity.
5. **Check for the `ActivityAction` wrapper** if the activity is a container:
   ```xml
   <SomeContainer.Body>
     <ActivityAction x:TypeArguments="x:Object">
       <ActivityAction.Argument>
         <DelegateInArgument x:TypeArguments="x:Object" Name="..." />
       </ActivityAction.Argument>
       <Sequence><!-- real children --></Sequence>
     </ActivityAction>
   </SomeContainer.Body>
   ```
   Used by `ForEach`, `NApplicationCard`, `RetryScope`, `TimeoutScope`,
   `ParallelForEach`, `Catch`. `collectActivities()` already unwraps bare
   `ActivityAction`/`Catch` — pass the whole `.Body` node into it rather than
   reading children directly.
6. **Round-trip test.** Export → compare to real sample. Import that XAML →
   confirm same properties. Check both directions; bugs have broken only one.

## Surprises found (don't assume safe elsewhere)

- **Namespace prefixes aren't descriptive.** `UI.*` activities use `uix:`,
  not `uia:` (invented, doesn't exist). `Excel.*` use plain `ui:` — there's
  no `excel:` namespace despite a separate `UiPath.Excel.Activities` assembly.
  Always confirm from a sample.
- **Property names don't match guesses.** Add Queue Item's queue field is
  `QueueType`, not `QueueName`. `BuildDataTable` has no `Columns` property —
  schema lives in `TableInfo` (embedded ADO.NET XSD string).
- **"Simple" properties can be nested structures.** `ItemInformation` (Add
  Queue Item) is a dictionary of `InArgument` elements. Click's selector is a
  nested `.Target` > `TargetAnchorable` with ~10 sub-properties.
- **Modern activities may want typed resources.** Modern `ReadRange` takes
  `WorkbookPathResource` (`IResource`), not a plain `WorkbookPath` string —
  only shows up when the path comes from a variable.
- **Scoped activities need it declared.** A `Click` inside Use
  Application/Browser needs `ScopeIdentifier="<card's ScopeGuid>"` and
  `HealingAgentBehavior="SameAsCard"`.

## Adding a new activity type

1. Add it to `activities.ts` (drives the properties panel).
2. Get a real XAML sample **before** writing any parsing code.
3. Decide: generic path (add to `activityMap.ts`'s `MAP`) or custom (dedicated
   case in both `xamlExport.ts`/`xamlImport.ts`, following a similar existing
   activity, e.g. `renderExcelActivity`).
4. If a container, handle the `ActivityAction` wrapper (see above).
5. Round-trip test before calling it done.

## Unverified areas (flagged, not yet confirmed against a real sample)

- `Messaging.SendEmail`/`mail:` namespace — plausibly just `ui:` like Excel,
  unconfirmed.
- `Python.*` (`python:` namespace) — plausibly genuine, unconfirmed.
- `Excel.WriteRange`, `AppendRange`, `ReadCell`, `WriteCell`,
  `ExcelApplicationScope` — namespace confirmed (`ui:`), attribute shapes not
  diffed. `WriteRange`/`AppendRange` likely share `ReadRange`'s
  `WorkbookPathResource` question.
- `UI.WaitElement` — no confirmed modern (`N*`) equivalent; may not work in a
  modern-only solution.
- `UI.SendHotkey`'s `Shortcuts` attribute shape (list vs. string) — not
  diffed.
- `TryCatch` always round-trips as `System.Exception`; typed catch clauses
  aren't preserved.
- Anything outside the four reviewed samples (Use Application/Browser, Click,
  Add Queue Item, Log Message, If, TryCatch, Delay, ReadRange, Assign,
  WriteLine) — treat as unverified until checked.
