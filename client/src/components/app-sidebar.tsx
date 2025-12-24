import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  Settings,
  Activity,
  Droplets,
  LogOut,
  FileText,
  Building2,
  Handshake,
  Cog
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { CountryFilter } from "./country-filter";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { canAccessModule } = usePermissions();
  const { t } = useI18n();

  const mainNavItems = [
    { title: t.nav.dashboard, url: "/", icon: LayoutDashboard, testId: "dashboard", moduleKey: "dashboard" },
    { title: t.nav.customers, url: "/customers", icon: Users, testId: "customers", moduleKey: "customers" },
    { title: t.nav.hospitals, url: "/hospitals", icon: Building2, testId: "hospitals", moduleKey: "hospitals" },
    { title: t.nav.collaborators, url: "/collaborators", icon: Handshake, testId: "collaborators", moduleKey: "collaborators" },
    { title: t.nav.invoices, url: "/invoices", icon: FileText, testId: "invoices", moduleKey: "invoices" },
  ];
  
  const adminNavItems = [
    { title: t.nav.users, url: "/users", icon: UserCog, testId: "users", moduleKey: "users" },
    { title: t.nav.settings, url: "/settings", icon: Settings, testId: "settings", moduleKey: "settings" },
    { title: t.nav.konfigurator, url: "/configurator", icon: Cog, testId: "konfigurator", moduleKey: "configurator" },
  ];

  const visibleMainItems = mainNavItems.filter(item => canAccessModule(item.moduleKey));
  const visibleAdminItems = adminNavItems.filter(item => canAccessModule(item.moduleKey));

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Droplets className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">INDEXUS</span>
            <span className="text-xs text-muted-foreground">CRM System</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup className="px-3 py-2">
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            {t.common.filter}
          </SidebarGroupLabel>
          <CountryFilter />
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainItems.map((item) => (
                <SidebarMenuItem key={item.testId}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`nav-${item.testId}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleAdminItems.length > 0 && (
          <>
            <SidebarSeparator className="my-2" />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleAdminItems.map((item) => (
                    <SidebarMenuItem key={item.testId}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location === item.url}
                      >
                        <Link href={item.url} data-testid={`nav-${item.testId}`}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {user && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-sidebar-accent">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{user.fullName}</span>
              <span className="text-xs text-muted-foreground truncate">{user.role}</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleLogout}
              data-testid="button-logout"
              title={t.nav.logout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" />
          <span>v1.0.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
