import assert from 'assert';
import {
  applyTemplate,
  buildWindowsSelector,
  parseWindowsSelector,
  scoreSelector,
  SELECTOR_TEMPLATES,
  tryDecodeSelectorPaste
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

  // Specificity scoring
  const emptyQ = scoreSelector('');
  assert.strictEqual(emptyQ.level, 'empty');
  assert.ok(emptyQ.cardMessage.includes('missing'));

  const starterQ = scoreSelector(specific.replace('checkout', 'btnSubmit'));
  assert.strictEqual(starterQ.level, 'placeholder');

  const strongQ = scoreSelector(
    buildWindowsSelector({
      kind: 'browser',
      app: 'chrome.exe',
      title: 'Checkout*',
      tag: 'BUTTON',
      id: 'checkoutBtn',
      aaname: 'Pay now'
    })
  );
  assert.ok(strongQ.score >= 70, `expected strong score, got ${strongQ.score}`);
  assert.strictEqual(strongQ.level, 'strong');

  const weakQ = scoreSelector(
    buildWindowsSelector({
      kind: 'browser',
      app: 'chrome.exe',
      title: '*',
      tag: 'BUTTON',
      idx: '1'
    })
  );
  assert.ok(
    weakQ.level === 'weak' || weakQ.level === 'placeholder' || weakQ.score < 70,
    `idx-only should not be strong: ${weakQ.level}/${weakQ.score}`
  );

  // Paste decode
  assert.strictEqual(
    tryDecodeSelectorPaste('#orderId'),
    "<html app='chrome.exe' title='*' />\n<webctrl tag='*' id='orderId' />"
  );
  const classicPaste = tryDecodeSelectorPaste(
    "noise <html app='chrome.exe' title='*' />\n<webctrl tag='INPUT' id='email' /> trailing"
  );
  assert.ok(classicPaste && classicPaste.includes("id='email'"));

  const webOnly = tryDecodeSelectorPaste("<webctrl tag='A' aaname='Next' />");
  assert.ok(webOnly && webOnly.includes('webctrl') && webOnly.includes('aaname'));

  console.log('selectorBuilder.test.ts: all assertions passed');
}

run();
