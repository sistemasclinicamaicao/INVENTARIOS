import { Module } from '@nestjs/common';
import { PrintingController } from './printing.controller';
import { PrintingService } from './printing.service';
import { ZebraPrintService } from './zebra-print.service';

@Module({
  controllers: [PrintingController],
  providers: [PrintingService, ZebraPrintService],
  exports: [PrintingService, ZebraPrintService],
})
export class PrintingModule {}
