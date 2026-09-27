import { InventoryTxType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class AdjustInventoryDto {
  // Signed delta: positive for restocks/returns, negative for sales/losses.
  @IsInt()
  changeQty: number;

  @IsEnum(InventoryTxType)
  type: InventoryTxType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
