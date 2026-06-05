import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  baseUnit: string;

  @IsBoolean()
  @IsOptional()
  isFarmacia?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresLote?: boolean;

  @IsBoolean()
  @IsOptional()
  isControlado?: boolean;

  @IsNumber()
  @IsOptional()
  minStock?: number;

  @IsString()
  @IsOptional()
  barcode?: string;
}
