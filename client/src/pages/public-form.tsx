import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertCircle, Send, Shield, Sparkles, PartyPopper, Star, Rocket, Heart } from "lucide-react";

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
  "Rádio", "TV", "V pôrodnici", "Iné médiá",
];

const PAYMENT_OPTIONS = [
  { value: "bank_transfer", label: "Bankovým prevodom" },
  { value: "invoice", label: "Na faktúru" },
  { value: "installments", label: "Na splátky" },
];

const VALIDATION_PATTERNS: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[\d\s\-\(\)]{9,20}$/,
  postalCode: /^[\d\s\-]{3,10}$/,
  nationalId: /^[\d\/\-]{6,15}$/,
  iban: /^[A-Z]{2}\d{2}[\s]?[\dA-Z]{4,}$/i,
};

function parseRules(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function validateFieldValue(value: any, field: any): string | null {
  const rules = parseRules(field.validationRules);

  if (field.isRequired && (!value || (typeof value === "string" && !value.trim()))) {
    return rules.errorMessage || "Povinné pole";
  }

  if (!value || (typeof value === "string" && !value.trim())) return null;

  const strVal = String(value);

  if (rules.minLength && strVal.length < rules.minLength) {
    return rules.errorMessage || `Minimálne ${rules.minLength} znakov`;
  }
  if (rules.maxLength && strVal.length > rules.maxLength) {
    return rules.errorMessage || `Maximálne ${rules.maxLength} znakov`;
  }
  if (rules.min !== undefined && Number(value) < rules.min) {
    return rules.errorMessage || `Minimálna hodnota: ${rules.min}`;
  }
  if (rules.max !== undefined && Number(value) > rules.max) {
    return rules.errorMessage || `Maximálna hodnota: ${rules.max}`;
  }

  if (rules.pattern) {
    if (rules.pattern === "custom" && rules.customPattern) {
      try {
        const re = new RegExp(rules.customPattern);
        if (!re.test(strVal)) return rules.errorMessage || "Neplatný formát";
      } catch {}
    } else if (VALIDATION_PATTERNS[rules.pattern]) {
      if (!VALIDATION_PATTERNS[rules.pattern].test(strVal)) {
        const msgs: Record<string, string> = {
          email: "Zadajte platný email",
          phone: "Zadajte platné telefónne číslo",
          postalCode: "Zadajte platné PSČ",
          nationalId: "Zadajte platné rodné číslo",
          iban: "Zadajte platný IBAN",
        };
        return rules.errorMessage || msgs[rules.pattern] || "Neplatný formát";
      }
    }
  }

  return null;
}

const WIDTH_MAP: Record<string, string> = {
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  full: "max-w-full px-4 sm:px-8",
};

const FONT_SIZE_MAP: Record<string, string> = {
  xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem",
  xl: "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem", "4xl": "2.25rem",
};

const FONT_WEIGHT_MAP: Record<string, number> = {
  light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800,
};

function fontStyle(size?: string, weight?: string, style?: string, family?: string): React.CSSProperties {
  const result: React.CSSProperties = {};
  if (size) result.fontSize = FONT_SIZE_MAP[size] || size;
  if (weight) result.fontWeight = FONT_WEIGHT_MAP[weight] || 400;
  if (style === "italic") result.fontStyle = "italic";
  if (family && family !== "inherit") result.fontFamily = family;
  return result;
}

export default function PublicFormPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("form");
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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
    setLoading(true);
    setStep("form");
    setErrors({});
    setTouched({});
    setGdprAccepted(false);
    setPregnancyAccepted(false);
    setNewsletterAccepted(false);
    setOtpCode("");
    setOtpEmail("");
    setOtpError("");
    setExistingCustomerId(null);
    setIsOtpVerified(false);
    setVerificationToken(null);
    setSubmitError("");
    fetch(`/api/public/web-form/${slug}`)
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(data => {
        setConfig(data);
        const defaults: Record<string, any> = {};
        (data.form?.fields || []).forEach((f: any) => {
          if (f.defaultValue) defaults[f.customerField || f.id] = f.defaultValue;
        });
        setFormValues(defaults);
        setLoading(false);
      })
      .catch(() => { setConfig(null); setLoading(false); });
  }, [slug]);

  const fields = useMemo(() => {
    if (!config?.form?.fields) return [];
    return [...config.form.fields]
      .filter((f: any) => f.isVisible !== false)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [config]);

  const sections = useMemo(() => {
    if (!config?.form?.sections) return [];
    return [...config.form.sections]
      .filter((s: any) => s.isVisible !== false)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [config]);

  const groupedFields = useMemo(() => {
    if (sections.length === 0) return [{ section: { title: null, columns: 2 }, fields }];
    const groups: Array<{ section: any; fields: any[] }> = [];
    const fieldsBySection: Map<string, any[]> = new Map();
    const noSection: any[] = [];

    for (const field of fields) {
      if (field.sectionId) {
        const existing = fieldsBySection.get(field.sectionId) || [];
        existing.push(field);
        fieldsBySection.set(field.sectionId, existing);
      } else {
        noSection.push(field);
      }
    }

    for (const sec of sections) {
      const sectionFields = fieldsBySection.get(sec.id) || [];
      if (sectionFields.length > 0) {
        groups.push({ section: sec, fields: sectionFields });
      }
    }
    if (noSection.length > 0) {
      groups.push({ section: { title: null, columns: 2 }, fields: noSection });
    }
    if (groups.length === 0) {
      groups.push({ section: { title: null, columns: 2 }, fields });
    }
    return groups;
  }, [fields, sections]);

  const getFieldKey = (field: any) => field.customerField || field.id;

  const sectionProgress = useMemo(() => {
    const corrFieldKeys = ["corrName","corrAddress","corrCity","corrPostalCode","corrRegion","corrCountry"];
    return groupedFields.map((group, idx) => {
      const visibleFields = group.fields.filter((f: any) => {
        if (corrFieldKeys.includes(f.customerField) && !formValues.useCorrespondenceAddress) return false;
        return true;
      });
      const requiredFields = visibleFields.filter((f: any) => f.isRequired);
      const filledRequired = requiredFields.filter((f: any) => {
        const key = getFieldKey(f);
        const val = formValues[key];
        return val && (typeof val !== "string" || val.trim().length > 0);
      });
      const allFields = visibleFields;
      const filledAll = allFields.filter((f: any) => {
        const key = getFieldKey(f);
        const val = formValues[key];
        return val && (typeof val !== "string" || val.trim().length > 0);
      });
      const requiredDone = requiredFields.length === 0 || filledRequired.length === requiredFields.length;
      const pct = allFields.length > 0 ? Math.round((filledAll.length / allFields.length) * 100) : 0;
      return { idx, requiredDone, pct, filledAll: filledAll.length, totalAll: allFields.length, sectionTitle: group.section?.title };
    });
  }, [groupedFields, formValues]);

  const totalSections = sectionProgress.length;
  const completedSections = sectionProgress.filter(s => s.requiredDone && s.pct >= 80).length;
  const overallPct = totalSections > 0 ? Math.round(sectionProgress.reduce((sum, s) => sum + s.pct, 0) / totalSections) : 0;

  const updateField = (key: string, value: any) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    setTouched(prev => ({ ...prev, [key]: true }));
    if (errors[key]) {
      const field = fields.find((f: any) => getFieldKey(f) === key);
      if (field) {
        const err = validateFieldValue(value, field);
        setErrors(prev => {
          const e = { ...prev };
          if (err) e[key] = err;
          else delete e[key];
          return e;
        });
      }
    }
    if ((key === "firstName" || key === "lastName" || key === "email") && isOtpVerified) {
      setIsOtpVerified(false);
      setExistingCustomerId(null);
      setVerificationToken(null);
      setOtpCode("");
      setOtpEmail("");
      setOtpError("");
    }
  };

  const blurField = (key: string) => {
    setTouched(prev => ({ ...prev, [key]: true }));
    const field = fields.find((f: any) => getFieldKey(f) === key);
    if (field) {
      const err = validateFieldValue(formValues[key], field);
      setErrors(prev => {
        const e = { ...prev };
        if (err) e[key] = err;
        else delete e[key];
        return e;
      });
    }
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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const corrFieldKeys = ["corrName","corrAddress","corrCity","corrPostalCode","corrRegion","corrCountry"];
    for (const field of fields) {
      if (corrFieldKeys.includes(field.customerField) && !formValues.useCorrespondenceAddress) continue;
      const key = getFieldKey(field);
      const err = validateFieldValue(formValues[key], field);
      if (err) errs[key] = err;
    }
    if (!gdprAccepted && config?.form?.gdprText) errs.gdpr = "Musíte súhlasiť so spracovaním údajov";
    if (config?.form?.gdprPregnancyText && !pregnancyAccepted) errs.pregnancy = "Povinné potvrdenie";
    setErrors(errs);
    const allTouched: Record<string, boolean> = {};
    fields.forEach((f: any) => { allTouched[getFieldKey(f)] = true; });
    setTouched(allTouched);
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

  const f = config.form;
  const brandColor = f.brandColor || "#16a34a";
  const textColor = f.textColor || "#ffffff";
  const headingColor = f.headingColor || "#ffffff";
  const sectionColor = f.sectionColor || brandColor;
  const bgColor = f.bgColor || "#f3f4f6";
  const formWidth = f.formWidth || "3xl";
  const widthClass = WIDTH_MAP[formWidth] || "max-w-3xl";

  const titleStyle = fontStyle(f.titleFontSize || "2xl", f.titleFontWeight || "bold", f.titleFontStyle, f.titleFontFamily);
  const subtitleStyle = fontStyle(f.subtitleFontSize || "sm", f.subtitleFontWeight || "normal", f.subtitleFontStyle, f.subtitleFontFamily);
  const sectionTitleStyle = fontStyle(f.sectionFontSize || "xs", f.sectionFontWeight || "bold", f.sectionFontStyle);
  const labelStyle = fontStyle(f.labelFontSize || "sm", f.labelFontWeight || "medium");
  const buttonStyle = fontStyle(f.buttonFontSize || "base", f.buttonFontWeight || "semibold");

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }} data-testid="text-form-success">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: brandColor + "15" }}>
            <CheckCircle2 className="h-10 w-10" style={{ color: brandColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: brandColor }}>Ďakujeme!</h2>
          <p className="text-gray-600">{f.successMessage || "Vaša žiadosť bola úspešne odoslaná. Budeme vás kontaktovať."}</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl shadow-lg">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold mb-3 text-red-600">Chyba pri odoslaní</h2>
          <p className="text-gray-600 mb-4">{submitError || "Nastala chyba. Skúste to prosím znova."}</p>
          <Button onClick={() => setStep("form")} style={{ backgroundColor: brandColor }} className="text-white">Skúsiť znova</Button>
        </div>
      </div>
    );
  }

  if (step === "otp_check") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgColor }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <Shield className="h-12 w-12 mx-auto mb-3" style={{ color: brandColor }} />
            <h2 className="text-xl font-bold">Overenie existujúceho klienta</h2>
            <p className="text-sm text-gray-500 mt-2">Našli sme existujúci záznam. Pre overenie vašej identity vám zašleme kód na email <strong>{otpEmail}</strong>.</p>
          </div>
          <div className="space-y-3">
            <Button className="w-full text-white" style={{ backgroundColor: brandColor }} onClick={sendOtp} disabled={otpLoading} data-testid="btn-send-otp">
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgColor }}>
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
            <Button className="w-full text-white" style={{ backgroundColor: brandColor }} onClick={verifyOtp} disabled={otpCode.length !== 6 || otpLoading} data-testid="btn-verify-otp">
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
    const key = getFieldKey(field);
    const val = formValues[key] || "";
    const err = touched[key] ? errors[key] : undefined;
    const placeholder = field.placeholder || "";
    const helpText = field.helpText;

    const fieldWrapper = (children: any) => (
      <div key={key} className="space-y-1.5">
        <Label className="text-gray-700" style={labelStyle}>
          {field.label}
          {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {children}
        {helpText && !err && <p className="text-[11px] text-gray-400">{helpText}</p>}
        {err && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p>}
      </div>
    );

    const inputClass = `h-10 bg-white border-gray-300 focus:border-2 rounded-lg transition-colors ${err ? "border-red-400 focus:border-red-500" : ""}`;

    if (field.fieldType === "select_insurance") {
      return fieldWrapper(
        <Select value={val} onValueChange={v => updateField(key, v)}>
          <SelectTrigger className={inputClass} data-testid={`select-${key}`} onBlur={() => blurField(key)}>
            <SelectValue placeholder={placeholder || "Vyberte poisťovňu..."} />
          </SelectTrigger>
          <SelectContent>
            {config.healthInsuranceCompanies.map((hic: any) => (
              <SelectItem key={hic.id} value={hic.id}>{hic.code} - {hic.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.fieldType === "select_hospital") {
      return fieldWrapper(
        <Select value={val} onValueChange={v => updateField(key, v)}>
          <SelectTrigger className={inputClass} data-testid={`select-${key}`} onBlur={() => blurField(key)}>
            <SelectValue placeholder={placeholder || "Vyberte nemocnicu..."} />
          </SelectTrigger>
          <SelectContent>
            {config.hospitals.map((h: any) => (
              <SelectItem key={h.id} value={h.id}>{h.name}{h.city ? ` - ${h.city}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.fieldType === "select_product") {
      return fieldWrapper(
        <Select value={val} onValueChange={v => updateField(key, v)}>
          <SelectTrigger className={inputClass} data-testid={`select-${key}`} onBlur={() => blurField(key)}>
            <SelectValue placeholder={placeholder || "Vyberte typ odberu..."} />
          </SelectTrigger>
          <SelectContent>
            {config.productSets.map((ps: any) => (
              <SelectItem key={ps.id} value={ps.id}>
                {ps.name}{ps.totalGrossAmount ? ` (${Number(ps.totalGrossAmount).toLocaleString("sk")} ${ps.currency || "EUR"})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.fieldType === "select_source") {
      return fieldWrapper(
        <Select value={val} onValueChange={v => updateField(key, v)}>
          <SelectTrigger className={inputClass} data-testid={`select-${key}`} onBlur={() => blurField(key)}>
            <SelectValue placeholder={placeholder || "Vyberte..."} />
          </SelectTrigger>
          <SelectContent>
            {HOW_DID_YOU_HEAR_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.fieldType === "select_payment") {
      return fieldWrapper(
        <Select value={val} onValueChange={v => updateField(key, v)}>
          <SelectTrigger className={inputClass} data-testid={`select-${key}`} onBlur={() => blurField(key)}>
            <SelectValue placeholder={placeholder || "Vyberte..."} />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.fieldType === "select") {
      const opts = (field.options || "").split("\n").filter((o: string) => o.trim());
      return fieldWrapper(
        <Select value={val} onValueChange={v => updateField(key, v)}>
          <SelectTrigger className={inputClass} data-testid={`select-${key}`} onBlur={() => blurField(key)}>
            <SelectValue placeholder={placeholder || "Vyberte..."} />
          </SelectTrigger>
          <SelectContent>
            {opts.map((opt: string) => (
              <SelectItem key={opt.trim()} value={opt.trim()}>{opt.trim()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.fieldType === "checkbox") {
      return (
        <div key={key} className="flex items-center gap-3 py-1">
          <Checkbox
            checked={!!formValues[key]}
            onCheckedChange={checked => updateField(key, checked)}
            data-testid={`checkbox-${key}`}
            className="border-gray-300"
          />
          <Label className="text-sm text-gray-700 cursor-pointer" onClick={() => updateField(key, !formValues[key])}>{field.label}</Label>
        </div>
      );
    }

    if (field.fieldType === "textarea") {
      return fieldWrapper(
        <Textarea
          value={val}
          onChange={e => updateField(key, e.target.value)}
          onBlur={() => blurField(key)}
          className={`bg-white border-gray-300 rounded-lg ${err ? "border-red-400" : ""}`}
          placeholder={placeholder}
          rows={3}
          data-testid={`textarea-${key}`}
        />
      );
    }

    return fieldWrapper(
      <Input
        type={field.fieldType === "date" ? "date" : field.fieldType === "email" ? "email" : field.fieldType === "tel" ? "tel" : field.fieldType === "number" ? "number" : "text"}
        value={val}
        onChange={e => updateField(key, e.target.value)}
        onBlur={() => blurField(key)}
        className={inputClass}
        placeholder={placeholder}
        data-testid={`input-${key}`}
      />
    );
  };

  const errorCount = Object.keys(errors).length;
  const formLayout = f.formLayout || "standard";

  const renderHeader = (extraClass?: string) => (
    <div className={`text-center ${extraClass || ""}`}>
      <h1 className="mb-3" style={{ color: headingColor, ...titleStyle }} data-testid="text-form-header">
        {f.headerTitle || "Registračný formulár"}
      </h1>
      {f.headerSubtitle && (
        <p className="leading-relaxed mb-2" style={{ color: textColor + "dd", ...subtitleStyle }}>
          {f.headerSubtitle}
        </p>
      )}
      {f.contactInfo && (
        <p className="text-xs md:text-sm mt-2" style={{ color: textColor + "aa" }}>
          {f.contactInfo}
        </p>
      )}
    </div>
  );

  const motivationalMessages = useMemo(() => {
    const msgs = [
      { icon: Sparkles, texts: ["Skvelý začiatok! ✨", "Ste na dobrej ceste!", "Prvý krok je za vami!"] },
      { icon: Star, texts: ["Výborne, pokračujte! ⭐", "Darí sa vám skvele!", "Už to ide ako po masle!"] },
      { icon: Rocket, texts: ["Raketa! Už len kúsok! 🚀", "Super tempo!", "Ste úžasní, už skoro!"] },
      { icon: Heart, texts: ["Takmer hotové! 💚", "Posledný krok!", "Úplný záver, hurá!"] },
      { icon: PartyPopper, texts: ["Hotovo, gratulujeme! 🎉", "Všetko vyplnené!", "Perfektná práca!"] },
    ];
    return msgs;
  }, []);

  const getMotivationalMessage = (sectionIdx: number, completed: boolean, pct: number) => {
    if (!completed && pct < 30) return null;
    const msgSet = motivationalMessages[Math.min(sectionIdx, motivationalMessages.length - 1)];
    const textIdx = pct >= 100 ? 2 : pct >= 50 ? 1 : 0;
    return { Icon: msgSet.icon, text: msgSet.texts[textIdx] };
  };

  const renderFormContent = () => (
    <>
            {isOtpVerified && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: brandColor + "10", color: brandColor }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Identita overená. Existujúce údaje boli predvyplnené.</span>
              </div>
            )}

            {totalSections > 1 && (
              <div className="pb-2" data-testid="progress-pipeline">
                <div className="flex items-center gap-1.5 mb-2">
                  {sectionProgress.map((sp, i) => {
                    const done = sp.requiredDone && sp.pct >= 80;
                    const active = sp.pct > 0 && sp.pct < 80;
                    return (
                      <div key={i} className="flex items-center flex-1 gap-1.5">
                        <div className="flex-1 relative">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: `${sp.pct}%`,
                                background: done ? brandColor : active ? `linear-gradient(90deg, ${brandColor}88, ${brandColor}cc)` : "#e5e7eb",
                              }}
                            />
                          </div>
                        </div>
                        {i < totalSections - 1 && (
                          <div
                            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500"
                            style={{
                              backgroundColor: done ? brandColor : "white",
                              color: done ? "white" : sp.pct > 0 ? brandColor : "#d1d5db",
                              border: `2px solid ${done ? brandColor : sp.pct > 0 ? brandColor + "66" : "#e5e7eb"}`,
                              transform: done ? "scale(1.1)" : "scale(1)",
                            }}
                          >
                            {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {overallPct > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-gray-400">
                      {completedSections}/{totalSections} {totalSections === 1 ? "sekcia" : completedSections < 5 ? "sekcie" : "sekcií"}
                    </p>
                    <p className="text-[11px] font-medium" style={{ color: overallPct >= 80 ? brandColor : "#6b7280" }}>
                      {overallPct}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {groupedFields.map((group, gi) => {
              const cols = group.section?.columns || 2;
              const gridCols = cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
              const sp = sectionProgress[gi];
              const sectionDone = sp && sp.requiredDone && sp.pct >= 80;
              const motivation = sp ? getMotivationalMessage(gi, sectionDone, sp.pct) : null;

              return (
                <div key={gi} className="space-y-5">
                  {group.section?.title && (
                    <div className="flex items-center gap-3 pt-2">
                      <div className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: sectionColor + "25" }} />
                      <div className="flex items-center gap-2 px-3">
                        {sectionDone && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 transition-all duration-500" style={{ color: brandColor }} />
                        )}
                        <h3
                          className="uppercase tracking-[0.15em] whitespace-nowrap transition-colors duration-300"
                          style={{ color: sectionDone ? brandColor : sectionColor, ...sectionTitleStyle }}
                        >
                          {group.section.title}
                        </h3>
                      </div>
                      <div className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: sectionColor + "25" }} />
                    </div>
                  )}
                  <div className={`grid gap-x-5 gap-y-4 ${gridCols}`}>
                    {group.fields.map((field: any) => {
                      const corrFields = ["corrName","corrAddress","corrCity","corrPostalCode","corrRegion","corrCountry"];
                      if (corrFields.includes(field.customerField) && !formValues.useCorrespondenceAddress) return null;
                      if (field.customerField === "useCorrespondenceAddress") return null;
                      const span = Math.min(field.columnSpan || 1, cols);
                      const spanClass = span > 1 ? (span >= 3 ? "sm:col-span-3" : "sm:col-span-2") : "";
                      return (
                        <div key={getFieldKey(field)} className={spanClass}>
                          {renderField(field)}
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const hasAddressFields = group.fields.some((f: any) => ["address","city","postalCode","region"].includes(f.customerField));
                    if (!hasAddressFields) return null;
                    return (
                      <div className="mt-4 space-y-4" data-testid="correspondence-address-block">
                        <div className="flex items-center gap-3 py-1">
                          <Checkbox
                            checked={!!formValues.useCorrespondenceAddress}
                            onCheckedChange={(checked) => updateField("useCorrespondenceAddress", checked)}
                            data-testid="checkbox-useCorrespondenceAddress"
                            className="border-gray-300"
                          />
                          <Label
                            className="text-sm text-gray-700 cursor-pointer"
                            onClick={() => updateField("useCorrespondenceAddress", !formValues.useCorrespondenceAddress)}
                          >
                            Iná korešpondenčná adresa
                          </Label>
                        </div>
                        {formValues.useCorrespondenceAddress && (
                          <div className={`grid gap-x-5 gap-y-4 ${gridCols} pl-1 border-l-2 transition-all duration-300 animate-in fade-in slide-in-from-top-2`} style={{ borderColor: brandColor + "30" }}>
                            {[
                              { key: "corrName", label: "Meno príjemcu", span: 2 },
                              { key: "corrAddress", label: "Ulica a číslo", span: 2 },
                              { key: "corrCity", label: "Mesto", span: 1 },
                              { key: "corrPostalCode", label: "PSČ", span: 1 },
                            ].map(cf => {
                              const existingField = group.fields.find((f: any) => f.customerField === cf.key);
                              if (existingField) return (
                                <div key={cf.key} className={cf.span > 1 ? "sm:col-span-2" : ""}>
                                  {renderField(existingField)}
                                </div>
                              );
                              return (
                                <div key={cf.key} className={cf.span > 1 ? "sm:col-span-2" : ""}>
                                  <div className="space-y-1.5">
                                    <Label className="text-gray-700" style={labelStyle}>{cf.label}</Label>
                                    <Input
                                      value={formValues[cf.key] || ""}
                                      onChange={e => updateField(cf.key, e.target.value)}
                                      className="h-10 bg-white border-gray-300 focus:border-2 rounded-lg"
                                      data-testid={`input-${cf.key}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {motivation && sectionDone && gi < totalSections - 1 && (
                    <div
                      className="flex items-center gap-2.5 py-2.5 px-4 rounded-xl text-sm transition-all duration-500 animate-in fade-in slide-in-from-bottom-2"
                      style={{ backgroundColor: brandColor + "08", border: `1px solid ${brandColor}18` }}
                      data-testid={`motivation-${gi}`}
                    >
                      <motivation.Icon className="h-4 w-4 shrink-0" style={{ color: brandColor }} />
                      <span className="font-medium" style={{ color: brandColor }}>{motivation.text}</span>
                      <span className="text-gray-400 text-xs ml-auto">
                        {totalSections - gi - 1 === 1 ? "Ešte 1 krok" : `Ešte ${totalSections - gi - 1} kroky`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {overallPct >= 80 && totalSections > 1 && (
              <div
                className="flex items-center gap-3 p-4 rounded-xl transition-all duration-700 animate-in fade-in slide-in-from-bottom-3"
                style={{ backgroundColor: brandColor + "0a", border: `1px dashed ${brandColor}30` }}
                data-testid="completion-celebration"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: brandColor + "15" }}>
                  <PartyPopper className="h-4 w-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: brandColor }}>
                    {overallPct >= 100 ? "Všetko vyplnené! 🎉" : "Skoro hotové! Už len dokončiť posledné detaily."}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {overallPct >= 100 ? "Stačí potvrdiť súhlasy a odoslať formulár." : `${overallPct}% formulára je vyplnených.`}
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6 space-y-4">
              {f.gdprText && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={gdprAccepted}
                    onCheckedChange={checked => { setGdprAccepted(!!checked); if (errors.gdpr) setErrors(prev => { const e = { ...prev }; delete e.gdpr; return e; }); }}
                    className="mt-0.5 border-gray-300"
                    data-testid="checkbox-gdpr"
                  />
                  <Label className="text-xs text-gray-600 leading-relaxed cursor-pointer" onClick={() => setGdprAccepted(!gdprAccepted)}>
                    {f.gdprText}
                  </Label>
                </div>
              )}
              {errors.gdpr && <p className="text-xs text-red-500 ml-7 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.gdpr}</p>}

              {f.gdprPregnancyText && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={pregnancyAccepted}
                    onCheckedChange={checked => { setPregnancyAccepted(!!checked); if (errors.pregnancy) setErrors(prev => { const e = { ...prev }; delete e.pregnancy; return e; }); }}
                    className="mt-0.5 border-gray-300"
                    data-testid="checkbox-pregnancy"
                  />
                  <Label className="text-xs text-gray-600 leading-relaxed cursor-pointer" onClick={() => setPregnancyAccepted(!pregnancyAccepted)}>
                    {f.gdprPregnancyText}
                  </Label>
                </div>
              )}
              {errors.pregnancy && <p className="text-xs text-red-500 ml-7 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.pregnancy}</p>}

              {f.gdprMarketingText && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={newsletterAccepted}
                    onCheckedChange={checked => setNewsletterAccepted(!!checked)}
                    className="mt-0.5 border-gray-300"
                    data-testid="checkbox-newsletter"
                  />
                  <Label className="text-xs text-gray-600 leading-relaxed cursor-pointer" onClick={() => setNewsletterAccepted(!newsletterAccepted)}>
                    {f.gdprMarketingText}
                  </Label>
                </div>
              )}
            </div>

            {errorCount > 0 && Object.values(touched).some(Boolean) && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Prosím opravte {errorCount} {errorCount === 1 ? "chybu" : errorCount < 5 ? "chyby" : "chýb"} vo formulári.</span>
              </div>
            )}

            <Button
              className="w-full h-12 rounded-xl text-white shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: brandColor, ...buttonStyle }}
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
    </>
  );

  const renderFooter = () => (
    <p className="text-center text-xs text-gray-400 mt-6">
      &copy; {new Date().getFullYear()} Cord Blood Center Group.
    </p>
  );

  if (formLayout === "minimal") {
    return (
      <div className="min-h-screen bg-white" data-testid="public-form-container">
        <div className={`${widthClass} mx-auto px-4 py-8`}>
          <div className="text-center mb-8">
            <h1 className="mb-3" style={{ color: brandColor, ...titleStyle }} data-testid="text-form-header">
              {f.headerTitle || "Registračný formulár"}
            </h1>
            {f.headerSubtitle && (
              <p className="leading-relaxed mb-2 text-gray-600" style={subtitleStyle}>{f.headerSubtitle}</p>
            )}
            {f.contactInfo && (
              <p className="text-xs md:text-sm mt-2 text-gray-400">{f.contactInfo}</p>
            )}
          </div>
          <div className="space-y-8">
            {renderFormContent()}
          </div>
          {renderFooter()}
        </div>
      </div>
    );
  }

  if (formLayout === "split") {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: bgColor }} data-testid="public-form-container">
        <div className="hidden lg:flex lg:w-[400px] xl:w-[480px] shrink-0 flex-col justify-center p-12" style={{ backgroundColor: brandColor }}>
          <h1 className="mb-4" style={{ color: headingColor, ...titleStyle }} data-testid="text-form-header">
            {f.headerTitle || "Registračný formulár"}
          </h1>
          {f.headerSubtitle && (
            <p className="leading-relaxed mb-4" style={{ color: textColor + "dd", ...subtitleStyle }}>{f.headerSubtitle}</p>
          )}
          {f.contactInfo && (
            <p className="text-xs md:text-sm mt-4" style={{ color: textColor + "aa" }}>{f.contactInfo}</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="lg:hidden w-full py-6 px-4 text-center" style={{ backgroundColor: brandColor }}>
            {renderHeader()}
          </div>
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10 space-y-8">
              {renderFormContent()}
            </div>
            {renderFooter()}
          </div>
        </div>
      </div>
    );
  }

  if (formLayout === "card") {
    return (
      <div className="min-h-screen flex items-start justify-center p-4 md:p-8" style={{ backgroundColor: brandColor + "12", backgroundImage: `radial-gradient(circle at 30% 20%, ${brandColor}15 0%, transparent 60%)` }} data-testid="public-form-container">
        <div className={`${widthClass} w-full`}>
          <div className="text-center mb-6 pt-4">
            <h1 className="mb-3" style={{ color: brandColor, ...titleStyle }} data-testid="text-form-header">
              {f.headerTitle || "Registračný formulár"}
            </h1>
            {f.headerSubtitle && (
              <p className="leading-relaxed mb-2 text-gray-600" style={subtitleStyle}>{f.headerSubtitle}</p>
            )}
            {f.contactInfo && (
              <p className="text-xs md:text-sm mt-2 text-gray-400">{f.contactInfo}</p>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-10 space-y-8">
            {renderFormContent()}
          </div>
          {renderFooter()}
        </div>
      </div>
    );
  }

  if (formLayout === "hero") {
    return (
      <div className="min-h-screen" style={{ backgroundColor: bgColor }} data-testid="public-form-container">
        <div className="w-full py-16 md:py-20 px-4" style={{ backgroundColor: brandColor }}>
          <div className={`${widthClass} mx-auto text-center`}>
            {renderHeader()}
          </div>
        </div>
        <div className={`${widthClass} mx-auto -mt-10 px-4 pb-12`}>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 md:p-10 space-y-8">
              {renderFormContent()}
            </div>
          </div>
          {renderFooter()}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }} data-testid="public-form-container">
      <div className="w-full py-8 px-4" style={{ backgroundColor: brandColor }}>
        <div className={`${widthClass} mx-auto text-center`}>
          {renderHeader()}
        </div>
      </div>
      <div className={`${widthClass} mx-auto -mt-6 px-4 pb-12`}>
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 md:p-10 space-y-8">
            {renderFormContent()}
          </div>
        </div>
        {renderFooter()}
      </div>
    </div>
  );
}
