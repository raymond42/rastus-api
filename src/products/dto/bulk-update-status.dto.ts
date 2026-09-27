import { ProductStatus } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';

export class BulkUpdateStatusDto {
  /** @example ["00000000-0000-4000-8000-000000000000"] */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  /** @example ACTIVE */
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
