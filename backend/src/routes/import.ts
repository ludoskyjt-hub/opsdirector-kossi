import { Router, type IRouter } from "express";
import multer from "multer";
import { db, expensesTable, accountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const CATEGORIES = ["food", "transport", "accommodation", "office", "telecom", "salary", "tax", "utilities", "marketing", "other"];

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));

  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").replace(/"/g, "").trim(); });
    return row;
  });
}

function normalizeCategory(raw: string): string {
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  const match = CATEGORIES.find(c => c === lower || lower.includes(c));
  return match ?? "other";
}

function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return new Date().toISOString();
}

const ConfirmImportBody = z.object({
  rows: z.array(z.object({
    description: z.string().min(1),
    amount: z.number().positive(),
    category: z.string(),
    date: z.string(),
    notes: z.string().optional(),
  })),
  accountId: z.number().int().positive(),
});

// POST /import/preview — parse uploaded CSV
router.post("/import/preview", requireAuth, upload.single("file"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Aucun fichier fourni" });
    return;
  }

  const content = req.file.buffer.toString("utf-8");
  const raw = parseCSV(content);

  if (raw.length === 0) {
    res.status(400).json({ error: "Fichier vide ou format invalide" });
    return;
  }

  const rows = raw
    .filter(r => r.description && r.amount)
    .map((r, i) => {
      const amount = parseFloat(r.amount?.replace(/[^\d.,]/g, "").replace(",", "."));
      if (isNaN(amount) || amount <= 0) return null;
      return {
        index: i,
        description: r.description ?? r.libelle ?? r.label ?? "",
        amount,
        category: normalizeCategory(r.category ?? r.categorie ?? ""),
        date: normalizeDate(r.date ?? r.dat ?? ""),
        notes: r.notes ?? r.note ?? r.commentaire ?? "",
        valid: true,
      };
    })
    .filter(Boolean);

  const skipped = raw.length - rows.length;

  res.json({ rows, total: raw.length, valid: rows.length, skipped });
});

// POST /import/confirm — create expenses from confirmed rows
router.post("/import/confirm", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ConfirmImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const companyId = req.companyId ?? userId;
  const { rows, accountId } = parsed.data;

  const account = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, accountId), eq(accountsTable.userId, userId)))
    .limit(1);

  if (!account.length) {
    res.status(400).json({ error: "Compte introuvable" });
    return;
  }

  const inserted = await db.insert(expensesTable).values(
    rows.map(r => ({
      userId,
      accountId,
      description: r.description,
      amount: String(r.amount),
      category: r.category,
      status: "pending" as const,
      dgiStatus: "pending" as const,
      notes: r.notes ?? null,
      createdAt: new Date(r.date),
    }))
  ).returning();

  await logAudit({ companyId, userId, action: "import_expenses", entityType: "expense", details: { count: inserted.length } });

  res.json({ imported: inserted.length, expenses: inserted });
});

export default router;
