import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReceptionLineDto {
  @IsUUID()
  purchaseOrderLineId: string;

  @IsUUID()
  productId: string;

  @IsIn(['receive'])
  disposition: 'receive';

  @IsNumber()
  @Min(0)
  qtyReceived: number;

  @IsString()
  @IsOptional()
  lotNumber?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class ConfirmReceptionDto {
  @IsUUID()
  purchaseOrderId: string;

  @IsUUID()
  warehouseId: string;

  @IsBoolean()
  @IsOptional()
  isPartial?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceptionLineDto)
  lines: ReceptionLineDto[];
}
