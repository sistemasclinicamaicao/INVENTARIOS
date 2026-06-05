import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PrintingService } from './printing.service';
import { ZebraPrintService } from './zebra-print.service';

@ApiTags('printing')
@RequirePermissions('reception.manage')
@Controller('printing')
export class PrintingController {
  constructor(
    private readonly printingService: PrintingService,
    private readonly zebra: ZebraPrintService,
  ) {}

  @Get('label/:lineId')
  async receptionLine(@Param('lineId') lineId: string) {
    const result = await this.printingService.labelForReceptionLine(lineId);
    const print = await this.zebra.sendZpl(result.zpl);
    return { ...result, print };
  }

  @Get('product/:productId')
  product(
    @Param('productId') productId: string,
    @Query('lot') lot?: string,
  ) {
    return this.printingService.labelForProduct(productId, lot);
  }

  @Post('zpl')
  customZpl(
    @Body()
    body: {
      productName: string;
      productCode: string;
      lotNumber?: string;
      expiresAt?: string;
      qty?: number;
    },
  ) {
    const zpl = this.printingService.buildZpl(body);
    return { zpl, contentType: 'text/zpl' };
  }

  @Post('zpl/send')
  async sendZpl(@Body() body: { zpl: string }) {
    const print = await this.zebra.sendZpl(body.zpl);
    return { ...print, zpl: body.zpl };
  }
}
