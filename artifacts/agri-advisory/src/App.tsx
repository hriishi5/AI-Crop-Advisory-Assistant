import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/app-shell';
import { LandingPage, LoginPage, RegisterPage } from '@/pages/public-pages';
import { AdvisoryFormPage, AdvisoryReportPage, DashboardPage, DiagnosticFormPage, DiagnosticReportPage, FarmDetailPage, FarmsPage, HistoryPage, ProfilePage } from '@/pages/app-pages';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/dashboard"><AppShell><DashboardPage /></AppShell></Route>
        <Route path="/farms" ><AppShell><FarmsPage /></AppShell></Route>
        <Route path="/farms/new"><AppShell><FarmsPage /></AppShell></Route>
        <Route path="/farms/:farmId"><AppShell><FarmDetailPage /></AppShell></Route>
        <Route path="/farms/:farmId/advisory/new"><AppShell><AdvisoryFormPage /></AppShell></Route>
        <Route path="/advisory/:advisoryId"><AppShell><AdvisoryReportPage /></AppShell></Route>
        <Route path="/farms/:farmId/diagnose/new"><AppShell><DiagnosticFormPage /></AppShell></Route>
        <Route path="/diagnostic/:diagnosticId"><AppShell><DiagnosticReportPage /></AppShell></Route>
        <Route path="/history"><AppShell><HistoryPage /></AppShell></Route>
        <Route path="/profile"><AppShell><ProfilePage /></AppShell></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
