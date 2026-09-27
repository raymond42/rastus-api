import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginationMeta,
  PaginatedResult,
} from '../common/types/paginated-result.interface';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';

const INVENTORY_INCLUDE = {
  variant: { include: { product: true } },
} satisfies Prisma.InventoryInclude;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryInventoryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Comparing quantity_on_hand <= reorder_threshold is a field-to-field
    // comparison Prisma's filter DSL can't express directly, so the
    // low-stock filter/pagination is applied in-memory here. Fine at
    // admin-panel/demo scale; would move to a raw SQL query if the
    // inventory table grows large.
    if (query.lowStock) {
      const all = await this.prisma.inventory.findMany({
        include: INVENTORY_INCLUDE,
        orderBy: { updatedAt: 'desc' },
      });
      const lowStockRows = all.filter(
        (row) =>
          row.reorderThreshold !== null &&
          row.quantityOnHand <= row.reorderThreshold,
      );
      const total = lowStockRows.length;
      const data = lowStockRows.slice((page - 1) * limit, page * limit);
      return { data, meta: buildPaginationMeta(page, limit, total) };
    }

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        include: INVENTORY_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventory.count(),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Adjusts stock for a variant and writes the paired InventoryTransaction
   * atomically. Pass `tx` (an interactive-transaction client) when this
   * needs to be composed as part of a larger caller-owned transaction
   * (e.g. OrdersService.create decrementing stock alongside order
   * creation) — otherwise it wraps itself in its own `$transaction`.
   */
  async adjust(
    variantId: string,
    dto: AdjustInventoryDto,
    userId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;

    const inventory = await client.inventory.findUnique({
      where: { variantId },
    });

    if (!inventory) {
      throw new NotFoundException(
        `No inventory record for variant ${variantId}`,
      );
    }

    const newQuantity = inventory.quantityOnHand + dto.changeQty;
    if (newQuantity < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    const transactionData = {
      variantId,
      changeQty: dto.changeQty,
      type: dto.type,
      reason: dto.reason,
      referenceId: dto.referenceId,
      createdBy: userId,
    };

    if (tx) {
      const updatedInventory = await tx.inventory.update({
        where: { variantId },
        data: { quantityOnHand: newQuantity },
      });
      await tx.inventoryTransaction.create({ data: transactionData });
      return updatedInventory;
    }

    const [updatedInventory] = await this.prisma.$transaction([
      this.prisma.inventory.update({
        where: { variantId },
        data: { quantityOnHand: newQuantity },
      }),
      this.prisma.inventoryTransaction.create({ data: transactionData }),
    ]);

    return updatedInventory;
  }
}
