import { Module } from '@nestjs/common';
import { MastersModule } from '../masters/masters.module';
import { ExternalIntegrationsService } from './external-integrations.service';
import { HisService } from './his.service';
import { HrAdapterService } from './hr-adapter.service';
import { IntegrationHttpClient } from './integration-http.client';
import { IntegrationsController } from './integrations.controller';
import { SocrataQueryClient } from './socrata-query.client';

@Module({
  imports: [MastersModule],
  controllers: [IntegrationsController],
  providers: [
    HisService,
    HrAdapterService,
    ExternalIntegrationsService,
    IntegrationHttpClient,
    SocrataQueryClient,
  ],
  exports: [HrAdapterService, HisService, ExternalIntegrationsService],
})
export class IntegrationsModule {}
