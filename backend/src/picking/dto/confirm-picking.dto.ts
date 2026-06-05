import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class PickLineConfirmDto {
  @IsUUID()
  pickingLineId: string;

  @IsUUID()
  @IsOptional()
  lotId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  qtyPicked?: number;
}

export class ConfirmPickingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickLineConfirmDto)
  lines: PickLineConfirmDto[];
}
