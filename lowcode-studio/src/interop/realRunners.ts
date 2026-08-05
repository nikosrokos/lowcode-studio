import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { URL } from 'url';
import { ActivityNode, WorkflowDocument } from '../models/workflow';
import { DryRunFixtures } from '../commands/simulator';

export interface RealRunnerOptions {
  realHttp?: boolean;
  httpAllowHosts?: string[];
  httpTimeoutMs?: number;
  realPython?: boolean;
  pythonTimeoutMs?: number;
  projectDir?: string;
}

export interface RealRunnerEnrichment {
  fixtures: DryRunFixtures;
  realActivityIds: Set<string>;
  warnings: string[];
  log: string[];
}

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|\[::1\])/i;

export function isHostAllowed(hostname: string, allowHosts: string[]): boolean {
  const host = hostname.toLowerCase();
  if (!allowHosts.length) {
    return false;
  }
  return allowHosts.some((a) => {
    const needle = a.trim().toLowerCase();
    if (!needle) {
      return false;
    }
    return host === needle || host.endsWith('.' + needle);
  });
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  return PRIVATE_HOST_RE.test(hostname);
}

/**
 * Walk the workflow and optionally perform real HTTP / Python before the sync dry-run.
 * Results are injected as fixtures so the sync engine stays unchanged.
 */
export async function enrichFixturesWithRealRunners(
  doc: WorkflowDocument,
  baseFixtures: DryRunFixtures,
  options: RealRunnerOptions
): Promise<RealRunnerEnrichment> {
  const fixtures: DryRunFixtures = {
    ...baseFixtures,
    http: { ...(baseFixtures.http || {}) }
  };
  const realActivityIds = new Set<string>();
  const warnings: string[] = [];
  const log: string[] = [];
  const pythonScopePath = findPythonScopePath(doc.activities);

  const walk = async (list: ActivityNode[]) => {
    for (const activity of list) {
      if (activity.type === 'Messaging.HttpRequest' && options.realHttp) {
        await maybeRealHttp(activity, fixtures, options, realActivityIds, warnings, log);
      }
      if (
        (activity.type === 'Python.RunScript' || activity.type === 'Python.LoadScript') &&
        options.realPython
      ) {
        maybeRealPython(
          activity,
          pythonScopePath,
          options,
          realActivityIds,
          warnings,
          log,
          fixtures
        );
      }
      if (activity.children) {
        await walk(activity.children);
      }
      if (activity.elseChildren) {
        await walk(activity.elseChildren);
      }
    }
  };
  await walk(doc.activities);
  return { fixtures, realActivityIds, warnings, log };
}

