import { Injectable, Logger } from '@nestjs/common';
import {
  ExternalIntegrationRecord,
  IntegrationHttpClient,
} from './integration-http.client';

export type SocrataApiVersion = 'SODA2' | 'SODA3';

export interface SocrataIntegrationConfig {
  baseUrl: string;
  datasetId: string;
  apiVersion: SocrataApiVersion;
  query: string;
  pageSize: number;
  record: ExternalIntegrationRecord;
}

export interface SocrataPageResult {
  ok: boolean;
  status: number;
  durationMs: number;
  url: string;
  rows: Record<string, unknown>[];
  message?: string;
}

export interface SocrataViewMetadata {
  rowsUpdatedAt: string | null;
  publicationDate: string | null;
}

export interface SocrataViewMetadataResult {
  ok: boolean;
  status: number;
  durationMs: number;
  url: string;
  metadata: SocrataViewMetadata | null;
  message?: string;
}

const MAX_TOTAL_ROWS = 500_000;

@Injectable()
export class SocrataQueryClient {
  private readonly logger = new Logger(SocrataQueryClient.name);

  constructor(private readonly http: IntegrationHttpClient) {}

  private normalizeRows(data: unknown): Record<string, unknown>[] {
    if (Array.isArray(data)) {
      return data.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.results)) {
        return obj.results as Record<string, unknown>[];
      }
      if (Array.isArray(obj.data)) {
        return obj.data as Record<string, unknown>[];
      }
    }
    return [];
  }

  /** Añade LIMIT si la consulta no lo tiene (para test/preview). */
  ensureLimit(query: string, limit: number): string {
    const q = query.trim().replace(/;\s*$/, '');
    if (/\bLIMIT\s+\d+/i.test(q)) return q;
    return `${q}\nLIMIT ${limit}`;
  }

  /** Quita LIMIT/OFFSET de SoQL para sincronización completa paginada. */
  stripLimitAndOffset(query: string): string {
    return query
      .trim()
      .replace(/;\s*$/, '')
      .replace(/\bLIMIT\s+\d+/gi, '')
      .replace(/\bOFFSET\s+\d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async fetchPage(
    cfg: SocrataIntegrationConfig,
    pageNumber: number,
  ): Promise<SocrataPageResult> {
    const start = Date.now();
    const base = cfg.baseUrl.replace(/\/+$/, '');
    const headers = {
      ...this.http.buildHeaders(cfg.record),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    try {
      if (cfg.apiVersion === 'SODA3') {
        const url = `${base}/api/v3/views/${cfg.datasetId}/query.json`;
        const body = JSON.stringify({
          query: cfg.query,
          page: { pageNumber, pageSize: cfg.pageSize },
          includeSynthetic: false,
        });
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(120_000),
        });
        const text = await res.text();
        const durationMs = Date.now() - start;
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          return {
            ok: false,
            status: res.status,
            durationMs,
            url,
            rows: [],
            message: 'Respuesta no es JSON válido',
          };
        }
        const rows = this.normalizeRows(data);
        return {
          ok: res.ok,
          status: res.status,
          durationMs,
          url,
          rows,
          message: res.ok ? undefined : this.errorMessage(res.status, data, text),
        };
      }

      const offset = (pageNumber - 1) * cfg.pageSize;
      const encodedQuery = encodeURIComponent(cfg.query);
      const url = `${base}/resource/${cfg.datasetId}.json?$query=${encodedQuery}&$limit=${cfg.pageSize}&$offset=${offset}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.http.buildHeaders(cfg.record),
        signal: AbortSignal.timeout(120_000),
      });
      const text = await res.text();
      const durationMs = Date.now() - start;
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        return {
          ok: false,
          status: res.status,
          durationMs,
          url,
          rows: [],
          message: 'Respuesta no es JSON válido',
        };
      }
      return {
        ok: res.ok,
        status: res.status,
        durationMs,
        url,
        rows: this.normalizeRows(data),
        message: res.ok ? undefined : this.errorMessage(res.status, data, text),
      };
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      const cause = err.cause?.code ?? err.cause?.message;
      const detail = cause ? `${err.message} (${cause})` : err.message;
      return {
        ok: false,
        status: 0,
        durationMs: Date.now() - start,
        url: `${base}/…/${cfg.datasetId}`,
        rows: [],
        message: `No se pudo conectar con Socrata (${cfg.baseUrl}): ${detail}. Verifique salida a internet del contenedor API.`,
      };
    }
  }

  private errorMessage(status: number, data: unknown, text: string): string {
    if (data && typeof data === 'object') {
      const o = data as Record<string, unknown>;
      const parts = [o.message, o.error, o.errorMessage, o.description]
        .filter((v) => typeof v === 'string' && v.trim())
        .map((v) => String(v).trim());
      if (parts.length) return `HTTP ${status}: ${parts.join(' — ')}`;
    }
    const snippet = text.trim().slice(0, 200);
    return snippet ? `HTTP ${status}: ${snippet}` : `HTTP ${status}`;
  }

  private isInvalidAppToken(status: number, message?: string): boolean {
    if (status !== 403) return false;
    const m = (message ?? '').toLowerCase();
    return m.includes('invalid app_token') || m.includes('permission_denied');
  }

  shouldUsePublicDownload(status: number, message?: string): boolean {
    if (this.isInvalidAppToken(status, message)) return true;
    if (status !== 400) return false;
    const m = (message ?? '').toLowerCase();
    return m.includes('no such column') || m.includes('no such function');
  }

  /** Descarga pública datos.gov.co (sin App Token) cuando SODA3 rechaza el token. */
  async probePublicDownload(
    baseUrl: string,
    datasetId: string,
  ): Promise<{ ok: boolean; status: number; url: string; durationMs: number }> {
    const start = Date.now();
    const base = baseUrl.replace(/\/+$/, '');
    const url = `${base}/api/views/${encodeURIComponent(datasetId)}/rows.csv?accessType=DOWNLOAD`;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(30_000),
      });
      return {
        ok: res.ok,
        status: res.status,
        url,
        durationMs: Date.now() - start,
      };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        url,
        durationMs: Date.now() - start,
      };
    }
  }

  async fetchPublicBulkRows(
    baseUrl: string,
    datasetId: string,
  ): Promise<SocrataPageResult> {
    const start = Date.now();
    const base = baseUrl.replace(/\/+$/, '');
    const url = `${base}/api/views/${encodeURIComponent(datasetId)}/rows.json?accessType=DOWNLOAD`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(300_000),
      });
      const text = await res.text();
      const durationMs = Date.now() - start;

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          durationMs,
          url,
          rows: [],
          message: this.errorMessage(res.status, null, text),
        };
      }

      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        return {
          ok: false,
          status: res.status,
          durationMs,
          url,
          rows: [],
          message: 'Descarga pública no es JSON válido',
        };
      }

      const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<
        string,
        unknown
      >;
      const meta = obj.meta as {
        view?: { columns?: Array<{ fieldName?: string }> };
      };
      const fieldNames =
        meta?.view?.columns?.map((c) => c.fieldName).filter(Boolean) ?? [];
      const rawRows = Array.isArray(obj.data) ? (obj.data as unknown[]) : [];

      const rows: Record<string, unknown>[] = [];
      for (const raw of rawRows) {
        if (!Array.isArray(raw)) continue;
        const row: Record<string, unknown> = {};
        for (let i = 0; i < fieldNames.length; i++) {
          const name = fieldNames[i];
          if (!name || name.startsWith(':')) continue;
          row[name] = raw[i];
        }
        rows.push(row);
      }

      return {
        ok: true,
        status: res.status,
        durationMs,
        url,
        rows,
        message: undefined,
      };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        durationMs: Date.now() - start,
        url,
        rows: [],
        message: (e as Error).message,
      };
    }
  }

  async fetchPreviewRows(
    cfg: SocrataIntegrationConfig,
    limit: number,
  ): Promise<SocrataPageResult & { usedPublicDownload?: boolean }> {
    const previewQuery = this.ensureLimit(cfg.query, limit);
    const page = await this.fetchPage({ ...cfg, query: previewQuery }, 1);
    if (page.ok) {
      return {
        ...page,
        rows: page.rows.slice(0, limit),
        usedPublicDownload: false,
      };
    }

    if (!this.shouldUsePublicDownload(page.status, page.message)) {
      return page;
    }

    this.logger.warn(
      `Socrata API falló (${cfg.datasetId}); vista previa vía descarga pública datos.gov.co`,
    );
    const bulk = await this.fetchPublicBulkRows(cfg.baseUrl, cfg.datasetId);
    if (!bulk.ok) return bulk;
    return {
      ...bulk,
      rows: bulk.rows.slice(0, limit),
      usedPublicDownload: true,
      message: undefined,
    };
  }

  async fetchAllPages(cfg: SocrataIntegrationConfig): Promise<{
    rows: Record<string, unknown>[];
    pages: number;
    lastUrl: string;
    ok: boolean;
    message?: string;
    usedPublicDownload?: boolean;
  }> {
    const first = await this.fetchPage(cfg, 1);
    if (!first.ok && this.shouldUsePublicDownload(first.status, first.message)) {
      this.logger.warn(
        `App Token rechazado por Socrata (${cfg.datasetId}); usando descarga pública datos.gov.co`,
      );
      const bulk = await this.fetchPublicBulkRows(cfg.baseUrl, cfg.datasetId);
      return {
        rows: bulk.rows,
        pages: 1,
        lastUrl: bulk.url,
        ok: bulk.ok,
        message: bulk.ok
          ? undefined
          : bulk.message ??
            'No se pudo descargar el dataset por la vía pública de datos.gov.co',
        usedPublicDownload: true,
      };
    }

    const all: Record<string, unknown>[] = [];
    let pageNumber = 1;
    let lastUrl = first.url;
    let ok = first.ok;
    let message: string | undefined = first.ok ? undefined : first.message;

    if (first.ok) {
      all.push(...first.rows);
      if (first.rows.length >= cfg.pageSize) {
        pageNumber = 2;
        while (all.length < MAX_TOTAL_ROWS) {
          const page = await this.fetchPage(cfg, pageNumber);
          lastUrl = page.url;
          if (!page.ok) {
            ok = false;
            message = page.message ?? `Error en página ${pageNumber}`;
            break;
          }
          if (!page.rows.length) break;
          all.push(...page.rows);
          if (page.rows.length < cfg.pageSize) break;
          pageNumber++;
        }
      }
    }

    return { rows: all, pages: pageNumber, lastUrl, ok, message };
  }

  private parseUnixTimestamp(value: unknown): string | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  /** Metadatos públicos del dataset (sin App Token). */
  async fetchViewMetadata(
    baseUrl: string,
    datasetId: string,
  ): Promise<SocrataViewMetadataResult> {
    const start = Date.now();
    const base = baseUrl.replace(/\/+$/, '');
    const url = `${base}/api/views/${encodeURIComponent(datasetId)}.json`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text();
      const durationMs = Date.now() - start;

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          durationMs,
          url,
          metadata: null,
          message: this.errorMessage(res.status, null, text),
        };
      }

      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        return {
          ok: false,
          status: res.status,
          durationMs,
          url,
          metadata: null,
          message: 'Respuesta de metadatos no es JSON válido',
        };
      }

      const obj = (data && typeof data === 'object' ? data : {}) as Record<
        string,
        unknown
      >;
      const rowsUpdatedAt = this.parseUnixTimestamp(obj.rowsUpdatedAt);
      const publicationDate = this.parseUnixTimestamp(obj.publicationDate);

      return {
        ok: true,
        status: res.status,
        durationMs,
        url,
        metadata: {
          rowsUpdatedAt,
          publicationDate,
        },
      };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        durationMs: Date.now() - start,
        url,
        metadata: null,
        message: (e as Error).message,
      };
    }
  }
}
