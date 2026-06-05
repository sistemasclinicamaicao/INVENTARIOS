import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { INVIMA_LIST_TYPE_VALUES, InvimaListType } from '../invima-parser';

export class ImportInvimaDto {
  @IsString()
  filePath: string;

  @IsOptional()
  @IsIn(INVIMA_LIST_TYPE_VALUES)
  listType?: InvimaListType;

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}

export class ImportInvimaDirDto {
  @IsOptional()
  @IsString()
  dataDir?: string;
}
