import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Lightbulb, Mic, MicOff, Brain, FolderOpen, Check, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  raw: "Brute",
  reviewed: "Revue",
  converted: "Convertie",
  archived: "Archivée",
};

const STATUS_COLORS: Record<string, string> = {
  raw: "text-blue-400",
  reviewed: "text-amber-400",
  converted: "text-green-400",
  archived: "text-muted-foreground",
};

export default function Ideas() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [newIdea, setNewIdea] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [filter, setFilter] = useState<string>("raw");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const utils = trpc.useUtils();
  const { data: ideas, isLoading } = trpc.ideas.list.useQuery(undefined, { enabled: !!user });
  const { data: projects } = trpc.projects.list.useQuery(undefined, { enabled: !!user });

  const createMutation = trpc.ideas.create.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      setNewIdea("");
      toast.success("Idée capturée et classifiée !");
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const updateMutation = trpc.ideas.update.useMutation({
    onSuccess: () => utils.ideas.list.invalidate(),
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const uploadAudioMutation = trpc.agent.uploadAudio.useMutation();
  const transcribeMutation = trpc.ideas.transcribeAndCreate.useMutation({
    onSuccess: (data) => {
      utils.ideas.list.invalidate();
      toast.success(`Idée transcrite et classifiée !`);
    },
    onError: () => toast.error("Erreur lors de la transcription"),
  });

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const handleCreateIdea = () => {
    if (!newIdea.trim()) return;
    createMutation.mutate({ content: newIdea.trim() });
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            const { url } = await uploadAudioMutation.mutateAsync({ audioBase64: base64, mimeType: "audio/webm" });
            await transcribeMutation.mutateAsync({ audioUrl: url, language: "fr" });
          } catch { toast.error("Erreur lors de l'upload audio"); }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch { toast.error("Impossible d'accéder au microphone"); }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const filtered = ideas?.filter((i) => filter === "all" ? true : i.status === filter) || [];
  const getProjectTitle = (id: number | null) => projects?.find((p) => p.id === id)?.title;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Idées</h1>
            <p className="text-sm text-muted-foreground mt-1">{ideas?.filter(i => i.status === "raw").length || 0} idées à traiter</p>
          </div>
        </div>

        {/* Capture area */}
        <div className="rounded-xl p-5 mb-6"
          style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-foreground">Capturer une idée</span>
          </div>
          <Textarea
            placeholder="Décrivez votre idée... Elle sera automatiquement classifiée dans le bon projet."
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            rows={3}
            style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)" }}
          />
          <div className="flex gap-2 mt-3">
            <Button onClick={handleCreateIdea} disabled={!newIdea.trim() || createMutation.isPending}
              className="gap-2 flex-1"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Capturer
            </Button>
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={transcribeMutation.isPending || uploadAudioMutation.isPending}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${isRecording ? "recording-pulse" : ""}`}
              style={isRecording
                ? { background: "oklch(0.55 0.18 25 / 0.15)", border: "1px solid oklch(0.55 0.18 25 / 0.4)", color: "oklch(0.55 0.18 25)" }
                : { background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)", color: "oklch(0.65 0.008 60)" }}>
              {transcribeMutation.isPending || uploadAudioMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isRecording ? "Arrêter" : "Dicter"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {[
            { value: "raw", label: "À traiter" },
            { value: "reviewed", label: "Revues" },
            { value: "converted", label: "Converties" },
            { value: "all", label: "Toutes" },
          ].map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={filter === f.value
                ? { background: "oklch(0.75 0.12 75 / 0.15)", border: "1px solid oklch(0.75 0.12 75 / 0.3)", color: "oklch(0.75 0.12 75)" }
                : { background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)", color: "oklch(0.55 0.008 60)" }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Ideas list */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Aucune idée dans cette catégorie</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((idea) => (
              <div key={idea.id} className="rounded-xl p-4"
                style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">{idea.content}</p>
                    {idea.aiClassification && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Brain className="w-3 h-3 text-primary" />
                        {idea.aiClassification}
                      </p>
                    )}
                    {idea.projectId && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />
                        {getProjectTitle(idea.projectId) || `Projet #${idea.projectId}`}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs ${STATUS_COLORS[idea.status]}`}>
                        {STATUS_LABELS[idea.status]}
                      </span>
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className="text-xs text-muted-foreground/50">
                        {new Date(idea.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {idea.status === "raw" && (
                      <button onClick={() => updateMutation.mutate({ id: idea.id, status: "reviewed" })}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-400/10 transition-all">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {idea.status !== "archived" && (
                      <button onClick={() => updateMutation.mutate({ id: idea.id, status: "archived" })}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
