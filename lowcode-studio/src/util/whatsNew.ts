import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getLowCodeOutput } from './outputChannel';
import {
  formatWhatsNewReport,
  parseChangelogSections,
  WhatsNewSection
} from './changelogParse';

export type { WhatsNewSection };
export { formatWhatsNewReport, parseChangelogSections };

const LAST_SEEN_VERSION_KEY = 'lowcodeStudio.lastSeenVersion';

export function readChangelogFile(extensionPath: string): string {
  const filePath = path.join(extensionPath, 'CHANGELOG.md');
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * On activate: if extension version changed since last seen, show What's New
 * in the LowCode Studio Output channel (and an optional info toast).
 */
export async function maybeShowWhatsNew(
  context: vscode.ExtensionContext,
  packageVersion: string
): Promise<void> {
  const last = context.globalState.get<string>(LAST_SEEN_VERSION_KEY);
  if (last === packageVersion) {
    return;
  }
  await context.globalState.update(LAST_SEEN_VERSION_KEY, packageVersion);
  // First install — don't spam; mark seen quietly
  if (!last) {
    return;
  }
  const md = readChangelogFile(context.extensionPath);
  const sections = parseChangelogSections(md, 2);
  const report = formatWhatsNewReport(packageVersion, sections);
  const channel = getLowCodeOutput();
  channel.appendLine('');
  channel.appendLine(report);
  const pick = await vscode.window.showInformationMessage(
    `LowCode Studio updated to v${packageVersion}`,
    "View What's New",
    'Dismiss'
  );
  if (pick === "View What's New") {
    channel.show(true);
  }
}

export async function showWhatsNewCommand(
  context: vscode.ExtensionContext,
  packageVersion: string
): Promise<void> {
  const md = readChangelogFile(context.extensionPath);
  const sections = parseChangelogSections(md, 5);
  const report = formatWhatsNewReport(packageVersion, sections);
  const channel = getLowCodeOutput();
  channel.clear();
  channel.appendLine(report);
  channel.show(true);

  const changelogPath = path.join(context.extensionPath, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const open = await vscode.window.showInformationMessage(
      `What's new — v${packageVersion} (also see CHANGELOG.md)`,
      'Open CHANGELOG'
    );
    if (open === 'Open CHANGELOG') {
      await vscode.window.showTextDocument(vscode.Uri.file(changelogPath), {
        preview: true
      });
    }
  }
}
