import { NestFactory } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();

  const queue = app.get<Queue>(getQueueToken('hr-sync'));
  await queue.add(
    'sync',
    {},
    {
      repeat: { cron: '0 */6 * * *' },
      jobId: 'hr-sync-cron',
    },
  );
  console.log('Worker started — HR sync programado cada 6 horas');
}
bootstrap();
