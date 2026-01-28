import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Calendar, Users, FileText, Euro, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  totalAmount: string;
  currency: string;
  issueDate?: string;
  dueDate?: string;
  customerName?: string;
}

interface ScheduledInvoice {
  id: string;
  customerId: string;
  scheduledDate: string;
  status: string;
  totalAmount: string;
  currency: string;
  customerName?: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  country?: string;
}

export default function InvoicingReportPage() {
  const { t } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "year">("month");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", { countries: selectedCountries }],
  });

  const { data: scheduledInvoices = [], isLoading: scheduledLoading } = useQuery<ScheduledInvoice[]>({
    queryKey: ["/api/scheduled-invoices"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  const formatAmount = (amount: string, currency: string) => {
    const num = parseFloat(amount || "0");
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: currency || "EUR",
    }).format(num);
  };

  const getCustomerName = (customerId: string) => {
    const customer = customerMap.get(customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : "N/A";
  };

  const getPeriodRange = () => {
    const year = selectedYear;
    let startDate: Date;
    let endDate: Date;

    if (periodType === "month") {
      startDate = new Date(year, selectedMonth - 1, 1);
      endDate = new Date(year, selectedMonth, 0);
    } else if (periodType === "quarter") {
      const quarter = Math.ceil(selectedMonth / 3);
      startDate = new Date(year, (quarter - 1) * 3, 1);
      endDate = new Date(year, quarter * 3, 0);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    }

    return { startDate, endDate };
  };

  const issuedByCustomer = useMemo(() => {
    const { startDate, endDate } = getPeriodRange();
    const byCustomer = new Map<string, { count: number; total: number; currency: string }>();

    invoices.forEach(inv => {
      if (inv.status === "paid" || inv.status === "sent" || inv.status === "overdue") {
        const issueDate = inv.issueDate ? new Date(inv.issueDate) : null;
        if (issueDate && issueDate >= startDate && issueDate <= endDate) {
          const key = inv.customerId;
          const existing = byCustomer.get(key) || { count: 0, total: 0, currency: inv.currency || "EUR" };
          existing.count++;
          existing.total += parseFloat(inv.totalAmount || "0");
          byCustomer.set(key, existing);
        }
      }
    });

    return Array.from(byCustomer.entries())
      .map(([customerId, data]) => ({
        customerId,
        customerName: getCustomerName(customerId),
        ...data,
      }))
      .sort((a, b) => b.total - a.total);
  }, [invoices, customerMap, periodType, selectedYear, selectedMonth]);

  const plannedByCustomer = useMemo(() => {
    const { startDate, endDate } = getPeriodRange();
    const byCustomer = new Map<string, { count: number; total: number; currency: string }>();

    scheduledInvoices.forEach(inv => {
      if (inv.status === "pending") {
        const scheduledDate = new Date(inv.scheduledDate);
        if (scheduledDate >= startDate && scheduledDate <= endDate) {
          const key = inv.customerId;
          const existing = byCustomer.get(key) || { count: 0, total: 0, currency: inv.currency || "EUR" };
          existing.count++;
          existing.total += parseFloat(inv.totalAmount || "0");
          byCustomer.set(key, existing);
        }
      }
    });

    return Array.from(byCustomer.entries())
      .map(([customerId, data]) => ({
        customerId,
        customerName: getCustomerName(customerId),
        ...data,
      }))
      .sort((a, b) => b.total - a.total);
  }, [scheduledInvoices, customerMap, periodType, selectedYear, selectedMonth]);

  const forecast = useMemo(() => {
    const now = new Date();
    const periods: { label: string; startDate: Date; endDate: Date }[] = [];

    if (periodType === "month") {
      for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        periods.push({
          label: date.toLocaleDateString("sk-SK", { month: "long", year: "numeric" }),
          startDate: new Date(date.getFullYear(), date.getMonth(), 1),
          endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0),
        });
      }
    } else if (periodType === "quarter") {
      const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
      for (let i = 0; i < 4; i++) {
        const q = ((currentQuarter - 1 + i) % 4) + 1;
        const year = now.getFullYear() + Math.floor((currentQuarter - 1 + i) / 4);
        periods.push({
          label: `Q${q} ${year}`,
          startDate: new Date(year, (q - 1) * 3, 1),
          endDate: new Date(year, q * 3, 0),
        });
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const year = now.getFullYear() + i;
        periods.push({
          label: `${year}`,
          startDate: new Date(year, 0, 1),
          endDate: new Date(year, 11, 31),
        });
      }
    }

    return periods.map(period => {
      let issuedTotal = 0;
      let issuedCount = 0;
      let plannedTotal = 0;
      let plannedCount = 0;

      invoices.forEach(inv => {
        if (inv.status === "paid" || inv.status === "sent" || inv.status === "overdue") {
          const issueDate = inv.issueDate ? new Date(inv.issueDate) : null;
          if (issueDate && issueDate >= period.startDate && issueDate <= period.endDate) {
            issuedTotal += parseFloat(inv.totalAmount || "0");
            issuedCount++;
          }
        }
      });

      scheduledInvoices.forEach(inv => {
        if (inv.status === "pending") {
          const scheduledDate = new Date(inv.scheduledDate);
          if (scheduledDate >= period.startDate && scheduledDate <= period.endDate) {
            plannedTotal += parseFloat(inv.totalAmount || "0");
            plannedCount++;
          }
        }
      });

      return {
        ...period,
        issuedTotal,
        issuedCount,
        plannedTotal,
        plannedCount,
        total: issuedTotal + plannedTotal,
      };
    });
  }, [invoices, scheduledInvoices, periodType]);

  const totals = useMemo(() => {
    const issuedTotal = issuedByCustomer.reduce((sum, c) => sum + c.total, 0);
    const issuedCount = issuedByCustomer.reduce((sum, c) => sum + c.count, 0);
    const plannedTotal = plannedByCustomer.reduce((sum, c) => sum + c.total, 0);
    const plannedCount = plannedByCustomer.reduce((sum, c) => sum + c.count, 0);
    return { issuedTotal, issuedCount, plannedTotal, plannedCount };
  }, [issuedByCustomer, plannedByCustomer]);

  if (invoicesLoading || scheduledLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const months = [
    { value: "1", label: "Január" },
    { value: "2", label: "Február" },
    { value: "3", label: "Marec" },
    { value: "4", label: "Apríl" },
    { value: "5", label: "Máj" },
    { value: "6", label: "Jún" },
    { value: "7", label: "Júl" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "Október" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const years = [2023, 2024, 2025, 2026, 2027];

  return (
    <div className="space-y-6" data-testid="page-invoicing-report">
      <PageHeader
        title="Report fakturácie"
        description="Prehľad vydaných a plánovaných faktúr s predpoveďou"
      />

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Obdobie:</span>
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
            <SelectTrigger className="w-32" data-testid="select-period-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mesiac</SelectItem>
              <SelectItem value="quarter">Štvrťrok</SelectItem>
              <SelectItem value="year">Rok</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {periodType === "month" && (
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-32" data-testid="select-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-issued-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Vydané faktúry</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totals.issuedTotal.toString(), "EUR")}</div>
            <p className="text-xs text-muted-foreground">{totals.issuedCount} faktúr</p>
          </CardContent>
        </Card>

        <Card data-testid="card-planned-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Plánované faktúry</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totals.plannedTotal.toString(), "EUR")}</div>
            <p className="text-xs text-muted-foreground">{totals.plannedCount} faktúr</p>
          </CardContent>
        </Card>

        <Card data-testid="card-customers-issued">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Zákazníci (vydané)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{issuedByCustomer.length}</div>
            <p className="text-xs text-muted-foreground">unikátnych zákazníkov</p>
          </CardContent>
        </Card>

        <Card data-testid="card-forecast-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Celková predpoveď</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount((totals.issuedTotal + totals.plannedTotal).toString(), "EUR")}
            </div>
            <p className="text-xs text-muted-foreground">vydané + plánované</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="issued" className="space-y-4">
        <TabsList>
          <TabsTrigger value="issued" data-testid="tab-issued">
            <FileText className="h-4 w-4 mr-2" />
            Vydané podľa mien
          </TabsTrigger>
          <TabsTrigger value="planned" data-testid="tab-planned">
            <Calendar className="h-4 w-4 mr-2" />
            Plánované podľa mien
          </TabsTrigger>
          <TabsTrigger value="forecast" data-testid="tab-forecast">
            <BarChart3 className="h-4 w-4 mr-2" />
            Predpoveď
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issued" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Vydané faktúry podľa zákazníkov
              </CardTitle>
            </CardHeader>
            <CardContent>
              {issuedByCustomer.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Žiadne vydané faktúry v tomto období
                </div>
              ) : (
                <Table data-testid="table-issued-by-customer">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zákazník</TableHead>
                      <TableHead className="text-right">Počet faktúr</TableHead>
                      <TableHead className="text-right">Celková suma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issuedByCustomer.map((row) => (
                      <TableRow key={row.customerId} data-testid={`row-issued-${row.customerId}`}>
                        <TableCell className="font-medium">{row.customerName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.count}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(row.total.toString(), row.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Spolu</TableCell>
                      <TableCell className="text-right">{totals.issuedCount}</TableCell>
                      <TableCell className="text-right">{formatAmount(totals.issuedTotal.toString(), "EUR")}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Plánované faktúry podľa zákazníkov
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plannedByCustomer.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Žiadne plánované faktúry v tomto období
                </div>
              ) : (
                <Table data-testid="table-planned-by-customer">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zákazník</TableHead>
                      <TableHead className="text-right">Počet faktúr</TableHead>
                      <TableHead className="text-right">Celková suma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plannedByCustomer.map((row) => (
                      <TableRow key={row.customerId} data-testid={`row-planned-${row.customerId}`}>
                        <TableCell className="font-medium">{row.customerName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.count}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(row.total.toString(), row.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Spolu</TableCell>
                      <TableCell className="text-right">{totals.plannedCount}</TableCell>
                      <TableCell className="text-right">{formatAmount(totals.plannedTotal.toString(), "EUR")}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Predpoveď na obdobie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table data-testid="table-forecast">
                <TableHeader>
                  <TableRow>
                    <TableHead>Obdobie</TableHead>
                    <TableHead className="text-right">Vydané</TableHead>
                    <TableHead className="text-right">Plánované</TableHead>
                    <TableHead className="text-right">Spolu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecast.map((period, idx) => (
                    <TableRow key={idx} data-testid={`row-forecast-${idx}`}>
                      <TableCell className="font-medium">{period.label}</TableCell>
                      <TableCell className="text-right">
                        <div>{formatAmount(period.issuedTotal.toString(), "EUR")}</div>
                        <div className="text-xs text-muted-foreground">{period.issuedCount} faktúr</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{formatAmount(period.plannedTotal.toString(), "EUR")}</div>
                        <div className="text-xs text-muted-foreground">{period.plannedCount} faktúr</div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatAmount(period.total.toString(), "EUR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
