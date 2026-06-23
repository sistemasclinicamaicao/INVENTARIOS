import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { BulkErpProductsDto } from './dto/bulk-erp-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { ImportCsvDto } from './dto/import-csv.dto';
import { ImportInvimaDirDto, ImportInvimaDto } from './invima/dto/import-invima.dto';
import { SearchInvimaDto } from './invima/dto/search-invima.dto';
import { InvimaService } from './invima/invima.service';
import { SearchMedicamentosPosDto } from './medicamentos-pos/dto/search-medicamentos-pos.dto';
import { MedicamentosPosService } from './medicamentos-pos/medicamentos-pos.service';
import { InvimaPmvService } from './invima-pmv/invima-pmv.service';
import { SearchInvimaPmvDto } from './invima-pmv/dto/search-invima-pmv.dto';
import { ImportService } from './import.service';
import { ProductsService } from './products.service';
import { WarehousesService } from './warehouses.service';

@ApiTags('masters')
@RequirePermissions('reception.manage')
@Controller('masters')
export class MastersController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly importService: ImportService,
    private readonly warehousesService: WarehousesService,
    private readonly invimaService: InvimaService,
    private readonly medicamentosPosService: MedicamentosPosService,
    private readonly invimaPmvService: InvimaPmvService,
  ) {}

  @Get('summary')
  getSummary() {
    return this.productsService.getSummary();
  }

  @Get('products/search')
  searchProducts(@Query() query: SearchProductsDto) {
    return this.productsService.search(query.q, query.limit, query.isFarmacia);
  }

  @Get('products')
  listProducts() {
    return this.productsService.findAll();
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Post('products/bulk-erp')
  bulkProductsFromErp(@Body() dto: BulkErpProductsDto) {
    return this.productsService.bulkUpsertFromErpLines(dto.lines, {
      isFarmacia: dto.isFarmacia ?? false,
    });
  }

  @Post('import/csv')
  importCsv(@Body() dto: ImportCsvDto) {
    if (dto.type === 'productos') {
      return this.importService.importProductsCsv(dto.content);
    }
    return this.importService.importInventoryCsv(dto.content);
  }

  @Get('warehouses')
  listWarehouses() {
    return this.warehousesService.findAll();
  }

  @Get('warehouses/:id/locations')
  listLocations(@Param('id') id: string) {
    return this.warehousesService.findLocations(id);
  }

  @Get('warehouses/:id/inventory')
  async warehouseInventory(@Param('id') id: string) {
    const data = await this.warehousesService.getInventory(id);
    if (!data) {
      return { warehouse: null, summary: { lineCount: 0, productCount: 0, totalQty: 0 }, lines: [] };
    }
    return data;
  }

  @Post('products/:id/barcodes')
  addBarcode(
    @Param('id') id: string,
    @Body() body: { barcode: string; type?: string },
  ) {
    return this.warehousesService.addBarcode(id, body.barcode, body.type);
  }

  @Get('invima/batches')
  listInvimaBatches() {
    return this.invimaService.listBatches();
  }

  @Get('invima/search')
  searchInvima(@Query() query: SearchInvimaDto) {
    return this.invimaService.search(query);
  }

  @Get('medicamentos-pos/batches')
  listMedicamentosPosBatches() {
    return this.medicamentosPosService.listBatches();
  }

  @Get('medicamentos-pos/search')
  searchMedicamentosPos(@Query() query: SearchMedicamentosPosDto) {
    return this.medicamentosPosService.search(query);
  }

  @Get('invima-pmv/batches')
  listInvimaPmvBatches() {
    return this.invimaPmvService.listBatches();
  }

  @Get('invima-pmv/search')
  searchInvimaPmv(@Query() query: SearchInvimaPmvDto) {
    return this.invimaPmvService.search(query);
  }

  @RequirePermissions('admin.users')
  @Post('invima-pmv/import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 30 * 1024 * 1024 } }),
  )
  importInvimaPmv(
    @UploadedFile() file?: { buffer: Buffer; originalname: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe adjuntar un archivo Excel (.xlsx o .xlsb)');
    }
    return this.invimaPmvService.importFromBuffer({
      buffer: file.buffer,
      filename: file.originalname || 'pmv.xlsx',
      replaceExisting: true,
    });
  }

  @RequirePermissions('admin.users')
  @Post('invima/import')
  importInvima(@Body() dto: ImportInvimaDto) {
    return this.invimaService.importFromFile({
      filePath: dto.filePath,
      listType: dto.listType,
      replaceExisting: dto.replaceExisting ?? true,
    });
  }

  @RequirePermissions('admin.users')
  @Post('invima/import-all')
  importInvimaAll(@Body() dto: ImportInvimaDirDto) {
    return this.invimaService.importAllFromDataDir(dto.dataDir);
  }
}
