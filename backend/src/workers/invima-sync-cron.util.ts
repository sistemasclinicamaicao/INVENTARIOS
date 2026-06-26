/** Cron Bull del job diario INVIMA (sync + alertas). Formato estándar de 5 campos. */
export function resolveInvimaSyncCron(config: {
  get: (key: string) => string | undefined;
}): { cron: string; tz: string; enabled: boolean } {
  const cron = String(config.get('INVIMA_SYNC_CRON') ?? '0 6 * * *').trim();
  const tz = String(config.get('INVIMA_SYNC_CRON_TZ') ?? 'America/Bogota').trim();
  const enabledRaw = String(config.get('INVIMA_SYNC_CRON_ENABLED') ?? 'true')
    .trim()
    .toLowerCase();
  const enabled = enabledRaw !== 'false' && enabledRaw !== '0' && enabledRaw !== 'no';
  return { cron, tz, enabled };
}

export function describeInvimaSyncSchedule(cron: string, tz: string): string {
  return `INVIMA sync diario — cron "${cron}" (${tz})`;
}
