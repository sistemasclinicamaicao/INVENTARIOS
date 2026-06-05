import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ErpProductLineDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  name: string;
}

export class BulkErpProductsDto {
  @ApiProperty({ type: [ErpProductLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ErpProductLineDto)
  lines: ErpProductLineDto[];

  @ApiPropertyOptional({ description: 'Marcar como producto de farmacia (FEFO/lote)' })
  @IsOptional()
  @IsBoolean()
  isFarmacia?: boolean;
}
