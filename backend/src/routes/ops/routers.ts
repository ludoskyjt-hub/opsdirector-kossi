import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { opsRouter, publicOpsProcedure, protectedOpsProcedure } from "./trpc";
import { invokeLLM, transcribeAudio } from "./llm";
import * as XLSX from "xlsx";
import {
  buildSystemPrompt, buildMemoryExtractionPrompt, buildIdeaClassificationPrompt, buildDailyBriefingPrompt,
} from "./agentPrompt";
import {
  getOpsProjects, getOpsProjectById, createOpsProject, updateOpsProject, getOpsMonthlyPriorityCount,
  getOpsIdeas, createOpsIdea, updateOpsIdea,
  getOpsConversations, createOpsConversation, updateOpsConversation, getOpsMessages, createOpsMessage,
  getOpsMemoryEntries, createOpsMemoryEntry,
  getOpsReminders, createOpsReminder, updateOpsReminder,
  getOpsTasks, createOpsTask, updateOpsTask,
  createOpsUser, verifyOpsPassword, getOpsUserByEmail, updateOpsUserPassword,
} from "./db";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

function makeToken(userId: number): string {
  return `${userId}:${Date.now()}`;
}

async function buildAgentContext(userId: number) {
  const [activeProjects, recentIdeas, pendingReminders, memoryEntries, pendingTasks] = await Promise.all([
    getOpsProjects(userId),
    getOpsIdeas(userId),
    getOpsReminders(userId),
    getOpsMemoryEntries(userId, 30),
    getOpsTasks(userId),
  ]);
  return {
    activeProjects: activeProjects.filter((p) => p.status === "active"),
    recentIdeas: recentIdeas.slice(0, 10),
    pendingReminders,
    memoryEntries,
    pendingTasks: pendingTasks.filter((t) => t.status !== "done" && t.status !== "cancelled"),
  };
}

async function extractAndSaveMemories(userId: number, userMsg: string, assistantMsg: string) {
  try {
    const prompt = buildMemoryExtractionPrompt(`Utilisateur: ${userMsg}\n\nAssistant: ${assistantMsg}`);
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "memory_extraction", strict: true,
          schema: { type: "object", properties: { memories: { type: "array", items: { type: "object", properties: { type: { type: "string" }, content: { type: "string" }, importance: { type: "string" } }, required: ["type","content","importance"], additionalProperties: false } }, tasks: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, priority: { type: "string" } }, required: ["title","description","priority"], additionalProperties: false } }, reminders: { type: "array", items: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title","content"], additionalProperties: false } } }, required: ["memories","tasks","reminders"], additionalProperties: false },
        },
      },
    });
    const extracted = JSON.parse(result.choices[0].message.content);
    for (const m of extracted.memories ?? []) await createOpsMemoryEntry({ userId, type: m.type, content: m.content, importance: m.importance });
    for (const t of extracted.tasks ?? []) await createOpsTask({ userId, title: t.title, description: t.description, priority: t.priority });
    for (const r of extracted.reminders ?? []) await createOpsReminder({ userId, title: r.title, content: r.content });
  } catch { /* fire-and-forget */ }
}

// ─── Auth Router ──────────────────────────────────────────────────────────────

const authOpsRouter = opsRouter({
  me: publicOpsProcedure.query(({ ctx }) => ctx.user),

  login: publicOpsProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const user = await verifyOpsPassword(input.email, input.password);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" });
      return { token: makeToken(user.id), user };
    }),

  register: publicOpsProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() }))
    .mutation(async ({ input }) => {
      const existing = await getOpsUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Cet email est déjà utilisé" });
      const user = await createOpsUser(input.email, input.password, input.name);
      return { token: makeToken(user.id), user };
    }),

  logout: publicOpsProcedure.mutation(() => ({ success: true })),


});

// ─── Projects Router ──────────────────────────────────────────────────────────

