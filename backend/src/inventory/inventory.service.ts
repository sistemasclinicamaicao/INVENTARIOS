import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getBalances(warehouseCode?: string) {
    const params: string[] = [];
    let where = 'WHERE p.is_active = TRUE';
    if (warehouseCode) {
      where += ' AND w.code = $1';
      params.push(warehouseCode);
    }

    const rows = await this.dataSource.query(
      `SELECT
         ib.id AS "balanceId",
         p.id AS "productId",
         p.code AS "productCode",
         p.name AS "productName",
         p.description AS "productDescription",
         p.base_unit AS unit,
         p.min_stock AS "minStock",
         p.is_farmacia AS "isFarmacia",
         p.requires_lote AS "requiresLot",
         p.is_controlado AS "isControlado",
         p.policy::text AS "productPolicy",
         w.id AS "warehouseId",
         w.name AS "warehouseName",
         w.code AS "warehouseCode",
         w.type AS "warehouseType",
         w.policy::text AS "warehousePolicy",
         loc.code AS "locationCode",
         l.id AS "lotId",
         l.lot_number AS "lotNumber",
         l.expires_at AS "expiresAt",
         l.internal_barcode AS "lotInternalBarcode",
         COALESCE(ib.qty, 0) AS qty,
         price.last_unit_price AS "unitPrice"
       FROM inventory_balances ib
       JOIN products p ON p.id = ib.product_id
       JOIN warehouses w ON w.id = ib.warehouse_id
       LEFT JOIN locations loc ON loc.id = ib.location_id
       LEFT JOIN lots l ON l.id = ib.lot_id
       LEFT JOIN LATERAL (
         SELECT sp.last_unit_price
         FROM supplier_products sp
         WHERE sp.product_id = p.id AND sp.last_unit_price IS NOT NULL
         ORDER BY sp.updated_at DESC
         LIMIT 1
       ) price ON TRUE
       ${where}
       AND ib.qty > 0
       ORDER BY w.name, p.code, l.expires_at NULLS LAST`,
      params,
    );

    return rows.map(
      (r: {
        qty: string
        minStock: string
        unitPrice: string | null
        expiresAt: Date | null
      }) => {
        const qty = Number(r.qty)
        const unitPrice = r.unitPrice != null ? Number(r.unitPrice) : null
        return {
          ...r,
          qty,
          minStock: Number(r.minStock),
          unitPrice,
          lineValue: unitPrice != null ? qty * unitPrice : null,
          expiresAt: r.expiresAt ? String(r.expiresAt).slice(0, 10) : null,
          lowStock: qty < Number(r.minStock),
        }
      },
    );
  }

  async getMovements(limit = 50) {
    const rows = await this.dataSource.query(
      `SELECT im.id, im.type, im.qty, im.created_at AS "createdAt",
              p.code AS "productCode", p.name AS "productName",
              w.name AS "warehouseName", l.lot_number AS "lotNumber"
       FROM inventory_movements im
       JOIN products p ON p.id = im.product_id
       JOIN warehouses w ON w.id = im.warehouse_id
       LEFT JOIN lots l ON l.id = im.lot_id
       ORDER BY im.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r: { qty: string }) => ({ ...r, qty: Number(r.qty) }));
  }

  async cycleCount(data: {
    warehouseId: string;
    productId: string;
    lotId?: string;
    countedQty: number;
  }) {
    const [bal] = await this.dataSource.query(
      `SELECT id, qty FROM inventory_balances
       WHERE warehouse_id = $1 AND product_id = $2 AND lot_id IS NOT DISTINCT FROM $3`,
      [data.warehouseId, data.productId, data.lotId ?? null],
    );
    const current = Number(bal?.qty ?? 0);
    const diff = data.countedQty - current;
    if (diff === 0) return { adjusted: false, previousQty: current, newQty: current };

    await this.dataSource.query(
      `INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (warehouse_id, location_id, product_id, lot_id)
       DO UPDATE SET qty = EXCLUDED.qty`,
      [data.warehouseId, data.productId, data.lotId ?? null, data.countedQty],
    );
    await this.dataSource.query(
      `INSERT INTO inventory_movements (type, warehouse_id, product_id, lot_id, qty, reference_type)
       VALUES ('CYCLE_COUNT', $1, $2, $3, $4, 'CYCLE_COUNT')`,
      [data.warehouseId, data.productId, data.lotId ?? null, diff],
    );
    return { adjusted: true, previousQty: current, newQty: data.countedQty, difference: diff };
  }

  async getWarehouses() {
    return this.dataSource.query(`
      SELECT w.id, w.code, w.name, w.type, w.policy::text AS policy,
             COALESCE(SUM(ib.qty), 0) AS "totalQty",
             COUNT(DISTINCT ib.product_id) AS "productCount"
      FROM warehouses w
      LEFT JOIN inventory_balances ib ON ib.warehouse_id = w.id AND ib.qty > 0
      WHERE w.is_active = TRUE
      GROUP BY w.id
      ORDER BY w.name
    `);
  }
}
