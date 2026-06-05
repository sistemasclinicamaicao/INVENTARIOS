import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ConfirmPickingDto } from './dto/confirm-picking.dto';
import { PickingService } from './picking.service';

@ApiTags('picking')
@RequirePermissions('picking.manage')
@Controller('picking')
export class PickingController {
  constructor(private readonly pickingService: PickingService) {}

  @Post('transfers/:transferNumber/receive')
  receiveTransfer(@Param('transferNumber') transferNumber: string) {
    return this.pickingService.receiveTransfer(transferNumber);
  }

  @Post('start/:requisitionNumber')
  start(@Param('requisitionNumber') requisitionNumber: string) {
    return this.pickingService.start(requisitionNumber);
  }

  @Get('order/:pickingOrderId')
  getOrder(@Param('pickingOrderId') pickingOrderId: string) {
    return this.pickingService.getPickingOrder(pickingOrderId);
  }

  @Post('order/:pickingOrderId/confirm')
  confirm(
    @Param('pickingOrderId') pickingOrderId: string,
    @Body() dto: ConfirmPickingDto,
  ) {
    return this.pickingService.confirm(pickingOrderId, dto);
  }
}
