import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicOnlyRoute } from "@/components/PublicOnlyRoute";
import { AppSidebar } from "@/components/AppSidebar";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectWorkspacePage from "./pages/ProjectWorkspacePage";
import SettingsPage from "./pages/SettingsPage";
import ClientesPage from "./pages/ClientesPage";
import CotizacionesPage from "./pages/CotizacionesPage";
import TeamPage from "./pages/TeamPage";
import CorporateOverviewPage from "./pages/CorporateOverviewPage";
import CorporateResourcesPage from "./pages/CorporateResourcesPage";
import CorporateReportsPage from "./pages/CorporateReportsPage";
import CorporateRisksPage from "./pages/CorporateRisksPage";
import LearnCenterPage from "./pages/LearnCenterPage";
import AdminConsolePage from "./pages/AdminConsolePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import LandingPage from "./pages/LandingPage";
import InviteAcceptPage from "./pages/InviteAcceptPage";
import UnsubscribePage from "./pages/UnsubscribePage";
import ComoFuncionaPage from "./pages/ComoFuncionaPage";
import NotFound from "./pages/NotFound";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PremiumRoute } from "@/components/billing/PremiumRoute";
import { useLocation } from "react-router-dom";

/** En "/" mostramos landing pública si no hay sesión, y dashboard si la hay. */
function RootGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return (
      <ProtectedRoute>
        <div>
          <AppSidebar />
          <AppLayout><Dashboard /></AppLayout>
        </div>
      </ProtectedRoute>
    );
  }
  return <LandingPage />;
}

const queryClient = new QueryClient();

function AppShell() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/auth/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/auth/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
      <Route path="/auth/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      {/* Rutas públicas accesibles con o sin sesión */}
      <Route path="/invite/:token" element={<InviteAcceptPage />} />
      <Route path="/unsubscribe" element={<UnsubscribePage />} />
      <Route path="/como-funciona" element={<ComoFuncionaPage />} />

      <Route path="/" element={<ErrorBoundary resetKey={location.pathname}><RootGate /></ErrorBoundary>} />

      <Route
        path="*"
        element={
          <ProtectedRoute>
            <>
              <AppSidebar />
              <AppLayout>
                <ErrorBoundary resetKey={location.pathname}>
                  <Routes>
                    <Route path="/clientes" element={<ClientesPage />} />
                    <Route path="/cotizaciones" element={<CotizacionesPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
                    <Route path="/team" element={<TeamPage />} />
                    {/* Centro Financiero Corporativo (plan Business) */}
                    <Route path="/finanzas" element={<PremiumRoute feature="executive_dashboard"><CorporateOverviewPage /></PremiumRoute>} />
                    <Route path="/costs" element={<PremiumRoute feature="cost_intelligence"><CorporateOverviewPage /></PremiumRoute>} />
                    <Route path="/resources" element={<PremiumRoute feature="resources_management"><CorporateResourcesPage /></PremiumRoute>} />
                    <Route path="/reports" element={<PremiumRoute feature="advanced_reports"><CorporateReportsPage /></PremiumRoute>} />
                    <Route path="/riesgos" element={<PremiumRoute feature="smart_alerts"><CorporateRisksPage /></PremiumRoute>} />
                    <Route path="/risks" element={<Navigate to="/riesgos" replace />} />
                    <Route path="/learn" element={<LearnCenterPage />} />
                    <Route path="/ayuda" element={<Navigate to="/learn" replace />} />
                    <Route path="/admin" element={<AdminConsolePage />} />
                    {/* Ruta legacy: tareas globales → ahora dentro del proyecto */}
                    <Route path="/tasks" element={<Navigate to="/projects" replace />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ErrorBoundary>
              </AppLayout>
            </>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
