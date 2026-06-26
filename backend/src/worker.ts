import { NestFactory } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();

  const hrQueue = app.get<Queue>(getQueueToken('hr-sync'));
  await hrQueue.add(
    'sync',
    {},
    {
      repeat: { cron: '0 */6 * * *' },
      jobId: 'hr-sync-cron',
    },
  );

  const invimaQueue = app.get<Queue>(getQueueToken('invima-sync'));
  await invimaQueue.add(
    'daily',
    {},
    {
      repeat: { cron: '0 6 * * *', tz: 'America/Bogota' },
      jobId: 'invima-sync-daily',
    },
  );

  console.log('Worker started — HR sync cada 6 h; INVIMA sync diario 6:00 America/Bogota');
}
bootstrap();
