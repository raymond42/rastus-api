import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginationMeta,
  PaginatedResult,
} from '../common/types/paginated-result.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';

const PRODUCT_INCLUDE = {
  category: true,
  variants: { include: { inventory: true } },
  images: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProductDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = {
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.status && { status: query.status }),
      ...(query.isCustomizable !== undefined && {
        isCustomizable: query.isCustomizable,
      }),
      ...(query.gender && { category: { gender: query.gender } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  create(dto: CreateProductDto, userId?: string) {
    const { variants, images, ...fields } = dto;

    return this.prisma.product.create({
      data: {
        ...fields,
        createdBy: userId,
        variants: variants
          ? {
              create: variants.map((variant) => ({
                ...variant,
                inventory: { create: { quantityOnHand: 0 } },
              })),
            }
          : undefined,
        images: images ? { create: images } : undefined,
      },
      include: PRODUCT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: PRODUCT_INCLUDE,
    });
  }

  /** Per the TRD, DELETE means archive — never a hard delete. */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
      include: PRODUCT_INCLUDE,
    });
  }

  async bulkUpdateStatus(dto: BulkUpdateStatusDto) {
    const result = await this.prisma.product.updateMany({
      where: { id: { in: dto.ids } },
      data: { status: dto.status },
    });
    return { updatedCount: result.count };
  }

  async addVariant(productId: string, dto: CreateProductVariantDto) {
    await this.findOne(productId);
    return this.prisma.productVariant.create({
      data: {
        ...dto,
        productId,
        inventory: { create: { quantityOnHand: 0 } },
      },
      include: { inventory: true },
    });
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
  ) {
    await this.findVariantOrThrow(productId, variantId);
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: dto,
      include: { inventory: true },
    });
  }

  async removeVariant(productId: string, variantId: string) {
    await this.findVariantOrThrow(productId, variantId);
    await this.prisma.productVariant.delete({ where: { id: variantId } });
  }

  async addImage(productId: string, dto: CreateProductImageDto) {
    await this.findOne(productId);
    return this.prisma.productImage.create({
      data: { ...dto, productId },
    });
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });
    if (!image || image.productId !== productId) {
      throw new NotFoundException(
        `Image ${imageId} not found on product ${productId}`,
      );
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });
  }

  private async findVariantOrThrow(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant || variant.productId !== productId) {
      throw new NotFoundException(
        `Variant ${variantId} not found on product ${productId}`,
      );
    }
    return variant;
  }
}