const projectOpsRouter = opsRouter({
  list: protectedOpsProcedure.query(({ ctx }) => getOpsProjects(ctx.user.id)),
  get: protectedOpsProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const p = await getOpsProjectById(input.id, ctx.user.id);
    if (!p) throw new TRPCError({ code: "NOT_FOUND" });
    return p;
  }),
  create: protectedOpsProcedure.input(z.object({
    title: z.string().min(1).max(255), description: z.string().optional(),
    status: z.enum(["active","paused","completed","archived"]).optional(),
    priority: z.enum(["low","medium","high","critical"]).optional(),
    color: z.string().optional(),
    pole: z.enum(["cosmetique_industrie","agro_industrie","retail_innovation","culture_evenementiel","institutionnel_diplomatie","autre"]).optional(),
    sequenceStatus: z.enum(["idee","planification","execution","monitoring"]).optional(),
    dependencyIndex: z.string().optional(), location: z.string().optional(),
    strategicHorizon: z.enum(["short_term","medium_term","long_term"]).optional(),
    monthlyPriority: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    if (input.monthlyPriority) {
      const count = await getOpsMonthlyPriorityCount(ctx.user.id);
      if (count >= 3) throw new TRPCError({ code: "BAD_REQUEST", message: "Vous avez déjà 3 priorités du mois." });
    }
    const id = await createOpsProject({ ...input, userId: ctx.user.id } as any);
    return { id };
  }),
  update: protectedOpsProcedure.input(z.object({
    id: z.number(), title: z.string().optional(), description: z.string().optional(),
    status: z.enum(["active","paused","completed","archived"]).optional(),
    priority: z.enum(["low","medium","high","critical"]).optional(),
    color: z.string().optional(),
    pole: z.enum(["cosmetique_industrie","agro_industrie","retail_innovation","culture_evenementiel","institutionnel_diplomatie","autre"]).optional(),
    sequenceStatus: z.enum(["idee","planification","execution","monitoring"]).optional(),
    dependencyIndex: z.string().optional(), location: z.string().optional(),
    strategicHorizon: z.enum(["short_term","medium_term","long_term"]).optional(),
    monthlyPriority: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    if (data.monthlyPriority) {
      const count = await getOpsMonthlyPriorityCount(ctx.user.id);
      const proj = await getOpsProjectById(id, ctx.user.id);
      if (proj && !proj.monthlyPriority && count >= 3) throw new TRPCError({ code: "BAD_REQUEST", message: "Vous avez déjà 3 priorités du mois." });
    }
    await updateOpsProject(id, ctx.user.id, data as any);
    return { success: true };
  }),
});

// ─── Ideas Router ─────────────────────────────────────────────────────────────

const ideaOpsRouter = opsRouter({
  list: protectedOpsProcedure.query(({ ctx }) => getOpsIdeas(ctx.user.id)),
  create: protectedOpsProcedure.input(z.object({
    content: z.string().min(1), projectId: z.number().optional(),
    audioUrl: z.string().optional(), transcription: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    let projectId = input.projectId;
    let aiClassification: string | undefined;
    if (!projectId) {
      const projects = await getOpsProjects(ctx.user.id);
      if (projects.length > 0) {
        try {
          const prompt = buildIdeaClassificationPrompt(input.content, projects);
          const res = await invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "classification", strict: true, schema: { type: "object", properties: { projectId: { type: ["integer","null"] }, classification: { type: "string" }, suggestedProjectTitle: { type: ["string","null"] } }, required: ["projectId","classification","suggestedProjectTitle"], additionalProperties: false } } } });
          const parsed = JSON.parse(res.choices[0].message.content);
          projectId = parsed.projectId ?? undefined;
          aiClassification = parsed.classification;
        } catch { /* ignore */ }
      }
    }
    const id = await createOpsIdea({ ...input, projectId: projectId ?? null, aiClassification: aiClassification ?? null, userId: ctx.user.id });
    return { id, aiClassification };
  }),
  update: protectedOpsProcedure.input(z.object({
    id: z.number(), content: z.string().optional(), projectId: z.number().nullable().optional(),
    status: z.enum(["raw","reviewed","converted","archived"]).optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await updateOpsIdea(id, ctx.user.id, data as any);
    return { success: true };
  }),
  transcribeAndCreate: protectedOpsProcedure
    .input(z.object({ audioBase64: z.string(), mimeType: z.string(), language: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const transcription = await transcribeAudio(buffer, input.language ?? "fr");
      const projects = await getOpsProjects(ctx.user.id);
      let projectId: number | undefined;
      let aiClassification: string | undefined;
      if (projects.length > 0) {
        try {
          const prompt = buildIdeaClassificationPrompt(transcription, projects);
          const res = await invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "classification", strict: true, schema: { type: "object", properties: { projectId: { type: ["integer","null"] }, classification: { type: "string" }, suggestedProjectTitle: { type: ["string","null"] } }, required: ["projectId","classification","suggestedProjectTitle"], additionalProperties: false } } } });
          const parsed = JSON.parse(res.choices[0].message.content);
          projectId = parsed.projectId ?? undefined;
          aiClassification = parsed.classification;
        } catch { /* ignore */ }
      }
      const id = await createOpsIdea({ content: transcription, transcription, projectId: projectId ?? null, aiClassification: aiClassification ?? null, userId: ctx.user.id });
      return { id, transcription, projectId, aiClassification };
    }),
});

// ─── Conversations Router ─────────────────────────────────────────────────────

