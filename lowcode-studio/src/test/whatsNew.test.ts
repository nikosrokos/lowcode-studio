import assert from 'assert';
import {
  formatWhatsNewReport,
  parseChangelogSections
} from '../util/changelogParse';

function run(): void {
  const md = `# Changelog

## [Unreleased]

- WIP

## [0.6.27] — 2026-08-05

### Added
- A3 Selectors
- CHANGELOG

## [0.6.26] — 2026-08-05

### Added
- Settings popup
`;

  const sections = parseChangelogSections(md, 3);
  assert.strictEqual(sections.length, 2);
  assert.strictEqual(sections[0].version, '0.6.27');
  assert.ok(sections[0].body.includes('A3 Selectors'));
  assert.strictEqual(sections[1].version, '0.6.26');

  const report = formatWhatsNewReport('0.6.27', sections);
  assert.ok(report.includes("What's new"));
  assert.ok(report.includes('0.6.27'));
  assert.ok(report.includes('Settings popup'));

  console.log('whatsNew.test.ts: all assertions passed');
}

run();
