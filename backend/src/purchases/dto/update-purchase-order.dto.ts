import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdatePurchaseOrderDto {
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  supplierName?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  @IsIn(['DRAFT', 'APPROVED', 'CANCELLED'])
  status?: 'DRAFT' | 'APPROVED' | 'CANCELLED';
}
