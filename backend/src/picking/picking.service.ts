import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfirmPickingDto } from './dto/confirm-picking.dto';

@Injectable()
export class PickingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async start(requisitionNumber: string) {
    const [req] = await this.dataSource.query(
      `SELECT ir.id, ir.number, ir.status, ir.source_warehouse_id AS "sourceWarehouseId",
              w.policy::text AS policy
       FROM internal_requisitions ir
       JOIN warehouses w ON w.id = ir.source_warehouse_id
       WHERE ir.number = $1`,
      [requisitionNumber.trim().toUpperCase()],
    );
    if (!req) throw new NotFoundException('Requisición no encontrada');
    if (!['PENDING', 'IN_PICKING'].includes(req.status)) {
      throw new BadRequestException(`Requisición en estado ${req.status}`);
    }

    const existing = await this.dataSource.query(
      `SELECT id, number, status FROM picking_orders WHERE requisition_id = $1 AND status = 'OPEN'`,
      [req.id],
    );
    if (existing.length) {
      return this.getPickingOrder(existing[0].id);
    }

    const lines = await this.dataSource.query(
      `SELECT irl.id AS "reqLineId", p.id AS "productId", p.code, p.name,
              irl.qty_requested AS "qtyRequested", irl.unit
       FROM internal_requisition_lines irl
       JOIN products p ON p.id = irl.product_id
       WHERE irl.requisition_id = $1`,
      [req.id],
    );

    const pickNumber = `PICK-${Date.now()}`;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [po] = await qr.query(
        `INSERT INTO picking_orders (requisition_id, number, status)
         VALUES ($1, $2, 'OPEN') RETURNING id, number`,
        [req.id, pickNumber],
      );

      const pickingLines: unknown[] = [];
      for (const line of lines) {
        const lot = await this.suggestLot(
          qr,
          line.productId,
          req.sourceWarehouseId,
          req.policy === 'FEFO',
        );
        if (!lot) {
          throw new BadRequestException(
            `Sin stock para ${line.code} en bodega origen`,
          );
        }
        const qty = Math.min(Number(line.qtyRequested), Number(lot.qty));
        const [pl] = await qr.query(
          `INSERT INTO picking_lines (picking_order_id, product_id, lot_id, qty_to_pick, qty_picked)
           VALUES ($1, $2, $3, $4, 0) RETURNING id`,
          [po.id, line.productId, lot.lotId, qty],
        );
        pickingLines.push({
          id: pl.id,
          productId: line.productId,
          code: line.code,
          name: line.name,
          qtyToPick: qty,
          qtyPicked: 0,
          suggestedLotId: lot.lotId,
          suggestedLotNumber: lot.lotNumber,
          suggestedExpiresAt: lot.expiresAt,
          policy: req.policy,
        });
      }

      await qr.query(
        `UPDATE internal_requisitions SET status = 'IN_PICKING' WHERE id = $1`,
        [req.id],
      );
      await qr.commitTransaction();

