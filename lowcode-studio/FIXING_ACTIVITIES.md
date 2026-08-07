# Fixing / adding activities in the XAML ⇄ LCS pipeline

This is the method we used to find and fix every bug in this session, written up
so you can repeat it yourself for any activity that's still broken, or any new
activity you add to the catalog later. It doesn't require guessing — every fix
in this session came from comparing against a **real XAML file exported by actual
UiPath Studio Web**, never from assumption.

## The three files involved, and what each owns

| File | Owns |
|---|---|
| `activities.ts` | The catalog: what properties an activity has, shown in the properties panel |
| `activityMap.ts` | Which XAML tag name(s) map to which `lcsType`, for **generic** activities that go through the shared `xamlInfoForLcsType()` path |
| `xamlExport.ts` | Turns an in-memory activity tree into XAML text. Most UI Automation / Excel / Queue activities have **hand-written render functions here that bypass `activityMap.ts` entirely** — check here first |
| `xamlImport.ts` | Turns XAML text into the in-memory activity tree (`.lcs.json`). Has matching hand-written parsing per activity |

**Important:** fixing `activityMap.ts` alone does *not* fix UI Automation, Excel,
or Queue activities, because `xamlExport.ts` hardcodes their tag names and
attribute shapes directly instead of calling `xamlInfoForLcsType()`. Always check
`xamlExport.ts`/`xamlImport.ts` for a dedicated `render*`/parsing function for
the activity type before assuming `activityMap.ts` is the fix.

## Step-by-step: diagnosing one broken activity

### 1. Get a real sample
In actual UiPath Studio (Desktop or Web), build a tiny throwaway workflow
containing just the one activity you're debugging (plus whatever container it
needs, e.g. inside a Use Application/Browser card if that's relevant). Export/
download the `.xaml`. This is non-negotiable — UiPath's activity schemas are
full of surprises (see "Surprises we found" below) and guessing wastes more
time than it saves.

### 2. Find the real tag name and namespace prefix
Look at the opening tag, e.g. `<uix:NClick ...>` or `<ui:ReadRange ...>`.
Cross-reference the prefix against the `xmlns:` declarations at the top of the
file — **don't assume the prefix means what it looks like it means** (see the
`uia`/`uix` and `excel`/`ui` surprises below).

### 3. Check the export side
Search `xamlExport.ts` for the `lcsType` (e.g. `'UI.Click'`) or the real XAML
local name. You'll land on one of:
- A dedicated `render*` function (most UI Automation / Excel / Queue types) —
  compare every attribute it emits against your real sample, one by one.
- The generic `xamlInfoForLcsType()` path — check `activityMap.ts`'s
  `exportName` for that `lcsType` instead.

Diff every attribute name AND value shape:
- Is it a flat attribute (`Selector="..."`) or a nested property element
  (`<uix:NClick.Target><uix:TargetAnchorable .../></uix:NClick.Target>`)?
- Does it need a `ScopeIdentifier` because it's nested inside a scope
  (Use Application/Browser, Excel Application Scope, etc.)?
- Are enum values spelled exactly right (`"SameAsCard"` vs `"Same as Card"`)?

### 4. Check the import side
Search `xamlImport.ts` for the same `lcsType` or local name (usually in
`pickCommonProps` or a dedicated `if (mapped === '...')` block near it).
Confirm it reads the *real* attribute name from step 2/3 — a very common bug
pattern in this codebase was reading an attribute name that simply doesn't
exist on the real activity (see "Surprises we found" below).

### 5. Check for the ActivityAction wrapper trap
If the activity is a **container** (has children), check whether its body in
the real XAML is:
```xml
<SomeContainer.Body>
  <ActivityAction x:TypeArguments="x:Object">
    <ActivityAction.Argument>
      <DelegateInArgument x:TypeArguments="x:Object" Name="..." />
    </ActivityAction.Argument>
    <Sequence>
      <!-- real children here -->
    </Sequence>
  </ActivityAction>
</SomeContainer.Body>
```
This pattern is used by `ForEach`, `NApplicationCard` (Use Application/Browser),
`RetryScope`, `TimeoutScope`, `ParallelForEach`, `Catch` blocks, and likely
others. `collectActivities()` in `xamlImport.ts` already unwraps bare
`ActivityAction` and `Catch` keys generically — if you find a new container
using this pattern and its children go missing on import, check whether its
own import code passes the *whole* `.Body` node into `collectActivities()`
(good — the generic unwrap handles it) rather than trying to read children off
it directly (bad — needs fixing to match the pattern in `renderUseApplicationBrowser`
/ the `ForEach` import block).

