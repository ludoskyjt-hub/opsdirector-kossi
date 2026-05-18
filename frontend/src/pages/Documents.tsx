import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  Loader2, FileText, Upload, Trash2, Eye,
  CheckCircle2, Clock, AlertCircle, FileType,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface DocFile {
  id: number;
  name: string;
  size: number;
  type: string;
  status: "analysing" | "done" | "error";
  analysis: string;
  uploadedAt: string;
}

const STORAGE_KEY = "ops_documents";

function loadDocs(): DocFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDocs(docs: DocFile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(type: string) {
  if (type.includes("pdf")) return "PDF";
  if (type.includes("word") || type.includes("docx") || type.includes("doc")) return "DOC";
  if (type.includes("sheet") || type.includes("xlsx") || type.includes("csv")) return "XLS";
  if (type.includes("image") || type.includes("png") || type.includes("jpg")) return "IMG";
  return "TXT";
}

const MOCK_ANALYSES = [
  "Document analysé. Contenu principal : données financières et projections de coûts. Points clés identifiés :\n• Budget prévisionnel Q2-Q3 2026\n• Marges brutes par produit\n• Recommandations d'optimisation des coûts de production\n\nActions suggérées : Liée au projet \"Optimisation des coûts de production\".",
  "Document analysé. Contenu principal : plan stratégique et roadmap. Points clés identifiés :\n• Stratégie d'expansion CEDEAO\n• Plan de développement produit\n• Ressources et financements nécessaires\n\nActions suggérées : Liée aux projets \"Déploiement IA Bénin\" et \"Reina Professional\".",
  "Document analysé. Contenu principal : proposition commerciale et devis. Points clés identifiés :\n• Spécifications techniques produits\n• Conditions de paiement et délais\n• Modalités de livraison\n\nActions suggérées : Liée au projet \"PRODUCTIO POUR LE CLIENT DE L'ESPAGNE\".",
];

export default function Documents() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [docs, setDocs] = useState<DocFile[]>(loadDocs);
  const [dragging, setDragging] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  function processFile(file: File) {
    const id = Date.now() + Math.random();
    const newDoc: DocFile = {
      id,
      name: file.name,
      size: file.size,
      type: file.type || file.name.split(".").pop() || "unknown",
      status: "analysing",
      analysis: "",
      uploadedAt: new Date().toISOString(),
    };
    const updated = [newDoc, ...docs];
    setDocs(updated);
    saveDocs(updated);
    toast.success(`${file.name} importé`, { description: "Analyse IA en cours..." });

    // Simulate AI analysis
    setTimeout(() => {
      const analysis = MOCK_ANALYSES[Math.floor(Math.random() * MOCK_ANALYSES.length)];
      setDocs((prev) => {
        const next = prev.map((d) =>
          d.id === id ? { ...d, status: "done" as const, analysis } : d
        );
        saveDocs(next);
        return next;
      });
      toast.success("Analyse terminée", { description: `${file.name} a été analysé avec succès.` });
    }, 2500);
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(processFile);
  }

  function deleteDoc(id: number) {
    const updated = docs.filter((d) => d.id !== id);
    setDocs(updated);
    saveDocs(updated);
    toast.success("Document supprimé");
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
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6" style={{ color: "oklch(0.75 0.12 75)" }} />
            Intelligence Documentaire
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Importez vos documents — OpsDirector en extrait automatiquement projets, tâches et idées.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className="relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-12 cursor-pointer transition-all mb-6"
          style={{
            borderColor: dragging ? "oklch(0.75 0.12 75)" : "var(--border)",
            background: dragging ? "oklch(0.75 0.12 75 / 0.05)" : "oklch(0.11 0.006 270)",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp,.xlsx"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "oklch(0.75 0.12 75 / 0.12)" }}>
            <Upload className="w-6 h-6" style={{ color: "oklch(0.75 0.12 75)" }} />
          </div>
          <p className="text-sm font-medium text-foreground">Glissez un fichier ici ou cliquez pour parcourir</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT, CSV, PNG, JPG, WEBP — max 10 Mo</p>
        </div>

        {/* Documents list */}
        {docs.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Documents importés ({docs.length})
            </h2>
            <div className="space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl border"
                  style={{ background: "oklch(0.11 0.006 270)", borderColor: "var(--border)" }}
                >
                  {/* File type badge */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: "oklch(0.75 0.12 75 / 0.12)", color: "oklch(0.75 0.12 75)" }}>
                    {getFileIcon(doc.type)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {/* Status */}
                      {doc.status === "analysing" ? (
                        <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.70 0.16 220)" }}>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Analyse en cours...
                        </span>
                      ) : doc.status === "done" ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "oklch(0.72 0.18 145 / 0.15)", color: "oklch(0.72 0.18 145)" }}>
                          <CheckCircle2 className="w-3 h-3" />
                          Analysé
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.62 0.22 25)" }}>
                          <AlertCircle className="w-3 h-3" />
                          Erreur
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatSize(doc.size)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(doc.uploadedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}, {new Date(doc.uploadedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.status === "done" && (
                      <Button
                        size="sm"
                        onClick={() => setViewDoc(doc)}
                        className="gap-1.5 text-xs font-semibold h-8 px-3"
                        style={{ background: "oklch(0.75 0.12 75 / 0.15)", color: "oklch(0.75 0.12 75)", border: "1px solid oklch(0.75 0.12 75 / 0.3)" }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Voir l'analyse
                      </Button>
                    )}
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {docs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Aucun document importé. Glissez vos fichiers ci-dessus pour commencer.</p>
          </div>
        )}
      </div>

      {/* Analysis Dialog */}
      {viewDoc && (
        <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
          <DialogContent style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)", maxWidth: "560px" }}>
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <FileType className="w-4 h-4" style={{ color: "oklch(0.75 0.12 75)" }} />
                Analyse — {viewDoc.name}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 p-4 rounded-xl whitespace-pre-line text-sm text-foreground leading-relaxed"
              style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
              {viewDoc.analysis}
            </div>
            <Button
              onClick={() => setViewDoc(null)}
              className="mt-2 w-full"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}
            >
              Fermer
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
