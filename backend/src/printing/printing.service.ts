import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PrintingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  buildZpl(params: {
    productName: string;
    productCode: string;
    lotNumber?: string;
    expiresAt?: string;
    qty?: number;
    internalCode?: string;
  }): string {
    const lot = params.lotNumber ?? 'SIN-LOTE';
    const exp = params.expiresAt ?? 'N/A';
    const code = params.internalCode ?? params.productCode;
    const name = params.productName.slice(0, 28);
    return `^XA
^FO50,30^A0N,28,28^FD${name}^FS
^FO50,70^A0N,22,22^FDCod: ${params.productCode}^FS
^FO50,100^A0N,22,22^FDLote: ${lot}^FS
^FO50,130^A0N,22,22^FDVence: ${exp}^FS
^FO50,170^BY2^BCN,80,Y,N,N^FD${code}^FS
^FO50,270^A0N,18,18^FDCant: ${params.qty ?? 1}^FS
^XZ`;
  }

  async labelForReceptionLine(lineId: string) {
    const [row] = await this.dataSource.query(
      `SELECT p.name, p.code, rl.lot_number, rl.expires_at, rl.qty_received AS qty
       FROM reception_lines rl
       JOIN products p ON p.id = rl.product_id
       WHERE rl.id = $1`,
      [lineId],
    );
    if (!row) throw new NotFoundException('Línea de recepción no encontrada');
    const zpl = this.buildZpl({
      productName: row.name,
      productCode: row.code,
      lotNumber: row.lot_number,
      expiresAt: row.expires_at ? String(row.expires_at).slice(0, 10) : undefined,
      qty: Number(row.qty),
      internalCode: row.lot_number ? `${row.code}-${row.lot_number}` : row.code,
    });
    return { zpl, contentType: 'text/zpl' };
  }

  async labelForProduct(productId: string, lotNumber?: string) {
    const [p] = await this.dataSource.query(
      `SELECT name, code FROM products WHERE id = $1`,
      [productId],
    );
    if (!p) throw new NotFoundException('Producto no encontrado');
    let expiresAt: string | undefined;
    if (lotNumber) {
      const [l] = await this.dataSource.query(
        `SELECT expires_at FROM lots WHERE product_id = $1 AND lot_number = $2`,
        [productId, lotNumber.toUpperCase()],
      );
      expiresAt = l?.expires_at ? String(l.expires_at).slice(0, 10) : undefined;
    }
    return {
      zpl: this.buildZpl({
        productName: p.name,
        productCode: p.code,
        lotNumber,
        expiresAt,
        internalCode: lotNumber ? `${p.code}-${lotNumber}` : p.code,
      }),
      contentType: 'text/zpl',
    };
  }
}
