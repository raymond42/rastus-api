import { Gender } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  /** @example T-Shirts */
  @IsString()
  @MaxLength(100)
  name: string;

  /** @example t-shirts */
  @IsString()
  @MaxLength(120)
  slug: string;

  /** @example UNISEX */
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsOptional()
  @IsString()
  parentId?: string;
}
