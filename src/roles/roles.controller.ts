import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Permissions('users:read')
  @Get()
  findAll() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }
}