const conversationOpsRouter = opsRouter({
  list: protectedOpsProcedure.query(({ ctx }) => getOpsConversations(ctx.user.id)),
  getMessages: protectedOpsProcedure.input(z.object({ conversationId: z.number() })).query(({ ctx, input }) => getOpsMessages(input.conversationId, ctx.user.id)),
  create: protectedOpsProcedure.input(z.object({ title: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const id = await createOpsConversation({ userId: ctx.user.id, title: input.title ?? "Nouvelle conversation" });
    return { id };
  }),
  sendMessage: protectedOpsProcedure.input(z.object({
    conversationId: z.number(), content: z.string().min(1),
    language: z.enum(["fr","pt","en"]).optional().default("fr"),
  })).mutation(async ({ ctx, input }) => {
    await createOpsMessage({ conversationId: input.conversationId, userId: ctx.user.id, role: "user", content: input.content });
    const agentCtx = await buildAgentContext(ctx.user.id);
    const systemPrompt = buildSystemPrompt({ userName: ctx.user.name ?? "Utilisateur", language: input.language, ...agentCtx });
    const history = await getOpsMessages(input.conversationId, ctx.user.id);
    const historyMessages = history.slice(-20).map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));
    const response = await invokeLLM({ messages: [{ role: "system", content: systemPrompt }, ...historyMessages] });
    const assistantContent = response.choices[0].message.content;
    await createOpsMessage({ conversationId: input.conversationId, userId: ctx.user.id, role: "assistant", content: assistantContent });
    if (history.length === 0) await updateOpsConversation(input.conversationId, { title: input.content.substring(0, 60) + (input.content.length > 60 ? "..." : "") });
    else await updateOpsConversation(input.conversationId, { updatedAt: new Date() });
    extractAndSaveMemories(ctx.user.id, input.content, assistantContent).catch(() => {});
    return { content: assistantContent };
  }),
});

// ─── Reminders Router ─────────────────────────────────────────────────────────

