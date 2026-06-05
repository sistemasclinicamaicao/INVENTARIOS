import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { HrAdapterService } from '../integrations/hr-adapter.service';

@Processor('hr-sync')
export class HrSyncProcessor {
  private readonly logger = new Logger(HrSyncProcessor.name);

  constructor(private readonly hrAdapter: HrAdapterService) {}

  @Process('sync')
  async handleSync(job: Job) {
    this.logger.log(`HR sync job ${job.id} started`);
    const result = await this.hrAdapter.syncToDatabase();
    this.logger.log(`HR sync done: ${result.recordsProcessed} from ${result.source}`);
    return result;
  }
}
