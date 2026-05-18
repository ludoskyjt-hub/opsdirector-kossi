import { Router, type IRouter } from "express";
import { db, budgetsTable, expensesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireAdminOrAccountant, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const BudgetInputSchema = z.object({
  category: z.string().min(1),
  amount: z.number().positive(),
  period: z.enum(["monthly", "yearly"]).default("monthly"),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12).optional(),
});

async function enrichBudgets(budgets: typeof budgetsTable.$inferSelect[], companyId: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return Promise.all(budgets.map(async (budget) => {
    const year = budget.year ?? currentYear;
    const month = budget.month;

    let fromDate: Date;
    let toDate: Date;

    if (budget.period === "monthly" && month) {
      fromDate = new Date(year, month - 1, 1);
      toDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      fromDate = new Date(year, 0, 1);
      toDate = new Date(year, 11, 31, 23, 59, 59);
    }

    const isCurrent = budget.period === "monthly"
      ? (year === currentYear && month === currentMonth)
      : (year === currentYear);

    const [spendingRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(expensesTable)
      .where(and(
        eq(expensesTable.userId, companyId),
        eq(expensesTable.category, budget.category),
        gte(expensesTable.createdAt, fromDate),
        lte(expensesTable.createdAt, toDate),
      ));

    const spent = parseFloat(spendingRow?.total ?? "0");
    const limit = parseFloat(budget.amount);
    const percentage = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

    return {
      ...budget,
      amount: limit,
      spent,
      remaining: Math.max(0, limit - spent),
      percentage,
      overBudget: spent > limit,
      isCurrent,
    };
  }));
}

// GET /budgets — list with spending
router.get("/budgets", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const budgets = await db.select().from(budgetsTable)
    .where(eq(budgetsTable.companyId, req.companyId!))
    .orderBy(budgetsTable.year, budgetsTable.month, budgetsTable.category);

  const enriched = await enrichBudgets(budgets, req.companyId!);
  res.json(enriched);
});

// POST /budgets — create
router.post("/budgets", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = BudgetInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, amount, period, year, month } = parsed.data;

  // Check for duplicate
  const [existing] = await db.select().from(budgetsTable).where(
    and(
      eq(budgetsTable.companyId, req.companyId!),
      eq(budgetsTable.category, category),
      eq(budgetsTable.period, period),
      eq(budgetsTable.year, year),
      month ? eq(budgetsTable.month, month) : sql`month IS NULL`,
    )
  );

  if (existing) {
    res.status(400).json({ error: "Un budget pour cette catégorie et période existe déjà" });
    return;
  }

  const [budget] = await db.insert(budgetsTable).values({
    companyId: req.companyId!,
    category,
    amount: String(amount),
    period,
    year,
    month: month ?? null,
  }).returning();

  const [enriched] = await enrichBudgets([budget], req.companyId!);
  res.status(201).json(enriched);
});

// PATCH /budgets/:id — update amount
router.patch("/budgets/:id", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const schema = z.object({ amount: z.number().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [budget] = await db.update(budgetsTable)
    .set({ amount: String(parsed.data.amount) })
    .where(and(eq(budgetsTable.id, id), eq(budgetsTable.companyId, req.companyId!)))
    .returning();

  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }

  const [enriched] = await enrichBudgets([budget], req.companyId!);
  res.json(enriched);
});

// DELETE /budgets/:id
router.delete("/budgets/:id", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [budget] = await db.delete(budgetsTable)
    .where(and(eq(budgetsTable.id, id), eq(budgetsTable.companyId, req.companyId!)))
    .returning();

  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
