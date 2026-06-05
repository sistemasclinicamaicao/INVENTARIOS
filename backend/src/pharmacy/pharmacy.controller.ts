import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PharmacyService } from './pharmacy.service';

@ApiTags('pharmacy')
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @RequirePermissions('inventory.view')
  @Get('controlled-products')
  getControlledProducts() {
    return this.pharmacyService.getControlledProducts();
  }

  @RequirePermissions('pharmacy.controlled')
  @Get('controlled-log')
  getControlledLog() {
    return this.pharmacyService.getControlledLog();
  }

  @RequirePermissions('pharmacy.dispense')
  @Get('prescriptions-pending')
  getPendingPrescriptions() {
    return this.pharmacyService.getPendingPrescriptions();
  }

  @RequirePermissions('pharmacy.dispense')
  @Get('prescriptions/:id')
  getPrescription(@Param('id') id: string) {
    return this.pharmacyService.getPrescriptionDetail(id);
  }

  @RequirePermissions('pharmacy.dispense')
  @Post('dispense')
  dispense(
    @Body()
    body: {
      prescriptionId: string;
      warehouseId: string;
      validatorUserId?: string;
      notes?: string;
      lines: { productId: string; qty: number; lotId?: string }[];
    },
  ) {
    return this.pharmacyService.dispense(body);
  }
}
