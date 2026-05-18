import { Router, type IRouter } from "express";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/audit", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "50"), 200);
  const offset = parseInt((req.query.offset as string) || "0");
  const action = req.query.action as string | undefined;

  const conditions = [eq(auditLogsTable.companyId, req.companyId!)];
  if (action) conditions.push(eq(auditLogsTable.action, action));

  const rows = await db
    .select({
      id: auditLogsTable.id,
      action: auditLogsTable.action,
      entityType: auditLogsTable.entityType,
      entityId: auditLogsTable.entityId,
      details: auditLogsTable.details,
      ipAddress: auditLogsTable.ipAddress,
      createdAt: auditLogsTable.createdAt,
      userEmail: usersTable.email,
      userId: auditLogsTable.userId,
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

export default router;
