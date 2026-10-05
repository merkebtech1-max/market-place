import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { ListAuditLogsDto } from '../dto/list-audit-logs.dto.js';

/** Actor of an audit action — null for system-generated entries. */
export interface AuditLogActor {
  id: string;
  displayName: string | null;
  role: UserRole;
}

/** Admin view of one audit-log row. No target-object hydration — the log is the record. */
export interface AuditLogEntry {
  id: string;
  action: string;
  target: string;
  diff: unknown;
  createdAt: Date;
  actor: AuditLogActor | null;
}

export interface AdminAuditLogsPage {
  data: AuditLogEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class AdminAuditLogsService {
  private readonly logger = new Logger(AdminAuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(query: ListAuditLogsDto): Promise<AdminAuditLogsPage> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    this.logger.log(
      `[START] Listing audit logs: action=${query.action ?? 'any'}, target=${query.target ?? 'any'}, actorId=${query.actorId ?? 'any'}, from=${query.from ?? 'any'}, to=${query.to ?? 'any'}, sort=${query.sort ?? 'NEWEST'}, page=${page}, limit=${limit}`,
    );

    // from/to are already validated as ISO datetimes by the DTO — parse
    // them into real Date values so Prisma does datetime comparison.
    const createdAt =
      query.from || query.to
        ? { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) }
        : undefined;

    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.target ? { target: query.target } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    // Deterministic ordering: createdAt plus an id tiebreaker so pages
    // don't overlap when rows share a timestamp.
    const orderBy =
      query.sort === 'OLDEST'
        ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          target: true,
          diff: true,
          createdAt: true,
          actor: { select: { id: true, displayName: true, role: true } },
        },
      }),
    ]);

    const data: AuditLogEntry[] = rows.map((row) => ({
      id: row.id,
      action: row.action,
      target: row.target,
      diff: row.diff,
      createdAt: row.createdAt,
      actor: row.actor,
    }));

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`[SUCCESS] Listed ${data.length} audit log(s), total=${total}`);

    return { data, pagination: { page, limit, total, totalPages } };
  }
}
