export interface WhatsNewSection {
  version: string;
  body: string;
}

/**
 * Parse the top release section(s) from CHANGELOG.md (Keep a Changelog style).
 */
export function parseChangelogSections(
  markdown: string,
  limit = 3
): WhatsNewSection[] {
  const text = String(markdown || '').replace(/\r\n/g, '\n');
  const parts = text.split(/^## /m).slice(1);
  const sections: WhatsNewSection[] = [];
  for (const part of parts) {
    if (sections.length >= limit) {
      break;
    }
    const nl = part.indexOf('\n');
    const header = (nl === -1 ? part : part.slice(0, nl)).trim();
    const body = (nl === -1 ? '' : part.slice(nl + 1)).trim();
    const versionMatch = header.match(/^\[([^\]]+)\]/);
    const version = (versionMatch?.[1] || header).trim();
    if (!version || version.toLowerCase() === 'unreleased') {
      continue;
    }
    sections.push({ version, body });
  }
  return sections;
}

export function formatWhatsNewReport(
  packageVersion: string,
  sections: WhatsNewSection[]
): string {
  const lines = [
    `LowCode Studio — What's new (v${packageVersion})`,
    '─'.repeat(48)
  ];
  if (!sections.length) {
    lines.push('No CHANGELOG sections found.');
    return lines.join('\n');
  }
  for (const s of sections) {
    lines.push('');
    lines.push(`## ${s.version}`);
    lines.push(s.body);
  }
  return lines.join('\n');
}
