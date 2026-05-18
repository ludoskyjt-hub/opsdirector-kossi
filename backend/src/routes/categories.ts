import { Router, type IRouter } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { requireAuth, requireAdminOrAccountant, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const DEFAULT_CATEGORIES = [
  { name: "Alimentation", color: "#ef4444", sortOrder: 1 },
  { name: "Transport",    color: "#f97316", sortOrder: 2 },
  { name: "Carburant",    color: "#eab308", sortOrder: 3 },
  { name: "Bureau",       color: "#22c55e", sortOrder: 4 },
  { name: "Communication", color: "#3b82f6", sortOrder: 5 },
  { name: "Santé",        color: "#ec4899", sortOrder: 6 },
  { name: "Logement",     color: "#8b5cf6", sortOrder: 7 },
  { name: "Eau",          color: "#06b6d4", sortOrder: 8 },
  { name: "Électricité",  color: "#f59e0b", sortOrder: 9 },
  { name: "Salaire",      color: "#10b981", sortOrder: 10 },
  { name: "Matériel",     color: "#6366f1", sortOrder: 11 },
  { name: "Marketing",    color: "#f43f5e", sortOrder: 12 },
  { name: "Formation",    color: "#0ea5e9", sortOrder: 13 },
  { name: "Divers",       color: "#6b7280", sortOrder: 14 },
];

const CategoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6b7280"),
});

async function getOrSeedCategories(companyId: number) {
  const existing = await db
    .select()
    .from(categoriesTable)
    .where(and(eq(categoriesTable.companyId, companyId), eq(categoriesTable.isActive, true)))
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));

  if (existing.length > 0) return existing;

  const seeded = await db.insert(categoriesTable).values(
    DEFAULT_CATEGORIES.map(c => ({
      companyId,
      name: c.name,
      color: c.color,
      sortOrder: c.sortOrder,
      isActive: true,
      isDefault: true,
    }))
  ).returning();

  return seeded.filter(c => c.isActive);
}

router.get("/categories", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const cats = await getOrSeedCategories(req.companyId!);
  res.json(cats);
});

router.post("/categories", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CategoryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
    .from(categoriesTable)
    .where(eq(categoriesTable.companyId, req.companyId!));

  const [cat] = await db.insert(categoriesTable).values({
    companyId: req.companyId!,
    name: parsed.data.name,
    color: parsed.data.color,
    sortOrder: (maxRow?.max ?? 0) + 1,
    isActive: true,
    isDefault: false,
  }).returning();

  res.status(201).json(cat);
});

router.delete("/categories/:id", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db
    .update(categoriesTable)
    .set({ isActive: false })
    .where(and(eq(categoriesTable.id, id), eq(categoriesTable.companyId, req.companyId!)));
  res.json({ success: true });
});

router.post("/categories/reset", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  await db
    .update(categoriesTable)
    .set({ isActive: false })
    .where(eq(categoriesTable.companyId, req.companyId!));

  const seeded = await db.insert(categoriesTable).values(
    DEFAULT_CATEGORIES.map(c => ({
      companyId: req.companyId!,
      name: c.name,
      color: c.color,
      sortOrder: c.sortOrder,
      isActive: true,
      isDefault: true,
    }))
  ).returning();

  res.json(seeded);
});

export default router;
