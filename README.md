# LowCode Studio for VS Code / Cursor

**v0.5.2** — Studio-like low-code RPA for Mac users without UiPath Studio Desktop.

**Repo:** https://github.com/nikosrokos/lowcode-studio

Full docs: [`lowcode-studio/README.md`](lowcode-studio/README.md)

## In action

![Sequence + colors](lowcode-studio/docs/images/vscode-sequence-colors.png)

![Import / Studio Web export](lowcode-studio/docs/images/vscode-import-export-studioweb.png)

![REFramework flowchart](lowcode-studio/docs/images/vscode-reframework-flowchart.png)

![REFramework scenario testing](lowcode-studio/docs/images/vscode-reframework-testing.png)

![REFramework Process + Invoke Code](lowcode-studio/docs/images/vscode-reframework-process-activities.png)

## Install

```bash
cd lowcode-studio
npm install
npm run compile
npm test
npm run package
```

**Extensions: Install from VSIX…** → `lowcode-studio-0.5.2.vsix`

Activity coverage catalog: [`lowcode-studio/docs/ACTIVITIES.md`](lowcode-studio/docs/ACTIVITIES.md)

## Highlights in 0.5.2

- **Config.xlsx bridge** — classic REFramework Settings/Constants/Assets ↔ `Data/Config.json`
- Invoke Code + top-use activities, custom activity registration, scenario dry-runs
- XAML import/export, Python activities, Studio Web package deps

## Next steps (roadmap)

1. Import polish for `Imported.*` placeholders  
2. Studio Web Git sync guide  
3. Package validation warnings  
4. Deeper modern UI scopes  
5. Marketplace publish  
