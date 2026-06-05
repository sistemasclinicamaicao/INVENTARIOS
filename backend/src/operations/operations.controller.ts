import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { OperationsService } from './operations.service';

@ApiTags('operations')
@RequirePermissions('picking.manage')
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('requisitions')
  list(@Query('status') status?: string) {
    return this.operationsService.listRequisitions(status);
  }

  @Get('requisitions/next-number')
  nextNumber() {
    return this.operationsService.previewNextNumber();
  }

  @Get('requisitions/:number')
  getOne(@Param('number') number: string) {
    return this.operationsService.getByNumber(number);
  }

  @Post('requisitions')
  create(@Body() dto: CreateRequisitionDto) {
    return this.operationsService.create(dto);
  }
}
