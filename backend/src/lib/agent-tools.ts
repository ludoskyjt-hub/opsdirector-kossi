/**
 * agent-tools.ts — Moteur d'outils autonomes partagé (AFIWA + HOUÉFA + KOSSI)
 *
 * Chaque agent a ses propres outils métier + outils transversaux partagés :
 *
 * Outils transversaux :
 * 🌐 web_search    — Recherche DuckDuckGo (gratuit, sans clé API)
 * 📰 fetch_url     — Lire une page web
 * 🧮 calculate     — Calculs (FCFA, TVA 18%, IS, marges...)
 * 📅 get_date      — Date/heure Bénin (UTC+1)
 * 📊 analyze_data  — Analyse statistique d'un tableau JSON
 */

import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ToolCall   { tool: string; params: Record<string, unknown>; }
export interface ToolResult { tool: string; success: boolean; result: string; error?: string; }

// ─── Outils disponibles ───────────────────────────────────────────────────────
export const AGENT_TOOLS_PROMPT = `
Tu as accès aux outils suivants. Pour utiliser un outil, réponds UNIQUEMENT avec ce JSON (rien d'autre) :
{"tool":"nom_outil","params":{"param":"valeur"}}

OUTILS DISPONIBLES :
### web_search
Recherche sur internet via DuckDuckGo. Utilise pour actualités, prix, réglementations DGI, taux de change.
Params: {"query": "requête en français", "maxResults": 3}

### fetch_url  
Lit le contenu d'une page web.
Params: {"url": "https://...", "extract": "ce qu'on cherche (optionnel)"}

### calculate
Calculs précis : TVA 18%, IS, marges, FCFA, budgets.
Params: {"expression": "150000 * 0.18", "context": "TVA sur achat matériel"}

### get_date
Date et heure actuelle au Bénin (UTC+1).
Params: {"format": "full|date|time"}

### analyze_data
Statistiques sur des données JSON.
Params: {"data": "[{...}]", "metric": "amount", "groupBy": "category"}

RÈGLES :
- Utilise les outils quand l'information n'est pas dans ton contexte
- Maximum 4 appels d'outils par message
- La réponse finale doit toujours être en langage naturel
- Ne fabrique JAMAIS de données — utilise web_search
`;

// ─── Exécution des outils ─────────────────────────────────────────────────────
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  logger.info({ tool: call.tool }, "Agent tool call");
  try {
    switch (call.tool) {
      case "web_search":   return await toolWebSearch(call.params);
      case "fetch_url":    return await toolFetchUrl(call.params);
      case "calculate":    return await toolCalculate(call.params);
      case "get_date":     return await toolGetDate(call.params);
      case "analyze_data": return await toolAnalyzeData(call.params);
      default:
        return { tool: call.tool, success: false, result: "", error: `Outil inconnu: ${call.tool}` };
    }
  } catch (err) {
    return { tool: call.tool, success: false, result: "", error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ── web_search ────────────────────────────────────────────────────────────────
async function toolWebSearch(params: Record<string, unknown>): Promise<ToolResult> {
  const query      = String(params.query ?? "");
  const maxResults = Math.min(Number(params.maxResults ?? 3), 5);
  if (!query) return { tool: "web_search", success: false, result: "", error: "query requis" };

  try {
    const url  = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "ENAM-Impact-Agent/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    const ddg = await resp.json() as {
      AbstractText?: string; AbstractURL?: string; AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
      Answer?: string;
    };

    const results: string[] = [];
    if (ddg.Answer) results.push(`Réponse directe: ${ddg.Answer}`);
    if (ddg.AbstractText) {
      results.push(`${ddg.AbstractSource ?? "Source"}: ${ddg.AbstractText}${ddg.AbstractURL ? ` (${ddg.AbstractURL})` : ""}`);
    }
    for (const t of (ddg.RelatedTopics ?? []).slice(0, maxResults - results.length)) {
      if (t.Text) results.push(`• ${t.Text}${t.FirstURL ? ` — ${t.FirstURL}` : ""}`);
    }

    if (results.length === 0) {
      // Fallback HTML
      const htmlResp = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
      );
      const html = await htmlResp.text();
      const snippets = [...html.matchAll(/<a class="result__snippet"[^>]*>(.*?)<\/a>/gs)]
        .slice(0, maxResults)
        .map(m => m[1]?.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean);
      if (snippets.length > 0) {
        return { tool: "web_search", success: true, result: `Résultats "${query}":\n${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}` };
      }
      return { tool: "web_search", success: false, result: "", error: `Aucun résultat pour: "${query}"` };
    }
    return { tool: "web_search", success: true, result: `Résultats "${query}":\n${results.join("\n\n")}` };
  } catch (err) {
    return { tool: "web_search", success: false, result: "", error: `Recherche échouée: ${err instanceof Error ? err.message : "timeout"}` };
  }
}

