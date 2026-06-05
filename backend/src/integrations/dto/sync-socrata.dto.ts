import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SyncSocrataDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Reemplazar registros existentes del mismo list_type INVIMA',
  })
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}
