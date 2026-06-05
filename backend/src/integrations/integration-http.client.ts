import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptSecret } from './integration-crypto.util';

export type AuthMethod = 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC';

export interface ExternalIntegrationRecord {
  id: string;
  baseUrl: string;
  authMethod: AuthMethod;
  authHeaderName?: string | null;
  authSecretEnc?: string | null;
  authUsername?: string | null;
  poPathTemplate: string;
}

export interface HttpFetchResult {
  ok: boolean;
  status: number;
  durationMs: number;
  data: unknown;
  text: string;
  url: string;
}

@Injectable()
export class IntegrationHttpClient {
  constructor(private readonly config: ConfigService) {}

  buildUrl(
    integration: ExternalIntegrationRecord,
    pathTemplate: string,
    vars: Record<string, string>,
  ): string {
    let path = pathTemplate.trim();
    for (const [k, v] of Object.entries(vars)) {
      path = path.replace(new RegExp(`\\{${k}\\}`, 'gi'), encodeURIComponent(v));
    }
    const base = integration.baseUrl.replace(/\/+$/, '');
    if (!path) return base;
    // Solo query (?consecutivo=…) — se concatena al final de la URL base
    if (path.startsWith('?')) {
      return `${base}${path}`;
    }
    if (!path.startsWith('/')) path = `/${path}`;
    return `${base}${path}`;
  }

  buildHeaders(integration: ExternalIntegrationRecord): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json; charset=utf-8',
    };

    if (integration.authMethod === 'NONE' || !integration.authSecretEnc) {
      return headers;
    }

    let secret: string;
    try {
      secret = decryptSecret(integration.authSecretEnc, this.config);
    } catch {
      throw new BadRequestException(
        'Token de integración inválido. Edite la integración y vuelva a guardar el API Key.',
      );
    }

    switch (integration.authMethod) {
      case 'API_KEY':
        headers[integration.authHeaderName?.trim() || 'x-api-key'] = secret;
        break;
      case 'BEARER':
        headers.Authorization = `Bearer ${secret}`;
        break;
      case 'BASIC': {
        const user = integration.authUsername ?? '';
        headers.Authorization = `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`;
        break;
      }
      default:
        break;
    }

    return headers;
  }

  async fetchJson(
    integration: ExternalIntegrationRecord,
    pathTemplate: string,
    vars: Record<string, string> = {},
    method = 'GET',
  ): Promise<HttpFetchResult> {
    const url = this.buildUrl(integration, pathTemplate, vars);
    const headers = this.buildHeaders(integration);
    const start = Date.now();

    const res = await fetch(url, {
      method,
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    const text = await res.text();
    const durationMs = Date.now() - start;
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { _raw: text.slice(0, 500) };
    }

    return {
      ok: res.ok,
      status: res.status,
      durationMs,
      data,
      text,
      url,
    };
  }
}
