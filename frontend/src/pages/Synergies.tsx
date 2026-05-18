import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, TrendingUp, ArrowRight, Lightbulb, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Synergie = {
  projectId1: number;
  projectId2: number;
  project1Title: string;
  project2Title: string;
  type: string;
  description: string;
  opportunityScore: number;
  recommendedAction: string;
};

type SynergiesResult = {
  synergies: Synergie[];
  globalInsight?: string;
  message?: string;
};

const SCORE_COLOR: Record<number, string> = {
  10: "bg-emerald-500",
  9: "bg-emerald-500",
  8: "bg-green-500",
  7: "bg-lime-500",
  6: "bg-yellow-500",
  5: "bg-amber-500",
  4: "bg-orange-500",
  3: "bg-red-400",
  2: "bg-red-500",
  1: "bg-red-600",
};

export default function Synergies() {
  const { lang, t } = useLanguage();
  const [result, setResult] = useState<SynergiesResult | null>(null);

  const analyzeMutation = trpc.synergies.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data);
      if (data.synergies.length === 0) {
        toast.info(data.message || "Aucune synergie détectée.");
      } else {
        toast.success(`${data.synergies.length} synergie(s) détectée(s) !`);
      }
    },
    onError: (err) => {
      toast.error("Erreur lors de l'analyse : " + err.message);
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate({ language: lang as "fr" | "pt" | "en" });
  };

  const getScoreColor = (score: number) => SCORE_COLOR[score] || "bg-gray-400";

  const labels = {
    fr: {
      title: "Synergies Stratégiques",
      subtitle: "Détection IA des opportunités croisées entre vos projets",
      analyzeBtn: "Analyser les synergies",
      reanalyzeBtn: "Ré-analyser",
      globalInsight: "Vision Stratégique Globale",
      noSynergies: "Aucune synergie détectée pour l'instant.",
      scoreLabel: "Score",
      actionLabel: "Action recommandée",
      loading: "Analyse en cours...",
      emptyTitle: "Prêt pour l'analyse",
      emptySubtitle: "Cliquez sur \"Analyser\" pour découvrir les synergies entre vos projets actifs.",
    },
    pt: {
      title: "Sinergias Estratégicas",
      subtitle: "Detecção IA de oportunidades cruzadas entre seus projetos",
      analyzeBtn: "Analisar sinergias",
      reanalyzeBtn: "Re-analisar",
      globalInsight: "Visão Estratégica Global",
      noSynergies: "Nenhuma sinergia detectada por enquanto.",
      scoreLabel: "Pontuação",
      actionLabel: "Ação recomendada",
      loading: "Análise em andamento...",
      emptyTitle: "Pronto para análise",
      emptySubtitle: "Clique em \"Analisar\" para descobrir as sinergias entre seus projetos ativos.",
    },
    en: {
      title: "Strategic Synergies",
      subtitle: "AI detection of cross-opportunities between your projects",
      analyzeBtn: "Analyze synergies",
      reanalyzeBtn: "Re-analyze",
      globalInsight: "Global Strategic Insight",
      noSynergies: "No synergies detected yet.",
      scoreLabel: "Score",
      actionLabel: "Recommended action",
      loading: "Analysis in progress...",
      emptyTitle: "Ready for analysis",
      emptySubtitle: "Click \"Analyze\" to discover synergies between your active projects.",
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.fr;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            {l.title}
          </h1>
          <p className="text-muted-foreground mt-1">{l.subtitle}</p>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={analyzeMutation.isPending}
          className="gap-2"
        >
          {analyzeMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {l.loading}
            </>
          ) : result ? (
            <>
              <RefreshCw className="h-4 w-4" />
              {l.reanalyzeBtn}
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              {l.analyzeBtn}
            </>
          )}
        </Button>
      </div>

      {/* Empty state */}
      {!result && !analyzeMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Lightbulb className="h-8 w-8 text-yellow-500" />
            </div>
            <div>
              <p className="font-medium text-lg">{l.emptyTitle}</p>
              <p className="text-muted-foreground mt-1 max-w-md">{l.emptySubtitle}</p>
            </div>
            <Button onClick={handleAnalyze} variant="outline" className="gap-2">
              <Zap className="h-4 w-4" />
              {l.analyzeBtn}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {analyzeMutation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">{l.loading}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !analyzeMutation.isPending && (
        <>
          {/* Global Insight */}
          {result.globalInsight && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {l.globalInsight}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{result.globalInsight}</p>
              </CardContent>
            </Card>
          )}

          {/* No synergies */}
          {result.synergies.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {result.message || l.noSynergies}
              </CardContent>
            </Card>
          )}

          {/* Synergies list */}
          {result.synergies.length > 0 && (
            <div className="grid gap-4">
              {result.synergies
                .sort((a, b) => b.opportunityScore - a.opportunityScore)
                .map((synergie, idx) => (
                  <Card key={idx} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Projects connection */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-medium">
                              {synergie.project1Title}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Badge variant="outline" className="font-medium">
                              {synergie.project2Title}
                            </Badge>
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
                              {synergie.type}
                            </Badge>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {synergie.description}
                          </p>

                          {/* Recommended action */}
                          <div className="flex items-start gap-2 bg-muted/50 rounded-md p-3">
                            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                {l.actionLabel}
                              </p>
                              <p className="text-sm">{synergie.recommendedAction}</p>
                            </div>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div
                            className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${getScoreColor(synergie.opportunityScore)}`}
                          >
                            {synergie.opportunityScore}
                          </div>
                          <p className="text-xs text-muted-foreground">{l.scoreLabel}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
