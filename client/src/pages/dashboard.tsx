import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, Globe, Droplets, TrendingUp, Activity, FileText, Receipt, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/stats-card";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CountryBadges } from "@/components/country-filter";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { useI18n } from "@/i18n";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Customer, User, Invoice } from "@shared/schema";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";

export default function Dashboard() {
  const { selectedCountries } = useCountryFilter();
  const { t } = useI18n();
  const { isHidden } = useModuleFieldPermissions("dashboard");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const filteredCustomers = customers.filter(c => 
    selectedCountries.includes(c.country as any)
  );

  // Get customer IDs from filtered customers
  const filteredCustomerIds = new Set(filteredCustomers.map(c => c.id));
  
  // Filter invoices by selected countries (via customer)
  const filteredInvoices = invoices.filter(inv => filteredCustomerIds.has(inv.customerId));

  const activeCustomers = filteredCustomers.filter(c => c.status === "active").length;
  const pendingCustomers = filteredCustomers.filter(c => c.status === "pending").length;
  const activeUsers = users.filter(u => u.isActive).length;

  // Invoice statistics
  const totalInvoices = filteredInvoices.length;
  const paidInvoices = filteredInvoices.filter(inv => inv.status === "paid");
  const unpaidInvoices = filteredInvoices.filter(inv => inv.status !== "paid");
  const overdueInvoices = filteredInvoices.filter(inv => {
    if (inv.status === "paid") return false;
    if (!inv.dueDate) return false;
    return new Date(inv.dueDate) < new Date();
  });

  const totalInvoiceAmount = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);
  const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);

  const recentCustomers = [...filteredCustomers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const customerColumns = [
    {
      key: "name",
      header: t.customers.title,
      cell: (customer: Customer) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
            {customer.firstName[0]}{customer.lastName[0]}
          </div>
          <div>
            <p className="font-medium">{customer.firstName} {customer.lastName}</p>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "country",
      header: t.common.country,
      cell: (customer: Customer) => (
        <span className="flex items-center gap-2">
          <span>{getCountryFlag(customer.country)}</span>
          <span>{getCountryName(customer.country)}</span>
        </span>
      ),
    },
    {
      key: "service",
      header: t.customers.serviceType,
      cell: (customer: Customer) => (
        <span className="text-sm capitalize">
          {customer.serviceType?.replace("_", " ") || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      cell: (customer: Customer) => (
        <StatusBadge status={customer.status as any} />
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader 
        title={t.dashboard.title}
        description=""
      />

      {!isHidden("stats_overview") && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t.dashboard.totalCustomers}
              value={filteredCustomers.length}
              trend={12}
              description=""
              icon={<Users className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.activeCustomers}
              value={activeCustomers}
              trend={8}
              description=""
              icon={<UserCheck className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.pendingCustomers}
              value={pendingCustomers}
              trend={-5}
              description=""
              icon={<Activity className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.activeCountries}
              value={selectedCountries.length}
              icon={<Globe className="h-6 w-6" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t.dashboard.totalInvoices}
              value={totalInvoices}
              description={`${totalInvoiceAmount.toFixed(0)} EUR ${t.dashboard.totalAmount}`}
              icon={<FileText className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.paidInvoices}
              value={paidInvoices.length}
              description={`${paidAmount.toFixed(0)} EUR ${t.dashboard.received}`}
              icon={<CheckCircle2 className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.unpaidInvoices}
              value={unpaidInvoices.length}
              description={`${unpaidAmount.toFixed(0)} EUR ${t.dashboard.pendingAmount}`}
              icon={<Clock className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.overdueInvoices}
              value={overdueInvoices.length}
              description={t.dashboard.pastDueDate}
              icon={<AlertCircle className="h-6 w-6" />}
            />
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {!isHidden("recent_customers") && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">{t.dashboard.recentCustomers}</CardTitle>
              <Droplets className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <DataTable
                columns={customerColumns}
                data={recentCustomers}
                isLoading={customersLoading}
                emptyMessage={t.dashboard.noCustomersFound}
                getRowKey={(c) => c.id}
              />
            </CardContent>
          </Card>
        )}

        {!isHidden("activity_feed") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">{t.dashboard.teamOverview}</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <span className="text-sm text-muted-foreground">{t.dashboard.totalUsers}</span>
                <span className="text-2xl font-bold">{users.length}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <span className="text-sm text-muted-foreground">{t.dashboard.activeUsers}</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{activeUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.dashboard.inactiveUsers}</span>
                <span className="text-2xl font-bold text-gray-400">{users.length - activeUsers}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-lg font-medium">{t.dashboard.customersByCountry}</CardTitle>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {selectedCountries.map(code => {
              const count = filteredCustomers.filter(c => c.country === code).length;
              return (
                <div 
                  key={code}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCountryFlag(code)}</span>
                    <span className="font-medium">{getCountryName(code)}</span>
                  </div>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
