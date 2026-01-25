import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { format } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  Globe,
  Pencil,
  X,
  Package,
  FileText,
  Clock,
  MessageSquare,
  Star,
  Shield,
  CreditCard,
  PhoneCall,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  Loader2,
} from "lucide-react";
import type { Customer } from "@shared/schema";

interface CustomerDetailDrawerProps {
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function CustomerDetailDrawer({ customer, open, onClose, onEdit }: CustomerDetailDrawerProps) {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState("info");

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

  const { data: customerProducts = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customer?.id, "products"],
    enabled: !!customer?.id,
  });

  const { data: activityLogs = [], isLoading: activityLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customer?.id, "activity-logs"],
    enabled: !!customer?.id && activeTab === "history",
  });

  const { data: customerInvoices = [], isLoading: invoicesLoading } = useQuery<any[]>({
    queryKey: ["/api/invoices", { customerId: customer?.id }],
    enabled: !!customer?.id && activeTab === "account",
  });

  if (!customer) return null;

  const fullName = `${customer.firstName} ${customer.lastName}`;
  const initials = `${customer.firstName?.charAt(0) || ""}${customer.lastName?.charAt(0) || ""}`.toUpperCase();
  
  const fullAddress = [
    customer.address,
    customer.city,
    customer.postalCode,
    customer.country
  ].filter(Boolean).join(", ");

  const getStatusBadge = (status: string | null) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      active: { label: t.customers.statuses?.active || "Active", variant: "default" },
      potential: { label: t.customers.statuses?.pending || "Potential", variant: "secondary" },
      acquired: { label: "Acquired", variant: "default" },
      terminated: { label: t.customers.statuses?.inactive || "Terminated", variant: "destructive" },
    };
    const config = statusMap[status || ""] || { label: status || "-", variant: "outline" as const };
    return <Badge variant={config.variant} data-testid="badge-customer-status">{config.label}</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col"
        data-testid="customer-detail-drawer"
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary/20" data-testid="avatar-customer">
                  <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight" data-testid="text-customer-name">
                    {customer.titleBefore && <span className="text-muted-foreground font-normal">{customer.titleBefore} </span>}
                    {fullName}
                    {customer.titleAfter && <span className="text-muted-foreground font-normal">, {customer.titleAfter}</span>}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(customer.clientStatus)}
                    {customer.vipStatusId && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-vip">
                        <Star className="h-3 w-3 mr-1" />
                        VIP
                      </Badge>
                    )}
                    {customer.country && (
                      <Badge variant="outline" data-testid="badge-country">{customer.country}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-customer">
                  <Pencil className="h-4 w-4 mr-2" />
                  {t.common.edit}
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-drawer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b px-6">
              <TabsList className="h-12 w-full justify-start gap-4 bg-transparent p-0">
                <TabsTrigger 
                  value="info" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
                  data-testid="tab-customer-info"
                >
                  <User className="h-4 w-4 mr-2" />
                  {t.customers.tabs?.contact || "Info"}
                </TabsTrigger>
                <TabsTrigger 
                  value="account" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
                  data-testid="tab-customer-account"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {t.customers.tabs?.overview || "Account"}
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
                  data-testid="tab-customer-history"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t.customers.tabs?.history || "History"}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="info" className="p-6 m-0 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <InfoSection title="Contact Information">
                    <InfoRow icon={Mail} label="Email" value={customer.email} testId="text-email" />
                    {customer.email2 && <InfoRow icon={Mail} label="Email 2" value={customer.email2} testId="text-email2" />}
                    <InfoRow icon={Phone} label={t.customers.phone || "Phone"} value={customer.phone} testId="text-phone" />
                    <InfoRow icon={Smartphone} label={t.customers.fields?.mobile || "Mobile"} value={customer.mobile} testId="text-mobile" />
                    {customer.mobile2 && <InfoRow icon={Smartphone} label="Mobile 2" value={customer.mobile2} testId="text-mobile2" />}
                    {customer.otherContact && <InfoRow icon={Phone} label={t.customers.fields?.otherContact || "Other"} value={customer.otherContact} testId="text-other-contact" />}
                  </InfoSection>

                  <InfoSection title="Address">
                    <div className="flex items-start gap-3" data-testid="section-address">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="text-sm">
                        {customer.address && <p data-testid="text-address">{customer.address}</p>}
                        {(customer.city || customer.postalCode) && (
                          <p data-testid="text-city-postal">{[customer.postalCode, customer.city].filter(Boolean).join(" ")}</p>
                        )}
                        {customer.region && <p data-testid="text-region">{customer.region}</p>}
                        {customer.country && <p className="font-medium" data-testid="text-country">{customer.country}</p>}
                        {!fullAddress && <span className="text-muted-foreground">-</span>}
                      </div>
                    </div>
                  </InfoSection>
                </div>

                {customer.useCorrespondenceAddress && (
                  <InfoSection title="Correspondence Address">
                    <div className="flex items-start gap-3" data-testid="section-corr-address">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="text-sm">
                        {customer.corrName && <p className="font-medium">{customer.corrName}</p>}
                        {customer.corrAddress && <p>{customer.corrAddress}</p>}
                        {(customer.corrCity || customer.corrPostalCode) && (
                          <p>{[customer.corrPostalCode, customer.corrCity].filter(Boolean).join(" ")}</p>
                        )}
                        {customer.corrCountry && <p>{customer.corrCountry}</p>}
                      </div>
                    </div>
                  </InfoSection>
                )}

                <InfoSection title="Personal Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    {customer.maidenName && (
                      <InfoRow icon={User} label={t.customers.fields?.maidenName || "Maiden Name"} value={customer.maidenName} testId="text-maiden-name" />
                    )}
                    {customer.dateOfBirth && (
                      <InfoRow 
                        icon={Calendar} 
                        label={t.customers.fields?.dateOfBirth || "Date of Birth"} 
                        value={format(new Date(customer.dateOfBirth), "d. MMMM yyyy", { locale: getDateLocale() })} 
                        testId="text-dob"
                      />
                    )}
                    {customer.nationalId && (
                      <InfoRow icon={Shield} label={t.customers.fields?.nationalId || "National ID"} value={customer.nationalId} testId="text-national-id" />
                    )}
                    {customer.idCardNumber && (
                      <InfoRow icon={CreditCard} label={t.customers.fields?.idCardNumber || "ID Card"} value={customer.idCardNumber} testId="text-id-card" />
                    )}
                  </div>
                </InfoSection>

                {(customer.bankAccount || customer.bankName) && (
                  <InfoSection title="Bank Information">
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoRow icon={CreditCard} label="IBAN" value={customer.bankAccount} testId="text-iban" />
                      <InfoRow icon={Building2} label={t.customers.fields?.bankName || "Bank"} value={customer.bankName} testId="text-bank" />
                      {customer.bankSwift && <InfoRow icon={Globe} label="SWIFT" value={customer.bankSwift} testId="text-swift" />}
                    </div>
                  </InfoSection>
                )}

                <InfoSection title="Other Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoRow 
                      icon={Calendar} 
                      label="Created" 
                      value={customer.createdAt ? format(new Date(customer.createdAt), "d. MMMM yyyy", { locale: getDateLocale() }) : null} 
                      testId="text-created-at"
                    />
                    {customer.internalId && (
                      <InfoRow icon={FileText} label={t.customers.fields?.clientId || "Internal ID"} value={customer.internalId} testId="text-internal-id" />
                    )}
                  </div>
                </InfoSection>

                {customer.notes && (
                  <InfoSection title={t.customers.notes || "Notes"}>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg" data-testid="text-notes">
                      {customer.notes}
                    </p>
                  </InfoSection>
                )}
              </TabsContent>

              <TabsContent value="account" className="p-6 m-0 space-y-6">
                <InfoSection title={t.products?.title || "Products"}>
                  {productsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : customerProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-products">
                      No products assigned
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {customerProducts.map((cp: any, index: number) => (
                        <div 
                          key={cp.id} 
                          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted/50"
                          data-testid={`product-item-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium text-sm">{cp.product?.name || cp.productId}</p>
                              {cp.billset?.name && (
                                <p className="text-xs text-muted-foreground">{cp.billset.name}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">{cp.quantity}x</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </InfoSection>

                <InfoSection title={t.invoices?.title || "Invoices"}>
                  {invoicesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : customerInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-invoices">
                      No invoices
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {customerInvoices.slice(0, 10).map((invoice: any, index: number) => (
                        <div 
                          key={invoice.id} 
                          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted/50"
                          data-testid={`invoice-item-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {invoice.createdAt && format(new Date(invoice.createdAt), "d.M.yyyy", { locale: getDateLocale() })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">
                              {parseFloat(invoice.totalAmount || 0).toFixed(2)} {invoice.currency}
                            </p>
                            <Badge 
                              variant={invoice.status === "paid" ? "default" : "outline"}
                              className={invoice.status === "paid" ? "bg-green-600" : ""}
                            >
                              {invoice.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </InfoSection>
              </TabsContent>

              <TabsContent value="history" className="p-6 m-0">
                <InfoSection title={t.customers.tabs?.activity || "Activity History"}>
                  {activityLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-activity">
                      No activity recorded
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {activityLogs.slice(0, 20).map((log: any, index: number) => (
                        <div key={log.id} className="flex gap-3" data-testid={`activity-item-${index}`}>
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              {getActionIcon(log.action)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {getActionLabel(log.action)}
                            </p>
                            {log.details && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {log.createdAt && format(new Date(log.createdAt), "d.M.yyyy HH:mm", { locale: getDateLocale() })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </InfoSection>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, testId }: { icon: any; label: string; value: string | null | undefined; testId?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3" data-testid={testId}>
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function getActionIcon(action: string) {
  switch (action) {
    case "create":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "update":
      return <Pencil className="h-4 w-4 text-blue-600" />;
    case "send_email":
      return <Mail className="h-4 w-4 text-sky-600" />;
    case "send_sms":
      return <MessageSquare className="h-4 w-4 text-teal-600" />;
    case "phone_call":
      return <PhoneCall className="h-4 w-4 text-purple-600" />;
    case "pipeline_move":
    case "stage_changed":
      return <ArrowRight className="h-4 w-4 text-cyan-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    create: "Created",
    update: "Updated",
    send_email: "Email sent",
    send_sms: "SMS sent",
    phone_call: "Phone call",
    pipeline_move: "Pipeline move",
    stage_changed: "Stage changed",
    view: "Viewed",
    note_added: "Note added",
    assign_product: "Product assigned",
    generate_invoice: "Invoice generated",
  };
  return labels[action] || action.replace(/_/g, " ");
}
