# LowCode Studio — Activity coverage

Generated for **v0.6.1** from the extension activity catalog.

This list is what you can design in VS Code / Cursor, dry-run locally, and best-effort import/export with UiPath Studio / Studio Web.

> Not every property of every UiPath activity is modeled. Selectors for UI activities round-trip via `selector` / `selectorModern` / `selectorXml`.

**Total activities:** 57

## By category

### Control Flow

UiPath package (typical): `UiPath.System.Activities (WF)`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Break | `ControlFlow.Break` | No | — |
| Do While | `ControlFlow.DoWhile` | Yes | condition |
| For Each | `ControlFlow.ForEach` | Yes | item, values |
| If | `ControlFlow.If` | Yes | condition |
| Retry Scope | `ControlFlow.RetryScope` | Yes | numberOfRetries, retryIntervalMs |
| Sequence | `ControlFlow.Sequence` | Yes | — |
| Switch | `ControlFlow.Switch` | Yes | expression, cases |
| Try Catch | `ControlFlow.TryCatch` | Yes | exceptionType |
| While | `ControlFlow.While` | Yes | condition |

### Data

UiPath package (typical): `UiPath.System.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Add Data Column | `Data.AddDataColumn` | No | dataTable, columnName, columnType |
| Add Data Row | `Data.AddDataRow` | No | dataTable, arrayRow |
| Build Data Table | `Data.BuildDataTable` | No | columns, result |
| Clear Data Table | `Data.ClearDataTable` | No | dataTable |
| Filter Data Table | `Data.FilterDataTable` | No | dataTable, columnName, value, result |
| For Each Row | `Data.ForEachRow` | Yes | dataTable, row |
| Output Data Table | `Data.OutputDataTable` | No | dataTable, result |
| Read CSV | `Data.ReadCsv` | No | path, result, hasHeaders |
| Write CSV | `Data.WriteCsv` | No | path, data |

### Excel

UiPath package (typical): `UiPath.Excel.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Excel Read Cell | `Excel.ReadCell` | No | workbookPath, sheetName, cell, result |
| Excel Read Range | `Excel.ReadRange` | No | workbookPath, sheetName, range, result |
| Excel Write Cell | `Excel.WriteCell` | No | workbookPath, sheetName, cell, value |
| Excel Write Range | `Excel.WriteRange` | No | workbookPath, sheetName, data |

### Flowchart

UiPath package (typical): `UiPath.System.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| End | `Flowchart.End` | No | — |
| Flow Decision | `Flowchart.FlowDecision` | No | condition |
| Start | `Flowchart.Start` | No | — |

### Messaging

UiPath package (typical): `UiPath.Mail.Activities / UiPath.WebAPI.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Deserialize JSON | `Messaging.DeserializeJson` | No | jsonString, result |
| HTTP Request | `Messaging.HttpRequest` | No | method, url, body, result |
| Send Email | `Messaging.SendEmail` | No | to, subject, body |
| Serialize JSON | `Messaging.SerializeJson` | No | value, result |

### Programming

UiPath package (typical): `UiPath.System.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Assign | `Programming.Assign` | No | to, value |
| Invoke Code | `Programming.InvokeCode` | No | code, language, arguments |
| Multiple Assign | `Programming.MultipleAssign` | No | assignments |

### Python

UiPath package (typical): `UiPath.Python.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Get Python Object | `Python.GetObject` | No | pythonObject, type, result |
| Invoke Python Method | `Python.InvokeMethod` | No | instance, name, inputParameters, result |
| Load Python Script | `Python.LoadScript` | No | file, code, result |
| Python Scope | `Python.PythonScope` | Yes | path, libraryPath, target, workingFolder, version |
| Run Python Script | `Python.RunScript` | No | file, code |

### REFramework

UiPath package (typical): `UiPath.System.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Invoke Workflow | `REFramework.InvokeWorkflow` | No | workflowPath, description |
| Set Transaction Status | `REFramework.SetTransactionStatus` | No | status, reason |

### System

UiPath package (typical): `UiPath.System.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Comment | `System.Comment` | No | text |
| Delay | `System.Delay` | No | durationMs |
| Log Message | `System.LogMessage` | No | message, level |
| Message Box | `System.MessageBox` | No | text, title |
| Terminate Workflow | `System.TerminateWorkflow` | No | reason |
| Throw | `System.Throw` | No | exceptionType, message |
| Write Line | `System.WriteLine` | No | text |

### UI Automation

UiPath package (typical): `UiPath.UIAutomation.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Check | `UI.Check` | No | selector, selectorModern, action |
| Click | `UI.Click` | No | selector, selectorModern, clickType, simulateClick |
| Element Exists | `UI.ElementExists` | No | selector, selectorModern, result, timeoutMs |
| Get Attribute | `UI.GetAttribute` | No | selector, selectorModern, attribute, result |
| Get Text | `UI.GetText` | No | selector, selectorModern, result |
| Hover | `UI.Hover` | No | selector, selectorModern |
| Open Application | `UI.OpenApplication` | No | pathOrUrl, arguments |
| Select Item | `UI.SelectItem` | No | selector, selectorModern, item |
| Take Screenshot | `UI.TakeScreenshot` | No | selector, filePath |
| Type Into | `UI.TypeInto` | No | selector, selectorModern, text, emptyField |
| Wait Element | `UI.WaitElement` | No | selector, selectorModern, action, timeoutMs |

## Python pack (`UiPath.Python.Activities`)

Modeled after the official Python activities pack:

| LowCode Studio | UiPath activity | Notes |
|---|---|---|
| Python Scope | Python Scope | Container; sets Path / Target / WorkingFolder |
| Load Python Script | Load Python Script | File or inline Code → PythonObject |
| Run Python Script | Run Python Script | Execute file or inline code |
| Invoke Python Method | Invoke Python Method | Requires loaded Instance + method Name |
| Get Python Object | Get Python Object | Convert PythonObject → String/Int32/… |

Typical pattern:

```text
Python Scope
  ├─ Load Python Script  → pythonScript
  ├─ Invoke Python Method(pythonScript, "main") → pythonResult
  └─ Get Python Object(pythonResult as String) → netValue
```

Dry-run simulates handlers only (does not execute a real Python runtime on Mac).

## Import / export coverage notes

| Area | Status |
|---|---|
| System / Control Flow | Strong |
| UI + selectors | Strong (classic + modern encodings) |
| Excel / Mail / HTTP | Good |
| Python pack | Good (Scope / Load / Run / Invoke / Get) |
| REFramework Invoke | Good |
| Unknown Studio activities | Imported as `Imported.*` placeholders |

## Regenerating this file

```bash
npm run compile
npm run docs:activities
```
