import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class RequisitionLineDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0.0001)
  qtyRequested: number;

  @IsString()
  @IsNotEmpty()
  unit: string;
}

export class CreateRequisitionDto {
  @IsString()
  @IsOptional()
  @MaxLength(30)
  number?: string;

  @IsUUID()
  sourceWarehouseId: string;

  @IsUUID()
  destWarehouseId: string;

  @IsString()
  @IsOptional()
  @IsIn(['ALTA', 'MEDIA', 'NORMAL'])
  priority?: 'ALTA' | 'MEDIA' | 'NORMAL';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequisitionLineDto)
  lines: RequisitionLineDto[];
}
