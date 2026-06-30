import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MastersModule } from '../masters/masters.module';
import { MailModule } from '../mail/mail.module';
import { ExternalIntegrationsService } from './external-integrations.service';
import { InvimaAlertService } from './invima-alert.service';
import { InvimaSyncDiagnosticsService } from './invima-sync-diagnostics.service';
import { HisService } from './his.service';
import { HrAdapterService } from './hr-adapter.service';
import { IntegrationHttpClient } from './integration-http.client';
import { IntegrationsController } from './integrations.controller';
import { SocrataQueryClient } from './socrata-query.client';

@Module({
  imports: [BullModule.registerQueue({ name: 'invima-sync' }), MastersModule, MailModule],
  controllers: [IntegrationsController],
  providers: [
    HisService,
    HrAdapterService,
    ExternalIntegrationsService,
    InvimaAlertService,
    InvimaSyncDiagnosticsService,
    IntegrationHttpClient,
    SocrataQueryClient,
  ],
  exports: [HrAdapterService, HisService, ExternalIntegrationsService, InvimaAlertService],
})
export class IntegrationsModule {}
