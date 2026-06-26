import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { WorkerModule } from './worker.module';
import {
  describeInvimaSyncSchedule,
  resolveInvimaSyncCron,
} from './workers/invima-sync-cron.util';

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
    console.log(
      `Worker started — HR sync cada 6 h; ${describeInvimaSyncSchedule(invimaSchedule.cron, invimaSchedule.tz)}`,
    );
  } else {
    console.log(
      'Worker started — HR sync cada 6 h; INVIMA sync diario deshabilitado (INVIMA_SYNC_CRON_ENABLED=false)',
    );
  }
}
bootstrap();
