# LowCode Studio

Studio-like low-code RPA for **VS Code / Cursor** on Mac, Windows, and Linux.

> Not an official UiPath product. · [Repo](https://github.com/nikosrokos/lowcode-studio)

![version](https://img.shields.io/badge/version-0.7.9-0ea5e9)
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

## Install

```bash
cd lowcode-studio
npm install && npm run compile && npm test && npm run package
```

> Open the **`lowcode-studio/`** folder (not the repo root) when using **Run Extension** / F5.

## Docs

See [`lowcode-studio/README.md`](lowcode-studio/README.md) and [`lowcode-studio/CHANGELOG.md`](lowcode-studio/CHANGELOG.md).
