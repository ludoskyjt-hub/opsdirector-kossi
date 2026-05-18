import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, boutikoUsersTable, boutikoBoutiquesTable, boutikoProductsTable, boutikoClientsTable, boutikoSalesTable, boutikoSaleItemsTable } from "@workspace/db";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const router: IRouter = Router();

function makeToken(userId: number) { return `${userId}:${Date.now()}`; }

interface BoutikoReq extends Request { boutikoUserId?: number; boutique?: { id: number } | null; }

async function boutikoAuth(req: BoutikoReq, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const token = auth.slice(7);
  const parts = token.split(":");
  if (parts.length < 2) { res.status(401).json({ error: "Invalid token" }); return; }
  const userId = parseInt(parts[0]);
  if (isNaN(userId)) { res.status(401).json({ error: "Invalid token" }); return; }
  const [user] = await db.select().from(boutikoUsersTable).where(eq(boutikoUsersTable.id, userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  req.boutikoUserId = userId;
  const [boutique] = await db.select().from(boutikoBoutiquesTable).where(eq(boutikoBoutiquesTable.userId, userId));
  req.boutique = boutique ?? null;
  next();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

router.post("/boutiko/auth/register", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { email, password, name } = parsed.data;
  const [existing] = await db.select().from(boutikoUsersTable).where(eq(boutikoUsersTable.email, email));
  if (existing) { res.status(400).json({ error: "Email déjà utilisé" }); return; }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(boutikoUsersTable).values({ email, passwordHash, name }).returning();
  res.status(201).json({ token: makeToken(user.id), user: { id: user.id, email: user.email, name: user.name, phone: user.phone, createdAt: user.createdAt } });
});

router.post("/boutiko/auth/login", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(boutikoUsersTable).where(eq(boutikoUsersTable.email, email));
  if (!user) { res.status(401).json({ error: "Identifiants incorrects" }); return; }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: "Identifiants incorrects" }); return; }
  res.json({ token: makeToken(user.id), user: { id: user.id, email: user.email, name: user.name, phone: user.phone, createdAt: user.createdAt } });
});

router.get("/boutiko/auth/me", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  const [user] = await db.select().from(boutikoUsersTable).where(eq(boutikoUsersTable.id, req.boutikoUserId!));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: user.id, email: user.email, name: user.name, phone: user.phone, createdAt: user.createdAt });
});

// ─── Shop ─────────────────────────────────────────────────────────────────────

router.get("/boutiko/shop", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(404).json({ error: "Not found" }); return; }
  const [b] = await db.select().from(boutikoBoutiquesTable).where(eq(boutikoBoutiquesTable.id, req.boutique.id));
  res.json(b);
});

