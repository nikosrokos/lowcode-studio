/**
 * Windows Studio compatibility helpers.
 *
 * LowCode Studio designs on Mac, but exported automations target **Windows**
 * UiPath projects so they run on Windows robots / Studio Desktop with classic
 * Windows UI Automation selectors (`<html>/<webctrl>`, `<wnd>`, …).
 */

export type UiPathTargetFramework = 'Windows' | 'Portable';

export const DEFAULT_UIPATH_TARGET: UiPathTargetFramework = 'Windows';

/** .NET TFM written into runtimeOptions.netCore for Windows projects. */
export const WINDOWS_NET_TFM = 'net8.0-windows';

/** Cross-platform TFM (Portable / Studio Web cloud). */
export const PORTABLE_NET_TFM = 'net8.0';

/**
 * Normalize a selector string into a Windows classic UiPath selector when possible.
 * Placeholder `<target …>` values become Chrome/Edge-friendly `<html>/<webctrl>` pairs.
 */
export function normalizeWindowsSelector(raw: unknown): string {
  const selector = String(raw ?? '').trim();
  if (!selector) {
    return '';
  }

  // Already a classic Windows / browser selector
  if (/<(html|webctrl|wnd|java|sap|uia|ctrl|webctrl)\b/i.test(selector)) {
    return selector;
  }

  // Generic LCS placeholder: <target id="btnSubmit" /> or <target aaname='OK' tag='BUTTON' />
  const targetMatch = selector.match(/<target\b([^>]*)\/?>/i);
  if (targetMatch) {
    const attrs = parseXmlishAttrs(targetMatch[1] || '');
    const id = attrs.id || attrs.name || '';
    const aaname = attrs.aaname || attrs.name || attrs.title || '';
    const tag = (attrs.tag || 'BUTTON').toUpperCase();
    const app = attrs.app || 'chrome.exe';
    const title = attrs.title || '*';

    const webAttrs: string[] = [`tag='${escapeSel(tag)}'`];
    if (id) {
      webAttrs.push(`id='${escapeSel(id)}'`);
    }
    if (aaname) {
      webAttrs.push(`aaname='${escapeSel(aaname)}'`);
    }
    if (!id && !aaname) {
      webAttrs.push(`id='element'`);
    }

    return `<html app='${escapeSel(app)}' title='${escapeSel(title)}' />\n<webctrl ${webAttrs.join(' ')} />`;
  }

  // Bare CSS-ish id (#btnSubmit) → webctrl
  if (/^#[\w.-]+$/.test(selector)) {
    const id = selector.slice(1);
    return `<html app='chrome.exe' title='*' />\n<webctrl tag='*' id='${escapeSel(id)}' />`;
  }

  // Bare element id token
  if (/^[\w.-]+$/.test(selector) && selector.length < 80) {
    return `<html app='chrome.exe' title='*' />\n<webctrl tag='*' id='${escapeSel(selector)}' />`;
  }

  return selector;
}

/** True when the selector looks like a Windows classic UiPath selector. */
export function isWindowsClassicSelector(selector: string): boolean {
  const s = selector.trim();
  if (!s) {
    return false;
  }
  return /<(html|webctrl|wnd|java|sap|ctrl)\b/i.test(s);
}

/** True when selector is still a design placeholder (not runnable on Windows). */
export function isPlaceholderSelector(selector: string): boolean {
  const s = selector.trim();
  if (!s) {
    return true;
  }
  return /<target\b/i.test(s) || s === '<target />';
}

export function netTfmForTarget(target: UiPathTargetFramework): string {
  return target === 'Windows' ? WINDOWS_NET_TFM : PORTABLE_NET_TFM;
}

export function resolveUiPathTarget(
  preferred?: string | null
): UiPathTargetFramework {
  if (preferred === 'Portable' || preferred === 'Windows') {
    return preferred;
  }
  return DEFAULT_UIPATH_TARGET;
}

/**
 * Apply Windows selector normalization onto UI activity property bags before XAML export.
 */
export function applyWindowsSelectorsToActivityProps(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...properties };
  if (next.selector !== undefined) {
    const normalized = normalizeWindowsSelector(next.selector);
    if (normalized) {
      next.selector = normalized;
    }
  }
  return next;
}

function parseXmlishAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:@\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

function escapeSel(value: string): string {
  return String(value).replace(/'/g, "''");
}

/** Sample Windows web selector shown as activity default. */
export function windowsWebSelectorExample(opts: {
  id?: string;
  tag?: string;
  aaname?: string;
  app?: string;
}): string {
  const tag = (opts.tag || 'BUTTON').toUpperCase();
  const app = opts.app || 'chrome.exe';
  const parts = [`tag='${tag}'`];
  if (opts.id) {
    parts.push(`id='${opts.id}'`);
  }
  if (opts.aaname) {
    parts.push(`aaname='${opts.aaname}'`);
  }
  return `<html app='${app}' title='*' />\n<webctrl ${parts.join(' ')} />`;
}
