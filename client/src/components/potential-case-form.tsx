import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { CASE_STATUSES, SALES_CHANNELS, INFO_SOURCES } from "@shared/schema";
import type { Customer, CustomerPotentialCase, Hospital, Product } from "@shared/schema";

interface PotentialCaseFormProps {
  customer: Customer;
  open: boolean;
  onClose: () => void;
}

interface EmbeddedPotentialCaseFormProps {
  customer: Customer;
}

interface FormData {
  customerId: string;
  caseStatus: string | null;
  expectedDateDay: number | null;
  expectedDateMonth: number | null;
  expectedDateYear: number | null;
  hospitalId: string | null;
  obstetricianId: string | null;
  isMultiplePregnancy: boolean;
  childCount: number | null;
  fatherTitleBefore: string | null;
  fatherFirstName: string | null;
  fatherLastName: string | null;
  fatherTitleAfter: string | null;
  fatherPhone: string | null;
  fatherMobile: string | null;
  fatherEmail: string | null;
  fatherStreet: string | null;
  fatherCity: string | null;
  fatherPostalCode: string | null;
  fatherRegion: string | null;
  fatherCountry: string | null;
  productId: string | null;
  productType: string | null;
  paymentType: string | null;
  giftVoucher: string | null;
  contactDateDay: number | null;
  contactDateMonth: number | null;
  contactDateYear: number | null;
  existingContracts: string | null;
  recruiting: string | null;
  salesChannel: string | null;
  infoSource: string | null;
  marketingAction: string | null;
  marketingCode: string | null;
  newsletterOptIn: boolean;
  notes: string | null;
}

const emptyFormData = (customerId: string): FormData => ({
  customerId,
  caseStatus: null,
  expectedDateDay: null,
  expectedDateMonth: null,
  expectedDateYear: null,
  hospitalId: null,
  obstetricianId: null,
  isMultiplePregnancy: false,
  childCount: 1,
  fatherTitleBefore: null,
  fatherFirstName: null,
  fatherLastName: null,
  fatherTitleAfter: null,
  fatherPhone: null,
  fatherMobile: null,
  fatherEmail: null,
  fatherStreet: null,
  fatherCity: null,
  fatherPostalCode: null,
  fatherRegion: null,
  fatherCountry: null,
  productId: null,
  productType: null,
  paymentType: null,
  giftVoucher: null,
  contactDateDay: null,
  contactDateMonth: null,
  contactDateYear: null,
  existingContracts: null,
  recruiting: null,
  salesChannel: null,
  infoSource: null,
  marketingAction: null,
  marketingCode: null,
  newsletterOptIn: false,
  notes: null,
});

