import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { COUNTRIES, type BillingDetails } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { Droplets, Globe, Shield, Building2, Save, Loader2 } from "lucide-react";
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
}

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
  });

  const [isInitialized, setIsInitialized] = useState(false);

  if (billingDetails && !isInitialized) {
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
    });
    setIsInitialized(true);
  }

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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("billing");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="System configuration and billing details"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="billing" data-testid="tab-billing">
            <Building2 className="h-4 w-4 mr-2" />
            Billing Details
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Shield className="h-4 w-4 mr-2" />
            System Info
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

        <TabsContent value="system" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Droplets className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>About Nexus BioLink</CardTitle>
                  <CardDescription>CRM System for Cord Blood Banking</CardDescription>
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
