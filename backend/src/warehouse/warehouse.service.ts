import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getSatellites() {
    const warehouses = await this.dataSource.query(`
      SELECT w.id, w.code, w.name, w.policy::text AS policy
      FROM warehouses w
      WHERE w.is_active = TRUE AND w.type = 'SATELITE'
      ORDER BY w.name
    `);

    const requisitions = await this.dataSource.query(`
      SELECT ir.number AS id, ir.status, ir.priority::text AS priority,
             d.name AS destination, s.name AS source,
             ir.created_at AS "createdAt",
             COALESCE(lc.cnt, 0)::int AS "lineCount",
             lc.summary AS "productsSummary"
      FROM internal_requisitions ir
      JOIN warehouses d ON d.id = ir.dest_warehouse_id
      JOIN warehouses s ON s.id = ir.source_warehouse_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt,
               (
                 SELECT CASE
                   WHEN COUNT(*) = 0 THEN NULL
                   WHEN COUNT(*) = 1 THEN MIN(p.code)
                   ELSE MIN(p.code) || ' +' || (COUNT(*) - 1)::text
                 END
                 FROM internal_requisition_lines irl2
                 JOIN products p ON p.id = irl2.product_id
                 WHERE irl2.requisition_id = ir.id
               ) AS summary
        FROM internal_requisition_lines irl
        WHERE irl.requisition_id = ir.id
      ) lc ON TRUE
      WHERE d.type = 'SATELITE' OR s.type = 'SATELITE'
      ORDER BY ir.created_at DESC
      LIMIT 50
    `);

    return { warehouses, requisitions };
  }
}
