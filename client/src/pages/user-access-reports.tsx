import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Download, Calendar, Clock, Users, Filter, BarChart3, Activity, Shield, LogIn, LogOut, Monitor, RefreshCw, XCircle, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

import { CHART_PALETTE, CHART_COLORS as THEME_COLORS } from '@/lib/chart-colors';

export default function UserAccessReportsPage() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [period, setPeriod] = useState<PeriodType>('last_7_days');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState<string | null>(null);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionSortField, setSessionSortField] = useState<'loginAt' | 'logoutAt' | 'user' | 'duration'>('loginAt');
  const [sessionSortDirection, setSessionSortDirection] = useState<'asc' | 'desc'>('desc');
  const SESSIONS_PER_PAGE = 15;

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
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
  });

  const { data: activeSessions = [], isLoading: activeLoading, refetch: refetchActive } = useQuery<UserSession[]>({
    queryKey: ['/api/user-sessions/active'],
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<SessionStats>({
    queryKey: ['/api/user-sessions/stats', period],
    queryFn: async () => {
      const res = await fetch(statsQueryUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<Array<{ id: string; fullName: string; username: string }>>({
    queryKey: ['/api/users'],
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

  const isLoading = sessionsLoading || activeLoading || statsLoading;

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

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-8">
        <PageHeader
          title={t.userAccessReports.title}
          description={t.userAccessReports.description}
        />
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
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8" data-testid="page-user-access-reports">
      <div className="flex items-center justify-between">
        <PageHeader
          title={t.userAccessReports.title}
          description={t.userAccessReports.description}
        />
        <Button onClick={handleRefresh} disabled={isRefreshing} data-testid="button-refresh">
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t.common.refresh}
        </Button>
      </div>

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
                  <Bar dataKey="count" fill={THEME_COLORS.primary} radius={[4, 4, 0, 0]} />
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
                  <Line type="monotone" dataKey="count" stroke={THEME_COLORS.primary} strokeWidth={2} dot={{ fill: THEME_COLORS.primary }} />
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
              {paginatedSessions.map((session) => (
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
              ))}
            </TableBody>
          </Table>
          {totalSessionPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {t.userAccessReports.showingPage || "Strana"} {sessionPage} {t.userAccessReports.of || "z"} {totalSessionPages} ({sortedSessions.length} {t.userAccessReports.totalRecords || "zaznamov"})
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSessionPage(1)}
                  disabled={sessionPage === 1}
                  data-testid="button-session-first"
                >
                  {t.userAccessReports.first || "Prva"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSessionPage(p => Math.max(1, p - 1))}
                  disabled={sessionPage === 1}
                  data-testid="button-session-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[80px] text-center">
                  {sessionPage} / {totalSessionPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSessionPage(p => Math.min(totalSessionPages, p + 1))}
                  disabled={sessionPage === totalSessionPages}
                  data-testid="button-session-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSessionPage(totalSessionPages)}
                  disabled={sessionPage === totalSessionPages}
                  data-testid="button-session-last"
                >
                  {t.userAccessReports.last || "Posledna"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!sessionToEnd} onOpenChange={() => setSessionToEnd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.userAccessReports.endSessionTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.userAccessReports.endSessionDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sessionToEnd) {
                  endSessionMutation.mutate(sessionToEnd);
                  setSessionToEnd(null);
                }
              }}
            >
              {t.userAccessReports.endSession}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
