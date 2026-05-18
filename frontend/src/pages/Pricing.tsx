import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Check, Crown, Zap, Star, Loader2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const PLAN_ICONS = {
  starter: Star,
  pro: Zap,
  executive: Crown,
};

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useLanguage();
  const [, navigate] = useLocation();

  const { data: subInfo } = trpc.stripe.getSubscriptionInfo.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const createCheckout = trpc.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      toast.info(
        lang === "pt" ? "Redirecionando para o pagamento..." :
        lang === "en" ? "Redirecting to payment..." :
        "Redirection vers le paiement..."
      );
      window.open(data.url, "_blank");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const cancelSub = trpc.stripe.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success(
        lang === "pt" ? "Assinatura cancelada. Você voltou ao plano Starter." :
        lang === "en" ? "Subscription cancelled. You are back on the Starter plan." :
        "Abonnement annulé. Vous êtes revenu au plan Starter."
      );
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const currentPlan = subInfo?.plan || "starter";

  const plans = [
    {
      id: "starter" as const,
      name: t.pricing.starter.name,
      price: t.pricing.starter.price,
      period: null,
      desc: t.pricing.starter.desc,
      features: t.pricing.starter.features,
      cta: t.pricing.starter.cta,
      badge: null,
    },
    {
      id: "pro" as const,
      name: t.pricing.pro.name,
      price: t.pricing.pro.price,
      period: t.pricing.pro.period,
      desc: t.pricing.pro.desc,
      features: t.pricing.pro.features,
      cta: t.pricing.pro.cta,
      badge: t.pricing.pro.badge,
    },
    {
      id: "executive" as const,
      name: t.pricing.executive.name,
      price: t.pricing.executive.price,
      period: t.pricing.executive.period,
      desc: t.pricing.executive.desc,
      features: t.pricing.executive.features,
      cta: t.pricing.executive.cta,
      badge: null,
    },
  ];

  const handleUpgrade = (planId: "pro" | "executive") => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }
    createCheckout.mutate({ planId });
  };

  const handleCancel = () => {
    const msg =
      lang === "pt" ? "Confirmar cancelamento da assinatura? Você voltará ao plano Starter." :
      lang === "en" ? "Confirm subscription cancellation? You will return to the Starter plan." :
      "Confirmer l'annulation de votre abonnement ? Vous reviendrez au plan Starter.";
    if (confirm(msg)) {
      cancelSub.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-playfair text-4xl font-bold text-amber-400 mb-4">
            {t.pricing.title}
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            {t.pricing.subtitle}
          </p>

          {isAuthenticated && subInfo && (
            <div className="mt-4 inline-flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 text-sm">
              <span className="text-zinc-400">
                {lang === "pt" ? "Plano atual:" : lang === "en" ? "Current plan:" : "Plan actuel :"}
              </span>
              <span className="text-amber-400 font-semibold capitalize">{currentPlan}</span>
            </div>
          )}
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.id];
            const isCurrent = currentPlan === plan.id;
            const isExecutive = plan.id === "executive";
            const isPro = plan.id === "pro";

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all ${
                  isExecutive
                    ? "border-amber-400 bg-gradient-to-b from-amber-950/30 to-zinc-900/50 ring-2 ring-amber-400/20"
                    : isPro
                    ? "border-amber-500/50 bg-amber-950/20"
                    : "border-zinc-700 bg-zinc-900/50"
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${isExecutive ? "bg-amber-500/20" : "bg-zinc-800"}`}>
                    <Icon className={`w-5 h-5 ${isExecutive ? "text-amber-400" : "text-zinc-400"}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-100">{plan.name}</h3>
                    <p className="text-zinc-500 text-sm">{plan.desc}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-zinc-100">{plan.price}</span>
                    {plan.period && (
                      <span className="text-zinc-500 text-sm">{plan.period}</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-center text-zinc-400 text-sm font-medium">
                    {lang === "pt" ? "Plano atual" : lang === "en" ? "Current plan" : "Plan actuel"}
                  </div>
                ) : plan.id === "starter" ? (
                  <div className="w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-center text-zinc-500 text-sm">
                    {lang === "pt" ? "Plano gratuito" : lang === "en" ? "Free plan" : "Plan gratuit"}
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={createCheckout.isPending}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                      isExecutive
                        ? "bg-amber-500 hover:bg-amber-400 text-black"
                        : "bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border border-zinc-600"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {createCheckout.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {plan.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Cancel subscription */}
        {isAuthenticated && currentPlan !== "starter" && (
          <div className="mt-12 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              {lang === "pt" ? "Você pode cancelar a qualquer momento." :
               lang === "en" ? "You can cancel at any time." :
               "Vous pouvez annuler à tout moment."}
            </div>
            <button
              onClick={handleCancel}
              disabled={cancelSub.isPending}
              className="text-zinc-600 hover:text-zinc-400 text-sm underline transition-colors"
            >
              {lang === "pt" ? "Cancelar minha assinatura" :
               lang === "en" ? "Cancel my subscription" :
               "Annuler mon abonnement"}
            </button>
          </div>
        )}

        {/* Test mode notice */}
        <div className="mt-8 p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
          <p className="text-zinc-500 text-xs">
            {lang === "pt"
              ? "🧪 Modo de teste — use o cartão 4242 4242 4242 4242 para testar pagamentos"
              : lang === "en"
              ? "🧪 Test mode — use card 4242 4242 4242 4242 to test payments"
              : "🧪 Mode test — utilisez la carte 4242 4242 4242 4242 pour tester les paiements"}
          </p>
        </div>
      </div>
    </div>
  );
}
