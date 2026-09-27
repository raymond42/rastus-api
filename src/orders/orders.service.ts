import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  buildPaginationMeta,
  PaginatedResult,
} from '../common/types/paginated-result.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrderDto } from './dto/query-order.dto';

const ORDER_INCLUDE = {
  items: true,
  user: { omit: { passwordHash: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(query: QueryOrderDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.userId && { userId: query.userId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  create(dto: CreateOrderDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      let totalAmount = new Prisma.Decimal(0);
      const itemsData: Array<{
        variantId: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        customization?: Prisma.InputJsonValue;
      }> = [];

      for (const item of dto.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true },
        });

        if (!variant) {
          throw new NotFoundException(
            `Product variant ${item.variantId} not found`,
          );
        }

        const unitPrice = variant.priceOverride ?? variant.product.basePrice;
        totalAmount = totalAmount.add(unitPrice.mul(item.quantity));

        itemsData.push({
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice,
          customization: item.customization as
            Prisma.InputJsonValue | undefined,
        });
      }

      const order = await tx.order.create({
        data: {
          userId: dto.userId,
          status: OrderStatus.PENDING,
          totalAmount,
          currency: dto.currency,
          shippingAddress: dto.shippingAddress as Prisma.InputJsonValue,
          items: { create: itemsData },
        },
        include: ORDER_INCLUDE,
      });

      // Decrement stock atomically alongside order creation — insufficient
      // stock throws and rolls back the whole order (deferred from Phase 3).
      for (const item of itemsData) {
        await this.inventoryService.adjust(
          item.variantId,
          {
            changeQty: -item.quantity,
            type: 'SALE',
            referenceId: order.id,
            reason: 'Order placement',
          },
          userId,
          tx,
        );
      }

      return order;
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    await this.findOne(id);
    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: ORDER_INCLUDE,
    });
  }
}
