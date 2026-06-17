import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { CountryFilterProvider, useCountryFilter } from "@/contexts/country-filter-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { SipProvider, useSip } from "@/contexts/sip-context";
import { CallProvider } from "@/contexts/call-context";
import { I18nProvider } from "@/i18n";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TourProvider, TourTrigger } from "@/components/tour-provider";
import { SipPhoneHeaderButton } from "@/components/sip-phone";
import { QuickCreate } from "@/components/quick-create";
import { EmailNotifications } from "@/components/email-notifications";
import { ChatProvider } from "@/contexts/chat-context";
import { ChatContainer } from "@/components/chat-container";
import { useSessionHeartbeat } from "@/hooks/use-session-heartbeat";
import { NotificationBell, NotificationCenterPage } from "@/components/notification-center";
import { NexusButton } from "@/components/nexus/nexus-button";
import LandingPage from "@/pages/landing";
import { Component as ReactComponent, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";

// Route pages are lazy-loaded so the initial bundle stays small; each page is
// fetched on demand when its route is first visited (see <Suspense> below).
const PublicSigningPage = lazy(() => import("@/pages/public-signing"));
const AuditTimelinePublic = lazy(() => import("@/pages/audit-timeline-public"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const UsersPage = lazy(() => import("@/pages/users"));
const CustomersPage = lazy(() => import("@/pages/customers"));
const ProductsPage = lazy(() => import("@/pages/products"));
const InvoicesPage = lazy(() => import("@/pages/invoices"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const HospitalsPage = lazy(() => import("@/pages/hospitals"));
const VisitEventsPage = lazy(() => import("@/pages/visit-events"));
const CollaboratorsPage = lazy(() => import("@/pages/collaborators"));
const CollaboratorReportsPage = lazy(() => import("@/pages/collaborator-reports"));
const ConfiguratorPage = lazy(() => import("@/pages/configurator"));
const CampaignsPage = lazy(() => import("@/pages/campaigns"));
const CampaignDetailPage = lazy(() => import("@/pages/campaign-detail"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const TaskGroupsPage = lazy(() => import("@/pages/task-groups"));
const ContractsPage = lazy(() => import("@/pages/contracts"));
const ContractDetailPage = lazy(() => import("@/pages/contract-detail"));
const TemplateEditorPage = lazy(() => import("@/pages/template-editor"));
const PipelinePage = lazy(() => import("@/pages/pipeline"));
const MS365IntegrationPage = lazy(() => import("@/pages/ms365-integration"));
const EmailClientPage = lazy(() => import("@/pages/email-client"));
const MobilePreview = lazy(() => import("@/pages/mobile-preview"));
const CollectionsPage = lazy(() => import("@/pages/collections"));
const CampaignReportsPage = lazy(() => import("@/pages/campaign-reports"));
const CustomerInvoicesPage = lazy(() => import("@/pages/customer-invoices"));
const AgentWorkspacePage = lazy(() => import("@/pages/agent-workspace"));
const SopManagementPage = lazy(() => import("@/pages/sop-management"));
const MedicalPartnerNetworkPage = lazy(() => import("@/pages/medical-partner-network"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const TrainingRoomPage = lazy(() => import("@/pages/training-room"));
const StatusManagementPage = lazy(() => import("@/pages/status-management"));
const AutomationsPage = lazy(() => import("@/pages/automations"));
const ScrapingPage = lazy(() => import("@/pages/scraping"));
const PublicFormPage = lazy(() => import("@/pages/public-form"));
import { AgentSessionProvider } from "@/contexts/agent-session-context";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

class ErrorBoundary extends ReactComponent<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error: Error | null; componentStack: string | null }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ componentStack: (errorInfo as any).componentStack || null });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", color: "red" }}>
          <h2>Component Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>{this.state.error?.message}</pre>
          {this.state.componentStack && (
            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ color: "#333", fontSize: "0.9rem" }}>Component Stack:</h3>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", color: "#666", background: "#f5f5f5", padding: "0.5rem", borderRadius: "4px" }}>{this.state.componentStack}</pre>
            </div>
          )}
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", marginTop: "1rem", color: "#666" }}>{this.state.error?.stack}</pre>
          <button onClick={() => this.setState({ hasError: false, error: null, componentStack: null })} style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return <Component />;
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <I18nProvider userCountries={[]}>
        <Switch>
          <Route path="/login" component={LandingPage} />
          <Route>
            <Redirect to="/login" />
          </Route>
        </Switch>
      </I18nProvider>
    );
  }

  return (
    <ErrorBoundary>
      <AuthenticatedApp />
    </ErrorBoundary>
  );
}

function I18nWrapper({ children, userCountries }: { children: React.ReactNode; userCountries: string[] }) {
  const { selectedCountries } = useCountryFilter();
  return (
    <I18nProvider userCountries={userCountries} selectedCountries={selectedCountries}>
      {children}
    </I18nProvider>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const sipContext = useSip();
  const [location] = useLocation();
  useSessionHeartbeat();
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <CountryFilterProvider>
      <PermissionsProvider>
        <I18nWrapper userCountries={user?.assignedCountries || []}>
          <ChatProvider>
          <TourProvider>
          <CallProvider>
          <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              <header className="flex h-14 items-center justify-between gap-4 border-b px-4 shrink-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-2">
                  <GlobalSearch />
                  <QuickCreate />
                  {(user as any)?.showEmailQueue && <EmailNotifications />}
                  {(user as any)?.showNotificationBell !== false && <NotificationBell />}
                  <NexusButton nexusEnabled={user?.nexusEnabled ?? false} />
                  {(user as any)?.showSipPhone && <SipPhoneHeaderButton user={user} sipContext={sipContext} />}
                  <TourTrigger />
                  <ThemeToggle />
                </div>
              </header>
              <main className={`flex-1 overflow-auto ${location === "/email" ? "p-0" : "p-4"}`}>
                <div>
                  <Suspense fallback={<PageLoader />}>
                  <Switch>
                    <Route path="/" component={Dashboard} />
                    <Route path="/users" component={UsersPage} />
                    <Route path="/customers" component={CustomersPage} />
                    <Route path="/products" component={ProductsPage} />
                    <Route path="/invoices" component={InvoicesPage} />
                    <Route path="/hospitals" component={HospitalsPage} />
                    <Route path="/visit-events" component={VisitEventsPage} />
                    <Route path="/collaborators" component={CollaboratorsPage} />
                    <Route path="/collaborator-reports" component={CollaboratorReportsPage} />
                    <Route path="/collections">{() => <CollectionsPage key="list" />}</Route>
                    <Route path="/collections/new">{() => <CollectionsPage key="new" />}</Route>
                    <Route path="/collections/:id">{() => <CollectionsPage key="edit" />}</Route>
                    <Route path="/campaigns" component={CampaignsPage} />
                    <Route path="/campaigns/:id" component={CampaignDetailPage} />
                    <Route path="/campaigns/:id/reports" component={CampaignReportsPage} />
                    <Route path="/pipeline" component={PipelinePage} />
                    <Route path="/tasks" component={TasksPage} />
                    <Route path="/task-groups" component={TaskGroupsPage} />
                    <Route path="/contracts/editor/:categoryId/:countryCode">
                      {(params) => <TemplateEditorPage categoryId={params.categoryId} countryCode={params.countryCode} />}
                    </Route>
                    <Route path="/contracts/:id" component={ContractDetailPage} />
                    <Route path="/contracts" component={ContractsPage} />
                    <Route path="/customer-invoices" component={CustomerInvoicesPage} />
                    <Route path="/reports" component={ReportsPage} />
                    <Route path="/settings" component={SettingsPage} />
                    <Route path="/status-management" component={StatusManagementPage} />
                    <Route path="/automations" component={AutomationsPage} />
                    <Route path="/scraping" component={ScrapingPage} />
                    <Route path="/configurator" component={ConfiguratorPage} />
                    <Route path="/ms365" component={MS365IntegrationPage} />
                    <Route path="/email" component={EmailClientPage} />
                    <Route path="/notifications" component={NotificationCenterPage} />
                    <Route path="/mobile-preview" component={MobilePreview} />
                    <Route path="/sop" component={SopManagementPage} />
                    <Route path="/training-room" component={TrainingRoomPage} />
                    <Route path="/medical-partner-network" component={MedicalPartnerNetworkPage} />
                    <Route path="/agent-workspace">
                      <ErrorBoundary>
                        <AgentSessionProvider>
                          <AgentWorkspacePage />
                        </AgentSessionProvider>
                      </ErrorBoundary>
                    </Route>
                    <Route path="/login">
                      <Redirect to={(user as any)?.roleLandingPage || "/"} />
                    </Route>
                    <Route component={NotFound} />
                  </Switch>
                  </Suspense>
                </div>
              </main>
            </div>
          </div>
          <ChatContainer />
          </SidebarProvider>
          </CallProvider>
          </TourProvider>
          </ChatProvider>
          <Toaster />
        </I18nWrapper>
      </PermissionsProvider>
    </CountryFilterProvider>
  );
}

function PublicRoutes() {
  const [location] = useLocation();

  if (location.startsWith("/sign/") || location.startsWith("/s/")) {
    return (
      <Switch>
        <Route path="/sign/:token" component={PublicSigningPage} />
        <Route path="/s/:token" component={PublicSigningPage} />
      </Switch>
    );
  }

  if (location.startsWith("/f/")) {
    return (
      <Switch>
        <Route path="/f/:slug" component={PublicFormPage} />
      </Switch>
    );
  }

  if (location.startsWith("/audit-timeline/")) {
    return (
      <Switch>
        <Route path="/audit-timeline/:token" component={AuditTimelinePublic} />
      </Switch>
    );
  }

  return null;
}

function AppShell() {
  const [location] = useLocation();
  const isPublicRoute = location.startsWith("/f/") || location.startsWith("/sign/") || location.startsWith("/s/") || location.startsWith("/audit-timeline/");

  if (isPublicRoute) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <PublicRoutes />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <AuthProvider>
      <SipProvider>
        <AppRouter />
      </SipProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppShell />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
