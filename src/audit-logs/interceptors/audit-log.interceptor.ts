import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditAction, Prisma } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  AUDIT_LOG_KEY,
  AuditLogMetadata,
} from '../decorators/audit-log.decorator';

interface AuditableRequest {
  method: string;
  params: Record<string, string>;
  user?: AuthenticatedUser;
}

const METHOD_ACTION_MAP: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PATCH: AuditAction.UPDATE,
  PUT: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

// Fields that must never be persisted into audit_logs.before/after, even
// though "before" is fetched via a raw Prisma delegate lookup that bypasses
// service-level `omit`s. Extend this list for any other secret-bearing
// columns added in future models.
const REDACTED_FIELDS = ['passwordHash'];

function redact<T extends Record<string, unknown> | null>(value: T): T {
  if (!value) return value;
  const clone = { ...value };
  for (const field of REDACTED_FIELDS) {
    if (field in clone) delete clone[field];
  }
  return clone;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const metadata = this.reflector.getAllAndOverride<
      AuditLogMetadata | undefined
    >(AUDIT_LOG_KEY, [context.getHandler(), context.getClass()]);

    if (!metadata) {
      return next.handle();
    }

    const { entityType, idParam = 'id', whereField = 'id' } = metadata;
    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const action = metadata.action ?? METHOD_ACTION_MAP[request.method];

    if (!action) {
      return next.handle();
    }

    const delegate = (
      this.prisma as unknown as Record<
        string,
        { findUnique: (args: unknown) => Promise<unknown> }
      >
    )[entityType];

    let before: (Record<string, unknown> & { id?: string }) | null = null;
    if (action !== AuditAction.CREATE && delegate) {
      const routeId = request.params[idParam];
      before = routeId
        ? redact(
            (await delegate
              .findUnique({ where: { [whereField]: routeId } })
              .catch(() => null)) as
              | (Record<string, unknown> & {
                  id?: string;
                })
              | null,
          )
        : null;
    }

    const adminUserId = request.user?.id;

    return next.handle().pipe(
      tap((response: (Record<string, unknown> & { id?: string }) | null) => {
        const after = redact(response ?? null);
        const entityId =
          before?.id ?? after?.id ?? request.params[idParam] ?? null;

        this.prisma.auditLog
          .create({
            data: {
              adminUserId,
              action,
              entityType,
              entityId,
              before: (before ?? undefined) as
                Prisma.InputJsonValue | undefined,
              after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
            },
          })
          .catch((error: unknown) => {
            // Audit-log write failures must never break the underlying
            // request — the mutation has already succeeded by this point.
            this.logger.warn(
              `Failed to write audit log for ${entityType}:${entityId}: ${String(error)}`,
            );
          });
      }),
    );
  }
}
