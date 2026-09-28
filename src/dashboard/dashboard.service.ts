import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

// Orders that have actually been paid for, per the app's OrderStatus enum
// (PENDING -> PAID -> FULFILLED, or CANCELLED). Revenue is approximated by
// createdAt since there's no separate paidAt column.
const PAID_STATUSES: OrderStatus[] = [OrderStatus.PAID, OrderStatus.FULFILLED];

interface KpiValue {
  current: number;
  changePct: number | null;
}

export interface DashboardSummary {
  range: number;
  revenue: KpiValue;
  orders: KpiValue;
  avgOrderValue: KpiValue;
  lowStockCount: number;
  revenueSeries: Array<{ date: string; amount: number }>;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(range: 7 | 15 | 30): Promise<DashboardSummary> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - range * DAY_MS);
    const previousStart = new Date(now.getTime() - 2 * range * DAY_MS);

    const [orders, inventoryRows] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: previousStart, lte: now } },
        select: { totalAmount: true, status: true, createdAt: true },
      }),
      this.prisma.inventory.findMany({
        select: { quantityOnHand: true, reorderThreshold: true },
      }),
    ]);

    const currentOrders = orders.filter((o) => o.createdAt >= currentStart);
    const previousOrders = orders.filter((o) => o.createdAt < currentStart);

    const currentRevenue = sumPaidRevenue(currentOrders);
    const previousRevenue = sumPaidRevenue(previousOrders);

    const currentOrderCount = currentOrders.length;
    const previousOrderCount = previousOrders.length;

    const currentAvgOrderValue =
      currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;
    const previousAvgOrderValue =
      previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0;

    // A field-to-field comparison (quantityOnHand <= reorderThreshold) isn't
    // expressible in a Prisma `where`, and inventory rows are small in
    // number at this scale, so filter in JS.
    const lowStockCount = inventoryRows.filter(
      (row) =>
        row.reorderThreshold !== null &&
        row.quantityOnHand <= row.reorderThreshold,
    ).length;

    return {
      range,
      revenue: {
        current: currentRevenue,
        changePct: changePct(currentRevenue, previousRevenue),
      },
      orders: {
        current: currentOrderCount,
        changePct: changePct(currentOrderCount, previousOrderCount),
      },
      avgOrderValue: {
        current: round2(currentAvgOrderValue),
        changePct: changePct(currentAvgOrderValue, previousAvgOrderValue),
      },
      // Snapshot of current stock levels — not comparable to a "previous
      // period" the way the other KPIs are.
      lowStockCount,
      revenueSeries: buildRevenueSeries(currentOrders, currentStart, now),
    };
  }
}

function sumPaidRevenue(
  orders: Array<{ totalAmount: unknown; status: OrderStatus }>,
): number {
  return orders
    .filter((o) => PAID_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);
}

function changePct(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return round2(((current - previous) / previous) * 100);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildRevenueSeries(
  orders: Array<{ totalAmount: unknown; status: OrderStatus; createdAt: Date }>,
  start: Date,
  end: Date,
): Array<{ date: string; amount: number }> {
  const totalsByDay = new Map<string, number>();
  for (
    let day = new Date(start);
    day <= end;
    day = new Date(day.getTime() + DAY_MS)
  ) {
    totalsByDay.set(dayKey(day), 0);
  }

  for (const order of orders) {
    if (!PAID_STATUSES.includes(order.status)) continue;
    const key = dayKey(order.createdAt);
    totalsByDay.set(
      key,
      (totalsByDay.get(key) ?? 0) + Number(order.totalAmount),
    );
  }

  return Array.from(totalsByDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, amount]) => ({ date, amount: round2(amount) }));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
