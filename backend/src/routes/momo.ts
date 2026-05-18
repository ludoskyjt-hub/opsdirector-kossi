import { Router, type IRouter } from "express";
import { db, momoTransactionsTable, expensesTable, accountsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";
import { sendPushToUser } from "./push";

const router: IRouter = Router();

const PROVIDER_LABELS: Record<string, string> = {
  mtn_momo: "MTN MoMo",
  moov_money: "Moov Money",
  orange_money: "Orange Money",
};

const CATEGORY_MAP: Record<string, string> = {
  carburant: "Carburant", fuel: "Carburant", essence: "Carburant",
  taxi: "Transport", transport: "Transport", zem: "Transport",
  alimenta: "Alimentation", resto: "Alimentation", nourriture: "Alimentation",
  salaire: "Salaire", paie: "Salaire",
  eau: "Eau", electricite: "Électricité",
  pharmacie: "Santé", médecin: "Santé",
  loyer: "Logement", bail: "Logement",
};

function guessCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return cat;
  }
  return "Divers";
}

router.get("/momo/transactions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const transactions = await db
    .select()
    .from(momoTransactionsTable)
    .where(eq(momoTransactionsTable.userId, req.companyId!))
    .orderBy(desc(momoTransactionsTable.createdAt))
    .limit(50);

  res.json(transactions.map(t => ({
    ...t,
    amount: parseFloat(t.amount),
    providerLabel: PROVIDER_LABELS[t.provider] ?? t.provider,
  })));
});

