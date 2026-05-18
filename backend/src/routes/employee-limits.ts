import { Router, type IRouter } from "express";
import { db, employeeLimitsTable, expensesTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth, requireAdminOrAccountant, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const LimitInputSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
  maxAmount: z.number().positive(),
});

function getPeriodFrom(period: "daily" | "weekly" | "monthly"): Date {
  const now = new Date();
  if (period === "daily") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return from;
  }
  if (period === "weekly") {
    const day = now.getDay();
    const from = new Date(now);
    from.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    from.setHours(0, 0, 0, 0);
    return from;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function enrichLimit(limit: typeof employeeLimitsTable.$inferSelect, companyId: number) {
  const from = getPeriodFrom(limit.period as "daily" | "weekly" | "monthly");
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.userId, companyId),
      eq(expensesTable.employeeId, limit.employeeId),
      gte(expensesTable.createdAt, from),
    ));
  const spent = parseFloat(row?.total ?? "0");
  const max = parseFloat(limit.maxAmount as string);
  return {
    ...limit,
    maxAmount: max,
    spent,
    percentage: max > 0 ? Math.min(100, Math.round((spent / max) * 100)) : 0,
    overLimit: spent > max,
  };
}

router.get("/employees/:employeeId/limits", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const employeeId = parseInt(req.params.employeeId as string);
  const limits = await db
    .select()
    .from(employeeLimitsTable)
    .where(and(
      eq(employeeLimitsTable.companyId, req.companyId!),
      eq(employeeLimitsTable.employeeId, employeeId),
      eq(employeeLimitsTable.isActive, true),
    ));

  res.json(await Promise.all(limits.map(l => enrichLimit(l, req.companyId!))));
});

router.post("/employees/:employeeId/limits", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const employeeId = parseInt(req.params.employeeId as string);
  const parsed = LimitInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.update(employeeLimitsTable).set({ isActive: false }).where(and(
    eq(employeeLimitsTable.companyId, req.companyId!),
    eq(employeeLimitsTable.employeeId, employeeId),
    eq(employeeLimitsTable.period, parsed.data.period as "daily" | "weekly" | "monthly"),
  ));

  const [limit] = await db.insert(employeeLimitsTable).values({
    companyId: req.companyId!,
    employeeId,
    period: parsed.data.period as "daily" | "weekly" | "monthly",
    maxAmount: String(parsed.data.maxAmount),
    isActive: true,
  }).returning();

  res.status(201).json(await enrichLimit(limit, req.companyId!));
});

router.delete("/employees/:employeeId/limits/:id", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.update(employeeLimitsTable)
    .set({ isActive: false })
    .where(and(eq(employeeLimitsTable.id, id), eq(employeeLimitsTable.companyId, req.companyId!)));
  res.json({ success: true });
});

export default router;
