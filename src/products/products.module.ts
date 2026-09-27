import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, StorageService],
  exports: [ProductsService],
})
export class ProductsModule {}
