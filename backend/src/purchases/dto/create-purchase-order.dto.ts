import { Type } from 'class-transformer';

import {

  IsArray,

  IsDateString,

  IsIn,

  IsNotEmpty,

  IsNumber,

  IsOptional,

  IsString,

  IsUUID,

  MaxLength,

  Min,

  ValidateNested,

} from 'class-validator';



export class PurchaseOrderLineDto {

  @IsUUID()

  productId: string;



  @IsNumber()

  @Min(0.0001)

  qtyOrdered: number;



  @IsString()

  @IsNotEmpty()

  @MaxLength(30)

  unit: string;



  @IsNumber()

  @Min(0)

  @IsOptional()

  unitPrice?: number;



  @IsString()

  @IsOptional()

  @MaxLength(80)

  lotNumber?: string;



  @IsDateString()

  @IsOptional()

  expiresAt?: string;

  @IsString()

  @IsOptional()

  @MaxLength(50)

  erpCode?: string;

  @IsNumber()

  @Min(0.0001)

  @IsOptional()

  qtyErp?: number;

}



export class CreatePurchaseOrderDto {

  @IsString()

  @IsNotEmpty()

  @MaxLength(30)

  number: string;



  @IsUUID()

  @IsOptional()

  supplierId?: string;



  @IsString()

  @IsOptional()

  @MaxLength(200)

  supplierName?: string;



  @IsUUID()

  warehouseId: string;



  @IsArray()

  @ValidateNested({ each: true })

  @Type(() => PurchaseOrderLineDto)

  lines: PurchaseOrderLineDto[];



  @IsString()

  @IsOptional()

  @IsIn(['DRAFT', 'APPROVED'])

  status?: 'DRAFT' | 'APPROVED';

}


