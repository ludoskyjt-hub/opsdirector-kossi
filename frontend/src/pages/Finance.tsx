import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  Loader2, Plus, TrendingUp, TrendingDown, DollarSign,
  Trash2, ArrowUpCircle, ArrowDownCircle, Calendar,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface FinanceEntry {
  id: number;
  type: "revenue" | "expense";
  label: string;
  amount: number;
  currency: string;
  category: string;
  note: string;
  date: string;
}

const CATEGORIES = {
  revenue: ["Vente", "Service", "Avance client", "Investissement", "Remboursement", "Autre"],
  expense: ["Production", "Logistique", "Marketing", "Salaires", "Fournitures", "Voyage", "Dette", "Autre"],
};

const CURRENCIES = ["EUR", "USD", "FCFA", "BRL"];

const STORAGE_KEY = "ops_finance_entries";

function loadEntries(): FinanceEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEntries(entries: FinanceEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function Finance() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [entries, setEntries] = useState<FinanceEntry[]>(loadEntries);
  const [filter, setFilter] = useState<"all" | "revenue" | "expense">("all");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    type: "revenue" as "revenue" | "expense",
    label: "",
    amount: "",
    currency: "EUR",
    category: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  const totals = {
    revenue: entries.filter((e) => e.type === "revenue").reduce((s, e) => s + e.amount, 0),
    expense: entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0),
  };
  const balance = totals.revenue - totals.expense;

  const filtered = filter === "all" ? entries : entries.filter((e) => e.type === filter);

  function addEntry() {
    if (!form.label.trim() || !form.amount || !form.category) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    const entry: FinanceEntry = {
      id: Date.now(),
      type: form.type,
      label: form.label.trim(),
      amount: parseFloat(form.amount),
      currency: form.currency,
      category: form.category,
      note: form.note,
      date: form.date,
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    saveEntries(updated);
    setShowDialog(false);
    setForm({ type: "revenue", label: "", amount: "", currency: "EUR", category: "", note: "", date: new Date().toISOString().split("T")[0] });
    toast.success(`${entry.type === "revenue" ? "Revenu" : "Dépense"} ajouté(e)`);
  }

  function deleteEntry(id: number) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveEntries(updated);
    toast.success("Entrée supprimée");
  }

  function fmtAmount(amount: number, currency: string) {
    if (currency === "FCFA") return `${amount.toLocaleString("fr-FR")} FCFA`;
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
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

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6" style={{ color: "oklch(0.75 0.12 75)" }} />
              Finances
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Suivi des revenus et dépenses de votre activité</p>
          </div>
          <Button
            onClick={() => setShowDialog(true)}
            className="gap-2 font-semibold"
            style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}
          >
            <Plus className="w-4 h-4" />
            Ajouter une entrée
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Revenus */}
          <div className="rounded-2xl p-5 border" style={{ background: "oklch(0.11 0.006 270)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">Revenus</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0.72 0.18 145 / 0.15)" }}>
                <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.72 0.18 145)" }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: "oklch(0.72 0.18 145)" }}>
              {entries.length === 0 ? "0,00 €" : fmtAmount(totals.revenue, "EUR")}
            </p>
          </div>

          {/* Dépenses */}
          <div className="rounded-2xl p-5 border" style={{ background: "oklch(0.11 0.006 270)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">Dépenses</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0.62 0.22 25 / 0.15)" }}>
                <TrendingDown className="w-4 h-4" style={{ color: "oklch(0.62 0.22 25)" }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: "oklch(0.62 0.22 25)" }}>
              {entries.length === 0 ? "0,00 €" : fmtAmount(totals.expense, "EUR")}
            </p>
          </div>

          {/* Solde */}
          <div className="rounded-2xl p-5 border" style={{ background: "oklch(0.11 0.006 270)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">Solde</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0.75 0.12 75 / 0.15)" }}>
                <DollarSign className="w-4 h-4" style={{ color: "oklch(0.75 0.12 75)" }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: balance >= 0 ? "oklch(0.75 0.12 75)" : "oklch(0.62 0.22 25)" }}>
              {entries.length === 0 ? "0,00 €" : fmtAmount(balance, "EUR")}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(["all", "revenue", "expense"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={filter === f
                ? { background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }
                : { background: "oklch(0.14 0.006 270)", color: "oklch(0.55 0.008 270)", border: "1px solid oklch(0.20 0.008 270)" }
              }
            >
              {f === "all" ? "Toutes" : f === "revenue" ? "Revenus" : "Dépenses"}
            </button>
          ))}
        </div>

        {/* Entries list */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: "oklch(0.11 0.006 270)", borderColor: "var(--border)" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "oklch(0.75 0.12 75 / 0.10)" }}>
                <DollarSign className="w-7 h-7" style={{ color: "oklch(0.75 0.12 75)" }} />
              </div>
              <p className="text-foreground font-medium mb-1">Aucune entrée financière</p>
              <p className="text-muted-foreground text-sm">Ajoutez vos premiers revenus ou dépenses.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filtered.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: entry.type === "revenue" ? "oklch(0.72 0.18 145 / 0.15)" : "oklch(0.62 0.22 25 / 0.15)" }}
                  >
                    {entry.type === "revenue"
                      ? <ArrowUpCircle className="w-4 h-4" style={{ color: "oklch(0.72 0.18 145)" }} />
                      : <ArrowDownCircle className="w-4 h-4" style={{ color: "oklch(0.62 0.22 25)" }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.75 0.12 75 / 0.10)", color: "oklch(0.75 0.12 75)" }}>
                        {entry.category}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(entry.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    {entry.note && <p className="text-xs text-muted-foreground mt-1 truncate">{entry.note}</p>}
                  </div>
                  <p
                    className="text-sm font-bold flex-shrink-0"
                    style={{ color: entry.type === "revenue" ? "oklch(0.72 0.18 145)" : "oklch(0.62 0.22 25)" }}
                  >
                    {entry.type === "expense" ? "-" : "+"}{fmtAmount(entry.amount, entry.currency)}
                  </p>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Nouvelle entrée financière</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Type */}
            <div className="grid grid-cols-2 gap-2">
              {(["revenue", "expense"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, type: t, category: "" }))}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all border"
                  style={form.type === t
                    ? { background: t === "revenue" ? "oklch(0.72 0.18 145 / 0.20)" : "oklch(0.62 0.22 25 / 0.20)", color: t === "revenue" ? "oklch(0.72 0.18 145)" : "oklch(0.62 0.22 25)", borderColor: t === "revenue" ? "oklch(0.72 0.18 145 / 0.4)" : "oklch(0.62 0.22 25 / 0.4)" }
                    : { background: "oklch(0.14 0.006 270)", color: "oklch(0.55 0.008 270)", borderColor: "oklch(0.20 0.008 270)" }
                  }
                >
                  {t === "revenue" ? "Revenu" : "Dépense"}
                </button>
              ))}
            </div>
            <Input
              placeholder="Libellé *"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)", color: "oklch(0.93 0.008 60)" }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Montant *"
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)", color: "oklch(0.93 0.008 60)" }}
              />
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)", color: "oklch(0.93 0.008 60)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)", color: form.category ? "oklch(0.93 0.008 60)" : "oklch(0.45 0.008 270)" }}>
                <SelectValue placeholder="Catégorie *" />
              </SelectTrigger>
              <SelectContent style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {CATEGORIES[form.type].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)", color: "oklch(0.93 0.008 60)" }}
            />
            <Textarea
              placeholder="Note (optionnel)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)", color: "oklch(0.93 0.008 60)", resize: "none" }}
            />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}
                style={{ background: "oklch(0.14 0.006 270)", borderColor: "var(--border)", color: "oklch(0.55 0.008 270)" }}>
                Annuler
              </Button>
              <Button className="flex-1 font-semibold" onClick={addEntry}
                style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
