import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateSupplierDto } from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findAll() {
    const rows = await this.dataSource.query(`
      SELECT id, code, name, tax_id AS "taxId", is_active AS "isActive"
      FROM suppliers
      WHERE is_active = TRUE
      ORDER BY name
    `);
    return rows;
  }

  async create(dto: CreateSupplierDto) {
    try {
      const [row] = await this.dataSource.query(
        `INSERT INTO suppliers (code, name, tax_id)
         VALUES ($1, $2, $3)
         RETURNING id, code, name, tax_id AS "taxId"`,
        [dto.code.trim().toUpperCase(), dto.name.trim(), dto.taxId?.trim() ?? null],
      );
      return row;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === '23505') {
        throw new ConflictException(`Ya existe un proveedor con código ${dto.code}`);
      }
      throw e;
    }
  }

  /** Busca por NIT; si no existe, crea proveedor desde datos CXC. */
  async findOrCreateByErp(
    nit: string,
    razonSocial: string,
  ): Promise<{ id: string; name: string; created: boolean } | null> {
    const digits = nit.replace(/\D/g, '');
    if (!digits) return null;

    const [existing] = await this.dataSource.query<{ id: string; name: string }[]>(
      `SELECT id, name FROM suppliers
       WHERE REPLACE(REPLACE(REPLACE(COALESCE(tax_id, ''), '.', ''), '-', ''), ' ', '') = $1
       ORDER BY is_active DESC
       LIMIT 1`,
      [digits],
    );
    if (existing) {
      if (razonSocial.trim() && existing.name !== razonSocial.trim()) {
        await this.dataSource.query(
          `UPDATE suppliers SET name = $2 WHERE id = $1`,
          [existing.id, razonSocial.trim()],
        );
        return { id: existing.id, name: razonSocial.trim(), created: false };
      }
      return { ...existing, created: false };
    }

    const name = razonSocial.trim() || `Proveedor ERP ${digits}`;
    const code = `P-${digits}`.slice(0, 30);

    try {
      const [row] = await this.dataSource.query<{ id: string; name: string }[]>(
        `INSERT INTO suppliers (code, name, tax_id, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, name`,
        [code, name, digits],
      );
      return row ? { ...row, created: true } : null;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === '23505') {
        const [again] = await this.dataSource.query<{ id: string; name: string }[]>(
          `SELECT id, name FROM suppliers WHERE code = $1 OR tax_id = $2 LIMIT 1`,
          [code, digits],
        );
        return again ? { ...again, created: false } : null;
      }
      throw e;
    }
  }

  /** Garantiza proveedor en BD al importar (por NIT ERP o id existente). */
  async ensureForErpImport(opts: {
    supplierId?: string;
    supplierTaxId?: string;
    supplierName?: string;
  }): Promise<{ id: string; name: string; created: boolean }> {
    const nit = (opts.supplierTaxId ?? '').replace(/\D/g, '');
    if (nit) {
      const byErp = await this.findOrCreateByErp(nit, opts.supplierName ?? '');
      if (byErp) return byErp;
    }

    if (opts.supplierId) {
      const [row] = await this.dataSource.query<{ id: string; name: string }[]>(
        `SELECT id, name FROM suppliers WHERE id = $1 AND is_active = TRUE`,
        [opts.supplierId],
      );
      if (row) return { ...row, created: false };
    }

    throw new BadRequestException(
      'No se pudo registrar el proveedor del ERP. Verifique NIT y razón social.',
    );
  }

  /** Vincula productos importados con el proveedor en catálogo. */
  async linkProductsFromErp(
    supplierId: string,
    items: { productId: string; erpCode: string; unitPrice?: number }[],
  ) {
    for (const item of items) {
      await this.dataSource.query(
        `INSERT INTO supplier_products (supplier_id, product_id, erp_code, last_unit_price)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (supplier_id, product_id) DO UPDATE SET
           erp_code = EXCLUDED.erp_code,
           last_unit_price = COALESCE(EXCLUDED.last_unit_price, supplier_products.last_unit_price),
           updated_at = NOW()`,
        [supplierId, item.productId, item.erpCode, item.unitPrice ?? null],
      );
    }
    return { linked: items.length };
  }

  async resolveName(supplierId?: string, supplierName?: string): Promise<string> {
    if (supplierId) {
      const [s] = await this.dataSource.query(
        `SELECT name FROM suppliers WHERE id = $1 AND is_active = TRUE`,
        [supplierId],
      );
      if (!s) throw new BadRequestException('Proveedor no válido');
      return s.name;
    }
    if (supplierName?.trim()) return supplierName.trim();
    throw new BadRequestException('Indique proveedor (lista o nombre)');
  }
}
