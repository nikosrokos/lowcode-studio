import * as fs from 'fs';
import * as path from 'path';
import { dryRunWorkflow, DryRunResult } from './simulator';
import { parseWorkflow, WorkflowDocument } from '../models/workflow';

export const SCENARIOS_FILENAME = 'Data/Test/scenarios.json';

export interface ScenarioExpect {
  ok?: boolean;
  /** Loose equality checks against final dry-run variables */
  variables?: Record<string, unknown>;
  logIncludes?: string[];
  minSteps?: number;
}

export interface DryRunScenario {
  name: string;
  description?: string;
  /** Overrides merged into Data/Config.json before the run */
  configOverrides?: Record<string, unknown>;
  /** Initial workflow variables (merged over defaults + Config) */
  variables?: Record<string, unknown>;
  expect?: ScenarioExpect;
}

export interface ScenariosFile {
  schemaVersion: '1.0';
  scenarios: DryRunScenario[];
}

export interface ScenarioRunResult {
  scenario: DryRunScenario;
  dryRun: DryRunResult;
  assertions: { ok: boolean; message: string }[];
  passed: boolean;
  config: Record<string, unknown>;
}

export function defaultScenariosFile(projectName: string): ScenariosFile {
  return {
    schemaVersion: '1.0',
    scenarios: [
      {
        name: 'happy-path',
        description: 'Init → process MaxTransactions items → End Process',
        variables: {
          MaxTransactions: 3,
          MaxRetryNumber: 2,
          TransactionNumber: 1,
          RetryNumber: 0
        },
        expect: {
          ok: true,
          variables: { TransactionItem: null },
          logIncludes: ['InvokeWorkflow', 'no more items', 'CloseAllApplications'],
          minSteps: 5
        }
      },
      {
        name: 'no-transactions',
        description: 'Queue empty — skip Process and go to End',
        variables: {
          MaxTransactions: 0,
          TransactionNumber: 1,
          TransactionItem: null
        },
        expect: {
          ok: true,
          logIncludes: ['CloseAllApplications'],
          variables: { TransactionItem: null }
        }
      },
      {
        name: 'single-item',
        description: 'One transaction then stop',
        configOverrides: {
          Settings: { MaxTransactions: 1 }
        },
        variables: {
          MaxTransactions: 1,
          TransactionNumber: 1
        },
        expect: {
          ok: true,
          logIncludes: ['Process completed', 'CloseAllApplications'],
          minSteps: 4
        }
      }
    ].map((s) => ({
      ...s,
      description: `${s.description} (${projectName})`
    }))
  };
}

