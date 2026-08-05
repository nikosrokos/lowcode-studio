# LowCode Studio

**v0.6.35** · Studio-like low-code RPA for **VS Code / Cursor** on Mac, Windows, and Linux.

Design REFramework & classic workflows locally → dry-run → sync with **Studio Web Local Workspace** → publish.

> Not an official UiPath product. · [Repo](https://github.com/nikosrokos/lowcode-studio)

![version](https://img.shields.io/badge/version-0.6.35-0ea5e9)
![platform](https://img.shields.io/badge/platform-Mac%20%7C%20Windows%20%7C%20Linux-22c55e)

## Loop

```
Design on Mac  →  F5 / Shift+F5 dry-run  →  Connect Studio Web Local  →  Save (↔ sync)  →  Publish
```

| | |
|---|---|
| **Test** | Dry Run + Scenarios (F5 / Shift+F5) |
| **Ship** | Studio Web Local Workspace — bidirectional sync on Save |
| **Design** | Insert ⌘K · Blueprints · REFramework · Assist (explain / selectors / VB) |

## Highlights

- **Bidirectional Studio Web sync** — edits in Studio Web Local pull into `.lcs.json`; Save pushes `.xaml` (backups in `.lcs-sync-trash/`)
- **Portable-safe activities** — Use Browser, Build Data Table, and catalog fixes so Studio Web does not show “activity missing”
- **Assist** — Explain, scenarios, selector repair, VB expression repair
- **Mac-first designer** — sequences, flowcharts, REFramework, dry-run without Studio Desktop

## Install

```bash
cd lowcode-studio
npm install && npm run compile && npm test && npm run package
```

**Extensions: Install from VSIX…** → `lowcode-studio-0.6.35.vsix` → reload.

## Docs

Full guide: [`lowcode-studio/README.md`](lowcode-studio/README.md) · [Activities](lowcode-studio/docs/ACTIVITIES.md) · [Studio Web](lowcode-studio/docs/STUDIO_WEB.md) · [Changelog](lowcode-studio/CHANGELOG.md)