function DateFields({
  label,
  dayValue,
  monthValue,
  yearValue,
  onSetAll,
  testIdPrefix,
  t,
}: {
  label: string;
  dayValue: number | null;
  monthValue: number | null;
  yearValue: number | null;
  onSetAll: (day: number | null, month: number | null, year: number | null) => void;
  testIdPrefix: string;
  t: any;
}) {
  const getDaysInMonth = (year?: number | null, month?: number | null) => {
    if (!year || !month) return 31;
    return new Date(year, month, 0).getDate();
  };
  
  const daysInMonth = getDaysInMonth(yearValue, monthValue);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i - 1);

  const handleTodayClick = () => {
    const today = new Date();
    onSetAll(today.getDate(), today.getMonth() + 1, today.getFullYear());
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleTodayClick}
          data-testid={`button-${testIdPrefix}-today`}
        >
          {t.common.today || "Today"}
        </Button>
      </div>
      <div className="flex gap-2">
        <Select
          value={dayValue?.toString() || "_none"}
          onValueChange={(v) => onSetAll(v === "_none" ? null : parseInt(v), monthValue, yearValue)}
        >
          <SelectTrigger className="w-20" data-testid={`select-${testIdPrefix}-day`}>
            <SelectValue placeholder={t.common.day || "Day"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">--</SelectItem>
            {days.map((d) => (
              <SelectItem key={d} value={d.toString()}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={monthValue?.toString() || "_none"}
          onValueChange={(v) => onSetAll(dayValue, v === "_none" ? null : parseInt(v), yearValue)}
        >
          <SelectTrigger className="w-24" data-testid={`select-${testIdPrefix}-month`}>
            <SelectValue placeholder={t.common.month || "Month"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">--</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m.toString()}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={yearValue?.toString() || "_none"}
          onValueChange={(v) => onSetAll(dayValue, monthValue, v === "_none" ? null : parseInt(v))}
        >
          <SelectTrigger className="w-24" data-testid={`select-${testIdPrefix}-year`}>
            <SelectValue placeholder={t.common.year || "Year"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">--</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function PotentialCaseForm({ customer, open, onClose }: PotentialCaseFormProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("status");
  const [formData, setFormData] = useState<FormData>(emptyFormData(customer.id));

  const { data: existingCase, isLoading } = useQuery<CustomerPotentialCase | null>({
    queryKey: ["/api/customers", customer.id, "potential-case"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/potential-case`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch potential case");
      return res.json();
    },
    enabled: open,
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredHospitals = customer.country
    ? hospitals.filter((h) => h.countryCode === customer.country)
    : hospitals;

  const filteredProducts = customer.country
    ? products.filter((p) => !p.countries?.length || p.countries.includes(customer.country))
    : products;

  useEffect(() => {
    if (existingCase) {
      setFormData({
        customerId: customer.id,
        caseStatus: existingCase.caseStatus,
        expectedDateDay: existingCase.expectedDateDay,
        expectedDateMonth: existingCase.expectedDateMonth,
        expectedDateYear: existingCase.expectedDateYear,
        hospitalId: existingCase.hospitalId,
        obstetricianId: existingCase.obstetricianId,
        isMultiplePregnancy: existingCase.isMultiplePregnancy,
        childCount: existingCase.childCount,
        fatherTitleBefore: existingCase.fatherTitleBefore,
        fatherFirstName: existingCase.fatherFirstName,
        fatherLastName: existingCase.fatherLastName,
        fatherTitleAfter: existingCase.fatherTitleAfter,
        fatherPhone: existingCase.fatherPhone,
        fatherMobile: existingCase.fatherMobile,
        fatherEmail: existingCase.fatherEmail,
        fatherStreet: existingCase.fatherStreet,
        fatherCity: existingCase.fatherCity,
        fatherPostalCode: existingCase.fatherPostalCode,
        fatherRegion: existingCase.fatherRegion,
        fatherCountry: existingCase.fatherCountry,
        productId: existingCase.productId,
        productType: existingCase.productType,
        paymentType: existingCase.paymentType,
        giftVoucher: existingCase.giftVoucher,
        contactDateDay: existingCase.contactDateDay,
        contactDateMonth: existingCase.contactDateMonth,
        contactDateYear: existingCase.contactDateYear,
        existingContracts: existingCase.existingContracts,
        recruiting: existingCase.recruiting,
        salesChannel: existingCase.salesChannel,
        infoSource: existingCase.infoSource,
        marketingAction: existingCase.marketingAction,
        marketingCode: existingCase.marketingCode,
        newsletterOptIn: existingCase.newsletterOptIn,
        notes: existingCase.notes,
      });
    } else {
      setFormData(emptyFormData(customer.id));
    }
  }, [existingCase, customer.id]);

  const saveMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("POST", `/api/customers/${customer.id}/potential-case`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "potential-case"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: t.success.saved });
      onClose();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    saveMutation.mutate(formData);
  };

  const pc = t.potentialCase;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-potential-case-title">{pc.title}</DialogTitle>
          <DialogDescription>
            {customer.firstName} {customer.lastName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="status" data-testid="tab-status">{pc.tabs.status}</TabsTrigger>
                <TabsTrigger value="collection" data-testid="tab-collection">{pc.tabs.collection}</TabsTrigger>
                <TabsTrigger value="father" data-testid="tab-father">{pc.tabs.father}</TabsTrigger>
                <TabsTrigger value="product" data-testid="tab-product">{pc.tabs.product}</TabsTrigger>
                <TabsTrigger value="other" data-testid="tab-other">{pc.tabs.other}</TabsTrigger>
              </TabsList>

              <TabsContent value="status" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{pc.fields.caseStatus}</Label>
                  <Select
                    value={formData.caseStatus || "_none"}
                    onValueChange={(v) => setFormData({ ...formData, caseStatus: v === "_none" ? null : v })}
                  >
                    <SelectTrigger data-testid="select-case-status">
                      <SelectValue placeholder={pc.fields.caseStatus} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">--</SelectItem>
                      {CASE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {pc.statuses[status as keyof typeof pc.statuses] || status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="collection" className="space-y-4 pt-4">
                <DateFields
                  label={pc.fields.expectedDate}
                  dayValue={formData.expectedDateDay}
                  monthValue={formData.expectedDateMonth}
                  yearValue={formData.expectedDateYear}
                  onSetAll={(d, m, y) => setFormData({
                    ...formData,
                    expectedDateDay: d,
                    expectedDateMonth: m,
                    expectedDateYear: y,
                  })}
                  testIdPrefix="expected-date"
                  t={t}
                />

                <div className="space-y-2">
                  <Label>{pc.fields.hospital}</Label>
                  <Select
                    value={formData.hospitalId || "_none"}
                    onValueChange={(v) => setFormData({ ...formData, hospitalId: v === "_none" ? null : v })}
                  >
                    <SelectTrigger data-testid="select-hospital">
                      <SelectValue placeholder={pc.fields.hospital} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">--</SelectItem>
                      {filteredHospitals.map((hospital) => (
                        <SelectItem key={hospital.id} value={hospital.id}>
                          {hospital.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{pc.fields.obstetrician}</Label>
                  <Input
                    value={formData.obstetricianId || ""}
                    onChange={(e) => setFormData({ ...formData, obstetricianId: e.target.value || null })}
                    placeholder={pc.fields.obstetrician}
                    data-testid="input-obstetrician"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.isMultiplePregnancy}
                      onCheckedChange={(checked) => setFormData({ ...formData, isMultiplePregnancy: checked })}
                      data-testid="switch-multiple-pregnancy"
                    />
                    <Label>{pc.fields.multiplePregnancy}</Label>
                  </div>
                </div>

                {formData.isMultiplePregnancy && (
                  <div className="space-y-2">
                    <Label>{pc.fields.childCount}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={formData.childCount || 1}
                      onChange={(e) => setFormData({ ...formData, childCount: parseInt(e.target.value) || 1 })}
                      data-testid="input-child-count"
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="father" className="space-y-4 pt-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherTitleBefore}</Label>
                    <Input
                      value={formData.fatherTitleBefore || ""}
                      onChange={(e) => setFormData({ ...formData, fatherTitleBefore: e.target.value || null })}
                      data-testid="input-father-title-before"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherFirstName}</Label>
                    <Input
                      value={formData.fatherFirstName || ""}
                      onChange={(e) => setFormData({ ...formData, fatherFirstName: e.target.value || null })}
                      data-testid="input-father-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherLastName}</Label>
                    <Input
                      value={formData.fatherLastName || ""}
                      onChange={(e) => setFormData({ ...formData, fatherLastName: e.target.value || null })}
                      data-testid="input-father-last-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherTitleAfter}</Label>
                    <Input
                      value={formData.fatherTitleAfter || ""}
                      onChange={(e) => setFormData({ ...formData, fatherTitleAfter: e.target.value || null })}
                      data-testid="input-father-title-after"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherPhone}</Label>
                    <Input
                      value={formData.fatherPhone || ""}
                      onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value || null })}
                      data-testid="input-father-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherMobile}</Label>
                    <Input
                      value={formData.fatherMobile || ""}
                      onChange={(e) => setFormData({ ...formData, fatherMobile: e.target.value || null })}
                      data-testid="input-father-mobile"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{pc.fields.fatherEmail}</Label>
                  <Input
                    type="email"
                    value={formData.fatherEmail || ""}
                    onChange={(e) => setFormData({ ...formData, fatherEmail: e.target.value || null })}
                    data-testid="input-father-email"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherStreet}</Label>
                    <Input
                      value={formData.fatherStreet || ""}
                      onChange={(e) => setFormData({ ...formData, fatherStreet: e.target.value || null })}
                      data-testid="input-father-street"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherCity}</Label>
                    <Input
                      value={formData.fatherCity || ""}
                      onChange={(e) => setFormData({ ...formData, fatherCity: e.target.value || null })}
                      data-testid="input-father-city"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherPostalCode}</Label>
                    <Input
                      value={formData.fatherPostalCode || ""}
                      onChange={(e) => setFormData({ ...formData, fatherPostalCode: e.target.value || null })}
                      data-testid="input-father-postal-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherRegion}</Label>
                    <Input
                      value={formData.fatherRegion || ""}
                      onChange={(e) => setFormData({ ...formData, fatherRegion: e.target.value || null })}
                      data-testid="input-father-region"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.fatherCountry}</Label>
                    <Input
                      value={formData.fatherCountry || ""}
                      onChange={(e) => setFormData({ ...formData, fatherCountry: e.target.value || null })}
                      data-testid="input-father-country"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="product" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{pc.fields.product}</Label>
                  <Select
                    value={formData.productId || "_none"}
                    onValueChange={(v) => setFormData({ ...formData, productId: v === "_none" ? null : v })}
                  >
                    <SelectTrigger data-testid="select-product">
                      <SelectValue placeholder={pc.fields.product} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">--</SelectItem>
                      {filteredProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{pc.fields.productType}</Label>
                    <Input
                      value={formData.productType || ""}
                      onChange={(e) => setFormData({ ...formData, productType: e.target.value || null })}
                      data-testid="input-product-type"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.paymentType}</Label>
                    <Input
                      value={formData.paymentType || ""}
                      onChange={(e) => setFormData({ ...formData, paymentType: e.target.value || null })}
                      data-testid="input-payment-type"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{pc.fields.giftVoucher}</Label>
                  <Input
                    value={formData.giftVoucher || ""}
                    onChange={(e) => setFormData({ ...formData, giftVoucher: e.target.value || null })}
                    data-testid="input-gift-voucher"
                  />
                </div>

                <DateFields
                  label={pc.fields.contactDate}
                  dayValue={formData.contactDateDay}
                  monthValue={formData.contactDateMonth}
                  yearValue={formData.contactDateYear}
                  onSetAll={(d, m, y) => setFormData({
                    ...formData,
                    contactDateDay: d,
                    contactDateMonth: m,
                    contactDateYear: y,
                  })}
                  testIdPrefix="contact-date"
                  t={t}
                />

                <div className="space-y-2">
                  <Label>{pc.fields.existingContracts}</Label>
                  <Textarea
                    value={formData.existingContracts || ""}
                    onChange={(e) => setFormData({ ...formData, existingContracts: e.target.value || null })}
                    data-testid="textarea-existing-contracts"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{pc.fields.recruiting}</Label>
                  <Input
                    value={formData.recruiting || ""}
                    onChange={(e) => setFormData({ ...formData, recruiting: e.target.value || null })}
                    data-testid="input-recruiting"
                  />
                </div>
              </TabsContent>

              <TabsContent value="other" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{pc.fields.salesChannel}</Label>
                  <Select
                    value={formData.salesChannel || "_none"}
                    onValueChange={(v) => setFormData({ ...formData, salesChannel: v === "_none" ? null : v })}
                  >
                    <SelectTrigger data-testid="select-sales-channel">
                      <SelectValue placeholder={pc.fields.salesChannel} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">--</SelectItem>
                      {SALES_CHANNELS.map((channel) => (
                        <SelectItem key={channel} value={channel}>
                          {channel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{pc.fields.infoSource}</Label>
                  <Select
                    value={formData.infoSource || "_none"}
                    onValueChange={(v) => setFormData({ ...formData, infoSource: v === "_none" ? null : v })}
                  >
                    <SelectTrigger data-testid="select-info-source">
                      <SelectValue placeholder={pc.fields.infoSource} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">--</SelectItem>
                      {INFO_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {pc.infoSources[source as keyof typeof pc.infoSources] || source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{pc.fields.marketingAction}</Label>
                    <Input
                      value={formData.marketingAction || ""}
                      onChange={(e) => setFormData({ ...formData, marketingAction: e.target.value || null })}
                      data-testid="input-marketing-action"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{pc.fields.marketingCode}</Label>
                    <Input
                      value={formData.marketingCode || ""}
                      onChange={(e) => setFormData({ ...formData, marketingCode: e.target.value || null })}
                      data-testid="input-marketing-code"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.newsletterOptIn}
                    onCheckedChange={(checked) => setFormData({ ...formData, newsletterOptIn: checked })}
                    data-testid="switch-newsletter-opt-in"
                  />
                  <Label>{pc.fields.newsletterOptIn}</Label>
                </div>

                <div className="space-y-2">
                  <Label>{pc.fields.notes}</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                    rows={4}
                    data-testid="textarea-notes"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose} data-testid="button-cancel">
                {t.common.cancel}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.common.save}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Embedded version of PotentialCaseForm for inline use (without Dialog wrapper)
export function EmbeddedPotentialCaseForm({ customer }: EmbeddedPotentialCaseFormProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("status");
  const [formData, setFormData] = useState<FormData>(emptyFormData(customer.id));

  const { data: existingCase, isLoading } = useQuery<CustomerPotentialCase | null>({
    queryKey: ["/api/customers", customer.id, "potential-case"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/potential-case`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch potential case");
      return res.json();
    },
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredHospitals = customer.country
    ? hospitals.filter((h) => h.countryCode === customer.country)
    : hospitals;

  const filteredProducts = customer.country
    ? products.filter((p) => !p.countries?.length || p.countries.includes(customer.country))
    : products;

  useEffect(() => {
    if (existingCase) {
      setFormData({
        customerId: customer.id,
        caseStatus: existingCase.caseStatus,
        expectedDateDay: existingCase.expectedDateDay,
        expectedDateMonth: existingCase.expectedDateMonth,
        expectedDateYear: existingCase.expectedDateYear,
        hospitalId: existingCase.hospitalId,
        obstetricianId: existingCase.obstetricianId,
        isMultiplePregnancy: existingCase.isMultiplePregnancy,
        childCount: existingCase.childCount,
        fatherTitleBefore: existingCase.fatherTitleBefore,
        fatherFirstName: existingCase.fatherFirstName,
        fatherLastName: existingCase.fatherLastName,
        fatherTitleAfter: existingCase.fatherTitleAfter,
        fatherPhone: existingCase.fatherPhone,
        fatherMobile: existingCase.fatherMobile,
        fatherEmail: existingCase.fatherEmail,
        fatherStreet: existingCase.fatherStreet,
        fatherCity: existingCase.fatherCity,
        fatherPostalCode: existingCase.fatherPostalCode,
        fatherRegion: existingCase.fatherRegion,
        fatherCountry: existingCase.fatherCountry,
        productId: existingCase.productId,
        productType: existingCase.productType,
        paymentType: existingCase.paymentType,
        giftVoucher: existingCase.giftVoucher,
        contactDateDay: existingCase.contactDateDay,
        contactDateMonth: existingCase.contactDateMonth,
        contactDateYear: existingCase.contactDateYear,
        existingContracts: existingCase.existingContracts,
        recruiting: existingCase.recruiting,
        salesChannel: existingCase.salesChannel,
        infoSource: existingCase.infoSource,
        marketingAction: existingCase.marketingAction,
        marketingCode: existingCase.marketingCode,
        newsletterOptIn: existingCase.newsletterOptIn,
        notes: existingCase.notes,
      });
    } else {
      setFormData(emptyFormData(customer.id));
    }
  }, [existingCase, customer.id]);

  const saveMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("POST", `/api/customers/${customer.id}/potential-case`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "potential-case"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    saveMutation.mutate(formData);
  };

  const pc = t.potentialCase;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="status" data-testid="tab-embedded-status">{pc.tabs.status}</TabsTrigger>
          <TabsTrigger value="collection" data-testid="tab-embedded-collection">{pc.tabs.collection}</TabsTrigger>
          <TabsTrigger value="father" data-testid="tab-embedded-father">{pc.tabs.father}</TabsTrigger>
          <TabsTrigger value="product" data-testid="tab-embedded-product">{pc.tabs.product}</TabsTrigger>
          <TabsTrigger value="other" data-testid="tab-embedded-other">{pc.tabs.other}</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>{pc.fields.caseStatus}</Label>
            <Select
              value={formData.caseStatus || "_none"}
              onValueChange={(v) => setFormData({ ...formData, caseStatus: v === "_none" ? null : v })}
            >
              <SelectTrigger data-testid="select-embedded-case-status">
                <SelectValue placeholder={t.common.select} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">--</SelectItem>
                {CASE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {pc.statuses[status as keyof typeof pc.statuses] || status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="collection" className="space-y-4 pt-4">
          <DateFields
            label={pc.fields.expectedDate}
            dayValue={formData.expectedDateDay}
            monthValue={formData.expectedDateMonth}
            yearValue={formData.expectedDateYear}
            onSetAll={(day, month, year) =>
              setFormData({ ...formData, expectedDateDay: day, expectedDateMonth: month, expectedDateYear: year })
            }
            testIdPrefix="embedded-expected-date"
            t={t}
          />

          <div className="space-y-2">
            <Label>{pc.fields.hospital}</Label>
            <Select
              value={formData.hospitalId || "_none"}
              onValueChange={(v) => setFormData({ ...formData, hospitalId: v === "_none" ? null : v })}
            >
              <SelectTrigger data-testid="select-embedded-hospital">
                <SelectValue placeholder={t.common.select} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">--</SelectItem>
                {filteredHospitals.map((hospital) => (
                  <SelectItem key={hospital.id} value={hospital.id}>
                    {hospital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.isMultiplePregnancy}
              onCheckedChange={(checked) => setFormData({ ...formData, isMultiplePregnancy: checked })}
              data-testid="switch-embedded-multiple-pregnancy"
            />
            <Label>{pc.fields.multiplePregnancy}</Label>
          </div>

          <div className="space-y-2">
            <Label>{pc.fields.childCount}</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={formData.childCount || 1}
              onChange={(e) => setFormData({ ...formData, childCount: parseInt(e.target.value) || 1 })}
              data-testid="input-embedded-child-count"
            />
          </div>
        </TabsContent>

        <TabsContent value="father" className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{pc.fields.fatherTitleBefore}</Label>
              <Input
                value={formData.fatherTitleBefore || ""}
                onChange={(e) => setFormData({ ...formData, fatherTitleBefore: e.target.value || null })}
                data-testid="input-embedded-father-title-before"
              />
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.fatherFirstName}</Label>
              <Input
                value={formData.fatherFirstName || ""}
                onChange={(e) => setFormData({ ...formData, fatherFirstName: e.target.value || null })}
                data-testid="input-embedded-father-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.fatherLastName}</Label>
              <Input
                value={formData.fatherLastName || ""}
                onChange={(e) => setFormData({ ...formData, fatherLastName: e.target.value || null })}
                data-testid="input-embedded-father-last-name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{pc.fields.fatherPhone}</Label>
              <Input
                value={formData.fatherPhone || ""}
                onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value || null })}
                data-testid="input-embedded-father-phone"
              />
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.fatherMobile}</Label>
              <Input
                value={formData.fatherMobile || ""}
                onChange={(e) => setFormData({ ...formData, fatherMobile: e.target.value || null })}
                data-testid="input-embedded-father-mobile"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{pc.fields.fatherEmail}</Label>
            <Input
              type="email"
              value={formData.fatherEmail || ""}
              onChange={(e) => setFormData({ ...formData, fatherEmail: e.target.value || null })}
              data-testid="input-embedded-father-email"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{pc.fields.fatherStreet}</Label>
              <Input
                value={formData.fatherStreet || ""}
                onChange={(e) => setFormData({ ...formData, fatherStreet: e.target.value || null })}
                data-testid="input-embedded-father-street"
              />
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.fatherCity}</Label>
              <Input
                value={formData.fatherCity || ""}
                onChange={(e) => setFormData({ ...formData, fatherCity: e.target.value || null })}
                data-testid="input-embedded-father-city"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{pc.fields.fatherPostalCode}</Label>
              <Input
                value={formData.fatherPostalCode || ""}
                onChange={(e) => setFormData({ ...formData, fatherPostalCode: e.target.value || null })}
                data-testid="input-embedded-father-postal-code"
              />
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.fatherCountry}</Label>
              <Input
                value={formData.fatherCountry || ""}
                onChange={(e) => setFormData({ ...formData, fatherCountry: e.target.value || null })}
                data-testid="input-embedded-father-country"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="product" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>{pc.fields.product}</Label>
            <Select
              value={formData.productId || "_none"}
              onValueChange={(v) => setFormData({ ...formData, productId: v === "_none" ? null : v })}
            >
              <SelectTrigger data-testid="select-embedded-product">
                <SelectValue placeholder={t.common.select} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">--</SelectItem>
                {filteredProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{pc.fields.productType}</Label>
              <Input
                value={formData.productType || ""}
                onChange={(e) => setFormData({ ...formData, productType: e.target.value || null })}
                data-testid="input-embedded-product-type"
              />
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.paymentType}</Label>
              <Input
                value={formData.paymentType || ""}
                onChange={(e) => setFormData({ ...formData, paymentType: e.target.value || null })}
                data-testid="input-embedded-payment-type"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{pc.fields.giftVoucher}</Label>
            <Input
              value={formData.giftVoucher || ""}
              onChange={(e) => setFormData({ ...formData, giftVoucher: e.target.value || null })}
              data-testid="input-embedded-gift-voucher"
            />
          </div>

          <DateFields
            label={pc.fields.contactDate}
            dayValue={formData.contactDateDay}
            monthValue={formData.contactDateMonth}
            yearValue={formData.contactDateYear}
            onSetAll={(day, month, year) =>
              setFormData({ ...formData, contactDateDay: day, contactDateMonth: month, contactDateYear: year })
            }
            testIdPrefix="embedded-contact-date"
            t={t}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{pc.fields.existingContracts}</Label>
              <Input
                value={formData.existingContracts || ""}
                onChange={(e) => setFormData({ ...formData, existingContracts: e.target.value || null })}
                data-testid="input-embedded-existing-contracts"
              />
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.recruiting}</Label>
              <Input
                value={formData.recruiting || ""}
                onChange={(e) => setFormData({ ...formData, recruiting: e.target.value || null })}
                data-testid="input-embedded-recruiting"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="other" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{pc.fields.salesChannel}</Label>
              <Select
                value={formData.salesChannel || "_none"}
                onValueChange={(v) => setFormData({ ...formData, salesChannel: v === "_none" ? null : v })}
              >
                <SelectTrigger data-testid="select-embedded-sales-channel">
                  <SelectValue placeholder={t.common.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">--</SelectItem>
                  {SALES_CHANNELS.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.infoSource}</Label>
              <Select
                value={formData.infoSource || "_none"}
                onValueChange={(v) => setFormData({ ...formData, infoSource: v === "_none" ? null : v })}
              >
                <SelectTrigger data-testid="select-embedded-info-source">
                  <SelectValue placeholder={t.common.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">--</SelectItem>
                  {INFO_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {pc.infoSources?.[source as keyof typeof pc.infoSources] || source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{pc.fields.marketingAction}</Label>
              <Input
                value={formData.marketingAction || ""}
                onChange={(e) => setFormData({ ...formData, marketingAction: e.target.value || null })}
                data-testid="input-embedded-marketing-action"
              />
            </div>
            <div className="space-y-2">
              <Label>{pc.fields.marketingCode}</Label>
              <Input
                value={formData.marketingCode || ""}
                onChange={(e) => setFormData({ ...formData, marketingCode: e.target.value || null })}
                data-testid="input-embedded-marketing-code"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.newsletterOptIn}
              onCheckedChange={(checked) => setFormData({ ...formData, newsletterOptIn: checked })}
              data-testid="switch-embedded-newsletter-opt-in"
            />
            <Label>{pc.fields.newsletterOptIn}</Label>
          </div>

          <div className="space-y-2">
            <Label>{pc.fields.notes}</Label>
            <Textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
              rows={4}
              data-testid="textarea-embedded-notes"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleSubmit}
          disabled={saveMutation.isPending}
          data-testid="button-embedded-save"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t.common.save}
        </Button>
      </div>
    </div>
  );
}
