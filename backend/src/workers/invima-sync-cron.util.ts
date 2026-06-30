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

/** Descripción legible de la expresión cron estándar de 5 campos (min hora dom mes dow). */
export function formatInvimaSyncCronHuman(cron: string, tz: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length >= 2) {
    const [minRaw, hourRaw] = parts;
    if (/^\d+$/.test(minRaw) && /^\d+$/.test(hourRaw)) {
      const hour = parseInt(hourRaw, 10);
      const minute = parseInt(minRaw, 10);
      const h12 = hour % 12 || 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const mm = minute > 0 ? `:${String(minute).padStart(2, '0')}` : '';
      return `Todos los días a las ${h12}${mm} ${ampm}, ${tz}`;
    }
  }
  return `Expresión cron "${cron}" (${tz})`;
}
