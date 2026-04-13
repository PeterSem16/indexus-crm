import type { StatusCategoryCode, StatusActionType } from "@shared/schema";

interface SeedCategory {
  name: string;
  code: StatusCategoryCode;
  color: string;
  icon: string;
  sortOrder: number;
}

interface SeedStatus {
  categoryCode: StatusCategoryCode;
  name: string;
  code: string;
  icon: string;
  color: string;
  defaultAction: StatusActionType;
  isFinal: boolean;
  isConversion: boolean;
  requiresNote: boolean;
  requiresCallback: boolean;
  allowRecontact: boolean;
  allowEmail: boolean;
  allowSms: boolean;
  allowPhone: boolean;
  isSystemStatus: boolean;
  callbackOffsetDays: number | null;
  sortOrder: number;
  visibleInCampaigns: boolean;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { name: "Nedovolané / bez spojenia", code: "not_reached", color: "gray", icon: "PhoneOff", sortOrder: 1 },
  { name: "Callback / odložené", code: "callback", color: "blue", icon: "CalendarClock", sortOrder: 2 },
  { name: "Záujem / obchodný progres", code: "interest", color: "green", icon: "TrendingUp", sortOrder: 3 },
  { name: "Zmluva / dokumenty", code: "contract", color: "purple", icon: "FileText", sortOrder: 4 },
  { name: "Email / SMS komunikácia", code: "email_sms", color: "cyan", icon: "Mail", sortOrder: 5 },
  { name: "Materiály / onboarding", code: "materials", color: "teal", icon: "Package", sortOrder: 6 },
  { name: "Odmietnutie / stop", code: "declined", color: "orange", icon: "ThumbsDown", sortOrder: 7 },
  { name: "Dokončené / uzatvorené", code: "completed", color: "emerald", icon: "CheckCircle", sortOrder: 8 },
  { name: "Chybné / neplatné kontakty", code: "invalid", color: "red", icon: "AlertTriangle", sortOrder: 9 },
];

const cb = (days: number | null = null): Partial<SeedStatus> => ({
  defaultAction: "callback",
  isFinal: false,
  isConversion: false,
  requiresCallback: true,
  allowRecontact: true,
  callbackOffsetDays: days,
});

const dnc: Partial<SeedStatus> = {
  defaultAction: "do_not_call",
  isFinal: true,
  isConversion: false,
  requiresCallback: false,
  allowRecontact: false,
  allowPhone: false,
};

const conv: Partial<SeedStatus> = {
  defaultAction: "conversion",
  isFinal: false,
  isConversion: true,
  requiresCallback: false,
  allowRecontact: true,
};

const done: Partial<SeedStatus> = {
  defaultAction: "complete",
  isFinal: true,
  isConversion: false,
  requiresCallback: false,
  allowRecontact: false,
};

const defaults: Omit<SeedStatus, "categoryCode" | "name" | "code" | "icon" | "color" | "sortOrder"> = {
  defaultAction: "none",
  isFinal: false,
  isConversion: false,
  requiresNote: false,
  requiresCallback: false,
  allowRecontact: true,
  allowEmail: true,
  allowSms: true,
  allowPhone: true,
  isSystemStatus: false,
  callbackOffsetDays: null,
  visibleInCampaigns: true,
};

let order = 0;
const s = (categoryCode: StatusCategoryCode, name: string, code: string, icon: string, color: string, overrides: Partial<SeedStatus> = {}): SeedStatus => ({
  ...defaults,
  categoryCode,
  name,
  code,
  icon,
  color,
  sortOrder: ++order,
  ...overrides,
});

