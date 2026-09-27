import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductVariantDto {
  /** @example TEE-BLK-M */
  @IsString()
  @MaxLength(60)
  sku: string;

  /** @example M */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  /** @example Black */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  /** @example 16000 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceOverride?: number;
}
