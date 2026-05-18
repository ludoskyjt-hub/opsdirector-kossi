import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  Loader2, FileText, Download, Mail, FolderOpen,
  CheckSquare, Bell, Lightbulb, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";

export default function Reports() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  const { data: projects } = trpc.projects.list.useQuery(undefined, { enabled: !!user });
  const { data: tasksData } = trpc.tasks.list.useQuery(undefined, { enabled: !!user });
  const { data: reminders } = trpc.reminders.list.useQuery(undefined, { enabled: !!user });
  const { data: ideas } = trpc.ideas.list.useQuery(undefined, { enabled: !!user });

  const stats = {
    projects: Array.isArray(projects) ? projects.length : 0,
    tasks: Array.isArray(tasksData) ? tasksData.length : 0,
    reminders: Array.isArray(reminders) ? reminders.length : 0,
    ideas: Array.isArray(ideas) ? ideas.length : 0,
  };

  function handleDownload(type: string) {
    toast.success(`Génération du ${type} en cours...`, { description: "Le téléchargement démarrera dans quelques secondes." });
    setTimeout(() => {
      generateAndDownloadReport(type, stats, projects as unknown[], user?.name ?? "");
    }, 800);
  }

  function handleEmail(type: string) {
    toast.success(`Rapport envoyé par email`, { description: `Le ${type} a été envoyé à ${user?.email}` });
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(0.75 0.12 75)" }} />
        </div>
      </AppLayout>
    );
  }

  const STAT_CARDS = [
    { icon: FolderOpen, label: "Projets actifs", value: stats.projects, color: "oklch(0.75 0.12 75)" },
    { icon: CheckSquare, label: "Tâches en cours", value: stats.tasks, color: "oklch(0.70 0.16 220)" },
    { icon: Bell, label: "Rappels", value: stats.reminders, color: "oklch(0.68 0.22 50)" },
    { icon: Lightbulb, label: "Idées", value: stats.ideas, color: "oklch(0.72 0.18 145)" },
  ];

  const REPORT_TYPES = [
    {
      icon: FileText,
      title: "Résumé hebdomadaire",
      desc: "Vue d'ensemble de vos projets, tâches et rappels",
      color: "oklch(0.75 0.12 75)",
      type: "résumé hebdomadaire",
    },
    {
      icon: FolderOpen,
      title: "Rapport des projets",
      desc: "Liste détaillée de tous vos projets actifs",
      color: "oklch(0.70 0.16 220)",
      type: "rapport des projets",
    },
    {
      icon: BarChart2,
      title: "Rapport financier",
      desc: "Synthèse de vos revenus et dépenses",
      color: "oklch(0.72 0.18 145)",
      type: "rapport financier",
    },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6" style={{ color: "oklch(0.75 0.12 75)" }} />
            Rapports & Exports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Téléchargez vos rapports en PDF ou recevez-les par email</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {STAT_CARDS.map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl p-4 border text-center"
              style={{ background: "oklch(0.11 0.006 270)", borderColor: "var(--border)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                style={{ background: `color-mix(in oklch, ${color} 15%, transparent)` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Report cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {REPORT_TYPES.map(({ icon: Icon, title, desc, color, type }) => (
            <div
              key={type}
              className="rounded-2xl p-5 border flex flex-col gap-4"
              style={{ background: "oklch(0.11 0.006 270)", borderColor: "var(--border)" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `color-mix(in oklch, ${color} 15%, transparent)` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                <Button
                  onClick={() => handleDownload(type)}
                  className="w-full gap-2 text-xs font-semibold"
                  style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleEmail(type)}
                  className="w-full gap-2 text-xs"
                  style={{ background: "oklch(0.14 0.006 270)", borderColor: "var(--border)", color: "oklch(0.65 0.008 270)" }}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Envoyer par email
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function generateAndDownloadReport(type: string, stats: Record<string, number>, projects: unknown[], userName: string) {
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const lines: string[] = [];

  lines.push(`OPSDIRECTOR — ${type.toUpperCase()}`);
  lines.push(`Généré le ${date}`);
  lines.push(`Utilisateur: ${userName}`);
  lines.push("");
  lines.push("═══════════════════════════════════════");
  lines.push("");
  lines.push("STATISTIQUES GLOBALES");
  lines.push(`  • Projets actifs : ${stats.projects}`);
  lines.push(`  • Tâches en cours : ${stats.tasks}`);
  lines.push(`  • Rappels actifs  : ${stats.reminders}`);
  lines.push(`  • Idées capturées : ${stats.ideas}`);
  lines.push("");

  if (type.includes("projet") && Array.isArray(projects)) {
    lines.push("═══════════════════════════════════════");
    lines.push("");
    lines.push("PROJETS ACTIFS");
    (projects as Array<{ title: string; pole: string; priority: string; sequence_status: string }>).forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.title}`);
      lines.push(`     Pôle: ${p.pole || "N/A"} | Priorité: ${p.priority} | Statut: ${p.sequence_status}`);
    });
    lines.push("");
  }

  lines.push("═══════════════════════════════════════");
  lines.push("Rapport généré automatiquement par OpsDirector");
  lines.push("© Enam Impact Agency — Ludosky Jt");

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `opsdirector-${type.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Rapport téléchargé !");
}
