/**
 * Classic Windows UiPath selector builder for Mac design-time.
 * Helps authors assemble <html>/<webctrl> and <wnd> selectors without UI Explorer.
 */

export type SelectorKind = 'browser' | 'desktop';

export interface SelectorParts {
  kind: SelectorKind;
  app: string;
  title: string;
  tag: string;
  id: string;
  aaname: string;
  cls: string;
  name: string;
  idx: string;
}

export interface SelectorTemplate {
  id: string;
  label: string;
  description: string;
  kind: SelectorKind;
  parts: Partial<SelectorParts>;
}

export const DEFAULT_BROWSER_PARTS: SelectorParts = {
  kind: 'browser',
  app: 'chrome.exe',
  title: '*',
  tag: 'BUTTON',
  id: '',
  aaname: '',
  cls: '',
  name: '',
  idx: ''
};

export const DEFAULT_DESKTOP_PARTS: SelectorParts = {
  kind: 'desktop',
  app: 'notepad.exe',
  title: '*',
  tag: '',
  id: '',
  aaname: '',
  cls: 'Notepad',
  name: '',
  idx: ''
};

export const SELECTOR_TEMPLATES: SelectorTemplate[] = [
  {
    id: 'chrome-button',
    label: 'Chrome — Button',
    description: 'HTML button in Google Chrome',
    kind: 'browser',
    parts: { app: 'chrome.exe', tag: 'BUTTON', id: 'btnSubmit' }
  },
  {
    id: 'chrome-input',
    label: 'Chrome — Input',
    description: 'Text input in Google Chrome',
    kind: 'browser',
    parts: { app: 'chrome.exe', tag: 'INPUT', id: 'username' }
  },
  {
    id: 'edge-link',
    label: 'Edge — Link',
    description: 'Anchor / link in Microsoft Edge',
    kind: 'browser',
    parts: { app: 'msedge.exe', tag: 'A', aaname: 'Next' }
  },
  {
    id: 'chrome-table',
    label: 'Chrome — Table',
    description: 'HTML table root for Extract Table Data',
    kind: 'browser',
    parts: { app: 'chrome.exe', tag: 'TABLE', id: '' }
  },
  {
    id: 'chrome-select',
    label: 'Chrome — Dropdown',
    description: 'SELECT element in Chrome',
    kind: 'browser',
    parts: { app: 'chrome.exe', tag: 'SELECT', id: 'country' }
  },
  {
    id: 'wnd-notepad',
    label: 'Desktop — Notepad',
    description: 'Classic Notepad window',
    kind: 'desktop',
    parts: { app: 'notepad.exe', cls: 'Notepad', title: '*' }
  },
  {
    id: 'wnd-excel',
    label: 'Desktop — Excel',
    description: 'Microsoft Excel main window',
    kind: 'desktop',
    parts: { app: 'EXCEL.EXE', cls: 'XLMAIN', title: '*' }
  },
  {
    id: 'wnd-generic',
    label: 'Desktop — Generic Window',
    description: 'Generic Win32 window by app + title',
    kind: 'desktop',
    parts: { app: 'app.exe', title: '*', cls: '' }
  }
];

export function emptyParts(kind: SelectorKind = 'browser'): SelectorParts {
  return {
    ...(kind === 'desktop' ? DEFAULT_DESKTOP_PARTS : DEFAULT_BROWSER_PARTS)
  };
}

export function buildWindowsSelector(parts: Partial<SelectorParts>): string {
  const kind = parts.kind || 'browser';
  if (kind === 'desktop') {
    const attrs = [`app='${esc(parts.app || 'app.exe')}'`];
    if (parts.cls) {
      attrs.push(`cls='${esc(parts.cls)}'`);
    }
    if (parts.title) {
      attrs.push(`title='${esc(parts.title)}'`);
    }
    if (parts.name) {
      attrs.push(`name='${esc(parts.name)}'`);
    }
    if (parts.idx) {
      attrs.push(`idx='${esc(parts.idx)}'`);
    }
    return `<wnd ${attrs.join(' ')} />`;
  }

  const app = parts.app || 'chrome.exe';
  const title = parts.title || '*';
  const tag = (parts.tag || '*').toUpperCase();
  const web: string[] = [`tag='${esc(tag)}'`];
  if (parts.id) {
    web.push(`id='${esc(parts.id)}'`);
  }
  if (parts.aaname) {
    web.push(`aaname='${esc(parts.aaname)}'`);
  }
  if (parts.name) {
    web.push(`name='${esc(parts.name)}'`);
  }
  if (parts.cls) {
    web.push(`class='${esc(parts.cls)}'`);
  }
  if (parts.idx) {
    web.push(`idx='${esc(parts.idx)}'`);
  }
  if (!parts.id && !parts.aaname && !parts.name && tag === '*') {
    web.push(`id='element'`);
  }
  return `<html app='${esc(app)}' title='${esc(title)}' />\n<webctrl ${web.join(' ')} />`;
}

export function parseWindowsSelector(raw: string): SelectorParts {
  const text = String(raw || '').trim();
  if (!text) {
    return emptyParts('browser');
  }

  if (/<wnd\b/i.test(text)) {
    const m = text.match(/<wnd\b([^>]*)\/?>/i);
    const attrs = parseAttrs(m?.[1] || '');
    return {
      kind: 'desktop',
      app: attrs.app || 'app.exe',
      title: attrs.title || '*',
      tag: '',
      id: '',
      aaname: attrs.aaname || '',
      cls: attrs.cls || '',
      name: attrs.name || '',
      idx: attrs.idx || ''
    };
  }

  const html = text.match(/<html\b([^>]*)\/?>/i);
  const web = text.match(/<webctrl\b([^>]*)\/?>/i);
  const htmlAttrs = parseAttrs(html?.[1] || '');
  const webAttrs = parseAttrs(web?.[1] || '');
  return {
    kind: 'browser',
    app: htmlAttrs.app || 'chrome.exe',
    title: htmlAttrs.title || '*',
    tag: (webAttrs.tag || 'BUTTON').toUpperCase(),
    id: webAttrs.id || '',
    aaname: webAttrs.aaname || '',
    cls: webAttrs.class || webAttrs.cls || '',
    name: webAttrs.name || '',
    idx: webAttrs.idx || ''
  };
}

export function applyTemplate(templateId: string): string {
  const tpl = SELECTOR_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) {
    return buildWindowsSelector(emptyParts('browser'));
  }
  const base = emptyParts(tpl.kind);
  return buildWindowsSelector({ ...base, ...tpl.parts, kind: tpl.kind });
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:@\w.-]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

function esc(value: string): string {
  return String(value).replace(/'/g, "''");
}
