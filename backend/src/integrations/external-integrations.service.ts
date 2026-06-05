import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InvimaListType } from '../masters/invima/invima-parser';
import { INVIMA_LIST_TYPE_ORDER, INVIMA_LIST_TYPE_TITLES, INVIMA_SOCRATA_BASE_URL, INVIMA_SOCRATA_PRESETS, INVIMA_SOQL } from './invima-socrata.presets';
import { InvimaService } from '../masters/invima/invima.service';
import { MedicamentosPosService } from '../masters/medicamentos-pos/medicamentos-pos.service';
import { CreateExternalIntegrationDto } from './dto/create-external-integration.dto';
import { UpdateExternalIntegrationDto } from './dto/update-external-integration.dto';
import { extractCxcWarehouse } from './extract-cxc-warehouse.util';
import {
  mapErpPurchaseOrder,
  mockPurchaseOrder,
  rawPreview,
} from './erp-purchase-order.adapter';
import { encryptSecret } from './integration-crypto.util';
import {
  ExternalIntegrationRecord,
  IntegrationHttpClient,
} from './integration-http.client';
import {
  extractColumnNames,
  extractJsonTableRows,
} from './rest-json-rows.util';
import {
  type EstadoFilter,
  type InvimaCumMatchRow,
  matchesEstadoFilter,
  normalizeCum,
  parseKrystalosMedicamento,
  pickBestInvimaMatch,
  resolveEstadoResumen,
  resolvePosLabel,
} from './krystalos-invima-match.util';
import {
  mapSocrataRowsToInvima,
} from './socrata-row.mapper';
import {
  medicamentosPosColumnNames,
  MEDICAMENTOS_POS_DATASET_ID,
  MEDICAMENTOS_POS_INTEGRATION_NAME,
  sanitizeMedicamentosPosRow,
} from './medicamentos-pos.presets';
import {
  SocrataIntegrationConfig,
  SocrataQueryClient,
  type SocrataViewMetadata,
} from './socrata-query.client';

type DbRow = {
  id: string;
  name: string;
  isActive: boolean;
  integrationKind: string;
  baseUrl: string;
  internalNotes: string | null;
  authMethod: string;
  authHeaderName: string | null;
  authSecretEnc: string | null;
  authUsername: string | null;
  poPathTemplate: string | null;
  socrataDatasetId: string | null;
  socrataApiVersion: string | null;
  socrataQuery: string | null;
  socrataPageSize: number;
  syncTarget: string;
  invimaListType: string | null;
  createdAt: string;
  updatedAt: string;
  lastPollAt: string | null;
};

const SELECT_COLUMNS = `
  id, name, is_active AS "isActive", integration_kind AS "integrationKind",
  base_url AS "baseUrl", internal_notes AS "internalNotes",
  auth_method AS "authMethod", auth_header_name AS "authHeaderName",
  auth_secret_enc AS "authSecretEnc", auth_username AS "authUsername",
  po_path_template AS "poPathTemplate",
  socrata_dataset_id AS "socrataDatasetId",
  socrata_api_version AS "socrataApiVersion",
  socrata_query AS "socrataQuery",
  socrata_page_size AS "socrataPageSize",
  sync_target AS "syncTarget", invima_list_type AS "invimaListType",
  created_at AS "createdAt", updated_at AS "updatedAt",
  last_poll_at AS "lastPollAt"
`;

@Injectable()
export class ExternalIntegrationsService {
  private readonly logger = new Logger(ExternalIntegrationsService.name);
  private krystalosRowsCache: {
    integrationId: string;
    rows: Record<string, unknown>[];
    fetchedAt: number;
  } | null = null;
  private socrataMetadataCache = new Map<
    string,
    { metadata: SocrataViewMetadata | null; fetchedAt: number; error?: string }
  >();
  private static readonly KRYSTALOS_CACHE_MS = 120_000;
  private static readonly SOCRATA_METADATA_CACHE_MS = 600_000;

  constructor(
    private readonly config: ConfigService,
    private readonly http: IntegrationHttpClient,
    private readonly socrata: SocrataQueryClient,
    private readonly invima: InvimaService,
    private readonly medicamentosPos: MedicamentosPosService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private normalizeBaseUrl(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, '');
    const isDev = this.config.get('NODE_ENV') !== 'production';
    if (
      !/^https:\/\//i.test(trimmed) &&
      !(isDev && /^http:\/\/(localhost|127\.0\.0\.1)/i.test(trimmed))
    ) {
      throw new BadRequestException(
        'URL base debe ser HTTPS (en desarrollo se permite http://localhost)',
      );
    }
    return trimmed;
  }

  private kindOf(dto: { integrationKind?: string }): string {
    return dto.integrationKind ?? 'ERP_PURCHASE_ORDER';
  }

  /** ERP + API Key sin plantilla → GET directo a URL base (como REST_QUERY). */
  private isErpDirectQuery(row: {
    integrationKind: string;
    authMethod: string;
    poPathTemplate?: string | null;
  }): boolean {
    return (
      row.integrationKind === 'ERP_PURCHASE_ORDER' &&
      row.authMethod === 'API_KEY' &&
      !row.poPathTemplate?.trim()
    );
  }

  private resolvePoPathTemplate(
    kind: string,
    authMethod: string,
    template?: string | null,
  ): string | null {
    if (kind !== 'ERP_PURCHASE_ORDER') return null;
    const trimmed = template?.trim();
    if (trimmed) return trimmed;
    if (authMethod === 'API_KEY') return null;
    return '?consecutivo={number}';
  }

  private validateCreateUpdate(
    kind: string,
    dto: CreateExternalIntegrationDto | UpdateExternalIntegrationDto,
    isCreate: boolean,
  ) {
    if (kind === 'SOCRATA_OPEN_DATA') {
      const d = dto as CreateExternalIntegrationDto;
      if (isCreate && !d.socrataDatasetId?.trim()) {
        throw new BadRequestException('Dataset ID Socrata es obligatorio');
      }
      if (isCreate && !d.socrataQuery?.trim()) {
        throw new BadRequestException('Consulta SoQL es obligatoria');
      }
      const target = d.syncTarget ?? 'NONE';
      if (target === 'INVIMA_REGISTROS' && !d.invimaListType) {
        throw new BadRequestException(
          'Seleccione list_type INVIMA cuando el destino es INVIMA_REGISTROS',
        );
      }
      const version = d.socrataApiVersion ?? 'SODA3';
      const auth = d.authMethod ?? 'NONE';
      if (version === 'SODA3' && auth === 'NONE' && isCreate) {
        throw new BadRequestException(
          'SODA3 en datos.gov.co requiere App Token (API Key con header X-App-Token)',
        );
      }
    } else if (isCreate) {
      const d = dto as CreateExternalIntegrationDto;
      if (!d.poPathTemplate?.trim() && kind === 'ERP_PURCHASE_ORDER') {
        // default applied on insert
      }
    }
  }

