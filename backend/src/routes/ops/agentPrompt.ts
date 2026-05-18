import type { OpsProject, OpsIdea, OpsReminder, OpsMemoryEntry, OpsTask } from "@workspace/db";

const POLE_LABELS: Record<string, string> = {
  cosmetique_industrie: "Cosmétique & Industrie (Reina Professional)",
  agro_industrie: "Agro-Industrie (Enam Agro)",
  retail_innovation: "Retail & Innovation (Mr. T Cool Soft / Mr. T Case)",
  culture_evenementiel: "Culture & Événementiel (SECMA, Arena Toffa, ADFA Awards)",
  institutionnel_diplomatie: "Institutionnel & Diplomatie",
  autre: "Autre",
};

const SEQUENCE_LABELS: Record<string, string> = {
  idee: "Idée", planification: "Planification", execution: "Exécution", monitoring: "Monitoring",
};

const HORIZON_LABELS: Record<string, string> = {
  short_term: "Court terme", medium_term: "Moyen terme", long_term: "Long terme",
};

type LangHeaders = {
  operationalContext: string; activeProjects: string; monthlyPriorities: string;
  recentIdeas: string; pendingReminders: string; ongoingTasks: string;
  persistentMemory: string; noActiveProjects: string; noMonthlyPriorities: string;
  noRecentIdeas: string; noReminders: string; noTasks: string; emptyMemory: string; monthlyPriorityLabel: string;
};

const LANG_HEADERS: Record<string, LangHeaders> = {
  fr: {
    operationalContext: "CONTEXTE OPÉRATIONNEL ACTUEL", activeProjects: "Projets Actifs",
    monthlyPriorities: "Priorités du Mois (max 3)", recentIdeas: "Idées Récentes",
    pendingReminders: "Rappels en Attente", ongoingTasks: "Tâches en Cours",
    persistentMemory: "MÉMOIRE PERSISTANTE", noActiveProjects: "Aucun projet actif.",
    noMonthlyPriorities: "Aucune priorité du mois.", noRecentIdeas: "Aucune idée récente.",
    noReminders: "Aucun rappel.", noTasks: "Aucune tâche.", emptyMemory: "Mémoire vide.",
    monthlyPriorityLabel: "PRIORITÉ DU MOIS",
  },
  pt: {
    operationalContext: "CONTEXTO OPERACIONAL ATUAL", activeProjects: "Projetos Ativos",
    monthlyPriorities: "Prioridades do Mês (máx 3)", recentIdeas: "Ideias Recentes",
    pendingReminders: "Lembretes Pendentes", ongoingTasks: "Tarefas em Andamento",
    persistentMemory: "MEMÓRIA PERSISTENTE", noActiveProjects: "Nenhum projeto ativo.",
    noMonthlyPriorities: "Nenhuma prioridade.", noRecentIdeas: "Nenhuma ideia recente.",
    noReminders: "Nenhum lembrete.", noTasks: "Nenhuma tarefa.", emptyMemory: "Memória vazia.",
    monthlyPriorityLabel: "PRIORIDADE DO MÊS",
  },
  en: {
    operationalContext: "CURRENT OPERATIONAL CONTEXT", activeProjects: "Active Projects",
    monthlyPriorities: "Monthly Priorities (max 3)", recentIdeas: "Recent Ideas",
    pendingReminders: "Pending Reminders", ongoingTasks: "Ongoing Tasks",
    persistentMemory: "PERSISTENT MEMORY", noActiveProjects: "No active projects.",
    noMonthlyPriorities: "No monthly priorities.", noRecentIdeas: "No recent ideas.",
    noReminders: "No reminders.", noTasks: "No tasks.", emptyMemory: "Empty memory.",
    monthlyPriorityLabel: "MONTHLY PRIORITY",
  },
};

