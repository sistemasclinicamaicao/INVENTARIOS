import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportErpLineDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0.0001)
  qtyOrdered: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  lotNumber?: string;
}

export class ImportErpReceptionDto {
  @IsString()
  ocNumber: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  supplierTaxId?: string;

  @IsString()
  @IsOptional()
  supplierName?: string;

  @IsUUID()
  warehouseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportErpLineDto)
  lines: ImportErpLineDto[];

  @IsOptional()
  @IsBoolean()
  isFarmacia?: boolean;
}
