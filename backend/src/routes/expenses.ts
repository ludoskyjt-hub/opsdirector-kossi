import { Router, type IRouter } from "express";
import { db, expensesTable, accountsTable, employeesTable, usersTable } from "@workspace/db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { analyzeExpenseRisk } from "./compliance";
import {
  CreateExpenseBody,
  GetExpenseParams,
  UpdateExpenseParams,
  UpdateExpenseBody,
  DeleteExpenseParams,
  ValidateExpenseParams,
  GetExpensesQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdminOrAccountant, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";
import { logAudit } from "../lib/audit";
import { sendEmail, buildExpenseValidatedEmail } from "../lib/email";

const router: IRouter = Router();

function formatExpense(e: Record<string, unknown>, employeeName?: string | null) {
  return {
    ...e,
    amount: parseFloat(e.amount as string),
    employeeName: employeeName ?? null,
  };
}

// GET /expenses — list
router.get("/expenses", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = GetExpensesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const expenses = await db
    .select({
      id: expensesTable.id,
      userId: expensesTable.userId,
      accountId: expensesTable.accountId,
      employeeId: expensesTable.employeeId,
      description: expensesTable.description,
      amount: expensesTable.amount,
      category: expensesTable.category,
      status: expensesTable.status,
      dgiStatus: expensesTable.dgiStatus,
      dgiQrCode: expensesTable.dgiQrCode,
      dgiReference: expensesTable.dgiReference,
      receiptUrl: expensesTable.receiptUrl,
      notes: expensesTable.notes,
      submittedBy: expensesTable.submittedBy,
      rejectionReason: expensesTable.rejectionReason,
      createdAt: expensesTable.createdAt,
      employeeName: employeesTable.name,
    })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(and(
      eq(expensesTable.userId, req.companyId!),
      parsed.data.status ? eq(expensesTable.status, parsed.data.status) : undefined,
      parsed.data.category ? eq(expensesTable.category, parsed.data.category) : undefined,
    ))
    .orderBy(desc(expensesTable.createdAt));

  res.json(expenses.map(e => ({ ...e, amount: parseFloat(e.amount) })));
});

// POST /expenses — create
router.post("/expenses", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [expense] = await db.insert(expensesTable).values({
    userId: req.companyId!,
    submittedBy: req.userId!,
    accountId: parsed.data.accountId ?? null,
    description: parsed.data.description,
    amount: String(parsed.data.amount),
    category: parsed.data.category,
    notes: parsed.data.notes ?? null,
    receiptUrl: parsed.data.receiptUrl ?? null,
    status: "pending",
    dgiStatus: "not_submitted",
  }).returning();

  if (expense.accountId) {
    await db.execute(
      sql`UPDATE accounts SET balance = balance - ${parsed.data.amount} WHERE id = ${expense.accountId} AND user_id = ${req.companyId}`
    );
  }

  const { riskLevel, flagReason } = await analyzeExpenseRisk({
    id: expense.id,
    amount: parsed.data.amount,
    category: parsed.data.category,
    companyId: req.companyId!,
    employeeId: parsed.data.employeeId ?? null,
  });

  if (riskLevel !== "none") {
    await db.update(expensesTable).set({ riskLevel, flagReason }).where(eq(expensesTable.id, expense.id));
    expense.riskLevel = riskLevel;
    expense.flagReason = flagReason;
  }

  void logAudit({ companyId: req.companyId!, userId: req.userId!, action: "expense.create", entityType: "expense", entityId: expense.id, details: { amount: parsed.data.amount, description: parsed.data.description, category: parsed.data.category } });
  res.status(201).json(formatExpense(expense as unknown as Record<string, unknown>));
});

