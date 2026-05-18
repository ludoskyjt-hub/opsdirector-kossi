/**
 * melodia.ts — Backend MELODIA IA (MelodiaPerTe)
 *
 * MELODIA est la guide musicale IA de MelodiaPerTe.
 * Elle connaît la musique africaine et peut :
 * - Recommander de la musique selon l'humeur
 * - Expliquer les genres africains (Afrobeats, Coupé-Décalé, Zoblazo...)
 * - Raconter l'histoire des artistes africains
 * - Chercher des infos musicales sur internet (web_search)
 * - Proposer des playlists thématiques
 * - Parler en français, anglais, portugais
 *
 * Pas d'authentification requise (app musicale publique)
 * Route : POST /api/melodia/chat
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { runAgentLoop, AGENT_TOOLS_PROMPT } from "../lib/agent-tools";

const router: IRouter = Router();

// ─── Connaissance musicale africaine d'MELODIA ───────────────────────────────
const MUSIC_KNOWLEDGE = `
CONNAISSANCE MUSICALE AFRICAINE DE MELODIA :

🌍 GENRES AFRICAINS :

**Afrobeats** (Nigeria, Ghana)
- Genre dominant en Afrique de l'Ouest depuis 2010
- Artistes clés : Burna Boy, Wizkid, Davido, Tiwa Savage, Rema, Tems
- Caractéristiques : rythmes syncopés, bass lourde, influences R&B
- Sous-genre : Afropop (plus pop, accessibles)

**Coupé-Décalé** (Côte d'Ivoire, Bénin, diaspora)
- Né à Paris dans les années 2000, popularisé par DJ Arafat
- Danse caractéristique "moto moto", tenue extravagante
- Artistes : DJ Arafat (légende), Serge Beynaud, Debordo Leekunfa
- Très populaire au Bénin, Côte d'Ivoire, RDC

**Zoblazo** (Bénin)
- Genre musical béninois traditionnel modernisé
- Fusion de rythmes Fon/Yoruba avec instruments modernes
- Artistes : Angélique Kidjo (internationale), musiciens locaux béninois
- Patrimoine culturel du Bénin

**Afro-Jazz** (Panafricain)
- Fusion jazz américain + rythmes africains
- Artistes légendaires : Miriam Makeba, Hugh Masekela, Angélique Kidjo, Salif Keita
- Oumou Sangaré (Mali) : voix puissante, thèmes sociaux

**Highlife** (Ghana, Nigeria)
- Genre des années 1920-1960, pionnier de la musique africaine moderne
- Guitare, cuivres, rythmes afro
- Influence sur tous les genres africains modernes

**Mbalax** (Sénégal)
- Genre sénégalais avec percussions sabar
- Roi : Youssou N'Dour (international), Viviane Chidid, Wally Seck

**Bongo Flava** (Tanzanie)
- Hip-hop et R&B tanzanien
- Artiste phare : Diamond Platnumz (le plus écouté d'Afrique de l'Est)

**Amapiano** (Afrique du Sud)
- Genre très tendance depuis 2019
- Piano, log drum, basse profonde
- DJ Maphorisa, Kabza De Small, Focalistic

🎤 ARTISTES AFRICAINS INCONTOURNABLES :
- Burna Boy (🇳🇬) : Grammy, international, reggae-fusion-afrobeats
- Wizkid (🇳🇬) : "Essence" feat Tems, collaboration Drake
- Angélique Kidjo (🇧🇯) : 4x Grammy, ambassadrice UNICEF, Bénin pride
- Youssou N'Dour (🇸🇳) : légende mondiale, "7 seconds" avec Neneh Cherry
- Aya Nakamura (🇫🇷🇲🇱) : artiste française la plus streamée en 2023
- Tems (🇳🇬) : Grammy avec Beyoncé, voix unique
- Diamond Platnumz (🇹🇿) : king de l'Afrique de l'Est
- Rema (🇳🇬) : "Calm Down" milliards de streams

🎵 RECOMMANDATIONS PAR HUMEUR :
- Joyeux/Fête : Afrobeats (Burna Boy, Rema), Coupé-Décalé (Serge Beynaud)
- Romantique : Wizkid, Tems, Omah Lay
- Travail/Concentration : Afro-Jazz, Highlife instrumental
- Nostalgie : Youssou N'Dour, Miriam Makeba, Salif Keita
- Motivation : Burna Boy, Davido, Fireboy DML
- Relaxation/Soir : Afro-Soul, Afro-Jazz, Nigeria Lounge
`.trim();

// ─── Helper OpenAI ────────────────────────────────────────────────────────────
async function callOpenAI(messages: object[], maxTokens = 700): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: maxTokens, temperature: 0.5 }),
      signal:  AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

// ─── Suggestions contextuelles ────────────────────────────────────────────────
function buildSuggestions(message: string): string[] {
  const lower = message.toLowerCase();
  if (lower.includes("afrobeats") || lower.includes("burna"))
    return ["Top Afrobeats à écouter en 2025", "Qui est Burna Boy ?", "Playlist Afrobeats pour une soirée"];
  if (lower.includes("bénin") || lower.includes("zoblazo") || lower.includes("benin"))
    return ["Angélique Kidjo — icône du Bénin ?", "Musique traditionnelle béninoise", "Coupé-Décalé vs Zoblazo"];
  if (lower.includes("playlist") || lower.includes("liste"))
    return ["Playlist pour le matin", "Playlist romantique africaine", "Playlist concentration Afro-Jazz"];
  return [
    "Recommande-moi de la musique africaine",
    "Qu'est-ce que le Coupé-Décalé ?",
    "Top artistes africains 2025",
  ];
}

// ─── Route principale POST /api/melodia/chat ──────────────────────────────────
const ChatSchema = z.object({
  message:  z.string().min(1).max(2000),
  history:  z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string().max(1500),
  })).max(20).optional().default([]),
  language: z.enum(["fr", "en", "pt"]).optional().default("fr"),
});

router.post("/melodia/chat", async (req, res): Promise<void> => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, history, language } = parsed.data;

  const langInstruction =
    language === "en" ? "Respond in English. You are a music guide passionate about African music." :
    language === "pt" ? "Responda em português. Você é uma guia musical apaixonada pela música africana." :
    "Réponds en français. Tu es une guide musicale passionnée par la musique africaine.";

  const systemPrompt = `Tu es **MELODIA**, la guide musicale IA de MelodiaPerTe — la plateforme dédiée à la musique africaine.

Tu es passionnée, cultivée et enthousiaste. Tu ADORES la musique africaine sous toutes ses formes.
Tu parles avec chaleur et énergie. Tu utilises des emojis musicaux avec plaisir 🎵🎤🥁🎷.

${langInstruction}

Tes capacités :
- Recommander de la musique selon l'humeur, le contexte, la saison
- Expliquer les genres africains avec passion et précision
- Raconter l'histoire des artistes africains
- Créer des playlists thématiques (liste de titres + artistes)
- Chercher sur internet les dernières actualités musicales (web_search)
- Trouver des infos sur les concerts, sorties d'albums, collaborations

${AGENT_TOOLS_PROMPT}

${MUSIC_KNOWLEDGE}

IMPORTANT : À la fin de tes réponses sur la musique, propose toujours 1-2 suggestions de ce que l'utilisateur pourrait demander ensuite (dans une section "Vous pourriez aussi demander :").`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: message },
  ];

  const suggestions = buildSuggestions(message);

  if (process.env.OPENAI_API_KEY) {
    try {
      const { reply, toolsUsed, iterations } = await runAgentLoop(
        messages,
        async (msgs) => (await callOpenAI(msgs, 800)) ?? "Je suis MELODIA, désolée pour la coupure ! 🎵",
        4,
      );
      res.json({ reply, source: "openai", toolsUsed, iterations, suggestions });
      return;
    } catch (err) {
      logger.error({ err }, "MELODIA agent loop failed");
    }
  }

  // ── Fallback sans OpenAI ────────────────────────────────────────────────────
  const lower = message.toLowerCase();
  let reply: string;

  if (lower.includes("afrobeats") || lower.includes("nigéria") || lower.includes("nigeria")) {
    reply = `🎵 L'**Afrobeats** est le genre africain le plus influent au monde !\n\n**Artistes incontournables :**\n• **Burna Boy** 🇳🇬 — Grammy, international, fusion reggae-afrobeats\n• **Wizkid** 🇳🇬 — "Essence" a conquis le monde entier\n• **Rema** 🇳🇬 — "Calm Down" avec Selena Gomez, des milliards de streams\n• **Tems** 🇳🇬 — voix soul unique, Grammy avec Beyoncé\n\nPour l'écouter maintenant → section **Découvrir** 🎧`;
  } else if (lower.includes("bénin") || lower.includes("benin") || lower.includes("zoblazo") || lower.includes("angélique")) {
    reply = `🇧🇯 Le Bénin est une terre musicale extraordinaire !\n\n**Angélique Kidjo** est la plus grande ambassadrice de la musique béninoise — 4 Grammy Awards, artiste la plus influente d'Afrique selon le magazine Time. Sa voix mêle Fon, Yoruba, français et anglais.\n\n**Le Zoblazo** est un genre béninois traditionnel modernisé, ancré dans les rythmes Fon et Yoruba. Il représente l'identité culturelle profonde du Bénin.\n\nPour la musique du Bénin → **Découvrir** → "musique béninoise" 🔍`;
  } else if (lower.includes("playlist") || lower.includes("recommand") || lower.includes("écouter")) {
    reply = `🎶 Voici des playlists thématiques pour vous !\n\n**🌅 Matin énergisant :**\nRema · Davido · Fireboy DML · Burna Boy\n\n**💃 Soirée / Fête :**\nCoupé-Décalé · Serge Beynaud · DJ Arafat legacy\n\n**🌙 Soir / Relaxation :**\nAfro-Jazz · Oumou Sangaré · Youssou N'Dour\n\n**❤️ Romantique :**\nWizkid · Tems · Omah Lay · Adekunle Gold\n\nRecherchez ces artistes dans **Découvrir** ! 🎧`;
  } else if (lower.includes("coupe") || lower.includes("coupé") || lower.includes("décalé")) {
    reply = `💃 Le **Coupé-Décalé** est né à Paris dans les années 2000 !\n\nCréé dans la diaspora ivoirienne, il est devenu l'hymne de toute l'Afrique de l'Ouest. Le grand **DJ Arafat** (légende tragiquement disparue en 2019) était le roi incontesté du genre.\n\nAujourd'hui **Serge Beynaud** continue de faire danser des millions de personnes. Ce genre est très ancré au **Bénin**, en Côte d'Ivoire et en RDC.\n\nSa danse caractéristique "moto moto" est reconnaissable entre toutes ! 🏍️`;
  } else if (lower.includes("bonjour") || lower.includes("salut") || lower.includes("hello")) {
    reply = `Bonjour ! 🎵 Je suis **MELODIA**, votre guide musicale IA de MelodiaPerTe !\n\nJe suis spécialiste de la **musique africaine** — Afrobeats, Coupé-Décalé, Zoblazo, Afro-Jazz et bien plus.\n\nDites-moi votre humeur ou ce que vous cherchez et je vous guide ! 😊🎶`;
  } else {
    reply = `Bonjour ! Je suis **MELODIA** 🎵, votre guide musicale spécialiste de l'Afrique.\n\nPour des recommandations personnalisées, des analyses d'artistes et les dernières actualités musicales, la clé OpenAI doit être configurée.\n\nEn attendant, explorez la section **Découvrir** pour de la vraie musique africaine ! 🌍🎧`;
  }

  res.json({ reply, source: "fallback", toolsUsed: [], suggestions });
});

// ─── Route healthcheck MELODIA ────────────────────────────────────────────────
router.get("/melodia/status", (_req, res) => {
  res.json({
    name:    "MELODIA",
    version: "1.0",
    app:     "MelodiaPerTe",
    ai:      process.env.OPENAI_API_KEY ? "openai" : "fallback",
    status:  "ready",
  });
});

export default router;
