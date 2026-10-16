// Side-effect free so tests can import it without the logger or database clients.
export class CacheJobsConfig {
  static readonly TIMEZONE = "America/Sao_Paulo";
  static readonly DEFAULT_ATENDIMENTOS_REFRESH_PATTERN = "0 1 * * *";

  static isEnabled(flag: string | undefined): boolean {
    return flag === "true";
  }

  // hmg shares the VM with prod, so it overrides the default to avoid concurrent refreshes.
  static atendimentosRefreshPattern(override: string | undefined): string {
    return override?.trim() || CacheJobsConfig.DEFAULT_ATENDIMENTOS_REFRESH_PATTERN;
  }
}
