import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

export const AUDIT_LOG_KEY = 'auditLog';

export interface AuditLogOptions {
  /** Route param holding the entity id. Defaults to 'id'. */
  idParam?: string;
  /** Prisma `where` field used to look up the "before" state. Defaults to 'id'. */
  whereField?: string;
  /**
   * Overrides the HTTP-method-based action inference (POST->CREATE,
   * PATCH/PUT->UPDATE, DELETE->DELETE). Needed for routes like
   * POST /inventory/:variantId/adjust, which is a POST but semantically
   * an UPDATE.
   */
  action?: AuditAction;
}

export interface AuditLogMetadata extends AuditLogOptions {
  /** Must match a Prisma Client delegate name, e.g. 'product', 'user'. */
  entityType: string;
}

/**
 * Marks a route for automatic before/after audit logging by
 * AuditLogInterceptor. `entityType` must match a Prisma Client delegate
 * property name (camelCase model accessor, e.g. 'productVariant').
 */
export const AuditLog = (entityType: string, options: AuditLogOptions = {}) =>
  SetMetadata(AUDIT_LOG_KEY, { entityType, ...options } as AuditLogMetadata);
