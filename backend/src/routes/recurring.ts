import { Router, type IRouter } from "express";
import { db, recurringExpensesTable, expensesTable, accountsTable } from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import {
  CreateRecurringBody,
  GetRecurringByIdParams,
  UpdateRecurringParams,
  UpdateRecurringBody,
  DeleteRecurringParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function formatRecurring(r: typeof recurringExpensesTable.$inferSelect) {
  return {
    ...r,
    amount: parseFloat(r.amount as string),
    nextDueDate: r.nextDueDate.toISOString(),
    lastGeneratedAt: r.lastGeneratedAt ? r.lastGeneratedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

function addFrequency(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case "daily":   d.setDate(d.getDate() + 1); break;
    case "weekly":  d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "yearly":  d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

router.get("/recurring", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const rows = await db.select().from(recurringExpensesTable)
    .where(eq(recurringExpensesTable.userId, req.companyId!))
    .orderBy(recurringExpensesTable.nextDueDate);
  res.json(rows.map(formatRecurring));
});

router.post("/recurring", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateRecurringBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(recurringExpensesTable).values({
    userId: req.companyId!,
    accountId: parsed.data.accountId ?? null,
    description: parsed.data.description,
    amount: String(parsed.data.amount),
    category: parsed.data.category,
    frequency: parsed.data.frequency as "daily" | "weekly" | "monthly" | "yearly",
    nextDueDate: new Date(parsed.data.nextDueDate),
    active: parsed.data.active ?? true,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json(formatRecurring(row));
});

router.post("/recurring/generate", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const now = new Date();
  const dueRules = await db.select().from(recurringExpensesTable).where(
    and(
      eq(recurringExpensesTable.userId, req.companyId!),
      eq(recurringExpensesTable.active, true),
      lte(recurringExpensesTable.nextDueDate, now),
    )
  );

  const created: typeof expensesTable.$inferSelect[] = [];

  for (const rule of dueRules) {
    const [expense] = await db.insert(expensesTable).values({
      userId: rule.userId,
      accountId: rule.accountId ?? null,
      description: `[Récurrent] ${rule.description}`,
      amount: rule.amount,
      category: rule.category,
      notes: rule.notes,
    }).returning();

    if (rule.accountId) {
      await db.update(accountsTable)
        .set({ balance: `(SELECT balance - ${rule.amount} FROM accounts WHERE id = ${rule.accountId})` } as any)
        .where(eq(accountsTable.id, rule.accountId));
    }

    const nextDue = addFrequency(rule.nextDueDate, rule.frequency);
    await db.update(recurringExpensesTable)
      .set({ lastGeneratedAt: now, nextDueDate: nextDue })
      .where(eq(recurringExpensesTable.id, rule.id));

    created.push(expense);
  }

  res.json({
    generated: created.length,
    expenses: created.map(e => ({ ...e, amount: parseFloat(e.amount as string) })),
  });
});

router.get("/recurring/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetRecurringByIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(recurringExpensesTable).where(
    and(eq(recurringExpensesTable.id, params.data.id), eq(recurringExpensesTable.userId, req.companyId!))
  );
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(formatRecurring(row));
});

router.put("/recurring/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateRecurringParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRecurringBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
  if (parsed.data.frequency !== undefined) updateData.frequency = parsed.data.frequency;
  if (parsed.data.nextDueDate !== undefined) updateData.nextDueDate = new Date(parsed.data.nextDueDate);
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.accountId !== undefined) updateData.accountId = parsed.data.accountId;

  const [row] = await db.update(recurringExpensesTable)
    .set(updateData)
    .where(and(eq(recurringExpensesTable.id, params.data.id), eq(recurringExpensesTable.userId, req.companyId!)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(formatRecurring(row));
});

router.delete("/recurring/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteRecurringParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(recurringExpensesTable).where(
    and(eq(recurringExpensesTable.id, params.data.id), eq(recurringExpensesTable.userId, req.companyId!))
  );
  res.status(204).send();
});

export default router;
