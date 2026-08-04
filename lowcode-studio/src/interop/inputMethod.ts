/**
 * Modern UiPath UI Automation input methods.
 * XAML uses InteractionMode on uia:NClick / NTypeInto / NApplicationCard.
 * Chromium API is stored as DebuggerApi in XAML.
 */

export const UI_INPUT_METHOD_OPTIONS = [
  'Same as App/Browser',
  'Simulate',
  'Chromium API',
  'Window Messages',
  'Hardware Events'
] as const;

export const SCOPE_INPUT_METHOD_OPTIONS = [
  'Simulate',
  'Chromium API',
  'Window Messages',
  'Hardware Events',
  'Background'
] as const;

export type UiInputMethod = (typeof UI_INPUT_METHOD_OPTIONS)[number];
export type ScopeInputMethod = (typeof SCOPE_INPUT_METHOD_OPTIONS)[number];

const LABEL_TO_XAML: Record<string, string> = {
  'Same as App/Browser': 'SameAsCard',
  Simulate: 'Simulate',
  'Chromium API': 'DebuggerApi',
  'Window Messages': 'WindowMessages',
  'Hardware Events': 'HardwareEvents',
  Background: 'Background'
};

const XAML_TO_LABEL: Record<string, string> = {
  SameAsCard: 'Same as App/Browser',
  SameAsApp: 'Same as App/Browser',
  SameAsBrowser: 'Same as App/Browser',
  Simulate: 'Simulate',
  DebuggerApi: 'Chromium API',
  ChromiumAPI: 'Chromium API',
  ChromiumApi: 'Chromium API',
  WindowMessages: 'Window Messages',
  HardwareEvents: 'Hardware Events',
  Background: 'Background'
};

export function toXamlInteractionMode(label: string | undefined): string | undefined {
  if (!label || !String(label).trim()) {
    return undefined;
  }
  const key = String(label).trim();
  if (LABEL_TO_XAML[key]) {
    return LABEL_TO_XAML[key];
  }
  // already a XAML enum?
  if (XAML_TO_LABEL[key]) {
    return key;
  }
  return undefined;
}

export function fromXamlInteractionMode(raw: string | undefined): string | undefined {
  if (!raw || !String(raw).trim()) {
    return undefined;
  }
  const key = String(raw).trim().replace(/^NInteractionMode\./, '');
  return XAML_TO_LABEL[key] || undefined;
}

/**
 * Resolve designer input method from properties, including legacy simulateClick.
 */
export function resolveInputMethod(
  props: Record<string, unknown> | undefined,
  fallback: string = 'Same as App/Browser'
): string {
  const p = props || {};
  const fromLabel = toXamlInteractionMode(String(p.inputMethod || ''));
  if (fromLabel) {
    return fromXamlInteractionMode(fromLabel) || fallback;
  }
  if (p.simulateClick === true || p.simulateClick === 'true') {
    return 'Simulate';
  }
  if (p.simulateClick === false || p.simulateClick === 'false') {
    return 'Hardware Events';
  }
  return fallback;
}

export function interactionModeAttribute(
  props: Record<string, unknown> | undefined,
  fallback?: string
): string {
  const label = resolveInputMethod(props, fallback || '');
  const mode = toXamlInteractionMode(label);
  if (!mode) {
    return '';
  }
  return ` InteractionMode="${mode}"`;
}
