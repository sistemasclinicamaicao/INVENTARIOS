import { Module } from '@nestjs/common';
import { MastersModule } from '../masters/masters.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { ReceptionsController } from './receptions.controller';
import { ReceptionsService } from './receptions.service';

@Module({
  imports: [MastersModule, PurchasesModule],
  controllers: [ReceptionsController],
  providers: [ReceptionsService],
})
export class ReceptionsModule {}
