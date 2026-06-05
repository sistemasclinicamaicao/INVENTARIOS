import {

  BadRequestException,

  ConflictException,

  Injectable,

  NotFoundException,

} from '@nestjs/common';

import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { CreatePurchaseOrderDto, PurchaseOrderLineDto } from './dto/create-purchase-order.dto';

import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

import { ErpWarehouseHint, WarehousesService } from '../masters/warehouses.service';
import { isFarmaciaWarehouseType, catalogLabel } from '../masters/warehouse-catalog.util';
import { PURCHASE_DESTINATION_TYPES, WAREHOUSE_TYPE } from '../masters/warehouse-types.util';
import { SuppliersService } from './suppliers.service';

export type OcHeaderMatch =
  | 'purchase_order_db'
  | 'erp_warehouse'
  | 'erp_warehouse_created'
  | 'supplier_tax_id'
  | 'supplier_erp_created'
  | 'supplier_name'
  | 'supplier_last_order'
  | 'products_policy'
  | 'products_code_prefix'
  | 'default_warehouse'
  | 'none';

export type OcHeaderResolution = {
  supplierId: string | null;
  warehouseId: string | null;
  supplierName: string | null;
  warehouseName: string | null;
  warehouseCode: string | null;
  warehouseType: string | null;
  matchedBy: OcHeaderMatch;
  supplierMatchedBy: OcHeaderMatch;
  warehouseMatchedBy: OcHeaderMatch;
};

@Injectable()

export class PurchaseOrdersService {

  constructor(

    @InjectDataSource()

    private readonly dataSource: DataSource,

    private readonly suppliersService: SuppliersService,
    private readonly warehousesService: WarehousesService,

  ) {}



  async listOpen() {

    const rows = await this.dataSource.query(`

      SELECT

        po.id,

        po.number,

        po.supplier_name AS "supplierName",

        po.supplier_id AS "supplierId",

        po.status,

        w.id AS "warehouseId",

        w.name AS "warehouseName",

        w.type AS "warehouseType",

        po.created_at AS "createdAt",

        COUNT(pol.id)::int AS "lineCount"

      FROM purchase_orders po

      JOIN warehouses w ON w.id = po.warehouse_id

      LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id

      WHERE po.status IN ('DRAFT', 'APPROVED', 'PARTIAL')

      GROUP BY po.id, w.id, w.name, w.type

      ORDER BY po.created_at DESC

    `);

    return rows;

  }



  private async getWarehouseOrThrow(warehouseId: string) {

    const [wh] = await this.dataSource.query(

      `SELECT id, name, type FROM warehouses
       WHERE id = $1 AND is_active = TRUE
         AND type = ANY($2::text[])`,

      [warehouseId, PURCHASE_DESTINATION_TYPES as unknown as string[]],

    );

    if (!wh) {
      throw new BadRequestException(
        'Bodega destino no válida. Use Almacén (02), Servicio Farmacéutico (10) o Confecciones (11).',
      );
    }

    return wh as { id: string; name: string; type: string };

  }



  private validateFarmaciaLines(

    warehouseType: string,

    lines: PurchaseOrderLineDto[],

  ) {

    if (warehouseType !== 'CENTRAL_FARMACIA') return;

    for (const line of lines) {

      if (!line.lotNumber?.trim() || !line.expiresAt) {

        throw new BadRequestException(

          'Complete lote y vencimiento en todos los productos (bodega farmacia)',

        );

      }

    }

  }



  private async validateCatalogLines(

    warehouseType: string,

    lines: PurchaseOrderLineDto[],

  ) {

    const expectFarmacia = isFarmaciaWarehouseType(warehouseType);

    const catalog = catalogLabel(expectFarmacia);

    for (const line of lines) {

      const [p] = await this.dataSource.query(

        `SELECT code, is_farmacia FROM products WHERE id = $1 AND is_active = TRUE`,

        [line.productId],

      );

      if (!p || p.is_farmacia !== expectFarmacia) {

        throw new BadRequestException(

          `El producto ${p?.code ?? line.productId} no pertenece al catálogo ${catalog}`,

        );

      }

    }

  }



