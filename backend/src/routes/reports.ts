import { Router, type IRouter } from "express";
import { db, expensesTable, accountsTable, employeesTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc, not } from "drizzle-orm";
import { GetDailyReportQueryParams, GetCategoryBreakdownQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

router.get("/reports/dashboard", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [balanceResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(balance), 0)` })
    .from(accountsTable)
    .where(eq(accountsTable.userId, req.companyId!));

  const [todayResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(amount), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.userId, req.companyId!),
      gte(expensesTable.createdAt, today),
    ));

  const [pendingResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.userId, req.companyId!),
      eq(expensesTable.dgiStatus, "not_submitted"),
    ));

  const [approvalPendingResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.userId, req.companyId!),
      eq(expensesTable.status, "pending"),
    ));

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [highRiskResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.userId, req.companyId!),
      eq(expensesTable.riskLevel, "high"),
      gte(expensesTable.createdAt, startOfMonth),
    ));

  const recentExpenses = await db
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
      createdAt: expensesTable.createdAt,
      employeeName: employeesTable.name,
    })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(eq(expensesTable.userId, req.companyId!))
    .orderBy(desc(expensesTable.createdAt))
    .limit(10);

  const accounts = await db.select().from(accountsTable).where(eq(accountsTable.userId, req.companyId!));

  res.json({
    totalBalance: parseFloat(balanceResult?.total ?? "0"),
    todayExpenses: parseFloat(todayResult?.total ?? "0"),
    todayCount: Number(todayResult?.count ?? 0),
    pendingCount: Number(pendingResult?.count ?? 0),
    approvalPendingCount: Number(approvalPendingResult?.count ?? 0),
    highRiskCount: Number(highRiskResult?.count ?? 0),
    recentExpenses: recentExpenses.map(e => ({ ...e, amount: parseFloat(e.amount) })),
    accounts: accounts.map(a => ({ ...a, balance: parseFloat(a.balance) })),
  });
});

router.get("/reports/daily", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = GetDailyReportQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const targetDate = parsed.data.date ? new Date(parsed.data.date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

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
      createdAt: expensesTable.createdAt,
      employeeName: employeesTable.name,
    })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(and(
      eq(expensesTable.userId, req.companyId!),
      gte(expensesTable.createdAt, targetDate),
      lte(expensesTable.createdAt, nextDay),
      ...(parsed.data.accountId ? [eq(expensesTable.accountId, parsed.data.accountId)] : []),
    ))
    .orderBy(expensesTable.createdAt);

  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const [balanceResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(balance), 0)` })
    .from(accountsTable)
    .where(eq(accountsTable.userId, req.companyId!));

  res.json({
    date: targetDate.toISOString().split("T")[0],
    totalExpenses: total,
    expenseCount: expenses.length,
    remainingBalance: parseFloat(balanceResult?.total ?? "0"),
    expenses: expenses.map(e => ({ ...e, amount: parseFloat(e.amount) })),
  });
});

router.get("/reports/categories", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = GetCategoryBreakdownQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [eq(expensesTable.userId, req.companyId!)];
  if (parsed.data.from) conditions.push(gte(expensesTable.createdAt, new Date(parsed.data.from)));
  if (parsed.data.to) conditions.push(lte(expensesTable.createdAt, new Date(parsed.data.to)));

  const stats = await db
    .select({
      category: expensesTable.category,
      total: sql<string>`SUM(amount)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(expensesTable)
    .where(and(...conditions))
    .groupBy(expensesTable.category)
    .orderBy(sql`SUM(amount) DESC`);

  res.json(stats.map(s => ({
    category: s.category,
    total: parseFloat(s.total),
    count: Number(s.count),
  })));
});

router.get("/reports/monthly-trend", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const months = Math.min(parseInt((req.query.months as string) || "12"), 24);
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const [monthlyTotals, monthlyByCategory] = await Promise.all([
    db
      .select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${expensesTable.createdAt}), 'YYYY-MM')`,
        total: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, req.companyId!), gte(expensesTable.createdAt, startDate)))
      .groupBy(sql`DATE_TRUNC('month', ${expensesTable.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${expensesTable.createdAt})`),
    db
      .select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${expensesTable.createdAt}), 'YYYY-MM')`,
        category: expensesTable.category,
        total: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)`,
      })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, req.companyId!), gte(expensesTable.createdAt, startDate)))
      .groupBy(sql`DATE_TRUNC('month', ${expensesTable.createdAt})`, expensesTable.category)
      .orderBy(sql`DATE_TRUNC('month', ${expensesTable.createdAt})`),
  ]);

  const result = monthlyTotals.map(mt => ({
    month: mt.month,
    total: parseFloat(mt.total),
    count: Number(mt.count),
    byCategory: monthlyByCategory
      .filter(mc => mc.month === mt.month)
      .reduce((acc, mc) => ({ ...acc, [mc.category]: parseFloat(mc.total) }), {} as Record<string, number>),
  }));

  res.json(result);
});

