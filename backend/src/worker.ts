import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { WorkerModule } from './worker.module';
import {
  describeInvimaSyncSchedule,
  resolveInvimaSyncCron,
} from './workers/invima-sync-cron.util';

// #region agent log
function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  const payload = {
    sessionId: 'f1fab5',
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
  };
  console.log('[DEBUG f1fab5]', JSON.stringify(payload));
  fetch('http://127.0.0.1:7556/ingest/8e591fd1-1e41-41a0-8746-b858bc2fbdf6', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'f1fab5',
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

async function clearRepeatableJobs(queue: Queue, names: string[]): Promise<void> {
  const repeatable = await queue.getRepeatableJobs();
  for (const job of repeatable) {
    if (names.includes(job.name)) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();

  const config = app.get(ConfigService);

  const hrQueue = app.get<Queue>(getQueueToken('hr-sync'));
  await clearRepeatableJobs(hrQueue, ['sync']);
  await hrQueue.add(
    'sync',
    {},
    {
      repeat: { cron: '0 */6 * * *' },
      jobId: 'hr-sync-cron',
    },
  );

  const invimaQueue = app.get<Queue>(getQueueToken('invima-sync'));
  const invimaSchedule = resolveInvimaSyncCron(config);

  await clearRepeatableJobs(invimaQueue, ['daily']);

  if (invimaSchedule.enabled) {
    await invimaQueue.add(
      'daily',
      {},
      {
        repeat: { cron: invimaSchedule.cron, tz: invimaSchedule.tz },
        jobId: 'invima-sync-daily',
      },
    );
    const repeatable = await invimaQueue.getRepeatableJobs();
    // #region agent log
    agentDebugLog(
      'worker.ts:bootstrap',
      'INVIMA repeatable cron registered',
      {
        cron: invimaSchedule.cron,
        tz: invimaSchedule.tz,
        enabled: invimaSchedule.enabled,
        serverUtc: new Date().toISOString(),
        repeatable: repeatable.map((j) => ({
          name: j.name,
          cron: j.cron,
          tz: j.tz,
          nextUtc: j.next != null ? new Date(j.next).toISOString() : null,
        })),
      },
      'H1-H4',
    );
    // #endregion
    console.log(
      `Worker started — HR sync cada 6 h; ${describeInvimaSyncSchedule(invimaSchedule.cron, invimaSchedule.tz)}`,
    );
  } else {
    // #region agent log
    agentDebugLog(
      'worker.ts:bootstrap',
      'INVIMA cron disabled',
      { enabled: false, serverUtc: new Date().toISOString() },
      'H2',
    );
    // #endregion
    console.log(
      'Worker started — HR sync cada 6 h; INVIMA sync diario deshabilitado (INVIMA_SYNC_CRON_ENABLED=false)',
    );
  }
}
bootstrap();
