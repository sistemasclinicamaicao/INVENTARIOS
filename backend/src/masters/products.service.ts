import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { catalogLabel } from './warehouse-catalog.util';

@Injectable()
export class ProductsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async search(q?: string, limit = 20, isFarmacia?: boolean) {
    const term = q?.trim();
    if (!term) return [];
    const pattern = `%${term}%`;
    const params: unknown[] = [pattern, Math.min(50, Math.max(1, limit))];
    let catalogFilter = '';
    if (isFarmacia === true || isFarmacia === false) {
      catalogFilter = ' AND p.is_farmacia = $3';
      params.push(isFarmacia);
    }
    const rows = await this.dataSource.query(
      `SELECT p.id, p.code, p.name, p.base_unit AS "baseUnit",
              p.is_farmacia AS "isFarmacia", p.requires_lote AS "requiresLote"
       FROM products p
       WHERE p.is_active = TRUE
         AND (p.code ILIKE $1 OR p.name ILIKE $1)${catalogFilter}
       ORDER BY p.code
       LIMIT $2`,
      params,
    );
    return rows;
  }

  async findByCodeForCatalog(code: string, isFarmacia: boolean) {
    const [row] = await this.dataSource.query(
      `SELECT id, code, name, base_unit AS "baseUnit", is_farmacia AS "isFarmacia"
       FROM products
       WHERE is_active = TRUE AND UPPER(code) = $1 AND is_farmacia = $2
       LIMIT 1`,
      [code.trim().toUpperCase(), isFarmacia],
    );
    return row ?? null;
  }

  async findAll() {
    const rows = await this.dataSource.query(`
      SELECT p.id, p.code, p.name, p.description, p.base_unit AS "baseUnit",
             p.is_farmacia AS "isFarmacia", p.requires_lote AS "requiresLote",
             p.is_controlado AS "isControlado", p.min_stock AS "minStock",
             COALESCE(SUM(ib.qty), 0) AS "totalStock"
      FROM products p
      LEFT JOIN inventory_balances ib ON ib.product_id = p.id
      WHERE p.is_active = TRUE
      GROUP BY p.id
      ORDER BY p.code
    `);
    return rows.map((r: { totalStock: string }) => ({
      ...r,
      totalStock: Number(r.totalStock),
    }));
  }

  async create(dto: CreateProductDto) {
    const policy = dto.isFarmacia ? 'FEFO' : 'FIFO';
    const [row] = await this.dataSource.query(
      `INSERT INTO products (code, name, description, base_unit, is_farmacia, requires_lote, is_controlado, policy, min_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, code, name`,
      [
        dto.code,
        dto.name,
        dto.description ?? null,
        dto.baseUnit,
        dto.isFarmacia ?? false,
        dto.requiresLote ?? dto.isFarmacia ?? false,
        dto.isControlado ?? false,
        policy,
        dto.minStock ?? 0,
      ],
    );
    if (dto.barcode) {
      await this.dataSource.query(
        `INSERT INTO product_barcodes (product_id, barcode, type) VALUES ($1, $2, 'EAN')
         ON CONFLICT (barcode) DO NOTHING`,
        [row.id, dto.barcode],
      );
    }
    return row;
  }

  async bulkUpsertFromErpLines(
    lines: { code: string; name: string }[],
    opts: { isFarmacia: boolean },
  ) {
    const isFarmacia = opts.isFarmacia;
    const policy = isFarmacia ? 'FEFO' : 'FIFO';
    const results: { id: string; code: string; name: string }[] = [];
    const skippedWrongCatalog: string[] = [];

    for (const line of lines) {
      const code = line.code.trim().toUpperCase();
      const name = line.name.trim();
      if (!code || !name) continue;

      const [row] = await this.dataSource.query(
        `INSERT INTO products (code, name, base_unit, is_farmacia, requires_lote, policy)
         VALUES ($1, $2, 'UND', $3, $3, $4::inventory_policy)
         ON CONFLICT ((UPPER(TRIM(code))), is_farmacia) DO UPDATE SET
           name = EXCLUDED.name,
           updated_at = NOW()
         RETURNING id, code, name`,
        [code, name, isFarmacia, policy],
      );
      if (row) {
        results.push(row);
        continue;
      }

      const [existing] = await this.dataSource.query<{ is_farmacia: boolean }[]>(
        `SELECT is_farmacia FROM products WHERE UPPER(TRIM(code)) = $1 LIMIT 1`,
        [code],
      );
      if (existing && existing.is_farmacia !== isFarmacia) {
        skippedWrongCatalog.push(code);
      }
    }

    return {
      upserted: results.length,
      products: results,
      skippedWrongCatalog,
      catalog: catalogLabel(isFarmacia),
    };
  }

  async getSummary() {
    const [row] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM products WHERE is_active = TRUE) AS products,
        (SELECT COUNT(*)::int FROM warehouses WHERE is_active = TRUE) AS warehouses,
        (SELECT COUNT(*)::int FROM internal_requisitions WHERE status IN ('PENDING','IN_PICKING')) AS requisitions,
        (SELECT COUNT(*)::int FROM purchase_orders WHERE status IN ('APPROVED','PARTIAL')) AS open_orders
    `);
    return row;
  }
}
