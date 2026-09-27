import { OrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrderStatusDto {
  /** @example PAID */
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