// Webhook — called by MTN/Moov push (no auth required)
router.post("/momo/webhook", async (req, res): Promise<void> => {
  const schema = z.object({
    userId: z.number(),
    provider: z.enum(["mtn_momo", "moov_money", "orange_money"]),
    phone: z.string(),
    amount: z.number().positive(),
    type: z.enum(["debit", "credit"]),
    description: z.string(),
    reference: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, provider, phone, amount, type, description, reference } = parsed.data;

  const [existing] = await db.select().from(momoTransactionsTable)
    .where(eq(momoTransactionsTable.reference, reference));
  if (existing) {
    res.json({ status: "duplicate", id: existing.id });
    return;
  }

  const [tx] = await db.insert(momoTransactionsTable).values({
    userId,
    provider,
    phone,
    amount: String(amount),
    type,
    description,
    reference,
    status: "pending",
    rawPayload: JSON.stringify(req.body),
  }).returning();

  let expenseId: number | null = null;
  if (type === "debit") {
    const category = guessCategory(description);

    const [momoAccount] = await db.select().from(accountsTable)
      .where(and(
        eq(accountsTable.userId, userId),
        eq(accountsTable.type, "mobile_money")
      ));

    const [expense] = await db.insert(expensesTable).values({
      userId,
      accountId: momoAccount?.id ?? null,
      description: `[${PROVIDER_LABELS[provider]}] ${description}`,
      amount: String(amount),
      category,
      status: "pending",
      dgiStatus: "not_submitted",
      notes: `Référence MoMo: ${reference} | Téléphone: ${phone}`,
    }).returning();

    expenseId = expense.id;

    if (momoAccount) {
      const newBalance = parseFloat(momoAccount.balance) - amount;
      await db.update(accountsTable)
        .set({ balance: String(Math.max(0, newBalance)) })
        .where(eq(accountsTable.id, momoAccount.id));
    }

    await db.update(momoTransactionsTable)
      .set({ status: "processed", expenseId })
      .where(eq(momoTransactionsTable.id, tx.id));

    await sendPushToUser(userId, {
      title: `💸 AFIWA — Débit ${PROVIDER_LABELS[provider]}`,
      body: `${description} · ${amount.toLocaleString("fr-FR")} FCFA\nDépense créée automatiquement (${guessCategory(description)})`,
      icon: "/favicon.svg",
      tag: `momo-debit-${tx.id}`,
      data: { url: expenseId ? `/expenses/${expenseId}` : "/expenses" },
    });
  } else {
    const [momoAccount] = await db.select().from(accountsTable)
      .where(and(
        eq(accountsTable.userId, userId),
        eq(accountsTable.type, "mobile_money")
      ));

    if (momoAccount) {
      const newBalance = parseFloat(momoAccount.balance) + amount;
      await db.update(accountsTable)
        .set({ balance: String(newBalance) })
        .where(eq(accountsTable.id, momoAccount.id));
    }

    await db.update(momoTransactionsTable)
      .set({ status: "processed" })
      .where(eq(momoTransactionsTable.id, tx.id));

    await sendPushToUser(userId, {
      title: `✅ AFIWA — Crédit ${PROVIDER_LABELS[provider]}`,
      body: `${description} · +${amount.toLocaleString("fr-FR")} FCFA reçu sur votre compte`,
      icon: "/favicon.svg",
      tag: `momo-credit-${tx.id}`,
      data: { url: "/accounts" },
    });
  }

  res.status(201).json({ status: "ok", transactionId: tx.id, expenseId });
});

// Simulate a MoMo transaction (demo / test)
router.post("/momo/simulate", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    provider: z.enum(["mtn_momo", "moov_money", "orange_money"]).default("mtn_momo"),
    phone: z.string().default("229 97000000"),
    amount: z.number().positive(),
    type: z.enum(["debit", "credit"]).default("debit"),
    description: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const reference = `SIM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const { provider, phone, amount, type, description } = parsed.data;
  const scopeId = req.companyId!;

  const [tx] = await db.insert(momoTransactionsTable).values({
    userId: scopeId,
    provider,
    phone,
    amount: String(amount),
    type,
    description,
    reference,
    status: "pending",
    rawPayload: JSON.stringify({ ...parsed.data, userId: scopeId, reference }),
  }).returning();

  let expenseId: number | null = null;
  if (type === "debit") {
    const category = guessCategory(description);
    const [momoAccount] = await db.select().from(accountsTable)
      .where(and(eq(accountsTable.userId, scopeId), eq(accountsTable.type, "mobile_money")));

    const [expense] = await db.insert(expensesTable).values({
      userId: scopeId,
      accountId: momoAccount?.id ?? null,
      description: `[${PROVIDER_LABELS[provider]}] ${description}`,
      amount: String(amount),
      category,
      status: "pending",
      dgiStatus: "not_submitted",
      notes: `Référence MoMo: ${reference} | Téléphone: ${phone}`,
    }).returning();

    expenseId = expense.id;

    if (momoAccount) {
      const newBalance = parseFloat(momoAccount.balance) - amount;
      await db.update(accountsTable)
        .set({ balance: String(Math.max(0, newBalance)) })
        .where(eq(accountsTable.id, momoAccount.id));
    }

    await sendPushToUser(req.userId!, {
      title: `💸 AFIWA — Débit ${PROVIDER_LABELS[provider]}`,
      body: `${description} · ${amount.toLocaleString("fr-FR")} FCFA\nDépense créée automatiquement (${guessCategory(description)})`,
      icon: "/favicon.svg",
      tag: `momo-sim-${tx.id}`,
      data: { url: expenseId ? `/expenses/${expenseId}` : "/expenses" },
    });
  } else {
    const [momoAccount] = await db.select().from(accountsTable)
      .where(and(eq(accountsTable.userId, scopeId), eq(accountsTable.type, "mobile_money")));
    if (momoAccount) {
      const newBalance = parseFloat(momoAccount.balance) + amount;
      await db.update(accountsTable)
        .set({ balance: String(newBalance) })
        .where(eq(accountsTable.id, momoAccount.id));
    }

    await sendPushToUser(req.userId!, {
      title: `✅ AFIWA — Crédit ${PROVIDER_LABELS[provider]}`,
      body: `${description} · +${amount.toLocaleString("fr-FR")} FCFA reçu`,
      icon: "/favicon.svg",
      tag: `momo-sim-${tx.id}`,
      data: { url: "/accounts" },
    });
  }

  await db.update(momoTransactionsTable)
    .set({ status: "processed", expenseId })
    .where(eq(momoTransactionsTable.id, tx.id));

  res.status(201).json({
    status: "ok",
    transactionId: tx.id,
    expenseId,
    reference,
    providerLabel: PROVIDER_LABELS[provider],
  });
});

export default router;
