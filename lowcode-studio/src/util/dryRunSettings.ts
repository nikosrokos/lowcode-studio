/**
 * Map VS Code `lowcodeStudio.dryRun.*` settings into DryRunOptions fields (C2).
 * Kept free of the vscode module so unit tests can call it with a plain bag.
 */
export interface DryRunSettingsBag {
  realHttp: boolean;
  httpAllowHosts: string[];
  httpTimeoutMs: number;
  realPython: boolean;
  pythonTimeoutMs: number;
}

export interface ConfigLike {
  get<T>(section: string, defaultValue: T): T;
}

export function readDryRunSettings(config: ConfigLike): DryRunSettingsBag {
  const hosts = config.get<string[]>('dryRun.httpAllowHosts', []);
  return {
    realHttp: Boolean(config.get('dryRun.realHttp', false)),
    httpAllowHosts: Array.isArray(hosts) ? hosts.map(String).filter(Boolean) : [],
    httpTimeoutMs: Number(config.get('dryRun.httpTimeoutMs', 10000)) || 10000,
    realPython: Boolean(config.get('dryRun.realPython', false)),
    pythonTimeoutMs: Number(config.get('dryRun.pythonTimeoutMs', 15000)) || 15000
  };
}
