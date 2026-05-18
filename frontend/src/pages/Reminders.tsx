import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Loader2, Plus, Bell, CheckSquare, Check, Trash2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Faible", color: "text-muted-foreground" },
  { value: "medium", label: "Moyen", color: "text-blue-400" },
  { value: "high", label: "Élevé", color: "text-amber-400" },
  { value: "critical", label: "Critique", color: "text-red-400" },
];

const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Terminé" },
  { value: "cancelled", label: "Annulé" },
];

export default function Reminders() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"reminders" | "tasks">("reminders");
  const [showCreateReminder, setShowCreateReminder] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [reminderForm, setReminderForm] = useState({ title: "", description: "", dueAt: "", priority: "medium" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", dueAt: "" });

  const utils = trpc.useUtils();
  const { data: reminders, isLoading: loadingReminders } = trpc.reminders.list.useQuery(undefined, { enabled: !!user });
  const { data: tasks, isLoading: loadingTasks } = trpc.tasks.list.useQuery(undefined, { enabled: !!user });
  const { data: projects } = trpc.projects.list.useQuery(undefined, { enabled: !!user });

  const createReminderMutation = trpc.reminders.create.useMutation({
    onSuccess: () => {
      utils.reminders.list.invalidate();
      setShowCreateReminder(false);
      setReminderForm({ title: "", description: "", dueAt: "", priority: "medium" });
      toast.success("Rappel créé !");
    },
    onError: (e) => toast.error(e.message),
  });

  const dismissReminderMutation = trpc.reminders.update.useMutation({
    onSuccess: () => utils.reminders.list.invalidate(),
  });

  const createTaskMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      setShowCreateTask(false);
      setTaskForm({ title: "", description: "", priority: "medium", dueAt: "" });
      toast.success("Tâche créée !");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTaskMutation = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const pendingReminders = reminders?.filter((r) => r.status === "pending") || [];
  const pendingTasks = tasks?.filter((t) => t.status !== "done" && t.status !== "cancelled") || [];
  const doneTasks = tasks?.filter((t) => t.status === "done") || [];

  const getProjectTitle = (id: number | null) => projects?.find((p) => p.id === id)?.title;

  const priorityColor = (p: string) => PRIORITY_OPTIONS.find((o) => o.value === p)?.color || "";

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {activeTab === "reminders" ? "Rappels" : "Tâches"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "reminders"
                ? `${pendingReminders.length} rappels en attente`
                : `${pendingTasks.length} tâches en cours`}
            </p>
          </div>
          <Button
            onClick={() => activeTab === "reminders" ? setShowCreateReminder(true) : setShowCreateTask(true)}
            className="gap-2"
            style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}>
            <Plus className="w-4 h-4" />
            {activeTab === "reminders" ? "Nouveau rappel" : "Nouvelle tâche"}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { value: "reminders", label: "Rappels", icon: Bell, count: pendingReminders.length },
            { value: "tasks", label: "Tâches", icon: CheckSquare, count: pendingTasks.length },
          ].map(({ value, label, icon: Icon, count }) => (
            <button key={value} onClick={() => setActiveTab(value as any)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={activeTab === value
                ? { background: "oklch(0.75 0.12 75 / 0.15)", border: "1px solid oklch(0.75 0.12 75 / 0.3)", color: "oklch(0.75 0.12 75)" }
                : { background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)", color: "oklch(0.55 0.008 60)" }}>
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center"
                  style={{ background: activeTab === value ? "oklch(0.75 0.12 75 / 0.3)" : "oklch(0.20 0.008 270)" }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Reminders */}
        {activeTab === "reminders" && (
          <div>
            {loadingReminders ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : pendingReminders.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucun rappel en attente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingReminders.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 p-4 rounded-xl"
                    style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
                    <Bell className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                      {r.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.content}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {r.dueAt && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {new Date(r.dueAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => dismissReminderMutation.mutate({ id: r.id, status: "done" })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-400/10 transition-all flex-shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tasks */}
        {activeTab === "tasks" && (
          <div className="space-y-6">
            {/* Pending tasks */}
            {loadingTasks ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <>
                {pendingTasks.length > 0 && (
                  <div className="space-y-2">
                    {pendingTasks.map((t) => (
                      <div key={t.id} className="flex items-start gap-3 p-4 rounded-xl"
                        style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
                        <button onClick={() => updateTaskMutation.mutate({ id: t.id, status: "done" })}
                          className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all hover:border-primary"
                          style={{ borderColor: "oklch(0.30 0.008 270)" }}>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{t.title}</p>
                          {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-xs ${priorityColor(t.priority)}`}>
                              {PRIORITY_OPTIONS.find((o) => o.value === t.priority)?.label}
                            </span>
                            {t.projectId && (
                              <span className="text-xs text-primary">
                                {getProjectTitle(t.projectId)}
                              </span>
                            )}
                            {t.dueAt && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {new Date(t.dueAt).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Select value={t.status} onValueChange={(v) => updateTaskMutation.mutate({ id: t.id, status: v as any })}>
                          <SelectTrigger className="w-28 h-7 text-xs" style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                            {TASK_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}

                {pendingTasks.length === 0 && (
                  <div className="text-center py-12">
                    <CheckSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Aucune tâche en cours</p>
                  </div>
                )}

                {/* Done tasks */}
                {doneTasks.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Terminées ({doneTasks.length})</p>
                    <div className="space-y-2">
                      {doneTasks.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl opacity-50"
                          style={{ background: "oklch(0.11 0.006 270)", border: "1px solid var(--border)" }}>
                          <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground line-through">{t.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Reminder Dialog */}
      <Dialog open={showCreateReminder} onOpenChange={setShowCreateReminder}>
        <DialogContent className="max-w-md" style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>Nouveau Rappel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input placeholder="Titre du rappel *" value={reminderForm.title} onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
            <Textarea placeholder="Description (optionnel)" value={reminderForm.description} onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })} rows={2}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date d'échéance</label>
                <Input type="datetime-local" value={reminderForm.dueAt} onChange={(e) => setReminderForm({ ...reminderForm, dueAt: e.target.value })}
                  style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priorité</label>
                <Select value={reminderForm.priority} onValueChange={(v) => setReminderForm({ ...reminderForm, priority: v })}>
                  <SelectTrigger style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => { const dueAt = reminderForm.dueAt ? new Date(reminderForm.dueAt) : undefined; createReminderMutation.mutate({ title: reminderForm.title, content: reminderForm.description || undefined, dueAt }); }} disabled={!reminderForm.title || createReminderMutation.isPending}
              className="w-full gap-2"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}>
              {createReminderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer le rappel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent className="max-w-md" style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>Nouvelle Tâche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input placeholder="Titre de la tâche *" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
            <Textarea placeholder="Description (optionnel)" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priorité</label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Échéance</label>
                <Input type="datetime-local" value={taskForm.dueAt} onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })}
                  style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }} />
              </div>
            </div>
            <Button onClick={() => createTaskMutation.mutate({ ...taskForm, dueAt: taskForm.dueAt || undefined } as any)}
              disabled={!taskForm.title || createTaskMutation.isPending}
              className="w-full gap-2"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}>
              {createTaskMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer la tâche
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
