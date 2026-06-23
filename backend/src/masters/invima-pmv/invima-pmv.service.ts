import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { normalizeCumKey } from '../../integrations/cum-key.util';
import { parseInvimaPmvWorkbook, type ParsedPmvRow } from './invima-pmv.parser';

export interface PmvPriceRow {
  cum: string;
  precioMaxInstitucional: number | null;
  margenIps: number | null;
  fechaInicioVigencia: string | null;
}

export const INVIMA_PMV_COLUMNS = [
  'cum',
  'idMr',
  'mercadoRelevante',
  'medicamento',
  'cantidadUnidadMedida',
  'unidadMedida',
  'precioMaxInstitucional',
  'margenIps',
  'precioMaxComercialPs',
  'precioMaxComercialFinal',
  'circularCnpmdm',
  'fechaInicioVigencia',
] as const;

const BATCH_INSERT = 400;

@Injectable()
export class InvimaPmvService {
  private readonly logger = new Logger(InvimaPmvService.name);
  private pmvSchemaMissing = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private isMissingPmvSchemaError(error: unknown): boolean {
    const msg = String((error as Error)?.message ?? error);
    return /invima_pmv_/i.test(msg) && /does not exist|no existe|undefined_table/i.test(msg);
  }

  private markPmvSchemaMissing(error: unknown): void {
    if (!this.pmvSchemaMissing) {
      this.pmvSchemaMissing = true;
      this.logger.warn(
        'Tablas PMV no disponibles (aplique backend/migrations/029_invima_pmv_registros.sql)',
      );
    }
    if (error && !this.isMissingPmvSchemaError(error)) {
      throw error;
    }
  }

  async listBatches() {
    if (this.pmvSchemaMissing) return [];
    try {
      return await this.dataSource.query(
        `SELECT id, source_filename AS "sourceFilename",
                rows_imported AS "rowsImported",
                imported_at AS "importedAt"
         FROM invima_pmv_import_batches
         ORDER BY imported_at DESC
         LIMIT 20`,
      );
    } catch (error) {
      if (this.isMissingPmvSchemaError(error)) {
        this.markPmvSchemaMissing(error);
        return [];
      }
      throw error;
    }
  }

  async latestBatch() {
    const [batch] = await this.listBatches();
    return batch ?? null;
  }

  /** Una fila PMV por CUM (la de vigencia más reciente). */
  async loadPmvByCumKeys(cumKeys: string[]): Promise<Map<string, PmvPriceRow>> {
    const map = new Map<string, PmvPriceRow>();
    if (this.pmvSchemaMissing) return map;

    const unique = [
      ...new Set(cumKeys.map((k) => normalizeCumKey(k)).filter(Boolean)),
    ];
    if (!unique.length) return map;

    const chunkSize = 400;
    try {
      for (let i = 0; i < unique.length; i += chunkSize) {
        const chunk = unique.slice(i, i + chunkSize);
        const rows = await this.dataSource.query<PmvPriceRow[]>(
          `SELECT UPPER(TRIM(cum)) AS cum,
                  precio_max_institucional AS "precioMaxInstitucional",
                  margen_ips AS "margenIps",
                  fecha_inicio_vigencia AS "fechaInicioVigencia"
           FROM invima_pmv_registros
           WHERE UPPER(TRIM(cum)) = ANY($1::text[])
           ORDER BY fecha_inicio_vigencia DESC NULLS LAST`,
          [chunk],
        );
        for (const row of rows) {
          const key = normalizeCumKey(row.cum);
          if (key && !map.has(key)) {
            map.set(key, row);
          }
        }
      }
    } catch (error) {
      if (this.isMissingPmvSchemaError(error)) {
        this.markPmvSchemaMissing(error);
        return map;
      }
      throw error;
    }
    return map;
  }

