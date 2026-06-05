import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@RequirePermissions('inventory.view')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('balances')
  getBalances(@Query('warehouse') warehouse?: string) {
    return this.inventoryService.getBalances(warehouse);
  }

  @Get('warehouses')
  getWarehouses() {
    return this.inventoryService.getWarehouses();
  }

  @Get('movements')
  getMovements(@Query('limit') limit?: string) {
    return this.inventoryService.getMovements(limit ? Number(limit) : 50);
  }

  @Post('cycle-count')
  cycleCount(
    @Body()
    body: {
      warehouseId: string;
      productId: string;
      lotId?: string;
      countedQty: number;
    },
  ) {
    return this.inventoryService.cycleCount(body);
  }
}
