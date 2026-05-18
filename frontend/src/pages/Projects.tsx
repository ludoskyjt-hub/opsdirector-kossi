import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Loader2, Plus, FolderOpen, Star, AlertTriangle, MapPin, Clock, ChevronDown, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POLE_OPTIONS = [
  { value: "cosmetique_industrie", label: "Cosmétique & Industrie", class: "pole-cosmetique" },
  { value: "agro_industrie", label: "Agro-Industrie", class: "pole-agro" },
  { value: "retail_innovation", label: "Retail & Innovation", class: "pole-retail" },
  { value: "culture_evenementiel", label: "Culture & Événementiel", class: "pole-culture" },
  { value: "institutionnel_diplomatie", label: "Institutionnel & Diplomatie", class: "pole-institutionnel" },
  { value: "autre", label: "Autre", class: "pole-autre" },
];

const SEQUENCE_OPTIONS = [
  { value: "idee", label: "Idée" },
  { value: "planification", label: "Planification" },
  { value: "execution", label: "Exécution" },
  { value: "monitoring", label: "Monitoring" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Faible", color: "text-muted-foreground" },
  { value: "medium", label: "Moyen", color: "text-blue-400" },
  { value: "high", label: "Élevé", color: "text-amber-400" },
  { value: "critical", label: "Critique", color: "text-red-400" },
];

const HORIZON_OPTIONS = [
  { value: "short_term", label: "Court terme" },
  { value: "medium_term", label: "Moyen terme" },
  { value: "long_term", label: "Long terme" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Actif" },
  { value: "paused", label: "En pause" },
  { value: "completed", label: "Terminé" },
  { value: "archived", label: "Archivé" },
];

const COLORS = ["#D4AF37", "#E879A0", "#4ADE80", "#60A5FA", "#A78BFA", "#FB923C", "#F472B6"];

export default function Projects() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({
    title: "", description: "", pole: "autre", sequenceStatus: "idee",
    priority: "medium", status: "active", location: "", strategicHorizon: "medium_term",
    dependencyIndex: "", color: "#D4AF37", monthlyPriority: false,
  });

  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.projects.list.useQuery(undefined, { enabled: !!user });

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setShowCreate(false);
      setForm({ title: "", description: "", pole: "autre", sequenceStatus: "idee", priority: "medium", status: "active", location: "", strategicHorizon: "medium_term", dependencyIndex: "", color: "#D4AF37", monthlyPriority: false });
      toast.success("Projet créé avec succès");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); toast.success("Projet mis à jour"); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const filtered = projects?.filter((p) => {
    if (filter === "all") return p.status !== "archived";
    if (filter === "monthly") return p.monthlyPriority;
    return p.pole === filter;
  }) || [];

  const poleClass = (pole: string) => POLE_OPTIONS.find((p) => p.value === pole)?.class || "pole-autre";
  const poleLabel = (pole: string) => POLE_OPTIONS.find((p) => p.value === pole)?.label || pole;
  const seqLabel = (s: string) => SEQUENCE_OPTIONS.find((o) => o.value === s)?.label || s;
  const priorityColor = (p: string) => PRIORITY_OPTIONS.find((o) => o.value === p)?.color || "";

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Projets</h1>
            <p className="text-sm text-muted-foreground mt-1">{projects?.filter(p => p.status === "active").length || 0} projets actifs</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2"
            style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}>
            <Plus className="w-4 h-4" /> Nouveau projet
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {[
            { value: "all", label: "Tous" },
            { value: "monthly", label: "⭐ Priorités du mois" },
            ...POLE_OPTIONS.map((p) => ({ value: p.value, label: p.label })),
          ].map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.value ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={filter === f.value
                ? { background: "oklch(0.75 0.12 75 / 0.15)", border: "1px solid oklch(0.75 0.12 75 / 0.3)", color: "oklch(0.75 0.12 75)" }
                : { background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Projects grid */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun projet trouvé</p>
            <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Créer un projet
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-xl p-5 flex flex-col gap-3 hover:scale-[1.01] transition-all cursor-pointer"
                style={{ background: "oklch(0.11 0.006 270)", border: `1px solid ${p.monthlyPriority ? "oklch(0.75 0.12 75 / 0.25)" : "oklch(0.20 0.008 270)"}` }}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${poleClass(p.pole)}`}>
                      {poleLabel(p.pole)}
                    </span>
                    {p.monthlyPriority && <Star className="w-3.5 h-3.5 text-yellow-400" />}
                  </div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: p.color || "#D4AF37" }} />
                </div>

                {/* Title */}
                <h3 className="font-semibold text-foreground text-sm leading-snug">{p.title}</h3>
                {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}

                {/* Meta */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-muted-foreground px-2 py-0.5 rounded-md"
                    style={{ background: "oklch(0.14 0.006 270)" }}>
                    {seqLabel(p.sequenceStatus)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md ${priorityColor(p.priority)}`}
                    style={{ background: "oklch(0.14 0.006 270)" }}>
                    {PRIORITY_OPTIONS.find((o) => o.value === p.priority)?.label}
                  </span>
                  {p.location && (
                    <span className="flex items-center gap-1 text-muted-foreground px-2 py-0.5 rounded-md"
                      style={{ background: "oklch(0.14 0.006 270)" }}>
                      <MapPin className="w-3 h-3" />{p.location}
                    </span>
                  )}
                </div>

                {/* Blocage */}
                {p.dependencyIndex && (
                  <div className="flex items-start gap-2 text-xs text-amber-400/80 px-2 py-1.5 rounded-lg"
                    style={{ background: "oklch(0.72 0.14 55 / 0.06)", border: "1px solid oklch(0.72 0.14 55 / 0.15)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{p.dependencyIndex}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => updateMutation.mutate({ id: p.id, monthlyPriority: !p.monthlyPriority })}
                    className={`flex-1 text-xs py-1.5 rounded-lg transition-all ${p.monthlyPriority ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
                    style={{ background: "oklch(0.14 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
                    {p.monthlyPriority ? "⭐ Priorité" : "Marquer priorité"}
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ id: p.id, status: p.status === "active" ? "paused" : "active" })}
                    className="flex-1 text-xs py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all"
                    style={{ background: "oklch(0.14 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
                    {p.status === "active" ? "Mettre en pause" : "Réactiver"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg" style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>Nouveau Projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input placeholder="Titre du projet *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
            <Textarea placeholder="Description (optionnel)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Pôle d'activité</label>
                <Select value={form.pole} onValueChange={(v) => setForm({ ...form, pole: v })}>
                  <SelectTrigger style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    {POLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Statut de séquence</label>
                <Select value={form.sequenceStatus} onValueChange={(v) => setForm({ ...form, sequenceStatus: v })}>
                  <SelectTrigger style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    {SEQUENCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priorité</label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Horizon stratégique</label>
                <Select value={form.strategicHorizon} onValueChange={(v) => setForm({ ...form, strategicHorizon: v })}>
                  <SelectTrigger style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    {HORIZON_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input placeholder="Localisation (ex: Marília, Bénin, Europe...)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
            <Textarea placeholder="Blocages / dépendances (optionnel)" value={form.dependencyIndex} onChange={(e) => setForm({ ...form, dependencyIndex: e.target.value })} rows={2}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground">Couleur :</label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className="w-6 h-6 rounded-full transition-all hover:scale-110"
                    style={{ background: c, outline: form.color === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }} />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.monthlyPriority} onChange={(e) => setForm({ ...form, monthlyPriority: e.target.checked })}
                className="rounded" />
              <span className="text-sm text-foreground">⭐ Marquer comme priorité du mois</span>
            </label>
            <Button onClick={() => createMutation.mutate(form as any)} disabled={!form.title || createMutation.isPending}
              className="w-full gap-2"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer le projet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
