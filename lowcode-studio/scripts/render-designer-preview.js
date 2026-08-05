/**
 * Renders a standalone designer preview for screenshots (no VS Code host).
 */
const fs = require('fs');
const path = require('path');
const { getDesignerHtml } = require('../out/webview/designerHtml');
const { ACTIVITY_CATALOG } = require('../out/models/activities');

const workflow = {
  schemaVersion: 1,
  name: 'OrderProcess',
  type: 'Sequence',
  activities: [
    {
      id: 'a1',
      type: 'System.LogMessage',
      displayName: 'Log Start',
      properties: { message: '"Starting order process"', level: 'Info' }
    },
    {
      id: 'a2',
      type: 'UI.UseApplicationBrowser',
      displayName: 'Open Shop',
      properties: {
        mode: 'Browser',
        urlOrPath: 'https://shop.example.com',
        browserType: 'Chrome',
        open: 'IfNotOpen',
        close: 'Never',
        inputMethod: 'Simulate'
      },
      children: [
        {
          id: 'a3',
          type: 'UI.Click',
          displayName: 'Click Buy',
          properties: {
            selector:
              "<html app='chrome.exe' title='Shop*' />\\n<webctrl tag='BUTTON' id='buyNow' />",
            clickType: 'Single',
            timeoutMs: 30000,
            inputMethod: 'Simulate'
          }
        },
        {
          id: 'a4',
          type: 'UI.GetText',
          displayName: 'Read Price',
          properties: {
            selector:
              "<html app='chrome.exe' title='Shop*' />\\n<webctrl tag='SPAN' id='price' />",
            result: 'price',
            timeoutMs: 15000,
            inputMethod: 'Simulate'
          }
        }
      ]
    },
    {
      id: 'a5',
      type: 'ControlFlow.If',
      displayName: 'Price OK?',
      properties: { condition: 'price <> ""' },
      children: [
        {
          id: 'a6',
          type: 'System.LogMessage',
          displayName: 'Log Price',
          properties: { message: 'price', level: 'Info' }
        }
      ],
      elseChildren: [
        {
          id: 'a7',
          type: 'System.LogMessage',
          displayName: 'Missing Price',
          properties: { message: '"no price"', level: 'Warn' }
        }
      ]
    }
  ],
  variables: [
    { name: 'price', type: 'String', defaultValue: '""' }
  ],
  connections: []
};

const projects = [
  {
    kind: 'project',
    path: '/demo/ShopBot',
    name: 'ShopBot',
    active: true,
    badge: 'LCS',
    children: [
      {
        kind: 'folder',
        path: '/demo/ShopBot/Framework',
        name: 'Framework',
        children: [
          { kind: 'workflow', path: '/demo/ShopBot/Framework/Process.lcs.json', name: 'Process.lcs.json' }
        ]
      },
      {
        kind: 'folder',
        path: '/demo/ShopBot/Data',
        name: 'Data',
        children: [
          { kind: 'file', path: '/demo/ShopBot/Data/Config.json', name: 'Config.json' }
        ]
      }
    ]
  }
];

let html = getDesignerHtml(
  'preview',
  "'self'",
  workflow,
  ACTIVITY_CATALOG,
  { variables: ['price'], configKeys: [], configExpressions: [], workflowPaths: ['Framework/Process.lcs.json'] },
  { favorites: ['UI.Click', 'System.LogMessage'], recent: ['UI.GetText'] },
  projects
);

// Stub VS Code API + dark theme for screenshots (preview only — relax CSP)
const stub = `
<script>
  window.acquireVsCodeApi = function () {
    var _state = {};
    return {
      postMessage: function () {},
      getState: function () { return _state; },
      setState: function (s) { _state = s || {}; return _state; }
    };
  };
</script>
<style>
  :root {
    --vscode-editor-background: #1e1e1e;
    --vscode-sideBar-background: #252526;
    --vscode-panel-border: #3c3c3c;
    --vscode-foreground: #cccccc;
    --vscode-descriptionForeground: #9d9d9d;
    --vscode-button-background: #0e639c;
    --vscode-button-foreground: #ffffff;
    --vscode-input-background: #3c3c3c;
    --vscode-input-border: #3c3c3c;
    --vscode-list-hoverBackground: #2a2d2e;
    --vscode-focusBorder: #007fd4;
    --vscode-font-family: "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    --vscode-editor-font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  html, body { width: 1280px; height: 800px; }
</style>
`;

html = html.replace(
  /<meta http-equiv="Content-Security-Policy"[^>]*>/,
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\' \'unsafe-eval\';" />'
);
html = html.replace('<head>', '<head>' + stub);

if (process.env.LCS_PREVIEW_FLOAT === '1') {
  html = html.replace(
    '</body>',
    `<script>
      setTimeout(function () {
        document.getElementById('btnLeftFloat') && document.getElementById('btnLeftFloat').click();
        document.getElementById('btnPropsFloat') && document.getElementById('btnPropsFloat').click();
        var tab = document.querySelector('[data-left-tab="project"]');
        if (tab) tab.click();
        var card = document.querySelector('.card');
        if (card) card.click();
        if (typeof state !== 'undefined') {
          state.leftFloatPos = { x: 24, y: 64 };
          state.propsFloatPos = { x: 940, y: 64 };
          state.leftWidth = 280;
          state.propsWidth = 310;
          state.leftHeight = 560;
          state.propsHeight = 560;
          if (typeof applyFrameLayouts === 'function') applyFrameLayouts();
        }
      }, 200);
    </script></body>`
  );
}

const outDir = path.join(__dirname, '..', 'docs', 'images');
const outName = process.env.LCS_PREVIEW_FLOAT === '1' ? '_preview-float.html' : '_preview-designer.html';
const outFile = path.join(outDir, outName);
fs.writeFileSync(outFile, html, 'utf8');
console.log('Wrote', outFile);
