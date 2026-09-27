import { InventoryTxType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class AdjustInventoryDto {
  /**
   * Signed delta: positive for restocks/returns, negative for sales/losses.
   * @example 10
   */
  @IsInt()
  changeQty: number;

  /** @example RESTOCK */
  @IsEnum(InventoryTxType)
  type: InventoryTxType;

  /** @example "Opening stock" */
  @IsOptional()
  @IsString()
  reason?: string;

  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsOptional()
  @IsString()
  referenceId?: string;
}
