import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// Top-level field updates only — variants and images have their own
// dedicated sub-resource endpoints.
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variants', 'images'] as const),
) {}
