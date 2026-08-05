import assert from 'assert';
import {
  applyTemplate,
  buildWindowsSelector,
  parseWindowsSelector,
  SELECTOR_TEMPLATES
} from '../interop/selectorBuilder';

function run(): void {
  assert.ok(SELECTOR_TEMPLATES.length >= 5);

  const browser = buildWindowsSelector({
    kind: 'browser',
    app: 'chrome.exe',
    title: 'Orders*',
    tag: 'BUTTON',
    id: 'btnSubmit'
  });
  assert.ok(browser.includes("<html app='chrome.exe' title='Orders*' />"));
  assert.ok(browser.includes("<webctrl tag='BUTTON' id='btnSubmit' />"));

  const desktop = buildWindowsSelector({
    kind: 'desktop',
    app: 'notepad.exe',
    cls: 'Notepad',
    title: 'Untitled*'
  });
  assert.strictEqual(
    desktop,
    "<wnd app='notepad.exe' cls='Notepad' title='Untitled*' />"
  );

  const parsedBrowser = parseWindowsSelector(browser);
  assert.strictEqual(parsedBrowser.kind, 'browser');
  assert.strictEqual(parsedBrowser.app, 'chrome.exe');
  assert.strictEqual(parsedBrowser.tag, 'BUTTON');
  assert.strictEqual(parsedBrowser.id, 'btnSubmit');

  const parsedDesktop = parseWindowsSelector(desktop);
  assert.strictEqual(parsedDesktop.kind, 'desktop');
  assert.strictEqual(parsedDesktop.app, 'notepad.exe');
  assert.strictEqual(parsedDesktop.cls, 'Notepad');

  const fromTpl = applyTemplate('chrome-button');
  assert.ok(fromTpl.includes('chrome.exe'));
  assert.ok(fromTpl.includes("tag='BUTTON'"));

  const edge = applyTemplate('edge-link');
  assert.ok(edge.includes('msedge.exe'));
  assert.ok(edge.includes("tag='A'"));

  const roundTrip = buildWindowsSelector(parseWindowsSelector(fromTpl));
  assert.ok(roundTrip.includes('webctrl'));

  const specific = buildWindowsSelector({
    kind: 'browser',
    app: 'chrome.exe',
    title: '*',
    tag: 'BUTTON',
    id: 'checkout'
  });
  assert.ok(specific.includes("id='checkout'"));

  console.log('selectorBuilder.test.ts: all assertions passed');
}

run();
