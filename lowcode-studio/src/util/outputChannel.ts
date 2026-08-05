import * as vscode from 'vscode';

/** Shared Output channel — one instance for the whole extension. */
let channel: vscode.OutputChannel | undefined;

export function getLowCodeOutput(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('LowCode Studio');
  }
  return channel;
}

/** Append a timestamped notification / status line (Save, Validate, button feedback). */
export function logNotification(message: string, show = false): void {
  const out = getLowCodeOutput();
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  out.appendLine(`[${stamp}] ${message}`);
  if (show) {
    out.show(true);
  }
}

/** Clear and write a multi-line run report (dry-run / validate / scenarios). */
export function logRunReport(title: string, bodyLines: string[], show = true): void {
  const out = getLowCodeOutput();
  out.clear();
  out.appendLine(title);
  out.appendLine('─'.repeat(48));
  for (const line of bodyLines) {
    out.appendLine(line);
  }
  if (show) {
    out.show(true);
  }
}

export function appendRunLog(lines: string[]): void {
  const out = getLowCodeOutput();
  for (const line of lines) {
    out.appendLine(line);
  }
}
