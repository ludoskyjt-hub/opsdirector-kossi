/**
 * boutiko-ai.ts — Route IA dédiée à HOUÉFA (Boutiko)
 *
 * NOUVEAU — Route POST /boutiko/ai/chat
 *
 * HOUÉFA est l'assistante IA de Boutiko. Elle a accès à :
 * - Les produits de la boutique (stock, prix, catégories)
 * - Les ventes récentes (CA, méthodes paiement, clients)
 * - Les clients (meilleurs acheteurs, derniers achats)
 * - Les infos de la boutique (nom, devise, pays)
 *
 * Questions typiques HOUÉFA :
 * - "Quels produits n'ont pas bougé ce mois-ci ?"
 * - "Propose une promo pour liquider le stock dormant"
 * - "Quel est mon meilleur client ce mois ?"
 * - "Résume mes ventes de la semaine"
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, boutikoUsersTable, boutikoBoutiquesTable, boutikoProductsTable,
         boutikoClientsTable, boutikoSalesTable, boutikoSaleItemsTable } from "@workspace/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "../lib/logger";
import { runAgentLoop, buildAgentSystemPrompt, AGENT_TOOLS } from "../lib/agent-tools";

const router: IRouter = Router();

// ─── Auth middleware HOUÉFA (supporte JWT + legacy) ───────────────────────────
interface BoutikoReq extends Request {
  boutikoUserId?: number;
  boutique?: { id: number; name?: string; currency?: string; country?: string } | null;
}

async function boutikoAuth(req: BoutikoReq, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);

  // JWT (3 parties "aaa.bbb.ccc")
  if (token.includes(".")) {
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const [header, body, sig] = parts;
        const secret   = process.env.JWT_SECRET ?? "dev-secret-change-in-production-min-32-chars!!";
        const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
        const sigBuf   = Buffer.from(sig!,      "base64url");
        const expBuf   = Buffer.from(expected, "base64url");
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          res.status(401).json({ error: "Invalid token" }); return;
        }
        const payload = JSON.parse(Buffer.from(body!, "base64url").toString()) as { sub: number; type: string; exp: number };
        if (payload.type !== "access" || payload.exp < Math.floor(Date.now() / 1000)) {
          res.status(401).json({ error: "Token expired" }); return;
        }
        const [user] = await db.select().from(boutikoUsersTable).where(eq(boutikoUsersTable.id, payload.sub));
        if (!user) { res.status(401).json({ error: "User not found" }); return; }
        req.boutikoUserId = user.id;
        const [boutique] = await db.select().from(boutikoBoutiquesTable).where(eq(boutikoBoutiquesTable.userId, user.id));
        req.boutique = boutique ?? null;
        next(); return;
      } catch { res.status(401).json({ error: "Invalid token" }); return; }
    }
  }

  // Legacy userId:timestamp
  const parts  = token.split(":");
  const userId = parseInt(parts[0] ?? "", 10);
  if (isNaN(userId) || parts.length < 2) { res.status(401).json({ error: "Invalid token" }); return; }
  const [user] = await db.select().from(boutikoUsersTable).where(eq(boutikoUsersTable.id, userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  req.boutikoUserId = user.id;
  const [boutique] = await db.select().from(boutikoBoutiquesTable).where(eq(boutikoBoutiquesTable.userId, user.id));
  req.boutique = boutique ?? null;
  next();
}

// ─── Charger le contexte réel de la boutique ──────────────────────────────────
async function loadBoutikoContext(boutiqueId: number, currency = "XOF"): Promise<string> {
  try {
    const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + ` ${currency}`;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);

    // Ventes du mois
    const [monthSales] = await db.select({
      total:  sql<number>`COALESCE(SUM(total_amount), 0)`,
      count:  sql<number>`COUNT(*)`,
    }).from(boutikoSalesTable)
      .where(and(eq(boutikoSalesTable.boutiqueId, boutiqueId), gte(boutikoSalesTable.createdAt, startOfMonth)));

    // Ventes de la semaine
    const [weekSales] = await db.select({
      total:  sql<number>`COALESCE(SUM(total_amount), 0)`,
      count:  sql<number>`COUNT(*)`,
    }).from(boutikoSalesTable)
      .where(and(eq(boutikoSalesTable.boutiqueId, boutiqueId), gte(boutikoSalesTable.createdAt, startOfWeek)));

    // Produits (stock)
    const products = await db.select({
      name:     boutikoProductsTable.name,
      category: boutikoProductsTable.category,
      stock:    boutikoProductsTable.stock,
      minStock: boutikoProductsTable.minStock,
      price:    boutikoProductsTable.price,
    }).from(boutikoProductsTable)
      .where(and(eq(boutikoProductsTable.boutiqueId, boutiqueId), eq(boutikoProductsTable.active, true)))
      .limit(30);

    // Produits qui ne se vendent pas (0 vente ce mois)
    const soldThisMonth = await db.select({
      productId: boutikoSaleItemsTable.productId,
      qty:       sql<number>`SUM(${boutikoSaleItemsTable.quantity})`,
    }).from(boutikoSaleItemsTable)
      .innerJoin(boutikoSalesTable, eq(boutikoSaleItemsTable.saleId, boutikoSalesTable.id))
      .where(and(eq(boutikoSalesTable.boutiqueId, boutiqueId), gte(boutikoSalesTable.createdAt, startOfMonth)))
      .groupBy(boutikoSaleItemsTable.productId);

    const soldIds = new Set(soldThisMonth.map(s => s.productId));
    const slowProducts = products.filter(p => !soldIds.has(p.name)); // approx
    const lowStockProducts = products.filter(p => Number(p.stock) <= Number(p.minStock ?? 5));

    // Top 5 produits par CA
    const topProducts = await db.select({
      productName: boutikoSaleItemsTable.productName,
      qty:         sql<number>`SUM(${boutikoSaleItemsTable.quantity})`,
      revenue:     sql<number>`SUM(${boutikoSaleItemsTable.totalPrice})`,
    }).from(boutikoSaleItemsTable)
      .innerJoin(boutikoSalesTable, eq(boutikoSaleItemsTable.saleId, boutikoSalesTable.id))
      .where(and(eq(boutikoSalesTable.boutiqueId, boutiqueId), gte(boutikoSalesTable.createdAt, startOfMonth)))
      .groupBy(boutikoSaleItemsTable.productName)
      .orderBy(desc(sql`SUM(${boutikoSaleItemsTable.totalPrice})`))
      .limit(5);

    // Clients (meilleurs acheteurs)
    const topClients = await db.select({
      name:           boutikoClientsTable.name,
      totalPurchases: boutikoClientsTable.totalPurchases,
      lastPurchaseAt: boutikoClientsTable.lastPurchaseAt,
    }).from(boutikoClientsTable)
      .where(eq(boutikoClientsTable.boutiqueId, boutiqueId))
      .orderBy(desc(boutikoClientsTable.totalPurchases))
      .limit(5);

    // Ventes récentes (5 dernières)
    const recentSales = await db.select({
      totalAmount:   boutikoSalesTable.totalAmount,
      paymentMethod: boutikoSalesTable.paymentMethod,
      createdAt:     boutikoSalesTable.createdAt,
    }).from(boutikoSalesTable)
      .where(eq(boutikoSalesTable.boutiqueId, boutiqueId))
      .orderBy(desc(boutikoSalesTable.createdAt))
      .limit(5);

    return `
DONNÉES RÉELLES DE VOTRE BOUTIQUE :

📊 VENTES :
- Ce mois-ci : ${fmt(Number(monthSales.total))} (${monthSales.count} vente(s))
- Cette semaine : ${fmt(Number(weekSales.total))} (${weekSales.count} vente(s))

🏆 TOP PRODUITS CE MOIS :
${topProducts.length > 0 ? topProducts.map(p => `• ${p.productName}: ${fmt(Number(p.revenue))} (${p.qty} vendus)`).join("\n") : "• Aucune vente ce mois"}

📦 STOCK :
- Total produits actifs : ${products.length}
- Produits en stock faible : ${lowStockProducts.map(p => `${p.name} (${p.stock} restants)`).join(", ") || "Aucun"}

👥 MEILLEURS CLIENTS :
${topClients.length > 0 ? topClients.map(c => `• ${c.name}: ${fmt(Number(c.totalPurchases ?? 0))}`).join("\n") : "• Aucun client enregistré"}

🕐 5 DERNIÈRES VENTES :
${recentSales.map(s => `• ${fmt(Number(s.totalAmount))} — ${s.paymentMethod} — ${new Date(s.createdAt).toLocaleDateString("fr-FR")}`).join("\n")}
`.trim();
  } catch (err) {
    logger.error({ err }, "Failed to load boutiko context");
    return "Contexte boutique indisponible temporairement.";
  }
}

// ─── Helper OpenAI ────────────────────────────────────────────────────────────
async function callOpenAI(messages: object[], maxTokens = 600): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: maxTokens, temperature: 0.3 }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

// ─── POST /boutiko/ai/chat — HOUÉFA ──────────────────────────────────────────
const ChatSchema = z.object({
  message:  z.string().min(1).max(2000),
  history:  z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string().max(1000),
  })).max(20).optional().default([]),
  language: z.enum(["fr", "en"]).optional().default("fr"),
});

router.post("/boutiko/ai/chat", boutikoAuth, async (req: BoutikoReq, res): Promise<void> => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, history, language } = parsed.data;
  const boutiqueId = req.boutique?.id;
  const currency   = (req.boutique as any)?.currency ?? "XOF";
  const shopName   = (req.boutique as any)?.name ?? "Votre boutique";

  const context = boutiqueId
    ? await loadBoutikoContext(boutiqueId, currency)
    : "Aucune boutique configurée pour ce compte.";

  const langInstr = language === "en"
    ? "Respond in English."
    : "Réponds en français.";

  const basePrompt = `Tu es **HOUÉFA**, l'assistante IA intelligente de **${shopName}** sur Boutiko.
Tu aides le gérant à analyser ses ventes, gérer son stock et comprendre ses clients.
Tu as accès aux données réelles de la boutique ci-dessous.
${langInstr}
Sois concise, pratique et bienveillante. Utilise des emojis avec modération.
Si l'utilisateur demande une promo ou une stratégie, propose quelque chose de concret basé sur ses données.
Pour les informations non disponibles dans le contexte, utilise web_search.

${context}`;

  const systemPrompt = buildAgentSystemPrompt(basePrompt);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: message },
  ];

  // Mode agent autonome avec tool calling loop
  if (process.env.OPENAI_API_KEY) {
    try {
      const { reply, toolsUsed, iterations } = await runAgentLoop(
        messages,
        async (msgs) => (await callOpenAI(msgs, 700)) ?? "Désolée, je n'ai pas pu répondre.",
        4,
      );
      res.json({ reply, source: "openai", toolsUsed, iterations });
      return;
    } catch (err) {
      logger.error({ err }, "HOUÉFA agent loop failed");
    }
  }

  // Fallback intelligent sans OpenAI
  const lower = message.toLowerCase();
  let fallback: string;

  if (lower.includes("stock") || lower.includes("produit") || lower.includes("rupture")) {
    fallback = `📦 Je vois vos données de stock dans la boutique. Pour une analyse détaillée des produits dormants et des recommandations de réapprovisionnement, la clé OpenAI doit être configurée. Consultez votre page Inventaire en attendant !`;
  } else if (lower.includes("vente") || lower.includes("chiffre") || lower.includes("ca")) {
    fallback = `📊 Vos données de ventes sont disponibles dans la section Rapports. Avec la clé OpenAI activée, je peux analyser les tendances et proposer des stratégies ! 🚀`;
  } else if (lower.includes("client") || lower.includes("meilleur")) {
    fallback = `👥 La liste de vos meilleurs clients est dans la section Clients. OpenAI me permettrait de vous donner des insights personnalisés sur leur comportement d'achat !`;
  } else if (lower.includes("promo") || lower.includes("promotion")) {
    fallback = `🏷️ Pour proposer une promo adaptée à votre stock et vos ventes, j'ai besoin d'analyser vos données. Activez la clé OpenAI pour des recommandations concrètes !`;
  } else {
    fallback = `Bonjour ! Je suis HOUÉFA, votre assistante IA Boutiko 😊 Je peux analyser vos ventes, stock et clients. Pour toutes mes fonctionnalités avancées, la clé OpenAI doit être configurée par votre administrateur.`;
  }

  res.json({ reply: fallback, source: "fallback", toolsUsed: [] });
});

export default router;
