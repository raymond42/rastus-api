import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_BYTES = 5_242_880;

export class CreateUploadUrlDto {
  /** @example tee.jpg */
  @IsString()
  @MaxLength(200)
  fileName: string;

  /** @example image/jpeg */
  @IsIn(ALLOWED_IMAGE_TYPES)
  contentType: (typeof ALLOWED_IMAGE_TYPES)[number];

  /** @example 1000 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_IMAGE_BYTES)
  sizeBytes: number;
}
