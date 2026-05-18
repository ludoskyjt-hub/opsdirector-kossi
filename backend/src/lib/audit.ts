import { db as defaultDb, auditLogsTable } from "@workspace/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export interface AuditParams {
  companyId: number;
  userId?: number | null;
  action: string;
  entityType?: string;
  entityId?: number | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(params: AuditParams, dbInstance?: NodePgDatabase<Record<string, never>>): Promise<void> {
  const dbToUse = (dbInstance ?? defaultDb) as typeof defaultDb;
  try {
    await dbToUse.insert(auditLogsTable).values({
      companyId: params.companyId,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch {
    // audit failures should never break the main flow
  }
}
