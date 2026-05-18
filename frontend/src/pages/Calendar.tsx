import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  AlertTriangle, CheckSquare, Clock, X,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";

/* ─── Constants ──────────────────────────────────────────────── */
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

const PRIORITY_COLORS: Record<string, string> = {
  critical: "oklch(0.65 0.20 25)",
  high:     "oklch(0.75 0.18 75)",
  medium:   "oklch(0.70 0.16 220)",
  low:      "oklch(0.55 0.008 270)",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critique",
  high:     "Haute",
  medium:   "Moyenne",
  low:      "Basse",
};

const STATUS_LABELS: Record<string, string> = {
  todo:        "À faire",
  in_progress: "En cours",
  done:        "Terminé",
  cancelled:   "Annulé",
};

const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/* ─── Helpers ────────────────────────────────────────────────── */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun → convert to Mon-based (0=Mon)
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getUrgencyDot(dueAt: Date): string {
  const diff = Math.ceil((dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 1)  return "oklch(0.65 0.20 25)";
  if (diff <= 3)  return "oklch(0.75 0.18 75)";
  return "oklch(0.70 0.16 220)";
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function Calendar() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: tasks }    = trpc.tasks.list.useQuery(undefined, { enabled: !!user });
  const { data: projects } = trpc.projects.list.useQuery(undefined, { enabled: !!user });

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  /* ── Tasks with dueAt only ── */
  const tasksWithDue = useMemo(() =>
    (tasks || []).filter((t) => t.dueAt && t.status !== "cancelled"),
    [tasks]
  );

  /* ── Map: "YYYY-MM-DD" → tasks[] ── */
  const tasksByDay = useMemo(() => {
    const map: Record<string, typeof tasksWithDue> = {};
    for (const task of tasksWithDue) {
      const d = new Date(task.dueAt!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasksWithDue]);

  /* ── Calendar grid ── */
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay    = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(today);
  };

  /* ── Selected day tasks ── */
  const selectedTasks = useMemo(() => {
    if (!selectedDay) return [];
    const key = `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, "0")}-${String(selectedDay.getDate()).padStart(2, "0")}`;
    return tasksByDay[key] || [];
  }, [selectedDay, tasksByDay]);

  /* ── Stats for the month ── */
  const monthStats = useMemo(() => {
    let total = 0, done = 0, overdue = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTasks = tasksByDay[key] || [];
      total += dayTasks.length;
      done  += dayTasks.filter(t => t.status === "done").length;
      const dayDate = new Date(viewYear, viewMonth, d);
      overdue += dayTasks.filter(t => t.status !== "done" && dayDate < today).length;
    }
    return { total, done, overdue };
  }, [tasksByDay, viewYear, viewMonth, daysInMonth, today]);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground tracking-tight">Calendrier</h1>
          </div>
          <button
            onClick={goToday}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
            style={{ background: "oklch(0.75 0.12 75 / 0.15)", color: "oklch(0.75 0.12 75)", border: "1px solid oklch(0.75 0.12 75 / 0.3)" }}>
            Aujourd'hui
          </button>
        </div>

        {/* ── Month Stats ── */}
        {monthStats.total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Tâches ce mois", value: monthStats.total, color: "oklch(0.70 0.16 220)" },
              { label: "Terminées",      value: monthStats.done,  color: "oklch(0.72 0.18 145)" },
              { label: "En retard",      value: monthStats.overdue, color: "oklch(0.65 0.20 25)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4">

          {/* ── Calendar Grid ── */}
          <div className="flex-1 rounded-2xl overflow-hidden"
            style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>

            {/* Month navigation */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <button onClick={prevMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                style={{ background: "oklch(0.16 0.007 270)" }}>
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <h2 className="text-base font-semibold text-foreground">
                {MONTHS_FR[viewMonth]} {viewYear}
              </h2>
              <button onClick={nextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                style={{ background: "oklch(0.16 0.007 270)" }}>
                <ChevronRight className="w-4 h-4 text-foreground" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 px-2 pt-2">
              {WEEKDAYS_FR.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5 p-2">
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - firstDay + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const cellDate = new Date(viewYear, viewMonth, dayNum);
                const isToday = isCurrentMonth && isSameDay(cellDate, today);
                const isSelected = isCurrentMonth && selectedDay && isSameDay(cellDate, selectedDay);
                const isPast = isCurrentMonth && cellDate < today && !isToday;

                const key = isCurrentMonth
                  ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
                  : "";
                const dayTasks = key ? (tasksByDay[key] || []) : [];
                const hasTasks = dayTasks.length > 0;

                return (
                  <button
                    key={idx}
                    disabled={!isCurrentMonth}
                    onClick={() => isCurrentMonth && setSelectedDay(cellDate)}
                    className="relative rounded-lg p-1 min-h-[52px] flex flex-col items-center transition-all"
                    style={{
                      background: isSelected
                        ? "oklch(0.75 0.12 75 / 0.2)"
                        : isToday
                          ? "oklch(0.75 0.12 75 / 0.08)"
                          : "transparent",
                      border: isSelected
                        ? "1px solid oklch(0.75 0.12 75 / 0.6)"
                        : isToday
                          ? "1px solid oklch(0.75 0.12 75 / 0.3)"
                          : "1px solid transparent",
                      opacity: !isCurrentMonth ? 0 : isPast && !hasTasks ? 0.35 : 1,
                      cursor: isCurrentMonth ? "pointer" : "default",
                    }}>

                    {/* Day number */}
                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-0.5
                      ${isToday ? "text-primary" : isSelected ? "text-primary" : "text-foreground"}`}
                      style={isToday ? { background: "oklch(0.75 0.12 75 / 0.25)" } : {}}>
                      {isCurrentMonth ? dayNum : ""}
                    </span>

                    {/* Task dots */}
                    {hasTasks && (
                      <div className="flex flex-wrap justify-center gap-0.5 max-w-[36px]">
                        {dayTasks.slice(0, 4).map((task, i) => {
                          const project = projects?.find(p => p.id === task.projectId);
                          const dotColor = task.status === "done"
                            ? "oklch(0.72 0.18 145)"
                            : project
                              ? POLE_COLORS[project.pole] || POLE_COLORS.autre
                              : getUrgencyDot(new Date(task.dueAt!));
                          return (
                            <span key={i} className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: dotColor }} />
                          );
                        })}
                        {dayTasks.length > 4 && (
                          <span className="text-[9px] text-muted-foreground leading-none">+{dayTasks.length - 4}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="px-4 pb-3 pt-1 flex flex-wrap gap-3"
              style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs text-muted-foreground font-medium">Légende :</span>
              {[
                { color: "oklch(0.75 0.12 75)",  label: "Cosmétique" },
                { color: "oklch(0.72 0.18 145)", label: "Agro" },
                { color: "oklch(0.70 0.16 220)", label: "Retail" },
                { color: "oklch(0.68 0.18 300)", label: "Culture" },
                { color: "oklch(0.65 0.14 30)",  label: "Institutionnel" },
                { color: "oklch(0.72 0.18 145)", label: "Terminé" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Side Panel: Selected Day ── */}
          <div className="lg:w-72 rounded-2xl overflow-hidden"
            style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>

            {selectedDay ? (
              <>
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedDay.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTasks.length === 0
                        ? "Aucune tâche"
                        : `${selectedTasks.length} tâche${selectedTasks.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <button onClick={() => setSelectedDay(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                    style={{ background: "oklch(0.16 0.007 270)" }}>
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Tasks list */}
                <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                  {selectedTasks.length === 0 ? (
                    <div className="text-center py-10">
                      <CheckSquare className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Aucune tâche ce jour</p>
                      <button
                        onClick={() => navigate("/reminders")}
                        className="mt-3 text-xs text-primary hover:underline">
                        Ajouter une tâche →
                      </button>
                    </div>
                  ) : (
                    selectedTasks.map((task) => {
                      const project = projects?.find(p => p.id === task.projectId);
                      const poleColor = project ? (POLE_COLORS[project.pole] || POLE_COLORS.autre) : "oklch(0.55 0.008 270)";
                      const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
                      const isDone = task.status === "done";
                      return (
                        <div key={task.id}
                          className="rounded-xl p-3 cursor-pointer hover:opacity-80 transition-all"
                          style={{
                            background: isDone ? "oklch(0.72 0.18 145 / 0.06)" : "oklch(0.14 0.007 270)",
                            border: `1px solid ${isDone ? "oklch(0.72 0.18 145 / 0.2)" : "oklch(0.20 0.008 270)"}`,
                            opacity: isDone ? 0.7 : 1,
                          }}
                          onClick={() => navigate("/reminders")}>

                          {/* Task title */}
                          <p className={`text-sm font-medium text-foreground ${isDone ? "line-through" : ""}`}>
                            {task.title}
                          </p>

                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {/* Status */}
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{
                                background: isDone ? "oklch(0.72 0.18 145 / 0.15)" : "oklch(0.70 0.16 220 / 0.15)",
                                color: isDone ? "oklch(0.72 0.18 145)" : "oklch(0.70 0.16 220)",
                              }}>
                              {STATUS_LABELS[task.status] || task.status}
                            </span>

                            {/* Priority */}
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background: `${priorityColor}18`, color: priorityColor }}>
                              {PRIORITY_LABELS[task.priority] || task.priority}
                            </span>

                            {/* Project / Pôle */}
                            {project && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ background: `${poleColor}18`, color: poleColor, border: `1px solid ${poleColor}30` }}>
                                {POLE_LABELS[project.pole] || project.pole}
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-6 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "oklch(0.75 0.12 75 / 0.1)", border: "1px solid oklch(0.75 0.12 75 / 0.2)" }}>
                  <CalendarIcon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Sélectionnez un jour</p>
                <p className="text-xs text-muted-foreground">
                  Cliquez sur une date pour voir les tâches associées
                </p>
                {tasksWithDue.length === 0 && (
                  <button
                    onClick={() => navigate("/reminders")}
                    className="mt-4 text-xs text-primary hover:underline">
                    Créer des tâches avec échéances →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Upcoming tasks list (below calendar) ── */}
        {tasksWithDue.filter(t => t.status !== "done").length > 0 && (
          <div className="rounded-2xl p-4"
            style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Prochaines Échéances
              </h2>
            </div>
            <div className="space-y-2">
              {tasksWithDue
                .filter(t => t.status !== "done")
                .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
                .slice(0, 5)
                .map((task) => {
                  const project = projects?.find(p => p.id === task.projectId);
                  const dueDate = new Date(task.dueAt!);
                  const diff = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const urgColor = diff <= 1 ? "oklch(0.65 0.20 25)" : diff <= 3 ? "oklch(0.75 0.18 75)" : "oklch(0.70 0.16 220)";
                  return (
                    <div key={task.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:opacity-80 transition-all"
                      style={{ background: "oklch(0.14 0.007 270)", border: "1px solid oklch(0.20 0.008 270)" }}
                      onClick={() => {
                        setViewYear(dueDate.getFullYear());
                        setViewMonth(dueDate.getMonth());
                        setSelectedDay(dueDate);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${urgColor}15`, border: `1px solid ${urgColor}30` }}>
                        {diff <= 0 ? (
                          <AlertTriangle className="w-4 h-4" style={{ color: urgColor }} />
                        ) : (
                          <span className="text-xs font-bold" style={{ color: urgColor }}>{diff}j</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {project && (
                            <span className="text-xs text-muted-foreground">
                              {POLE_LABELS[project.pole] || project.pole}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {dueDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
