import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UserCheck, UserX, Search, Filter, Users, Activity, Download, Calendar, Clock, BarChart3, Shield, LogIn, Monitor, RefreshCw, XCircle, History, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useI18n } from "@/i18n";
import { usePermissions } from "@/contexts/permissions-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CountryBadges } from "@/components/country-filter";
import { UserForm, type UserFormData } from "@/components/user-form";
import { UserFormWizard } from "@/components/user-form-wizard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

type PeriodType = 'today' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month';

interface UserSession {
  id: string;
  userId: string;
  loginAt: string;
  logoutAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isActive: boolean;
  lastActivityAt: string | null;
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: string;
    country: string;
  } | null;
}

interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  uniqueUsers: number;
  sessionsByUser: Array<{
    userId: string;
    userName: string;
    count: number;
    totalTime: number;
    avgSessionTime: number;
  }>;
  sessionsByDay: Array<{ date: string; count: number }>;
  sessionsByHour: Array<{ hour: number; count: number }>;
}

export default function UsersPage() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const { canAdd, canEdit } = usePermissions();
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("users");

  const [period, setPeriod] = useState<PeriodType>('last_7_days');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState<string | null>(null);
  const [forceLogoutUser, setForceLogoutUser] = useState<{ userId: string; userName: string; session: UserSession } | null>(null);
  
  // Pagination and sorting for users list
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null } | null>(null);
  const USERS_PER_PAGE = 15;

  // Session History pagination and sorting
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionSortField, setSessionSortField] = useState<'loginAt' | 'logoutAt' | 'user' | 'duration'>('loginAt');
  const [sessionSortDirection, setSessionSortDirection] = useState<'asc' | 'desc'>('desc');
  const SESSIONS_PER_PAGE = 15;

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getDateLocale = () => {
    switch (locale) {
      case 'sk': return sk;
      case 'cs': return cs;
      case 'hu': return hu;
      case 'ro': return ro;
      case 'it': return it;
      case 'de': return de;
      default: return enUS;
    }
  };

  const getDateRange = () => {
    const now = new Date();
    const endDate = endOfDay(now);
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'last_7_days':
        startDate = startOfDay(subDays(now, 7));
        break;
      case 'last_30_days':
        startDate = startOfDay(subDays(now, 30));
        break;
      case 'this_month':
        startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        break;
      case 'last_month':
        startDate = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        break;
      default:
        startDate = startOfDay(subDays(now, 7));
    }

    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  const sessionsQueryUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());
    if (selectedUser !== 'all') {
      params.set('userId', selectedUser);
    }
    return `/api/user-sessions?${params.toString()}`;
  }, [startDate, endDate, selectedUser]);

  const statsQueryUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());
    return `/api/user-sessions/stats?${params.toString()}`;
  }, [startDate, endDate]);

  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<UserSession[]>({
    queryKey: ['/api/user-sessions', period, selectedUser],
    queryFn: async () => {
      const res = await fetch(sessionsQueryUrl, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error('Failed to fetch sessions');
      }
      return res.json();
    },
    enabled: activeTab === 'access',
  });

  const { data: activeSessions = [], isLoading: activeLoading, refetch: refetchActive } = useQuery<UserSession[]>({
    queryKey: ['/api/user-sessions/active'],
    queryFn: async () => {
      const res = await fetch('/api/user-sessions/active', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error('Failed to fetch active sessions');
      }
      return res.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
  
  const activeUserIds = useMemo(() => {
    return new Set(activeSessions.map(s => s.userId));
  }, [activeSessions]);
  
  const getActiveSessionForUser = (userId: string) => {
    return activeSessions.find(s => s.userId === userId);
  };

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<SessionStats>({
    queryKey: ['/api/user-sessions/stats', period],
    queryFn: async () => {
      const res = await fetch(statsQueryUrl, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) return null;
        throw new Error('Failed to fetch stats');
      }
      return res.json();
    },
    enabled: activeTab === 'access',
  });

  const updateMutation = useMutation({
    mutationFn: (data: UserFormData & { id: string }) => 
      apiRequest("PATCH", `/api/users/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({ title: t.success.updated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeletingUser(null);
      toast({ title: t.success.deleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: t.success.updated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest('POST', `/api/user-sessions/${sessionId}/end`);
    },
    onSuccess: () => {
      toast({
        title: t.common.success,
        description: t.userAccessReports.sessionEnded,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-sessions/stats'] });
      setSessionToEnd(null);
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.userAccessReports.sessionEndError,
        variant: "destructive",
      });
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchSessions(), refetchActive(), refetchStats()]);
      toast({
        title: t.common.success,
        description: t.userAccessReports.dataRefreshed,
      });
    } catch (error) {
      toast({
        title: t.common.error,
        description: t.userAccessReports.refreshError,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return t.userAccessReports.unknownDevice;
    if (ua.includes('Mobile')) return 'Mobile';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    return 'Desktop';
  };

  const getSessionDuration = (session: UserSession) => {
    if (session.logoutAt) {
      return new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime();
    }
    if (session.isActive) {
      return Date.now() - new Date(session.loginAt).getTime();
    }
    return 0;
  };

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      let comparison = 0;
      switch (sessionSortField) {
        case 'loginAt':
          comparison = new Date(a.loginAt).getTime() - new Date(b.loginAt).getTime();
          break;
        case 'logoutAt':
          const aLogout = a.logoutAt ? new Date(a.logoutAt).getTime() : 0;
          const bLogout = b.logoutAt ? new Date(b.logoutAt).getTime() : 0;
          comparison = aLogout - bLogout;
          break;
        case 'user':
          const aName = a.user?.fullName || '';
          const bName = b.user?.fullName || '';
          comparison = aName.localeCompare(bName);
          break;
        case 'duration':
          comparison = getSessionDuration(a) - getSessionDuration(b);
          break;
      }
      return sessionSortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [sessions, sessionSortField, sessionSortDirection]);

  const paginatedSessions = useMemo(() => {
    const startIndex = (sessionPage - 1) * SESSIONS_PER_PAGE;
    return sortedSessions.slice(startIndex, startIndex + SESSIONS_PER_PAGE);
  }, [sortedSessions, sessionPage]);

  const totalSessionPages = Math.ceil(sortedSessions.length / SESSIONS_PER_PAGE);

  const handleSessionSort = (field: typeof sessionSortField) => {
    if (sessionSortField === field) {
      setSessionSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSessionSortField(field);
      setSessionSortDirection('desc');
    }
    setSessionPage(1);
  };

  const getSortIcon = (field: typeof sessionSortField) => {
    if (sessionSortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sessionSortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const exportSessionsToCSV = () => {
    const headers = [
      t.userAccessReports.user,
      'Username',
      t.userAccessReports.loginTime,
      t.userAccessReports.logoutTime,
      t.userAccessReports.duration,
      t.userAccessReports.device,
      t.userAccessReports.ipAddress,
      t.userAccessReports.status
    ];
    
    const rows = sortedSessions.map(session => [
      session.user?.fullName || t.userAccessReports.unknownUser,
      session.user?.username || '',
      format(new Date(session.loginAt), 'dd.MM.yyyy HH:mm'),
      session.logoutAt ? format(new Date(session.logoutAt), 'dd.MM.yyyy HH:mm') : '-',
      session.logoutAt 
        ? formatDuration(new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime())
        : session.isActive 
          ? formatDistanceToNow(new Date(session.loginAt), { addSuffix: false })
          : '-',
      parseUserAgent(session.userAgent),
      session.ipAddress || '-',
      session.isActive ? t.userAccessReports.active : t.userAccessReports.ended
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `session_history_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportSessionsToExcel = () => {
    const headers = [
      t.userAccessReports.user,
      'Username',
      t.userAccessReports.loginTime,
      t.userAccessReports.logoutTime,
      t.userAccessReports.duration,
      t.userAccessReports.device,
      t.userAccessReports.ipAddress,
      t.userAccessReports.status
    ];
    
    const rows = sortedSessions.map(session => [
      session.user?.fullName || t.userAccessReports.unknownUser,
      session.user?.username || '',
      format(new Date(session.loginAt), 'dd.MM.yyyy HH:mm'),
      session.logoutAt ? format(new Date(session.logoutAt), 'dd.MM.yyyy HH:mm') : '-',
      session.logoutAt 
        ? formatDuration(new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime())
        : session.isActive 
          ? formatDistanceToNow(new Date(session.loginAt), { addSuffix: false })
          : '-',
      parseUserAgent(session.userAgent),
      session.ipAddress || '-',
      session.isActive ? t.userAccessReports.active : t.userAccessReports.ended
    ]);

    let tableHtml = '<table border="1"><thead><tr>';
    headers.forEach(h => tableHtml += `<th>${h}</th>`);
    tableHtml += '</tr></thead><tbody>';
    rows.forEach(row => {
      tableHtml += '<tr>';
      row.forEach(cell => tableHtml += `<td>${cell}</td>`);
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    const blob = new Blob(['\ufeff' + tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `session_history_${format(new Date(), 'yyyy-MM-dd')}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const filteredUsers = useMemo(() => {
    let result = users.filter(user => 
      user.fullName.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.username.toLowerCase().includes(search.toLowerCase())
    );
    
    // Apply sorting
    if (sortConfig && sortConfig.direction) {
      result = [...result].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortConfig.key) {
          case 'user':
            aVal = a.fullName.toLowerCase();
            bVal = b.fullName.toLowerCase();
            break;
          case 'username':
            aVal = a.username.toLowerCase();
            bVal = b.username.toLowerCase();
            break;
          case 'role':
            aVal = a.role;
            bVal = b.role;
            break;
          case 'status':
            aVal = a.isActive ? 1 : 0;
            bVal = b.isActive ? 1 : 0;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [users, search, sortConfig]);
  
  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);
  
  // Reset to page 1 when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [search]);

  const columns = [
    {
      key: "user",
      header: t.users.userColumn,
      sortable: true,
      cell: (user: User) => {
        const isOnline = activeUserIds.has(user.id);
        const activeSession = getActiveSessionForUser(user.id);
        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatarUrl || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                  {user.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{user.fullName}</p>
                {isOnline && canEdit("users") && activeSession && (
                  <Badge 
                    variant="outline" 
                    className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400 cursor-pointer hover-elevate text-xs px-2 py-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForceLogoutUser({
                        userId: user.id,
                        userName: user.fullName,
                        session: activeSession
                      });
                    }}
                    data-testid={`badge-online-${user.id}`}
                  >
                    Online
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "username",
      header: t.users.username,
      sortable: true,
      cell: (user: User) => (
        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
          @{user.username}
        </span>
      ),
    },
    {
      key: "role",
      header: t.users.role,
      sortable: true,
      cell: (user: User) => {
        const roleLabel = user.role === "admin" 
          ? t.users.roles.admin 
          : user.role === "manager" 
            ? t.users.roles.manager 
            : t.users.roles.user;
        return (
          <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">
            {roleLabel}
          </Badge>
        );
      },
    },
    {
      key: "countries",
      header: t.users.countriesColumn,
      cell: (user: User) => (
        <CountryBadges countries={user.assignedCountries || []} max={4} />
      ),
    },
    {
      key: "status",
      header: t.users.statusColumn,
      sortable: true,
      cell: (user: User) => (
        <StatusBadge status={user.isActive ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (user: User) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleStatusMutation.mutate({ 
                id: user.id, 
                isActive: !user.isActive 
              });
            }}
            data-testid={`button-toggle-status-${user.id}`}
          >
            {user.isActive ? (
              <UserX className="h-4 w-4" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
          </Button>
          {canEdit("users") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setEditingUser(user);
              }}
              data-testid={`button-edit-user-${user.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit("users") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingUser(user);
              }}
              data-testid={`button-delete-user-${user.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const accessLoading = sessionsLoading || activeLoading || statsLoading;

  return (
    <div className="space-y-6">
      <PageHeader 
        title={t.users.title}
        description={t.users.description}
      >
        {activeTab === 'users' && canAdd("users") && (
          <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-user">
            <Plus className="h-4 w-4 mr-2" />
            {t.users.addUser}
          </Button>
        )}
        {activeTab === 'access' && (
          <Button onClick={handleRefresh} disabled={isRefreshing} data-testid="button-refresh">
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t.common.refresh}
          </Button>
        )}
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
            <Users className="h-4 w-4" />
            {t.users.title}
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2" data-testid="tab-access">
            <Activity className="h-4 w-4" />
            {t.userAccessReports.title}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.users.searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-users"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={columns}
            data={paginatedUsers}
            isLoading={isLoading}
            emptyMessage={t.users.noUsers}
            getRowKey={(u) => u.id}
            sortConfig={sortConfig}
            onSortChange={setSortConfig}
          />
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-muted-foreground">
                {t.common.showing} {((currentPage - 1) * USERS_PER_PAGE) + 1}-{Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} {t.common.of} {filteredUsers.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  {t.common.previous}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  {t.common.next}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          {accessLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    {t.userAccessReports.filters}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-2">
                      <Label>{t.userAccessReports.period}</Label>
                      <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                        <SelectTrigger className="w-[180px]" data-testid="select-period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">{t.userAccessReports.today}</SelectItem>
                          <SelectItem value="last_7_days">{t.userAccessReports.last7Days}</SelectItem>
                          <SelectItem value="last_30_days">{t.userAccessReports.last30Days}</SelectItem>
                          <SelectItem value="this_month">{t.userAccessReports.thisMonth}</SelectItem>
                          <SelectItem value="last_month">{t.userAccessReports.lastMonth}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.userAccessReports.user}</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="w-[200px]" data-testid="select-user">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.userAccessReports.allUsers}</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                    <CardTitle className="text-sm font-medium">{t.userAccessReports.totalSessions}</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-sessions">{stats?.totalSessions || 0}</div>
                    <p className="text-xs text-muted-foreground">{t.userAccessReports.forPeriod}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                    <CardTitle className="text-sm font-medium">{t.userAccessReports.activeSessions}</CardTitle>
                    <Shield className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600" data-testid="text-active-sessions">{activeSessions.length}</div>
                    <p className="text-xs text-muted-foreground">{t.userAccessReports.currentlyLoggedIn}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                    <CardTitle className="text-sm font-medium">{t.userAccessReports.uniqueUsers}</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-unique-users">{stats?.uniqueUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">{t.userAccessReports.hadSessions}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                    <CardTitle className="text-sm font-medium">{t.userAccessReports.avgSessionTime}</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-avg-session">
                      {stats?.sessionsByUser && stats.sessionsByUser.length > 0
                        ? formatDuration(
                            stats.sessionsByUser.reduce((acc, u) => acc + u.avgSessionTime, 0) / stats.sessionsByUser.length
                          )
                        : '0m'}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.userAccessReports.perSession}</p>
                  </CardContent>
                </Card>
              </div>

              {activeSessions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-500" />
                      {t.userAccessReports.activeSessionsTitle}
                    </CardTitle>
                    <CardDescription>{t.userAccessReports.activeSessionsDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.userAccessReports.user}</TableHead>
                          <TableHead>{t.userAccessReports.loginTime}</TableHead>
                          <TableHead>{t.userAccessReports.device}</TableHead>
                          <TableHead>{t.userAccessReports.ipAddress}</TableHead>
                          <TableHead>{t.userAccessReports.duration}</TableHead>
                          <TableHead>{t.common.actions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeSessions.map((session) => (
                          <TableRow key={session.id} data-testid={`row-active-session-${session.id}`}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{session.user?.fullName || t.userAccessReports.unknownUser}</span>
                                <span className="text-xs text-muted-foreground">{session.user?.username}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(session.loginAt), 'dd.MM.yyyy HH:mm', { locale: getDateLocale() })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{parseUserAgent(session.userAgent)}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{session.ipAddress || '-'}</TableCell>
                            <TableCell>
                              {formatDistanceToNow(new Date(session.loginAt), { locale: getDateLocale(), addSuffix: false })}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSessionToEnd(session.id)}
                                data-testid={`button-end-session-${session.id}`}
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      {t.userAccessReports.sessionsByDay}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.sessionsByDay || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd.MM')} />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(d) => format(new Date(d as string), 'dd.MM.yyyy', { locale: getDateLocale() })}
                            formatter={(value) => [value, t.userAccessReports.sessions]}
                          />
                          <Bar dataKey="count" fill="hsl(210, 60%, 70%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {t.userAccessReports.sessionsByHour}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats?.sessionsByHour || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(h) => `${h}:00 - ${Number(h) + 1}:00`}
                            formatter={(value) => [value, t.userAccessReports.sessions]}
                          />
                          <Line type="monotone" dataKey="count" stroke="hsl(170, 50%, 55%)" strokeWidth={2} dot={{ fill: 'hsl(170, 50%, 55%)' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {stats?.sessionsByUser && stats.sessionsByUser.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {t.userAccessReports.sessionsByUser}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.userAccessReports.user}</TableHead>
                          <TableHead className="text-right">{t.userAccessReports.sessionCount}</TableHead>
                          <TableHead className="text-right">{t.userAccessReports.totalTime}</TableHead>
                          <TableHead className="text-right">{t.userAccessReports.avgTime}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.sessionsByUser.map((userStat) => (
                          <TableRow key={userStat.userId} data-testid={`row-user-stat-${userStat.userId}`}>
                            <TableCell className="font-medium">{userStat.userName}</TableCell>
                            <TableCell className="text-right">{userStat.count}</TableCell>
                            <TableCell className="text-right">{formatDuration(userStat.totalTime)}</TableCell>
                            <TableCell className="text-right">{formatDuration(userStat.avgSessionTime)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <LogIn className="h-5 w-5" />
                        {t.userAccessReports.sessionHistory}
                      </CardTitle>
                      <CardDescription>{t.userAccessReports.sessionHistoryDesc}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportSessionsToCSV}
                        data-testid="button-export-sessions-csv"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportSessionsToExcel}
                        data-testid="button-export-sessions-excel"
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 -ml-2"
                            onClick={() => handleSessionSort('user')}
                            data-testid="button-sort-user"
                          >
                            {t.userAccessReports.user}
                            {getSortIcon('user')}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 -ml-2"
                            onClick={() => handleSessionSort('loginAt')}
                            data-testid="button-sort-login"
                          >
                            {t.userAccessReports.loginTime}
                            {getSortIcon('loginAt')}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 -ml-2"
                            onClick={() => handleSessionSort('logoutAt')}
                            data-testid="button-sort-logout"
                          >
                            {t.userAccessReports.logoutTime}
                            {getSortIcon('logoutAt')}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 -ml-2"
                            onClick={() => handleSessionSort('duration')}
                            data-testid="button-sort-duration"
                          >
                            {t.userAccessReports.duration}
                            {getSortIcon('duration')}
                          </Button>
                        </TableHead>
                        <TableHead>{t.userAccessReports.device}</TableHead>
                        <TableHead>{t.userAccessReports.ipAddress}</TableHead>
                        <TableHead>{t.userAccessReports.status}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSessions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            {t.common.noData}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedSessions.map((session) => (
                          <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{session.user?.fullName || t.userAccessReports.unknownUser}</span>
                                <span className="text-xs text-muted-foreground">{session.user?.username}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(session.loginAt), 'dd.MM.yyyy HH:mm', { locale: getDateLocale() })}
                            </TableCell>
                            <TableCell>
                              {session.logoutAt
                                ? format(new Date(session.logoutAt), 'dd.MM.yyyy HH:mm', { locale: getDateLocale() })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {session.logoutAt
                                ? formatDuration(new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime())
                                : session.isActive
                                  ? formatDistanceToNow(new Date(session.loginAt), { locale: getDateLocale(), addSuffix: false })
                                  : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{parseUserAgent(session.userAgent)}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{session.ipAddress || '-'}</TableCell>
                            <TableCell>
                              {session.isActive ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                  {t.userAccessReports.active}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{t.userAccessReports.ended}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {totalSessionPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                      <p className="text-sm text-muted-foreground">
                        {t.userAccessReports.showingPage} {sessionPage} {t.userAccessReports.of} {totalSessionPages} ({sortedSessions.length} {t.userAccessReports.totalRecords})
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSessionPage(1)}
                          disabled={sessionPage === 1}
                          data-testid="button-first-page"
                        >
                          {t.userAccessReports.first}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setSessionPage(p => Math.max(1, p - 1))}
                          disabled={sessionPage === 1}
                          data-testid="button-prev-session-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                          {sessionPage} / {totalSessionPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setSessionPage(p => Math.min(totalSessionPages, p + 1))}
                          disabled={sessionPage === totalSessionPages}
                          data-testid="button-next-session-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSessionPage(totalSessionPages)}
                          disabled={sessionPage === totalSessionPages}
                          data-testid="button-last-page"
                        >
                          {t.userAccessReports.last}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.users.addNewUser}</DialogTitle>
            <DialogDescription>
              {t.users.description}
            </DialogDescription>
          </DialogHeader>
          <UserFormWizard
            onSuccess={() => setIsFormOpen(false)}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.users.editUser}</DialogTitle>
            <DialogDescription>
              {t.users.updateUserInfo}
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <UserForm
              initialData={editingUser}
              onSubmit={(data) => updateMutation.mutate({ ...data, id: editingUser.id })}
              isLoading={updateMutation.isPending}
              onCancel={() => setEditingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.users.deleteUser}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.users.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!sessionToEnd} onOpenChange={() => setSessionToEnd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.userAccessReports.endSessionTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.userAccessReports.endSessionDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-end-session">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToEnd && endSessionMutation.mutate(sessionToEnd)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-end-session"
            >
              {t.userAccessReports.endSession}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!forceLogoutUser} onOpenChange={() => setForceLogoutUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Force Logout User
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Are you sure you want to force logout <strong>{forceLogoutUser?.userName}</strong>?
                </p>
                {forceLogoutUser?.session && (
                  <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span>{parseUserAgent(forceLogoutUser.session.userAgent)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{forceLogoutUser.session.ipAddress || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Login: {format(new Date(forceLogoutUser.session.loginAt), "dd.MM.yyyy HH:mm", { locale: getDateLocale() })}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  This will immediately end the user's session and they will need to log in again.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-force-logout">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (forceLogoutUser?.session) {
                  endSessionMutation.mutate(forceLogoutUser.session.id);
                  setForceLogoutUser(null);
                }
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-force-logout"
            >
              Force Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
