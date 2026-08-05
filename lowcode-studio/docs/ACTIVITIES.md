# LowCode Studio — Activity coverage

Generated for **v0.6.26** from the extension activity catalog.

This list is what you can design in VS Code / Cursor, dry-run locally, and best-effort import/export with UiPath Studio / Studio Web.

> Not every property of every UiPath activity is modeled. Selectors for UI activities round-trip via `selector` / `selectorModern` / `selectorXml`.

**Total activities:** 73

## By category

### Control Flow

UiPath package (typical): `UiPath.System.Activities (WF)`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Break | `ControlFlow.Break` | No | — |
| Do While | `ControlFlow.DoWhile` | Yes | condition |
| For Each | `ControlFlow.ForEach` | Yes | item, values |
| If | `ControlFlow.If` | Yes | condition |
| Parallel | `ControlFlow.Parallel` | Yes | — |
| Parallel For Each | `ControlFlow.ParallelForEach` | Yes | item, values |
| Retry Scope | `ControlFlow.RetryScope` | Yes | numberOfRetries, retryIntervalMs |
| Sequence | `ControlFlow.Sequence` | Yes | — |
| Switch | `ControlFlow.Switch` | Yes | expression, cases |
| Timeout Scope | `ControlFlow.TimeoutScope` | Yes | timeoutMs |
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
| Filter Data Table | `Data.FilterDataTable` | No | dataTable, columnName, operator, value, result |
| For Each Row | `Data.ForEachRow` | Yes | dataTable, row |
| Join Data Tables | `Data.JoinDataTable` | No | dataTable1, dataTable2, joinType, column1, column2, result |
| Lookup Data Table | `Data.LookupDataTable` | No | dataTable, lookupColumn, lookupValue, targetColumn, result |
| Output Data Table | `Data.OutputDataTable` | No | dataTable, result |
| Read CSV | `Data.ReadCsv` | No | path, result, hasHeaders |
| Sort Data Table | `Data.SortDataTable` | No | dataTable, columnName, order, result |
| Write CSV | `Data.WriteCsv` | No | path, data |

### Excel

UiPath package (typical): `UiPath.Excel.Activities`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Excel Append Range | `Excel.AppendRange` | No | workbookPath, sheetName, data |
| Excel Application Scope | `Excel.ExcelApplicationScope` | Yes | workbookPath, createIfNotExists |
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
| Get Email | `Messaging.GetEmail` | No | mailFolder, top, filter, result |
| HTTP Request | `Messaging.HttpRequest` | No | method, url, headers, authType, token, username… |
| Select Token (JSON Path) | `Messaging.SelectToken` | No | json, path, result |
| Send Email | `Messaging.SendEmail` | No | to, subject, body |
| Serialize JSON | `Messaging.SerializeJson` | No | value, result |

### Orchestrator

UiPath package (typical): `—`

| Activity | Type id | Container | Key properties |
|---|---|---|---|
| Add Queue Item | `Orchestrator.AddQueueItem` | No | queueName, folderPath, reference, itemInformation, priority |
| Get Asset | `Orchestrator.GetAsset` | No | assetName, folderPath, result |
| Get Transaction Item | `Orchestrator.GetTransactionItem` | No | queueName, folderPath, reference, result |
| Set Asset | `Orchestrator.SetAsset` | No | assetName, value, folderPath |

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
| Invoke Workflow | `REFramework.InvokeWorkflow` | No | workflowPath, argumentMappings, description |
| Set Transaction Status | `REFramework.SetTransactionStatus` | No | transactionItem, status, reason |

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
| Check | `UI.Check` | No | selector, selectorModern, action, timeoutMs, inputMethod |
| Click | `UI.Click` | No | selector, selectorModern, clickType, timeoutMs, inputMethod |
| Element Exists | `UI.ElementExists` | No | selector, selectorModern, result, timeoutMs |
| Extract Table Data | `UI.ExtractTableData` | No | selector, selectorModern, extractionMetadata, includeHeaders, maxResults, smartExtraction… |
| Get Attribute | `UI.GetAttribute` | No | selector, selectorModern, attribute, result |
| Get Text | `UI.GetText` | No | selector, selectorModern, result, timeoutMs, inputMethod |
| Hover | `UI.Hover` | No | selector, selectorModern, timeoutMs, inputMethod |
| Open Application | `UI.OpenApplication` | No | pathOrUrl, arguments |
| Select Item | `UI.SelectItem` | No | selector, selectorModern, item, inputMethod |
| Take Screenshot | `UI.TakeScreenshot` | No | selector, filePath |
| Type Into | `UI.TypeInto` | No | selector, selectorModern, text, emptyField, timeoutMs, inputMethod |
| Use Application/Browser | `UI.UseApplicationBrowser` | Yes | mode, urlOrPath, browserType, inputMethod, selector, open… |
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
