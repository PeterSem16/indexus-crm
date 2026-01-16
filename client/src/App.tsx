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
import { I18nProvider } from "@/i18n";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TourProvider, TourTrigger } from "@/components/tour-provider";
import { SipPhoneHeaderButton } from "@/components/sip-phone";
import { QuickCreate } from "@/components/quick-create";
import { EmailNotifications } from "@/components/email-notifications";
import { ChatProvider } from "@/contexts/chat-context";
import { ChatContainer } from "@/components/chat-container";
import { NotificationBell, NotificationCenterPage } from "@/components/notification-center";
import { NexusButton } from "@/components/nexus/nexus-button";
import Dashboard from "@/pages/dashboard";
import UsersPage from "@/pages/users";
import CustomersPage from "@/pages/customers";
import ProductsPage from "@/pages/products";
import InvoicesPage from "@/pages/invoices";
import SettingsPage from "@/pages/settings";
import HospitalsPage from "@/pages/hospitals";
import CollaboratorsPage from "@/pages/collaborators";
import ConfiguratorPage from "@/pages/configurator";
import CampaignsPage from "@/pages/campaigns";
import CampaignDetailPage from "@/pages/campaign-detail";
import TasksPage from "@/pages/tasks";
import ContractsPage from "@/pages/contracts";
import TemplateEditorPage from "@/pages/template-editor";
import PipelinePage from "@/pages/pipeline";
import MS365IntegrationPage from "@/pages/ms365-integration";
import EmailClientPage from "@/pages/email-client";
import LandingPage from "@/pages/landing";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

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

  return <AuthenticatedApp />;
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
          <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex h-14 items-center justify-between gap-4 border-b px-4 shrink-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-2">
                  <GlobalSearch />
                  <QuickCreate />
                  {(user as any)?.showEmailQueue && <EmailNotifications />}
                  {(user as any)?.showNotificationBell !== false && <NotificationBell />}
                  <NexusButton nexusEnabled={user?.nexusEnabled ?? false} />
                  {(user as any)?.showSipPhone && <SipPhoneHeaderButton user={user} />}
                  <TourTrigger />
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-auto p-6">
                <div className="max-w-7xl mx-auto">
                  <Switch>
                    <Route path="/" component={Dashboard} />
                    <Route path="/users" component={UsersPage} />
                    <Route path="/customers" component={CustomersPage} />
                    <Route path="/products" component={ProductsPage} />
                    <Route path="/invoices" component={InvoicesPage} />
                    <Route path="/hospitals" component={HospitalsPage} />
                    <Route path="/collaborators" component={CollaboratorsPage} />
                    <Route path="/campaigns" component={CampaignsPage} />
                    <Route path="/campaigns/:id" component={CampaignDetailPage} />
                    <Route path="/pipeline" component={PipelinePage} />
                    <Route path="/tasks" component={TasksPage} />
                    <Route path="/contracts/editor/:categoryId/:countryCode">
                      {(params) => <TemplateEditorPage categoryId={params.categoryId} countryCode={params.countryCode} />}
                    </Route>
                    <Route path="/contracts" component={ContractsPage} />
                    <Route path="/settings" component={SettingsPage} />
                    <Route path="/configurator" component={ConfiguratorPage} />
                    <Route path="/ms365" component={MS365IntegrationPage} />
                    <Route path="/email" component={EmailClientPage} />
                    <Route path="/notifications" component={NotificationCenterPage} />
                    <Route path="/login">
                      <Redirect to="/" />
                    </Route>
                    <Route component={NotFound} />
                  </Switch>
                </div>
              </main>
            </div>
          </div>
          <ChatContainer />
          </SidebarProvider>
          </TourProvider>
          </ChatProvider>
          <Toaster />
        </I18nWrapper>
      </PermissionsProvider>
    </CountryFilterProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
