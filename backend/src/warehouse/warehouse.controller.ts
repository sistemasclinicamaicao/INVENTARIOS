import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { WarehouseService } from './warehouse.service';

@ApiTags('warehouse')
@RequirePermissions('inventory.view')
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('satellites')
  getSatellites() {
    return this.warehouseService.getSatellites();
  }
}