  private async upsertLine(

    qr: { query: DataSource['query'] },

    poId: string,

    line: PurchaseOrderLineDto,

  ) {

    const [product] = await qr.query(

      `SELECT id, base_unit FROM products WHERE id = $1 AND is_active = TRUE`,

      [line.productId],

    );

    if (!product) {

      throw new BadRequestException(`Producto ${line.productId} no encontrado`);

    }



    const unit = line.unit || product.base_unit;

    const unitPrice = line.unitPrice ?? 0;

    const lotNumber = line.lotNumber?.trim().toUpperCase() || null;

    const expiresAt = line.expiresAt || null;

    const qtyErp = line.qtyErp ?? line.qtyOrdered;

    const erpCode = line.erpCode?.trim().toUpperCase() || null;



    const [existing] = await qr.query(

      `SELECT id FROM purchase_order_lines

       WHERE purchase_order_id = $1 AND product_id = $2`,

      [poId, line.productId],

    );



    if (existing) {

      await qr.query(

        `UPDATE purchase_order_lines SET

           qty_ordered = $2, unit = $3, unit_price = $4,

           lot_number = $5, expires_at = $6,

           erp_code = COALESCE($7, erp_code),

           qty_erp = COALESCE($8, qty_erp),

           fulfillment_status = 'PENDING'

         WHERE id = $1`,

        [existing.id, line.qtyOrdered, unit, unitPrice, lotNumber, expiresAt, erpCode, qtyErp],

      );

    } else {

      await qr.query(

        `INSERT INTO purchase_order_lines (

           purchase_order_id, product_id, qty_ordered, unit,

           unit_price, lot_number, expires_at, erp_code, qty_erp, fulfillment_status

         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')`,

        [poId, line.productId, line.qtyOrdered, unit, unitPrice, lotNumber, expiresAt, erpCode, qtyErp],

      );

    }

  }