### 6. Round-trip test
After fixing both sides, mentally (or with a quick script, see the test files
we used in this session) trace: export a sample activity → does the resulting
XAML match your real sample almost exactly? → import that XAML back → do you
get the same properties you started with? Both directions need checking
separately — we found bugs that only broke one direction more than once.

## Surprises we found (don't assume these are safe elsewhere either)

- **Namespace prefixes are not descriptive of the underlying assembly.**
  `UI.UseApplicationBrowser`/`UI.Click`/etc. use `uix:` — not `uia:` (which we'd
  invented and used everywhere, pointing at a namespace URI that doesn't
  exist). `Excel.*` activities use the plain `ui:` namespace — there's no
  separate `excel:` namespace at all, even though a separate assembly
  (`UiPath.Excel.Activities`) implements them. **Never assume a "logical"
  namespace grouping matches the real XAML namespace** — always confirm from a
  sample.
- **Properties don't always have the name you'd guess.** `Add Queue Item`'s
  queue field is `QueueType`, not `QueueName`. `BuildDataTable` has no
  `Columns`/`ColumnNames` property at all — schema lives in `TableInfo`, a
  full embedded ADO.NET XSD schema string.
- **"Simple" properties can be complex nested structures.** `ItemInformation`
  on Add Queue Item is a dictionary of `InArgument` elements, not a flat
  string. Click's selector lives in a nested `.Target` > `TargetAnchorable`
  element with ~10 sub-properties, not a flat `Selector="..."` attribute.
- **Modern activities may want typed resources, not literal values.** Modern
  `ReadRange` takes `WorkbookPathResource` (an `IResource`, via
  `CType(var, UiPath.Platform.ResourceHandling.IResource)`), not a plain
  `WorkbookPath` string — this only shows up when the workbook path comes from
  a variable, not a hardcoded path.
- **Activities nested inside a scope need to declare it.** A `Click` inside a
  Use Application/Browser card needs `ScopeIdentifier="<card's ScopeGuid>"`
  and `HealingAgentBehavior="SameAsCard"`, or it isn't properly scoped.

## Adding a brand-new activity type later

1. Add it to `activities.ts` (the catalog) with its properties — this drives
   the properties panel UI.
2. Get a real XAML sample from Studio (see Step 1 above) — do this **before**
   writing any parsing code, not after something breaks.
3. Decide: does it fit the generic path (add to `activityMap.ts`'s `MAP` array
   with the correct `xamlLocalNames`/`exportName`/`xamlNamespace`), or does it
   need custom attribute handling (write a dedicated case in both
   `xamlExport.ts` and `xamlImport.ts`, following the pattern of an existing
   similar activity — e.g. copy `renderExcelActivity`'s structure for another
   data-source activity)?
4. If it's a container, check for the `ActivityAction` wrapper pattern
   (Step 5 above) and make sure both directions handle it.
5. Round-trip test (Step 6) before considering it done.

## Known unverified areas (flagged, not yet confirmed against a real sample)

These currently work off inference from similar activities, not direct
evidence — treat them as suspects if related activities misbehave:

- `Messaging.SendEmail` and other `mail:`-namespaced activities in
  `activityMap.ts` — likely the same `excel:`-style invented-namespace bug
  (Mail is an old/classic package, plausibly also just `ui:`), but not
  confirmed with a real sample yet.
- `Python.*` activities (`python:` namespace) — newer package, more plausible
  it genuinely has its own namespace, but also unconfirmed.
- `Excel.WriteRange`, `Excel.AppendRange`, `Excel.ReadCell`, `Excel.WriteCell`,
  `Excel.ExcelApplicationScope` — namespace fixed (`ui:`, matching the
  confirmed `ReadRange` fix), but their individual attribute shapes haven't
  been diffed against a real sample the way `ReadRange` was. `WriteRange`/
  `AppendRange` likely have the same `WorkbookPathResource`-vs-`WorkbookPath`
  question as `ReadRange`.
- `UI.WaitElement` — no confirmed modern (`N*`) equivalent found in UiPath's
  docs; currently exports under a classic name, which may not work in a
  modern-only solution at all.
- `UI.SendHotkey`'s exact `Shortcuts` attribute value shape (list vs single
  string) hasn't been diffed against a real sample.
- `TryCatch` always imports/exports its catch clause as `System.Exception` —
  the real exception type (`Catch x:TypeArguments="..."`) isn't preserved.
  Only matters if you use typed catches for specific exception types.
- Any activity not covered by the four real samples reviewed this session
  (Use Application/Browser, Click, Add Queue Item, Log Message, If, TryCatch,
  Delay, ReadRange, Assign, WriteLine) should be treated as unverified until
  checked the same way.
