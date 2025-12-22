import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useI18n } from "@/i18n";
import { COUNTRIES, type BillingDetails, type ComplaintType, type CooperationType, type VipStatus, type HealthInsurance } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { Droplets, Globe, Shield, Building2, Save, Loader2, Plus, Trash2, Settings2, Heart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const CURRENCIES = ["EUR", "USD", "CZK", "HUF", "RON", "CHF", "GBP"];

interface BillingFormData {
  companyName: string;
  address: string;
  city: string;
  postalCode: string;
  taxId: string;
  bankName: string;
  bankIban: string;
  bankSwift: string;
  vatRate: string;
  currency: string;
  paymentTerms: number[];
  defaultPaymentTerm: number;
}

const DEFAULT_PAYMENT_TERMS = [7, 14, 30, 45, 60];

function BillingDetailsForm({ countryCode }: { countryCode: string }) {
  const { toast } = useToast();
  const countryInfo = COUNTRIES.find(c => c.code === countryCode);
  
  const { data: billingDetails, isLoading } = useQuery<BillingDetails>({
    queryKey: ["/api/billing-details", countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details/${countryCode}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch billing details");
      return res.json();
    },
  });

  const [formData, setFormData] = useState<BillingFormData>({
    companyName: "",
    address: "",
    city: "",
    postalCode: "",
    taxId: "",
    bankName: "",
    bankIban: "",
    bankSwift: "",
    vatRate: "20",
    currency: "EUR",
    paymentTerms: [7, 14, 30],
    defaultPaymentTerm: 14,
  });

  useEffect(() => {
    if (billingDetails) {
      setFormData({
        companyName: billingDetails.companyName || "",
        address: billingDetails.address || "",
        city: billingDetails.city || "",
        postalCode: billingDetails.postalCode || "",
        taxId: billingDetails.taxId || "",
        bankName: billingDetails.bankName || "",
        bankIban: billingDetails.bankIban || "",
        bankSwift: billingDetails.bankSwift || "",
        vatRate: billingDetails.vatRate || "20",
        currency: billingDetails.currency || "EUR",
        paymentTerms: billingDetails.paymentTerms || [7, 14, 30],
        defaultPaymentTerm: billingDetails.defaultPaymentTerm || 14,
      });
    }
  }, [billingDetails]);

  const saveMutation = useMutation({
    mutationFn: (data: BillingFormData) =>
      apiRequest("PUT", `/api/billing-details/${countryCode}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", countryCode] });
      toast({ title: `Billing details saved for ${countryInfo?.name}` });
    },
    onError: () => {
      toast({ title: "Failed to save billing details", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.address || !formData.city) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            placeholder="Enter company name"
            data-testid={`input-billing-company-${countryCode}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxId">Tax ID / VAT Number</Label>
          <Input
            id="taxId"
            value={formData.taxId}
            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
            placeholder="e.g., SK1234567890"
            data-testid={`input-billing-taxid-${countryCode}`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address *</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Street address"
          data-testid={`input-billing-address-${countryCode}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="City"
            data-testid={`input-billing-city-${countryCode}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            placeholder="Postal code"
            data-testid={`input-billing-postal-${countryCode}`}
          />
        </div>
      </div>

      <Separator />

      <h4 className="font-medium">Bank Details</h4>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="bankName">Bank Name</Label>
          <Input
            id="bankName"
            value={formData.bankName}
            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
            placeholder="Bank name"
            data-testid={`input-billing-bank-${countryCode}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankIban">IBAN</Label>
          <Input
            id="bankIban"
            value={formData.bankIban}
            onChange={(e) => setFormData({ ...formData, bankIban: e.target.value })}
            placeholder="IBAN number"
            data-testid={`input-billing-iban-${countryCode}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankSwift">SWIFT / BIC</Label>
          <Input
            id="bankSwift"
            value={formData.bankSwift}
            onChange={(e) => setFormData({ ...formData, bankSwift: e.target.value })}
            placeholder="SWIFT code"
            data-testid={`input-billing-swift-${countryCode}`}
          />
        </div>
      </div>

      <Separator />

      <h4 className="font-medium">Tax Settings</h4>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vatRate">VAT Rate (%)</Label>
          <Input
            id="vatRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.vatRate}
            onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
            placeholder="20"
            data-testid={`input-billing-vat-${countryCode}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Default Currency</Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => setFormData({ ...formData, currency: value })}
          >
            <SelectTrigger data-testid={`select-billing-currency-${countryCode}`}>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((curr) => (
                <SelectItem key={curr} value={curr}>
                  {curr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <h4 className="font-medium">Payment Terms</h4>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Available Payment Terms (days)</Label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_PAYMENT_TERMS.map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={formData.paymentTerms.includes(days) ? "default" : "outline"}
                onClick={() => {
                  if (formData.paymentTerms.includes(days)) {
                    if (formData.paymentTerms.length > 1) {
                      const newTerms = formData.paymentTerms.filter(t => t !== days);
                      setFormData({ 
                        ...formData, 
                        paymentTerms: newTerms,
                        defaultPaymentTerm: newTerms.includes(formData.defaultPaymentTerm) 
                          ? formData.defaultPaymentTerm 
                          : newTerms[0]
                      });
                    }
                  } else {
                    setFormData({ 
                      ...formData, 
                      paymentTerms: [...formData.paymentTerms, days].sort((a, b) => a - b) 
                    });
                  }
                }}
                data-testid={`button-payment-term-${days}-${countryCode}`}
              >
                {days} days
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Click to enable/disable payment term options for invoices
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultPaymentTerm">Default Payment Term</Label>
          <Select
            value={formData.defaultPaymentTerm.toString()}
            onValueChange={(value) => setFormData({ ...formData, defaultPaymentTerm: parseInt(value) })}
          >
            <SelectTrigger data-testid={`select-default-payment-${countryCode}`}>
              <SelectValue placeholder="Select default term" />
            </SelectTrigger>
            <SelectContent>
              {formData.paymentTerms.map((days) => (
                <SelectItem key={days} value={days.toString()}>
                  {days} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={saveMutation.isPending} data-testid={`button-save-billing-${countryCode}`}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Billing Details
        </Button>
      </div>
    </form>
  );
}

// Configuration list manager component
interface ConfigItem {
  id: string;
  name: string;
  countryCode?: string | null;
  code?: string;
  isActive: boolean;
}

function ConfigListManager({ 
  title, 
  description, 
  apiPath, 
  queryKey,
  showCode = false,
  requireCountry = false,
}: { 
  title: string; 
  description: string; 
  apiPath: string;
  queryKey: string;
  showCode?: boolean;
  requireCountry?: boolean;
}) {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCountryCode, setNewCountryCode] = useState<string>("__global__");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<ConfigItem[]>({
    queryKey: [queryKey],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; code?: string; countryCode?: string | null }) =>
      apiRequest("POST", apiPath, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setNewName("");
      setNewCode("");
      setNewCountryCode("");
      toast({ title: `${title} pridany` });
    },
    onError: () => {
      toast({ title: `Nepodarilo sa pridat ${title.toLowerCase()}`, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${apiPath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDeleteId(null);
      toast({ title: `${title} odstraneny` });
    },
    onError: () => {
      toast({ title: `Nepodarilo sa odstranit ${title.toLowerCase()}`, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) {
      toast({ title: "Nazov je povinny", variant: "destructive" });
      return;
    }
    if (showCode && !newCode.trim()) {
      toast({ title: "Kod je povinny", variant: "destructive" });
      return;
    }
    if (requireCountry && (!newCountryCode || newCountryCode === "__global__")) {
      toast({ title: "Krajina je povinna", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      code: showCode ? newCode.trim() : undefined,
      countryCode: newCountryCode === "__global__" ? null : newCountryCode,
    });
  };

  const getCountryName = (code: string | null | undefined) => {
    if (!code) return "Globalne";
    const country = COUNTRIES.find(c => c.code === code);
    return country?.name || code;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            placeholder="Nazov"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            data-testid={`input-new-${queryKey}`}
          />
          {showCode && (
            <Input
              placeholder="Kod"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              data-testid={`input-new-code-${queryKey}`}
            />
          )}
          <Select value={newCountryCode} onValueChange={setNewCountryCode}>
            <SelectTrigger data-testid={`select-country-${queryKey}`}>
              <SelectValue placeholder={requireCountry ? "Vyberte krajinu" : "Globalne"} />
            </SelectTrigger>
            <SelectContent>
              {!requireCountry && <SelectItem value="__global__">Globalne (vsetky krajiny)</SelectItem>}
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={createMutation.isPending} data-testid={`button-add-${queryKey}`}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Pridat
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Ziadne polozky.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              data-testid={`config-item-${item.id}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{item.name}</span>
                {showCode && item.code && (
                  <Badge variant="outline">{item.code}</Badge>
                )}
                <Badge variant="secondary">{getCountryName(item.countryCode)}</Badge>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDeleteId(item.id)}
                data-testid={`button-delete-${item.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrdit odstranenie</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete odstranit tuto polozku? Tato akcia sa neda vratit spat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrusit</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Odstranit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("billing");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.settings.title}
        description=""
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="billing" data-testid="tab-billing">
            <Building2 className="h-4 w-4 mr-2" />
            Fakturacia
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings2 className="h-4 w-4 mr-2" />
            Konfiguracia
          </TabsTrigger>
          <TabsTrigger value="insurance" data-testid="tab-insurance">
            <Heart className="h-4 w-4 mr-2" />
            Poistovne
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Shield className="h-4 w-4 mr-2" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Details by Country</CardTitle>
              <CardDescription>
                Configure company billing information and VAT rates for each country
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={COUNTRIES[0].code}>
                <TabsList className="flex flex-wrap gap-1 h-auto">
                  {COUNTRIES.map((country) => (
                    <TabsTrigger
                      key={country.code}
                      value={country.code}
                      className="flex items-center gap-2"
                      data-testid={`tab-country-${country.code}`}
                    >
                      <span>{country.name}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                {COUNTRIES.map((country) => (
                  <TabsContent key={country.code} value={country.code} className="mt-6">
                    <div className="flex items-center gap-3 mb-6 p-4 rounded-lg bg-muted/50">
                      <Globe className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-medium">{country.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Billing configuration for {country.code}
                        </p>
                      </div>
                    </div>
                    <BillingDetailsForm countryCode={country.code} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Typy staznosti</CardTitle>
              <CardDescription>
                Konfigurovatelne typy staznosti pre klientov
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title="Typ staznosti"
                description="Typy staznosti"
                apiPath="/api/config/complaint-types"
                queryKey="/api/config/complaint-types"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typy spoluprace</CardTitle>
              <CardDescription>
                Konfigurovatelne typy spoluprace pre klientov
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title="Typ spoluprace"
                description="Typy spoluprace"
                apiPath="/api/config/cooperation-types"
                queryKey="/api/config/cooperation-types"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>VIP Statusy</CardTitle>
              <CardDescription>
                Konfigurovatelne VIP statusy pre klientov
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title="VIP Status"
                description="VIP statusy"
                apiPath="/api/config/vip-statuses"
                queryKey="/api/config/vip-statuses"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Zdravotne poistovne</CardTitle>
              <CardDescription>
                Konfigurovatelne zdravotne poistovne pre kazdu krajinu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title="Poistovna"
                description="Zdravotne poistovne"
                apiPath="/api/config/health-insurance"
                queryKey="/api/config/health-insurance"
                showCode={true}
                requireCountry={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Droplets className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>O Nexus BioLink</CardTitle>
                  <CardDescription>CRM System pre pupocnikove banky</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Version</span>
                  <Badge variant="secondary">v1.0.0</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Environment</span>
                  <Badge>Production</Badge>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Nexus BioLink is a comprehensive CRM system designed specifically for cord blood banking companies.
                  It provides multi-country support, customer management, and user access control.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Supported Countries</CardTitle>
                  <CardDescription>Regions available in the system</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {COUNTRIES.map((country) => (
                    <div
                      key={country.code}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{country.name}</p>
                        <p className="text-xs text-muted-foreground">{country.code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>User Roles</CardTitle>
                  <CardDescription>Access levels in the system</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge>Admin</Badge>
                    <p className="text-sm text-muted-foreground">
                      Full access to all features, user management, and system settings
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant="secondary">Manager</Badge>
                    <p className="text-sm text-muted-foreground">
                      Can manage customers and view reports for assigned countries
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant="outline">User</Badge>
                    <p className="text-sm text-muted-foreground">
                      Basic access to view and edit customers in assigned countries
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
