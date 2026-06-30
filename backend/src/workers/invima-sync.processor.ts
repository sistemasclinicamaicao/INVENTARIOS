import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InvimaAlertService } from '../integrations/invima-alert.service';

@Processor('invima-sync')
export class InvimaSyncProcessor {
  private readonly logger = new Logger(InvimaSyncProcessor.name);

  constructor(private readonly invimaAlert: InvimaAlertService) {}

  @Process('daily')
  async handleDaily(job: Job) {
    // #region agent log
    fetch('http://127.0.0.1:7556/ingest/8e591fd1-1e41-41a0-8746-b858bc2fbdf6', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'f1fab5',
      },
      body: JSON.stringify({
        sessionId: 'f1fab5',
        location: 'invima-sync.processor.ts:handleDaily',
        message: 'INVIMA daily job triggered',
        data: { jobId: job.id, serverUtc: new Date().toISOString() },
        hypothesisId: 'H5',
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    console.log(
      '[DEBUG f1fab5]',
      JSON.stringify({
        sessionId: 'f1fab5',
        location: 'invima-sync.processor.ts:handleDaily',
        message: 'INVIMA daily job triggered',
        data: { jobId: job.id, serverUtc: new Date().toISOString() },
        hypothesisId: 'H5',
        timestamp: Date.now(),
      }),
    );
    // #endregion
    this.logger.log(`INVIMA sync job ${job.id} started`);
    const result = await this.invimaAlert.runDailyInvimaJob();
    const emails =
      'emailsSent' in result
        ? result.emailsSent
        : { vencidos: false, sinRegistro: false, sinCum: false };
    this.logger.log(
      `INVIMA sync job ${job.id} finished — ok=${result.ok} emails=${JSON.stringify(emails)}`,
    );
    return result;
  }
}
