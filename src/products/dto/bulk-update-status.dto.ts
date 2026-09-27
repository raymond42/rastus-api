import { ProductStatus } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';

export class BulkUpdateStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  @IsEnum(ProductStatus)
  status: ProductStatus;
}