  async create(
    dto: CreatePurchaseOrderDto,
    opts?: {
      skipFarmaciaValidation?: boolean;
      erpImport?: {
        erpLinesCount: number;
        linkedLinesCount: number;
        missingLines: {
          erpCode: string;
          erpDescription: string;
          qtyErp: number;
          unitPrice: number;
          reason: 'MISSING_PRODUCT' | 'WRONG_CATALOG';
        }[];
      };
    },
  ) {

    if (!dto.lines?.length) {

      throw new BadRequestException('La orden debe tener al menos una línea');

    }



    const wh = await this.getWarehouseOrThrow(dto.warehouseId);

    if (!opts?.skipFarmaciaValidation) {
      this.validateFarmaciaLines(wh.type, dto.lines);
    }
    await this.validateCatalogLines(wh.type, dto.lines);



    const supplierName = await this.suppliersService.resolveName(

      dto.supplierId,

      dto.supplierName,

    );

    const status = dto.status ?? 'APPROVED';

    const number = dto.number.trim().toUpperCase();



    const [existing] = await this.dataSource.query(

      `SELECT id, status FROM purchase_orders WHERE number = $1`,

      [number],

    );



    const qr = this.dataSource.createQueryRunner();

    await qr.connect();

    await qr.startTransaction();

    try {

      let poId: string;



      if (existing) {

        if (!['DRAFT', 'APPROVED', 'PARTIAL'].includes(existing.status)) {

          throw new BadRequestException('La OC no admite más líneas');

        }

        poId = existing.id;

        await qr.query(

          `UPDATE purchase_orders SET

             supplier_id = COALESCE($2, supplier_id),

             supplier_name = $3,

             warehouse_id = $4,

             updated_at = NOW()

           WHERE id = $1`,

          [poId, dto.supplierId ?? null, supplierName, dto.warehouseId],

        );

      } else {

        const [po] = await qr.query(

          `INSERT INTO purchase_orders (number, supplier_name, supplier_id, warehouse_id, status)

           VALUES ($1, $2, $3, $4, $5)

           RETURNING id`,

          [number, supplierName, dto.supplierId ?? null, dto.warehouseId, status],

        );

        poId = po.id;

      }



      for (const line of dto.lines) {

        await this.upsertLine(qr, poId, line);

      }

      if (opts?.erpImport) {
        await qr.query(
          `DELETE FROM purchase_order_missing_erp_lines WHERE purchase_order_id = $1`,
          [poId],
        );
        for (const m of opts.erpImport.missingLines) {
          await qr.query(
            `INSERT INTO purchase_order_missing_erp_lines
               (purchase_order_id, erp_code, erp_description, qty_erp, unit_price, reason)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              poId,
              m.erpCode,
              m.erpDescription,
              m.qtyErp,
              m.unitPrice,
              m.reason,
            ],
          );
        }
        const importStatus =
          opts.erpImport.linkedLinesCount >= opts.erpImport.erpLinesCount
            ? 'COMPLETE'
            : 'INCOMPLETE';
        await qr.query(
          `UPDATE purchase_orders SET
             erp_lines_count = $2,
             linked_lines_count = $3,
             import_status = $4::po_import_status,
             updated_at = NOW()
           WHERE id = $1`,
          [
            poId,
            opts.erpImport.erpLinesCount,
            opts.erpImport.linkedLinesCount,
            importStatus,
          ],
        );
      }

      await qr.commitTransaction();

      return this.getByNumber(number);

    } catch (e: unknown) {

      await qr.rollbackTransaction();

      const err = e as { code?: string };

      if (err?.code === '23505') {

        throw new ConflictException(`Ya existe la OC ${number}`);

      }

      throw e;

    } finally {

      await qr.release();

    }

  }



  async update(id: string, dto: UpdatePurchaseOrderDto) {

    const [existing] = await this.dataSource.query(

      `SELECT id, number, status FROM purchase_orders WHERE id = $1`,

      [id],

    );

    if (!existing) throw new NotFoundException('Orden de compra no encontrada');

    if (!['DRAFT', 'APPROVED'].includes(existing.status)) {

      throw new BadRequestException('No se puede editar una OC cerrada o recibida');

    }



    let supplierName: string | undefined;

    const supplierId = dto.supplierId;

    if (dto.supplierId || dto.supplierName) {

      supplierName = await this.suppliersService.resolveName(dto.supplierId, dto.supplierName);

    }



    await this.dataSource.query(

      `UPDATE purchase_orders SET

         supplier_id = COALESCE($2, supplier_id),

         supplier_name = COALESCE($3, supplier_name),

         warehouse_id = COALESCE($4, warehouse_id),

         status = COALESCE($5, status),

         updated_at = NOW()

       WHERE id = $1`,

      [

        id,

        supplierId ?? null,

        supplierName ?? null,

        dto.warehouseId ?? null,

        dto.status ?? null,

      ],

    );



    return this.getById(id);

  }



  async approve(id: string) {

    return this.update(id, { status: 'APPROVED' });

  }



  async getById(id: string) {

    const [po] = await this.dataSource.query(

      `SELECT po.id, po.number, po.supplier_name AS "supplierName",

              po.supplier_id AS "supplierId", po.warehouse_id AS "warehouseId",

              po.status, w.name AS "warehouseName", w.type AS "warehouseType"

       FROM purchase_orders po

       JOIN warehouses w ON w.id = po.warehouse_id

       WHERE po.id = $1`,

      [id],

    );

    if (!po) throw new NotFoundException('Orden de compra no encontrada');

    const lines = await this.loadLines(po.id);

    return { ...po, lines };

  }



  async getByNumber(number: string) {

    const [po] = await this.dataSource.query(

      `SELECT po.id, po.number, po.supplier_name AS "supplierName",

              po.supplier_id AS "supplierId", po.warehouse_id AS "warehouseId",

              po.status, w.code AS "warehouseCode", w.name AS "warehouseName",
              w.type AS "warehouseType",
              po.import_status AS "importStatus",
              po.erp_lines_count AS "erpLinesCount",
              po.linked_lines_count AS "linkedLinesCount",
              po.created_at AS "createdAt"

       FROM purchase_orders po

       JOIN warehouses w ON w.id = po.warehouse_id

       WHERE po.number = $1`,

      [number.trim().toUpperCase()],

    );

    if (!po) throw new NotFoundException(`OC ${number} no encontrada`);

    const lines = await this.loadLines(po.id);

    return { ...po, lines };

  }



  private async loadLines(purchaseOrderId: string) {

    return this.dataSource.query(

      `SELECT

         pol.id,

         p.id AS "productId",

         p.code AS "productCode",

         p.name AS "productName",

         pol.qty_ordered AS "qtyOrdered",

         pol.unit,

         pol.unit_price AS "unitPrice",

         pol.lot_number AS "lotNumber",

         pol.expires_at AS "expiresAt",

         pol.erp_code AS "erpCode",

         pol.qty_erp AS "qtyErp",

         pol.fulfillment_status AS "fulfillmentStatus",

         COALESCE(rcv.total, 0) AS "qtyAlreadyReceived",

         (pol.qty_ordered * pol.unit_price) AS "lineTotal"

       FROM purchase_order_lines pol

       JOIN products p ON p.id = pol.product_id

       LEFT JOIN (
         SELECT
           COALESCE(rl.purchase_order_line_id, pol2.id) AS po_line_id,
           SUM(rl.qty_received)::numeric AS total
         FROM reception_lines rl
         JOIN receptions r ON r.id = rl.reception_id
         JOIN purchase_order_lines pol2 ON pol2.purchase_order_id = r.purchase_order_id
           AND (
             rl.purchase_order_line_id = pol2.id
             OR (rl.purchase_order_line_id IS NULL AND rl.product_id = pol2.product_id)
           )
         WHERE r.purchase_order_id = $1
         GROUP BY COALESCE(rl.purchase_order_line_id, pol2.id)
       ) rcv ON rcv.po_line_id = pol.id

       WHERE pol.purchase_order_id = $1

       ORDER BY p.code`,

      [purchaseOrderId],

    );

  }

  /**
   * Resuelve proveedor y bodega destino desde BD (OC previa, proveedor NIT, historial, tipo de producto).
   */
  async resolveOcHeader(
    consecutivo: string,
    erp?: {
      nit?: string;
      razonSocial?: string;
      productCodes?: string[];
      warehouse?: ErpWarehouseHint | null;
    },
  ): Promise<OcHeaderResolution> {
    const num = consecutivo.trim();
    const numberVariants = [...new Set([num, num.toUpperCase()])];

    const [existingPo] = await this.dataSource.query(
      `SELECT po.supplier_id AS "supplierId", po.warehouse_id AS "warehouseId",
              po.supplier_name AS "supplierName", w.name AS "warehouseName",
              w.code AS "warehouseCode", w.type AS "warehouseType"
       FROM purchase_orders po
       JOIN warehouses w ON w.id = po.warehouse_id
       WHERE po.number = ANY($1::text[])
       ORDER BY po.updated_at DESC NULLS LAST, po.created_at DESC
       LIMIT 1`,
      [numberVariants],
    );

    const destinationTypes = PURCHASE_DESTINATION_TYPES as unknown as string[];
    if (
      existingPo?.supplierId &&
      existingPo?.warehouseId &&
      destinationTypes.includes(existingPo.warehouseType)
    ) {
      const db: OcHeaderMatch = 'purchase_order_db';
      return {
        supplierId: existingPo.supplierId,
        warehouseId: existingPo.warehouseId,
        supplierName: existingPo.supplierName,
        warehouseName: existingPo.warehouseName,
        warehouseCode: existingPo.warehouseCode,
        warehouseType: existingPo.warehouseType ?? null,
        matchedBy: db,
        supplierMatchedBy: db,
        warehouseMatchedBy: db,
      };
    }

    let supplierId: string | null = existingPo?.supplierId ?? null;
    let supplierName: string | null = existingPo?.supplierName ?? null;
    let supplierMatchedBy: OcHeaderMatch = 'none';
    let warehouseMatchedBy: OcHeaderMatch = 'none';

    const nitDigits = (erp?.nit ?? '').replace(/\D/g, '');
    if (!supplierId && nitDigits) {
      const [byTax] = await this.dataSource.query(
        `SELECT id, name FROM suppliers
         WHERE is_active = TRUE
           AND REPLACE(REPLACE(REPLACE(COALESCE(tax_id, ''), '.', ''), '-', ''), ' ', '') = $1
         LIMIT 1`,
        [nitDigits],
      );
      if (byTax) {
        supplierId = byTax.id;
        supplierName = byTax.name;
        supplierMatchedBy = 'supplier_tax_id';
      }
    }

    if (!supplierId && erp?.razonSocial?.trim()) {
      const term = `%${erp.razonSocial.trim().slice(0, 24)}%`;
      const [byName] = await this.dataSource.query(
        `SELECT id, name FROM suppliers
         WHERE is_active = TRUE AND name ILIKE $1
         ORDER BY name LIMIT 1`,
        [term],
      );
      if (byName) {
        supplierId = byName.id;
        supplierName = byName.name;
        supplierMatchedBy = 'supplier_name';
      }
    }

    if (!supplierId && nitDigits) {
      const created = await this.suppliersService.findOrCreateByErp(
        nitDigits,
        erp?.razonSocial ?? '',
      );
      if (created) {
        supplierId = created.id;
        supplierName = created.name;
        supplierMatchedBy = created.created ? 'supplier_erp_created' : 'supplier_tax_id';
      }
    }

    let warehouseId: string | null = existingPo?.warehouseId ?? null;
    let warehouseName: string | null = existingPo?.warehouseName ?? null;
    let warehouseCode: string | null = existingPo?.warehouseCode ?? null;
    let warehouseType: string | null = existingPo?.warehouseType ?? null;

    if (!warehouseId && erp?.warehouse) {
      const wh = await this.warehousesService.mapErpToCentralDestination(erp.warehouse);
      if (wh) {
        warehouseId = wh.id;
        warehouseName = wh.name;
        warehouseCode = wh.code;
        warehouseType = wh.type;
        warehouseMatchedBy = 'erp_warehouse';
      }
    }

    if (!warehouseId && supplierId) {
      const [lastPo] = await this.dataSource.query(
        `SELECT po.warehouse_id AS id, w.name, w.code, w.type
         FROM purchase_orders po
         JOIN warehouses w ON w.id = po.warehouse_id
         WHERE po.supplier_id = $1
           AND w.type = ANY($2::text[])
         ORDER BY po.created_at DESC
         LIMIT 1`,
        [supplierId, destinationTypes],
      );
      if (lastPo) {
        warehouseId = lastPo.id;
        warehouseName = lastPo.name;
        warehouseCode = lastPo.code;
        warehouseType = lastPo.type;
        warehouseMatchedBy = 'supplier_last_order';
      }
    }

    if (!warehouseId) {
      const [def] = await this.dataSource.query(
        `SELECT id, name, code, type FROM warehouses
         WHERE is_active = TRUE AND type = $1
         ORDER BY code LIMIT 1`,
        [WAREHOUSE_TYPE.CENTRAL_ALMACEN],
      );
      if (def) {
        warehouseId = def.id;
        warehouseName = def.name;
        warehouseCode = def.code;
        warehouseType = def.type;
        if (warehouseMatchedBy === 'none') warehouseMatchedBy = 'default_warehouse';
      }
    }

    const matchedBy =
      supplierMatchedBy !== 'none'
        ? supplierMatchedBy
        : warehouseMatchedBy;

    return {
      supplierId,
      warehouseId,
      supplierName,
      warehouseName,
      warehouseCode,
      warehouseType,
      matchedBy,
      supplierMatchedBy,
      warehouseMatchedBy,
    };
  }

}