router.post("/boutiko/shop", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  const parsed = z.object({ name: z.string(), description: z.string().optional(), currency: z.string().optional(), country: z.string().optional(), logoUrl: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [b] = await db.insert(boutikoBoutiquesTable).values({ userId: req.boutikoUserId!, ...parsed.data }).returning();
  res.status(201).json(b);
});

router.patch("/boutiko/shop", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(404).json({ error: "No shop found" }); return; }
  const parsed = z.object({ name: z.string().optional(), description: z.string().optional(), currency: z.string().optional(), country: z.string().optional(), logoUrl: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [b] = await db.update(boutikoBoutiquesTable).set(parsed.data).where(eq(boutikoBoutiquesTable.id, req.boutique.id)).returning();
  res.json(b);
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get("/boutiko/dashboard", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  const boutiqueId = req.boutique?.id;
  if (!boutiqueId) { res.json({ totalRevenue: 0, totalSales: 0, totalProducts: 0, totalClients: 0, todayRevenue: 0, todaySales: 0, lowStockCount: 0, recentSales: [], topProducts: [] }); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [totals] = await db.select({ total: sql<number>`coalesce(sum(total_amount), 0)`, count: sql<number>`count(*)` }).from(boutikoSalesTable).where(and(eq(boutikoSalesTable.boutiqueId, boutiqueId), eq(boutikoSalesTable.status, "completed")));
  const [todayTotals] = await db.select({ total: sql<number>`coalesce(sum(total_amount), 0)`, count: sql<number>`count(*)` }).from(boutikoSalesTable).where(and(eq(boutikoSalesTable.boutiqueId, boutiqueId), eq(boutikoSalesTable.status, "completed"), sql`created_at >= ${today}`));
  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(boutikoProductsTable).where(and(eq(boutikoProductsTable.boutiqueId, boutiqueId), eq(boutikoProductsTable.active, true)));
  const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(boutikoClientsTable).where(eq(boutikoClientsTable.boutiqueId, boutiqueId));
  const [lowStockCount] = await db.select({ count: sql<number>`count(*)` }).from(boutikoProductsTable).where(and(eq(boutikoProductsTable.boutiqueId, boutiqueId), eq(boutikoProductsTable.active, true), sql`stock <= 5`));

  const recentSalesRows = await db.select().from(boutikoSalesTable).where(eq(boutikoSalesTable.boutiqueId, boutiqueId)).orderBy(desc(boutikoSalesTable.createdAt)).limit(5);
  const recentSales = await Promise.all(recentSalesRows.map(async (s) => {
    const items = await db.select().from(boutikoSaleItemsTable).where(eq(boutikoSaleItemsTable.saleId, s.id));
    return { ...s, totalAmount: Number(s.totalAmount), items };
  }));

  const topProductsRows = await db.select({ productId: boutikoSaleItemsTable.productId, productName: boutikoSaleItemsTable.productName, totalSold: sql<number>`sum(${boutikoSaleItemsTable.quantity})`, revenue: sql<number>`sum(${boutikoSaleItemsTable.totalPrice})` }).from(boutikoSaleItemsTable).innerJoin(boutikoSalesTable, eq(boutikoSaleItemsTable.saleId, boutikoSalesTable.id)).where(eq(boutikoSalesTable.boutiqueId, boutiqueId)).groupBy(boutikoSaleItemsTable.productId, boutikoSaleItemsTable.productName).orderBy(desc(sql`sum(${boutikoSaleItemsTable.quantity})`)).limit(5);

  res.json({ totalRevenue: Number(totals.total), totalSales: Number(totals.count), totalProducts: Number(productCount.count), totalClients: Number(clientCount.count), todayRevenue: Number(todayTotals.total), todaySales: Number(todayTotals.count), lowStockCount: Number(lowStockCount.count), recentSales, topProducts: topProductsRows.map(r => ({ ...r, totalSold: Number(r.totalSold), revenue: Number(r.revenue) })) });
});

// ─── Products ─────────────────────────────────────────────────────────────────

router.get("/boutiko/products", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.json([]); return; }
  const { category, lowStock, q } = req.query;
  let query = db.select().from(boutikoProductsTable).where(eq(boutikoProductsTable.boutiqueId, req.boutique.id)).$dynamic();
  const conditions = [eq(boutikoProductsTable.boutiqueId, req.boutique.id)];
  if (category) conditions.push(eq(boutikoProductsTable.category, String(category)));
  if (lowStock === "true") conditions.push(sql`stock <= 5`);
  if (q) conditions.push(ilike(boutikoProductsTable.name, `%${q}%`));
  const products = await db.select().from(boutikoProductsTable).where(and(...conditions)).orderBy(desc(boutikoProductsTable.createdAt));
  res.json(products.map(p => ({ ...p, price: Number(p.price), costPrice: p.costPrice ? Number(p.costPrice) : null })));
});

router.post("/boutiko/products", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(400).json({ error: "Create your shop first" }); return; }
  const parsed = z.object({ name: z.string(), description: z.string().optional(), price: z.number(), costPrice: z.number().optional(), stock: z.number().int().default(0), unit: z.string().optional(), category: z.string().optional(), imageUrl: z.string().optional(), barcode: z.string().optional(), active: z.boolean().default(true) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { price, costPrice, ...rest } = parsed.data;
  const [p] = await db.insert(boutikoProductsTable).values({ boutiqueId: req.boutique.id, price: String(price), costPrice: costPrice ? String(costPrice) : null, ...rest }).returning();
  res.status(201).json({ ...p, price: Number(p.price), costPrice: p.costPrice ? Number(p.costPrice) : null });
});

router.get("/boutiko/products/:id", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(404).json({ error: "Not found" }); return; }
  const id = parseInt(req.params.id);
  const [p] = await db.select().from(boutikoProductsTable).where(and(eq(boutikoProductsTable.id, id), eq(boutikoProductsTable.boutiqueId, req.boutique.id)));
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...p, price: Number(p.price), costPrice: p.costPrice ? Number(p.costPrice) : null });
});

router.patch("/boutiko/products/:id", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(404).json({ error: "Not found" }); return; }
  const id = parseInt(req.params.id);
  const parsed = z.object({ name: z.string().optional(), description: z.string().optional(), price: z.number().optional(), costPrice: z.number().optional(), stock: z.number().int().optional(), unit: z.string().optional(), category: z.string().optional(), imageUrl: z.string().optional(), barcode: z.string().optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { price, costPrice, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (price !== undefined) updates.price = String(price);
  if (costPrice !== undefined) updates.costPrice = String(costPrice);
  const [p] = await db.update(boutikoProductsTable).set(updates).where(and(eq(boutikoProductsTable.id, id), eq(boutikoProductsTable.boutiqueId, req.boutique.id))).returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...p, price: Number(p.price), costPrice: p.costPrice ? Number(p.costPrice) : null });
});

router.delete("/boutiko/products/:id", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(boutikoProductsTable).where(and(eq(boutikoProductsTable.id, parseInt(req.params.id)), eq(boutikoProductsTable.boutiqueId, req.boutique.id)));
  res.status(204).send();
});

// ─── Clients ──────────────────────────────────────────────────────────────────