  private toRecord(row: DbRow): ExternalIntegrationRecord {
    return {
      id: row.id,
      baseUrl: row.baseUrl,
      authMethod: row.authMethod as ExternalIntegrationRecord['authMethod'],
      authHeaderName: row.authHeaderName,
      authSecretEnc: row.authSecretEnc,
      authUsername: row.authUsername,
      poPathTemplate: row.poPathTemplate ?? '',
    };
  }

  private assertSocrataAuth(row: DbRow): void {
    const version = row.socrataApiVersion ?? 'SODA3';
    const needsToken =
      version === 'SODA3' ||
      row.authMethod === 'API_KEY' ||
      row.authMethod === 'BEARER' ||
      row.authMethod === 'BASIC';
    if (needsToken && !row.authSecretEnc) {
      throw new BadRequestException(
        'No hay App Token guardado. Edite la integración, pegue el token en X-App-Token y guarde.',
      );
    }
  }

  private socrataConfig(row: DbRow): SocrataIntegrationConfig {
    if (row.integrationKind !== 'SOCRATA_OPEN_DATA') {
      throw new BadRequestException('La integración no es de tipo Socrata');
    }
    if (!row.socrataDatasetId || !row.socrataQuery) {
      throw new BadRequestException('Faltan dataset ID o consulta SoQL');
    }
    this.assertSocrataAuth(row);
    return {
      baseUrl: row.baseUrl,
      datasetId: row.socrataDatasetId,
      apiVersion: (row.socrataApiVersion ?? 'SODA3') as 'SODA2' | 'SODA3',
      query: row.socrataQuery,
      pageSize: row.socrataPageSize || 1000,
      record: this.toRecord(row),
    };
  }

