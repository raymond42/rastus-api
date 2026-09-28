import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginationMeta,
  PaginatedResult,
} from '../common/types/paginated-result.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { QueryUserDto } from './dto/query-user.dto';

// Never return password_hash in API responses.
const USER_OMIT = { passwordHash: true } satisfies Prisma.UserOmit;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(query: QueryUserDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.UserWhereInput = {
      ...(query.search && {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...(query.isStaff !== undefined && { isStaff: query.isStaff }),
      ...(query.status && { status: query.status }),
      ...(query.roleId && { roleId: query.roleId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { role: true },
        omit: USER_OMIT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, orders: true },
      omit: USER_OMIT,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: dto.roleId,
        isStaff: dto.isStaff,
      },
      include: { role: true },
      omit: USER_OMIT,
    });
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string) {
    if (id === currentUserId && dto.status !== undefined) {
      throw new BadRequestException(
        'Cannot change your own account status through this endpoint',
      );
    }

    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      include: { role: true },
      omit: USER_OMIT,
    });
  }

  /**
   * Creates an inert staff account (no password) and issues a staff-invite
   * token. The account can't log in — `AuthService.validateUser` rejects
   * users with no `passwordHash` — until the invitee calls
   * `POST /auth/accept-invite`.
   */
  async invite(dto: InviteUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `A user with email ${dto.email} already exists`,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        roleId: dto.roleId,
        isStaff: true,
      },
      include: { role: true },
      omit: USER_OMIT,
    });

    await this.authService.issueStaffInviteToken(user.id, user.email);

    return user;
  }

  async updateRole(id: string, dto: UpdateUserRoleDto, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException(
        'Cannot change your own role through this endpoint',
      );
    }

    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { roleId: dto.roleId },
      include: { role: true },
      omit: USER_OMIT,
    });
  }
}
