import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WAREHOUSE_TYPE } from '../masters/warehouse-types.util';
import { CreateRequisitionDto } from './dto/create-requisition.dto';

const CENTRAL_SOURCE_TYPES = [
  WAREHOUSE_TYPE.CENTRAL_ALMACEN,
  WAREHOUSE_TYPE.CENTRAL_FARMACIA,
] as const;

@Injectable()
export class OperationsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listRequisitions(status?: string) {
    const params: string[] = [];
    let where = 'WHERE 1=1';
    if (status) {
      where += ' AND ir.status = $1';
      params.push(status);
    } else {
      where += ` AND ir.status IN ('PENDING', 'IN_PICKING', 'DISPATCHED')`;
    }
    return this.dataSource.query(
      `SELECT ir.id, ir.number, ir.status, ir.priority::text AS priority,
              s.name AS source, d.name AS destination,
              ir.created_at AS "createdAt"
       FROM internal_requisitions ir
       JOIN warehouses s ON s.id = ir.source_warehouse_id
       JOIN warehouses d ON d.id = ir.dest_warehouse_id
       ${where}
       ORDER BY
         CASE ir.priority WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
         ir.created_at ASC`,
      params,
    );
  }

  async previewNextNumber(): Promise<{ number: string }> {
    const number = await this.allocateNextNumber();
    return { number };
  }

  async getByNumber(number: string) {
    const [req] = await this.dataSource.query(
      `SELECT ir.id, ir.number, ir.status, ir.priority::text AS priority,
              ir.source_warehouse_id AS "sourceWarehouseId",
              ir.dest_warehouse_id AS "destWarehouseId",
              s.name AS "sourceName", d.name AS "destName", s.policy::text AS "sourcePolicy"
       FROM internal_requisitions ir
       JOIN warehouses s ON s.id = ir.source_warehouse_id
       JOIN warehouses d ON d.id = ir.dest_warehouse_id
       WHERE ir.number = $1`,
      [number.trim().toUpperCase()],
    );
    if (!req) throw new NotFoundException(`Requisición ${number} no encontrada`);

    const lines = await this.dataSource.query(
      `SELECT irl.id, p.id AS "productId", p.code, p.name, irl.qty_requested AS "qtyRequested", irl.unit
       FROM internal_requisition_lines irl
       JOIN products p ON p.id = irl.product_id
       WHERE irl.requisition_id = $1`,
      [req.id],
    );
    return { ...req, lines };
  }

  async create(dto: CreateRequisitionDto) {
    if (dto.sourceWarehouseId === dto.destWarehouseId) {
      throw new BadRequestException('La bodega origen y destino deben ser distintas');
    }
    if (!dto.lines?.length) {
      throw new BadRequestException('Agregue al menos una línea');
    }
    if (dto.lines.some((l) => l.qtyRequested <= 0)) {
      throw new BadRequestException('Todas las líneas deben tener cantidad mayor a cero');
    }

    const [src] = await this.dataSource.query<{ id: string; type: string }[]>(
      `SELECT id, type FROM warehouses WHERE id = $1 AND is_active = TRUE`,
      [dto.sourceWarehouseId],
    );
    const [dest] = await this.dataSource.query<{ id: string; type: string }[]>(
      `SELECT id, type FROM warehouses WHERE id = $1 AND is_active = TRUE`,
      [dto.destWarehouseId],
    );
    if (!src || !dest) {
      throw new BadRequestException('Bodega origen o destino inválida');
    }
    if (!(CENTRAL_SOURCE_TYPES as readonly string[]).includes(src.type)) {
      throw new BadRequestException(
        'La bodega origen debe ser Almacén General o Servicio Farmacéutico',
      );
    }
    if (dest.type !== WAREHOUSE_TYPE.SATELITE) {
      throw new BadRequestException('La bodega destino debe ser una bodega satélite');
    }

    const productIds = dto.lines.map((l) => l.productId);
    const stockRows = await this.dataSource.query<
      { product_id: string; code: string; available: string }[]
    >(
      `SELECT p.id AS product_id, p.code,
              COALESCE(SUM(ib.qty), 0)::numeric AS available
       FROM products p
       LEFT JOIN inventory_balances ib
         ON ib.product_id = p.id AND ib.warehouse_id = $1
       WHERE p.id = ANY($2::uuid[])
       GROUP BY p.id, p.code`,
      [dto.sourceWarehouseId, productIds],
    );
    const stockByProduct = new Map(
      stockRows.map((r) => [r.product_id, Number(r.available)]),
    );
    const withoutStock = dto.lines.filter((l) => {
      const available = stockByProduct.get(l.productId) ?? 0;
      return available <= 0;
    });
    if (withoutStock.length) {
      const codes = stockRows
        .filter((r) => withoutStock.some((l) => l.productId === r.product_id))
        .map((r) => r.code);
      throw new BadRequestException(
        `Sin stock en bodega origen para: ${codes.join(', ')}`,
      );
    }
    const insufficient = dto.lines.filter((l) => {
      const available = stockByProduct.get(l.productId) ?? 0;
      return l.qtyRequested > available;
    });
    if (insufficient.length) {
      const details = insufficient.map((l) => {
        const row = stockRows.find((r) => r.product_id === l.productId);
        const available = stockByProduct.get(l.productId) ?? 0;
        return `${row?.code ?? l.productId} (disp. ${available})`;
      });
      throw new BadRequestException(
        `Cantidad solicitada supera stock disponible: ${details.join(', ')}`,
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const number = dto.number?.trim()
        ? dto.number.trim().toUpperCase()
        : await this.allocateNextNumber(qr);

      const [req] = await qr.query(
        `INSERT INTO internal_requisitions (number, source_warehouse_id, dest_warehouse_id, priority, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING id, number`,
        [number, dto.sourceWarehouseId, dto.destWarehouseId, dto.priority ?? 'NORMAL'],
      );
      for (const line of dto.lines) {
        await qr.query(
          `INSERT INTO internal_requisition_lines (requisition_id, product_id, qty_requested, unit)
           VALUES ($1, $2, $3, $4)`,
          [req.id, line.productId, line.qtyRequested, line.unit],
        );
      }
      await qr.commitTransaction();
      return this.getByNumber(req.number);
    } catch (e: unknown) {
      await qr.rollbackTransaction();
      const err = e as { code?: string };
      if (err?.code === '23505') {
        const label = dto.number?.trim() ? dto.number.trim().toUpperCase() : 'generada';
        throw new BadRequestException(`Ya existe la requisición ${label}`);
      }
      throw e;
    } finally {
      await qr.release();
    }
  }

  private currentYear(): string {
    return String(new Date().getFullYear());
  }

  private formatReqNumber(year: string, seq: number): string {
    return `REQ-${year}-${String(seq).padStart(3, '0')}`;
  }

  /** Preview or allocate next REQ-YYYY-NNN (use queryRunner inside a transaction). */
  private async allocateNextNumber(
    qr?: ReturnType<DataSource['createQueryRunner']>,
  ): Promise<string> {
    const year = this.currentYear();
    const runner = qr ?? this.dataSource;
    const [row] = await runner.query<{ next_seq: number }[]>(
      `SELECT COALESCE(MAX(
         (regexp_match(number, '^REQ-' || $1 || '-(\\d+)$'))[1]::int
       ), 0) + 1 AS next_seq
       FROM internal_requisitions
       WHERE number ~ ('^REQ-' || $1 || '-\\d{3}$')`,
      [year],
    );
    return this.formatReqNumber(year, Number(row?.next_seq ?? 1));
  }
}
