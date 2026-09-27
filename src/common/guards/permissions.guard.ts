import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

type PermissionsMap = Record<string, string[]>;

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Route did not declare @Permissions(...) — being authenticated (via the
    // global JwtAuthGuard) is enough.
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user?.roleId) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { id: user.roleId },
    });

    if (!role) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    const permissions = role.permissions as PermissionsMap;

    const hasAllPermissions = requiredPermissions.every((requirement) => {
      const [resource, action] = requirement.split(':');
      if (permissions['*']?.includes('*')) {
        return true;
      }
      const grantedActions = permissions[resource];
      return grantedActions?.includes(action) || grantedActions?.includes('*');
    });

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
