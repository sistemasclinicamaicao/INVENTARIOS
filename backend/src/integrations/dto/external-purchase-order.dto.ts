import { ApiProperty } from '@nestjs/swagger';

export class ExternalSupplierDto {
  @ApiProperty({ required: false })
  id?: string;

  @ApiProperty()
  name: string;
}

export class ExternalWarehouseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;
}

export class ExternalPurchaseOrderLineDto {
  @ApiProperty()
  productCode: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  qtyOrdered: number;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  lineTotal: number;

  @ApiProperty({ required: false })
  lotNumber?: string | null;

  @ApiProperty({ required: false })
  expiresAt?: string | null;
}

export class ExternalPurchaseOrderTotalsDto {
  @ApiProperty()
  lineCount: number;

  @ApiProperty()
  amount: number;
}

export class ExternalPurchaseOrderResponseDto {
  @ApiProperty({ example: 'OC-2026-1001' })
  number: string;

  @ApiProperty({ example: 'APPROVED' })
  status: string;

  @ApiProperty({ type: ExternalSupplierDto })
  supplier: ExternalSupplierDto;

  @ApiProperty({ type: ExternalWarehouseDto })
  warehouse: ExternalWarehouseDto;

  @ApiProperty({ type: [ExternalPurchaseOrderLineDto] })
  lines: ExternalPurchaseOrderLineDto[];

  @ApiProperty({ type: ExternalPurchaseOrderTotalsDto })
  totals: ExternalPurchaseOrderTotalsDto;
}
