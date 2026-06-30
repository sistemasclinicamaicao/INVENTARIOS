import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateExternalIntegrationDto } from './dto/create-external-integration.dto';
import { SyncSocrataDto } from './dto/sync-socrata.dto';
import { UpdateExternalIntegrationDto } from './dto/update-external-integration.dto';
import { HisPrescriptionDto } from './dto/his-prescription.dto';
import { ExternalIntegrationsService } from './external-integrations.service';
import { HisService } from './his.service';
import { HrAdapterService } from './hr-adapter.service';
import { InvimaAlertService } from './invima-alert.service';
import { InvimaSyncDiagnosticsService } from './invima-sync-diagnostics.service';
import {
  describeInvimaSyncSchedule,
  formatInvimaSyncCronHuman,
  resolveInvimaSyncCron,
} from '../workers/invima-sync-cron.util';

/** Solo UUID en :id; evita que rutas estáticas (sync-schedule, sync-diagnostics, etc.) caigan en external/:id. */
const EXT_INTEGRATION_ID =
  ':id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly hisService: HisService,
    private readonly hrAdapter: HrAdapterService,
    private readonly config: ConfigService,
    private readonly externalIntegrations: ExternalIntegrationsService,
    private readonly invimaAlert: InvimaAlertService,
    private readonly invimaSyncDiagnostics: InvimaSyncDiagnosticsService,
  ) {}

  @Public()
  @Post('his/prescriptions')
  hisPrescription(
    @Headers('x-his-secret') secret: string,
    @Body() dto: HisPrescriptionDto,
  ) {
    this.hisService.validateSecret(secret);
    return this.hisService.ingestPrescription(dto);
  }

  @RequirePermissions('admin.users')
  @Get('hr/status')
  async hrStatus() {
    const users = await this.hrAdapter.fetchUsers();
    return {
      source: this.config.get('HR_USE_MOCK') === 'true' ? 'mock' : 'api',
      count: users.length,
    };
  }

  @RequirePermissions('admin.users')
  @Post('hr/sync')
  triggerHrSync() {
    return this.hrAdapter.syncToDatabase();
  }

  @RequirePermissions('admin.users')
  @Get('external')
  listExternal() {
    return this.externalIntegrations.list();
  }

  @RequirePermissions('admin.users')
  @Post('external')
  createExternal(@Body() dto: CreateExternalIntegrationDto) {
    return this.externalIntegrations.create(dto);
  }

  @RequirePermissions('reception.manage')
  @Get('external/poll-active/purchase-orders/:number')
  pollActivePurchaseOrder(@Param('number') number: string) {
    return this.externalIntegrations.pollActivePurchaseOrder(number);
  }

  @RequirePermissions('reception.manage')
  @Get('external/rest/krystalos-invimaf-estados')
  krystalosInvimaEstados(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('refresh') refresh?: string,
    @Query('estado') estado?: string,
    @Query('codigo') codigo?: string,
    @Query('cum') cum?: string,
    @Query('descripcion') descripcion?: string,
    @Query('listType') listType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const allowed = [
      'ALL',
      'MATCHED',
      'NOT_MATCHED',
      'VIGENTE',
      'VENCIDO',
      'RENOVACION',
      'SIN_CUM',
      'OTRO',
      'REGULADOS',
    ] as const;
    const estadoFilter = allowed.includes(estado as (typeof allowed)[number])
      ? (estado as (typeof allowed)[number])
      : 'ALL';
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.externalIntegrations.queryKrystalosInvimaEstados(
      q,
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50,
      refresh === 'true' || refresh === '1',
      estadoFilter,
      codigo,
      cum,
      descripcion,
      listType,
      sortBy,
      sortDir === 'asc' || sortDir === 'desc' ? sortDir : undefined,
    );
  }

  @RequirePermissions('reception.manage')
  @Get('external/rest/krystalos-medicamentos')
  krystalosMedicamentos(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('refresh') refresh?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.externalIntegrations.queryKrystalosMedicamentos(
      q,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      refresh === 'true' || refresh === '1',
      sortBy,
      sortDir === 'asc' || sortDir === 'desc' ? sortDir : undefined,
    );
  }

  @RequirePermissions('reception.manage')
  @Get('external/rest/medicamentos-pos')
  medicamentosPos(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.externalIntegrations.queryMedicamentosPos(
      q,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      refresh === 'true' || refresh === '1',
    );
  }

  @RequirePermissions('admin.users')
  @Post('external/invima/send-test-alert')
  sendInvimaTestAlert() {
    return this.invimaAlert.sendTestVencidosAlert();
  }

  @RequirePermissions('admin.users')
  @Post('external/invima/send-test-sin-registro-alert')
  sendInvimaTestSinRegistroAlert() {
    return this.invimaAlert.sendTestSinRegistroAlert();
  }

  @RequirePermissions('admin.users')
  @Post('external/invima/send-real-estados-alerts')
  sendRealEstadosAlerts() {
    return this.invimaAlert.sendRealEstadosAlerts(true);
  }

  @RequirePermissions('admin.users')
  @Post('external/invima/send-test-sin-cum-alert')
  sendInvimaTestSinCumAlert() {
    return this.invimaAlert.sendTestSinCumAlert();
  }

  @RequirePermissions('admin.users')
  @Post('external/invima/run-daily-job')
  runInvimaDailyJob() {
    return this.invimaAlert.runDailyInvimaJob('api');
  }

  @RequirePermissions('admin.users')
  @Post('external/socrata/reload-invimaf-all')
  reloadAllInvimaFromSocrata(@Body() dto: SyncSocrataDto) {
    return this.externalIntegrations.reloadAllInvimaFromSocrata(
      dto.replaceExisting !== false,
    );
  }

  @RequirePermissions('admin.users')
  @Post('external/socrata/sync-invimaf-all')
  syncAllInvimaSocrata(@Body() dto: SyncSocrataDto) {
    return this.externalIntegrations.syncAllInvimaSocrata(
      dto.replaceExisting !== false,
    );
  }

  @RequirePermissions('admin.users')
  @Post('external/socrata/record-full-sync')
  recordFullCatalogSync(
    @Body()
    body: {
      ok?: boolean;
      stepsCompleted?: number;
      totalSteps?: number;
      message?: string;
    },
  ) {
    return this.externalIntegrations
      .recordFullCatalogSync('manual', body.ok !== false, {
        stepsCompleted: body.stepsCompleted,
        totalSteps: body.totalSteps,
        message: body.message,
      })
      .then(() => ({ ok: true }));
  }

  @RequirePermissions('admin.users')
  @Get('external/socrata/sync-catalog')
  syncCatalog() {
    return this.externalIntegrations.getSyncCatalog();
  }

  @RequirePermissions('admin.users')
  @Get('external/sync-schedule')
  syncSchedule() {
    const { cron, tz, enabled } = resolveInvimaSyncCron(this.config);
    return {
      cron,
      tz,
      enabled,
      description: describeInvimaSyncSchedule(cron, tz),
      humanSchedule: formatInvimaSyncCronHuman(cron, tz),
    };
  }

  @RequirePermissions('admin.users')
  @Get('external/sync-diagnostics')
  syncDiagnostics() {
    return this.invimaSyncDiagnostics.getDiagnostics();
  }

  @RequirePermissions('admin.users')
  @Post('external/socrata/sync-medicamentos-pos')
  syncMedicamentosPos(@Body() dto: SyncSocrataDto) {
    return this.externalIntegrations.syncMedicamentosPos(
      dto.replaceExisting !== false,
    );
  }

  @RequirePermissions('admin.users')
  @Post('external/socrata/sync-invimaf-pmv')
  syncInvimaPmv(@Body() dto: SyncSocrataDto) {
    return this.externalIntegrations.syncInvimaPmv(dto.replaceExisting !== false);
  }

  @RequirePermissions('admin.users')
  @Post('external/rest/sync-krystalos-medicamentos')
  syncKrystalosMedicamentos() {
    return this.externalIntegrations.syncKrystalosMedicamentos();
  }

  @RequirePermissions('admin.users')
  @Post('external/socrata/sync-invimaf/:listType')
  syncInvimaByListType(
    @Param('listType') listType: string,
    @Body() dto: SyncSocrataDto,
  ) {
    return this.externalIntegrations.syncInvimaSocrataByListType(
      listType as 'VIGENTE' | 'VENCIDO' | 'RENOVACION' | 'OTRO_ESTADO',
      dto.replaceExisting !== false,
    );
  }

  @RequirePermissions('admin.users')
  @Get(`external/${EXT_INTEGRATION_ID}`)
  getExternal(@Param('id') id: string) {
    return this.externalIntegrations.getById(id);
  }

  @RequirePermissions('admin.users')
  @Patch(`external/${EXT_INTEGRATION_ID}`)
  updateExternal(
    @Param('id') id: string,
    @Body() dto: UpdateExternalIntegrationDto,
  ) {
    return this.externalIntegrations.update(id, dto);
  }

  @RequirePermissions('admin.users')
  @Delete(`external/${EXT_INTEGRATION_ID}`)
  removeExternal(@Param('id') id: string) {
    return this.externalIntegrations.remove(id);
  }

  @RequirePermissions('admin.users')
  @Post(`external/${EXT_INTEGRATION_ID}/test-connection`)
  testConnection(@Param('id') id: string) {
    return this.externalIntegrations.testConnection(id);
  }

  @RequirePermissions('admin.users')
  @Get(`external/${EXT_INTEGRATION_ID}/poll/purchase-orders/:number`)
  pollPurchaseOrder(
    @Param('id') id: string,
    @Param('number') number: string,
  ) {
    return this.externalIntegrations.pollPurchaseOrder(id, number);
  }

  @RequirePermissions('admin.users')
  @Get(`external/${EXT_INTEGRATION_ID}/rest/preview`)
  previewRest(@Param('id') id: string) {
    return this.externalIntegrations.previewRestQuery(id);
  }

  @RequirePermissions('admin.users')
  @Get(`external/${EXT_INTEGRATION_ID}/socrata/preview`)
  previewSocrata(@Param('id') id: string) {
    return this.externalIntegrations.previewSocrata(id);
  }

  @RequirePermissions('admin.users')
  @Post(`external/${EXT_INTEGRATION_ID}/socrata/sync`)
  syncSocrata(@Param('id') id: string, @Body() dto: SyncSocrataDto) {
    return this.externalIntegrations.syncSocrata(id, dto.replaceExisting !== false);
  }
}