router.get("/reports/pdf", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const [year, month] = monthParam.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    res.status(400).json({ error: "Invalid month parameter (expected YYYY-MM)" });
    return;
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const [userRow] = await db
    .select({ companyName: usersTable.companyName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, req.companyId!));

  const expenses = await db
    .select({
      id: expensesTable.id,
      description: expensesTable.description,
      amount: expensesTable.amount,
      category: expensesTable.category,
      status: expensesTable.status,
      dgiStatus: expensesTable.dgiStatus,
      dgiReference: expensesTable.dgiReference,
      createdAt: expensesTable.createdAt,
      employeeName: employeesTable.name,
    })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(and(
      eq(expensesTable.userId, req.companyId!),
      gte(expensesTable.createdAt, startDate),
      lte(expensesTable.createdAt, endDate),
    ))
    .orderBy(expensesTable.createdAt);

  const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const categoryTotals: Record<string, number> = {};
  expenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + parseFloat(e.amount);
  });
  const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const monthLabel = startDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const companyName = userRow?.companyName ?? "";

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const filename = `rapport-${monthParam}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header
  doc.rect(0, 0, 595, 90).fill("#0f1a2e");
  doc.fillColor("#f5c842").fontSize(22).font("Helvetica-Bold").text("BéninExpense AI", 50, 22);
  doc.fillColor("#ffffff").fontSize(12).font("Helvetica").text(`Rapport mensuel — ${monthLabel}`, 50, 50);
  doc.fillColor("#aaaaaa").fontSize(9).text(companyName, 50, 68);
  doc.fillColor("#f5c842").fontSize(11).font("Helvetica-Bold").text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 50, 38, { align: "right", width: 495 });

  let y = 110;

  // Summary box
  doc.rect(50, y, 495, 56).fill("#f7f7f7").stroke("#e5e7eb");
  doc.fillColor("#333").fontSize(10).font("Helvetica-Bold").text("SYNTHÈSE", 64, y + 8);
  doc.fillColor("#0f1a2e").fontSize(20).font("Helvetica-Bold").text(`${fmt(totalAmount)} FCFA`, 64, y + 22);
  doc.fillColor("#666").fontSize(9).font("Helvetica").text(`${expenses.length} transaction(s)`, 64, y + 46);
  y += 72;

  // Category breakdown
  if (topCategories.length > 0) {
    doc.fillColor("#333").fontSize(11).font("Helvetica-Bold").text("RÉPARTITION PAR CATÉGORIE", 50, y);
    y += 16;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 8;
    topCategories.forEach(([cat, total]) => {
      const pct = totalAmount > 0 ? Math.round((total / totalAmount) * 100) : 0;
      const barW = Math.max(4, Math.round((total / totalAmount) * 380));
      doc.rect(50, y + 3, barW, 10).fill("#16a34a");
      doc.fillColor("#111").fontSize(9).font("Helvetica").text(cat, 50, y + 15);
      doc.fillColor("#555").fontSize(9).text(`${fmt(total)} FCFA (${pct}%)`, 300, y + 15, { align: "right", width: 245 });
      y += 30;
    });
    y += 8;
  }

  // Expense table
  if (expenses.length > 0) {
    doc.fillColor("#333").fontSize(11).font("Helvetica-Bold").text("DÉTAIL DES DÉPENSES", 50, y);
    y += 16;
    const statusMap: Record<string, string> = { pending: "En attente", validated: "Validée", rejected: "Rejetée", synced: "Synch. DGI" };
    doc.fillColor("#ffffff").rect(50, y, 495, 16).fill("#0f1a2e");
    doc.fillColor("#f5c842").fontSize(7.5).font("Helvetica-Bold")
      .text("DATE", 54, y + 4)
      .text("DESCRIPTION", 104, y + 4)
      .text("CATÉGORIE", 280, y + 4)
      .text("MONTANT", 370, y + 4, { align: "right", width: 80 })
      .text("STATUT", 460, y + 4);
    y += 20;

    expenses.forEach((e, idx) => {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      const bg = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
      doc.rect(50, y, 495, 14).fill(bg);
      const dateStr = new Date(e.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      const desc = e.description.length > 35 ? e.description.slice(0, 32) + "…" : e.description;
      doc.fillColor("#111").fontSize(7.5).font("Helvetica")
        .text(dateStr, 54, y + 3)
        .text(desc, 104, y + 3, { width: 170 })
        .text(e.category, 280, y + 3, { width: 85 })
        .text(`${fmt(parseFloat(e.amount))}`, 370, y + 3, { align: "right", width: 80 })
        .text(statusMap[e.status] ?? e.status, 460, y + 3);
      y += 14;
    });
  }

  // Footer
  const fh = doc.page.height;
  doc.rect(0, fh - 40, 595, 40).fill("#f7f7f7");
  doc.fillColor("#aaaaaa").fontSize(7.5).font("Helvetica")
    .text(`BéninExpense AI — ${companyName} — Rapport ${monthLabel}`, 0, fh - 26, { align: "center", width: 595 })
    .text("Plateforme de gestion des dépenses & conformité fiscale DGI e-MECeF Bénin", 0, fh - 14, { align: "center", width: 595 });

  doc.end();
});

export default router;
