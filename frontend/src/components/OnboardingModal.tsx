import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Brain, FolderOpen, MessageSquare, Mic, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const ONBOARDING_KEY = "opsdirector_onboarding_done";

const STEP_ICONS = [FolderOpen, MessageSquare, Mic];

export default function OnboardingModal() {
  const { t } = useLanguage();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Only show after authentication is confirmed and only on first login
    if (loading || !isAuthenticated) return;
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading]);

  const steps = [
    t.onboarding.step1,
    t.onboarding.step2,
    t.onboarding.step3,
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setVisible(false);
    // Navigate to the relevant page based on last step
    navigate("/projects");
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {!completed ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))",
                }}
              >
                <Brain className="w-5 h-5 text-background" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {t.onboarding.welcome}
                </h2>
                <p className="text-xs text-muted-foreground">{t.onboarding.welcomeSub}</p>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-2 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? "2rem" : "0.5rem",
                    background: i <= step
                      ? "linear-gradient(90deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))"
                      : "var(--border)",
                  }}
                />
              ))}
            </div>

            {/* Step content */}
            <div
              className="rounded-xl p-5 mb-6"
              style={{ background: "var(--card)", border: "1px solid oklch(0.20 0.008 270)" }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "oklch(0.75 0.12 75 / 0.12)", border: "1px solid oklch(0.75 0.12 75 / 0.2)" }}
                >
                  {(() => {
                    const Icon = STEP_ICONS[step];
                    return <Icon className="w-6 h-6 text-primary" />;
                  })()}
                </div>
                <div>
                  <div className="text-xs font-medium text-primary mb-1">
                    {t.onboarding.step1.title === steps[step].title ? "Étape 1 / 3" :
                     t.onboarding.step2.title === steps[step].title ? "Étape 2 / 3" : "Étape 3 / 3"}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {steps[step].title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {steps[step].desc}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.onboarding.skip}
              </button>
              <Button
                onClick={handleNext}
                className="px-6"
                style={{
                  background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))",
                  color: "oklch(0.08 0.005 270)",
                }}
              >
                {step < steps.length - 1 ? t.onboarding.next : t.onboarding.start}
              </Button>
            </div>
          </>
        ) : (
          /* Completion screen */
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "oklch(0.75 0.12 75 / 0.15)", border: "2px solid oklch(0.75 0.12 75 / 0.3)" }}
              >
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              KOSSI est prêt !
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              KOSSI, votre Directeur des Opérations personnel, vous attend. Commencez par créer votre premier projet.
            </p>
            <Button
              onClick={handleFinish}
              className="w-full"
              style={{
                background: "linear-gradient(135deg, oklch(0.75 0.12 75), oklch(0.65 0.10 55))",
                color: "oklch(0.08 0.005 270)",
              }}
            >
              {t.onboarding.finish}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
