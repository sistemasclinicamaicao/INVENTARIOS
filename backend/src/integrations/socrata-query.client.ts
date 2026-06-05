import { Injectable } from '@nestjs/common';
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

  async fetchAllPages(cfg: SocrataIntegrationConfig): Promise<{
    rows: Record<string, unknown>[];
    pages: number;
    lastUrl: string;
    ok: boolean;
    message?: string;
  }> {
    const all: Record<string, unknown>[] = [];
    let pageNumber = 1;
    let lastUrl = '';
    let ok = true;
    let message: string | undefined;

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
