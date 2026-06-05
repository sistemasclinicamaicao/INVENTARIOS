import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ConfirmReceptionDto } from './dto/confirm-reception.dto';
import { ImportErpReceptionDto } from './dto/import-erp-reception.dto';
import { UpdateOrderHeaderDto } from './dto/update-order-header.dto';
import { ReceptionsService } from './receptions.service';

@ApiTags('receptions')
@RequirePermissions('reception.manage')
@Controller('receptions')
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Get('warehouses')
  listWarehouses() {
    return this.receptionsService.listWarehouses();
  }

  @Get('order/:ocNumber')
  getOrder(@Param('ocNumber') ocNumber: string) {
    return this.receptionsService.getOrderByOc(ocNumber);
  }

  @Get('scan/:barcode')
  scan(@Param('barcode') barcode: string) {
    return this.receptionsService.findByBarcode(barcode);
  }

  @Post('confirm')
  confirm(@Body() dto: ConfirmReceptionDto) {
    return this.receptionsService.confirmReception(dto);
  }

  /** Catálogo + OC aprobada + datos listos para recepcionar (desde importar en Registro OC). */
  @Post('import-erp')
  importFromErp(@Body() dto: ImportErpReceptionDto) {
    return this.receptionsService.importFromErp(dto);
  }

  @Patch('order/:purchaseOrderId/header')
  updateOrderHeader(
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body() dto: UpdateOrderHeaderDto,
  ) {
    return this.receptionsService.updateOrderHeader(purchaseOrderId, dto);
  }
}
