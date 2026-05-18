import { Router, type IRouter } from "express";
import { db, accountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateAccountBody, GetAccountParams, UpdateAccountParams, UpdateAccountBody } from "@workspace/api-zod";
import { requireAuth, requireAdminOrAccountant, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/accounts", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const accounts = await db.select().from(accountsTable).where(eq(accountsTable.userId, req.companyId!));
  res.json(accounts.map(a => ({
    ...a,
    balance: parseFloat(a.balance),
  })));
});

router.post("/accounts", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [account] = await db.insert(accountsTable).values({
    userId: req.companyId!,
    name: parsed.data.name,
    type: parsed.data.type,
    balance: String(parsed.data.balance),
    currency: parsed.data.currency ?? "XOF",
  }).returning();
  res.status(201).json({ ...account, balance: parseFloat(account.balance) });
});

router.get("/accounts/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [account] = await db.select().from(accountsTable).where(
    and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, req.companyId!))
  );
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json({ ...account, balance: parseFloat(account.balance) });
});

router.patch("/accounts/:id", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.balance !== undefined) updateData.balance = String(parsed.data.balance);
  if (parsed.data.currency !== undefined) updateData.currency = parsed.data.currency;

  const [account] = await db.update(accountsTable)
    .set(updateData)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, req.companyId!)))
    .returning();
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json({ ...account, balance: parseFloat(account.balance) });
});

export default router;