export const SEED_STATUSES: SeedStatus[] = [
  s("not_reached", "Nedvíha", "no_answer", "PhoneOff", "gray", { ...cb(), requiresCallback: false }),
  s("not_reached", "Obsadené", "busy", "Phone", "yellow", cb()),
  s("not_reached", "Hlasová schránka", "voicemail", "MessageSquare", "gray", cb()),
  s("not_reached", "Nedostupné", "unreachable", "WifiOff", "gray", cb()),
  s("not_reached", "Telefón vypnutý", "switched_off", "Smartphone", "gray", cb()),
  s("not_reached", "Chyba siete", "network_error", "AlertCircle", "red", { defaultAction: "callback", isFinal: false, isSystemStatus: true }),
  s("not_reached", "Hovor zlyhal", "call_failed", "PhoneMissed", "red", { defaultAction: "callback", isFinal: false, isSystemStatus: true }),
  s("not_reached", "Mimo pracovnej doby", "after_hours", "Clock", "orange", cb()),
  s("not_reached", "Nevhodný čas", "wrong_time", "Clock", "orange", cb()),
  s("not_reached", "Iba recepcia", "gatekeeper_only", "ShieldAlert", "yellow", cb()),

  s("callback", "Callback – 2 dni", "callback_2d", "CalendarPlus", "blue", cb(2)),
  s("callback", "Callback – 1 týždeň", "callback_1week", "CalendarPlus", "blue", cb(7)),
  s("callback", "Callback – next working day", "callback_nwd", "CalendarPlus", "blue", cb(1)),
  s("callback", "Callback – dohodnutý termín", "callback_scheduled", "CalendarCheck", "blue", { ...cb(), requiresCallback: true }),
  s("callback", "Potrebuje čas", "needs_time", "Clock", "blue", cb()),
  s("callback", "Ešte váha", "hesitant", "HelpCircle", "blue", cb()),
  s("callback", "Čaká na rozhodnutie", "decision_pending", "Hourglass", "blue", cb()),
  s("callback", "Konzultovať s partnerom", "consult_partner", "Users", "blue", cb()),
  s("callback", "Čaká na rozpočet", "awaiting_budget", "DollarSign", "blue", cb()),
  s("callback", "Čaká na interné schválenie", "awaiting_internal_approval", "ClipboardCheck", "blue", cb()),
  s("callback", "Zavolať neskôr dnes", "call_later_today", "PhoneForwarded", "blue", cb(0)),
  s("callback", "Zavolať budúci mesiac", "call_next_month", "Calendar", "blue", cb(30)),
  s("callback", "Reštart o 3 mesiace", "restart_3m", "RotateCcw", "blue", cb(90)),
  s("callback", "Reštart o 6 mesiacov", "restart_6m", "RotateCcw", "blue", cb(180)),

  s("interest", "Záujem potvrdený", "interest_confirmed", "ThumbsUp", "green", conv),
  s("interest", "Súhlas so spoluprácou", "cooperation_agreed", "Handshake", "green", conv),
  s("interest", "Termín dohodnutý", "appointment_set", "CalendarCheck", "green", conv),
  s("interest", "Chce stretnutie", "meeting_requested", "Calendar", "green", { defaultAction: "callback", requiresCallback: true }),
  s("interest", "Chce hovor s lekárom", "call_with_doctor", "Stethoscope", "green", { defaultAction: "callback", requiresCallback: true }),
  s("interest", "Potrebuje viac info", "needs_more_info", "Info", "green", { defaultAction: "send_email" }),
  s("interest", "Chce cenovú ponuku", "price_requested", "FileText", "green", { defaultAction: "send_email" }),
  s("interest", "Vyžiadal si materiály", "materials_requested", "Package", "green", { defaultAction: "send_email" }),
  s("interest", "Vyžiadal si prezentáciu", "demo_requested", "Monitor", "green", { defaultAction: "callback", requiresCallback: true }),
  s("interest", "Teplý lead", "warm_lead", "Flame", "yellow", { defaultAction: "callback", requiresCallback: true }),
  s("interest", "Horúci lead", "hot_lead", "Zap", "red", { defaultAction: "callback", requiresCallback: true }),
  s("interest", "Partner aktívny bez materiálov", "partner_active_no_materials", "UserCheck", "green", { defaultAction: "send_email" }),

  s("contract", "Zmluva odoslaná", "contract_sent", "Send", "purple", { defaultAction: "callback", requiresCallback: true }),
  s("contract", "Zmluva ešte neodoslaná späť", "contract_awaiting", "Clock", "purple", { defaultAction: "callback", requiresCallback: true }),
  s("contract", "Zmluva bez podpisu", "contract_unsigned", "FileX", "orange", { defaultAction: "callback", requiresCallback: true }),
  s("contract", "Zmluva neúplná", "contract_incomplete", "FileWarning", "orange", { defaultAction: "callback", requiresCallback: true }),
  s("contract", "Zmluva opätovne odoslaná", "contract_resent", "RefreshCw", "purple", { defaultAction: "schedule_email" }),
  s("contract", "Zmluva nedoručená", "contract_not_delivered", "AlertCircle", "red", { defaultAction: "send_email" }),
  s("contract", "Zmluva doručená späť", "contract_received", "Download", "purple", { defaultAction: "none" }),
  s("contract", "Zmluva validovaná", "contract_validated", "ShieldCheck", "green", conv),
  s("contract", "Zmluva podpísaná", "contract_signed", "PenTool", "green", conv),
  s("contract", "Zmluva odmietnutá", "contract_rejected", "XCircle", "red", { ...done, isFinal: false, defaultAction: "callback", requiresCallback: true }),
  s("contract", "Chýbajú dokumenty", "missing_documents", "FileQuestion", "orange", { defaultAction: "send_email" }),
  s("contract", "Dokumenty v kontrole", "documents_under_review", "Search", "purple", { defaultAction: "none" }),

  s("email_sms", "Email 1 odoslaný", "email1_sent", "Mail", "cyan", { defaultAction: "send_email" }),
  s("email_sms", "Email 2 – detailné info", "email2_sent", "Mail", "cyan", { defaultAction: "send_email" }),
  s("email_sms", "Email s PDF odoslaný", "pdf_email_sent", "FileText", "cyan", { defaultAction: "send_email" }),
  s("email_sms", "Follow-up email odoslaný", "followup_email_sent", "MailPlus", "cyan", { defaultAction: "none" }),
  s("email_sms", "Reminder email naplánovaný", "reminder_email_scheduled", "CalendarClock", "cyan", { defaultAction: "schedule_email" }),
  s("email_sms", "Email nedoručený", "email_bounced", "MailX", "red", { defaultAction: "verify_contact", isSystemStatus: true }),
  s("email_sms", "Email otvorený", "email_opened", "Eye", "cyan", { defaultAction: "none", isSystemStatus: true }),
  s("email_sms", "Klik na email", "email_clicked", "MousePointerClick", "green", { defaultAction: "callback", isSystemStatus: true }),
  s("email_sms", "Odpoveď na email", "email_replied", "MailCheck", "green", { defaultAction: "callback" }),
  s("email_sms", "Bez reakcie na email", "email_no_response", "MailWarning", "gray", { defaultAction: "schedule_email" }),
  s("email_sms", "SMS odoslaná", "sms_sent_status", "MessageSquare", "cyan", { defaultAction: "send_sms" }),
  s("email_sms", "SMS naplánovaná", "sms_scheduled", "CalendarClock", "cyan", { defaultAction: "schedule_sms" }),
  s("email_sms", "SMS doručená", "sms_delivered", "CheckCircle", "green", { defaultAction: "none", isSystemStatus: true }),
  s("email_sms", "SMS zlyhala", "sms_failed", "XCircle", "red", { defaultAction: "verify_contact", isSystemStatus: true }),
  s("email_sms", "Reakcia na SMS", "sms_replied", "MessageCircle", "green", { defaultAction: "callback" }),

  s("materials", "Materiály odoslané", "materials_sent", "Send", "teal", { defaultAction: "none" }),
  s("materials", "Materiály doručené", "materials_delivered", "Package", "teal", { defaultAction: "complete" }),
  s("materials", "Materiály otvorené / pozreté", "materials_viewed", "Eye", "teal", { defaultAction: "callback", isSystemStatus: true }),
  s("materials", "Onboarding potvrdený", "onboarding_confirmed", "CheckCircle", "green", conv),
  s("materials", "Onboarding začatý", "onboarding_started", "Play", "teal", { defaultAction: "none" }),
  s("materials", "Onboarding dokončený", "onboarding_completed", "CheckCircle2", "green", { ...conv, isFinal: true }),
  s("materials", "Aktivácia čaká", "activation_pending", "Clock", "yellow", { defaultAction: "none" }),
  s("materials", "Partner aktívny", "partner_active", "UserCheck", "green", { ...conv, isFinal: true }),
  s("materials", "Partner spustený do prevádzky", "partner_live", "Rocket", "green", { ...conv, isFinal: true }),

  s("declined", "Odmietnutie — callback 6M", "declined_6m", "Clock", "orange", cb(180)),
  s("declined", "Odmietnutie — referencia 3M reštart", "declined_ref_3m", "RotateCcw", "orange", cb(90)),
  s("declined", "Definitívne odmietnutie", "declined_final", "XCircle", "red", dnc),
  s("declined", "Odmietol z dôvodu ceny", "declined_budget", "DollarSign", "orange", { ...done, requiresNote: true }),
  s("declined", "Nemá potrebu", "declined_no_need", "MinusCircle", "orange", done),
  s("declined", "Už má iného partnera", "declined_competitor", "Users", "orange", { ...done, requiresNote: true }),
  s("declined", "Nevhodný čas", "declined_bad_timing", "Clock", "orange", cb()),
  s("declined", "Interné pravidlá nedovoľujú", "declined_internal_policy", "Shield", "orange", done),
  s("declined", "Nemá kompetenciu", "declined_no_authority", "UserX", "orange", done),
  s("declined", "Nie je relevantné", "declined_not_relevant", "Filter", "gray", done),
  s("declined", "Bez záujmu", "not_interested", "ThumbsDown", "orange", done),
  s("declined", "Neželá si telefonát", "dnc_phone_only", "PhoneOff", "red", { ...dnc, allowEmail: true, allowSms: true }),
  s("declined", "Neželá si žiadny kontakt", "dnc_all", "Ban", "red", { ...dnc, allowEmail: false, allowSms: false }),
  s("declined", "GDPR stop", "gdpr_stop", "ShieldAlert", "red", { ...dnc, allowEmail: false, allowSms: false }),
  s("declined", "Blacklist", "blacklisted", "Slash", "red", { ...dnc, allowEmail: false, allowSms: false }),

  s("completed", "Dokončené", "completed_status", "CheckCircle", "emerald", done),
  s("completed", "Uzatvorené úspešne", "closed_success", "CheckCircle2", "green", { ...done, isConversion: true }),
  s("completed", "Uzatvorené bez ďalšej akcie", "closed_no_action", "Circle", "gray", done),
  s("completed", "Požiadavka vybavená", "request_resolved", "CheckSquare", "green", done),
  s("completed", "Prípad uzatvorený", "case_closed", "FolderClosed", "gray", done),
  s("completed", "Uzatvorené ako neaktívne", "inactive_closed", "Archive", "gray", done),
  s("completed", "Úloha dokončená", "task_completed", "ListChecks", "green", done),

  s("invalid", "Chybné číslo", "wrong_number", "PhoneOff", "red", { ...done, defaultAction: "do_not_call" }),
  s("invalid", "Neplatný kontakt", "invalid_contact", "UserX", "red", { ...done, defaultAction: "do_not_call" }),
  s("invalid", "Duplicitný kontakt", "duplicate_contact", "Copy", "orange", { ...done, defaultAction: "verify_contact" }),
  s("invalid", "Kontakt neexistuje", "contact_not_found", "Search", "red", done),
  s("invalid", "Nesprávna osoba", "wrong_person", "UserX", "orange", { ...done, defaultAction: "verify_contact" }),
  s("invalid", "Firma zanikla", "company_closed", "Building", "red", done),
  s("invalid", "Mimo cieľovej skupiny", "out_of_scope", "Filter", "gray", done),
  s("invalid", "Chyba v dátach", "data_error", "AlertTriangle", "orange", { ...done, defaultAction: "verify_contact" }),
  s("invalid", "Chýba telefón", "missing_phone", "PhoneOff", "orange", { defaultAction: "verify_contact", allowPhone: false }),
  s("invalid", "Chýba email", "missing_email", "MailX", "orange", { defaultAction: "verify_contact", allowEmail: false }),
];
