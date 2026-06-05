import { ConfigService } from '@nestjs/config';

/** Opciones ioredis tolerantes a Redis aún no disponible (Easypanel). */
export function redisIoOptions(config: ConfigService) {
  const raw = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password ? decodeURIComponent(u.password) : undefined,
    username: u.username || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times: number) => Math.min(times * 300, 3000),
  };
}