async function maybeRealHttp(
  activity: ActivityNode,
  fixtures: DryRunFixtures,
  options: RealRunnerOptions,
  realIds: Set<string>,
  warnings: string[],
  log: string[]
): Promise<void> {
  const result = String(activity.properties.result || 'response');
  const urlRaw = String(activity.properties.url || '').replace(/^"|"$/g, '');
  if (lookupHttpFixture(fixtures.http, activity.id, result, urlRaw)) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(urlRaw);
  } catch {
    warnings.push(`Real HTTP skipped for ${activity.displayName}: invalid URL`);
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    warnings.push(`Real HTTP skipped for ${activity.displayName}: only http(s) allowed`);
    return;
  }
  const allow = options.httpAllowHosts || [];
  if (!isHostAllowed(parsed.hostname, allow)) {
    warnings.push(
      `Real HTTP skipped for ${activity.displayName}: host "${parsed.hostname}" not in allow list`
    );
    return;
  }
  if (isPrivateOrLocalHost(parsed.hostname) && !isHostAllowed(parsed.hostname, allow)) {
    warnings.push(`Real HTTP blocked private host ${parsed.hostname}`);
    return;
  }

  const method = String(activity.properties.method || 'GET').toUpperCase();
  const timeoutMs = options.httpTimeoutMs ?? 10000;
  try {
    const payload = await httpRequestJson(parsed, method, timeoutMs);
    fixtures.http = fixtures.http || {};
    fixtures.http[activity.id] = payload;
    fixtures.http[result] = payload;
    fixtures.http[parsed.hostname] = payload;
    realIds.add(activity.id);
    log.push(`Real HTTP ${method} ${parsed.origin}${parsed.pathname} -> ${payload.status}`);
  } catch (err) {
    warnings.push(
      `Real HTTP failed for ${activity.displayName}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function maybeRealPython(
  activity: ActivityNode,
  scopePath: string | undefined,
  options: RealRunnerOptions,
  realIds: Set<string>,
  warnings: string[],
  log: string[],
  fixtures: DryRunFixtures
): void {
  if (!scopePath) {
    warnings.push(
      `Real Python skipped for ${activity.displayName}: set Python Scope path first`
    );
    return;
  }
  const pythonBin = resolvePythonBinary(scopePath);
  if (!pythonBin) {
    warnings.push(
      `Real Python skipped for ${activity.displayName}: no python binary under ${scopePath}`
    );
    return;
  }
  const file = String(activity.properties.file || '').replace(/^"|"$/g, '');
  const code = String(activity.properties.code || '');
  const timeout = options.pythonTimeoutMs ?? 15000;
  const cwd = options.projectDir || process.cwd();
  let args: string[];
  if (file) {
    const abs = path.isAbsolute(file) ? file : path.join(cwd, file);
    if (!fs.existsSync(abs)) {
      warnings.push(`Real Python skipped: script not found ${abs}`);
      return;
    }
    args = [abs];
  } else if (code.trim()) {
    args = ['-c', code];
  } else {
    warnings.push(`Real Python skipped for ${activity.displayName}: no file or code`);
    return;
  }
  const run = spawnSync(pythonBin, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    env: process.env,
    shell: false
  });
  if (run.error) {
    warnings.push(`Real Python failed: ${run.error.message}`);
    return;
  }
  const stdout = String(run.stdout || '').trim();
  const stderr = String(run.stderr || '').trim();
  if (run.status !== 0) {
    warnings.push(
      `Real Python exit ${run.status}${stderr ? ': ' + stderr.slice(0, 200) : ''}`
    );
  }
  const resultVar = String(activity.properties.result || 'pythonResult');
  fixtures.uiText = fixtures.uiText || {};
  // Reuse uiText map as a generic string store keyed by activity id / result
  fixtures.uiText[activity.id] = stdout;
  fixtures.uiText[resultVar] = stdout;
  realIds.add(activity.id);
  log.push(
    `Real Python ${path.basename(pythonBin)} ${file || '-c'} -> ${stdout.slice(0, 80)}${stdout.length > 80 ? '…' : ''}`
  );
}

function resolvePythonBinary(scopePath: string): string | undefined {
  const candidates = [
    scopePath,
    path.join(scopePath, 'python'),
    path.join(scopePath, 'python3'),
    path.join(scopePath, 'bin', 'python'),
    path.join(scopePath, 'bin', 'python3')
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return c;
      }
    } catch {
      // continue
    }
  }
  // Treat scopePath as a directory hint; fall back to PATH python3
  const which = spawnSync('python3', ['--version'], { encoding: 'utf8', shell: false });
  if (which.status === 0) {
    return 'python3';
  }
  const which2 = spawnSync('python', ['--version'], { encoding: 'utf8', shell: false });
  if (which2.status === 0) {
    return 'python';
  }
  return undefined;
}

function findPythonScopePath(list: ActivityNode[]): string | undefined {
  for (const a of list) {
    if (a.type === 'Python.PythonScope') {
      const p = String(a.properties.path || '').trim();
      if (p) {
        return p.replace(/^"|"$/g, '');
      }
    }
    if (a.children) {
      const nested = findPythonScopePath(a.children);
      if (nested) {
        return nested;
      }
    }
    if (a.elseChildren) {
      const nested = findPythonScopePath(a.elseChildren);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

function lookupHttpFixture(
  httpFx: Record<string, { status?: number; body?: unknown }> | undefined,
  activityId: string,
  result: string,
  url: string
): { status?: number; body?: unknown } | undefined {
  if (!httpFx) {
    return undefined;
  }
  if (httpFx[activityId]) {
    return httpFx[activityId];
  }
  if (httpFx[result]) {
    return httpFx[result];
  }
  for (const [key, val] of Object.entries(httpFx)) {
    if (url.includes(key)) {
      return val;
    }
  }
  return undefined;
}

function httpRequestJson(
  url: URL,
  method: string,
  timeoutMs: number
): Promise<{ status: number; body: unknown }> {
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method,
        timeout: timeoutMs,
        headers: { Accept: 'application/json, text/plain, */*' }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let body: unknown = raw;
          try {
            body = JSON.parse(raw);
          } catch {
            // keep text
          }
          resolve({ status: res.statusCode || 0, body });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`HTTP timeout after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}