router.get("/boutiko/clients", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.json([]); return; }
  const { q } = req.query;
  const conditions = [eq(boutikoClientsTable.boutiqueId, req.boutique.id)];
  if (q) conditions.push(ilike(boutikoClientsTable.name, `%${q}%`));
  const clients = await db.select().from(boutikoClientsTable).where(and(...conditions)).orderBy(desc(boutikoClientsTable.createdAt));
  res.json(clients.map(c => ({ ...c, totalPurchases: Number(c.totalPurchases) })));
});

router.post("/boutiko/clients", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(400).json({ error: "Create your shop first" }); return; }
  const parsed = z.object({ name: z.string(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [c] = await db.insert(boutikoClientsTable).values({ boutiqueId: req.boutique.id, ...parsed.data }).returning();
  res.status(201).json({ ...c, totalPurchases: Number(c.totalPurchases) });
});

router.patch("/boutiko/clients/:id", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(404).json({ error: "Not found" }); return; }
  const parsed = z.object({ name: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [c] = await db.update(boutikoClientsTable).set(parsed.data).where(and(eq(boutikoClientsTable.id, parseInt(req.params.id)), eq(boutikoClientsTable.boutiqueId, req.boutique.id))).returning();
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...c, totalPurchases: Number(c.totalPurchases) });
});

router.delete("/boutiko/clients/:id", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(boutikoClientsTable).where(and(eq(boutikoClientsTable.id, parseInt(req.params.id)), eq(boutikoClientsTable.boutiqueId, req.boutique.id)));
  res.status(204).send();
});

// ─── Sales ────────────────────────────────────────────────────────────────────

router.get("/boutiko/sales", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.json([]); return; }
  const { from, to, clientId, paymentMethod } = req.query;
  const conditions = [eq(boutikoSalesTable.boutiqueId, req.boutique.id)];
  if (from) conditions.push(sql`created_at >= ${new Date(String(from))}`);
  if (to) conditions.push(sql`created_at <= ${new Date(String(to))}`);
  if (clientId) conditions.push(eq(boutikoSalesTable.clientId, parseInt(String(clientId))));
  if (paymentMethod) conditions.push(eq(boutikoSalesTable.paymentMethod, String(paymentMethod) as "cash" | "mobile_money" | "card" | "credit"));
  const sales = await db.select().from(boutikoSalesTable).where(and(...conditions)).orderBy(desc(boutikoSalesTable.createdAt));
  const result = await Promise.all(sales.map(async (s) => {
    const items = await db.select().from(boutikoSaleItemsTable).where(eq(boutikoSaleItemsTable.saleId, s.id));
    return { ...s, totalAmount: Number(s.totalAmount), items: items.map(i => ({ ...i, unitPrice: Number(i.unitPrice), totalPrice: Number(i.totalPrice) })) };
  }));
  res.json(result);
});

router.post("/boutiko/sales", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(400).json({ error: "Create your shop first" }); return; }
  const parsed = z.object({ clientId: z.number().optional(), clientName: z.string().optional(), totalAmount: z.number(), paymentMethod: z.enum(["cash", "mobile_money", "card", "credit"]), notes: z.string().optional(), items: z.array(z.object({ productId: z.number(), quantity: z.number().int(), unitPrice: z.number() })) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { items, totalAmount, ...saleData } = parsed.data;
  const [sale] = await db.insert(boutikoSalesTable).values({ boutiqueId: req.boutique.id, totalAmount: String(totalAmount), ...saleData }).returning();

  const saleItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(boutikoProductsTable).where(eq(boutikoProductsTable.id, item.productId));
    const totalPrice = item.quantity * item.unitPrice;
    const [si] = await db.insert(boutikoSaleItemsTable).values({ saleId: sale.id, productId: item.productId, productName: product?.name ?? "Produit", quantity: item.quantity, unitPrice: String(item.unitPrice), totalPrice: String(totalPrice) }).returning();
    await db.update(boutikoProductsTable).set({ stock: sql`stock - ${item.quantity}` }).where(eq(boutikoProductsTable.id, item.productId));
    return { ...si, unitPrice: Number(si.unitPrice), totalPrice: Number(si.totalPrice) };
  }));

  if (saleData.clientId) {
    await db.update(boutikoClientsTable).set({ totalPurchases: sql`total_purchases + ${totalAmount}`, lastPurchaseAt: new Date() }).where(eq(boutikoClientsTable.id, saleData.clientId));
  }

  res.status(201).json({ ...sale, totalAmount: Number(sale.totalAmount), items: saleItems });
});

router.get("/boutiko/sales/:id", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  if (!req.boutique) { res.status(404).json({ error: "Not found" }); return; }
  const [s] = await db.select().from(boutikoSalesTable).where(and(eq(boutikoSalesTable.id, parseInt(req.params.id)), eq(boutikoSalesTable.boutiqueId, req.boutique.id)));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  const items = await db.select().from(boutikoSaleItemsTable).where(eq(boutikoSaleItemsTable.saleId, s.id));
  res.json({ ...s, totalAmount: Number(s.totalAmount), items: items.map(i => ({ ...i, unitPrice: Number(i.unitPrice), totalPrice: Number(i.totalPrice) })) });
});

export default router;