// ── fetch_url ─────────────────────────────────────────────────────────────────
async function toolFetchUrl(params: Record<string, unknown>): Promise<ToolResult> {
  const url = String(params.url ?? "");
  if (!url.startsWith("http")) return { tool: "fetch_url", success: false, result: "", error: "URL invalide" };
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ENAM-Bot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return { tool: "fetch_url", success: false, result: "", error: `HTTP ${resp.status}` };
    const html = await resp.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
      .trim().substring(0, 3000);
    return { tool: "fetch_url", success: true, result: `Contenu de ${url}:\n${text}` };
  } catch (err) {
    return { tool: "fetch_url", success: false, result: "", error: `Impossible de lire: ${err instanceof Error ? err.message : "timeout"}` };
  }
}

// ── calculate ─────────────────────────────────────────────────────────────────
async function toolCalculate(params: Record<string, unknown>): Promise<ToolResult> {
  const expression = String(params.expression ?? "");
  const context    = String(params.context ?? "");
  if (!expression) return { tool: "calculate", success: false, result: "", error: "expression requise" };
  try {
    const safe = expression.replace(/[^0-9+\-*/.,()\s%]/g, "");
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${safe})`)() as number;
    if (!isFinite(result)) throw new Error("Résultat non fini");
    const formatted = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(result);
    return { tool: "calculate", success: true, result: context ? `${context}: ${expression} = ${formatted}` : `${expression} = ${formatted}` };
  } catch (err) {
    return { tool: "calculate", success: false, result: "", error: `Calcul impossible: ${err instanceof Error ? err.message : "erreur"}` };
  }
}

// ── get_date ──────────────────────────────────────────────────────────────────
async function toolGetDate(params: Record<string, unknown>): Promise<ToolResult> {
  const format = String(params.format ?? "full");
  const now    = new Date(Date.now() + 60 * 60 * 1000); // UTC+1 Bénin
  let result: string;
  if (format === "time") {
    result = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } else if (format === "date") {
    result = now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } else {
    result = `${now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return { tool: "get_date", success: true, result: `Date/heure Bénin (UTC+1): ${result}` };
}

// ── analyze_data ──────────────────────────────────────────────────────────────
async function toolAnalyzeData(params: Record<string, unknown>): Promise<ToolResult> {
  const dataStr = String(params.data ?? "[]");
  const metric  = String(params.metric ?? "");
  const groupBy = params.groupBy ? String(params.groupBy) : null;
  try {
    const data    = JSON.parse(dataStr) as Record<string, unknown>[];
    if (!Array.isArray(data)) throw new Error("data doit être un tableau JSON");
    const values  = data.map(r => Number(r[metric])).filter(v => isFinite(v));
    if (values.length === 0) throw new Error(`Champ "${metric}" introuvable`);
    const total   = values.reduce((a, b) => a + b, 0);
    const avg     = total / values.length;
    let analysis  = `Analyse "${metric}" sur ${values.length} entrées:\n• Total: ${total.toLocaleString("fr-FR")}\n• Moyenne: ${avg.toFixed(2)}\n• Min: ${Math.min(...values).toLocaleString("fr-FR")} | Max: ${Math.max(...values).toLocaleString("fr-FR")}`;
    if (groupBy) {
      const groups: Record<string, number> = {};
      for (const row of data) {
        const key = String(row[groupBy] ?? "Autre");
        groups[key] = (groups[key] ?? 0) + Number(row[metric] ?? 0);
      }
      const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
      analysis += `\n\nPar ${groupBy}:\n${sorted.map(([k, v]) => `• ${k}: ${v.toLocaleString("fr-FR")}`).join("\n")}`;
    }
    return { tool: "analyze_data", success: true, result: analysis };
  } catch (err) {
    return { tool: "analyze_data", success: false, result: "", error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ─── Boucle d'exécution agent (Tool Calling Loop) ────────────────────────────
export async function runAgentLoop(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  callLLM:  (msgs: typeof messages) => Promise<string>,
  maxIter = 4,
): Promise<{ reply: string; toolsUsed: string[]; iterations: number }> {
  const toolsUsed: string[] = [];
  let   iterations = 0;
  const workingMessages = [...messages];

  while (iterations < maxIter) {
    iterations++;
    const response = await callLLM(workingMessages);

    // Détecter appel d'outil
    const m = response.trim().match(/^\s*(\{[\s\S]*?\})\s*$/);
    if (!m) return { reply: response, toolsUsed, iterations };

    let call: ToolCall;
    try { call = JSON.parse(m[1]) as ToolCall; if (!call.tool) throw new Error(); }
    catch { return { reply: response, toolsUsed, iterations }; }

    const result = await executeTool(call);
    toolsUsed.push(call.tool);

    workingMessages.push({ role: "assistant", content: response });
    workingMessages.push({
      role: "user",
      content: result.success
        ? `[Résultat de ${call.tool}]:\n${result.result}`
        : `[ERREUR ${call.tool}]: ${result.error ?? "Erreur inconnue"}. Continue sans cet outil.`,
    });
  }

  workingMessages.push({ role: "user", content: "Donne maintenant ta réponse finale en langage naturel." });
  const finalReply = await callLLM(workingMessages);
  return { reply: finalReply, toolsUsed, iterations };
}