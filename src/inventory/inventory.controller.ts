import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuditLog } from '../audit-logs/decorators/audit-log.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { AuditAction } from '@prisma/client';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Permissions('inventory:read')
  @Get()
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAll(query);
  }

  @Permissions('inventory:update')
  @AuditLog('inventory', {
    idParam: 'variantId',
    whereField: 'variantId',
    action: AuditAction.UPDATE,
  })
  @Post(':variantId/adjust')
  adjust(
    @Param('variantId') variantId: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjust(variantId, dto, user.id);
  }
}
