import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProductImageDto {
  // Kept as a plain string (rather than @IsUrl()) so locally-hosted/dev
  // URLs still validate cleanly; Phase 6's signed-upload flow will always
  // produce well-formed Supabase URLs in practice.
  @IsString()
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;
}
