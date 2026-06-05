import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getStats() {
    const [row] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM internal_requisitions WHERE status IN ('PENDING', 'IN_PICKING')) AS pending_requisitions,
        (SELECT COUNT(*)::int FROM inventory_movements WHERE created_at::date = CURRENT_DATE AND type IN ('PICK', 'TRANSFER_OUT', 'DISPENSE')) AS deliveries_today,
        (SELECT COUNT(*)::int FROM (
          SELECT p.id
          FROM products p
          LEFT JOIN inventory_balances ib ON ib.product_id = p.id
          WHERE p.is_active = TRUE
          GROUP BY p.id, p.min_stock
          HAVING COALESCE(SUM(ib.qty), 0) < p.min_stock
        ) low) AS low_stock,
        (SELECT COUNT(DISTINCT l.id)::int
         FROM lots l
         JOIN inventory_balances ib ON ib.lot_id = l.id AND ib.qty > 0
         WHERE l.expires_at IS NOT NULL
           AND l.expires_at <= CURRENT_DATE + INTERVAL '90 days') AS expiring_soon
    `);
    return {
      pendingRequisitions: row?.pending_requisitions ?? 0,
      deliveriesToday: row?.deliveries_today ?? 0,
      lowStock: row?.low_stock ?? 0,
      expiringSoon: row?.expiring_soon ?? 0,
    };
  }

  async getExpiryAlerts() {
    const rows = await this.dataSource.query(`
      SELECT
        l.id,
        p.name AS product_name,
        l.lot_number,
        l.expires_at,
        (l.expires_at - CURRENT_DATE) AS days_until_expiry,
        COALESCE(SUM(ib.qty), 0) AS qty,
        p.base_unit AS unit
      FROM lots l
      JOIN products p ON p.id = l.product_id
      LEFT JOIN inventory_balances ib ON ib.lot_id = l.id AND ib.qty > 0
      WHERE l.expires_at IS NOT NULL
        AND l.expires_at <= CURRENT_DATE + INTERVAL '90 days'
      GROUP BY l.id, p.name, l.lot_number, l.expires_at, p.base_unit
      HAVING COALESCE(SUM(ib.qty), 0) > 0
      ORDER BY l.expires_at ASC
      LIMIT 20
    `);

    return rows.map((r: {
      id: string;
      product_name: string;
      lot_number: string;
      expires_at: Date;
      days_until_expiry: number;
      qty: string;
      unit: string;
    }) => {
      const days = Number(r.days_until_expiry);
      return {
        id: r.id,
        productName: r.product_name,
        lotNumber: r.lot_number,
        daysUntilExpiry: days,
        expiresAt: this.formatDate(r.expires_at),
        qty: Number(r.qty),
        unit: r.unit,
        severity: days <= 30 ? 'critical' : 'warning',
      };
    });
  }

  async getRequisitions() {
    const rows = await this.dataSource.query(`
      SELECT
        ir.number AS id,
        d.name AS destination,
        ir.priority::text AS priority
      FROM internal_requisitions ir
      JOIN warehouses d ON d.id = ir.dest_warehouse_id
      WHERE ir.status IN ('PENDING', 'IN_PICKING')
      ORDER BY
        CASE ir.priority WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
        ir.created_at ASC
      LIMIT 50
    `);
    return rows.map((r: { id: string; destination: string; priority: string }) => ({
      id: r.id,
      destination: r.destination,
      priority: r.priority,
    }));
  }

  async getNotificationCount(): Promise<number> {
    const stats = await this.getStats();
    return stats.pendingRequisitions + stats.expiringSoon;
  }

  private formatDate(d: Date | string): string {
    const date = d instanceof Date ? d : new Date(d);
    return date.toISOString().slice(0, 10);
  }
}