// GET /expenses/export — CSV (must be BEFORE /:id)
router.get("/expenses/export", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { status, category, from, to } = req.query as Record<string, string | undefined>;

  const rows = await db
    .select({
      id: expensesTable.id,
      description: expensesTable.description,
      amount: expensesTable.amount,
      category: expensesTable.category,
      status: expensesTable.status,
      dgiStatus: expensesTable.dgiStatus,
      dgiReference: expensesTable.dgiReference,
      rejectionReason: expensesTable.rejectionReason,
      notes: expensesTable.notes,
      createdAt: expensesTable.createdAt,
      employeeName: employeesTable.name,
    })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(and(
      eq(expensesTable.userId, req.companyId!),
      status ? eq(expensesTable.status, status as "pending" | "validated" | "rejected" | "synced") : undefined,
      category ? eq(expensesTable.category, category) : undefined,
      from ? gte(expensesTable.createdAt, new Date(from)) : undefined,
      to ? lte(expensesTable.createdAt, new Date(to + "T23:59:59")) : undefined,
    ))
    .orderBy(desc(expensesTable.createdAt));

  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = "ID,Date,Description,Montant,Categorie,Statut,Statut DGI,Reference DGI,Employe,Notes,Motif Rejet";
  const lines = rows.map(r =>
    [r.id, new Date(r.createdAt).toISOString().slice(0, 10), escape(r.description), parseFloat(r.amount),
      escape(r.category), r.status, r.dgiStatus, escape(r.dgiReference), escape(r.employeeName),
      escape(r.notes), escape(r.rejectionReason)].join(",")
  );

  const csv = [header, ...lines].join("\n");
  const filename = `depenses-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csv);
});

// GET /expenses/:id — single
router.get("/expenses/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db
    .select({
      id: expensesTable.id,
      userId: expensesTable.userId,
      accountId: expensesTable.accountId,
      employeeId: expensesTable.employeeId,
      description: expensesTable.description,
      amount: expensesTable.amount,
      category: expensesTable.category,
      status: expensesTable.status,
      dgiStatus: expensesTable.dgiStatus,
      dgiQrCode: expensesTable.dgiQrCode,
      dgiReference: expensesTable.dgiReference,
      receiptUrl: expensesTable.receiptUrl,
      notes: expensesTable.notes,
      submittedBy: expensesTable.submittedBy,
      rejectionReason: expensesTable.rejectionReason,
      createdAt: expensesTable.createdAt,
      employeeName: employeesTable.name,
    })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, req.companyId!)));

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json({ ...expense, amount: parseFloat(expense.amount) });
});

// PATCH /expenses/:id — update
router.patch("/expenses/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  const [expense] = await db.update(expensesTable)
    .set(updateData)
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, req.companyId!)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(formatExpense(expense as unknown as Record<string, unknown>));
});

// DELETE /expenses/:id
router.delete("/expenses/:id", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db.delete(expensesTable)
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, req.companyId!)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  void logAudit({ companyId: req.companyId!, userId: req.userId!, action: "expense.delete", entityType: "expense", entityId: expense.id, details: { description: expense.description } });
  res.sendStatus(204);
});

// POST /expenses/:id/validate — approve
router.post("/expenses/:id/validate", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = ValidateExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db.update(expensesTable)
    .set({ status: "validated" })
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, req.companyId!)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  void logAudit({ companyId: req.companyId!, userId: req.userId!, action: "expense.validate", entityType: "expense", entityId: expense.id, details: { amount: String(expense.amount), description: expense.description } });
  const [companyRow] = await db.select({ email: usersTable.email, companyName: usersTable.companyName, emailNotificationsEnabled: usersTable.emailNotificationsEnabled }).from(usersTable).where(eq(usersTable.id, req.companyId!));
  if (companyRow?.emailNotificationsEnabled) {
    void sendEmail({ to: companyRow.email, subject: "✅ Dépense validée — BéninExpense AI", html: buildExpenseValidatedEmail({ companyName: companyRow.companyName, description: expense.description, amount: parseFloat(String(expense.amount)), status: "validated" }) });
  }

  res.json(formatExpense(expense as unknown as Record<string, unknown>));
});

// POST /expenses/:id/reject — reject with optional reason
router.post("/expenses/:id/reject", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const schema = z.object({ reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [expense] = await db.update(expensesTable)
    .set({ status: "rejected", rejectionReason: parsed.data.reason ?? null })
    .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, req.companyId!)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  void logAudit({ companyId: req.companyId!, userId: req.userId!, action: "expense.reject", entityType: "expense", entityId: expense.id, details: { amount: String(expense.amount), description: expense.description, reason: parsed.data.reason } });
  const [companyRowR] = await db.select({ email: usersTable.email, companyName: usersTable.companyName, emailNotificationsEnabled: usersTable.emailNotificationsEnabled }).from(usersTable).where(eq(usersTable.id, req.companyId!));
  if (companyRowR?.emailNotificationsEnabled) {
    void sendEmail({ to: companyRowR.email, subject: "❌ Dépense rejetée — BéninExpense AI", html: buildExpenseValidatedEmail({ companyName: companyRowR.companyName, description: expense.description, amount: parseFloat(String(expense.amount)), status: "rejected", rejectionReason: parsed.data.reason }) });
  }

  res.json(formatExpense(expense as unknown as Record<string, unknown>));
});

// GET /expenses/:id/pdf — download PDF receipt
router.get("/expenses/:id/pdf", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const results = await db
    .select({
      id: expensesTable.id,
      description: expensesTable.description,
      amount: expensesTable.amount,
      category: expensesTable.category,
      status: expensesTable.status,
      dgiStatus: expensesTable.dgiStatus,
      dgiReference: expensesTable.dgiReference,
      notes: expensesTable.notes,
      rejectionReason: expensesTable.rejectionReason,
      createdAt: expensesTable.createdAt,
      employeeName: employeesTable.name,
      accountName: accountsTable.name,
    })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .leftJoin(accountsTable, eq(expensesTable.accountId, accountsTable.id))
    .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, req.companyId!)));

  const expense = results[0];
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  const [userRow] = await db.select({ companyName: usersTable.companyName })
    .from(usersTable).where(eq(usersTable.id, req.companyId!));

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="recu-depense-${expense.id}.pdf"`);
  doc.pipe(res);

  doc.rect(0, 0, 595, 90).fill("#0f1a2e");
  doc.fillColor("#f5c842").fontSize(22).font("Helvetica-Bold").text("BéninExpense AI", 50, 22);
  doc.fillColor("#ffffff").fontSize(11).font("Helvetica").text("Reçu de dépense", 50, 48);
  doc.fillColor("#aaaaaa").fontSize(9).text(userRow?.companyName ?? "", 50, 63);
  doc.fillColor("#f5c842").fontSize(14).font("Helvetica-Bold").text(`N° ${expense.id}`, 50, 32, { align: "right", width: 495 });

  let y = 115;
  const addField = (label: string, value: string) => {
    doc.fillColor("#777777").fontSize(8).font("Helvetica").text(label.toUpperCase(), 50, y);
    doc.fillColor("#111111").fontSize(12).font("Helvetica").text(value || "—", 50, y + 13, { width: 495 });
    const extraLines = Math.floor(value.length / 80);
    y += 26 + extraLines * 14 + 6;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e5e5").lineWidth(0.5).stroke();
    y += 12;
  };

  addField("Description", expense.description);
  addField("Montant", `${parseFloat(expense.amount).toLocaleString("fr-FR")} FCFA`);
  addField("Catégorie", expense.category);
  addField("Date", new Date(expense.createdAt).toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  }));

  const statusMap: Record<string, string> = {
    pending: "En attente de validation", validated: "Validée", rejected: "Rejetée", synced: "Synchronisée DGI",
  };
  addField("Statut", statusMap[expense.status] ?? expense.status);
  if (expense.dgiReference) addField("Référence MECeF (DGI)", expense.dgiReference);
  if (expense.employeeName) addField("Employé", expense.employeeName);
  if (expense.accountName) addField("Compte débité", expense.accountName);
  if (expense.notes) addField("Notes", expense.notes);
  if (expense.rejectionReason) addField("Motif de rejet", expense.rejectionReason);

  const fh = doc.page.height;
  doc.rect(0, fh - 55, 595, 55).fill("#f7f7f7");
  doc.fillColor("#aaaaaa").fontSize(8).font("Helvetica")
    .text(`Document généré par BéninExpense AI — ${new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}`,
      0, fh - 38, { align: "center", width: 595 })
    .text("Plateforme de gestion des dépenses et conformité fiscale · DGI e-MECeF Bénin",
      0, fh - 24, { align: "center", width: 595 });

  doc.end();
});

export default router;
