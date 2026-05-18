import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import OfflineBanner from "@/components/OfflineBanner";
import { Route, Router, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import OnboardingModal from "./components/OnboardingModal";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Projects from "./pages/Projects";
import Ideas from "./pages/Ideas";
import Reminders from "./pages/Reminders";
import Calendar from "./pages/Calendar";
import Pricing from "./pages/Pricing";
import Synergies from "./pages/Synergies";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function AppRouter() {
  return (
    <Router base={BASE}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/dashboard"} component={Dashboard} />
        <Route path={"/chat"} component={Chat} />
        <Route path={"/chat/:id"} component={Chat} />
        <Route path={"/projects"} component={Projects} />
        <Route path={"/ideas"} component={Ideas} />
        <Route path={"/reminders"} component={Reminders} />
        <Route path={"/calendar"} component={Calendar} />
        <Route path={"/pricing"} component={Pricing} />
        <Route path={"/synergies"} component={Synergies} />
        <Route path={"/finance"} component={Finance} />
        <Route path={"/reports"} component={Reports} />
        <Route path={"/documents"} component={Documents} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LanguageProvider>
          <TooltipProvider>
            <OfflineBanner />
            <Toaster
              theme="dark"
              toastOptions={{
                style: {
                  background: "oklch(0.11 0.006 270)",
                  border: "1px solid oklch(0.20 0.008 270)",
                  color: "oklch(0.93 0.008 60)",
                },
              }}
            />
            <OnboardingModal />
            <AppRouter />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
