import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PharmacyService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getControlledProducts() {
    const rows = await this.dataSource.query(`
      SELECT p.id, p.code, p.name, p.description,
             COALESCE(SUM(ib.qty), 0) AS "totalStock",
             p.min_stock AS "minStock"
      FROM products p
      LEFT JOIN inventory_balances ib ON ib.product_id = p.id
      WHERE p.is_active = TRUE AND p.is_controlado = TRUE
      GROUP BY p.id
      ORDER BY p.name
    `);
    return rows.map((r: { totalStock: string }) => ({
      ...r,
      totalStock: Number(r.totalStock),
    }));
  }

  async getControlledLog() {
    const rows = await this.dataSource.query(`
      SELECT cdl.validated_at AS "validatedAt",
             cdl.notes,
             p.name AS "productName",
             u.full_name AS "validatorName"
      FROM controlled_drug_log cdl
      JOIN dispensations d ON d.id = cdl.dispensation_id
      JOIN prescriptions pr ON pr.id = d.prescription_id
      JOIN prescription_lines pl ON pl.prescription_id = pr.id
      JOIN products p ON p.id = pl.product_id
      JOIN users u ON u.id = cdl.validator_user_id
      ORDER BY cdl.validated_at DESC
      LIMIT 50
    `);
    return rows;
  }

  async getPendingPrescriptions() {
    const rows = await this.dataSource.query(`
      SELECT pr.id, pr.external_id AS "externalId", pr.patient_id AS "patientId",
             pr.status, pr.created_at AS "createdAt",
             COUNT(pl.id)::int AS lines
      FROM prescriptions pr
      LEFT JOIN prescription_lines pl ON pl.prescription_id = pr.id
      WHERE pr.status = 'PENDING'
      GROUP BY pr.id
      ORDER BY pr.created_at DESC
      LIMIT 30
    `);
    return rows;
  }

  async getPrescriptionDetail(id: string) {
    const [rx] = await this.dataSource.query(
      `SELECT id, external_id AS "externalId", patient_id AS "patientId", status
       FROM prescriptions WHERE id = $1`,
      [id],
    );
    if (!rx) throw new NotFoundException('Prescripción no encontrada');
    const lines = await this.dataSource.query(
      `SELECT pl.id, p.id AS "productId", p.code, p.name, p.is_controlado AS "isControlado",
              pl.dose_qty AS "doseQty", pl.dose_unit AS "doseUnit"
       FROM prescription_lines pl
       JOIN products p ON p.id = pl.product_id
       WHERE pl.prescription_id = $1`,
      [id],
    );
    return { ...rx, lines };
  }

  async dispense(data: {
    prescriptionId: string;
    warehouseId: string;
    validatorUserId?: string;
    notes?: string;
    lines: { productId: string; qty: number; lotId?: string }[];
  }) {
    const detail = await this.getPrescriptionDetail(data.prescriptionId);
    if (detail.status !== 'PENDING') {
      throw new BadRequestException('Prescripción ya dispensada o cancelada');
    }

    const hasControlled = detail.lines.some((l: { isControlado: boolean }) => l.isControlado);
    if (hasControlled && !data.validatorUserId) {
      throw new BadRequestException('Medicamento controlado: requiere segundo validador');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [disp] = await qr.query(
        `INSERT INTO dispensations (prescription_id) VALUES ($1) RETURNING id`,
        [data.prescriptionId],
      );

      for (const line of data.lines) {
        await qr.query(
          `UPDATE inventory_balances SET qty = qty - $4
           WHERE warehouse_id = $1 AND product_id = $2 AND lot_id IS NOT DISTINCT FROM $3`,
          [data.warehouseId, line.productId, line.lotId ?? null, line.qty],
        );
        await qr.query(
          `INSERT INTO inventory_movements (type, warehouse_id, product_id, lot_id, qty, reference_type, reference_id)
           VALUES ('DISPENSE', $1, $2, $3, $4, 'DISPENSATION', $5)`,
          [data.warehouseId, line.productId, line.lotId ?? null, line.qty, disp.id],
        );
      }

      if (hasControlled && data.validatorUserId) {
        await qr.query(
          `INSERT INTO controlled_drug_log (dispensation_id, validator_user_id, notes)
           VALUES ($1, $2, $3)`,
          [disp.id, data.validatorUserId, data.notes ?? null],
        );
      }

      await qr.query(
        `UPDATE prescriptions SET status = 'DISPENSED' WHERE id = $1`,
        [data.prescriptionId],
      );
      await qr.commitTransaction();
      return { success: true, dispensationId: disp.id };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
}
