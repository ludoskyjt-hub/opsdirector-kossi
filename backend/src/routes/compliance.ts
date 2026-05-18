import { Router, type IRouter } from "express";
import { db, expensesTable, fraudRulesTable, employeesTable, employeeLimitsTable } from "@workspace/db";
import { eq, and, ne, gte, desc, sql, not } from "drizzle-orm";
import { requireAuth, requireAdminOrAccountant, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const CreateRuleBody = z.object({
  category: z.string().min(1),
  maxAmount: z.number().positive(),
});

const UpdateRuleBody = z.object({
  maxAmount: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export async function analyzeExpenseRisk(
  expense: { id: number; amount: number; category: string; companyId: number; employeeId?: number | null }
): Promise<{ riskLevel: "none" | "low" | "medium" | "high"; flagReason: string | null }> {
  const rules = await db
    .select()
    .from(fraudRulesTable)
    .where(
      and(
        eq(fraudRulesTable.companyId, expense.companyId),
        eq(fraudRulesTable.category, expense.category),
        eq(fraudRulesTable.isActive, true)
      )
    );

  const rule = rules[0];
  if (rule && expense.amount > parseFloat(rule.maxAmount as string)) {
    const cap = Math.round(parseFloat(rule.maxAmount as string)).toLocaleString("fr-FR");
    return {
      riskLevel: "high",
      flagReason: `Dépasse le plafond autorisé de ${cap} FCFA pour "${expense.category}"`,
    };
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [avgResult] = await db
    .select({
      avg: sql<string>`AVG(amount)`,
      cnt: sql<number>`COUNT(*)`,
    })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.userId, expense.companyId),
        eq(expensesTable.category, expense.category),
        gte(expensesTable.createdAt, ninetyDaysAgo),
        ne(expensesTable.id, expense.id)
      )
    );

  const avg = parseFloat(avgResult?.avg ?? "0");
  const cnt = Number(avgResult?.cnt ?? 0);

  if (avg > 0 && cnt >= 3) {
    const ratio = expense.amount / avg;
    const pct = Math.round((ratio - 1) * 100);
    const avgFmt = Math.round(avg).toLocaleString("fr-FR");

    if (ratio > 2.5) {
      return {
        riskLevel: "high",
        flagReason: `Montant +${pct}% au-dessus de la moyenne historique pour "${expense.category}" (moyenne: ${avgFmt} FCFA)`,
      };
    }
    if (ratio > 1.8) {
      return {
        riskLevel: "medium",
        flagReason: `Montant +${pct}% au-dessus de la moyenne pour "${expense.category}" (moyenne: ${avgFmt} FCFA)`,
      };
    }
    if (ratio > 1.4) {
      return {
        riskLevel: "low",
        flagReason: `Légèrement supérieur à la moyenne pour "${expense.category}" (+${pct}%, moyenne: ${avgFmt} FCFA)`,
      };
    }
  }

  if (expense.employeeId) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const limits = await db
      .select()
      .from(employeeLimitsTable)
      .where(and(
        eq(employeeLimitsTable.companyId, expense.companyId),
        eq(employeeLimitsTable.employeeId, expense.employeeId),
        eq(employeeLimitsTable.period, "monthly"),
        eq(employeeLimitsTable.isActive, true),
      ));

    if (limits.length > 0) {
      const cap = parseFloat(limits[0].maxAmount as string);
      const [spendRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(expensesTable)
        .where(and(
          eq(expensesTable.userId, expense.companyId),
          eq(expensesTable.employeeId, expense.employeeId),
          gte(expensesTable.createdAt, startOfMonth),
          ne(expensesTable.id, expense.id),
        ));
      const alreadySpent = parseFloat(spendRow?.total ?? "0");
      const totalAfter = alreadySpent + expense.amount;
      if (totalAfter > cap) {
        const capFmt = Math.round(cap).toLocaleString("fr-FR");
        const totalFmt = Math.round(totalAfter).toLocaleString("fr-FR");
        return {
          riskLevel: "high",
          flagReason: `Plafond mensuel de l'employé dépassé (${totalFmt} FCFA dépensés sur ${capFmt} FCFA autorisés)`,
        };
      }
    }
  }

  return { riskLevel: "none", flagReason: null };
}

router.get("/compliance/stats", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [flaggedThisMonth] = await db
    .select({ count: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.userId, req.companyId!),
        not(eq(expensesTable.riskLevel, "none")),
        gte(expensesTable.createdAt, startOfMonth)
      )
    );

  const [highRisk] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.userId, req.companyId!),
        eq(expensesTable.riskLevel, "high"),
        gte(expensesTable.createdAt, startOfMonth)
      )
    );

  const employeeRows = await db
    .select({ employeeId: expensesTable.employeeId })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.userId, req.companyId!),
        not(eq(expensesTable.riskLevel, "none")),
        gte(expensesTable.createdAt, startOfMonth)
      )
    );

  const uniqueEmployees = new Set(employeeRows.map(r => r.employeeId).filter(Boolean)).size;

  const totalFlagged = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.userId, req.companyId!),
        not(eq(expensesTable.riskLevel, "none"))
      )
    );

  res.json({
    flaggedThisMonth: Number(flaggedThisMonth?.count ?? 0),
    riskAmountThisMonth: parseFloat(flaggedThisMonth?.total ?? "0"),
    highRiskThisMonth: Number(highRisk?.count ?? 0),
    employeesWithFlags: uniqueEmployees,
    totalFlaggedAllTime: Number(totalFlagged[0]?.count ?? 0),
  });
});

