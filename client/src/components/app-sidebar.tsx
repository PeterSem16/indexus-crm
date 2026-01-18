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
  BarChart3
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

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { canAccessModule } = usePermissions();
  const { t } = useI18n();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!user,
  });

  const pendingTasksCount = tasks.filter(
    task => task.assignedUserId === user?.id && task.status === "pending"
  ).length;

  const mainNavItems = [
    { title: t.nav.dashboard, url: "/", icon: LayoutDashboard, testId: "dashboard", moduleKey: "dashboard" },
    { title: t.nav.hospitals, url: "/hospitals", icon: Building2, testId: "hospitals", moduleKey: "hospitals" },
    { title: t.nav.invoices, url: "/invoices", icon: FileText, testId: "invoices", moduleKey: "invoices" },
    { title: t.nav.campaigns, url: "/campaigns", icon: Megaphone, testId: "campaigns", moduleKey: "campaigns" },
    { title: "Pipeline", url: "/pipeline", icon: Kanban, testId: "pipeline", moduleKey: "pipeline" },
  ];

  const customerSubItems = [
    { title: t.nav.customers, url: "/customers", testId: "customers", moduleKey: "customers" },
    { title: t.nav.contracts, url: "/contracts", testId: "contracts", moduleKey: "contracts" },
  ];

  const collaboratorSubItems = [
    { title: t.nav.collaborators, url: "/collaborators", testId: "collaborators", moduleKey: "collaborators" },
    { title: t.nav.visitEvents, url: "/visit-events", testId: "visit-events", moduleKey: "visitEvents" },
    { title: t.nav.collaboratorReports, url: "/collaborator-reports", testId: "collaborator-reports", moduleKey: "collaborators" },
  ];
  
  const adminNavItems = [
    { title: t.nav.users, url: "/users", icon: UserCog, testId: "users", moduleKey: "users" },
    { title: t.nav.settings, url: "/settings", icon: Settings, testId: "settings", moduleKey: "settings" },
    { title: t.nav.konfigurator, url: "/configurator", icon: Cog, testId: "konfigurator", moduleKey: "configurator" },
  ];

  const nexusSubItems = [
    { title: "Komunikácia", url: "/email", testId: "nexus-email", moduleKey: "email" },
    { title: t.nav.tasks, url: "/tasks", testId: "nexus-tasks", moduleKey: "tasks" },
  ];

  const visibleMainItems = mainNavItems.filter(item => canAccessModule(item.moduleKey));
  const visibleAdminItems = adminNavItems.filter(item => canAccessModule(item.moduleKey));
  const visibleNexusItems = nexusSubItems.filter(item => canAccessModule(item.moduleKey));

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
              
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={location === "/customers" || location === "/contracts"}>
                      <Users className="h-4 w-4" />
                      <span>{t.nav.customers}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {customerSubItems.filter(item => canAccessModule(item.moduleKey)).map((item) => (
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

              <Collapsible defaultOpen className="group/collapsible-collab">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={location === "/collaborators" || location === "/visit-events" || location === "/collaborator-reports"}>
                      <Handshake className="h-4 w-4" />
                      <span>{t.nav.collaborators}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible-collab:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {collaboratorSubItems.filter(item => canAccessModule(item.moduleKey)).map((item) => (
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

        {visibleNexusItems.length > 0 && (
          <>
            <SidebarSeparator className="my-2" />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible defaultOpen className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={location === "/email" || location === "/tasks"}>
                          <Network className="h-4 w-4" />
                          <span>NEXUS</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {visibleNexusItems.map((item) => (
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