  private mapPublic(row: DbRow) {
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      integrationKind: row.integrationKind,
      baseUrl: row.baseUrl,
      internalNotes: row.internalNotes,
      authMethod: row.authMethod,
      authHeaderName: row.authHeaderName,
      hasSecret: Boolean(row.authSecretEnc),
      authUsername: row.authUsername,
      poPathTemplate: row.poPathTemplate,
      socrataDatasetId: row.socrataDatasetId,
      socrataApiVersion: row.socrataApiVersion,
      socrataQuery: row.socrataQuery,
      socrataPageSize: row.socrataPageSize,
      syncTarget: row.syncTarget,
      invimaListType: row.invimaListType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastPollAt: row.lastPollAt,
    };
  }

  async list() {
    const rows = await this.dataSource.query<DbRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM external_integrations ORDER BY created_at DESC`,
    );
    return rows.map((r) => this.mapPublic(r));
  }

  async getById(id: string) {
    const row = await this.findRow(id);
    return this.mapPublic(row);
  }

  private async findRow(id: string): Promise<DbRow> {
    const [row] = await this.dataSource.query<DbRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM external_integrations WHERE id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Integración no encontrada');
    return row;
  }

  async create(dto: CreateExternalIntegrationDto) {
    const kind = this.kindOf(dto);
    this.validateCreateUpdate(kind, dto, true);

    const authMethod = dto.authMethod ?? 'NONE';
    if (authMethod !== 'NONE' && !dto.authSecret?.trim()) {
      throw new BadRequestException('Se requiere credencial para el método de autenticación');
    }
    if (authMethod === 'BASIC' && !dto.authUsername?.trim()) {
      throw new BadRequestException('Basic Auth requiere usuario');
    }

    const secretEnc =
      authMethod !== 'NONE' && dto.authSecret
        ? encryptSecret(dto.authSecret.trim(), this.config)
        : null;

    const poTemplate = this.resolvePoPathTemplate(
      kind,
      authMethod,
      dto.poPathTemplate,
    );

    const [row] = await this.dataSource.query<DbRow[]>(
      `INSERT INTO external_integrations (
         name, is_active, integration_kind, base_url, internal_notes, auth_method,
         auth_header_name, auth_secret_enc, auth_username, po_path_template,
         socrata_dataset_id, socrata_api_version, socrata_query, socrata_page_size,
         sync_target, invima_list_type
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING ${SELECT_COLUMNS}`,
      [
        dto.name.trim(),
        dto.isActive !== false,
        kind,
        this.normalizeBaseUrl(dto.baseUrl),
        dto.internalNotes?.trim() || null,
        authMethod,
        dto.authHeaderName?.trim() ||
          (kind === 'SOCRATA_OPEN_DATA' ? 'X-App-Token' : 'x-api-key'),
        secretEnc,
        dto.authUsername?.trim() || null,
        poTemplate,
        kind === 'SOCRATA_OPEN_DATA' ? dto.socrataDatasetId?.trim() : null,
        kind === 'SOCRATA_OPEN_DATA' ? (dto.socrataApiVersion ?? 'SODA3') : null,
        kind === 'SOCRATA_OPEN_DATA' ? dto.socrataQuery?.trim() : null,
        kind === 'SOCRATA_OPEN_DATA' ? (dto.socrataPageSize ?? 1000) : 1000,
        kind === 'SOCRATA_OPEN_DATA' ? (dto.syncTarget ?? 'NONE') : 'NONE',
        dto.syncTarget === 'INVIMA_REGISTROS' ? dto.invimaListType : null,
      ],
    );
    return this.mapPublic(row);
  }

  async update(id: string, dto: UpdateExternalIntegrationDto) {
    const existing = await this.findRow(id);
    const kind = dto.integrationKind ?? existing.integrationKind;
    this.validateCreateUpdate(kind, dto as CreateExternalIntegrationDto, false);

    const authMethod = dto.authMethod ?? existing.authMethod;
    const willHaveSecret =
      Boolean(existing.authSecretEnc) || Boolean(dto.authSecret?.trim());
    if (authMethod !== 'NONE' && !willHaveSecret) {
      throw new BadRequestException(
        'Se requiere credencial para el método de autenticación (pegue el App Token)',
      );
    }
    if (authMethod === 'BASIC' && !(dto.authUsername?.trim() ?? existing.authUsername)) {
      throw new BadRequestException('Basic Auth requiere usuario');
    }

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let i = 1;

    if (dto.name !== undefined) {
      sets.push(`name = $${i++}`);
      params.push(dto.name.trim());
    }
    if (dto.isActive !== undefined) {
      sets.push(`is_active = $${i++}`);
      params.push(dto.isActive);
    }
    if (dto.integrationKind !== undefined) {
      sets.push(`integration_kind = $${i++}`);
      params.push(dto.integrationKind);
    }
    if (dto.baseUrl !== undefined) {
      sets.push(`base_url = $${i++}`);
      params.push(this.normalizeBaseUrl(dto.baseUrl));
    }
    if (dto.internalNotes !== undefined) {
      sets.push(`internal_notes = $${i++}`);
      params.push(dto.internalNotes?.trim() || null);
    }
    if (dto.authMethod !== undefined) {
      sets.push(`auth_method = $${i++}`);
      params.push(dto.authMethod);
    }
    if (dto.authHeaderName !== undefined) {
      sets.push(`auth_header_name = $${i++}`);
      params.push(dto.authHeaderName?.trim() || 'x-api-key');
    }
    if (dto.authSecret?.trim()) {
      sets.push(`auth_secret_enc = $${i++}`);
      params.push(encryptSecret(dto.authSecret.trim(), this.config));
    }
    if (dto.authUsername !== undefined) {
      sets.push(`auth_username = $${i++}`);
      params.push(dto.authUsername?.trim() || null);
    }
    if (dto.poPathTemplate !== undefined) {
      sets.push(`po_path_template = $${i++}`);
      const auth = dto.authMethod ?? existing.authMethod;
      params.push(
        this.resolvePoPathTemplate(kind, auth, dto.poPathTemplate),
      );
    } else if (
      dto.authMethod !== undefined &&
      kind === 'ERP_PURCHASE_ORDER' &&
      dto.authMethod === 'API_KEY' &&
      !existing.poPathTemplate?.trim()
    ) {
      sets.push(`po_path_template = $${i++}`);
      params.push(null);
    }
    if (dto.socrataDatasetId !== undefined) {
      sets.push(`socrata_dataset_id = $${i++}`);
      params.push(dto.socrataDatasetId.trim());
    }
    if (dto.socrataApiVersion !== undefined) {
      sets.push(`socrata_api_version = $${i++}`);
      params.push(dto.socrataApiVersion);
    }
    if (dto.socrataQuery !== undefined) {
      sets.push(`socrata_query = $${i++}`);
      params.push(dto.socrataQuery.trim());
    }
    if (dto.socrataPageSize !== undefined) {
      sets.push(`socrata_page_size = $${i++}`);
      params.push(dto.socrataPageSize);
    }
    if (dto.syncTarget !== undefined) {
      sets.push(`sync_target = $${i++}`);
      params.push(dto.syncTarget);
    }
    if (dto.invimaListType !== undefined) {
      sets.push(`invima_list_type = $${i++}`);
      params.push(dto.invimaListType);
    }

    params.push(id);
    await this.dataSource.query(
      `UPDATE external_integrations SET ${sets.join(', ')} WHERE id = $${i}`,
      params,
    );
    return this.getById(id);
  }

  async remove(id: string) {
    const row = await this.findRow(id);
    await this.dataSource.query(
      `UPDATE external_integrations SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { deactivated: true, id: row.id };
  }

  private async logPoll(
    integrationId: string,
    method: string,
    url: string,
    statusCode: number,
    durationMs: number,
  ) {
    await this.dataSource.query(
      `INSERT INTO external_integration_poll_log (integration_id, method, url, status_code, duration_ms)
       VALUES ($1, $2, $3, $4, $5)`,
      [integrationId, method, url.slice(0, 800), statusCode, durationMs],
    );
    await this.dataSource.query(
      `UPDATE external_integrations SET last_poll_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [integrationId],
    );
  }

  async testConnection(id: string) {
    const row = await this.findRow(id);

    if (row.integrationKind === 'SOCRATA_OPEN_DATA') {
      const cfg = this.socrataConfig(row);
      const testQuery = this.socrata.ensureLimit(cfg.query, 1);
      const page = await this.socrata.fetchPage({ ...cfg, query: testQuery }, 1);
      await this.logPoll(
        id,
        cfg.apiVersion === 'SODA3' ? 'POST' : 'GET',
        page.url,
        page.status,
        page.durationMs,
      );
      return {
        ok: page.ok && page.rows.length >= 0,
        httpStatus: page.status,
        durationMs: page.durationMs,
        url: page.url,
        message: page.ok
          ? `Conexión Socrata OK (${page.rows.length} fila(s) de prueba)`
          : page.message ?? `HTTP ${page.status}`,
      };
    }

    if (row.integrationKind === 'REST_QUERY' || this.isErpDirectQuery(row)) {
      const rec = this.toRecord(row);
      const res = await this.http.fetchJson(rec, '', {});
      const tableRows = extractJsonTableRows(res.data);
      await this.logPoll(id, 'GET', res.url, res.status, res.durationMs);
      return {
        ok: res.ok,
        httpStatus: res.status,
        durationMs: res.durationMs,
        url: res.url,
        message: res.ok
          ? `Conexión REST OK (${tableRows.length} fila(s))`
          : `HTTP ${res.status}`,
      };
    }

    const rec = this.toRecord(row);
    const paths = ['/health', '/api/health', '/'];
    let last: { url: string; status: number; durationMs: number; ok: boolean } | null =
      null;

    for (const p of paths) {
      try {
        const res = await this.http.fetchJson(rec, p, {});
        last = {
          url: res.url,
          status: res.status,
          durationMs: res.durationMs,
          ok: res.ok,
        };
        if (res.ok) break;
      } catch (e) {
        last = {
          url: this.http.buildUrl(rec, p, {}),
          status: 0,
          durationMs: 0,
          ok: false,
        };
        this.logger.warn(`test-connection ${p}: ${(e as Error).message}`);
      }
    }

    if (!last) {
      return { ok: false, message: 'No se pudo contactar el endpoint' };
    }

    await this.logPoll(id, 'GET', last.url, last.status || 502, last.durationMs);

    return {
      ok: last.ok,
      httpStatus: last.status,
      durationMs: last.durationMs,
      url: last.url,
      message: last.ok ? 'Conexión exitosa' : `HTTP ${last.status}`,
    };
  }

  async previewSocrata(id: string, pageSize?: number) {
    const row = await this.findRow(id);
    if (!row.isActive) {
      throw new BadRequestException('La integración está inactiva');
    }
    const cfg = this.socrataConfig(row);
    const size = pageSize ?? Math.min(cfg.pageSize, 100);
    const previewQuery = this.socrata.ensureLimit(cfg.query, size);
    const page = await this.socrata.fetchPage({ ...cfg, query: previewQuery }, 1);
    await this.logPoll(
      id,
      cfg.apiVersion === 'SODA3' ? 'POST' : 'GET',
      page.url,
      page.status,
      page.durationMs,
    );

    const columns = extractColumnNames(page.rows);
    const sampleMapped =
      row.syncTarget === 'INVIMA_REGISTROS'
        ? mapSocrataRowsToInvima(page.rows).slice(0, 5)
        : undefined;

    return {
      ok: page.ok,
      httpStatus: page.status,
      durationMs: page.durationMs,
      url: page.url,
      rowCount: page.rows.length,
      pageSize: size,
      columns,
      rows: page.rows,
      sampleMapped,
      message: page.ok ? undefined : page.message,
    };
  }

  async previewRestQuery(id: string) {
    const row = await this.findRow(id);
    if (row.integrationKind !== 'REST_QUERY' && !this.isErpDirectQuery(row)) {
      throw new BadRequestException(
        'La integración no admite consulta directa (use REST o ERP con API Key sin plantilla OC)',
      );
    }
    if (!row.isActive) {
      throw new BadRequestException('La integración está inactiva');
    }

    const rec = this.toRecord(row);
    const res = await this.http.fetchJson(rec, '', {});
    await this.logPoll(id, 'GET', res.url, res.status, res.durationMs);

    const allRows = extractJsonTableRows(res.data);
    const maxDisplay = 100;
    const rows = allRows.slice(0, maxDisplay);
    const columns = extractColumnNames(rows.length ? rows : allRows);

    return {
      ok: res.ok && allRows.length > 0,
      httpStatus: res.status,
      durationMs: res.durationMs,
      url: res.url,
      rowCount: allRows.length,
      columns,
      rows,
      message: !res.ok
        ? `Error HTTP ${res.status}`
        : allRows.length === 0
          ? 'Respuesta OK pero no se encontraron filas tabulares (se espera un array JSON de objetos)'
          : allRows.length > maxDisplay
            ? `Mostrando ${maxDisplay} de ${allRows.length} filas`
            : undefined,
    };
  }

  async syncSocrata(id: string, replaceExisting = true) {
    const row = await this.findRow(id);
    if (!row.isActive) {
      throw new BadRequestException('La integración está inactiva');
    }
    if (row.integrationKind !== 'SOCRATA_OPEN_DATA') {
      throw new BadRequestException('La integración no es de tipo Socrata');
    }
    if (row.syncTarget !== 'INVIMA_REGISTROS') {
      throw new BadRequestException(
        'Configure sync_target = INVIMA_REGISTROS para sincronizar a INVIMA',
      );
    }
    if (!row.invimaListType) {
      throw new BadRequestException('Falta invima_list_type en la integración');
    }

    const start = Date.now();
    const cfg = this.socrataConfig(row);
    const soql =
      row.syncTarget === 'INVIMA_REGISTROS' ? INVIMA_SOQL : cfg.query;
    const syncQuery = this.socrata.stripLimitAndOffset(soql);
    const hadLimitInQuery = /\bLIMIT\s+\d+/i.test(cfg.query);
    const fetched = await this.socrata.fetchAllPages({ ...cfg, query: syncQuery });
    await this.logPoll(
      id,
      cfg.apiVersion === 'SODA3' ? 'POST' : 'GET',
      fetched.lastUrl,
      fetched.ok ? 200 : 502,
      Date.now() - start,
    );

    if (!fetched.ok) {
      return {
        ok: false,
        message: fetched.message ?? 'Error al obtener datos de Socrata',
        rowsFetched: fetched.rows.length,
        pages: fetched.pages,
        durationMs: Date.now() - start,
      };
    }

    const parsed = mapSocrataRowsToInvima(fetched.rows);
    if (parsed.length === 0) {
      throw new BadRequestException('No se mapearon filas válidas para INVIMA');
    }

    const dateLabel = new Date().toISOString().slice(0, 10);
    const sourceLabel = `socrata:${cfg.datasetId}@${dateLabel}`;
    const importResult = await this.invima.importParsedRows({
      listType: row.invimaListType as InvimaListType,
      rows: parsed,
      sourceLabel,
      replaceExisting,
    });

    return {
      ok: true,
      rowsFetched: fetched.rows.length,
      rowsImported: importResult.rowsImported,
      pages: fetched.pages,
      durationMs: Date.now() - start,
      batchId: importResult.batchId,
      listType: importResult.listType,
      sourceFilename: importResult.sourceFilename,
      message: `Importadas ${importResult.rowsImported} filas a INVIMA (${row.invimaListType}) en ${fetched.pages} página(s)${hadLimitInQuery ? ' (se omitió LIMIT del SoQL para carga completa)' : ''}`,
      limitStripped: hadLimitInQuery,
    };
  }

  async syncAllInvimaSocrata(replaceExisting = true) {
    const rows = await this.dataSource.query<DbRow[]>(
      `SELECT ${SELECT_COLUMNS}
       FROM external_integrations
       WHERE is_active = TRUE
         AND integration_kind = 'SOCRATA_OPEN_DATA'
         AND sync_target = 'INVIMA_REGISTROS'
         AND invima_list_type IS NOT NULL
       ORDER BY created_at ASC`,
    );

    if (!rows.length) {
      throw new BadRequestException(
        'No hay integraciones Socrata activas con destino INVIMA. Créelas en Configuración → Integraciones.',
      );
    }

    const withoutToken = rows.filter((r) => !r.authSecretEnc);
    if (withoutToken.length) {
      throw new BadRequestException(
        `Falta App Token en: ${withoutToken.map((r) => r.name).join(', ')}. Edite cada integración y pegue el token.`,
      );
    }

    const orderOf = (listType: string | null) => {
      const idx = INVIMA_LIST_TYPE_ORDER.indexOf(listType as InvimaListType);
      return idx >= 0 ? idx : INVIMA_LIST_TYPE_ORDER.length;
    };
    const sorted = [...rows].sort(
      (a, b) => orderOf(a.invimaListType) - orderOf(b.invimaListType),
    );

    type ItemResult = {
      integrationId: string;
      integrationName: string;
      listType: string;
      ok: boolean;
      rowsImported?: number;
      rowsFetched?: number;
      pages?: number;
      durationMs?: number;
      message?: string;
    };

    const results: ItemResult[] = [];
    const startAll = Date.now();

    for (const row of sorted) {
      try {
        const r = await this.syncSocrata(row.id, replaceExisting);
        results.push({
          integrationId: row.id,
          integrationName: row.name,
          listType: row.invimaListType ?? '',
          ok: r.ok,
          rowsImported: r.rowsImported,
          rowsFetched: r.rowsFetched,
          pages: r.pages,
          durationMs: r.durationMs,
          message: r.message,
        });
      } catch (e) {
        results.push({
          integrationId: row.id,
          integrationName: row.name,
          listType: row.invimaListType ?? '',
          ok: false,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const totalImported = results.reduce((s, r) => s + (r.rowsImported ?? 0), 0);

    return {
      ok: okCount === results.length,
      integrationsProcessed: results.length,
      integrationsOk: okCount,
      totalRowsImported: totalImported,
      durationMs: Date.now() - startAll,
      results,
      message:
        okCount === results.length
          ? `Sincronizados ${results.length} listados INVIMA (${totalImported.toLocaleString()} filas en total)`
          : `Completado con errores: ${okCount}/${results.length} listados OK`,
    };
  }

  private async getPortalMetadataCached(datasetId: string): Promise<{
    metadata: SocrataViewMetadata | null;
    error?: string;
  }> {
    const now = Date.now();
    const cached = this.socrataMetadataCache.get(datasetId);
    if (
      cached &&
      now - cached.fetchedAt < ExternalIntegrationsService.SOCRATA_METADATA_CACHE_MS
    ) {
      return { metadata: cached.metadata, error: cached.error };
    }

    const result = await this.socrata.fetchViewMetadata(
      INVIMA_SOCRATA_BASE_URL,
      datasetId,
    );
    const metadata = result.metadata;
    const error = result.ok ? undefined : result.message;

    this.socrataMetadataCache.set(datasetId, {
      metadata,
      fetchedAt: now,
      error,
    });

    return { metadata, error };
  }

  /** Estado de sincronización local + fechas del portal datos.gov.co. */
  async getSyncCatalog() {
    const invimaBatches = await this.invima.listBatches();
    const latestInvimaByType = new Map<
      string,
      {
        rowsImported: number;
        importedAt: string;
      }
    >();
    for (const b of invimaBatches) {
      if (!latestInvimaByType.has(b.listType)) {
        latestInvimaByType.set(b.listType, {
          rowsImported: b.rowsImported,
          importedAt: b.importedAt,
        });
      }
    }

    const posBatch = await this.medicamentosPos.latestBatch();

    type SyncCatalogItem = {
      key: string;
      listType?: InvimaListType;
      label: string;
      datasetId: string;
      rowsImported: number | null;
      importedAt: string | null;
      portalUpdatedAt: string | null;
      portalMetadataError?: string;
    };

    const items: SyncCatalogItem[] = [];

    for (const preset of INVIMA_SOCRATA_PRESETS) {
      const batch = latestInvimaByType.get(preset.listType);
      const portal = await this.getPortalMetadataCached(preset.datasetId);
      items.push({
        key: preset.listType,
        listType: preset.listType,
        label: INVIMA_LIST_TYPE_TITLES[preset.listType] ?? preset.label,
        datasetId: preset.datasetId,
        rowsImported: batch?.rowsImported ?? null,
        importedAt: batch?.importedAt ?? null,
        portalUpdatedAt:
          portal.metadata?.rowsUpdatedAt ??
          portal.metadata?.publicationDate ??
          null,
        portalMetadataError: portal.error,
      });
    }

    const posPortal = await this.getPortalMetadataCached(
      MEDICAMENTOS_POS_DATASET_ID,
    );
    items.push({
      key: 'POS',
      label: 'Medicamentos POS',
      datasetId: MEDICAMENTOS_POS_DATASET_ID,
      rowsImported: posBatch?.rowsImported ?? null,
      importedAt: posBatch?.importedAt ?? null,
      portalUpdatedAt:
        posPortal.metadata?.rowsUpdatedAt ??
        posPortal.metadata?.publicationDate ??
        null,
      portalMetadataError: posPortal.error,
    });

    const [krystalosIntegration] = await this.dataSource.query<
      { name: string; baseUrl: string }[]
    >(
      `SELECT name, base_url AS "baseUrl"
       FROM external_integrations
       WHERE is_active = TRUE
         AND integration_kind = 'REST_QUERY'
         AND (
           base_url ILIKE '%/medicamentos%'
           OR name ILIKE '%MEDICAMENTOS KRYSTALOS%'
         )
       ORDER BY updated_at DESC
       LIMIT 1`,
    );
    items.push({
      key: 'KRYSTALOS',
      label: 'Medicamentos Krystalos',
      datasetId: krystalosIntegration?.name ?? 'API REST',
      rowsImported: this.krystalosRowsCache?.rows.length ?? null,
      importedAt: this.krystalosRowsCache
        ? new Date(this.krystalosRowsCache.fetchedAt).toISOString()
        : null,
      portalUpdatedAt: null,
    });

    return { items };
  }

  /** Refresca caché de medicamentos Krystalos desde la integración REST activa. */
  async syncKrystalosMedicamentos() {
    const fetched = await this.fetchKrystalosMedicamentosRows(true);
    const count = fetched.rows.length;
    return {
      ok: true,
      message: `${count.toLocaleString()} medicamentos Krystalos actualizados desde API`,
      rowsImported: count,
      integrationName: fetched.integrationName,
      url: fetched.url,
      httpStatus: fetched.httpStatus,
      durationMs: fetched.durationMs,
    };
  }

  /** Sincroniza un solo listado INVIMA (reemplaza solo ese list_type). */
  async syncInvimaSocrataByListType(
    listType: InvimaListType,
    replaceExisting = true,
  ) {
    if (!INVIMA_LIST_TYPE_ORDER.includes(listType)) {
      throw new BadRequestException(
        `listType inválido. Use: ${INVIMA_LIST_TYPE_ORDER.join(', ')}`,
      );
    }

    const rows = await this.dataSource.query<DbRow[]>(
      `SELECT ${SELECT_COLUMNS}
       FROM external_integrations
       WHERE is_active = TRUE
         AND integration_kind = 'SOCRATA_OPEN_DATA'
         AND sync_target = 'INVIMA_REGISTROS'
         AND invima_list_type = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [listType],
    );

    if (!rows.length) {
      throw new BadRequestException(
        `No hay integración activa para listado ${listType}. Créela en Configuración → Integraciones.`,
      );
    }

    const row = rows[0];
    if (!row.authSecretEnc) {
      throw new BadRequestException(
        `Falta App Token en integración "${row.name}". Edítela y pegue el token.`,
      );
    }

    const r = await this.syncSocrata(row.id, replaceExisting);
    return {
      integrationId: row.id,
      integrationName: row.name,
      listType,
      ...r,
    };
  }

  /** Vacía referencia INVIMA y recarga solo desde integraciones Socrata activas. */
  async reloadAllInvimaFromSocrata(replaceExisting = true) {
    await this.invima.clearAll();
    return this.syncAllInvimaSocrata(replaceExisting);
  }

  async pollPurchaseOrder(id: string, number: string) {
    const row = await this.findRow(id);
    if (row.integrationKind !== 'ERP_PURCHASE_ORDER') {
      throw new BadRequestException('Esta integración no es de sondeo ERP');
    }
    if (!row.isActive) {
      throw new BadRequestException('La integración está inactiva');
    }

    if (this.isErpDirectQuery(row)) {
      throw new BadRequestException(
        'Esta integración consulta la URL base completa. Use «Ejecutar consulta» en vista previa.',
      );
    }

    const rec = this.toRecord(row);
    const consecutivo = number.trim();
    const useMock = this.config.get('ERP_USE_MOCK') === 'true';
    const poTemplate = row.poPathTemplate?.trim() || '?consecutivo={number}';

    try {
      const res = await this.http.fetchJson(rec, poTemplate, {
        number: consecutivo,
        consecutivo,
      });

      await this.logPoll(id, 'GET', res.url, res.status, res.durationMs);

      let mapped = mapErpPurchaseOrder(res.data, consecutivo);
      if (!mapped && useMock) {
        mapped = mockPurchaseOrder(consecutivo);
      }

      const erpLines = Array.isArray(res.data) ? res.data : null;
      const first = erpLines?.[0] as Record<string, unknown> | undefined;
      const warehouseFromLines = extractCxcWarehouse(erpLines);
      const mappedWh = mapped?.warehouse;
      const erpHeader = first
        ? {
            nit: String(first.NIT ?? first.nit ?? '').trim(),
            razonSocial: String(first.RAZONSOCIAL ?? first.razonsocial ?? '').trim(),
            warehouse:
              warehouseFromLines ??
              (mappedWh?.code || mappedWh?.name
                ? {
                    code: mappedWh.code ?? '',
                    name: mappedWh.name ?? mappedWh.code ?? '',
                  }
                : null),
          }
        : null;

      return {
        ok: res.ok && Boolean(mapped),
        httpStatus: res.status,
        durationMs: res.durationMs,
        url: res.url,
        mapped,
        erpLines,
        erpHeader,
        rawPreview: rawPreview(res.data),
        source: mapped && !res.ok ? 'mock' : res.ok ? 'erp' : 'none',
        message: mapped
          ? undefined
          : res.ok
            ? 'Respuesta recibida pero no se pudo mapear al formato OC'
            : `Error HTTP ${res.status}`,
      };
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.warn(`poll OC ${consecutivo}: ${msg}`);

      if (useMock) {
        const mapped = mockPurchaseOrder(consecutivo);
        return {
          ok: true,
          httpStatus: 0,
          durationMs: 0,
          url: this.http.buildUrl(rec, poTemplate, {
            number: consecutivo,
            consecutivo,
          }),
          mapped,
          erpLines: null,
          erpHeader: mapped?.supplier
            ? {
                nit: mapped.supplier.id ?? '',
                razonSocial: mapped.supplier.name,
                warehouse:
                  mapped.warehouse?.code || mapped.warehouse?.name
                    ? {
                        code: mapped.warehouse.code ?? '',
                        name: mapped.warehouse.name ?? '',
                      }
                    : null,
              }
            : null,
          rawPreview: { _mock: true, error: msg },
          source: 'mock',
          message: `ERP no disponible; vista previa mock (${msg})`,
        };
      }

      const url = this.http.buildUrl(rec, poTemplate, {
        number: consecutivo,
        consecutivo,
      });
      return {
        ok: false,
        httpStatus: 0,
        durationMs: 0,
        url,
        mapped: null,
        erpLines: null,
        erpHeader: null,
        rawPreview: { error: msg },
        source: 'error',
        message: `No se pudo conectar al ERP (${msg}). Verifique URL, red desde el servidor API y autenticación (en Postman suele ser sin auth).`,
      };
    }
  }

  async pollActivePurchaseOrder(number: string) {
    const [row] = await this.dataSource.query<DbRow[]>(
      `SELECT ${SELECT_COLUMNS}
       FROM external_integrations
       WHERE is_active = TRUE AND integration_kind = 'ERP_PURCHASE_ORDER'
       ORDER BY last_poll_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
    );
    if (!row) {
      throw new BadRequestException(
        'No hay integración ERP activa. Regístrela en Configuración → Integraciones.',
      );
    }
    const result = await this.pollPurchaseOrder(row.id, number);
    return {
      ...result,
      integrationId: row.id,
      integrationName: row.name,
    };
  }

  /** Catálogo medicamentos Krystalos (integración REST activa /medicamentos). */
  private async fetchKrystalosMedicamentosRows(refresh = false): Promise<{
    integrationName: string;
    url: string;
    httpStatus: number;
    durationMs: number;
    rows: Record<string, unknown>[];
  }> {
    const [row] = await this.dataSource.query<DbRow[]>(
      `SELECT ${SELECT_COLUMNS}
       FROM external_integrations
       WHERE is_active = TRUE
         AND integration_kind = 'REST_QUERY'
         AND (
           base_url ILIKE '%/medicamentos%'
           OR name ILIKE '%MEDICAMENTOS KRYSTALOS%'
         )
       ORDER BY updated_at DESC
       LIMIT 1`,
    );
    if (!row) {
      throw new NotFoundException(
        'No hay integración REST activa «Medicamentos Krystalos». Configúrela en Integraciones API externas.',
      );
    }

    if (refresh) {
      this.krystalosRowsCache = null;
    }

    const rec = this.toRecord(row);
    const now = Date.now();
    let rows: Record<string, unknown>[];
    let httpStatus: number;
    let durationMs: number;
    let url: string;

    if (
      this.krystalosRowsCache &&
      this.krystalosRowsCache.integrationId === row.id &&
      now - this.krystalosRowsCache.fetchedAt < ExternalIntegrationsService.KRYSTALOS_CACHE_MS
    ) {
      rows = this.krystalosRowsCache.rows;
      httpStatus = 200;
      durationMs = 0;
      url = row.baseUrl;
    } else {
      try {
        const res = await this.http.fetchJson(rec, '', {});
        await this.logPoll(row.id, 'GET', res.url, res.status, res.durationMs);
        if (!res.ok) {
          throw new ServiceUnavailableException(
            `Medicamentos Krystalos respondió HTTP ${res.status}. Verifique URL y API Key en Integraciones.`,
          );
        }
        rows = extractJsonTableRows(res.data);
        if (!rows.length) {
          throw new ServiceUnavailableException(
            'Medicamentos Krystalos no devolvió filas JSON. Revise la respuesta del API.',
          );
        }
        this.krystalosRowsCache = {
          integrationId: row.id,
          rows,
          fetchedAt: now,
        };
        httpStatus = res.status;
        durationMs = res.durationMs;
        url = res.url;
      } catch (e) {
        if (e instanceof ServiceUnavailableException || e instanceof BadRequestException) {
          throw e;
        }
        const msg = (e as Error).message;
        this.logger.error(`Krystalos medicamentos: ${msg}`);
        throw new ServiceUnavailableException(
          `No se pudo consultar Medicamentos Krystalos: ${msg}`,
        );
      }
    }

    return {
      integrationName: row.name,
      url,
      httpStatus,
      durationMs,
      rows,
    };
  }

  async queryKrystalosMedicamentos(
    q?: string,
    page = 1,
    limit = 50,
    refresh = false,
  ) {
    const fetched = await this.fetchKrystalosMedicamentosRows(refresh);
    let rows = fetched.rows;
    const needle = q?.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((r) =>
        Object.values(r).some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(needle),
        ),
      );
    }

    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safePage = Math.max(page, 1);
    const total = rows.length;
    const offset = (safePage - 1) * safeLimit;
    const items = rows.slice(offset, offset + safeLimit);
    const columns = extractColumnNames(rows.length ? rows : fetched.rows);

    return {
      ok: fetched.httpStatus >= 200 && fetched.httpStatus < 300,
      httpStatus: fetched.httpStatus,
      durationMs: fetched.durationMs,
      url: fetched.url,
      integrationName: fetched.integrationName,
      columns,
      items,
      total,
      page: safePage,
      limit: safeLimit,
      message:
        fetched.httpStatus >= 400 ? `Error HTTP ${fetched.httpStatus}` : undefined,
    };
  }

  /** Descarga catálogo POS desde Socrata (solo para sincronización). */
  private async fetchMedicamentosPosRowsFromSocrata(): Promise<{
    integrationName: string;
    url: string;
    httpStatus: number;
    durationMs: number;
    rows: Record<string, unknown>[];
  }> {
    const [row] = await this.dataSource.query<DbRow[]>(
      `SELECT ${SELECT_COLUMNS}
       FROM external_integrations
       WHERE is_active = TRUE
         AND integration_kind = 'SOCRATA_OPEN_DATA'
         AND (
           socrata_dataset_id = 'a7iv-sme8'
           OR name ILIKE $1
         )
       ORDER BY updated_at DESC
       LIMIT 1`,
      [`%${MEDICAMENTOS_POS_INTEGRATION_NAME}%`],
    );
    if (!row) {
      throw new NotFoundException(
        'No hay integración Socrata activa «MEDICAMENTOS POS». Configúrela en Integraciones API externas.',
      );
    }

    const cfg = this.socrataConfig(row);
    const syncQuery = this.socrata.stripLimitAndOffset(cfg.query);
    const start = Date.now();

    try {
      const fetched = await this.socrata.fetchAllPages({ ...cfg, query: syncQuery });
      await this.logPoll(
        row.id,
        'POST',
        fetched.lastUrl,
        fetched.ok ? 200 : 502,
        Date.now() - start,
      );

      if (!fetched.ok) {
        throw new ServiceUnavailableException(
          fetched.message ??
            'Medicamentos POS respondió con error. Verifique App Token (X-App-Token) en Integraciones.',
        );
      }

      const rows = fetched.rows.map((r) => sanitizeMedicamentosPosRow(r));
      if (!rows.length) {
        throw new ServiceUnavailableException(
          'Medicamentos POS no devolvió filas. Revise la consulta SoQL y el dataset a7iv-sme8.',
        );
      }

      return {
        integrationName: row.name,
        url: fetched.lastUrl,
        httpStatus: 200,
        durationMs: Date.now() - start,
        rows,
      };
    } catch (e) {
      if (
        e instanceof ServiceUnavailableException ||
        e instanceof BadRequestException ||
        e instanceof NotFoundException
      ) {
        throw e;
      }
      const msg = (e as Error).message;
      this.logger.error(`Medicamentos POS: ${msg}`);
      throw new ServiceUnavailableException(
        `No se pudo consultar Medicamentos POS: ${msg}`,
      );
    }
  }

  /** Sincroniza catálogo Medicamentos POS desde Socrata a BD local. */
  async syncMedicamentosPos(replaceExisting = true) {
    const [row] = await this.dataSource.query<DbRow[]>(
      `SELECT ${SELECT_COLUMNS}
       FROM external_integrations
       WHERE is_active = TRUE
         AND integration_kind = 'SOCRATA_OPEN_DATA'
         AND (
           socrata_dataset_id = $1
           OR name ILIKE $2
         )
       ORDER BY updated_at DESC
       LIMIT 1`,
      [MEDICAMENTOS_POS_DATASET_ID, `%${MEDICAMENTOS_POS_INTEGRATION_NAME}%`],
    );

    if (!row) {
      throw new BadRequestException(
        'No hay integración activa «MEDICAMENTOS POS». Créela en Configuración → Integraciones.',
      );
    }
    if (!row.authSecretEnc) {
      throw new BadRequestException(
        `Falta App Token en integración "${row.name}". Edítela y pegue el token.`,
      );
    }

    const start = Date.now();
    const fetched = await this.fetchMedicamentosPosRowsFromSocrata();
    const parsed = this.medicamentosPos.mapSocrataRows(fetched.rows);
    const sourceLabel = `socrata:${MEDICAMENTOS_POS_DATASET_ID}@${new Date().toISOString().slice(0, 10)}`;
    const importResult = await this.medicamentosPos.importParsedRows({
      rows: parsed,
      sourceLabel,
      replaceExisting,
    });

    return {
      ok: true,
      integrationId: row.id,
      integrationName: row.name,
      datasetId: MEDICAMENTOS_POS_DATASET_ID,
      rowsFetched: fetched.rows.length,
      rowsImported: importResult.rowsImported,
      batchId: importResult.batchId,
      durationMs: Date.now() - start,
      message: `Importados ${importResult.rowsImported} medicamentos POS desde datos.gov.co (${MEDICAMENTOS_POS_DATASET_ID})`,
    };
  }

  async queryMedicamentosPos(
    q?: string,
    page = 1,
    limit = 50,
    _refresh = false,
  ) {
    const result = await this.medicamentosPos.search({ q, page, limit });
    return {
      ok: true,
      httpStatus: 200,
      durationMs: 0,
      url: 'local://medicamentos_pos_registros',
      integrationName: MEDICAMENTOS_POS_INTEGRATION_NAME,
      ...result,
      columns: result.columns.length
        ? result.columns
        : medicamentosPosColumnNames([]),
    };
  }

  /** Cruce CUM Krystalos ↔ INVIMA CUM con estado regulatorio. */
  async queryKrystalosInvimaEstados(
    q?: string,
    page = 1,
    limit = 50,
    refresh = false,
    estadoFilter: EstadoFilter = 'ALL',
    codigo?: string,
    cum?: string,
    descripcion?: string,
    invimaListType?: string,
  ) {
    try {
      const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const safeLimit =
        Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;

      const fetched = await this.fetchKrystalosMedicamentosRows(refresh);
      const medicamentos = fetched.rows
        .map((r) => parseKrystalosMedicamento(r))
        .filter((m): m is NonNullable<typeof m> => m != null);

      const cumCodes = [
        ...new Set(medicamentos.map((m) => m.codcum).filter(Boolean)),
      ];

      const invimaByCum = await this.loadInvimaRowsByCum(cumCodes);

      let posAtcSet = new Set<string>();
      try {
        posAtcSet = await this.medicamentosPos.loadAtcSet();
      } catch (e) {
        this.logger.warn(
          `Índice ATC POS no disponible: ${(e as Error).message}`,
        );
      }

      const needle = q?.trim().toLowerCase();
      const allRows = medicamentos.map((med) => {
        const matches = med.codcum ? invimaByCum.get(med.codcum) ?? [] : [];
        const best = pickBestInvimaMatch(matches);
        const resumen = resolveEstadoResumen(med, matches);
        const pos = resolvePosLabel(best?.atc ?? null, posAtcSet);
        return {
          idArticulo: med.idArticulo,
          descripcion: med.descripcion,
          codcum: med.codcum || null,
          invimaMatched: matches.length > 0,
          invimaListType: best?.listType ?? null,
          invimaEstadoRegistro: best?.estadoRegistro ?? null,
          invimaFechaVencimiento: best?.fechaVencimiento ?? null,
          invimaProducto: best?.producto ?? null,
          invimaRegistroSanitario: best?.registroSanitario ?? null,
          invimaAtc: best?.atc ?? null,
          invimaMatchCount: matches.length,
          estadoKey: resumen.key,
          estadoLabel: resumen.label,
          posMatched: pos.posMatched,
          posLabel: pos.posLabel,
        };
      });

      const summary = {
        total: allRows.length,
        matched: allRows.filter((r) => r.invimaMatched).length,
        notMatched: allRows.filter((r) => r.codcum && !r.invimaMatched).length,
        sinCum: allRows.filter((r) => !r.codcum).length,
        vigente: allRows.filter((r) => r.estadoKey === 'VIGENTE').length,
        vencido: allRows.filter((r) => r.estadoKey === 'VENCIDO').length,
        renovacion: allRows.filter((r) => r.estadoKey === 'RENOVACION').length,
        otro: allRows.filter((r) => r.estadoKey === 'OTRO').length,
        sinRegistro: allRows.filter((r) => r.estadoKey === 'SIN_REGISTRO').length,
        posMedicamento: allRows.filter((r) => r.posMatched).length,
        noPos: allRows.filter((r) => !r.posMatched).length,
      };

    let merged = allRows;

    const codigoNeedle = codigo?.trim().toLowerCase();
    if (codigoNeedle) {
      merged = merged.filter((row) =>
        row.idArticulo.toLowerCase().includes(codigoNeedle),
      );
    }

    const cumNeedle = cum?.trim().toUpperCase();
    if (cumNeedle) {
      merged = merged.filter((row) =>
        (row.codcum ?? '').toUpperCase().includes(cumNeedle),
      );
    }

    const descNeedle = descripcion?.trim().toLowerCase();
    if (descNeedle) {
      merged = merged.filter((row) =>
        row.descripcion.toLowerCase().includes(descNeedle),
      );
    }

    if (invimaListType?.trim()) {
      merged = merged.filter((row) => row.invimaListType === invimaListType.trim());
    }

    if (needle) {
      merged = merged.filter((row) =>
        [
          row.idArticulo,
          row.descripcion,
          row.codcum,
          row.invimaProducto,
          row.invimaRegistroSanitario,
          row.invimaAtc,
          row.estadoLabel,
          row.posLabel,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }

    if (estadoFilter !== 'ALL') {
      merged = merged.filter((row) => matchesEstadoFilter(row.estadoKey, estadoFilter));
    }

    const total = merged.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const safePageClamped = Math.min(safePage, totalPages);
    const offset = (safePageClamped - 1) * safeLimit;
    const items = merged.slice(offset, offset + safeLimit);

    return {
      ok: fetched.httpStatus >= 200 && fetched.httpStatus < 300,
      httpStatus: fetched.httpStatus,
      durationMs: fetched.durationMs,
      url: fetched.url,
      integrationName: fetched.integrationName,
      summary,
      items,
      total,
      page: safePageClamped,
      limit: safeLimit,
      totalPages,
    };
    } catch (e) {
      if (
        e instanceof NotFoundException ||
        e instanceof BadRequestException ||
        e instanceof ServiceUnavailableException
      ) {
        throw e;
      }
      const msg = (e as Error).message;
      this.logger.error(`queryKrystalosInvimaEstados: ${msg}`, (e as Error).stack);
      throw new ServiceUnavailableException(
        `Error al cruzar Krystalos con INVIMA: ${msg}`,
      );
    }
  }

  private async loadInvimaRowsByCum(
    cumCodes: string[],
  ): Promise<Map<string, InvimaCumMatchRow[]>> {
    const invimaByCum = new Map<string, InvimaCumMatchRow[]>();
    if (!cumCodes.length) return invimaByCum;

    const chunkSize = 400;
    for (let i = 0; i < cumCodes.length; i += chunkSize) {
      const chunk = cumCodes.slice(i, i + chunkSize);
      const invimaRows = await this.dataSource.query<InvimaCumMatchRow[]>(
        `SELECT cum_codigo AS "cumCodigo",
                list_type AS "listType",
                estado_registro AS "estadoRegistro",
                to_char(fecha_vencimiento, 'YYYY-MM-DD') AS "fechaVencimiento",
                producto,
                registro_sanitario AS "registroSanitario",
                atc
         FROM invima_registros
         WHERE UPPER(TRIM(cum_codigo)) = ANY($1::text[])`,
        [chunk],
      );
      for (const inv of invimaRows) {
        const key = normalizeCum(inv.cumCodigo);
        const list = invimaByCum.get(key) ?? [];
        list.push(inv);
        invimaByCum.set(key, list);
      }
    }
    return invimaByCum;
  }
}
