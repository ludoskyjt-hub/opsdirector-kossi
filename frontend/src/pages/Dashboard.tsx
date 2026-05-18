import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import {
  Loader2, Brain, FolderOpen, Lightbulb, Bell,
  CheckSquare, Zap, Star, AlertTriangle, Network,
  TrendingUp, BarChart2, Sparkles, ArrowRight,
  ChevronRight, Target, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";

/* ─── Labels ─────────────────────────────────────────────────── */
const POLE_LABELS: Record<string, string> = {
  cosmetique_industrie: "Cosmétique",
  agro_industrie: "Agro",
  retail_innovation: "Retail",
  culture_evenementiel: "Culture",
  institutionnel_diplomatie: "Institutionnel",
  autre: "Autre",
};

const POLE_COLORS: Record<string, string> = {
  cosmetique_industrie: "oklch(0.75 0.12 75)",
  agro_industrie: "oklch(0.72 0.18 145)",
  retail_innovation: "oklch(0.70 0.16 220)",
  culture_evenementiel: "oklch(0.68 0.18 300)",
  institutionnel_diplomatie: "oklch(0.65 0.14 30)",
  autre: "oklch(0.55 0.008 270)",
};

const POLE_CLASS: Record<string, string> = {
  cosmetique_industrie: "pole-cosmetique",
  agro_industrie: "pole-agro",
  retail_innovation: "pole-retail",
  culture_evenementiel: "pole-culture",
  institutionnel_diplomatie: "pole-institutionnel",
  autre: "pole-autre",
};

const SEQUENCE_LABELS: Record<string, string> = {
  idee: "Idée",
  planification: "Planification",
  execution: "Exécution",
  monitoring: "Monitoring",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "oklch(0.55 0.008 270)",
  in_progress: "oklch(0.70 0.16 220)",
  done: "oklch(0.72 0.18 145)",
  cancelled: "oklch(0.45 0.008 270)",
};

/* ─── Custom Tooltip ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "oklch(0.85 0.005 270)" }}>
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || "oklch(0.75 0.12 75)" }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────────── */
function SectionTitle({ icon: Icon, label, color = "text-primary", action, onAction }: {
  icon: React.ElementType; label: string; color?: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: "oklch(0.75 0.12 75 / 0.12)", border: "1px solid oklch(0.75 0.12 75 / 0.2)" }}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <h2 className="text-xs font-bold uppercase tracking-[0.12em]"
          style={{ color: "oklch(0.70 0.008 60)" }}>{label}</h2>
      </div>
      {action && onAction && (
        <button onClick={onAction}
          className="flex items-center gap-1 text-xs font-medium transition-all hover:gap-2"
          style={{ color: "oklch(0.75 0.12 75)" }}>
          {action}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/* ─── Glass card ─────────────────────────────────────────────── */
function Card({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: glow
          ? "0 0 30px oklch(0.75 0.12 75 / 0.08), 0 8px 32px rgba(0,0,0,0.35)"
          : "0 4px 24px rgba(0,0,0,0.25)",
      }}>
      {children}
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, color, sub, badge, onClick }: {
  icon: React.ElementType; label: string; value: number; color: string;
  sub: string; badge?: number | null; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-5 text-left transition-all hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer relative overflow-hidden group"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
      }}>
      {/* Subtle corner glow */}
      <div className="absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity rounded-full blur-2xl pointer-events-none"
        style={{ background: `${color.replace("text-", "")} / 0.08`, transform: "translate(30%, -30%)" }} />

      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "oklch(0.75 0.12 75 / 0.10)", border: "1px solid oklch(0.75 0.12 75 / 0.15)" }}>
          <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: "18px", height: "18px" }} />
        </div>
        {badge != null && badge > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "oklch(0.65 0.20 25 / 0.15)", color: "oklch(0.65 0.20 25)", border: "1px solid oklch(0.65 0.20 25 / 0.3)" }}>
            {badge}
          </span>
        )}
      </div>

      <p className="text-3xl font-bold mb-0.5 leading-none gradient-text">{value}</p>
      <p className="text-xs font-medium mb-1" style={{ color: "oklch(0.85 0.008 60)" }}>{label}</p>
      <p className="text-xs" style={{ color: "oklch(0.45 0.006 60)" }}>{sub}</p>
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function Dashboard() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [filterProject, setFilterProject] = useState<number | "all">("all");
  const [filterUrgency, setFilterUrgency] = useState<"all" | "critique" | "urgent" | "proche">("all");

  const { data: projects } = trpc.projects.list.useQuery(undefined, { enabled: !!user });
  const { data: ideas } = trpc.ideas.list.useQuery(undefined, { enabled: !!user });
  const { data: reminders } = trpc.reminders.list.useQuery(undefined, { enabled: !!user });
  const { data: tasks } = trpc.tasks.list.useQuery(undefined, { enabled: !!user });

  const { lang } = useLanguage();

  const dailyBriefingMutation = trpc.agent.dailyBriefing.useMutation({
    onSuccess: (data) => setBriefing(data.briefing),
    onError: () => toast.error("Erreur lors du briefing"),
  });

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  /* ── Computed data ── */
  const activeProjects = useMemo(() => projects?.filter((p) => p.status === "active") || [], [projects]);
  const monthlyPriorities = useMemo(() => activeProjects.filter((p) => p.monthlyPriority), [activeProjects]);
  const rawIdeas = useMemo(() => ideas?.filter((i) => i.status === "raw") || [], [ideas]);
  const pendingTasks = useMemo(() => tasks?.filter((t) => t.status !== "done" && t.status !== "cancelled") || [], [tasks]);
  const allTasks = useMemo(() => tasks || [], [tasks]);

  const projectsByPole = useMemo(() => {
    const counts: Record<string, number> = {};
    activeProjects.forEach((p) => {
      const pole = p.pole || "autre";
      counts[pole] = (counts[pole] || 0) + 1;
    });
    return Object.entries(counts).map(([pole, count]) => ({
      name: POLE_LABELS[pole] || pole,
      value: count,
      color: POLE_COLORS[pole] || POLE_COLORS.autre,
    }));
  }, [activeProjects]);

  const tasksByStatus = useMemo(() => {
    const counts: Record<string, number> = { todo: 0, in_progress: 0, done: 0, cancelled: 0 };
    allTasks.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return [
      { name: "À faire", value: counts.todo, color: TASK_STATUS_COLORS.todo },
      { name: "En cours", value: counts.in_progress, color: TASK_STATUS_COLORS.in_progress },
      { name: "Terminé", value: counts.done, color: TASK_STATUS_COLORS.done },
    ].filter((d) => d.value > 0);
  }, [allTasks]);

  const projectProgress = useMemo(() => {
    return activeProjects.slice(0, 6).map((p) => {
      const projectTasks = allTasks.filter((t) => t.projectId === p.id);
      const done = projectTasks.filter((t) => t.status === "done").length;
      const total = projectTasks.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        name: p.title.length > 14 ? p.title.slice(0, 14) + "…" : p.title,
        fullName: p.title,
        progress: pct, done, total,
        color: p.color || "oklch(0.75 0.12 75)",
      };
    });
  }, [activeProjects, allTasks]);

  const activityData = useMemo(() => {
    const days: { date: string; label: string; ideas: number; conversations: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("fr-FR", { weekday: "short" });
      const ideasCount = (ideas || []).filter((idea) => {
        const created = new Date(idea.createdAt).toISOString().slice(0, 10);
        return created === dateStr;
      }).length;
      days.push({ date: dateStr, label, ideas: ideasCount, conversations: 0 });
    }
    return days;
  }, [ideas]);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return allTasks
      .filter((t) => {
        if (t.status === "done" || t.status === "cancelled") return false;
        if (!t.dueAt) return false;
        const due = new Date(t.dueAt);
        return due >= now && due <= in7Days;
      })
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
  }, [allTasks]);

  const filteredUpcomingTasks = useMemo(() => {
    return upcomingTasks.filter((task) => {
      if (filterProject !== "all" && task.projectId !== filterProject) return false;
      if (filterUrgency !== "all") {
        const diff = Math.ceil((new Date(task.dueAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (filterUrgency === "critique" && diff > 1) return false;
        if (filterUrgency === "urgent" && (diff <= 1 || diff > 3)) return false;
        if (filterUrgency === "proche" && diff <= 3) return false;
      }
      return true;
    });
  }, [upcomingTasks, filterProject, filterUrgency]);

  const getUrgencyStyle = (dueAt: Date | string) => {
    const diff = Math.ceil((new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff <= 1) return { color: "oklch(0.65 0.20 25)", bg: "oklch(0.13 0.05 25 / 0.6)", border: "oklch(0.65 0.20 25 / 0.25)", label: diff <= 0 ? "Aujourd'hui" : "Demain" };
    if (diff <= 3) return { color: "oklch(0.75 0.18 75)", bg: "oklch(0.12 0.04 75 / 0.6)", border: "oklch(0.75 0.18 75 / 0.25)", label: `${diff}j` };
    return { color: "oklch(0.70 0.16 220)", bg: "oklch(0.11 0.04 220 / 0.6)", border: "oklch(0.70 0.16 220 / 0.25)", label: `${diff}j` };
  };

  const taskCompletionRate = useMemo(() => {
    if (allTasks.length === 0) return 0;
    const done = allTasks.filter((t) => t.status === "done").length;
    return Math.round((done / allTasks.length) * 100);
  }, [allTasks]);

  const ideasConverted = useMemo(() => {
    return (ideas || []).filter((i) => i.status === "converted").length;
  }, [ideas]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const handleBriefing = async () => {
    setLoadingBriefing(true);
    await dailyBriefingMutation.mutateAsync({ language: lang });
    setLoadingBriefing(false);
  };

  const hasData = activeProjects.length > 0 || allTasks.length > 0;

  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-8">

        {/* ── HERO HEADER ─────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, var(--card) 0%, oklch(0.11 0.018 245) 100%)",
            border: "1px solid oklch(0.75 0.12 75 / 0.18)",
            boxShadow: "0 0 40px oklch(0.75 0.12 75 / 0.05)",
          }}>
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full blur-3xl"
              style={{ background: "oklch(0.75 0.12 75 / 0.06)" }} />
            <div className="absolute -bottom-10 right-10 w-48 h-48 rounded-full blur-3xl"
              style={{ background: "oklch(0.60 0.10 260 / 0.05)" }} />
          </div>

          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-4 text-xs font-medium"
                  style={{ background: "oklch(0.75 0.12 75 / 0.10)", border: "1px solid oklch(0.75 0.12 75 / 0.25)", color: "oklch(0.82 0.10 75)" }}>
                  <Sparkles className="w-3 h-3" />
                  {today.charAt(0).toUpperCase() + today.slice(1)}
                </div>

                {/* Greeting */}
                <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Bonjour,{" "}
                  <span className="gradient-text">
                    {user.name?.split(" ")[0] || "Julien"}
                  </span>
                </h1>
                <p className="text-sm" style={{ color: "oklch(0.55 0.006 60)" }}>
                  Votre espace de direction est prêt — que souhaitez-vous accomplir ?
                </p>
              </div>

              <button
                onClick={handleBriefing}
                disabled={loadingBriefing}
                className="self-start md:self-auto flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))",
                  color: "oklch(0.08 0.005 270)",
                  boxShadow: "0 4px 20px oklch(0.75 0.12 75 / 0.30)",
                }}>
                {loadingBriefing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Zap className="w-4 h-4" />}
                Briefing du jour
              </button>
            </div>
          </div>
        </div>

        {/* ── DAILY BRIEFING ─────────────────────────────────────── */}
        {briefing && (
          <Card glow>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 gold-glow"
                style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))" }}>
                <Brain className="w-4 h-4" style={{ color: "oklch(0.08 0.005 270)" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] gradient-text">Briefing Directeur KOSSI</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.80 0.006 60)" }}>{briefing}</p>
              </div>
            </div>
          </Card>
        )}

        {/* ── KPI CARDS ──────────────────────────────────────────── */}
        <div>
          <SectionTitle icon={Activity} label="Vue d'ensemble" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <KpiCard icon={FolderOpen} label="Projets actifs" value={activeProjects.length} color="text-amber-400"
              sub={`${monthlyPriorities.length} priorité${monthlyPriorities.length !== 1 ? "s" : ""} ce mois`}
              onClick={() => navigate("/projects")} />
            <KpiCard icon={CheckSquare} label="Tâches en cours" value={pendingTasks.length} color="text-emerald-400"
              sub={`${taskCompletionRate}% complétées`}
              badge={upcomingTasks.length > 0 ? upcomingTasks.length : null}
              onClick={() => navigate("/reminders")} />
            <KpiCard icon={Lightbulb} label="Idées à traiter" value={rawIdeas.length} color="text-sky-400"
              sub={`${ideasConverted} converties en projets`}
              onClick={() => navigate("/ideas")} />
            <KpiCard icon={Bell} label="Rappels actifs" value={reminders?.length || 0} color="text-rose-400"
              sub="en attente de validation"
              onClick={() => navigate("/reminders")} />
          </div>
        </div>

        {/* ── CHARTS ROW 1 ───────────────────────────────────────── */}
        {hasData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <SectionTitle icon={BarChart2} label="Projets par Pôle" />
              {projectsByPole.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={projectsByPole} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "oklch(0.45 0.006 60)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "oklch(0.45 0.006 60)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Projets" radius={[5, 5, 0, 0]}>
                      {projectsByPole.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center">
                  <p className="text-xs" style={{ color: "oklch(0.40 0.006 60)" }}>Aucun projet actif</p>
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle icon={CheckSquare} label="Distribution des Tâches" color="text-emerald-400" />
              {tasksByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={tasksByStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {tasksByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(value) => <span style={{ color: "oklch(0.55 0.006 60)", fontSize: 11 }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center">
                  <p className="text-xs" style={{ color: "oklch(0.40 0.006 60)" }}>Aucune tâche créée</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── CHARTS ROW 2 ───────────────────────────────────────── */}
        {hasData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <SectionTitle icon={TrendingUp} label="Activité — 7 derniers jours" color="text-sky-400" />
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={activityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fill: "oklch(0.45 0.006 60)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "oklch(0.45 0.006 60)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="ideas" name="Idées" stroke="oklch(0.70 0.16 220)" strokeWidth={2} dot={{ r: 3, fill: "oklch(0.70 0.16 220)" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <SectionTitle icon={FolderOpen} label="Progression des Projets" action="Voir tout" onAction={() => navigate("/projects")} />
              {projectProgress.length > 0 ? (
                <div className="space-y-3.5">
                  {projectProgress.map((p) => (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium truncate max-w-[160px]"
                          style={{ color: "oklch(0.75 0.008 60)" }} title={p.fullName}>{p.name}</span>
                        <span className="text-xs ml-2 flex-shrink-0"
                          style={{ color: "oklch(0.45 0.006 60)" }}>
                          {p.total > 0 ? `${p.done}/${p.total}` : "0 tâche"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${p.progress}%`,
                            background: p.total > 0
                              ? "linear-gradient(90deg, oklch(0.75 0.12 75), oklch(0.82 0.14 85))"
                              : "var(--border)",
                            minWidth: p.progress > 0 ? "4px" : "0",
                            boxShadow: p.progress > 0 ? "0 0 8px oklch(0.75 0.12 75 / 0.40)" : "none",
                          }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center py-8" style={{ color: "oklch(0.40 0.006 60)" }}>
                  Créez des projets pour voir leur progression
                </p>
              )}
            </Card>
          </div>
        )}

        {/* ── ÉCHÉANCES PROCHES ──────────────────────────────────── */}
        {upcomingTasks.length > 0 && (
          <div>
            <SectionTitle
              icon={AlertTriangle}
              label={`Échéances Proches — ${filteredUpcomingTasks.length}/${upcomingTasks.length} tâche${upcomingTasks.length > 1 ? "s" : ""}`}
              color="text-rose-400"
              action="Voir tout"
              onAction={() => navigate("/reminders")}
            />

            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex items-center gap-1 rounded-xl p-1"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {([
                  { key: "all" as const, label: "Tous", color: undefined as string | undefined },
                  { key: "critique" as const, label: "Critique", color: "oklch(0.65 0.20 25)" as string | undefined },
                  { key: "urgent" as const, label: "Urgent", color: "oklch(0.75 0.18 75)" as string | undefined },
                  { key: "proche" as const, label: "Proche", color: "oklch(0.70 0.16 220)" as string | undefined },
                ]).map(({ key, label, color }) => (
                  <button key={key} onClick={() => setFilterUrgency(key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={filterUrgency === key
                      ? { background: (color as string | undefined) || "oklch(0.75 0.12 75)", color: "oklch(0.08 0.005 270)" }
                      : { color: "oklch(0.45 0.006 60)" }}>
                    {label}
                  </button>
                ))}
              </div>

              {activeProjects.length > 0 && (
                <select
                  value={filterProject === "all" ? "all" : String(filterProject)}
                  onChange={(e) => setFilterProject(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="text-xs rounded-xl px-3 py-1.5 cursor-pointer"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: filterProject === "all" ? "oklch(0.45 0.006 60)" : "oklch(0.85 0.005 270)", outline: "none" }}>
                  <option value="all">Tous les projets</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.title}</option>
                  ))}
                </select>
              )}

              {(filterProject !== "all" || filterUrgency !== "all") && (
                <button
                  onClick={() => { setFilterProject("all"); setFilterUrgency("all"); }}
                  className="text-xs px-3 py-1.5 rounded-xl transition-all"
                  style={{ border: "1px solid var(--border)", color: "oklch(0.45 0.006 60)" }}>
                  Réinitialiser
                </button>
              )}
            </div>

            {filteredUpcomingTasks.length > 0 ? (
              <div className="space-y-2">
                {filteredUpcomingTasks.map((task) => {
                  const urgency = getUrgencyStyle(task.dueAt!);
                  const project = projects?.find((p) => p.id === task.projectId);
                  return (
                    <div key={task.id}
                      className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer hover:scale-[1.005] transition-all"
                      style={{ background: urgency.bg, border: `1px solid ${urgency.border}`, backdropFilter: "blur(12px)" }}
                      onClick={() => navigate("/reminders")}>
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center"
                        style={{ background: `${urgency.color} / 0.10`, border: `1px solid ${urgency.border}` }}>
                        <span className="text-xs font-bold" style={{ color: urgency.color }}>{urgency.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "oklch(0.90 0.006 60)" }}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {project && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${POLE_CLASS[project.pole] || "pole-autre"}`}>
                              {project.title}
                            </span>
                          )}
                          <span className="text-xs" style={{ color: "oklch(0.45 0.006 60)" }}>
                            {new Date(task.dueAt!).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                        </div>
                      </div>
                      {task.priority === "critical" && (
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: urgency.color }} />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 rounded-2xl"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <CheckSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "oklch(0.28 0.006 270)" }} />
                <p className="text-sm" style={{ color: "oklch(0.45 0.006 60)" }}>Aucune tâche ne correspond aux filtres</p>
                <button onClick={() => { setFilterProject("all"); setFilterUrgency("all"); }}
                  className="mt-2 text-xs" style={{ color: "oklch(0.75 0.12 75)" }}>
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PRIORITÉS DU MOIS ─────────────────────────────────── */}
        {monthlyPriorities.length > 0 && (
          <div>
            <SectionTitle icon={Target} label={`Priorités du Mois (${monthlyPriorities.length}/3)`} color="text-yellow-400" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {monthlyPriorities.map((p, i) => (
                <div key={p.id}
                  className="rounded-2xl p-5 cursor-pointer hover:scale-[1.01] hover:-translate-y-0.5 transition-all relative overflow-hidden"
                  style={{
                    background: "var(--card)",
                    border: "1px solid oklch(0.75 0.12 75 / 0.18)",
                    backdropFilter: "blur(20px)",
                  }}
                  onClick={() => navigate("/projects")}>
                  <div className="absolute top-0 left-0 w-full h-0.5"
                    style={{ background: "linear-gradient(90deg, oklch(0.75 0.12 75 / 0.8), transparent)" }} />
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${POLE_CLASS[p.pole] || "pole-autre"}`}>
                      {POLE_LABELS[p.pole] || p.pole}
                    </span>
                    <span className="text-xs" style={{ color: "oklch(0.40 0.006 60)" }}>#{i + 1}</span>
                  </div>
                  <p className="text-sm font-semibold mt-2 mb-1" style={{ color: "oklch(0.88 0.006 60)", fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {p.title}
                  </p>
                  <p className="text-xs" style={{ color: "oklch(0.40 0.006 60)" }}>{SEQUENCE_LABELS[p.sequenceStatus] || p.sequenceStatus}</p>
                  {p.location && <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.006 60)" }}>📍 {p.location}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── IDÉES RÉCENTES ─────────────────────────────────────── */}
        {rawIdeas.length > 0 && (
          <div>
            <SectionTitle icon={Lightbulb} label="Idées à Traiter" color="text-sky-400" action="Voir tout" onAction={() => navigate("/ideas")} />
            <div className="space-y-2">
              {rawIdeas.slice(0, 3).map((idea) => (
                <div key={idea.id}
                  className="rounded-2xl p-4 hover:scale-[1.005] transition-all cursor-pointer"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    backdropFilter: "blur(20px)",
                  }}
                  onClick={() => navigate("/ideas")}>
                  <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "oklch(0.78 0.006 60)" }}>{idea.content}</p>
                  {idea.aiClassification && (
                    <p className="text-xs mt-1.5" style={{ color: "oklch(0.50 0.010 220)" }}>🤖 {idea.aiClassification}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RAPPELS ────────────────────────────────────────────── */}
        {(reminders?.length ?? 0) > 0 && (
          <div>
            <SectionTitle icon={Bell} label="Rappels" color="text-amber-400" action="Voir tout" onAction={() => navigate("/reminders")} />
            <div className="space-y-2">
              {reminders!.slice(0, 3).map((r) => (
                <div key={r.id}
                  className="flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-[1.005] cursor-pointer"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    backdropFilter: "blur(20px)",
                  }}
                  onClick={() => navigate("/reminders")}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "oklch(0.75 0.14 75 / 0.10)", border: "1px solid oklch(0.75 0.14 75 / 0.20)" }}>
                    <Bell className="w-3.5 h-3.5" style={{ color: "oklch(0.75 0.14 75)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.006 60)" }}>{r.title}</p>
                    {r.dueAt && (
                      <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.006 60)" }}>
                        {new Date(r.dueAt).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.30 0.006 60)" }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INTERCONNEXIONS ────────────────────────────────────── */}
        {activeProjects.length > 1 && (() => {
          const poleGroups: Record<string, typeof activeProjects> = {};
          activeProjects.forEach((p) => {
            const pole = p.pole || "autre";
            if (!poleGroups[pole]) poleGroups[pole] = [];
            poleGroups[pole].push(p);
          });
          const polesWithMultiple = Object.entries(poleGroups).filter(([, ps]) => ps.length > 1);
          if (polesWithMultiple.length === 0) return null;
          return (
            <div>
              <SectionTitle icon={Network} label="Interconnexions Stratégiques" color="text-violet-400" />
              <div className="space-y-2">
                {polesWithMultiple.map(([pole, ps]) => (
                  <div key={pole} className="p-4 rounded-2xl"
                    style={{ background: "var(--card)", border: "1px solid oklch(0.28 0.012 290 / 0.4)", backdropFilter: "blur(20px)" }}>
                    <p className="text-xs font-medium mb-2.5" style={{ color: "oklch(0.68 0.14 290)" }}>{POLE_LABELS[pole] || pole}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ps.map((p) => (
                        <span key={p.id} className="text-xs px-2.5 py-1 rounded-full"
                          style={{ background: "oklch(0.22 0.012 290 / 0.5)", border: "1px solid oklch(0.32 0.016 290 / 0.5)", color: "oklch(0.75 0.008 290)" }}>
                          {p.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── PÔLES ACTIFS ───────────────────────────────────────── */}
        {activeProjects.length > 0 && (() => {
          const poleStats: Record<string, { count: number; priorities: string[]; sequences: string[] }> = {};
          activeProjects.forEach((p) => {
            const pole = p.pole || "autre";
            if (!poleStats[pole]) poleStats[pole] = { count: 0, priorities: [], sequences: [] };
            poleStats[pole].count++;
            if (p.monthlyPriority) poleStats[pole].priorities.push(p.title);
            if (!poleStats[pole].sequences.includes(p.sequenceStatus)) poleStats[pole].sequences.push(p.sequenceStatus);
          });
          const poles = Object.entries(poleStats);
          if (poles.length === 0) return null;
          return (
            <div>
              <SectionTitle icon={BarChart2} label="Pôles Actifs" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {poles.map(([pole, stats]) => (
                  <div key={pole}
                    className="rounded-2xl p-5 cursor-pointer hover:scale-[1.01] hover:-translate-y-0.5 transition-all relative overflow-hidden"
                    style={{
                      background: "var(--card)",
                      border: `1px solid ${POLE_COLORS[pole] || POLE_COLORS.autre}28`,
                      backdropFilter: "blur(20px)",
                    }}
                    onClick={() => navigate("/projects")}>
                    <div className="absolute top-0 left-0 w-full h-0.5"
                      style={{ background: `linear-gradient(90deg, ${POLE_COLORS[pole] || POLE_COLORS.autre}, transparent)` }} />
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: POLE_COLORS[pole] || POLE_COLORS.autre, boxShadow: `0 0 8px ${POLE_COLORS[pole] || POLE_COLORS.autre}60` }} />
                      <span className="text-xs font-semibold truncate" style={{ color: "oklch(0.75 0.008 60)" }}>
                        {POLE_LABELS[pole] || pole}
                      </span>
                    </div>
                    <p className="text-2xl font-bold mb-1" style={{ color: POLE_COLORS[pole] || POLE_COLORS.autre }}>
                      {stats.count}
                    </p>
                    <p className="text-xs" style={{ color: "oklch(0.40 0.006 60)" }}>
                      {stats.count === 1 ? "projet" : "projets"}
                    </p>
                    {stats.priorities.length > 0 && (
                      <div className="mt-2 flex items-center gap-1">
                        <Star className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.80 0.16 75)" }} />
                        <span className="text-xs truncate" style={{ color: "oklch(0.75 0.14 75)" }}>{stats.priorities[0]}</span>
                      </div>
                    )}
                    {stats.sequences.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs" style={{ color: "oklch(0.38 0.006 60)" }}>
                          {stats.sequences.map(s => SEQUENCE_LABELS[s] || s).join(" · ")}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── EMPTY STATE ────────────────────────────────────────── */}
        {activeProjects.length === 0 && rawIdeas.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 gold-glow"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75 / 0.15), oklch(0.65 0.10 55 / 0.10))", border: "1px solid oklch(0.75 0.12 75 / 0.20)" }}>
              <Brain className="w-8 h-8" style={{ color: "oklch(0.75 0.12 75)" }} />
            </div>
            <h3 className="text-xl font-bold mb-2"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "oklch(0.88 0.006 60)" }}>
              Bienvenue dans votre espace
            </h3>
            <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: "oklch(0.50 0.006 60)" }}>
              Commencez par discuter avec KOSSI ou créez votre premier projet.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => navigate("/chat")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))",
                  color: "oklch(0.08 0.005 270)",
                  boxShadow: "0 4px 20px oklch(0.75 0.12 75 / 0.30)",
                }}>
                <Brain className="w-4 h-4" />
                Parler à l'agent
              </button>
              <button onClick={() => navigate("/projects")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "oklch(0.75 0.008 60)",
                }}>
                <FolderOpen className="w-4 h-4" />
                Créer un projet
              </button>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
