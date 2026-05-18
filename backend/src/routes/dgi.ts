import { Router, type IRouter } from "express";
import { db, expensesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NormalizeExpenseParams, GetDgiStatusParams, UpdateDgiSettingsBody } from "@workspace/api-zod";
import { requireAuth, requireAdminOrAccountant, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function generateDgiQrCode(expenseId: number, amount: number, description: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "");
  const ref = `DGI-BJ-${timestamp}-${expenseId}`;
  return `https://emecef.bj/verify?ref=${ref}&m=${amount}&d=${encodeURIComponent(description)}`;
}

function generateDgiReference(): string {
  return `MECeF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

router.post("/dgi/normalize/:expenseId", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = NormalizeExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db.select().from(expensesTable).where(
    and(eq(expensesTable.id, params.data.expenseId), eq(expensesTable.userId, req.companyId!))
  );

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 200));

  const success = Math.random() > 0.05;

  if (success) {
    const qrCode = generateDgiQrCode(expense.id, parseFloat(expense.amount), expense.description);
    const reference = generateDgiReference();

    const [updated] = await db.update(expensesTable)
      .set({
        dgiStatus: "normalized",
        dgiQrCode: qrCode,
        dgiReference: reference,
        status: "synced",
      })
      .where(eq(expensesTable.id, expense.id))
      .returning();

    res.json({
      expenseId: expense.id,
      status: "normalized",
      qrCode: updated.dgiQrCode,
      reference: updated.dgiReference,
      normalizedAt: new Date().toISOString(),
    });
  } else {
    await db.update(expensesTable)
      .set({ dgiStatus: "failed" })
      .where(eq(expensesTable.id, expense.id));

    res.json({
      expenseId: expense.id,
      status: "failed",
      qrCode: null,
      reference: null,
      normalizedAt: null,
    });
  }
});

router.get("/dgi/status/:expenseId", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetDgiStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db.select().from(expensesTable).where(
    and(eq(expensesTable.id, params.data.expenseId), eq(expensesTable.userId, req.companyId!))
  );

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json({
    expenseId: expense.id,
    status: expense.dgiStatus,
    qrCode: expense.dgiQrCode,
    reference: expense.dgiReference,
    normalizedAt: expense.dgiStatus === "normalized" ? expense.createdAt.toISOString() : null,
  });
});

router.get("/dgi/settings", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select({
    ifu: usersTable.ifu,
    dgiToken: usersTable.dgiToken,
    dgiSecret: usersTable.dgiSecret,
    defaultCurrency: usersTable.defaultCurrency,
  }).from(usersTable).where(eq(usersTable.id, req.companyId!));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const configured = !!(user.dgiToken && user.dgiSecret);
  res.json({
    configured,
    ifu: user.ifu,
    mode: configured ? "real" : "simulation",
    defaultCurrency: user.defaultCurrency ?? "XOF",
  });
});

router.put("/dgi/settings", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpdateDgiSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.dgiToken !== undefined) updateData.dgiToken = parsed.data.dgiToken || null;
  if (parsed.data.dgiSecret !== undefined) updateData.dgiSecret = parsed.data.dgiSecret || null;
  if (parsed.data.defaultCurrency !== undefined) updateData.defaultCurrency = parsed.data.defaultCurrency;

  if (Object.keys(updateData).length > 0) {
    await db.update(usersTable).set(updateData).where(eq(usersTable.id, req.companyId!));
  }

  const [user] = await db.select({
    ifu: usersTable.ifu,
    dgiToken: usersTable.dgiToken,
    dgiSecret: usersTable.dgiSecret,
    defaultCurrency: usersTable.defaultCurrency,
  }).from(usersTable).where(eq(usersTable.id, req.companyId!));

  const configured = !!(user?.dgiToken && user?.dgiSecret);
  res.json({
    configured,
    ifu: user?.ifu ?? "",
    mode: configured ? "real" : "simulation",
    defaultCurrency: user?.defaultCurrency ?? "XOF",
  });
});

export default router;
