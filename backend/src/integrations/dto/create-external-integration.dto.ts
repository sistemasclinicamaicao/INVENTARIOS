import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum ExternalAuthMethodDto {
  NONE = 'NONE',
  API_KEY = 'API_KEY',
  BEARER = 'BEARER',
  BASIC = 'BASIC',
}

export enum IntegrationKindDto {
  ERP_PURCHASE_ORDER = 'ERP_PURCHASE_ORDER',
  SOCRATA_OPEN_DATA = 'SOCRATA_OPEN_DATA',
  REST_QUERY = 'REST_QUERY',
}

export enum SocrataApiVersionDto {
  SODA2 = 'SODA2',
  SODA3 = 'SODA3',
}

export enum IntegrationSyncTargetDto {
  NONE = 'NONE',
  INVIMA_REGISTROS = 'INVIMA_REGISTROS',
}

export enum InvimaListTypeDto {
  VIGENTE = 'VIGENTE',
  VENCIDO = 'VENCIDO',
  RENOVACION = 'RENOVACION',
  OTRO_ESTADO = 'OTRO_ESTADO',
}

export class CreateExternalIntegrationDto {
  @ApiProperty({ example: 'ERP principal producción' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: IntegrationKindDto, default: IntegrationKindDto.ERP_PURCHASE_ORDER })
  @IsOptional()
  @IsEnum(IntegrationKindDto)
  integrationKind?: IntegrationKindDto;

  @ApiProperty({ example: 'https://erp.empresa.com/api/v1' })
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  baseUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({ enum: ExternalAuthMethodDto, default: ExternalAuthMethodDto.NONE })
  @IsOptional()
  @IsEnum(ExternalAuthMethodDto)
  authMethod?: ExternalAuthMethodDto;

  @ApiPropertyOptional({ example: 'x-api-key' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  authHeaderName?: string;

  @ApiPropertyOptional({ description: 'Clave, token o contraseña según método' })
  @ValidateIf((o) => o.authMethod && o.authMethod !== 'NONE')
  @IsOptional()
  @IsString()
  authSecret?: string;

  @ApiPropertyOptional({ description: 'Usuario Basic Auth' })
  @ValidateIf((o) => o.authMethod === 'BASIC')
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authUsername?: string;

  @ApiPropertyOptional({
    default: '?consecutivo={number}',
    description: 'Ruta o query ERP. Placeholders: {number}, {consecutivo}',
  })
  @ValidateIf((o) => (o.integrationKind ?? 'ERP_PURCHASE_ORDER') === 'ERP_PURCHASE_ORDER')
  @IsOptional()
  @IsString()
  @MaxLength(300)
  poPathTemplate?: string;

  @ApiPropertyOptional({ example: 'i7cb-raxc' })
  @ValidateIf((o) => o.integrationKind === 'SOCRATA_OPEN_DATA')
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  socrataDatasetId?: string;

  @ApiPropertyOptional({ enum: SocrataApiVersionDto, default: SocrataApiVersionDto.SODA3 })
  @ValidateIf((o) => o.integrationKind === 'SOCRATA_OPEN_DATA')
  @IsOptional()
  @IsEnum(SocrataApiVersionDto)
  socrataApiVersion?: SocrataApiVersionDto;

  @ApiPropertyOptional({ description: 'Consulta SoQL completa' })
  @ValidateIf((o) => o.integrationKind === 'SOCRATA_OPEN_DATA')
  @IsString()
  @MinLength(10)
  socrataQuery?: string;

  @ApiPropertyOptional({ default: 1000 })
  @ValidateIf((o) => o.integrationKind === 'SOCRATA_OPEN_DATA')
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50000)
  socrataPageSize?: number;

  @ApiPropertyOptional({ enum: IntegrationSyncTargetDto, default: IntegrationSyncTargetDto.NONE })
  @ValidateIf((o) => o.integrationKind === 'SOCRATA_OPEN_DATA')
  @IsOptional()
  @IsEnum(IntegrationSyncTargetDto)
  syncTarget?: IntegrationSyncTargetDto;

  @ApiPropertyOptional({ enum: InvimaListTypeDto })
  @ValidateIf(
    (o) =>
      o.integrationKind === 'SOCRATA_OPEN_DATA' &&
      o.syncTarget === 'INVIMA_REGISTROS',
  )
  @IsEnum(InvimaListTypeDto)
  invimaListType?: InvimaListTypeDto;
}
