import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import {
  inferListTypeFromFilename,
  InvimaListType,
  parseInvimaWorkbook,
  ParsedInvimaRow,
} from './invima-parser';

const BATCH_INSERT = 400;

@Injectable()
export class InvimaService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listBatches() {
    return this.dataSource.query(
      `SELECT id, list_type AS "listType", source_filename AS "sourceFilename",
              generated_at AS "generatedAt", rows_imported AS "rowsImported",
              imported_at AS "importedAt"
       FROM invima_import_batches
       ORDER BY imported_at DESC
       LIMIT 50`,
    );
  }

  /** Elimina todos los registros y batches (recarga desde integraciones Socrata). */
  async clearAll() {
    await this.dataSource.query(`DELETE FROM invima_registros`);
    await this.dataSource.query(`DELETE FROM invima_import_batches`);
    return { cleared: true };
  }

  async search(params: {
    q?: string;
    listType?: InvimaListType;
    cum?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const args: unknown[] = [];
    let n = 1;

    if (params.listType) {
      conditions.push(`r.list_type = $${n++}`);
      args.push(params.listType);
    }
    if (params.cum) {
      conditions.push(`r.cum_codigo ILIKE $${n++}`);
      args.push(`%${params.cum.trim()}%`);
    }
    if (params.q?.trim()) {
      const q = `%${params.q.trim()}%`;
      conditions.push(
        `(r.producto ILIKE $${n} OR r.registro_sanitario ILIKE $${n} OR r.titular ILIKE $${n} OR r.principio_activo ILIKE $${n} OR r.cum_codigo ILIKE $${n})`,
      );
      args.push(q);
      n++;
    }

    const where = conditions.join(' AND ');

    const orderBy = params.listType
      ? 'r.producto NULLS LAST, r.cum_codigo'
      : 'r.list_type, r.producto NULLS LAST, r.cum_codigo';

    const [countRow] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM invima_registros r WHERE ${where}`,
      args,
    );

    const items = await this.dataSource.query(
      `SELECT r.id, r.list_type AS "listType", r.expediente, r.producto, r.titular,
              r.registro_sanitario AS "registroSanitario",
              r.fecha_expedicion AS "fechaExpedicion",
              r.fecha_vencimiento AS "fechaVencimiento",
              r.estado_registro AS "estadoRegistro",
              r.expediente_cum AS "expedienteCum",
              r.consecutivo_cum AS "consecutivoCum",
              r.cantidad_cum AS "cantidadCum",
              r.cum_codigo AS "cumCodigo",
              r.descripcion_comercial AS "descripcionComercial",
              r.estado_cum AS "estadoCum",
              r.fecha_activo AS "fechaActivo",
              r.fecha_inactivo AS "fechaInactivo",
              r.muestra_medica AS "muestraMedica",
              r.unidad,
              r.principio_activo AS "principioActivo",
              r.concentracion,
              r.unidad_medida AS "unidadMedida",
              r.cantidad,
              r.unidad_referencia AS "unidadReferencia",
              r.forma_farmaceutica AS "formaFarmaceutica",
              r.via_administracion AS "viaAdministracion",
              r.atc,
              r.descripcion_atc AS "descripcionAtc",
              r.nombre_rol AS "nombreRol",
              r.tipo_rol AS "tipoRol",
              r.modalidad,
              r.ium,
              b.imported_at AS "importedAt",
              (
                r.list_type = 'VENCIDO'
                OR r.estado_registro ILIKE '%vencido%'
                OR (r.fecha_vencimiento IS NOT NULL AND r.fecha_vencimiento < CURRENT_DATE)
              ) AS "isExpired"
       FROM invima_registros r
       JOIN invima_import_batches b ON b.id = r.batch_id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $${n++} OFFSET $${n++}`,
      [...args, limit, offset],
    );

    const batches = await this.dataSource.query(
      `SELECT list_type AS "listType", COUNT(*)::int AS count
       FROM invima_registros GROUP BY list_type`,
    );

    return {
      items,
      total: countRow?.total ?? 0,
      page,
      limit,
      countsByListType: batches,
    };
  }

  async importFromFile(options: {
    filePath: string;
    listType?: InvimaListType;
    replaceExisting?: boolean;
  }) {
    const absPath = resolve(options.filePath);
    let buffer: Buffer;
    try {
      buffer = readFileSync(absPath);
    } catch {
      throw new NotFoundException(`Archivo no encontrado: ${options.filePath}`);
    }

    const filename = absPath.split(/[/\\]/).pop() ?? 'unknown.xlsx';
    const listType =
      options.listType ?? inferListTypeFromFilename(filename) ?? null;
    if (!listType) {
      throw new BadRequestException(
        'Indique listType (VIGENTE|VENCIDO|RENOVACION|OTRO_ESTADO) o use un nombre de archivo reconocible',
      );
    }

    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const { rows, generatedAt } = parseInvimaWorkbook(buffer);

    if (rows.length === 0) {
      throw new BadRequestException('No se encontraron filas de datos en el Excel');
    }

    return this.importParsedRows({
      listType,
      rows,
      sourceLabel: filename,
      fileHash,
      generatedAt,
      replaceExisting: options.replaceExisting,
    });
  }

  async importParsedRows(options: {
    listType: InvimaListType;
    rows: ParsedInvimaRow[];
    sourceLabel: string;
    fileHash?: string | null;
    generatedAt?: string | null;
    replaceExisting?: boolean;
  }) {
    const { listType, rows, sourceLabel } = options;
    if (rows.length === 0) {
      throw new BadRequestException('No hay filas para importar');
    }

    const fileHash =
      options.fileHash ??
      createHash('sha256').update(`${sourceLabel}:${rows.length}`).digest('hex');
    const generatedAt = options.generatedAt ?? null;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      if (options.replaceExisting) {
        await qr.query(`DELETE FROM invima_registros WHERE list_type = $1`, [listType]);
        await qr.query(`DELETE FROM invima_import_batches WHERE list_type = $1`, [listType]);
      }

      const [batch] = await qr.query(
        `INSERT INTO invima_import_batches (list_type, source_filename, generated_at, rows_imported, file_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [listType, sourceLabel, generatedAt, rows.length, fileHash],
      );
      const batchId = batch.id as string;

      for (let i = 0; i < rows.length; i += BATCH_INSERT) {
        const chunk = rows.slice(i, i + BATCH_INSERT);
        const values: unknown[] = [];
        const placeholders: string[] = [];
        let p = 1;

        for (const r of chunk) {
          placeholders.push(
            `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`,
          );
          values.push(
            batchId,
            listType,
            r.expediente,
            r.producto,
            r.titular,
            r.registroSanitario,
            r.fechaExpedicion,
            r.fechaVencimiento,
            r.estadoRegistro,
            r.expedienteCum,
            r.consecutivoCum,
            r.cantidadCum,
            r.cumCodigo,
            r.descripcionComercial,
            r.estadoCum,
            r.fechaActivo,
            r.fechaInactivo,
            r.muestraMedica,
            r.unidad,
            r.principioActivo,
            r.concentracion,
            r.unidadMedida,
            r.cantidad,
            r.unidadReferencia,
            r.formaFarmaceutica,
            r.viaAdministracion,
            r.atc,
            r.descripcionAtc,
            r.nombreRol,
            r.tipoRol,
            r.modalidad,
            r.ium,
            JSON.stringify(r.rawRow),
          );
        }

        await qr.query(
          `INSERT INTO invima_registros (
            batch_id, list_type, expediente, producto, titular, registro_sanitario,
            fecha_expedicion, fecha_vencimiento, estado_registro, expediente_cum,
            consecutivo_cum, cantidad_cum, cum_codigo, descripcion_comercial, estado_cum,
            fecha_activo, fecha_inactivo, muestra_medica, unidad, principio_activo,
            concentracion, unidad_medida, cantidad, unidad_referencia, forma_farmaceutica,
            via_administracion, atc, descripcion_atc, nombre_rol, tipo_rol, modalidad, ium, raw_row
          ) VALUES ${placeholders.join(',')}`,
          values,
        );
      }

      await qr.commitTransaction();

      return {
        batchId,
        listType,
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

  async importAllFromDataDir(dataDir?: string) {
    const dir = dataDir
      ? resolve(dataDir)
      : resolve(process.cwd(), '..', 'data', 'invima');
    const files: { path: string; type: InvimaListType }[] = [
      { path: `${dir}/ListadoCodigoUnicoVigentes2022.xlsx`, type: 'VIGENTE' },
      { path: `${dir}/ListadoCodigoUnicoVencidos2022.xlsx`, type: 'VENCIDO' },
      { path: `${dir}/ListadoCodigoUnicoRenovacion2022.xlsx`, type: 'RENOVACION' },
      { path: `${dir}/ListadoCodigounicoOtrosEstado2022.xlsx`, type: 'OTRO_ESTADO' },
    ];

    type ImportOk = {
      ok: true;
      batchId: string;
      listType: InvimaListType;
      sourceFilename: string;
      rowsImported: number;
      fileHash: string;
    };
    type ImportFail = { ok: false; file: string; error: string };
    const results: Array<ImportOk | ImportFail> = [];
    for (const f of files) {
      try {
        const r = await this.importFromFile({
          filePath: f.path,
          listType: f.type,
          replaceExisting: true,
        });
        results.push({ ok: true, ...r });
      } catch (e) {
        results.push({
          ok: false,
          file: f.path,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return results;
  }
}