  async search(params: { q?: string; cum?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const offset = (page - 1) * limit;

    if (this.pmvSchemaMissing) {
      return { items: [], columns: [...INVIMA_PMV_COLUMNS], total: 0, page, limit };
    }

    const conditions: string[] = ['1=1'];
    const args: unknown[] = [];
    let n = 1;

    if (params.cum?.trim()) {
      conditions.push(`r.cum ILIKE $${n++}`);
      args.push(`%${params.cum.trim()}%`);
    }
    if (params.q?.trim()) {
      const q = `%${params.q.trim()}%`;
      conditions.push(
        `(r.medicamento ILIKE $${n} OR r.cum ILIKE $${n} OR r.mercado_relevante ILIKE $${n}
          OR r.id_mr ILIKE $${n} OR r.circular_cnpmdm ILIKE $${n})`,
      );
      args.push(q);
      n++;
    }

    const where = conditions.join(' AND ');

    try {
      const [countRow] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS total FROM invima_pmv_registros r WHERE ${where}`,
        args,
      );

      const rows = await this.dataSource.query(
        `SELECT r.id,
                r.numero,
                r.id_mr AS "idMr",
                r.mercado_relevante AS "mercadoRelevante",
                r.cum,
                r.medicamento,
                r.cantidad_unidad_medida AS "cantidadUnidadMedida",
                r.unidad_medida AS "unidadMedida",
                r.precio_max_institucional AS "precioMaxInstitucional",
                r.margen_ips AS "margenIps",
                r.precio_max_comercial_ps AS "precioMaxComercialPs",
                r.precio_max_comercial_final AS "precioMaxComercialFinal",
                r.circular_cnpmdm AS "circularCnpmdm",
                r.fecha_inicio_vigencia AS "fechaInicioVigencia",
                r.ajuste_julio_2025 AS "ajusteJulio2025"
         FROM invima_pmv_registros r
         WHERE ${where}
         ORDER BY r.cum NULLS LAST, r.medicamento NULLS LAST, r.id
         LIMIT $${n++} OFFSET $${n++}`,
        [...args, limit, offset],
      );

      return {
        items: rows,
        columns: [...INVIMA_PMV_COLUMNS],
        total: countRow?.total ?? 0,
        page,
        limit,
      };
    } catch (error) {
      if (this.isMissingPmvSchemaError(error)) {
        this.markPmvSchemaMissing(error);
        return { items: [], columns: [...INVIMA_PMV_COLUMNS], total: 0, page, limit };
      }
      throw error;
    }
  }

  async importFromBuffer(options: {
    buffer: Buffer;
    filename: string;
    replaceExisting?: boolean;
  }) {
    const ext = options.filename.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xlsb') && !ext.endsWith('.xls')) {
      throw new BadRequestException('Formato no soportado. Use .xlsx o .xlsb');
    }

    let parsed: ParsedPmvRow[];
    try {
      parsed = parseInvimaPmvWorkbook(options.buffer);
    } catch (e) {
      throw new BadRequestException(`No se pudo leer el Excel: ${(e as Error).message}`);
    }

    if (parsed.length === 0) {
      throw new BadRequestException('El archivo no contiene filas PMV válidas');
    }

    const fileHash = createHash('sha256').update(options.buffer).digest('hex');
    const replaceExisting = options.replaceExisting !== false;

    return this.dataSource.transaction(async (manager) => {
      try {
        if (replaceExisting) {
          await manager.query(`DELETE FROM invima_pmv_registros`);
          await manager.query(`DELETE FROM invima_pmv_import_batches`);
        }
      } catch (error) {
        if (this.isMissingPmvSchemaError(error)) {
          throw new BadRequestException(
            'Tablas PMV no creadas. Ejecute la migración 029 (scripts/apply-migration-029.ps1) en la base de datos.',
          );
        }
        throw error;
      }

      const [batch] = await manager.query<{ id: string }[]>(
        `INSERT INTO invima_pmv_import_batches (source_filename, rows_imported, file_hash)
         VALUES ($1, 0, $2)
         RETURNING id`,
        [options.filename, fileHash],
      );
      const batchId = batch.id;

      let inserted = 0;
      for (let i = 0; i < parsed.length; i += BATCH_INSERT) {
        const chunk = parsed.slice(i, i + BATCH_INSERT);
        const values: unknown[] = [];
        const placeholders: string[] = [];
        let p = 1;

        for (const row of chunk) {
          placeholders.push(
            `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`,
          );
          values.push(
            batchId,
            row.numero,
            row.idMr,
            row.mercadoRelevante,
            row.cum,
            row.medicamento,
            row.cantidadUnidadMedida,
            row.unidadMedida,
            row.precioMaxInstitucional,
            row.margenIps,
            row.precioMaxComercialPs,
            row.precioMaxComercialFinal,
            row.circularCnpmdm,
            row.fechaInicioVigencia,
            row.ajusteJulio2025,
            JSON.stringify(row.rawRow),
          );
        }

        await manager.query(
          `INSERT INTO invima_pmv_registros (
             batch_id, numero, id_mr, mercado_relevante, cum, medicamento,
             cantidad_unidad_medida, unidad_medida, precio_max_institucional, margen_ips,
             precio_max_comercial_ps, precio_max_comercial_final, circular_cnpmdm,
             fecha_inicio_vigencia, ajuste_julio_2025, raw_row
           ) VALUES ${placeholders.join(', ')}`,
          values,
        );
        inserted += chunk.length;
      }

      await manager.query(
        `UPDATE invima_pmv_import_batches SET rows_imported = $1 WHERE id = $2`,
        [inserted, batchId],
      );

      return {
        ok: true,
        rowsImported: inserted,
        batchId,
        sourceFilename: options.filename,
        message: `Importados ${inserted.toLocaleString()} precios PMV desde ${options.filename}`,
      };
    });
  }
}
