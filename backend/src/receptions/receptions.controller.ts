import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ConfirmReceptionDto } from './dto/confirm-reception.dto';
import { ImportErpReceptionDto } from './dto/import-erp-reception.dto';
import { ListReceptionHistoryDto } from './dto/list-reception-history.dto';
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

  @Get('history')
  listHistory(@Query() query: ListReceptionHistoryDto) {
    return this.receptionsService.listHistory(query);
  }

  @Get('history/:id')
  getHistoryDetail(@Param('id') id: string) {
    return this.receptionsService.getHistoryDetail(id);
  }

  @Post('confirm')
  confirm(@Body() dto: ConfirmReceptionDto, @Req() req: { user: JwtPayload }) {
    return this.receptionsService.confirmReception(dto, req.user?.sub);
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
