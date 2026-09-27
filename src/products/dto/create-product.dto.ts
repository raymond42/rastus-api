import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProductVariantDto } from './create-product-variant.dto';
import { CreateProductImageDto } from './create-product-image.dto';

export class CreateProductDto {
  /** @example "Classic Tee" */
  @IsString()
  @MaxLength(200)
  name: string;

  /** @example classic-tee */
  @IsString()
  @MaxLength(220)
  slug: string;

  /** @example "Soft cotton t-shirt" */
  @IsOptional()
  @IsString()
  description?: string;

  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsOptional()
  @IsString()
  categoryId?: string;

  /** @example 15000 */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice: number;

  /** @example RWF */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  /** @example false */
  @IsOptional()
  @IsBoolean()
  isCustomizable?: boolean;

  /** @example DRAFT */
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images?: CreateProductImageDto[];
}
