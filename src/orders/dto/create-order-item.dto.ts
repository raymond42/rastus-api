import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  variantId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  // Arbitrary JSON design-your-own payload, nullable.
  @IsOptional()
  @IsObject()
  customization?: Record<string, unknown>;
}
