import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Plus, Brain, Mic, MicOff, Paperclip, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { useLanguage } from "@/contexts/LanguageContext";

type AttachedDoc = { name: string; text: string; charCount: number; truncated: boolean };

export default function Chat() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const conversationId = params.id ? parseInt(params.id) : null;

  const [activeConvId, setActiveConvId] = useState<number | null>(conversationId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [localMessages, setLocalMessages] = useState<{ role: string; content: string; id?: number }[]>([]);
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null);
  const [extractingDoc, setExtractingDoc] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { lang } = useLanguage();
  const utils = trpc.useUtils();

  const { data: conversations, refetch: refetchConversations } = trpc.conversations.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: messages, refetch: refetchMessages } = trpc.conversations.getMessages.useQuery(
    { conversationId: activeConvId! },
    { enabled: !!activeConvId }
  );

  const createConvMutation = trpc.conversations.create.useMutation({
    onSuccess: (data) => {
      setActiveConvId(data.id);
      navigate(`/chat/${data.id}`);
      refetchConversations();
    },
  });

  const sendMutation = trpc.conversations.sendMessage.useMutation({
    onSuccess: (data) => {
      setLocalMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content },
      ]);
      refetchMessages();
      refetchConversations();
    },
    onError: () => {
      toast.error("Erreur lors de l'envoi du message");
      setSending(false);
    },
  });

  const transcribeMutation = trpc.ideas.transcribeAndCreate.useMutation({
    onSuccess: (data) => {
      setInput(data.transcription);
      toast.success(`Transcription : "${data.transcription.substring(0, 60)}..."`);
    },
    onError: () => toast.error("Erreur lors de la transcription"),
  });


  const extractDocMutation = trpc.agent.extractDocumentText.useMutation({
    onSuccess: (data, vars) => {
      setAttachedDoc({ name: vars.fileName, text: data.text, charCount: data.charCount, truncated: data.truncated });
      setExtractingDoc(false);
      if (data.truncated) toast.info("Document volumineux — les 20 000 premiers caractères ont été chargés.");
      else toast.success("Document prêt — posez votre question à l'agent !");
      textareaRef.current?.focus();
    },
    onError: (e) => {
      toast.error(e.message);
      setExtractingDoc(false);
    },
  });

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (messages) {
      setLocalMessages(messages.map((m) => ({ role: m.role, content: m.content, id: m.id })));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleNewConversation = async () => {
    setLocalMessages([]);
    setActiveConvId(null);
    setAttachedDoc(null);
    navigate("/chat");
    const result = await createConvMutation.mutateAsync({ title: "Nouvelle conversation" });
    setActiveConvId(result.id);
    navigate(`/chat/${result.id}`);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!e.target) return;
    (e.target as HTMLInputElement).value = "";
    if (!file) return;

    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo)`);
      return;
    }

    setExtractingDoc(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      extractDocMutation.mutate({ fileBase64: base64, mimeType: file.type, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedDoc) || sending) return;

    let convId = activeConvId;
    const title = input.trim() || (attachedDoc ? `Document : ${attachedDoc.name}` : "Nouvelle conversation");
    if (!convId) {
      const result = await createConvMutation.mutateAsync({ title: title.substring(0, 60) });
      convId = result.id;
      setActiveConvId(convId);
      navigate(`/chat/${convId}`);
    }

    let fullMessage = input.trim();

    if (attachedDoc) {
      const docBlock = `**[Document joint : ${attachedDoc.name}]**\n\`\`\`\n${attachedDoc.text}\n\`\`\``;
      const instruction = fullMessage
        ? `\n\n---\n\n**Instruction :** ${fullMessage}`
        : "\n\n---\n\n*(Analyse ce document et dis-moi ce que tu en retiens.)*";
      fullMessage = docBlock + instruction;
    }

    setSending(true);
    const displayMessage = input.trim()
      ? (attachedDoc ? `📄 ${attachedDoc.name}\n\n${input.trim()}` : input.trim())
      : `📄 ${attachedDoc?.name}`;

    setInput("");
    setAttachedDoc(null);
    setLocalMessages((prev) => [...prev, { role: "user", content: displayMessage }]);

    await sendMutation.mutateAsync({ conversationId: convId, content: fullMessage, language: lang });
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            await transcribeMutation.mutateAsync({ audioBase64: base64, mimeType: "audio/webm", language: lang });
          } catch {
            toast.error("Erreur lors de la transcription audio");
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const fmtSize = (chars: number) =>
    chars > 1000 ? `${(chars / 1000).toFixed(1)}k caractères` : `${chars} caractères`;

  return (
    <AppLayout>
      <div className="flex h-full" style={{ height: "calc(100vh - 0px)" }}>
        {/* Conversations sidebar */}
        <div className="hidden lg:flex flex-col w-64 flex-shrink-0"
          style={{ borderRight: "1px solid var(--border)", background: "var(--background)" }}>
          <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <Button
              onClick={handleNewConversation}
              className="w-full gap-2 text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75 / 0.15), oklch(0.65 0.10 55 / 0.10))", color: "oklch(0.75 0.12 75)", border: "1px solid oklch(0.75 0.12 75 / 0.2)" }}
            >
              <Plus className="w-4 h-4" />
              Nouvelle conversation
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  setAttachedDoc(null);
                  navigate(`/chat/${conv.id}`);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                  activeConvId === conv.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
                style={activeConvId === conv.id ? {
                  background: "oklch(0.75 0.12 75 / 0.08)",
                  border: "1px solid oklch(0.75 0.12 75 / 0.15)",
                } : {}}
              >
                <p className="truncate font-medium">{conv.title || "Conversation"}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {new Date(conv.updatedAt).toLocaleDateString("fr-FR")}
                </p>
              </button>
            ))}
            {(!conversations || conversations.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune conversation</p>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {localMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 gold-glow"
                  style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75 / 0.15), oklch(0.65 0.10 55 / 0.10))", border: "1px solid oklch(0.75 0.12 75 / 0.2)" }}>
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                  KOSSI — Votre Directeur des Opérations
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Bonjour, je suis KOSSI. Partagez vos idées, projets, défis stratégiques. Je me souviens de tout et je vous aide à prioriser.
                </p>
                <div className="grid grid-cols-1 gap-2 mt-6 w-full max-w-sm">
                  {[
                    "Quels sont mes projets prioritaires ce mois-ci ?",
                    "J'ai une nouvelle idée pour Reina Professional...",
                    "Fais-moi un briefing de la situation actuelle",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left text-sm px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground transition-all"
                      style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {localMessages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))" }}>
                    <Brain className="w-4 h-4 text-background" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"
                  }`}
                  style={
                    msg.role === "user"
                      ? { background: "oklch(0.75 0.12 75 / 0.12)", border: "1px solid oklch(0.75 0.12 75 / 0.2)" }
                      : { background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }
                  }
                >
                  {msg.role === "assistant" ? (
                    <div className="prose-ai">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))" }}>
                  <Brain className="w-4 h-4 text-background" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm"
                  style={{ background: "oklch(0.11 0.006 270)", border: "1px solid oklch(0.20 0.008 270)" }}>
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="max-w-4xl mx-auto space-y-2">

              {/* Document badge */}
              {(attachedDoc || extractingDoc) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "oklch(0.75 0.12 75 / 0.06)", border: "1px solid oklch(0.75 0.12 75 / 0.2)" }}>
                  {extractingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                      <span className="text-xs text-primary">Lecture du document en cours…</span>
                    </>
                  ) : attachedDoc ? (
                    <>
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-primary truncate">{attachedDoc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtSize(attachedDoc.charCount)}
                          {attachedDoc.truncated && " · tronqué"}
                          {" · Tapez votre instruction ci-dessous"}
                        </p>
                      </div>
                      <button
                        onClick={() => setAttachedDoc(null)}
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors"
                        style={{ color: "oklch(0.55 0.008 60)" }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              <div className="flex gap-2 items-end">
                {/* File input (hidden) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.txt,.json,.md"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Paperclip button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extractingDoc}
                  title="Joindre un document (PDF, Excel, CSV, texte)"
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-accent disabled:opacity-40"
                  style={attachedDoc
                    ? { background: "oklch(0.75 0.12 75 / 0.12)", border: "1px solid oklch(0.75 0.12 75 / 0.3)", color: "oklch(0.75 0.12 75)" }
                    : { background: "oklch(0.14 0.006 270)", border: "1px solid oklch(0.20 0.008 270)", color: "oklch(0.55 0.008 60)" }
                  }
                >
                  {extractingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>

                {/* Voice button */}
                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isRecording ? "recording-pulse" : "hover:bg-accent"
                  }`}
                  style={
                    isRecording
                      ? { background: "oklch(0.55 0.18 25 / 0.2)", border: "1px solid oklch(0.55 0.18 25 / 0.4)", color: "oklch(0.55 0.18 25)" }
                      : { background: "oklch(0.14 0.006 270)", border: "1px solid oklch(0.20 0.008 270)", color: "oklch(0.55 0.008 60)" }
                  }
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Text input */}
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={attachedDoc
                      ? "Que voulez-vous faire avec ce document ? (organiser, analyser, résumer…)"
                      : "Partagez une idée, un projet, une question stratégique…"
                    }
                    className="resize-none min-h-[44px] max-h-32 py-2.5 pr-12 text-sm"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                    }}
                    rows={1}
                  />
                </div>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !attachedDoc) || sending}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: (input.trim() || attachedDoc) && !sending
                      ? "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))"
                      : "oklch(0.14 0.006 270)",
                    color: (input.trim() || attachedDoc) && !sending ? "oklch(0.08 0.005 270)" : "oklch(0.45 0.006 60)",
                  }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/50 text-center mt-2">
              Entrée pour envoyer · Maj+Entrée pour nouvelle ligne · 📎 PDF, Excel, CSV, texte
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
