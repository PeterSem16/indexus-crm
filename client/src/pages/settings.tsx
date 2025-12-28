import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { COUNTRIES, type BillingDetails, type ComplaintType, type CooperationType, type VipStatus, type HealthInsurance, type LeadScoringCriteria } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { Droplets, Globe, Shield, Building2, Save, Loader2, Plus, Trash2, Settings2, Heart, FlaskConical, Pencil, Star, Target, RefreshCw, Phone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  isDefault: boolean;
}

const DEFAULT_PAYMENT_TERMS = [7, 14, 30, 45, 60];

const defaultBillingFormData: BillingFormData = {
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
  isDefault: false,
};

function BillingCompanyForm({
  countryCode,
  billingCompany,
  onClose,
  onSuccess,
}: {
  countryCode: string;
  billingCompany?: BillingDetails;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();

  const [formData, setFormData] = useState<BillingFormData>(() =>
    billingCompany
      ? {
          companyName: billingCompany.companyName || "",
          address: billingCompany.address || "",
          city: billingCompany.city || "",
          postalCode: billingCompany.postalCode || "",
          taxId: billingCompany.taxId || "",
          bankName: billingCompany.bankName || "",
          bankIban: billingCompany.bankIban || "",
          bankSwift: billingCompany.bankSwift || "",
          vatRate: billingCompany.vatRate || "20",
          currency: billingCompany.currency || "EUR",
          paymentTerms: billingCompany.paymentTerms || [7, 14, 30],
          defaultPaymentTerm: billingCompany.defaultPaymentTerm || 14,
          isDefault: billingCompany.isDefault || false,
        }
      : defaultBillingFormData
  );

  const saveMutation = useMutation({
    mutationFn: (data: BillingFormData) => {
      if (billingCompany) {
        return apiRequest("PATCH", `/api/billing-details/${billingCompany.id}`, data);
      } else {
        return apiRequest("POST", `/api/billing-details`, { ...data, countryCode });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details"] });
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.address || !formData.city) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName">{t.settings.companyName} *</Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            placeholder={t.settings.companyName}
            data-testid="input-billing-company-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxId">{t.settings.taxId}</Label>
          <Input
            id="taxId"
            value={formData.taxId}
            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
            placeholder={t.settings.taxId}
            data-testid="input-billing-taxid"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">{t.settings.address} *</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder={t.settings.address}
          data-testid="input-billing-address"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">{t.settings.city} *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder={t.settings.city}
            data-testid="input-billing-city"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">{t.settings.postalCode}</Label>
          <Input
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            placeholder={t.settings.postalCode}
            data-testid="input-billing-postal"
          />
        </div>
      </div>

      <Separator />

      <h4 className="font-medium">{t.settings.bankName}</h4>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="bankName">{t.settings.bankName}</Label>
          <Input
            id="bankName"
            value={formData.bankName}
            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
            placeholder={t.settings.bankName}
            data-testid="input-billing-bank"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankIban">{t.settings.iban}</Label>
          <Input
            id="bankIban"
            value={formData.bankIban}
            onChange={(e) => setFormData({ ...formData, bankIban: e.target.value })}
            placeholder={t.settings.iban}
            data-testid="input-billing-iban"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankSwift">{t.settings.swift}</Label>
          <Input
            id="bankSwift"
            value={formData.bankSwift}
            onChange={(e) => setFormData({ ...formData, bankSwift: e.target.value })}
            placeholder={t.settings.swift}
            data-testid="input-billing-swift"
          />
        </div>
      </div>

      <Separator />

      <h4 className="font-medium">{t.settings.vatRate}</h4>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vatRate">{t.settings.vatRate} (%)</Label>
          <Input
            id="vatRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.vatRate}
            onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
            placeholder="20"
            data-testid="input-billing-vat"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">{t.settings.currency}</Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => setFormData({ ...formData, currency: value })}
          >
            <SelectTrigger data-testid="select-billing-currency">
              <SelectValue placeholder={t.settings.currency} />
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

      <h4 className="font-medium">{t.settings.paymentTerms}</h4>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t.settings.availablePaymentTerms}</Label>
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
                      const newTerms = formData.paymentTerms.filter(term => term !== days);
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
                data-testid={`button-payment-term-${days}`}
              >
                {days} {t.settings.days}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t.settings.paymentTermsHint}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultPaymentTerm">{t.settings.defaultPaymentTerm}</Label>
          <Select
            value={formData.defaultPaymentTerm.toString()}
            onValueChange={(value) => setFormData({ ...formData, defaultPaymentTerm: parseInt(value) })}
          >
            <SelectTrigger data-testid="select-default-payment">
              <SelectValue placeholder={t.settings.defaultPaymentTerm} />
            </SelectTrigger>
            <SelectContent>
              {formData.paymentTerms.map((days) => (
                <SelectItem key={days} value={days.toString()}>
                  {days} {t.settings.days}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          <Switch
            id="isDefault"
            checked={formData.isDefault}
            onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
            data-testid="switch-billing-default"
          />
          <Label htmlFor="isDefault">{t.settings.setAsDefault || "Set as default"}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-billing">
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t.common.save}
          </Button>
        </div>
      </div>
    </form>
  );
}

function BillingCompaniesManager({ countryCode }: { countryCode: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<BillingDetails | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: billingCompanies = [], isLoading } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details", "country", countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details?country=${countryCode}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/billing-details/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details"] });
      setDeleteId(null);
      toast({ title: t.settings.itemDeleted });
    },
    onError: () => {
      toast({ title: t.settings.deleteFailed, variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/billing-details/${id}`, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details"] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleAddNew = () => {
    setIsFormOpen(false);
    setTimeout(() => {
      setEditingCompany(undefined);
      setIsFormOpen(true);
    }, 0);
  };

  const handleEdit = (company: BillingDetails) => {
    setEditingCompany(company);
    setIsFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddNew} data-testid="button-add-billing-company">
          <Plus className="h-4 w-4 mr-2" />
          {t.settings.addBillingCompany || "Add Billing Company"}
        </Button>
      </div>

      {billingCompanies.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t.settings.noBillingCompanies || "No billing companies configured for this country."}
        </p>
      ) : (
        <div className="space-y-3">
          {billingCompanies.map((company) => (
            <div
              key={company.id}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
              data-testid={`billing-company-${company.id}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{company.companyName}</span>
                  {company.isDefault && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {t.settings.defaultLabel || "Default"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {company.address}, {company.city}
                </p>
                <p className="text-xs text-muted-foreground">
                  VAT: {company.vatRate}% | {company.currency}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!company.isDefault && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDefaultMutation.mutate(company.id)}
                    disabled={setDefaultMutation.isPending}
                    data-testid={`button-set-default-${company.id}`}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    {t.settings.setAsDefault || "Set Default"}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEdit(company)}
                  data-testid={`button-edit-billing-${company.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteId(company.id)}
                  data-testid={`button-delete-billing-${company.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isFormOpen && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              {editingCompany ? (t.settings.editBillingCompany || "Edit Billing Company") : (t.settings.addBillingCompany || "Add Billing Company")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BillingCompanyForm
              key={editingCompany?.id || "new"}
              countryCode={countryCode}
              billingCompany={editingCompany}
              onClose={() => {
                setIsFormOpen(false);
                setEditingCompany(undefined);
              }}
              onSuccess={() => {
                setIsFormOpen(false);
                setEditingCompany(undefined);
              }}
            />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.confirmDeleteMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-billing"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
  countries = COUNTRIES as readonly { code: string; name: string; flag?: string }[],
}: { 
  title: string; 
  description: string; 
  apiPath: string;
  queryKey: string;
  showCode?: boolean;
  requireCountry?: boolean;
  countries?: readonly { code: string; name: string; flag?: string }[];
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCountryCode, setNewCountryCode] = useState<string>("__global__");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editCountryCode, setEditCountryCode] = useState<string>("__global__");

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
      toast({ title: t.settings.itemAdded });
    },
    onError: () => {
      toast({ title: t.settings.addFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${apiPath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDeleteId(null);
      toast({ title: t.settings.itemDeleted });
    },
    onError: () => {
      toast({ title: t.settings.deleteFailed, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; code?: string; countryCode?: string | null }) =>
      apiRequest("PATCH", `${apiPath}/${data.id}`, { name: data.name, code: data.code, countryCode: data.countryCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setEditingItem(null);
      toast({ title: t.settings.itemUpdated });
    },
    onError: () => {
      toast({ title: t.settings.updateFailed, variant: "destructive" });
    },
  });

  const handleStartEdit = (item: ConfigItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCode(item.code || "");
    setEditCountryCode(item.countryCode || "__global__");
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    if (!editName.trim()) {
      toast({ title: t.settings.nameRequired, variant: "destructive" });
      return;
    }
    if (showCode && !editCode.trim()) {
      toast({ title: t.settings.codeRequired, variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingItem.id,
      name: editName.trim(),
      code: showCode ? editCode.trim() : undefined,
      countryCode: editCountryCode === "__global__" ? null : editCountryCode,
    });
  };

  const handleAdd = () => {
    if (!newName.trim()) {
      toast({ title: t.settings.nameRequired, variant: "destructive" });
      return;
    }
    if (showCode && !newCode.trim()) {
      toast({ title: t.settings.codeRequired, variant: "destructive" });
      return;
    }
    if (requireCountry && (!newCountryCode || newCountryCode === "__global__")) {
      toast({ title: t.settings.countryRequired, variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      code: showCode ? newCode.trim() : undefined,
      countryCode: newCountryCode === "__global__" ? null : newCountryCode,
    });
  };

  const getCountryName = (code: string | null | undefined) => {
    if (!code) return t.settings.global;
    const country = countries.find(c => c.code === code);
    return country?.name || code;
  };
  
  // Filter items to only show those belonging to user's countries (or global items)
  const filteredItems = useMemo(() => {
    const countryCodes = countries.map(c => c.code);
    return items.filter(item => !item.countryCode || countryCodes.includes(item.countryCode as string));
  }, [items, countries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            placeholder={t.settings.namePlaceholder}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            data-testid={`input-new-${queryKey}`}
          />
          {showCode && (
            <Input
              placeholder={t.settings.codePlaceholder}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              data-testid={`input-new-code-${queryKey}`}
            />
          )}
          <Select value={newCountryCode} onValueChange={setNewCountryCode}>
            <SelectTrigger data-testid={`select-country-${queryKey}`}>
              <SelectValue placeholder={requireCountry ? t.settings.selectCountry : t.settings.global} />
            </SelectTrigger>
            <SelectContent>
              {!requireCountry && <SelectItem value="__global__">{t.settings.globalAllCountries}</SelectItem>}
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={createMutation.isPending} data-testid={`button-add-${queryKey}`}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            {t.common.add}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t.settings.noItems}</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              data-testid={`config-item-${item.id}`}
            >
              {editingItem?.id === item.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    data-testid={`input-edit-name-${item.id}`}
                  />
                  {showCode && (
                    <Input
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-24"
                      placeholder={t.settings.codePlaceholder}
                      data-testid={`input-edit-code-${item.id}`}
                    />
                  )}
                  <Select value={editCountryCode} onValueChange={setEditCountryCode}>
                    <SelectTrigger className="w-32" data-testid={`select-edit-country-${item.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!requireCountry && <SelectItem value="__global__">{t.settings.globalAllCountries}</SelectItem>}
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid={`button-save-edit-${item.id}`}>
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingItem(null)} data-testid={`button-cancel-edit-${item.id}`}>
                    {t.common.cancel}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{item.name}</span>
                    {showCode && item.code && (
                      <Badge variant="outline">{item.code}</Badge>
                    )}
                    <Badge variant="secondary">{getCountryName(item.countryCode)}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleStartEdit(item)}
                      data-testid={`button-edit-${item.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteId(item.id)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.confirmDeleteMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const LEAD_SCORING_FIELDS = [
  'hasPhone', 'hasEmail', 'hasAddress', 'hasCase', 'newsletterOptIn',
  'caseStatus', 'hasExpectedDate', 'hasFatherInfo', 'hasProduct',
  'clientStatus', 'daysFromCreation'
] as const;

const LEAD_SCORING_CONDITIONS = ['equals', 'not_empty', 'greater_than', 'less_than', 'contains'] as const;
const LEAD_SCORING_CATEGORIES = ['profile', 'engagement', 'behavior', 'demographic'] as const;

interface CriteriaFormData {
  name: string;
  description: string;
  category: string;
  field: string;
  condition: string;
  value: string;
  points: number;
  isActive: boolean;
  countryCode: string | null;
}

function LeadScoringCriteriaManager({ countries }: { countries: readonly { code: string; name: string; flag?: string }[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<LeadScoringCriteria | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const defaultFormData: CriteriaFormData = {
    name: '',
    description: '',
    category: 'profile',
    field: 'hasPhone',
    condition: 'not_empty',
    value: '',
    points: 10,
    isActive: true,
    countryCode: null,
  };

  const [formData, setFormData] = useState<CriteriaFormData>(defaultFormData);

  const { data: criteria, isLoading } = useQuery<LeadScoringCriteria[]>({
    queryKey: ['/api/lead-scoring-criteria'],
  });

  const saveMutation = useMutation({
    mutationFn: (data: CriteriaFormData) => {
      if (editingCriteria) {
        return apiRequest("PATCH", `/api/lead-scoring-criteria/${editingCriteria.id}`, data);
      }
      return apiRequest("POST", "/api/lead-scoring-criteria", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring-criteria'] });
      toast({ title: t.success.saved });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/lead-scoring-criteria/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring-criteria'] });
      toast({ title: t.success.deleted });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/lead-scoring-criteria/seed-defaults"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring-criteria'] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      await apiRequest("POST", "/api/lead-scoring/recalculate-all");
      toast({ title: t.success.updated });
    } catch {
      toast({ title: t.errors.generic, variant: "destructive" });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCriteria(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: LeadScoringCriteria) => {
    setEditingCriteria(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      field: item.field,
      condition: item.condition,
      value: item.value || '',
      points: item.points,
      isActive: item.isActive,
      countryCode: item.countryCode,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCriteria(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.field) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  const getFieldLabel = (field: string) => {
    const key = field as keyof typeof t.leadScoring.fieldOptions;
    return t.leadScoring.fieldOptions[key] || field;
  };

  const getConditionLabel = (condition: string) => {
    const key = condition as keyof typeof t.leadScoring.conditions;
    return t.leadScoring.conditions[key] || condition;
  };

  const getCategoryLabel = (category: string) => {
    const key = category as keyof typeof t.leadScoring.categories;
    return t.leadScoring.categories[key] || category;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleOpenAdd} data-testid="button-add-criteria">
            <Plus className="h-4 w-4 mr-2" />
            {t.leadScoring.addCriteria}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => seedMutation.mutate()} 
            disabled={seedMutation.isPending}
            data-testid="button-seed-defaults"
          >
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {t.leadScoring.seedDefaults}
          </Button>
        </div>
        <Button
          variant="secondary"
          onClick={handleRecalculateAll}
          disabled={isRecalculating}
          data-testid="button-recalculate-all"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
          {isRecalculating ? t.leadScoring.recalculatingAll : t.leadScoring.recalculateAll}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !criteria || criteria.length === 0 ? (
        <div className="text-center p-6 text-muted-foreground">
          {t.leadScoring.noCriteria}
        </div>
      ) : (
        <div className="space-y-3">
          {criteria.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/50 justify-between"
              data-testid={`criteria-item-${item.id}`}
            >
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                <Switch
                  checked={item.isActive}
                  onCheckedChange={(checked) => {
                    apiRequest("PATCH", `/api/lead-scoring-criteria/${item.id}`, { isActive: checked })
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring-criteria'] });
                      })
                      .catch(() => {
                        toast({ title: t.errors.saveFailed, variant: "destructive" });
                      });
                  }}
                  data-testid={`switch-criteria-${item.id}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {getFieldLabel(item.field)} {getConditionLabel(item.condition)} {item.value ? `"${item.value}"` : ''}
                  </p>
                </div>
                <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                <Badge variant={item.points > 0 ? "default" : "destructive"}>
                  {item.points > 0 ? '+' : ''}{item.points} {t.leadScoring.fields.points}
                </Badge>
                {item.countryCode && (
                  <Badge variant="secondary">{item.countryCode}</Badge>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleOpenEdit(item)}
                  data-testid={`button-edit-criteria-${item.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteId(item.id)}
                  data-testid={`button-delete-criteria-${item.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCriteria ? t.leadScoring.editCriteria : t.leadScoring.addCriteria}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.leadScoring.fields.name} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-criteria-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t.leadScoring.description}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-criteria-description"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.leadScoring.fields.category}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger data-testid="select-criteria-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SCORING_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {getCategoryLabel(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.leadScoring.fields.field}</Label>
                <Select
                  value={formData.field}
                  onValueChange={(v) => setFormData({ ...formData, field: v })}
                >
                  <SelectTrigger data-testid="select-criteria-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SCORING_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {getFieldLabel(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.leadScoring.fields.condition}</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(v) => setFormData({ ...formData, condition: v })}
                >
                  <SelectTrigger data-testid="select-criteria-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SCORING_CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {getConditionLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.leadScoring.fields.value}</Label>
                <Input
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={formData.condition === 'not_empty' ? '-' : ''}
                  disabled={formData.condition === 'not_empty'}
                  data-testid="input-criteria-value"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.leadScoring.fields.points}</Label>
                <Input
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  data-testid="input-criteria-points"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.leadScoring.fields.countryCode}</Label>
                <Select
                  value={formData.countryCode || "all"}
                  onValueChange={(v) => setFormData({ ...formData, countryCode: v === "all" ? null : v })}
                >
                  <SelectTrigger data-testid="select-criteria-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.common.allCountries}</SelectItem>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                id="isActive"
                data-testid="switch-criteria-active"
              />
              <Label htmlFor="isActive">{t.leadScoring.fields.isActive}</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-criteria">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t.common.save}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.leadScoring.deleteCriteria}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.leadScoring.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-criteria"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SipSettingsFormData {
  serverAddress: string;
  serverPort: number;
  wsPath: string;
  realm: string;
  transport: string;
  isEnabled: boolean;
}

const defaultSipSettings: SipSettingsFormData = {
  serverAddress: "",
  serverPort: 5060,
  wsPath: "/ws",
  realm: "",
  transport: "wss",
  isEnabled: false,
};

function SipSettingsTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<SipSettingsFormData>(defaultSipSettings);
  const [isSaving, setIsSaving] = useState(false);

  const { data: sipSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["/api/sip-settings"],
  });

  useEffect(() => {
    if (sipSettings) {
      setFormData({
        serverAddress: sipSettings.serverAddress || "",
        serverPort: sipSettings.serverPort || 5060,
        wsPath: sipSettings.wsPath || "/ws",
        realm: sipSettings.realm || "",
        transport: sipSettings.transport || "wss",
        isEnabled: sipSettings.isEnabled || false,
      });
    }
  }, [sipSettings]);

  const handleSave = async () => {
    if (!formData.serverAddress.trim()) {
      toast({ title: "Adresa servera je povinná", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/sip-settings", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/sip-settings"] });
      toast({ title: "SIP nastavenia boli uložené" });
    } catch (error: any) {
      toast({ 
        title: "Chyba pri ukladaní", 
        description: error.message || "Nepodarilo sa uložiť nastavenia",
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Nastavenia SIP servera</CardTitle>
            <CardDescription>
              Konfigurácia pripojenia k Asterisk PBX serveru pre VoIP hovory
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Switch
              id="sip-enabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
              disabled={!isAdmin}
              data-testid="switch-sip-enabled"
            />
            <Label htmlFor="sip-enabled">
              Povoliť SIP telefóniu
            </Label>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="server-address">Adresa servera</Label>
              <Input
                id="server-address"
                placeholder="pbx.example.com"
                value={formData.serverAddress}
                onChange={(e) => setFormData({ ...formData, serverAddress: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-sip-server-address"
              />
              <p className="text-xs text-muted-foreground">
                Doménové meno alebo IP adresa Asterisk servera
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-port">Port</Label>
              <Input
                id="server-port"
                type="number"
                placeholder="5060"
                value={formData.serverPort}
                onChange={(e) => setFormData({ ...formData, serverPort: parseInt(e.target.value) || 5060 })}
                disabled={!isAdmin}
                data-testid="input-sip-server-port"
              />
              <p className="text-xs text-muted-foreground">
                Predvolený port je 5060 pre SIP
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ws-path">WebSocket cesta</Label>
              <Input
                id="ws-path"
                placeholder="/ws"
                value={formData.wsPath}
                onChange={(e) => setFormData({ ...formData, wsPath: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-sip-ws-path"
              />
              <p className="text-xs text-muted-foreground">
                Cesta k WebSocket endpointu (napr. /ws)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="realm">Realm</Label>
              <Input
                id="realm"
                placeholder="asterisk"
                value={formData.realm}
                onChange={(e) => setFormData({ ...formData, realm: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-sip-realm"
              />
              <p className="text-xs text-muted-foreground">
                SIP realm pre autentifikáciu (zvyčajne názov servera)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport">Protokol</Label>
              <Select
                value={formData.transport}
                onValueChange={(value) => setFormData({ ...formData, transport: value })}
                disabled={!isAdmin}
              >
                <SelectTrigger id="transport" data-testid="select-sip-transport">
                  <SelectValue placeholder="Vyberte protokol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wss">WSS (WebSocket Secure)</SelectItem>
                  <SelectItem value="ws">WS (WebSocket)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Odporúčame WSS pre bezpečné pripojenie
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                data-testid="button-save-sip-settings"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ukladám...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Uložiť nastavenia
                  </>
                )}
              </Button>
            </div>
          )}

          {!isAdmin && (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                Len administrátori môžu meniť nastavenia SIP servera. 
                Kontaktujte administrátora pre zmeny konfigurácie.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ako to funguje</CardTitle>
          <CardDescription>
            Informácie o integrácii SIP telefónie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge>1</Badge>
              <div>
                <p className="font-medium text-sm">Globálne nastavenia</p>
                <p className="text-sm text-muted-foreground">
                  Administrátor nakonfiguruje adresu Asterisk servera a pripojenie
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge>2</Badge>
              <div>
                <p className="font-medium text-sm">Používateľské účty</p>
                <p className="text-sm text-muted-foreground">
                  Každému používateľovi sa priradí SIP linka (extension a heslo) v správe používateľov
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge>3</Badge>
              <div>
                <p className="font-medium text-sm">Volanie</p>
                <p className="text-sm text-muted-foreground">
                  Používatelia môžu telefonovať priamo z CRM pomocou vstavaného SIP telefónu
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge>4</Badge>
              <div>
                <p className="font-medium text-sm">Záznamy hovorov</p>
                <p className="text-sm text-muted-foreground">
                  Všetky hovory sa automaticky zaznamenávajú a prepájajú so zákazníkmi a kampaňami
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("billing");

  // Filter countries based on user's assigned countries
  const userCountries = useMemo(() => {
    if (!user?.assignedCountries || user.assignedCountries.length === 0) {
      return COUNTRIES; // Admins with no specific countries see all
    }
    return COUNTRIES.filter(c => user.assignedCountries.includes(c.code));
  }, [user?.assignedCountries]);

  // Get default country code for tabs
  const defaultCountryCode = userCountries[0]?.code || COUNTRIES[0].code;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.settings.title}
        description={t.settings.description}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="billing" data-testid="tab-billing">
            <Building2 className="h-4 w-4 mr-2" />
            {t.settings.tabs.billing}
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings2 className="h-4 w-4 mr-2" />
            {t.settings.tabs.config}
          </TabsTrigger>
          <TabsTrigger value="insurance" data-testid="tab-insurance">
            <Heart className="h-4 w-4 mr-2" />
            {t.settings.tabs.insurance}
          </TabsTrigger>
          <TabsTrigger value="laboratories" data-testid="tab-laboratories">
            <FlaskConical className="h-4 w-4 mr-2" />
            {t.settings.tabs.laboratories}
          </TabsTrigger>
          <TabsTrigger value="leadscoring" data-testid="tab-leadscoring">
            <Target className="h-4 w-4 mr-2" />
            {t.leadScoring.criteria}
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Shield className="h-4 w-4 mr-2" />
            {t.settings.tabs.system}
          </TabsTrigger>
          <TabsTrigger value="sip" data-testid="tab-sip">
            <Phone className="h-4 w-4 mr-2" />
            SIP telefónia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.billingDetails}</CardTitle>
              <CardDescription>
                {t.settings.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={defaultCountryCode}>
                <TabsList className="flex flex-wrap gap-1 h-auto">
                  {userCountries.map((country) => (
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
                {userCountries.map((country) => (
                  <TabsContent key={country.code} value={country.code} className="mt-6">
                    <div className="flex items-center gap-3 mb-6 p-4 rounded-lg bg-muted/50">
                      <Globe className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-medium">{country.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t.settings.billingConfigFor} {country.name}
                        </p>
                      </div>
                    </div>
                    <BillingCompaniesManager countryCode={country.code} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.complaintTypes}</CardTitle>
              <CardDescription>
                {t.settings.complaintTypesDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.complaintTypes}
                description={t.settings.complaintTypesDesc}
                apiPath="/api/config/complaint-types"
                queryKey="/api/config/complaint-types"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.settings.cooperationTypes}</CardTitle>
              <CardDescription>
                {t.settings.cooperationTypesDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.cooperationTypes}
                description={t.settings.cooperationTypesDesc}
                apiPath="/api/config/cooperation-types"
                queryKey="/api/config/cooperation-types"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.settings.vipStatuses}</CardTitle>
              <CardDescription>
                {t.settings.cooperationTypesDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.vipStatuses}
                description={t.settings.vipStatuses}
                apiPath="/api/config/vip-statuses"
                queryKey="/api/config/vip-statuses"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.healthInsurance}</CardTitle>
              <CardDescription>
                {t.settings.insuranceDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.healthInsurance}
                description={t.settings.insuranceDesc}
                apiPath="/api/config/health-insurance"
                queryKey="/api/config/health-insurance"
                showCode={true}
                requireCountry={true}
                countries={userCountries}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="laboratories" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.laboratories}</CardTitle>
              <CardDescription>
                {t.settings.laboratoriesDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.laboratories}
                description={t.settings.laboratoriesDesc}
                apiPath="/api/config/laboratories"
                queryKey="/api/config/laboratories"
                requireCountry={true}
                countries={userCountries}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leadscoring" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.leadScoring.criteria}</CardTitle>
              <CardDescription>
                {t.leadScoring.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadScoringCriteriaManager countries={userCountries} />
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
                  <CardTitle>{t.settings.aboutNexus}</CardTitle>
                  <CardDescription>{t.settings.crmDescription}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t.settings.version}</span>
                  <Badge variant="secondary">v1.0.0</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t.settings.environment}</span>
                  <Badge>{t.settings.production}</Badge>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  {t.settings.nexusDescription}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t.settings.supportedCountries}</CardTitle>
                  <CardDescription>{t.settings.regionsAvailable}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {userCountries.map((country) => (
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
                  <CardTitle>{t.settings.userRoles}</CardTitle>
                  <CardDescription>{t.settings.accessLevels}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge>{t.users.roles.admin}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.adminDescription}
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant="secondary">{t.users.roles.manager}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.managerDescription}
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant="outline">{t.users.roles.user}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.userDescription}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sip" className="mt-6">
          <SipSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
