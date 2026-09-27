import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginationMeta,
  PaginatedResult,
} from '../common/types/paginated-result.interface';
import { QueryCustomDesignDto } from './dto/query-custom-design.dto';

const CUSTOM_DESIGN_INCLUDE = {
  user: { omit: { passwordHash: true } },
  baseProduct: true,
} satisfies Prisma.CustomDesignInclude;

// Read-only in this phase — no phase in the 6-phase plan specifies who
// submits designs or transitions their review status (reviewed/quoted/
// rejected); flagging that as a possible future addition.
@Injectable()
export class CustomDesignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryCustomDesignDto,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.CustomDesignWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.userId && { userId: query.userId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.customDesign.findMany({
        where,
        include: CUSTOM_DESIGN_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customDesign.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const design = await this.prisma.customDesign.findUnique({
      where: { id },
      include: CUSTOM_DESIGN_INCLUDE,
    });

    if (!design) {
      throw new NotFoundException(`Custom design ${id} not found`);
    }

    return design;
  }
}
