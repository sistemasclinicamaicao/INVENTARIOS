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

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly hisService: HisService,
    private readonly hrAdapter: HrAdapterService,
    private readonly config: ConfigService,
    private readonly externalIntegrations: ExternalIntegrationsService,
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
    );
  }

  @RequirePermissions('reception.manage')
  @Get('external/rest/krystalos-medicamentos')
  krystalosMedicamentos(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.externalIntegrations.queryKrystalosMedicamentos(
      q,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      refresh === 'true' || refresh === '1',
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
  @Get('external/:id')
  getExternal(@Param('id') id: string) {
    return this.externalIntegrations.getById(id);
  }

  @RequirePermissions('admin.users')
  @Patch('external/:id')
  updateExternal(
    @Param('id') id: string,
    @Body() dto: UpdateExternalIntegrationDto,
  ) {
    return this.externalIntegrations.update(id, dto);
  }

  @RequirePermissions('admin.users')
  @Delete('external/:id')
  removeExternal(@Param('id') id: string) {
    return this.externalIntegrations.remove(id);
  }

  @RequirePermissions('admin.users')
  @Post('external/:id/test-connection')
  testConnection(@Param('id') id: string) {
    return this.externalIntegrations.testConnection(id);
  }

  @RequirePermissions('admin.users')
  @Get('external/:id/poll/purchase-orders/:number')
  pollPurchaseOrder(
    @Param('id') id: string,
    @Param('number') number: string,
  ) {
    return this.externalIntegrations.pollPurchaseOrder(id, number);
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
  @Get('external/socrata/sync-catalog')
  syncCatalog() {
    return this.externalIntegrations.getSyncCatalog();
  }

  @RequirePermissions('admin.users')
  @Post('external/socrata/sync-medicamentos-pos')
  syncMedicamentosPos(@Body() dto: SyncSocrataDto) {
    return this.externalIntegrations.syncMedicamentosPos(
      dto.replaceExisting !== false,
    );
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
  @Get('external/:id/rest/preview')
  previewRest(@Param('id') id: string) {
    return this.externalIntegrations.previewRestQuery(id);
  }

  @RequirePermissions('admin.users')
  @Get('external/:id/socrata/preview')
  previewSocrata(@Param('id') id: string) {
    return this.externalIntegrations.previewSocrata(id);
  }

  @RequirePermissions('admin.users')
  @Post('external/:id/socrata/sync')
  syncSocrata(@Param('id') id: string, @Body() dto: SyncSocrataDto) {
    return this.externalIntegrations.syncSocrata(id, dto.replaceExisting !== false);
  }
}
