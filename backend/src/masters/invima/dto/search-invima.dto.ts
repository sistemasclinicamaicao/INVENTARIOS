import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { INVIMA_LIST_TYPE_VALUES, InvimaListType } from '../invima-parser';

export class SearchInvimaDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  cum?: string;

  @IsOptional()
  @IsIn(INVIMA_LIST_TYPE_VALUES)
  listType?: InvimaListType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

