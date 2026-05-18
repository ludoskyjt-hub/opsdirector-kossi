import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ReactNode, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import {
  Brain,
  LayoutDashboard,
  MessageSquare,
  Mic,
  FolderOpen,
  Lightbulb,
  Bell,
  CheckSquare,
  LogOut,
  Menu,
  X,
  ChevronRight,
  CalendarDays,
  CreditCard,
  Crown,
  Zap,
  Star,
  TrendingUp,
  FileText,
  FileType,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV_ITEMS_KEYS = [
  { icon: LayoutDashboard, key: "dashboard" as const, path: "/dashboard" },
  { icon: MessageSquare, key: "chat" as const, path: "/chat" },
  { icon: FolderOpen, key: "projects" as const, path: "/projects" },
  { icon: Lightbulb, key: "ideas" as const, path: "/ideas" },
  { icon: Bell, key: "reminders" as const, path: "/reminders" },
  { icon: CalendarDays, key: "calendar" as const, path: "/calendar" },
  { icon: Zap, key: "synergies" as const, path: "/synergies" },
  { icon: CreditCard, key: "pricing" as const, path: "/pricing" },
  { icon: TrendingUp, key: "finance" as const, path: "/finance" },
  { icon: FileText, key: "reports" as const, path: "/reports" },
  { icon: FileType, key: "documents" as const, path: "/documents" },
];

interface AppLayoutProps {
  children: ReactNode;
}

const PLAN_BADGE_CONFIG = {
  starter: { label: "Starter", icon: Star, color: "oklch(0.45 0.008 270)" },
  pro: { label: "Pro", icon: Zap, color: "oklch(0.75 0.12 75)" },
  executive: { label: "Executive", icon: Crown, color: "oklch(0.75 0.12 75)" },
};

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguage();

  const { data: subInfo } = trpc.stripe.getSubscriptionInfo.useQuery(
    undefined,
    { enabled: !!user }
  );
  const currentPlan = (subInfo?.plan || "starter") as keyof typeof PLAN_BADGE_CONFIG;
  const planBadge = PLAN_BADGE_CONFIG[currentPlan];

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
      navigate("/");
    },
    onError: () => toast.error("Erreur lors de la déconnexion"),
  });

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={`flex flex-col h-full ${mobile ? "w-full" : "w-64"}`}
      style={{
        background: "var(--sidebar)",
        borderRight: mobile ? "none" : "1px solid var(--sidebar-border)",
      }}
    >
      {/* Logo */}
      <div className="p-5 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 gold-glow"
          style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))" }}
        >
          <Brain className="w-5 h-5 text-background" />
        </div>
        <div>
          <p className="text-sm font-bold gradient-text leading-none">OpsDirector</p>
          <p className="text-[9px] mt-0.5 tracking-widest uppercase" style={{ color: "oklch(0.75 0.12 75 / 0.45)" }}>Enam Impact Agency</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS_KEYS.map(({ icon: Icon, key, path }) => {
          const label = t.nav[key];
          const isActive = location === path || (path === "/chat" && location.startsWith("/chat"));
          return (
            <button
              key={path}
              onClick={() => {
                navigate(path);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
              style={
                isActive
                  ? {
                      background: "linear-gradient(135deg, oklch(0.75 0.12 75 / 0.15), oklch(0.65 0.10 55 / 0.10))",
                      color: "oklch(0.75 0.12 75)",
                      border: "1px solid oklch(0.75 0.12 75 / 0.2)",
                    }
                  : {}
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </button>
          );
        })}
      </nav>

      {/* User */}
      {/* Language selector */}
      <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
        <LanguageSelector />
      </div>

      <div className="p-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-2"
          style={{ background: "var(--card)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))", color: "oklch(0.08 0.005 270)" }}>
            {user?.name?.charAt(0).toUpperCase() || "J"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-foreground truncate">{user?.name || ""}</p>
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: currentPlan === "starter" ? "var(--border)" : "oklch(0.75 0.12 75 / 0.15)", color: planBadge.color, border: `1px solid ${planBadge.color}40` }}
              >
                <planBadge.icon className="w-2.5 h-2.5" />
                {planBadge.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
          </div>
        </div>
        <button
          onClick={() => logoutMutation.mutate()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t.nav.logout}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 z-10">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--sidebar-border)", background: "var(--sidebar)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))" }}>
              <Brain className="w-4 h-4 text-background" />
            </div>
            <span className="text-sm font-bold gradient-text">OpsDirector</span>
          </div>
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom navigation bar — 5 main tabs max */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-1 py-2"
          style={{ background: "var(--sidebar)", borderTop: "1px solid var(--sidebar-border)", backdropFilter: "blur(12px)" }}>
          {[
            { icon: LayoutDashboard, key: "dashboard" as const, path: "/dashboard" },
            { icon: MessageSquare, key: "chat" as const, path: "/chat" },
            { icon: FolderOpen, key: "projects" as const, path: "/projects" },
            { icon: Lightbulb, key: "ideas" as const, path: "/ideas" },
            { icon: Bell, key: "reminders" as const, path: "/reminders" },
          ].map(({ icon: Icon, key, path }) => {
            const isActive = location === path || (path === "/chat" && location.startsWith("/chat"));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all"
                style={isActive ? { color: "oklch(0.75 0.12 75)" } : { color: "oklch(0.45 0.008 270)" }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium">{t.nav[key]}</span>
              </button>
            );
          })}
          {/* More button — opens sidebar */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all"
            style={["/calendar","/synergies","/pricing","/finance","/reports","/documents"].includes(location) ? { color: "oklch(0.75 0.12 75)" } : { color: "oklch(0.45 0.008 270)" }}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[9px] font-medium">Plus</span>
          </button>
        </nav>

        {/* FAB — floating microphone button (mobile only) */}
        <button
          className="md:hidden fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
          style={{ background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))" }}
          onClick={() => navigate("/ideas")}
          aria-label="Capturer une idée"
        >
          <Mic className="w-5 h-5 text-background" />
        </button>
      </div>
    </div>
  );
}
