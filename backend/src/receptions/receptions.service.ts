import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProductsService } from '../masters/products.service';
import { catalogLabel, isFarmaciaWarehouseType } from '../masters/warehouse-catalog.util';
import { PURCHASE_DESTINATION_TYPES } from '../masters/warehouse-types.util';
import { PurchaseOrdersService } from '../purchases/purchase-orders.service';
import { SuppliersService } from '../purchases/suppliers.service';
import { ConfirmReceptionDto } from './dto/confirm-reception.dto';
import { ImportErpReceptionDto } from './dto/import-erp-reception.dto';

@Injectable()
export class ReceptionsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async listWarehouses() {
    const types = PURCHASE_DESTINATION_TYPES as unknown as string[];
    const rows = await this.dataSource.query(
      `SELECT id, code, name, type
       FROM warehouses
       WHERE is_active = TRUE AND type = ANY($1::text[])
       ORDER BY erp_bodega_code NULLS LAST, name`,
      [types],
    );
    return rows.map((r: { id: string; code: string; name: string; type: string }) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
    }));
  }

  async updateOrderHeader(
    purchaseOrderId: string,
    data: { warehouseId?: string; supplierId?: string; supplierName?: string },
  ) {
    const [po] = await this.dataSource.query(
      `SELECT id, status FROM purchase_orders WHERE id = $1`,
      [purchaseOrderId],
    );
    if (!po) throw new NotFoundException('Orden de compra no encontrada');
    if (!['APPROVED', 'PARTIAL', 'DRAFT'].includes(po.status)) {
      throw new BadRequestException('La OC no admite cambios');
    }

    let supplierName: string | null = null;
    if (data.supplierId) {
      const [s] = await this.dataSource.query(
        `SELECT name FROM suppliers WHERE id = $1 AND is_active = TRUE`,
        [data.supplierId],
      );
      if (!s) throw new BadRequestException('Proveedor no válido');
      supplierName = s.name;
    } else if (data.supplierName?.trim()) {
      supplierName = data.supplierName.trim();
    }

    await this.dataSource.query(
      `UPDATE purchase_orders SET
         warehouse_id = COALESCE($2, warehouse_id),
         supplier_id = COALESCE($3, supplier_id),
         supplier_name = COALESCE($4, supplier_name),
         updated_at = NOW()
       WHERE id = $1`,
      [purchaseOrderId, data.warehouseId ?? null, data.supplierId ?? null, supplierName],
    );
    return { success: true };
  }

  async getOrderByOc(ocNumber: string) {
    const num = ocNumber.trim();
    const orders = await this.dataSource.query(
      `SELECT po.id, po.number, po.supplier_name, po.supplier_id, po.warehouse_id, po.status,
              po.erp_lines_count AS "erpLinesCount",
              po.linked_lines_count AS "linkedLinesCount",
              po.import_status AS "importStatus",
              w.name AS warehouse_name, w.type AS warehouse_type, w.code AS warehouse_code
       FROM purchase_orders po
       JOIN warehouses w ON w.id = po.warehouse_id
       WHERE po.number = ANY($1::text[]) AND po.status IN ('APPROVED', 'PARTIAL')`,
      [[num, num.toUpperCase()]],
    );
    if (!orders.length) {
      throw new NotFoundException(`Orden de compra ${ocNumber} no encontrada o ya recibida`);
    }
    const po = orders[0];
    const catalogFarmacia = isFarmaciaWarehouseType(po.warehouse_type);
    const lines = await this.dataSource.query(
      `SELECT
         pol.id AS line_id,
         p.id AS product_id,
         p.code,
         p.name,
         p.description AS presentation,
         pol.qty_ordered,
         pol.unit,
         pol.unit_price,
         pol.lot_number,
         pol.expires_at,
         pol.erp_code,
         pol.qty_erp,
         pol.fulfillment_status,
         COALESCE(rcv.total, 0) AS qty_received_total,
         p.requires_lote,
         p.is_farmacia
       FROM purchase_order_lines pol
       JOIN products p ON p.id = pol.product_id
       LEFT JOIN (
         SELECT
           COALESCE(rl.purchase_order_line_id, pol.id) AS po_line_id,
           SUM(rl.qty_received)::numeric AS total
         FROM reception_lines rl
         JOIN receptions r ON r.id = rl.reception_id
         JOIN purchase_order_lines pol ON pol.purchase_order_id = r.purchase_order_id
           AND (
             rl.purchase_order_line_id = pol.id
             OR (rl.purchase_order_line_id IS NULL AND rl.product_id = pol.product_id)
           )
         WHERE r.purchase_order_id = $1
         GROUP BY COALESCE(rl.purchase_order_line_id, pol.id)
       ) rcv ON rcv.po_line_id = pol.id
       WHERE pol.purchase_order_id = $1
         AND p.is_farmacia = $2
       ORDER BY
         CASE WHEN COALESCE(pol.fulfillment_status::text, 'PENDING') IN ('COMPLETE', 'SURPLUS') THEN 1 ELSE 0 END,
         p.code`,
      [po.id, catalogFarmacia],
    );

    const warehouses = await this.listWarehouses();

    const missingErpLines = await this.dataSource.query(
      `SELECT erp_code AS "erpCode", erp_description AS "erpDescription",
              qty_erp AS "qtyErp", unit_price AS "unitPrice", reason
       FROM purchase_order_missing_erp_lines
       WHERE purchase_order_id = $1
       ORDER BY erp_code`,
      [po.id],
    );

    return this.mapReceptionOrder(po, lines, warehouses, missingErpLines);
  }

  /** Importa líneas ERP: productos en catálogo, OC aprobada; lote/vencimiento en recepción. */
  async importFromErp(dto: ImportErpReceptionDto) {
    const supplier = await this.suppliersService.ensureForErpImport({
      supplierId: dto.supplierId,
      supplierTaxId: dto.supplierTaxId,
      supplierName: dto.supplierName,
    });

    const [wh] = await this.dataSource.query<{ type: string; code: string; name: string }[]>(
      `SELECT type, code, name FROM warehouses
       WHERE id = $1 AND is_active = TRUE
         AND type = ANY($2::text[])`,
      [dto.warehouseId, PURCHASE_DESTINATION_TYPES as unknown as string[]],
    );
    if (!wh) {
      throw new BadRequestException(
        'Bodega destino no válida. Use Almacén (02), Servicio Farmacéutico (10) o Confecciones (11).',
      );
    }

    const isFarmacia = isFarmaciaWarehouseType(wh.type);
    const catalog = catalogLabel(isFarmacia);

    const bulk = await this.productsService.bulkUpsertFromErpLines(
      dto.lines.map((l) => ({ code: l.code, name: l.name })),
      { isFarmacia },
    );

    const byCode = new Map(
      bulk.products.map((p) => [String(p.code).trim().toUpperCase(), p]),
    );

    const poLines: {
      productId: string;
      qtyOrdered: number;
      qtyErp: number;
      unit: string;
      unitPrice: number;
      lotNumber?: string;
      erpCode: string;
    }[] = [];
    const missingErpLines: {
      erpCode: string;
      erpDescription: string;
      qtyErp: number;
      unitPrice: number;
      reason: 'MISSING_PRODUCT' | 'WRONG_CATALOG';
    }[] = [];

    for (const row of dto.lines) {
      const code = row.code.trim().toUpperCase();
      const p =
        byCode.get(code) ??
        (await this.productsService.findByCodeForCatalog(code, isFarmacia));
      if (!p) {
        const [other] = await this.dataSource.query<{ is_farmacia: boolean }[]>(
          `SELECT is_farmacia FROM products WHERE UPPER(code) = $1 AND is_active = TRUE`,
          [code],
        );
        missingErpLines.push({
          erpCode: code,
          erpDescription: row.name,
          qtyErp: row.qtyOrdered,
          unitPrice: row.unitPrice ?? 0,
          reason:
            other && other.is_farmacia !== isFarmacia
              ? 'WRONG_CATALOG'
              : 'MISSING_PRODUCT',
        });
        continue;
      }
      poLines.push({
        productId: p.id,
        qtyOrdered: row.qtyOrdered,
        qtyErp: row.qtyOrdered,
        unit: p.baseUnit || 'UND',
        unitPrice: row.unitPrice ?? 0,
        lotNumber: row.lotNumber?.trim() || undefined,
        erpCode: code,
      });
    }

    if (!poLines.length) {
      const wrong = missingErpLines.filter((m) => m.reason === 'WRONG_CATALOG');
      const missing = missingErpLines.filter((m) => m.reason === 'MISSING_PRODUCT');
      let msg = `No hay productos vinculados del catálogo ${catalog}.`;
      if (wrong.length) {
        msg += ` En catálogo opuesto: ${wrong.map((m) => m.erpCode).join(', ')}.`;
      }
      if (missing.length) {
        msg += ` Sin crear: ${missing.map((m) => m.erpCode).join(', ')}.`;
      }
      throw new BadRequestException(msg);
    }

    await this.suppliersService.linkProductsFromErp(
      supplier.id,
      poLines.map((l) => ({
        productId: l.productId,
        erpCode: l.erpCode,
        unitPrice: l.unitPrice,
      })),
    );

    const ocNumber = dto.ocNumber.trim();
    await this.purchaseOrdersService.create(
      {
        number: ocNumber,
        supplierId: supplier.id,
        warehouseId: dto.warehouseId,
        lines: poLines.map(({ erpCode, qtyErp, ...line }) => ({
          ...line,
          erpCode,
          qtyErp,
        })),
        status: 'APPROVED',
      },
      {
        skipFarmaciaValidation: true,
        erpImport: {
          erpLinesCount: dto.lines.length,
          linkedLinesCount: poLines.length,
          missingLines: missingErpLines,
        },
      },
    );

    return {
      ...(await this.getOrderByOc(ocNumber)),
      supplierCreated: supplier.created,
      supplierId: supplier.id,
    };
  }

  private mapReceptionOrder(
    po: {
      id: string;
      number: string;
      supplier_name: string;
      supplier_id: string | null;
      warehouse_id: string;
      status: string;
      warehouse_name: string;
      warehouse_type?: string;
      warehouse_code?: string;
      erpLinesCount?: number | null;
      linkedLinesCount?: number | null;
      importStatus?: string | null;
    },
    lines: Record<string, unknown>[],
    warehouses: { id: string; code: string; name: string; type: string }[],
    missingErpLines: Record<string, unknown>[] = [],
  ) {
    return {
      purchaseOrderId: po.id,
      ocNumber: po.number,
      supplier: po.supplier_name,
      supplierId: po.supplier_id ?? null,
      status: po.status,
      erpLinesCount: po.erpLinesCount ?? null,
      linkedLinesCount: po.linkedLinesCount ?? null,
      importStatus: po.importStatus ?? null,
      missingErpLines,
      warehouseId: po.warehouse_id,
      selectedWarehouseId: po.warehouse_id,
      selectedWarehouse: po.warehouse_name,
      warehouseType: po.warehouse_type ?? null,
      warehouseCode: po.warehouse_code ?? null,
      catalogFarmacia: po.warehouse_type
        ? isFarmaciaWarehouseType(po.warehouse_type)
        : null,
      warehouses,
      warehouseOptions: warehouses.map((w: { name: string }) => w.name),
      lines: lines.map(
        (l: {
          line_id: string;
          product_id: string;
          code: string;
          name: string;
          presentation: string;
          qty_ordered: string;
          unit: string;
          unit_price: string;
          lot_number: string | null;
          expires_at: string | null;
          erp_code: string | null;
          qty_erp: string | null;
          fulfillment_status: string;
          qty_received_total: string;
          requires_lote: boolean;
        }) => {
          const qtyErp = Number(l.qty_erp ?? l.qty_ordered);
          const already = Number(l.qty_received_total ?? 0);
          const pending = Math.max(0, qtyErp - already);
          const fulfillment = l.fulfillment_status ?? 'PENDING';
          const isComplete = fulfillment === 'COMPLETE' || fulfillment === 'SURPLUS';
          const rawLot = String(l.lot_number ?? '').trim();
          const lotNumber = rawLot && rawLot !== '0' ? rawLot : '';
          return {
          id: l.line_id,
          productId: l.product_id,
          code: l.code,
          name: l.name,
          presentation: l.presentation || l.unit,
          qtyOrdered: Number(l.qty_ordered),
          qtyErp,
          qtyAlreadyReceived: already,
          qtyReceived: 0,
          unitPrice: Number(l.unit_price ?? 0),
          requiresLot: Boolean(l.requires_lote),
          fulfillmentStatus: fulfillment,
          lotNumber,
          expiresAt: l.expires_at
            ? String(l.expires_at).slice(0, 10)
            : '',
          lineAction: isComplete ? ('complete' as const) : ('defer' as const),
        };
        },
      ),
    };
  }

  async findByBarcode(barcode: string) {
    const rows = await this.dataSource.query(
      `SELECT po.number AS oc_number
       FROM product_barcodes pb
       JOIN products p ON p.id = pb.product_id
       JOIN purchase_order_lines pol ON pol.product_id = p.id
       JOIN purchase_orders po ON po.id = pol.purchase_order_id
       WHERE pb.barcode = $1 AND po.status IN ('APPROVED', 'PARTIAL')
       LIMIT 1`,
      [barcode.trim()],
    );
    if (rows.length) {
      return this.getOrderByOc(rows[0].oc_number);
    }
    if (barcode.toUpperCase().includes('OC')) {
      return this.getOrderByOc(barcode.trim());
    }
    throw new NotFoundException(`No se encontró producto u OC para el código ${barcode}`);
  }

  async confirmReception(dto: ConfirmReceptionDto) {
    const receiveLines = dto.lines.filter(
      (l) => l.disposition === 'receive' && l.qtyReceived > 0,
    );
    if (!receiveLines.length) {
      throw new BadRequestException(
        'Indique al menos un artículo para recibir con cantidad mayor a cero',
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const line of receiveLines) {
        const [product] = await qr.query(
          `SELECT requires_lote FROM products WHERE id = $1`,
          [line.productId],
        );
        if (product?.requires_lote && (!line.lotNumber || !line.expiresAt)) {
          throw new BadRequestException(
            `Lote y vencimiento obligatorios para el producto ${line.productId}`,
          );
        }

        const pending = await this.getLinePendingQty(
          qr,
          dto.purchaseOrderId,
          line.purchaseOrderLineId,
          line.productId,
        );
        if (line.qtyReceived > pending) {
          throw new BadRequestException(
            `Cantidad a recibir (${line.qtyReceived}) supera el pendiente (${pending}) en la línea`,
          );
        }
      }

      const recNumber = `REC-${Date.now()}`;
      const [reception] = await qr.query(
        `INSERT INTO receptions (purchase_order_id, number, is_partial)
         VALUES ($1, $2, $3) RETURNING id`,
        [dto.purchaseOrderId, recNumber, dto.isPartial ?? true],
      );
      const receptionId = reception.id;

      for (const line of receiveLines) {
        let lotId: string | null = null;
        if (line.lotNumber) {
          const [existing] = await qr.query(
            `SELECT id FROM lots WHERE product_id = $1 AND lot_number = $2`,
            [line.productId, line.lotNumber.toUpperCase()],
          );
          if (existing) {
            lotId = existing.id;
          } else {
            const [newLot] = await qr.query(
              `INSERT INTO lots (product_id, lot_number, expires_at)
               VALUES ($1, $2, $3) RETURNING id`,
              [line.productId, line.lotNumber.toUpperCase(), line.expiresAt ?? null],
            );
            lotId = newLot.id;
          }

          await qr.query(
            `INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (warehouse_id, location_id, product_id, lot_id)
             DO UPDATE SET qty = inventory_balances.qty + EXCLUDED.qty`,
            [dto.warehouseId, line.productId, lotId, line.qtyReceived],
          );
        } else {
          await qr.query(
            `INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
             VALUES ($1, $2, NULL, $3)
             ON CONFLICT (warehouse_id, location_id, product_id, lot_id)
             DO UPDATE SET qty = inventory_balances.qty + EXCLUDED.qty`,
            [dto.warehouseId, line.productId, line.qtyReceived],
          );
        }

        await qr.query(
          `INSERT INTO reception_lines (
             reception_id, product_id, purchase_order_line_id,
             qty_received, lot_number, expires_at, lot_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            receptionId,
            line.productId,
            line.purchaseOrderLineId,
            line.qtyReceived,
            line.lotNumber ?? null,
            line.expiresAt ?? null,
            lotId,
          ],
        );

        await qr.query(
          `INSERT INTO inventory_movements (type, warehouse_id, product_id, lot_id, qty, reference_type, reference_id)
           VALUES ('RECEPTION', $1, $2, $3, $4, 'RECEPTION', $5)`,
          [dto.warehouseId, line.productId, lotId, line.qtyReceived, receptionId],
        );
      }

      await this.refreshLineFulfillment(qr, dto.purchaseOrderId);
      const allReceived = await this.isOrderFullyReceived(qr, dto.purchaseOrderId);
      await qr.query(
        `UPDATE purchase_orders SET status = $2, updated_at = NOW() WHERE id = $1`,
        [dto.purchaseOrderId, allReceived ? 'RECEIVED' : 'PARTIAL'],
      );

      await qr.commitTransaction();
      return {
        success: true,
        receptionNumber: recNumber,
        status: allReceived ? 'RECEIVED' : 'PARTIAL',
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  private async getLinePendingQty(
    qr: ReturnType<DataSource['createQueryRunner']>,
    purchaseOrderId: string,
    purchaseOrderLineId: string,
    productId: string,
  ): Promise<number> {
    const [row] = await qr.query(
      `SELECT
         GREATEST(
           0,
           COALESCE(pol.qty_erp, pol.qty_ordered) - COALESCE((
             SELECT SUM(rl.qty_received)
             FROM reception_lines rl
             JOIN receptions r ON r.id = rl.reception_id
             WHERE r.purchase_order_id = $1
               AND (
                 rl.purchase_order_line_id = $2
                 OR (rl.purchase_order_line_id IS NULL AND rl.product_id = $3)
               )
           ), 0)
         )::numeric AS pending
       FROM purchase_order_lines pol
       WHERE pol.id = $2 AND pol.purchase_order_id = $1`,
      [purchaseOrderId, purchaseOrderLineId, productId],
    );
    return Number(row?.pending ?? 0);
  }

  private async isOrderFullyReceived(
    qr: ReturnType<DataSource['createQueryRunner']>,
    purchaseOrderId: string,
  ): Promise<boolean> {
    const [row] = await qr.query(
      `SELECT COUNT(*)::int AS pending
       FROM purchase_order_lines pol
       WHERE pol.purchase_order_id = $1
         AND COALESCE(pol.qty_erp, pol.qty_ordered) > COALESCE((
           SELECT SUM(rl.qty_received)
           FROM reception_lines rl
           JOIN receptions r ON r.id = rl.reception_id
           WHERE r.purchase_order_id = $1
             AND (
               rl.purchase_order_line_id = pol.id
               OR (rl.purchase_order_line_id IS NULL AND rl.product_id = pol.product_id)
             )
         ), 0)`,
      [purchaseOrderId],
    );
    return Number(row?.pending ?? 1) === 0;
  }

  /** Actualiza estado de línea según cantidad CXC vs total recibido. */
  private async refreshLineFulfillment(
    qr: ReturnType<DataSource['createQueryRunner']>,
    purchaseOrderId: string,
  ) {
    await qr.query(
      `UPDATE purchase_order_lines pol SET fulfillment_status = sub.st
       FROM (
         SELECT pol2.id,
           CASE
             WHEN COALESCE(rcv.total, 0) <= 0 THEN 'PENDING'::po_line_fulfillment
             WHEN COALESCE(rcv.total, 0) < COALESCE(pol2.qty_erp, pol2.qty_ordered)
               THEN 'PARTIAL'::po_line_fulfillment
             WHEN COALESCE(rcv.total, 0) >= COALESCE(pol2.qty_erp, pol2.qty_ordered)
               AND COALESCE(pol2.qty_erp, pol2.qty_ordered) > 0
               THEN 'COMPLETE'::po_line_fulfillment
             ELSE 'SURPLUS'::po_line_fulfillment
           END AS st
         FROM purchase_order_lines pol2
         LEFT JOIN (
           SELECT
             COALESCE(rl.purchase_order_line_id, pol3.id) AS po_line_id,
             SUM(rl.qty_received)::numeric AS total
           FROM reception_lines rl
           JOIN receptions r ON r.id = rl.reception_id
           JOIN purchase_order_lines pol3 ON pol3.purchase_order_id = r.purchase_order_id
             AND (
               rl.purchase_order_line_id = pol3.id
               OR (rl.purchase_order_line_id IS NULL AND rl.product_id = pol3.product_id)
             )
           WHERE r.purchase_order_id = $1
           GROUP BY COALESCE(rl.purchase_order_line_id, pol3.id)
         ) rcv ON rcv.po_line_id = pol2.id
         WHERE pol2.purchase_order_id = $1
       ) sub
       WHERE pol.id = sub.id`,
      [purchaseOrderId],
    );
  }
}
