import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff, Fingerprint } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { trpc } from "@/lib/trpc";
import { setOpsToken } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import WebAuthnLoginButton from "@/components/WebAuthnLoginButton";

const GOLD = "#c9a227";
const DARK_BG = "hsl(248 55% 6%)";
const PANEL_BG = "hsl(248 58% 5%)";

export default function Home() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [showPass, setShowPass] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  const handleAuthSuccess = (data: { token: string; user: Parameters<typeof utils.auth.me.setData>[1] }) => {
    setOpsToken(data.token);
    utils.auth.me.setData(undefined, data.user);
    navigate("/dashboard");
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: handleAuthSuccess,
    onError: (e) => toast.error(e.message),
  });
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: handleAuthSuccess,
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") loginMutation.mutate({ email: form.email, password: form.password });
    else registerMutation.mutate({ email: form.email, password: form.password, name: form.name });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DARK_BG }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }
  if (user) return null;

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen flex" style={{ background: DARK_BG }}>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12 relative overflow-hidden"
        style={{ background: PANEL_BG, borderRight: "1px solid rgba(201,162,39,0.10)" }}>

        {/* subtle grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(201,162,39,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,162,39,0.03) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        {/* top glow */}
        <div className="absolute top-0 left-0 w-full h-64 pointer-events-none" style={{
          background: "radial-gradient(ellipse 60% 40% at 40% 0%, rgba(201,162,39,0.14) 0%, transparent 80%)",
        }} />

        <div className="relative z-10 flex flex-col gap-5">
          {/* Enam Impact logo */}
          <img src="/ops/enam-impact-logo.png" alt="Enam Impact Agency"
            className="h-14 w-auto object-contain opacity-90 self-start"
            style={{ filter: "brightness(1.1)" }} />

          {/* OpsDirector branding */}
          <div className="flex items-center gap-3 mt-1">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #a07818)`, boxShadow: `0 0 20px rgba(201,162,39,0.35)` }}>
              <ChipIcon size={20} color="#07070f" />
            </div>
            <div>
              <span className="font-black text-2xl tracking-tight" style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                background: `linear-gradient(135deg, #ede9e0, ${GOLD})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                OpsDirector
              </span>
              <p className="text-xs tracking-widest uppercase mt-0.5" style={{ color: "rgba(201,162,39,0.5)", letterSpacing: "0.18em" }}>
                Enam Impact Agency
              </p>
            </div>
          </div>
        </div>

        {/* Middle content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight" style={{ color: "#ede9e0" }}>
              Votre Directeur des<br />
              <span style={{ color: GOLD }}>Opérations personnel</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "rgba(237,233,224,0.45)" }}>
              Un agent IA avec mémoire persistante qui transforme vos idées en projets, anticipe vos priorités et vous accompagne à chaque instant.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: "✦", text: "Mémoire persistante et contextuelle" },
              { icon: "✦", text: "Briefings et alertes proactifs" },
              { icon: "✦", text: "Capture vocale de vos idées" },
              { icon: "✦", text: "Accès privé et sécurisé" },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3">
                <span className="text-xs" style={{ color: GOLD }}>{item.icon}</span>
                <span className="text-sm" style={{ color: "rgba(237,233,224,0.55)" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: "rgba(201,162,39,0.25)" }}>
          © 2026 OpsDirector · Enam Impact Agency
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative">

        {/* Lang switcher top-right */}
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>

        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center mb-8 gap-2">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #a07818)`, boxShadow: `0 0 24px rgba(201,162,39,0.35)` }}>
              <ChipIcon size={26} color="#07070f" />
            </div>
            <span className="font-black text-2xl" style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              background: `linear-gradient(135deg, #ede9e0, ${GOLD})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>OpsDirector</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold" style={{ color: "#ede9e0" }}>
              {mode === "login" ? "Connexion" : "Créer un compte"}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "rgba(237,233,224,0.4)" }}>
              {mode === "login" ? "Accédez à votre espace opérationnel" : "Rejoignez OpsDirector"}
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-6 space-y-4"
            style={{ background: "hsl(248 50% 10%)", border: "1px solid rgba(201,162,39,0.12)" }}>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl mb-1" style={{ background: "rgba(255,255,255,0.04)" }}>
              {(["login", "register"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={mode === m
                    ? { background: GOLD, color: "#07070f" }
                    : { color: "rgba(237,233,224,0.4)" }}>
                  {m === "login" ? "Connexion" : "Inscription"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <Input placeholder="Nom complet" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="bg-white/6 border-white/10 text-white placeholder:text-white/25"
                  style={{ "--tw-ring-color": `${GOLD}66` } as React.CSSProperties} />
              )}
              <Input type="email" placeholder="Adresse email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="bg-white/6 border-white/10 text-white placeholder:text-white/25" />
              <div className="relative">
                <Input type={showPass ? "text" : "password"} placeholder="••••••••"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="bg-white/6 border-white/10 text-white placeholder:text-white/25 pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity opacity-40 hover:opacity-70"
                  style={{ color: GOLD }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" disabled={isPending || !form.email || !form.password}
                className="w-full h-11 font-semibold text-sm"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, #a07818)`,
                  color: "#07070f",
                  boxShadow: `0 4px 18px rgba(201,162,39,0.28)`,
                }}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {mode === "login" ? "Accéder à mon espace" : "Créer mon compte"}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "rgba(201,162,39,0.10)" }} />
              <span className="text-xs" style={{ color: "rgba(237,233,224,0.25)" }}>ou</span>
              <div className="flex-1 h-px" style={{ background: "rgba(201,162,39,0.10)" }} />
            </div>

            <WebAuthnLoginButton />
          </div>

          <p className="mt-5 text-center text-xs" style={{ color: "rgba(237,233,224,0.2)" }}>
            Accès sécurisé · Données privées · Mémoire persistante
          </p>
        </div>
      </div>
    </div>
  );
}

function ChipIcon({ size = 18, color = "#c9a227" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M7 9H5M7 12H5M7 15H5M17 9h2M17 12h2M17 15h2M9 7V5M12 7V5M15 7V5M9 19v-2M12 19v-2M15 19v-2" />
    </svg>
  );
}
