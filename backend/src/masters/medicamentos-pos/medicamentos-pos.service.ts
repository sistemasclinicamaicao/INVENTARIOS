import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { MEDICAMENTOS_POS_SOQL_COLUMNS } from '../../integrations/medicamentos-pos.presets';
import {
  mapSocrataRowToPosRegistro,
  posRegistroToApiRow,
  type ParsedPosRow,
} from './medicamentos-pos.mapper';

const BATCH_INSERT = 400;

@Injectable()
export class MedicamentosPosService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listBatches() {
    return this.dataSource.query(
      `SELECT id, source_filename AS "sourceFilename",
              rows_imported AS "rowsImported",
              imported_at AS "importedAt"
       FROM medicamentos_pos_import_batches
       ORDER BY imported_at DESC
       LIMIT 20`,
    );
  }

  async latestBatch() {
    const [batch] = await this.listBatches();
    return batch ?? null;
  }

  async loadAtcSet(): Promise<Set<string>> {
    const rows = await this.dataSource.query<{ atc: string }[]>(
      `SELECT DISTINCT UPPER(TRIM(atc)) AS atc
       FROM medicamentos_pos_registros
       WHERE atc IS NOT NULL AND TRIM(atc) <> ''`,
    );
    return new Set(rows.map((r) => r.atc).filter(Boolean));
  }

  async search(params: { q?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const args: unknown[] = [];
    let n = 1;

    if (params.q?.trim()) {
      const q = `%${params.q.trim()}%`;
      conditions.push(
        `(r.producto ILIKE $${n} OR r.principio_activo ILIKE $${n} OR r.expediente ILIKE $${n}
          OR r.registro_sanitario ILIKE $${n} OR r.atc ILIKE $${n} OR r.descripcion_atc ILIKE $${n}
          OR r.descripcion_comercial ILIKE $${n} OR r.nombre_rol ILIKE $${n} OR r.estado_registro ILIKE $${n})`,
      );
      args.push(q);
      n++;
    }

    const where = conditions.join(' AND ');

    const [countRow] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM medicamentos_pos_registros r WHERE ${where}`,
      args,
    );

    const rows = await this.dataSource.query(
      `SELECT r.id,
              r.atc,
              r.principio_activo AS "principioActivo",
              r.descripcion_atc AS "descripcionAtc",
              r.producto,
              r.expediente,
              r.registro_sanitario AS "registroSanitario",
              r.fecha_vencimiento AS "fechaVencimiento",
              r.estado_registro AS "estadoRegistro",
              r.descripcion_comercial AS "descripcionComercial",
              r.unidad,
              r.via_administracion AS "viaAdministracion",
              r.concentracion,
              r.unidad_medida AS "unidadMedida",
              r.cantidad,
              r.unidad_referencia AS "unidadReferencia",
              r.forma_farmaceutica AS "formaFarmaceutica",
              r.nombre_rol AS "nombreRol"
       FROM medicamentos_pos_registros r
       WHERE ${where}
       ORDER BY r.producto NULLS LAST, r.expediente NULLS LAST, r.id
       LIMIT $${n++} OFFSET $${n++}`,
      [...args, limit, offset],
    );

    return {
      items: rows.map((row: Record<string, unknown>) => posRegistroToApiRow(row as never)),
      columns: [...MEDICAMENTOS_POS_SOQL_COLUMNS],
      total: countRow?.total ?? 0,
      page,
      limit,
    };
  }

  async importParsedRows(options: {
    rows: ParsedPosRow[];
    sourceLabel: string;
    fileHash?: string | null;
    replaceExisting?: boolean;
  }) {
    const { rows, sourceLabel } = options;
    if (rows.length === 0) {
      throw new BadRequestException('No hay filas POS para importar');
    }

    const fileHash =
      options.fileHash ??
      createHash('sha256').update(`${sourceLabel}:${rows.length}`).digest('hex');

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      if (options.replaceExisting !== false) {
        await qr.query(`DELETE FROM medicamentos_pos_registros`);
        await qr.query(`DELETE FROM medicamentos_pos_import_batches`);
      }

      const [batch] = await qr.query(
        `INSERT INTO medicamentos_pos_import_batches (source_filename, rows_imported, file_hash)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [sourceLabel, rows.length, fileHash],
      );
      const batchId = batch.id as string;

      for (let i = 0; i < rows.length; i += BATCH_INSERT) {
        const chunk = rows.slice(i, i + BATCH_INSERT);
        const values: unknown[] = [];
        const placeholders: string[] = [];
        let p = 1;

        for (const r of chunk) {
          placeholders.push(
            `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`,
          );
          values.push(
            batchId,
            r.atc,
            r.principioActivo,
            r.descripcionAtc,
            r.producto,
            r.expediente,
            r.registroSanitario,
            r.fechaVencimiento,
            r.estadoRegistro,
            r.descripcionComercial,
            r.unidad,
            r.viaAdministracion,
            r.concentracion,
            r.unidadMedida,
            r.cantidad,
            r.unidadReferencia,
            r.formaFarmaceutica,
            r.nombreRol,
            JSON.stringify(r.rawRow),
          );
        }

        await qr.query(
          `INSERT INTO medicamentos_pos_registros (
            batch_id, atc, principio_activo, descripcion_atc, producto, expediente,
            registro_sanitario, fecha_vencimiento, estado_registro, descripcion_comercial,
            unidad, via_administracion, concentracion, unidad_medida, cantidad,
            unidad_referencia, forma_farmaceutica, nombre_rol, raw_row
          ) VALUES ${placeholders.join(',')}`,
          values,
        );
      }

      await qr.commitTransaction();

      return {
        batchId,
        sourceFilename: sourceLabel,
        rowsImported: rows.length,
        fileHash,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  mapSocrataRows(rows: Record<string, unknown>[]): ParsedPosRow[] {
    return rows.map((row) => mapSocrataRowToPosRegistro(row));
  }
}