const SYSTEM_PROMPTS: Record<string, (u: string, now: Date) => string> = {
  fr: (u, now) => `Tu es **KOSSI**, le Directeur des Opérations de ${u} — son bras droit stratégique, son second cerveau, son partenaire de confiance.

Tu n'es pas un simple assistant. Tu es KOSSI : un partenaire stratégique qui connaît tous les projets, identifie les synergies, transforme les idées en projets, maintient une mémoire persistante et est proactif.

Quand tu te présentes, dis toujours : "Bonjour, je suis KOSSI, votre Directeur des Opérations."

**Règles :** Sois direct et concis. Challenge les idées avec bienveillance. Extrait automatiquement tâches et rappels. Alerte si >3 priorités mensuelles.

**Date :** ${now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
  pt: (u, now) => `Você é **KOSSI**, o Diretor de Operações de ${u} — seu braço direito estratégico, segundo cérebro e parceiro de confiança. Quando se apresentar, diga sempre: "Olá, sou KOSSI, seu Diretor de Operações." Seja direto, proativo e estratégico. **Data:** ${now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
  en: (u, now) => `You are **KOSSI**, the Operations Director for ${u} — their strategic right hand, second brain and trusted partner. When introducing yourself, always say: "Hello, I'm KOSSI, your Operations Director." Be direct, proactive and strategic. **Date:** ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
};

export function buildSystemPrompt(context: {
  userName: string; language?: string;
  activeProjects: OpsProject[]; recentIdeas: OpsIdea[]; pendingReminders: OpsReminder[];
  memoryEntries: OpsMemoryEntry[]; pendingTasks: OpsTask[];
}): string {
  const { userName, activeProjects, recentIdeas, pendingReminders, memoryEntries, pendingTasks, language = "fr" } = context;
  const h = LANG_HEADERS[language] ?? LANG_HEADERS.fr;
  const sysPrompt = (SYSTEM_PROMPTS[language] ?? SYSTEM_PROMPTS.fr)(userName, new Date());
  const locale = language === "pt" ? "pt-BR" : language === "en" ? "en-US" : "fr-FR";

  const projectsCtx = activeProjects.length > 0
    ? activeProjects.map((p) => `- **${p.title}** [${POLE_LABELS[p.pole]}] | ${SEQUENCE_LABELS[p.sequenceStatus]} | ${p.priority}${p.monthlyPriority ? ` ⭐ ${h.monthlyPriorityLabel}` : ""}${p.dependencyIndex ? ` | Blocage: ${p.dependencyIndex}` : ""}`).join("\n")
    : h.noActiveProjects;

  const ideasCtx = recentIdeas.length > 0
    ? recentIdeas.slice(0, 5).map((i) => `- "${i.content.substring(0, 100)}..." [${i.status}]`).join("\n")
    : h.noRecentIdeas;

  const remindersCtx = pendingReminders.length > 0
    ? pendingReminders.slice(0, 5).map((r) => `- **${r.title}**${r.dueAt ? ` (${new Date(r.dueAt).toLocaleDateString(locale)})` : ""}${r.content ? `: ${r.content}` : ""}`).join("\n")
    : h.noReminders;

  const tasksCtx = pendingTasks.length > 0
    ? pendingTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").slice(0, 8).map((t) => `- [${t.status}] ${t.title} | ${t.priority}`).join("\n")
    : h.noTasks;

  const memoryCtx = memoryEntries.length > 0
    ? memoryEntries.slice(0, 15).map((m) => `[${m.type}/${m.importance}] ${m.content}`).join("\n")
    : h.emptyMemory;

  return `${sysPrompt}\n\n---\n\n## ${h.operationalContext}\n\n### ${h.activeProjects} (${activeProjects.length})\n${projectsCtx}\n\n### ${h.monthlyPriorities}\n${activeProjects.filter((p) => p.monthlyPriority).map((p) => `- ${p.title}`).join("\n") || h.noMonthlyPriorities}\n\n### ${h.recentIdeas}\n${ideasCtx}\n\n### ${h.pendingReminders}\n${remindersCtx}\n\n### ${h.ongoingTasks}\n${tasksCtx}\n\n---\n\n## ${h.persistentMemory}\n${memoryCtx}`;
}

export function buildMemoryExtractionPrompt(conversation: string): string {
  return `Analyse cette conversation et extrait les informations importantes à mémoriser.

Conversation:
${conversation}

Retourne un JSON avec ce format exact:
{"memories":[{"type":"fact|preference|project_context|decision|reminder_context|synergy","content":"string","importance":"low|medium|high"}],"tasks":[{"title":"string","description":"string","priority":"low|medium|high|critical"}],"reminders":[{"title":"string","content":"string"}]}

Extrait uniquement ce qui est vraiment important. Si rien à extraire, retourne des tableaux vides.`;
}

export function buildIdeaClassificationPrompt(ideaContent: string, projects: OpsProject[]): string {
  const projectList = projects.map((p) => `ID:${p.id} - ${p.title} (${POLE_LABELS[p.pole]})`).join("\n");
  return `Analyse cette idée et détermine à quel projet elle appartient.

Idée: "${ideaContent}"

Projets:
${projectList || "Aucun projet"}

Retourne: {"projectId":<id ou null>,"classification":"explication courte","suggestedProjectTitle":<"titre" ou null>}`;
}

export function buildDailyBriefingPrompt(context: {
  userName: string; language?: string;
  activeProjects: OpsProject[]; pendingTasks: OpsTask[];
  pendingReminders: OpsReminder[]; recentIdeas: OpsIdea[];
}): string {
  const { userName, activeProjects, pendingTasks, pendingReminders, recentIdeas, language = "fr" } = context;
  const instructions: Record<string, string> = {
    fr: `Génère un briefing quotidien concis (3-5 phrases) et percutant pour ${userName}.`,
    pt: `Gere um briefing diário conciso (3-5 frases) e impactante para ${userName}.`,
    en: `Generate a concise daily briefing (3-5 sentences) for ${userName}.`,
  };
  return `${instructions[language] ?? instructions.fr}

- Projets actifs: ${activeProjects.length} dont ${activeProjects.filter((p) => p.monthlyPriority).length} priorités du mois
- Tâches en cours: ${pendingTasks.filter((t) => t.status !== "done").length}
- Rappels: ${pendingReminders.length}
- Idées non traitées: ${recentIdeas.filter((i) => i.status === "raw").length}

Priorités du mois: ${activeProjects.filter((p) => p.monthlyPriority).map((p) => p.title).join(", ") || "Aucune"}
Rappels urgents: ${pendingReminders.slice(0, 3).map((r) => r.title).join(", ") || "Aucun"}`;
}
