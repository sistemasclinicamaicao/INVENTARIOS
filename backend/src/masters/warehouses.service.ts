import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { foldAccents } from '../common/text.util';
import {
  erpBodegaToWarehouseType,
  normalizeErpBodegaCode,
} from '../integrations/erp-warehouse-codes.util';
import {
  PURCHASE_DESTINATION_TYPES,
  usesFefoPolicy,
  WAREHOUSE_TYPE,
} from './warehouse-types.util';

export type ErpWarehouseHint = {
  code?: string | null;
  name?: string | null;
};

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  policy: string;
};

@Injectable()
export class WarehousesService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findAll() {
    return this.dataSource.query(`
      SELECT id, code, name, type, policy::text AS policy, is_active AS "isActive"
      FROM warehouses
      WHERE is_active = TRUE
      ORDER BY name
    `);
  }

  /** Bodegas destino de órdenes de compra (02, 10, 11 CXC). */
  async listPurchaseDestinations() {
    const types = PURCHASE_DESTINATION_TYPES as unknown as string[];
    return this.dataSource.query<WarehouseRow[]>(
      `SELECT id, code, name, type, policy::text AS policy
       FROM warehouses
       WHERE is_active = TRUE AND type = ANY($1::text[])
       ORDER BY erp_bodega_code NULLS LAST, name`,
      [types],
    );
  }

  /**
   * Mapea bodega indicada por CXC a una bodega destino local (por erp_bodega_code o tipo).
   */
  async mapErpToCentralDestination(
    hint: ErpWarehouseHint,
  ): Promise<WarehouseRow | null> {
    const name = (hint.name ?? '').trim();
    const code = (hint.code ?? '').trim();
    if (!name && !code) return null;

    const erpDigits =
      normalizeErpBodegaCode(code) ?? normalizeErpBodegaCode(name);
    if (erpDigits) {
      const [byErpCode] = await this.dataSource.query<WarehouseRow[]>(
        `SELECT id, code, name, type, policy::text AS policy
         FROM warehouses
         WHERE is_active = TRUE AND erp_bodega_code = $1
         LIMIT 1`,
        [erpDigits],
      );
      if (byErpCode) return byErpCode;
    }

    const centralType =
      erpBodegaToWarehouseType(code, name) ?? this.inferCentralType(name, code);
    const [wh] = await this.dataSource.query<WarehouseRow[]>(
      `SELECT id, code, name, type, policy::text AS policy
       FROM warehouses
       WHERE is_active = TRUE AND type = $1::text
       ORDER BY code LIMIT 1`,
      [centralType],
    );
    return wh ?? null;
  }

  private inferCentralType(name: string, code: string): string {
    return erpBodegaToWarehouseType(code, name) ?? this.inferCentralTypeByText(name, code);
  }

  private inferCentralTypeByText(name: string, code: string): string {
    const n = foldAccents(`${name} ${code}`).toUpperCase();
    if (/CONFECC/.test(n)) return WAREHOUSE_TYPE.BODEGA_CONFECCIONES;
    if (/SERVICIO\s*FARM|FARMACEUT|FARMACIA|MEDIC|FEFO|BC-FARM/.test(n)) {
      return WAREHOUSE_TYPE.CENTRAL_FARMACIA;
    }
    if (/ALM|ALMACEN|GRAL|BC-ALM/.test(n)) return WAREHOUSE_TYPE.CENTRAL_ALMACEN;
    return WAREHOUSE_TYPE.CENTRAL_ALMACEN;
  }

  /** Busca bodega por código/nombre; si no existe la crea (p. ej. desde consulta CXC). */
  async findOrCreateFromErp(
    hint: ErpWarehouseHint,
  ): Promise<(WarehouseRow & { created: boolean }) | null> {
    const name = (hint.name ?? '').trim();
    const codeInput = (hint.code ?? '').trim();
    if (!name && !codeInput) return null;

    const code = this.normalizeWarehouseCode(codeInput || name);

    const [byCode] = await this.dataSource.query<
      (WarehouseRow & { isActive: boolean })[]
    >(
      `SELECT id, code, name, type, policy::text AS policy, is_active AS "isActive"
       FROM warehouses WHERE UPPER(code) = $1 LIMIT 1`,
      [code],
    );
    if (byCode) {
      if (!byCode.isActive) {
        await this.dataSource.query(
          `UPDATE warehouses SET is_active = TRUE, name = COALESCE(NULLIF($2, ''), name) WHERE id = $1`,
          [byCode.id, name || null],
        );
      }
      const { isActive: _a, ...row } = byCode;
      return { ...row, created: false };
    }

    if (name) {
      const [byName] = await this.dataSource.query<WarehouseRow[]>(
        `SELECT id, code, name, type, policy::text AS policy
         FROM warehouses WHERE name ILIKE $1
         ORDER BY is_active DESC, name LIMIT 1`,
        [name],
      );
      if (byName) return { ...byName, created: false };
    }

    const type = this.inferWarehouseType(name, code);
    const policy = usesFefoPolicy(type) ? 'FEFO' : 'FIFO';
    const displayName = name || code;

    const [created] = await this.dataSource.query<WarehouseRow[]>(
      `INSERT INTO warehouses (code, name, type, policy, is_active)
       VALUES ($1, $2, $3::text, $4::inventory_policy, TRUE)
       RETURNING id, code, name, type, policy::text AS policy`,
      [code, displayName, type, policy],
    );

    return created ? { ...created, created: true } : null;
  }

  /** Código interno sin tildes (p. ej. BC-ALM); el nombre conserva acentos. */
  private normalizeWarehouseCode(raw: string): string {
    const up = foldAccents(raw)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    return up.length >= 2 ? up : `ERP-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  }

  private inferWarehouseType(name: string, code: string): string {
    const mapped = erpBodegaToWarehouseType(code, name);
    if (mapped) return mapped;
    const n = foldAccents(`${name} ${code}`).toUpperCase();
    if (/CONFECC/.test(n)) return WAREHOUSE_TYPE.BODEGA_CONFECCIONES;
    if (/SERVICIO\s*FARM|FARMACEUT|FARM|FARMACIA|MEDIC|FEFO/.test(n)) {
      return WAREHOUSE_TYPE.CENTRAL_FARMACIA;
    }
    if (/ALM|ALMACEN|GRAL|BC-ALM/.test(n)) return WAREHOUSE_TYPE.CENTRAL_ALMACEN;
    if (/SAT|URG|PERIF|QUIRO|UCI/.test(n)) return WAREHOUSE_TYPE.SATELITE;
    return WAREHOUSE_TYPE.SATELITE;
  }

  async findLocations(warehouseId: string) {
    return this.dataSource.query(
      `SELECT id, code, aisle, shelf, level FROM locations WHERE warehouse_id = $1 ORDER BY code`,
      [warehouseId],
    );
  }

  /** Saldos de inventario por bodega (tabla inventory_balances). */
  async getInventory(warehouseId: string) {
    const [warehouse] = await this.dataSource.query(
      `SELECT id, code, name, type, policy::text AS policy
       FROM warehouses WHERE id = $1 AND is_active = TRUE`,
      [warehouseId],
    );
    if (!warehouse) return null;

    const rows = await this.dataSource.query(
      `SELECT
         p.id AS "productId",
         p.code AS "productCode",
         p.name AS "productName",
         p.base_unit AS unit,
         p.min_stock AS "minStock",
         loc.code AS "locationCode",
         l.lot_number AS "lotNumber",
         l.expires_at AS "expiresAt",
         COALESCE(ib.qty, 0) AS qty
       FROM inventory_balances ib
       JOIN products p ON p.id = ib.product_id
       LEFT JOIN locations loc ON loc.id = ib.location_id
       LEFT JOIN lots l ON l.id = ib.lot_id
       WHERE ib.warehouse_id = $1 AND p.is_active = TRUE
         AND p.is_farmacia = $2
       ORDER BY p.code, l.expires_at NULLS LAST`,
      [warehouseId, warehouse.type === 'CENTRAL_FARMACIA'],
    );

    const lines = rows.map(
      (r: {
        qty: string
        minStock: string
        expiresAt: Date | null
      }) => ({
        ...r,
        qty: Number(r.qty),
        minStock: Number(r.minStock),
        expiresAt: r.expiresAt ? String(r.expiresAt).slice(0, 10) : null,
        lowStock: Number(r.qty) < Number(r.minStock),
      }),
    );

    const productCount = new Set(lines.map((l: { productId: string }) => l.productId)).size;
    const totalQty = lines.reduce((s: number, l: { qty: number }) => s + l.qty, 0);

    return {
      warehouse,
      summary: { lineCount: lines.length, productCount, totalQty },
      lines,
    };
  }

  async addBarcode(productId: string, barcode: string, type = 'EAN') {
    await this.dataSource.query(
      `INSERT INTO product_barcodes (product_id, barcode, type) VALUES ($1, $2, $3)
       ON CONFLICT (barcode) DO NOTHING`,
      [productId, barcode.trim(), type],
    );
    return { success: true };
  }
}
