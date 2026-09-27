import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { city: 'Kigali', line1: 'KG 1' },
  })
  @IsOptional()
  @IsObject()
  shippingAddress?: Record<string, unknown>;

  /** @example RWF */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  // totalAmount is never accepted from the client — always computed
  // server-side from variant/product pricing.
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