const reminderOpsRouter = opsRouter({
  list: protectedOpsProcedure.query(({ ctx }) => getOpsReminders(ctx.user.id)),
  create: protectedOpsProcedure.input(z.object({
    title: z.string().min(1), content: z.string().optional(),
    dueAt: z.date().optional(), projectId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await createOpsReminder({ ...input, userId: ctx.user.id });
    return { id };
  }),
  update: protectedOpsProcedure.input(z.object({
    id: z.number(), status: z.enum(["pending","done","snoozed"]).optional(),
    title: z.string().optional(), content: z.string().optional(), dueAt: z.date().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await updateOpsReminder(id, ctx.user.id, data as any);
    return { success: true };
  }),
});

// ─── Tasks Router ─────────────────────────────────────────────────────────────

const taskOpsRouter = opsRouter({
  list: protectedOpsProcedure.query(({ ctx }) => getOpsTasks(ctx.user.id)),
  create: protectedOpsProcedure.input(z.object({
    title: z.string().min(1), description: z.string().optional(),
    projectId: z.number().optional(), priority: z.enum(["low","medium","high","critical"]).optional(),
    dueAt: z.date().optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await createOpsTask({ ...input, userId: ctx.user.id });
    return { id };
  }),
  update: protectedOpsProcedure.input(z.object({
    id: z.number(), title: z.string().optional(),
    status: z.enum(["todo","in_progress","done","cancelled"]).optional(),
    priority: z.enum(["low","medium","high","critical"]).optional(), dueAt: z.date().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await updateOpsTask(id, ctx.user.id, data as any);
    return { success: true };
  }),
});

// ─── Agent Router ─────────────────────────────────────────────────────────────

const agentOpsRouter = opsRouter({
  dailyBriefing: protectedOpsProcedure
    .input(z.object({ language: z.enum(["fr","pt","en"]).optional().default("fr") }))
    .mutation(async ({ ctx, input }) => {
      const agentCtx = await buildAgentContext(ctx.user.id);
      const systemPrompt = buildSystemPrompt({ userName: ctx.user.name ?? "Utilisateur", language: input.language, ...agentCtx });
      const prompt = buildDailyBriefingPrompt({ userName: ctx.user.name ?? "Utilisateur", language: input.language, ...agentCtx });
      const response = await invokeLLM({ messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] });
      return { briefing: response.choices[0].message.content };
    }),
  uploadAudio: protectedOpsProcedure
    .input(z.object({ audioBase64: z.string(), mimeType: z.string() }))
    .mutation(async ({ input }) => {
      const url = `data:${input.mimeType};base64,${input.audioBase64}`;
      return { url };
    }),

  extractDocumentText: protectedOpsProcedure
    .input(z.object({ fileBase64: z.string(), mimeType: z.string(), fileName: z.string() }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const mime = input.mimeType.toLowerCase();
      const name = input.fileName.toLowerCase();
      let text = "";

      if (mime === "application/pdf" || name.endsWith(".pdf")) {
        const data = await pdfParse(buffer);
        text = data.text.trim();
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mime === "application/vnd.ms-excel" ||
        name.endsWith(".xlsx") || name.endsWith(".xls")
      ) {
        const wb = XLSX.read(buffer, { type: "buffer" });
        const lines: string[] = [];
        for (const sheetName of wb.SheetNames) {
          lines.push(`=== Feuille: ${sheetName} ===`);
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
          lines.push(csv);
        }
        text = lines.join("\n");
      } else if (
        mime === "text/csv" || name.endsWith(".csv") ||
        mime === "text/plain" || name.endsWith(".txt") ||
        mime === "application/json" || name.endsWith(".json") ||
        name.endsWith(".md")
      ) {
        text = buffer.toString("utf-8");
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Format non supporté. Utilisez PDF, Excel (.xlsx), CSV ou texte (.txt)." });
      }

      if (!text.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Le document semble vide ou non lisible." });

      const MAX_CHARS = 20000;
      const truncated = text.length > MAX_CHARS;
      return {
        text: truncated ? text.slice(0, MAX_CHARS) + "\n\n[... document tronqué à 20 000 caractères]" : text,
        charCount: text.length,
        truncated,
      };
    }),
});

// ─── Synergies Router ─────────────────────────────────────────────────────────

const synergiesOpsRouter = opsRouter({
  analyze: protectedOpsProcedure
    .input(z.object({ language: z.enum(["fr","pt","en"]).optional().default("fr") }))
    .mutation(async ({ ctx, input }) => {
      const projects = await getOpsProjects(ctx.user.id);
      const activeProjects = projects.filter((p) => p.status === "active");
      if (activeProjects.length < 2) return { synergies: [], message: "Au moins 2 projets actifs sont nécessaires." };

      const POLE_LABELS_MAP: Record<string, string> = {
        cosmetique_industrie: "Cosmétique", agro_industrie: "Agro", retail_innovation: "Retail",
        culture_evenementiel: "Culture", institutionnel_diplomatie: "Institutionnel", autre: "Autre",
      };

      const projectList = activeProjects.map((p) => `ID:${p.id} | ${p.title} | Pôle: ${POLE_LABELS_MAP[p.pole]}`).join("\n");
      const langInstr = { fr: "Réponds en français.", pt: "Responda em português.", en: "Respond in English." };
      const prompt = `Analyse ces projets et identifie les synergies stratégiques:\n\n${projectList}\n\nRetourne: {"synergies":[{"projectId1":int,"projectId2":int,"type":"string","description":"string","opportunityScore":int,"recommendedAction":"string"}],"globalInsight":"string"}\n\n${langInstr[input.language]}`;

      const result = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_schema", json_schema: { name: "synergies_analysis", strict: true, schema: { type: "object", properties: { synergies: { type: "array", items: { type: "object", properties: { projectId1: { type: "integer" }, projectId2: { type: "integer" }, type: { type: "string" }, description: { type: "string" }, opportunityScore: { type: "integer" }, recommendedAction: { type: "string" } }, required: ["projectId1","projectId2","type","description","opportunityScore","recommendedAction"], additionalProperties: false } }, globalInsight: { type: "string" } }, required: ["synergies","globalInsight"], additionalProperties: false } } },
      });
      const parsed = JSON.parse(result.choices[0].message.content);
      const projectMap = new Map(activeProjects.map((p) => [p.id, p]));
      const enriched = parsed.synergies.map((s: any) => ({
        ...s,
        project1Title: projectMap.get(s.projectId1)?.title ?? `Projet #${s.projectId1}`,
        project2Title: projectMap.get(s.projectId2)?.title ?? `Projet #${s.projectId2}`,
      }));
      return { synergies: enriched, globalInsight: parsed.globalInsight };
    }),
});

// ─── Stripe stub (plan info only) ─────────────────────────────────────────────

const stripeOpsRouter = opsRouter({
  getSubscriptionInfo: protectedOpsProcedure.query(({ ctx }) => ({
    plan: ctx.user.plan,
    stripeCustomerId: ctx.user.stripeCustomerId,
  })),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appOpsRouter = opsRouter({
  auth: authOpsRouter,
  projects: projectOpsRouter,
  ideas: ideaOpsRouter,
  conversations: conversationOpsRouter,
  reminders: reminderOpsRouter,
  tasks: taskOpsRouter,
  agent: agentOpsRouter,
  synergies: synergiesOpsRouter,
  stripe: stripeOpsRouter,
});

export type AppOpsRouter = typeof appOpsRouter;
