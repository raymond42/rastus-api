import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderItemDto {
  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsString()
  variantId: string;

  /** @example 1 */
  @IsInt()
  @Min(1)
  quantity: number;

  /**
   * Arbitrary JSON design-your-own payload, nullable.
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { text: 'Rastus' },
  })
  @IsOptional()
  @IsObject()
  customization?: Record<string, unknown>;
}
