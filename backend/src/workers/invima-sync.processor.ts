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
