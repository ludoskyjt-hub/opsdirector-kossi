import { Router, type IRouter } from "express";
import { ParseExpenseTextBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { logger } from "../lib/logger";
import { z } from "zod";

const router: IRouter = Router();

const CATEGORIES = [
  "Alimentation", "Transport", "Carburant", "Bureau", "Communication",
  "Santé", "Logement", "Eau", "Électricité", "Salaire", "Matériel",
  "Marketing", "Formation", "Divers"
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Alimentation": ["riz", "pain", "poisson", "viande", "nourriture", "repas", "manger", "aliment", "marché", "food"],
  "Transport": ["taxi", "transport", "zem", "moto", "bus", "déplacement", "trajet", "voyage"],
  "Carburant": ["essence", "carburant", "fuel", "gasoil", "litre"],
  "Bureau": ["papier", "stylo", "bureau", "fourniture", "imprimante", "encre", "classeur"],
  "Communication": ["téléphone", "internet", "recharge", "MTN", "Moov", "forfait", "crédit", "appel"],
  "Santé": ["médecin", "pharmacie", "médicament", "clinique", "hôpital", "ordonnance"],
  "Logement": ["loyer", "maison", "appartement", "villa", "bail"],
  "Eau": ["eau", "SONEB", "facture eau"],
  "Électricité": ["électricité", "SBEE", "courant", "énergie", "facture"],
  "Salaire": ["salaire", "paye", "paie", "prime", "bonus", "employé"],
  "Matériel": ["matériel", "outil", "machine", "équipement", "appareil"],
  "Marketing": ["pub", "publicité", "affiche", "flyer", "promotion", "marketing"],
  "Formation": ["formation", "cours", "atelier", "séminaire", "conférence"],
};

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return "Divers";
}

function extractAmount(text: string): number {
  const patterns = [/(\d{1,3}(?:\s\d{3})+)/g, /(\d+(?:[.,]\d{3})+)/g, /(\d+)/g];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      const nums = matches.map(m => parseInt(m.replace(/[\s.,]/g, ""), 10)).filter(n => n > 0);
      if (nums.length > 0) return Math.max(...nums);
    }
  }
  return 0;
}

function extractDescription(text: string): string {
  return text
    .replace(/\d{1,3}(?:\s\d{3})+/g, "")
    .replace(/\d+(?:[.,]\d{3})+/g, "")
    .replace(/\d+\s*(FCFA|fcfa|CFA|cfa|F)?/g, "")
    .replace(/\s+/g, " ")
    .trim() || text.trim();
}

async function callOpenAI(messages: object[]): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 300, temperature: 0.1 }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

router.post("/ai/parse-text", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ParseExpenseTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const text = parsed.data.text;
  const systemPrompt = `Tu es un assistant de gestion des dépenses pour des entreprises béninoises. 
Extrait les informations de dépense du texte fourni et réponds en JSON avec ces champs:
- description: description courte de la dépense (en français, max 50 chars)
- amount: montant en FCFA (nombre entier)
- category: une des catégories suivantes: ${CATEGORIES.join(", ")}
- confidence: score de confiance entre 0 et 1
Réponds uniquement avec le JSON, sans markdown.`;

  const content = await callOpenAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: text },
  ]);

  if (content) {
    try {
      const result = JSON.parse(content) as { description?: string; amount?: number; category?: string; confidence?: number };
      res.json({
        description: result.description ?? text,
        amount: result.amount ?? 0,
        category: result.category ?? "Divers",
        confidence: result.confidence ?? 0.8,
        rawText: text,
      });
      return;
    } catch {
      req.log.warn("OpenAI JSON parse failed, using local NLP");
    }
  }

  const amount = extractAmount(text);
  const category = guessCategory(text);
  const description = extractDescription(text);
  res.json({ description: description || text, amount, category, confidence: amount > 0 ? 0.75 : 0.4, rawText: text });
});

router.post("/ai/parse-receipt", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({ imageBase64: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64 } = parsed.data;

  const prompt = `Analyse ce reçu/ticket de caisse. Extrais les informations suivantes en JSON:
- description: courte description de l'achat (en français, max 50 chars)
- amount: montant total en FCFA (nombre entier, 0 si non trouvé)
- category: une parmi: ${CATEGORIES.join(", ")}
- confidence: score 0-1 selon ta certitude
Réponds uniquement avec le JSON valide, sans markdown ni explication.`;

  const content = await callOpenAI([{
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
    ],
  }]);

  if (content) {
    try {
      const result = JSON.parse(content) as { description?: string; amount?: number; category?: string; confidence?: number };
      res.json({
        description: result.description ?? "Achat scanné",
        amount: result.amount ?? 0,
        category: result.category ?? "Divers",
        confidence: result.confidence ?? 0.7,
        rawText: "Reçu scanné par AFIWA Vision",
      });
      return;
    } catch {
      logger.warn("OpenAI Vision JSON parse failed");
    }
  }

  // Fallback simulation
  logger.info("Receipt OCR: OpenAI Vision unavailable, returning simulated response");
  res.json({
    description: "Achat reçu scanné",
    amount: Math.floor(Math.random() * 50000) + 1000,
    category: "Divers",
    confidence: 0.45,
    rawText: "Reçu scanné (simulation — clé OpenAI requise pour l'analyse réelle)",
  });
});

export default router;
