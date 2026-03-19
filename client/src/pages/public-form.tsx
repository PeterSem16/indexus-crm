import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertCircle, Send, Shield, Baby } from "lucide-react";

interface FormConfig {
  form: any;
  healthInsuranceCompanies: any[];
  hospitals: any[];
  productSets: any[];
}

type Step = "form" | "otp_check" | "otp_verify" | "submitting" | "success" | "error";

const HOW_DID_YOU_HEAR_OPTIONS = [
  "Informácia od gynekológa", "Informácia od pediatra", "Informácia od iného lekára",
  "Informácia od zdravotnej sestry", "Informácia od známeho", "Časopis / Noviny",
  "Infolinka", "Internet", "Naša bezplatná prednáška", "Plagát / Leták v čakárni",
  "Rádio", "TV", "V pôrodnici", "Iné média",
];

const PAYMENT_OPTIONS = [
  { value: "bank_transfer", label: "Bankovým prevodom" },
  { value: "invoice", label: "Na faktúru" },
  { value: "installments", label: "Na splátky" },
];

export default function PublicFormPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("form");
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [pregnancyAccepted, setPregnancyAccepted] = useState(false);
  const [newsletterAccepted, setNewsletterAccepted] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/web-form/${slug}`)
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(data => { setConfig(data); setLoading(false); })
      .catch(() => { setConfig(null); setLoading(false); });
  }, [slug]);

  const fields = useMemo(() => {
    if (!config?.form?.fields) return [];
    return [...config.form.fields].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [config]);

  const sections = useMemo(() => {
    if (!config?.form?.sections) return [];
    return [...config.form.sections].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [config]);

  const updateField = (key: string, value: any) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const e = { ...prev }; delete e[key]; return e; });
  };

  const checkExistingCustomer = async (): Promise<boolean> => {
    const firstName = formValues.firstName;
    const lastName = formValues.lastName;
    const email = formValues.email;
    if (!firstName || !lastName || !email) return false;

    try {
      const res = await fetch(`/api/public/web-form/${slug}/check-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });
      const data = await res.json();
      if (data.found) {
        setOtpEmail(email);
        setStep("otp_check");
        return true;
      }
    } catch {}
    return false;
  };

  const sendOtp = async () => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch(`/api/public/web-form/${slug}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      if (!res.ok) throw new Error("Failed to send OTP");
      setStep("otp_verify");
    } catch {
      setOtpError("Nepodarilo sa odoslať kód. Skúste znova.");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch(`/api/public/web-form/${slug}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setOtpError(data.error === "Code expired" ? "Kód expiroval. Vyžiadajte nový." : "Neplatný kód. Skúste znova.");
        return;
      }
      setIsOtpVerified(true);
      if (data.verificationToken) setVerificationToken(data.verificationToken);
      if (data.customerId) setExistingCustomerId(data.customerId);
      if (data.customerData) {
        setFormValues(prev => {
          const updated = { ...prev };
          Object.entries(data.customerData).forEach(([key, val]) => {
            if (val && !updated[key]) updated[key] = val;
          });
          return updated;
        });
      }
      setStep("form");
    } catch {
      setOtpError("Chyba overenia. Skúste znova.");
    } finally {
      setOtpLoading(false);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const field of fields) {
      if (field.isRequired && !formValues[field.customerField]) {
        errs[field.customerField] = "Povinné pole";
      }
    }
    if (!gdprAccepted) errs.gdpr = "Musíte súhlasiť so spracovaním údajov";
    if (config?.form?.gdprPregnancyText && !pregnancyAccepted) errs.pregnancy = "Povinné potvrdenie";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (!existingCustomerId && !isOtpVerified) {
      const found = await checkExistingCustomer();
      if (found) return;
    }

    setStep("submitting");
    setSubmitError("");
    try {
      const res = await fetch(`/api/public/web-form/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: { ...formValues, newsletter: newsletterAccepted },
          customerId: existingCustomerId,
          verificationToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setStep("success");
    } catch (e: any) {
      setSubmitError(e.message);
      setStep("error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-600">Formulár nebol nájdený</h2>
          <p className="text-gray-400 mt-2">Tento formulár neexistuje alebo bol deaktivovaný.</p>
        </div>
      </div>
    );
  }

  const brandColor = config.form.brandColor || "#16a34a";

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" data-testid="text-form-success">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: brandColor + "15" }}>
            <CheckCircle2 className="h-10 w-10" style={{ color: brandColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: brandColor }}>Ďakujeme!</h2>
          <p className="text-gray-600">{config.form.successMessage || "Vaša žiadosť bola úspešne odoslaná. Budeme vás kontaktovať."}</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl shadow-lg">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold mb-3 text-red-600">Chyba pri odoslaní</h2>
          <p className="text-gray-600 mb-4">{submitError || "Nastala chyba. Skúste to prosím znova."}</p>
          <Button onClick={() => setStep("form")} style={{ backgroundColor: brandColor }}>Skúsiť znova</Button>
        </div>
      </div>
    );
  }

  if (step === "otp_check") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <Shield className="h-12 w-12 mx-auto mb-3" style={{ color: brandColor }} />
            <h2 className="text-xl font-bold">Overenie existujúceho klienta</h2>
            <p className="text-sm text-gray-500 mt-2">Našli sme existujúci záznam. Pre overenie vašej identity vám zašleme kód na email <strong>{otpEmail}</strong>.</p>
          </div>
          <div className="space-y-3">
            <Button className="w-full" style={{ backgroundColor: brandColor }} onClick={sendOtp} disabled={otpLoading} data-testid="btn-send-otp">
              {otpLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Zaslať overovací kód
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { setExistingCustomerId(null); setStep("form"); }} data-testid="btn-continue-new">
              Pokračovať ako nový klient
            </Button>
            {otpError && <p className="text-sm text-red-500 text-center">{otpError}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (step === "otp_verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <Shield className="h-12 w-12 mx-auto mb-3" style={{ color: brandColor }} />
            <h2 className="text-xl font-bold">Zadajte overovací kód</h2>
            <p className="text-sm text-gray-500 mt-2">Kód bol zaslaný na <strong>{otpEmail}</strong>. Platnosť: 10 minút.</p>
          </div>
          <div className="space-y-4">
            <Input
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.5em] h-14 font-mono"
              maxLength={6}
              data-testid="input-otp-code"
            />
            <Button className="w-full" style={{ backgroundColor: brandColor }} onClick={verifyOtp} disabled={otpCode.length !== 6 || otpLoading} data-testid="btn-verify-otp">
              {otpLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Overiť
            </Button>
            <div className="flex justify-between">
              <Button variant="link" className="text-xs" onClick={sendOtp} disabled={otpLoading}>Znova zaslať kód</Button>
              <Button variant="link" className="text-xs" onClick={() => { setExistingCustomerId(null); setStep("form"); }}>Pokračovať ako nový klient</Button>
            </div>
            {otpError && <p className="text-sm text-red-500 text-center">{otpError}</p>}
          </div>
        </div>
      </div>
    );
  }

  const renderField = (field: any) => {
    const val = formValues[field.customerField] || "";
    const err = errors[field.customerField];

    if (field.fieldType === "select_insurance") {
      return (
        <div key={field.customerField} className="space-y-1">
          <Label className="text-sm font-medium">{field.label}{field.isRequired && <span className="text-red-500 ml-1">*</span>}</Label>
          <Select value={val} onValueChange={v => updateField(field.customerField, v)}>
            <SelectTrigger className={err ? "border-red-400" : ""} data-testid={`select-${field.customerField}`}>
              <SelectValue placeholder="Vyberte..." />
            </SelectTrigger>
            <SelectContent>
              {config.healthInsuranceCompanies.map((hic: any) => (
                <SelectItem key={hic.id} value={hic.id}>{hic.code} - {hic.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      );
    }

    if (field.fieldType === "select_hospital") {
      return (
        <div key={field.customerField} className="space-y-1">
          <Label className="text-sm font-medium">{field.label}{field.isRequired && <span className="text-red-500 ml-1">*</span>}</Label>
          <Select value={val} onValueChange={v => updateField(field.customerField, v)}>
            <SelectTrigger className={err ? "border-red-400" : ""} data-testid={`select-${field.customerField}`}>
              <SelectValue placeholder="Vyberte nemocnicu..." />
            </SelectTrigger>
            <SelectContent>
              {config.hospitals.map((h: any) => (
                <SelectItem key={h.id} value={h.id}>{h.name}{h.city ? ` - ${h.city}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      );
    }

    if (field.fieldType === "select_product") {
      return (
        <div key={field.customerField} className="space-y-1">
          <Label className="text-sm font-medium">{field.label}{field.isRequired && <span className="text-red-500 ml-1">*</span>}</Label>
          <Select value={val} onValueChange={v => updateField(field.customerField, v)}>
            <SelectTrigger className={err ? "border-red-400" : ""} data-testid={`select-${field.customerField}`}>
              <SelectValue placeholder="Vyberte typ odberu..." />
            </SelectTrigger>
            <SelectContent>
              {config.productSets.map((ps: any) => (
                <SelectItem key={ps.id} value={ps.id}>
                  {ps.name}{ps.totalGrossAmount ? ` (${Number(ps.totalGrossAmount).toLocaleString("sk")} ${ps.currency || "EUR"})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      );
    }

    if (field.fieldType === "select_source") {
      return (
        <div key={field.customerField} className="space-y-1">
          <Label className="text-sm font-medium">{field.label}{field.isRequired && <span className="text-red-500 ml-1">*</span>}</Label>
          <Select value={val} onValueChange={v => updateField(field.customerField, v)}>
            <SelectTrigger className={err ? "border-red-400" : ""} data-testid={`select-${field.customerField}`}>
              <SelectValue placeholder="Vyberte..." />
            </SelectTrigger>
            <SelectContent>
              {HOW_DID_YOU_HEAR_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      );
    }

    if (field.fieldType === "select_payment") {
      return (
        <div key={field.customerField} className="space-y-1">
          <Label className="text-sm font-medium">{field.label}{field.isRequired && <span className="text-red-500 ml-1">*</span>}</Label>
          <Select value={val} onValueChange={v => updateField(field.customerField, v)}>
            <SelectTrigger className={err ? "border-red-400" : ""} data-testid={`select-${field.customerField}`}>
              <SelectValue placeholder="Vyberte..." />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      );
    }

    if (field.fieldType === "checkbox") {
      return (
        <div key={field.customerField} className="flex items-center gap-2">
          <Checkbox
            checked={!!formValues[field.customerField]}
            onCheckedChange={checked => updateField(field.customerField, checked)}
            data-testid={`checkbox-${field.customerField}`}
          />
          <Label className="text-sm">{field.label}</Label>
        </div>
      );
    }

    return (
      <div key={field.customerField} className="space-y-1">
        <Label className="text-sm font-medium">{field.label}{field.isRequired && <span className="text-red-500 ml-1">*</span>}</Label>
        <Input
          type={field.fieldType === "date" ? "date" : field.fieldType === "email" ? "email" : field.fieldType === "tel" ? "tel" : "text"}
          value={val}
          onChange={e => updateField(field.customerField, e.target.value)}
          className={err ? "border-red-400" : ""}
          data-testid={`input-${field.customerField}`}
        />
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
    );
  };

  const groupedFields = useMemo(() => {
    if (sections.length === 0) return [{ title: null, fields }];
    const groups: Array<{ title: string | null; fields: any[] }> = [];
    const fieldsBySection: Map<string, any[]> = new Map();
    const noSection: any[] = [];

    for (const field of fields) {
      if (field.sectionId) {
        const existing = fieldsBySection.get(field.sectionId) || [];
        existing.push(field);
        fieldsBySection.set(field.sectionId, existing);
      } else {
        const secIdx = field._sectionIndex ?? null;
        if (secIdx !== null && sections[secIdx]) {
          const secId = sections[secIdx].id;
          const existing = fieldsBySection.get(secId) || [];
          existing.push(field);
          fieldsBySection.set(secId, existing);
        } else {
          noSection.push(field);
        }
      }
    }

    for (const sec of sections) {
      const sectionFields = fieldsBySection.get(sec.id) || [];
      if (sectionFields.length > 0) {
        groups.push({ title: sec.title, fields: sectionFields });
      }
    }
    if (noSection.length > 0) {
      groups.push({ title: null, fields: noSection });
    }
    if (groups.length === 0) {
      groups.push({ title: null, fields });
    }
    return groups;
  }, [fields, sections]);

  return (
    <div className="min-h-screen bg-gray-50" data-testid="public-form-container">
      <div className="w-full py-6 px-4" style={{ backgroundColor: brandColor }}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Baby className="h-8 w-8 text-white" />
            <span className="text-white/80 text-sm font-medium">CORD BLOOD CENTER</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2" data-testid="text-form-header">
            {config.form.headerTitle || "Registračný formulár"}
          </h1>
          {config.form.headerSubtitle && (
            <p className="text-white/90 text-sm md:text-base max-w-xl mx-auto">{config.form.headerSubtitle}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto -mt-4 px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 md:p-8 space-y-6">
            {isOtpVerified && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: brandColor + "10", color: brandColor }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Identita overená. Existujúce údaje boli predvyplnené.</span>
              </div>
            )}

            {groupedFields.map((group, gi) => (
              <div key={gi} className="space-y-4">
                {group.title && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-0.5 flex-1 rounded" style={{ backgroundColor: brandColor + "30" }} />
                    <h3 className="text-sm font-semibold uppercase tracking-wider px-2" style={{ color: brandColor }}>
                      {group.title}
                    </h3>
                    <div className="h-0.5 flex-1 rounded" style={{ backgroundColor: brandColor + "30" }} />
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.fields.map(renderField)}
                </div>
              </div>
            ))}

            <div className="border-t pt-5 space-y-3">
              {config.form.gdprText && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={gdprAccepted}
                    onCheckedChange={checked => { setGdprAccepted(!!checked); if (errors.gdpr) setErrors(prev => { const e = { ...prev }; delete e.gdpr; return e; }); }}
                    className="mt-0.5"
                    data-testid="checkbox-gdpr"
                  />
                  <Label className="text-xs text-gray-600 leading-relaxed cursor-pointer" onClick={() => setGdprAccepted(!gdprAccepted)}>
                    {config.form.gdprText}
                  </Label>
                </div>
              )}
              {errors.gdpr && <p className="text-xs text-red-500 ml-6">{errors.gdpr}</p>}

              {config.form.gdprPregnancyText && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={pregnancyAccepted}
                    onCheckedChange={checked => { setPregnancyAccepted(!!checked); if (errors.pregnancy) setErrors(prev => { const e = { ...prev }; delete e.pregnancy; return e; }); }}
                    className="mt-0.5"
                    data-testid="checkbox-pregnancy"
                  />
                  <Label className="text-xs text-gray-600 leading-relaxed cursor-pointer" onClick={() => setPregnancyAccepted(!pregnancyAccepted)}>
                    {config.form.gdprPregnancyText}
                  </Label>
                </div>
              )}
              {errors.pregnancy && <p className="text-xs text-red-500 ml-6">{errors.pregnancy}</p>}

              {config.form.gdprMarketingText && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={newsletterAccepted}
                    onCheckedChange={checked => setNewsletterAccepted(!!checked)}
                    className="mt-0.5"
                    data-testid="checkbox-newsletter"
                  />
                  <Label className="text-xs text-gray-600 leading-relaxed cursor-pointer" onClick={() => setNewsletterAccepted(!newsletterAccepted)}>
                    {config.form.gdprMarketingText}
                  </Label>
                </div>
              )}
            </div>

            <Button
              className="w-full h-12 text-base font-semibold rounded-xl text-white"
              style={{ backgroundColor: brandColor }}
              onClick={handleSubmit}
              disabled={step === "submitting"}
              data-testid="btn-submit-form"
            >
              {step === "submitting" ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Odosielam...</>
              ) : (
                <><Send className="h-5 w-5 mr-2" /> Odoslať žiadosť</>
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} Cord Blood Center Group. Všetky práva vyhradené.
        </p>
      </div>
    </div>
  );
}