export function loadConfigJson(projectDir: string): Record<string, unknown> {
  const configPath = path.join(projectDir, 'Data', 'Config.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function loadScenariosFile(projectDir: string): ScenariosFile {
  const filePath = path.join(projectDir, SCENARIOS_FILENAME);
  if (!fs.existsSync(filePath)) {
    return { schemaVersion: '1.0', scenarios: [] };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ScenariosFile;
  return {
    schemaVersion: '1.0',
    scenarios: Array.isArray(raw.scenarios) ? raw.scenarios : []
  };
}

export function ensureScenariosFile(projectDir: string, projectName: string): ScenariosFile {
  const filePath = path.join(projectDir, SCENARIOS_FILENAME);
  if (fs.existsSync(filePath)) {
    return loadScenariosFile(projectDir);
  }
  const file = defaultScenariosFile(projectName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf8');
  return file;
}

export function deepMerge(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function variablesFromConfig(config: Record<string, unknown>): Record<string, unknown> {
  const settings = (config.Settings || {}) as Record<string, unknown>;
  const constants = (config.Constants || {}) as Record<string, unknown>;
  const vars: Record<string, unknown> = {
    Config: config
  };
  if (settings.MaxRetryNumber !== undefined) {
    vars.MaxRetryNumber = settings.MaxRetryNumber;
  }
  if (settings.MaxTransactions !== undefined) {
    vars.MaxTransactions = settings.MaxTransactions;
  }
  if (settings.TimeoutMS !== undefined) {
    vars.TimeoutMS = settings.TimeoutMS;
  }
  if (constants.OrchestratorQueueName !== undefined) {
    vars.OrchestratorQueueName = constants.OrchestratorQueueName;
  }
  return vars;
}

export function runScenario(
  projectDir: string,
  scenario: DryRunScenario,
  mainDoc?: WorkflowDocument
): ScenarioRunResult {
  const mainPath = path.join(projectDir, 'Main.lcs.json');
  const doc =
    mainDoc ||
    (fs.existsSync(mainPath)
      ? parseWorkflow(fs.readFileSync(mainPath, 'utf8'))
      : undefined);
  if (!doc) {
    throw new Error('REFramework Main.lcs.json not found in project.');
  }

  const baseConfig = loadConfigJson(projectDir);
  const config = scenario.configOverrides
    ? deepMerge(baseConfig, scenario.configOverrides)
    : baseConfig;

  const initialVariables: Record<string, unknown> = {
    ...variablesFromConfig(config),
    ...(scenario.variables || {})
  };

  // Ensure Config object stays consistent with overrides
  initialVariables.Config = config;

  const dryRun = dryRunWorkflow(doc, { initialVariables });
  const assertions = evaluateExpect(scenario.expect, dryRun);
  const passed = assertions.every((a) => a.ok);

  return { scenario, dryRun, assertions, passed, config };
}

export function runAllScenarios(projectDir: string): ScenarioRunResult[] {
  const manifestPath = path.join(projectDir, 'project.json');
  let projectName = path.basename(projectDir);
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { name?: string };
      projectName = manifest.name || projectName;
    } catch {
      // ignore
    }
  }
  const file = ensureScenariosFile(projectDir, projectName);
  return file.scenarios.map((s) => runScenario(projectDir, s));
}

export function evaluateExpect(
  expect: ScenarioExpect | undefined,
  dryRun: DryRunResult
): { ok: boolean; message: string }[] {
  if (!expect) {
    return [{ ok: true, message: 'No assertions (dry-run only).' }];
  }
  const results: { ok: boolean; message: string }[] = [];

  if (expect.ok !== undefined) {
    results.push({
      ok: dryRun.ok === expect.ok,
      message: `ok === ${expect.ok} (actual ${dryRun.ok})`
    });
  }

  if (expect.minSteps !== undefined) {
    results.push({
      ok: dryRun.steps.length >= expect.minSteps,
      message: `steps >= ${expect.minSteps} (actual ${dryRun.steps.length})`
    });
  }

  for (const fragment of expect.logIncludes || []) {
    const hit = dryRun.log.some((line) => line.includes(fragment));
    results.push({
      ok: hit,
      message: hit ? `log includes "${fragment}"` : `log missing "${fragment}"`
    });
  }

  for (const [name, expected] of Object.entries(expect.variables || {})) {
    const actual = dryRun.variables[name];
    const match = looseEqual(actual, expected);
    results.push({
      ok: match,
      message: match
        ? `var ${name} matches`
        : `var ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    });
  }

  return results.length ? results : [{ ok: true, message: 'No assertions.' }];
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a == null && b == null) {
    return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export function formatScenarioReport(results: ScenarioRunResult[]): string {
  const lines: string[] = ['REFramework scenario dry-run', '─'.repeat(48)];
  for (const r of results) {
    lines.push(`${r.passed ? 'PASS' : 'FAIL'}  ${r.scenario.name}`);
    if (r.scenario.description) {
      lines.push(`  ${r.scenario.description}`);
    }
    for (const a of r.assertions) {
      lines.push(`  ${a.ok ? '✓' : '✗'} ${a.message}`);
    }
    lines.push(`  steps=${r.dryRun.steps.length} ok=${r.dryRun.ok}`);
    lines.push('');
  }
  const passed = results.filter((r) => r.passed).length;
  lines.push(`Summary: ${passed}/${results.length} passed`);
  return lines.join('\n');
}
