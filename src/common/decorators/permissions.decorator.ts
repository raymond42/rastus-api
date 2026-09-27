import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the permission(s) required to access a route, expressed as
 * "resource:action" pairs (e.g. "users:create"). Checked by PermissionsGuard
 * against the JSON `permissions` field on the authenticated user's Role,
 * fetched fresh via Prisma on every request.
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
