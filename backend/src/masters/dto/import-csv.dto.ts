import { IsIn, IsString, MinLength } from 'class-validator';

export class ImportCsvDto {
  @IsString()
  @MinLength(10)
  content: string;

  @IsIn(['productos', 'inventario'])
  type: 'productos' | 'inventario';
}