      return {
        pickingOrderId: po.id,
        pickingNumber: po.number,
        requisitionNumber: req.number,
        policy: req.policy,
        lines: pickingLines,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  private async suggestLot(
    qr: ReturnType<DataSource['createQueryRunner']>,
    productId: string,
    warehouseId: string,
    fefo: boolean,
  ) {
    const order = fefo
      ? 'l.expires_at ASC NULLS LAST, ib.qty DESC'
      : 'l.created_at ASC NULLS LAST, ib.qty DESC';
    const [row] = await qr.query(
      `SELECT l.id AS "lotId", l.lot_number AS "lotNumber", l.expires_at AS "expiresAt", ib.qty
       FROM inventory_balances ib
       LEFT JOIN lots l ON l.id = ib.lot_id
       WHERE ib.product_id = $1 AND ib.warehouse_id = $2 AND ib.qty > 0
       ORDER BY ${order}
       LIMIT 1
       FOR UPDATE OF ib`,
      [productId, warehouseId],
    );
    return row
      ? {
          ...row,
          expiresAt: row.expiresAt ? String(row.expiresAt).slice(0, 10) : null,
        }
      : null;
  }

  async getPickingOrder(pickingOrderId: string) {
    const [po] = await this.dataSource.query(
      `SELECT po.id, po.number, po.status, ir.number AS "requisitionNumber",
              w.policy::text AS policy
       FROM picking_orders po
       JOIN internal_requisitions ir ON ir.id = po.requisition_id
       JOIN warehouses w ON w.id = ir.source_warehouse_id
       WHERE po.id = $1`,
      [pickingOrderId],
    );
    if (!po) throw new NotFoundException('Orden de picking no encontrada');

    const lines = await this.dataSource.query(
      `SELECT pl.id, p.id AS "productId", p.code, p.name,
              pl.qty_to_pick AS "qtyToPick", pl.qty_picked AS "qtyPicked",
              pl.lot_id AS "suggestedLotId", l.lot_number AS "suggestedLotNumber",
              l.expires_at AS "suggestedExpiresAt"
       FROM picking_lines pl
       JOIN products p ON p.id = pl.product_id
       JOIN lots l ON l.id = pl.lot_id
       WHERE pl.picking_order_id = $1`,
      [pickingOrderId],
    );

    return {
      pickingOrderId: po.id,
      pickingNumber: po.number,
      requisitionNumber: po.requisitionNumber,
      status: po.status,
      policy: po.policy,
      lines: lines.map(
        (l: {
          suggestedExpiresAt: Date | null;
          qtyToPick: string;
          qtyPicked: string;
        }) => ({
          ...l,
          suggestedExpiresAt: l.suggestedExpiresAt
            ? String(l.suggestedExpiresAt).slice(0, 10)
            : null,
          qtyToPick: Number(l.qtyToPick),
          qtyPicked: Number(l.qtyPicked),
        }),
      ),
    };
  }

  async confirm(pickingOrderId: string, dto: ConfirmPickingDto) {
    const order = await this.getPickingOrder(pickingOrderId);
    if (order.status !== 'OPEN') {
      throw new BadRequestException('El picking ya fue cerrado');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [reqRow] = await qr.query(
        `SELECT ir.id, ir.source_warehouse_id AS "sourceId", ir.dest_warehouse_id AS "destId"
         FROM picking_orders po
         JOIN internal_requisitions ir ON ir.id = po.requisition_id
         WHERE po.id = $1`,
        [pickingOrderId],
      );

      for (const line of dto.lines) {
        const [pl] = await qr.query(
          `SELECT pl.*, l.lot_number FROM picking_lines pl
           JOIN lots l ON l.id = pl.lot_id
           WHERE pl.id = $1 AND pl.picking_order_id = $2`,
          [line.pickingLineId, pickingOrderId],
        );
        if (!pl) throw new BadRequestException('Línea de picking inválida');

        const scanLotId = line.lotId ?? pl.lot_id;
        if (order.policy === 'FEFO' && line.lotId && line.lotId !== pl.lot_id) {
          const [earlier] = await qr.query(
            `SELECT l.id FROM lots l
             JOIN inventory_balances ib ON ib.lot_id = l.id
             WHERE ib.product_id = $1 AND ib.warehouse_id = $2 AND ib.qty > 0
               AND l.expires_at < (SELECT expires_at FROM lots WHERE id = $3)
             LIMIT 1`,
            [pl.product_id, reqRow.sourceId, pl.lot_id],
          );
          if (earlier) {
            throw new BadRequestException(
              `FEFO: debe usar el lote ${pl.lot_number} o uno con vencimiento anterior`,
            );
          }
        }

        const qty = line.qtyPicked ?? Number(pl.qty_to_pick);
        await qr.query(
          `UPDATE picking_lines SET qty_picked = $2, lot_id = $3 WHERE id = $1`,
          [line.pickingLineId, qty, scanLotId],
        );

        const [bal] = await qr.query(
          `SELECT ib.qty FROM inventory_balances ib
           WHERE ib.warehouse_id = $1 AND ib.product_id = $2
             AND ib.lot_id IS NOT DISTINCT FROM $3
           FOR UPDATE OF ib`,
          [reqRow.sourceId, pl.product_id, scanLotId],
        );
        if (!bal || Number(bal.qty) < qty) {
          throw new BadRequestException(
            `Stock insuficiente para ${pl.lot_number ?? pl.product_id}`,
          );
        }
        await qr.query(
          `UPDATE inventory_balances SET qty = qty - $4
           WHERE warehouse_id = $1 AND product_id = $2 AND lot_id IS NOT DISTINCT FROM $3`,
          [reqRow.sourceId, pl.product_id, scanLotId, qty],
        );

        await qr.query(
          `INSERT INTO inventory_movements (type, warehouse_id, product_id, lot_id, qty, reference_type, reference_id)
           VALUES ('PICK', $1, $2, $3, $4, 'PICKING', $5)`,
          [reqRow.sourceId, pl.product_id, scanLotId, qty, pickingOrderId],
        );
      }

      const transferNumber = `TRF-${Date.now()}`;
      const [transfer] = await qr.query(
        `INSERT INTO transfers (number, picking_order_id, from_warehouse_id, to_warehouse_id, status, shipped_at)
         VALUES ($1, $2, $3, $4, 'IN_TRANSIT', NOW()) RETURNING id, number`,
        [transferNumber, pickingOrderId, reqRow.sourceId, reqRow.destId],
      );

      const pickedLines = await qr.query(
        `SELECT product_id, lot_id, qty_picked FROM picking_lines WHERE picking_order_id = $1`,
        [pickingOrderId],
      );
      for (const tl of pickedLines) {
        await qr.query(
          `INSERT INTO transfer_lines (transfer_id, product_id, lot_id, qty)
           VALUES ($1, $2, $3, $4)`,
          [transfer.id, tl.product_id, tl.lot_id, tl.qty_picked],
        );
      }

      await qr.query(
        `UPDATE picking_orders SET status = 'CLOSED' WHERE id = $1`,
        [pickingOrderId],
      );
      await qr.query(
        `UPDATE internal_requisitions SET status = 'DISPATCHED' WHERE id = $1`,
        [reqRow.id],
      );

      await qr.commitTransaction();
      return {
        success: true,
        transferNumber: transfer.number,
        transferId: transfer.id,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async receiveTransfer(transferNumber: string) {
    const [tr] = await this.dataSource.query(
      `SELECT t.id, t.to_warehouse_id AS "destId", t.status, po.requisition_id AS "reqId"
       FROM transfers t
       LEFT JOIN picking_orders po ON po.id = t.picking_order_id
       WHERE t.number = $1`,
      [transferNumber.trim().toUpperCase()],
    );
    if (!tr) throw new NotFoundException('Traslado no encontrado');
    if (tr.status === 'RECEIVED') {
      throw new BadRequestException('Traslado ya recibido');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const tlines = await qr.query(
        `SELECT product_id, lot_id, qty FROM transfer_lines WHERE transfer_id = $1`,
        [tr.id],
      );
      for (const tl of tlines) {
        await qr.query(
          `INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (warehouse_id, location_id, product_id, lot_id)
           DO UPDATE SET qty = inventory_balances.qty + EXCLUDED.qty`,
          [tr.destId, tl.product_id, tl.lot_id, tl.qty],
        );
        await qr.query(
          `INSERT INTO inventory_movements (type, warehouse_id, product_id, lot_id, qty, reference_type, reference_id)
           VALUES ('TRANSFER_IN', $1, $2, $3, $4, 'TRANSFER', $5)`,
          [tr.destId, tl.product_id, tl.lot_id, tl.qty, tr.id],
        );
      }

      await qr.query(
        `UPDATE transfers SET status = 'RECEIVED', received_at = NOW() WHERE id = $1`,
        [tr.id],
      );
      if (tr.reqId) {
        await qr.query(
          `UPDATE internal_requisitions SET status = 'RECEIVED' WHERE id = $1`,
          [tr.reqId],
        );
      }
      await qr.commitTransaction();
      return { success: true, transferNumber };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
}
