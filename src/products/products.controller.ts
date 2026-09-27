import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuditLog } from '../audit-logs/decorators/audit-log.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { StorageService } from './storage.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly storageService: StorageService,
  ) {}

  @Permissions('products:read')
  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Permissions('products:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Permissions('products:create')
  @AuditLog('product')
  @Post()
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.create(dto, user.id);
  }

  // Registered before PATCH ':id' so it isn't shadowed by the :id route.
  @Permissions('products:update')
  @Patch('bulk-status')
  bulkUpdateStatus(@Body() dto: BulkUpdateStatusDto) {
    return this.productsService.bulkUpdateStatus(dto);
  }

  @Permissions('products:update')
  @AuditLog('product')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  // Per the TRD, DELETE archives the product rather than hard-deleting it.
  @Permissions('products:delete')
  @AuditLog('product')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Permissions('products:update')
  @AuditLog('productVariant')
  @Post(':id/variants')
  addVariant(
    @Param('id') productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.productsService.addVariant(productId, dto);
  }

  @Permissions('products:update')
  @AuditLog('productVariant', { idParam: 'variantId' })
  @Patch(':id/variants/:variantId')
  updateVariant(
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.productsService.updateVariant(productId, variantId, dto);
  }

  @Permissions('products:delete')
  @AuditLog('productVariant', { idParam: 'variantId' })
  @Delete(':id/variants/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVariant(
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.productsService.removeVariant(productId, variantId);
  }

  @Permissions('products:update')
  @Post(':id/images/upload-url')
  createUploadUrl(
    @Param('id') productId: string,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.storageService.createUploadUrl(productId, dto);
  }

  @Permissions('products:update')
  @AuditLog('productImage')
  @Post(':id/images')
  addImage(@Param('id') productId: string, @Body() dto: CreateProductImageDto) {
    return this.productsService.addImage(productId, dto);
  }

  @Permissions('products:update')
  @AuditLog('productImage', { idParam: 'imageId' })
  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeImage(
    @Param('id') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.removeImage(productId, imageId);
  }
}
