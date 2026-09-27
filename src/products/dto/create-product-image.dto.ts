import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProductImageDto {
  /**
   * Kept as a plain string (rather than @IsUrl()) so locally-hosted/dev
   * URLs still validate cleanly; Phase 6's signed-upload flow will always
   * produce well-formed Supabase URLs in practice.
   * @example https://example.supabase.co/storage/v1/object/public/product-images/tee.jpg
   */
  @IsString()
  @MaxLength(2048)
  url: string;

  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsOptional()
  @IsString()
  variantId?: string;

  /** @example 0 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  /** @example "Front view" */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;
}
