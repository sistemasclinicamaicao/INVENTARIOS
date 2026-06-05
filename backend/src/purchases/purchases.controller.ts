import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ExternalIntegrationsService } from '../integrations/external-integrations.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { WarehousesService } from '../masters/warehouses.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SuppliersService } from './suppliers.service';

@ApiTags('purchases')
@RequirePermissions('reception.manage')
@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly externalIntegrations: ExternalIntegrationsService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /** Bodegas destino OC: solo Almacén central y Farmacia central. */
  @Get('warehouses')
  listDestWarehouses() {
    return this.warehousesService.listPurchaseDestinations();
  }

  @Get('suppliers')
  listSuppliers() {
    return this.suppliersService.findAll();
  }

  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Get('orders')
  listOrders() {
    return this.purchaseOrdersService.listOpen();
  }

  /** Local primero; si no, CXC. Proveedor/bodega se resuelven desde BD. */
  @Get('orders/lookup/:number')
  async lookupOrder(@Param('number') number: string) {
    const consecutivo = number.trim();
    try {
      const local = await this.purchaseOrdersService.getByNumber(consecutivo);
      const header = await this.purchaseOrdersService.resolveOcHeader(consecutivo);
      return { found: true, source: 'local' as const, local, header };
    } catch (e) {
      if (!(e instanceof NotFoundException)) throw e;
    }

    const erp = await this.externalIntegrations.pollActivePurchaseOrder(consecutivo);
    const productCodes = Array.isArray(erp.erpLines)
      ? erp.erpLines.map((l) => String((l as { CODIGO?: string }).CODIGO ?? '')).filter(Boolean)
      : [];
    const header = await this.purchaseOrdersService.resolveOcHeader(consecutivo, {
      nit: erp.erpHeader?.nit,
      razonSocial: erp.erpHeader?.razonSocial,
      productCodes,
      warehouse: erp.erpHeader?.warehouse ?? null,
    });

    if (erp.ok && erp.erpLines?.length) {
      return { found: true, source: 'erp' as const, erp, header };
    }

    return {
      found: false,
      source: 'erp' as const,
      message:
        erp.message ??
        `Consecutivo ${consecutivo} no encontrado en el ERP (HTTP ${erp.httpStatus}). URL: ${erp.url ?? ''}`,
      erp,
      header,
    };
  }

  @Get('orders/:number')
  getOrder(@Param('number') number: string) {
    return this.purchaseOrdersService.getByNumber(number);
  }

  @Post('orders')
  createOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Patch('orders/:id')
  updateOrder(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, dto);
  }

  @Post('orders/:id/approve')
  approveOrder(@Param('id') id: string) {
    return this.purchaseOrdersService.approve(id);
  }
}
