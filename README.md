# LowCode Studio for VS Code / Cursor

**v0.4.1** — Studio-like low-code RPA for Mac users without UiPath Studio Desktop.

**Repo:** https://github.com/nikosrokos/lowcode-studio

Full docs: [`lowcode-studio/README.md`](lowcode-studio/README.md)

## In action

![Sequence + colors](lowcode-studio/docs/images/vscode-sequence-colors.png)

![Import / Studio Web export](lowcode-studio/docs/images/vscode-import-export-studioweb.png)

![REFramework flowchart](lowcode-studio/docs/images/vscode-reframework-flowchart.png)

## Install

```bash
cd lowcode-studio
npm install
npm run compile
npm test
npm run package
```

**Extensions: Install from VSIX…** → `lowcode-studio-0.4.1.vsix`

Activity coverage catalog: [`lowcode-studio/docs/ACTIVITIES.md`](lowcode-studio/docs/ACTIVITIES.md)

## Highlights in 0.4.1

- Richer XAML import/export (Excel, Mail, modern UI, RetryScope, …)
- **Python activities** (`UiPath.Python.Activities`): Scope, Load/Run Script, Invoke Method, Get Object
- Selector round-trip (classic + modern encodings)
- Studio Web export with activity package dependencies

## Next steps (roadmap)

1. Import polish for `Imported.*` placeholders  
2. Studio Web Git sync guide  
3. Config.xlsx bridge for classic REFramework  
4. Package validation warnings  
5. Deeper modern UI scopes  
6. Marketplace publish  

