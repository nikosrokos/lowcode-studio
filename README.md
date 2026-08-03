# LowCode Studio for VS Code / Cursor

Studio-like low-code RPA extension for Mac users who cannot run UiPath Studio Desktop.

**Repo:** https://github.com/nikosrokos/lowcode-studio

See [`lowcode-studio/README.md`](lowcode-studio/README.md) for full docs.

## Highlights (v0.3)

- Sequence + **Flowchart** designer + custom container colors
- One-click **REFramework** template
- **Import** UiPath `.nupkg` / Studio folders
- **Export for Studio Web** (simple path — publish from Studio Web)
- Dry-run simulator (F5)

![Flowchart mode](lowcode-studio/docs/images/vscode-flowchart-mode.png)

## Install quickly

```bash
cd lowcode-studio
npm install
npm run compile
npm test
npm run package
```

Then: **Extensions: Install from VSIX…** → `lowcode-studio-0.3.0.vsix`.
