import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CustomDesignsController } from './custom-designs.controller';
import { CustomDesignsService } from './custom-designs.service';

@Module({
  imports: [InventoryModule],
  controllers: [OrdersController, CustomDesignsController],
  providers: [OrdersService, CustomDesignsService],
  exports: [OrdersService, CustomDesignsService],
})
export class OrdersModule {}