router.get("/compliance/alerts", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const riskFilter = req.query.risk as string | undefined;

  const conditions = [
    eq(expensesTable.userId, req.companyId!),
    not(eq(expensesTable.riskLevel, "none")),
  ];
  if (riskFilter && ["low", "medium", "high"].includes(riskFilter)) {
    conditions.push(eq(expensesTable.riskLevel, riskFilter as "low" | "medium" | "high"));
  }

  const alerts = await db
    .select({
      id: expensesTable.id,
      description: expensesTable.description,
      amount: expensesTable.amount,
      category: expensesTable.category,
      status: expensesTable.status,
      riskLevel: expensesTable.riskLevel,
      flagReason: expensesTable.flagReason,
      submittedBy: expensesTable.submittedBy,
      createdAt: expensesTable.createdAt,
      employeeName: employeesTable.name,
    })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(and(...conditions))
    .orderBy(
      sql`CASE risk_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`,
      desc(expensesTable.createdAt)
    );

  res.json(alerts.map(a => ({ ...a, amount: parseFloat(a.amount) })));
});

router.get("/compliance/rules", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const rules = await db
    .select()
    .from(fraudRulesTable)
    .where(eq(fraudRulesTable.companyId, req.companyId!))
    .orderBy(fraudRulesTable.category);

  res.json(rules.map(r => ({ ...r, maxAmount: parseFloat(r.maxAmount as string) })));
});

router.post("/compliance/rules", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(fraudRulesTable)
    .where(
      and(
        eq(fraudRulesTable.companyId, req.companyId!),
        eq(fraudRulesTable.category, parsed.data.category)
      )
    );

  if (existing.length > 0) {
    const [updated] = await db
      .update(fraudRulesTable)
      .set({ maxAmount: String(parsed.data.maxAmount), isActive: true })
      .where(eq(fraudRulesTable.id, existing[0].id))
      .returning();
    res.json({ ...updated, maxAmount: parseFloat(updated.maxAmount as string) });
    return;
  }

  const [rule] = await db
    .insert(fraudRulesTable)
    .values({
      companyId: req.companyId!,
      category: parsed.data.category,
      maxAmount: String(parsed.data.maxAmount),
    })
    .returning();

  res.status(201).json({ ...rule, maxAmount: parseFloat(rule.maxAmount as string) });
});

router.put("/compliance/rules/:id", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const parsed = UpdateRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.maxAmount !== undefined) updates.maxAmount = String(parsed.data.maxAmount);
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [updated] = await db
    .update(fraudRulesTable)
    .set(updates)
    .where(and(eq(fraudRulesTable.id, id), eq(fraudRulesTable.companyId, req.companyId!)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  res.json({ ...updated, maxAmount: parseFloat(updated.maxAmount as string) });
});

router.delete("/compliance/rules/:id", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db
    .delete(fraudRulesTable)
    .where(and(eq(fraudRulesTable.id, id), eq(fraudRulesTable.companyId, req.companyId!)));
  res.json({ success: true });
});

router.post("/compliance/reanalyze", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const expenses = await db
    .select({ id: expensesTable.id, amount: expensesTable.amount, category: expensesTable.category })
    .from(expensesTable)
    .where(eq(expensesTable.userId, req.companyId!));

  let updated = 0;
  for (const exp of expenses) {
    const { riskLevel, flagReason } = await analyzeExpenseRisk({
      id: exp.id,
      amount: parseFloat(exp.amount as string),
      category: exp.category,
      companyId: req.companyId!,
    });
    await db
      .update(expensesTable)
      .set({ riskLevel, flagReason })
      .where(eq(expensesTable.id, exp.id));
    updated++;
  }

  res.json({ analyzed: updated });
});

export default router;
