/**
 * Classic Windows UiPath selector builder for Mac design-time.
 * Helps authors assemble <html>/<webctrl> and <wnd> selectors without UI Explorer.
 */

import { normalizeWindowsSelector } from './windowsTarget';

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
  tag: '',
  id: '',
  aaname: '',
  cls: '',
  name: '',
  idx: ''
};

export const DEFAULT_DESKTOP_PARTS: SelectorParts = {
  kind: 'desktop',
  app: '',
  title: '',
  tag: '',
  id: '',
  aaname: '',
  cls: '',
  name: '',
  idx: ''
};

export const SELECTOR_TEMPLATES: SelectorTemplate[] = [
  {
    id: 'chrome-button',
    label: 'Chrome — Button',
    description: 'HTML button in Google Chrome — fill Id or aaname',
    kind: 'browser',
    parts: { app: 'chrome.exe', tag: 'BUTTON', aaname: '' }
  },
  {
    id: 'chrome-input',
    label: 'Chrome — Input',
    description: 'Text input in Google Chrome — fill Id or name',
    kind: 'browser',
    parts: { app: 'chrome.exe', tag: 'INPUT', id: '' }
  },
  {
    id: 'edge-link',
    label: 'Edge — Link',
    description: 'Anchor / link in Microsoft Edge — set aaname',
    kind: 'browser',
    parts: { app: 'msedge.exe', tag: 'A', aaname: '' }
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
    description: 'SELECT element in Chrome — fill Id',
    kind: 'browser',
    parts: { app: 'chrome.exe', tag: 'SELECT', id: '' }
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
    description: 'Generic Win32 window — set app + title',
    kind: 'desktop',
    parts: { app: '', title: '', cls: '' }
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
  if (!parts.id && !parts.aaname && !parts.name && !parts.idx && tag === '*') {
    // Leave under-specified — do not invent id='element'
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
    tag: (webAttrs.tag || '').toUpperCase(),
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

export type SelectorQualityLevel =
  | 'empty'
  | 'placeholder'
  | 'weak'
  | 'ok'
  | 'strong';

export interface SelectorQuality {
  score: number;
  level: SelectorQualityLevel;
  label: string;
  hints: string[];
  /** Short card / badge text */
  cardMessage: string;
}

const STOCK_IDS = new Set([
  'btnsubmit',
  'input',
  'label',
  'popup',
  'chkagree',
  'menu',
  'cmbcountry',
  'element'
]);

/**
 * Score how specific a classic Windows / browser selector is for Mac design-time.
 * Higher = more likely to work after Indicate Element polish on Windows.
 */
export function scoreSelector(raw: string): SelectorQuality {
  const s = String(raw || '').trim();
  const hints: string[] = [];

  if (!s) {
    return {
      score: 0,
      level: 'empty',
      label: 'Empty',
      hints: ['Paste a Studio UI Explorer selector or use a template.'],
      cardMessage: 'Windows TODO · missing selector'
    };
  }

  if (/<target\b/i.test(s)) {
    return {
      score: 8,
      level: 'placeholder',
      label: 'Placeholder',
      hints: ['Replace <target> with classic <html>/<webctrl> or <wnd>.'],
      cardMessage: 'Windows TODO · <target> placeholder'
    };
  }

  const parts = parseWindowsSelector(s);
  const idLower = (parts.id || '').toLowerCase();
  if (STOCK_IDS.has(idLower)) {
    return {
      score: 15,
      level: 'placeholder',
      label: 'Starter example',
      hints: [
        `Id "${parts.id}" is a LowCode Studio demo value — set a real Id / aaname from the page.`
      ],
      cardMessage: 'Windows TODO · starter selector'
    };
  }

  let score = 20;
  if (/<(html|webctrl|wnd)\b/i.test(s)) {
    score += 15;
  } else {
    hints.push('Prefer classic <html>/<webctrl> (browser) or <wnd> (desktop).');
  }

  if (parts.kind === 'browser') {
    if (parts.tag && parts.tag !== '*') {
      score += 10;
    } else {
      hints.push('Set a Tag (BUTTON, INPUT, A…).');
    }
    if (parts.id) {
      score += 30;
    }
    if (parts.aaname) {
      score += 22;
    }
    if (parts.name) {
      score += 18;
    }
    if (parts.cls) {
      score += 8;
    }
    if (parts.idx) {
      score += 6;
      if (!parts.id && !parts.aaname && !parts.name) {
        hints.push('Index-only selectors are brittle — add Id or aaname.');
      }
    }
    if (parts.app && parts.app !== 'chrome.exe' && parts.app !== 'msedge.exe') {
      score += 4;
    }
    if (parts.title && parts.title !== '*') {
      score += 6;
    }
    if (!parts.id && !parts.aaname && !parts.name && !parts.idx) {
      return {
        score: Math.min(score, 28),
        level: 'placeholder',
        label: 'Under-specified',
        hints: ['Set Id, aaname, Name, or Index before Windows run.'],
        cardMessage: 'Windows TODO · under-specified selector'
      };
    }
  } else {
    if (parts.app && parts.app !== 'app.exe') {
      score += 20;
    } else {
      hints.push('Set a real App (e.g. notepad.exe).');
    }
    if (parts.cls) {
      score += 22;
    }
    if (parts.title && parts.title !== '*') {
      score += 18;
    } else if (parts.title === '*') {
      score += 4;
      hints.push('A concrete window Title is more reliable than *.');
    }
    if (parts.name) {
      score += 16;
    }
    if (parts.idx) {
      score += 6;
    }
    if (
      (!parts.app || parts.app === 'app.exe') &&
      !parts.cls &&
      (!parts.title || parts.title === '*') &&
      !parts.name
    ) {
      return {
        score: 12,
        level: 'placeholder',
        label: 'Generic window',
        hints: ['Set App + Title or cls for desktop selectors.'],
        cardMessage: 'Windows TODO · generic <wnd>'
      };
    }
  }

  score = Math.max(0, Math.min(100, score));
  let level: SelectorQualityLevel;
  let label: string;
  let cardMessage: string;
  if (score < 40) {
    level = 'weak';
    label = 'Weak';
    cardMessage = 'Weak selector — add Id / aaname';
    if (!hints.length) {
      hints.push('Add Id or aaname to raise specificity.');
    }
  } else if (score < 70) {
    level = 'ok';
    label = 'OK';
    cardMessage = '';
    if (!hints.length) {
      hints.push('Good enough to try on Windows; Indicate Element if it misses.');
    }
  } else {
    level = 'strong';
    label = 'Strong';
    cardMessage = '';
    if (!hints.length) {
      hints.push('Specific classic selector — still verify with Indicate Element on Windows.');
    }
  }

  return { score, level, label, hints, cardMessage };
}

/**
 * Best-effort decode of paste from Studio UI Explorer / modern encoding / CSS id.
 * Returns classic selector text when recognized; otherwise null.
 */
export function tryDecodeSelectorPaste(raw: string): string | null {
  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }

  // Already classic — keep as-is (caller may still normalize)
  if (/<(html|webctrl|wnd|java|sap|ctrl)\b/i.test(text)) {
    return text;
  }

  // <target …> / #id / bare token — normalize via same rules as export
  if (/<target\b/i.test(text) || /^#[\w.-]+$/.test(text) || /^[\w.-]+$/.test(text)) {
    const normalized = normalizeWindowsSelector(text);
    return normalized || null;
  }

  // Embedded classic fragment inside a longer dump / modern blob
  const htmlWeb = text.match(/(<html\b[^>]*\/?>[\s\S]*?<webctrl\b[^>]*\/?>)/i);
  if (htmlWeb?.[1]) {
    return htmlWeb[1].replace(/\s+/g, ' ').replace(/>\s*</g, '>\n<');
  }
  const wnd = text.match(/(<wnd\b[^>]*\/?>)/i);
  if (wnd?.[1]) {
    return wnd[1];
  }
  const webOnly = text.match(/(<webctrl\b[^>]*\/?>)/i);
  if (webOnly?.[1]) {
    const attrs = parseAttrs(webOnly[1].replace(/^<webctrl\b/i, '').replace(/\/?>$/, ''));
    return buildWindowsSelector({
      kind: 'browser',
      app: 'chrome.exe',
      title: '*',
      tag: attrs.tag || '*',
      id: attrs.id || '',
      aaname: attrs.aaname || '',
      name: attrs.name || '',
      cls: attrs.class || attrs.cls || '',
      idx: attrs.idx || ''
    });
  }

  // URL-ish FullSelectorEncoding sometimes embeds tag= / id= pairs as plain text
  const idMatch = text.match(/\bid\s*[=:]\s*['"]?([\w.-]+)/i);
  const tagMatch = text.match(/\btag\s*[=:]\s*['"]?([\w.-]+)/i);
  const aanameMatch = text.match(/\b(?:aaname|name)\s*[=:]\s*['"]([^'"]+)/i);
  if (idMatch || aanameMatch) {
    return buildWindowsSelector({
      kind: 'browser',
      app: 'chrome.exe',
      title: '*',
      tag: (tagMatch?.[1] || '*').toUpperCase(),
      id: idMatch?.[1] || '',
      aaname: aanameMatch?.[1] || ''
    });
  }

  return null;
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
