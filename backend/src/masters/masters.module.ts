import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { InvimaService } from './invima/invima.service';
import { MedicamentosPosService } from './medicamentos-pos/medicamentos-pos.service';
import { MastersController } from './masters.controller';
import { ProductsService } from './products.service';
import { WarehousesService } from './warehouses.service';

@Module({
  controllers: [MastersController],
  providers: [
    ProductsService,
    ImportService,
    WarehousesService,
    InvimaService,
    MedicamentosPosService,
  ],
  exports: [
    ProductsService,
    ImportService,
    WarehousesService,
    InvimaService,
    MedicamentosPosService,
  ],
})
export class MastersModule {}
