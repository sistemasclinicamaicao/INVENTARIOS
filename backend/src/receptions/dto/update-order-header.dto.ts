import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateOrderHeaderDto {
  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  supplierName?: string;
}
