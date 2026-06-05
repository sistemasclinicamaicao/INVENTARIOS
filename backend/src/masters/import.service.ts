import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

function parseCsv(content: string): string[][] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line) => line.split(';').map((c) => c.trim()));
}

function yesNo(val: string): boolean {
  const v = (val || '').toUpperCase();
  return v === 'SI' || v === 'S' || v === '1' || v === 'TRUE' || v === 'YES';
}

@Injectable()
export class ImportService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async importProductsCsv(csvContent: string) {
    const rows = parseCsv(csvContent);
    if (rows.length < 2) {
      throw new BadRequestException('El CSV debe tener encabezado y al menos una fila de datos');
    }
    const header = rows[0].map((h) => h.toLowerCase());
    const idx = (name: string) => header.indexOf(name);

    const required = ['codigo', 'nombre', 'unidad_base'];
    for (const col of required) {
      if (idx(col) < 0) {
        throw new BadRequestException(`Falta columna obligatoria: ${col}`);
      }
    }

    let inserted = 0;
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const code = row[idx('codigo')];
      if (!code || code.startsWith('Ejemplo')) {
        skipped++;
        continue;
      }

      const name = row[idx('nombre')];
      const description = idx('descripcion') >= 0 ? row[idx('descripcion')] : '';
      const baseUnit = row[idx('unidad_base')] || 'UND';
      const isFarmacia = idx('es_farmacia') >= 0 ? yesNo(row[idx('es_farmacia')]) : false;
      const requiresLote = idx('requiere_lote') >= 0 ? yesNo(row[idx('requiere_lote')]) : isFarmacia;
      const isControlado = idx('es_controlado') >= 0 ? yesNo(row[idx('es_controlado')]) : false;
      const minStock = idx('stock_minimo') >= 0 ? Number(row[idx('stock_minimo')] || 0) : 0;
      const barcode = idx('codigo_barras') >= 0 ? row[idx('codigo_barras')] : '';

      await this.dataSource.query(
        `INSERT INTO products (code, name, description, base_unit, is_farmacia, requires_lote, is_controlado, policy, min_stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT ((UPPER(TRIM(code))), is_farmacia) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           base_unit = EXCLUDED.base_unit,
           requires_lote = EXCLUDED.requires_lote,
           is_controlado = EXCLUDED.is_controlado,
           min_stock = EXCLUDED.min_stock,
           updated_at = NOW()`,
        [
          code,
          name,
          description || null,
          baseUnit,
          isFarmacia,
          requiresLote,
          isControlado,
          isFarmacia ? 'FEFO' : 'FIFO',
          minStock,
        ],
      );

      if (barcode) {
        const [p] = await this.dataSource.query(`SELECT id FROM products WHERE code = $1`, [code]);
        if (p) {
          await this.dataSource.query(
            `INSERT INTO product_barcodes (product_id, barcode, type)
             VALUES ($1, $2, 'EAN')
             ON CONFLICT (barcode) DO NOTHING`,
            [p.id, barcode],
          );
        }
      }
      inserted++;
    }

    return { inserted, skipped, message: `${inserted} productos importados/actualizados` };
  }

  async importInventoryCsv(csvContent: string) {
    const rows = parseCsv(csvContent);
    if (rows.length < 2) {
      throw new BadRequestException('CSV inválido');
    }
    const header = rows[0].map((h) => h.toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    let inserted = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const productCode = row[idx('codigo_producto')];
      const warehouseCode = row[idx('codigo_bodega')];
      if (!productCode || !warehouseCode) continue;

      const qty = Number(row[idx('cantidad')] || 0);
      if (qty <= 0) continue;

      const lotNumber = idx('lote') >= 0 ? row[idx('lote')] : null;
      const expiresAt = idx('vencimiento') >= 0 && row[idx('vencimiento')] ? row[idx('vencimiento')] : null;

      const [p] = await this.dataSource.query(`SELECT id FROM products WHERE code = $1`, [productCode]);
      const [w] = await this.dataSource.query(`SELECT id FROM warehouses WHERE code = $1`, [warehouseCode]);
      if (!p || !w) continue;

      let lotId: string | null = null;
      if (lotNumber) {
        const [lot] = await this.dataSource.query(
          `INSERT INTO lots (product_id, lot_number, expires_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (product_id, lot_number) DO UPDATE SET expires_at = EXCLUDED.expires_at
           RETURNING id`,
          [p.id, lotNumber.toUpperCase(), expiresAt],
        );
        lotId = lot.id;
      }

      await this.dataSource.query(
        `INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (warehouse_id, location_id, product_id, lot_id)
         DO UPDATE SET qty = EXCLUDED.qty`,
        [w.id, p.id, lotId, qty],
      );
      inserted++;
    }

    return { inserted, message: `${inserted} saldos de inventario cargados` };
  }
}
