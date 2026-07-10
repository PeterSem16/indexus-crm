import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  Settings,
  Cloud,
  Activity,
  Droplets,
  LogOut,
  FileText,
  Building2,
  Handshake,
  Cog,
  Megaphone,
  CheckSquare,
  FileSignature,
  Kanban,
  Mail,
  Network,
  MapPin,
  BarChart3,
  Gauge,
  Syringe,
  ArrowDown,
  Headphones,
  Zap,
  Target,
  HeartPulse,
  ListChecks,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Task } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { CountryFilter } from "./country-filter";
import { UserSettingsDialog } from "./user-settings-dialog";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const { canAccessModule } = usePermissions();
  const { t } = useI18n();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!user,
  });

  const { data: sidebarRoles = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/roles"],
    enabled: !!user,
  });

  const pendingTasksCount = tasks.filter(
    task => task.assignedUserId === user?.id && task.status === "pending"
  ).length;

  const mainNavItems = [
    { title: t.nav.dashboard, url: "/", icon: LayoutDashboard, testId: "dashboard", moduleKey: "dashboard" },
    { title: "Pipeline", url: "/pipeline", icon: Kanban, testId: "pipeline", moduleKey: "pipeline" },
    { title: "Reports", url: "/reports", icon: BarChart3, testId: "reports", moduleKey: "reports" },
    { title: t.agentProductivity.title, url: "/agent-productivity", icon: Gauge, testId: "agent-productivity", moduleKey: "reports" },
  ];

  const mpnSubItems = [
    { title: t.nav.medicalPartnerNetwork, url: "/medical-partner-network", testId: "mpn", moduleKey: "hospitals" },
    { title: t.nav.hospitalsAndClinics, url: "/hospitals", testId: "hospitals", moduleKey: "hospitals" },
  ];

  const nexusNavItems = [
    { title: "NEXUS Omni", url: "/email", icon: Network, testId: "nexus-omni", moduleKey: "email" },
    { title: "NEXUS Pulse", url: "/agent-workspace", icon: Zap, testId: "nexus-pulse", moduleKey: "nexusPulse" },
    { title: "NEXUS Missions", url: "/campaigns", icon: Target, testId: "nexus-missions", moduleKey: "campaigns" },
  ];

  const customerSubItems = [
    { title: t.nav.customers, url: "/customers", testId: "customers", moduleKey: "customers" },
    { title: t.nav.contracts, url: "/contracts", testId: "contracts", moduleKey: "contracts" },
    { title: t.nav.collections, url: "/collections", testId: "collections", moduleKey: "collections" },
    { title: t.nav.customerInvoices, url: "/customer-invoices", testId: "customer-invoices", moduleKey: "invoices" },
  ];

  
  const adminNavItems = [
    { title: t.nav.users, url: "/users", icon: UserCog, testId: "users", moduleKey: "users" },
    { title: t.nav.settings, url: "/settings", icon: Settings, testId: "settings", moduleKey: "settings" },
  ];

  const configNavSubItems = [
    { title: t.nav.konfigurator, url: "/configurator", testId: "konfigurator", moduleKey: "configurator" },
    { title: "Automations", url: "/automations", testId: "automations", moduleKey: "configurator" },
  ];

  const userRoleName = sidebarRoles.find(r => r.id === user?.roleId)?.name;
  const visibleMainItems = mainNavItems.filter(item => {
    const hasModuleAccess = canAccessModule(item.moduleKey);
    const itemRoles = (item as any).roles as string[] | undefined;
    const hasRoleAccess = !itemRoles || itemRoles.includes(user?.role || "") || (userRoleName && itemRoles.some(r => r.toLowerCase().replace(/\s+/g, '') === userRoleName.toLowerCase().replace(/\s+/g, '')));
    return hasModuleAccess && hasRoleAccess;
  });
  const visibleAdminItems = adminNavItems.filter(item => canAccessModule(item.moduleKey));
  const visibleNexusItems = nexusNavItems.filter(item => {
    const hasModuleAccess = canAccessModule(item.moduleKey);
    const itemRoles = (item as any).roles as string[] | undefined;
    const hasRoleAccess = !itemRoles || itemRoles.includes(user?.role || "") || (userRoleName && itemRoles.some(r => r.toLowerCase().replace(/\s+/g, '') === userRoleName.toLowerCase().replace(/\s+/g, '')));
    return hasModuleAccess && hasRoleAccess;
  });

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
              {visibleMainItems.slice(0, 1).map((item) => (
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
              
              <Collapsible defaultOpen={false} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={location === "/customers" || location === "/contracts" || location.startsWith("/collections") || location === "/customer-invoices"}>
                      <Users className="h-4 w-4" />
                      <span>{t.nav.customers}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {customerSubItems.filter(item => canAccessModule(item.moduleKey)).map((item, index, filteredArray) => (
                        <SidebarMenuSubItem key={item.testId} className="relative">
                          <SidebarMenuSubButton asChild isActive={location === item.url}>
                            <Link href={item.url} data-testid={`nav-${item.testId}`} className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground shrink-0">
                                {index + 1}
                              </span>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                          {index < filteredArray.length - 1 && (
                            <div className="absolute left-[18px] top-full flex items-center justify-center h-2">
                              <ArrowDown className="h-3 w-3 text-primary" />
                            </div>
                          )}
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <Collapsible defaultOpen={location === "/medical-partner-network" || location === "/hospitals"} className="group/collapsible-mpn">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={location === "/medical-partner-network" || location === "/hospitals"}>
                      <HeartPulse className="h-4 w-4" />
                      <span>{t.nav.medicalPartnerNetwork}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible-mpn:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {mpnSubItems.filter(item => canAccessModule(item.moduleKey)).map((item) => (
                        <SidebarMenuSubItem key={item.testId}>
                          <SidebarMenuSubButton asChild isActive={location === item.url}>
                            <Link href={item.url} data-testid={`nav-${item.testId}`}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              
              {visibleMainItems.slice(1).map((item) => (
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

        {visibleNexusItems.length > 0 && (
          <>
            <SidebarSeparator className="my-2" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                NEXUS
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleNexusItems.map((item) => (
                    <SidebarMenuItem key={item.testId}>
                      <SidebarMenuButton asChild isActive={location === item.url}>
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

        {(visibleAdminItems.length > 0 || configNavSubItems.some(i => canAccessModule(i.moduleKey))) && (
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

                  {configNavSubItems.some(i => canAccessModule(i.moduleKey)) && (
                    <Collapsible defaultOpen={location === "/configurator" || location === "/automations"} className="group/collapsible-config">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={location === "/configurator" || location === "/automations"}>
                            <Cog className="h-4 w-4" />
                            <span>Configuration</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible-config:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {configNavSubItems.filter(item => canAccessModule(item.moduleKey)).map((item) => (
                              <SidebarMenuSubItem key={item.testId}>
                                <SidebarMenuSubButton asChild isActive={location === item.url}>
                                  <Link href={item.url} data-testid={`nav-${item.testId}`}>
                                    <span>{item.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {user && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-sidebar-accent">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={(user as any).avatarUrl || undefined} className="object-cover" />
                <AvatarFallback className="text-xs">
                  {user.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{user.fullName}</span>
                  {pendingTasksCount > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0" data-testid="badge-pending-tasks">
                      {pendingTasksCount}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate">{user.role}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setUserSettingsOpen(true)}
                data-testid="button-user-settings"
                title={t.settings.tabs.profile}
              >
                <Settings className="h-4 w-4" />
              </Button>
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
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" />
          <span>v1.0.0</span>
        </div>
      </SidebarFooter>
      
      <UserSettingsDialog 
        open={userSettingsOpen} 
        onOpenChange={setUserSettingsOpen} 
      />
    </Sidebar>
  );
}
