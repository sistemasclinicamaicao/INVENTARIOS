import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class HisLineDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsNumber()
  doseQty: number;

  @IsString()
  doseUnit: string;
}

export class HisPrescriptionDto {
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsOptional()
  doctorId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HisLineDto)
  lines: HisLineDto[];
}
