import { ConfigService } from '@nestjs/config';

/** Desarrollo local sin JWT (AUTH_DISABLED=true en .env raíz). */
export function isAuthDisabled(config: ConfigService): boolean {
  const v = String(config.get('AUTH_DISABLED') ?? '')
    .trim()
    .toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
