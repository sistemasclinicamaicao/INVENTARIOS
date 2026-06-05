import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MastersModule } from '../masters/masters.module';
import { PurchasesController } from './purchases.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [IntegrationsModule, MastersModule],
  controllers: [PurchasesController],
  providers: [SuppliersService, PurchaseOrdersService],
  exports: [PurchaseOrdersService, SuppliersService],
})
export class PurchasesModule {}
