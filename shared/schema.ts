import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, decimal, integer, numeric, date, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Country codes for the CRM system (operating countries)
export const COUNTRIES = [
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
] as const;

export const CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro", countries: ["SK", "IT", "DE"] },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna", countries: ["CZ"] },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint", countries: ["HU"] },
  { code: "RON", symbol: "lei", name: "Romanian Leu", countries: ["RO"] },
  { code: "USD", symbol: "$", name: "US Dollar", countries: ["US"] },
  { code: "CHF", symbol: "Fr.", name: "Swiss Franc", countries: ["CH"] },
] as const;

// Phone prefixes for countries
export const COUNTRY_PHONE_PREFIXES = [
  { code: "SK", prefix: "+421", name: "Slovakia" },
  { code: "CZ", prefix: "+420", name: "Czech Republic" },
  { code: "HU", prefix: "+36", name: "Hungary" },
  { code: "RO", prefix: "+40", name: "Romania" },
  { code: "IT", prefix: "+39", name: "Italy" },
  { code: "DE", prefix: "+49", name: "Germany" },
  { code: "US", prefix: "+1", name: "USA" },
  { code: "CH", prefix: "+41", name: "Switzerland" },
  { code: "AT", prefix: "+43", name: "Austria" },
  { code: "PL", prefix: "+48", name: "Poland" },
  { code: "UA", prefix: "+380", name: "Ukraine" },
  { code: "GB", prefix: "+44", name: "United Kingdom" },
  { code: "FR", prefix: "+33", name: "France" },
  { code: "ES", prefix: "+34", name: "Spain" },
  { code: "NL", prefix: "+31", name: "Netherlands" },
  { code: "BE", prefix: "+32", name: "Belgium" },
] as const;

export const getCurrencySymbol = (currencyCode: string): string => {
  const currency = CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || "€";
};

export const getCountryCurrency = (countryCode: string): string => {
  const currency = CURRENCIES.find(c => (c.countries as readonly string[]).includes(countryCode));
  return currency?.code || "EUR";
};

// Global country list for address selection
export const WORLD_COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" },
  { code: "CA", name: "Canada" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KR", name: "South Korea" },
  { code: "KW", name: "Kuwait" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MY", name: "Malaysia" },
  { code: "MT", name: "Malta" },
  { code: "MX", name: "Mexico" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" },
  { code: "PK", name: "Pakistan" },
  { code: "PA", name: "Panama" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "RS", name: "Serbia" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TW", name: "Taiwan" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Turkey" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "USA" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
] as const;

export type CountryCode = typeof COUNTRIES[number]["code"];

// Users table - CRM system users who can access the system
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // legacy field - admin, manager, user
  roleId: varchar("role_id"), // FK to roles table - new role system
  isActive: boolean("is_active").notNull().default(true),
  assignedCountries: text("assigned_countries").array().notNull().default(sql`ARRAY[]::text[]`),
  avatarUrl: text("avatar_url"),
  sipEnabled: boolean("sip_enabled").notNull().default(false),
  sipExtension: text("sip_extension").default(""),
  sipPassword: text("sip_password").default(""),
  sipDisplayName: text("sip_display_name").default(""),
  jiraAccountId: text("jira_account_id"),
  jiraDisplayName: text("jira_display_name"),
  authMethod: text("auth_method").notNull().default("local"), // 'local' or 'ms365'
  nexusEnabled: boolean("nexus_enabled").notNull().default(false), // NEXUS AI assistant
  showNotificationBell: boolean("show_notification_bell").notNull().default(true), // Show notification bell in header
  showEmailQueue: boolean("show_email_queue").notNull().default(false), // Show email queue icon in header
  showSipPhone: boolean("show_sip_phone").notNull().default(false), // Show SIP phone icon in header
  phonePrefix: text("phone_prefix"), // Phone country prefix like +421
  phone: text("phone"), // Phone number for notifications/alerts
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Express session store table (connect-pg-simple) - must be in schema to prevent drizzle-kit from dropping it
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// User login sessions for tracking access and preventing duplicate logins
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  loginAt: timestamp("login_at").notNull().default(sql`now()`),
  logoutAt: timestamp("logout_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").notNull().default(true),
  lastActivityAt: timestamp("last_activity_at").notNull().default(sql`now()`),
});

// Configuration tables for settings
// Complaint types - configurable in settings
export const complaintTypes = pgTable("complaint_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryCode: text("country_code"), // null = global
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Cooperation types - configurable in settings
export const cooperationTypes = pgTable("cooperation_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryCode: text("country_code"), // null = global
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// VIP statuses - configurable in settings
export const vipStatuses = pgTable("vip_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryCode: text("country_code"), // null = global
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Collection statuses - status of cord blood collection
// Two branches: 1 = Vydaný (released), 2 = Likvidácia (disposal)
export const collectionStatuses = pgTable("collection_statuses", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().default(""), // e.g. "1", "1.1", "2.3"
  branch: integer("branch").notNull().default(1), // 1 = vydaný, 2 = likvidácia
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Health insurance companies - configurable per country in settings
export const healthInsuranceCompanies = pgTable("health_insurance_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull(), // insurance company code
  countryCode: text("country_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Laboratories - configurable per country in settings
export const laboratories = pgTable("laboratories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Hospitals - main hospital management module
export const hospitals = pgTable("hospitals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legacyId: text("legacy_id"), // Legacy ID from previous CRM
  isActive: boolean("is_active").notNull().default(true), // Aktívna nemocnica
  name: text("name").notNull(), // Meno
  fullName: text("full_name"), // Plné meno
  streetNumber: text("street_number"), // Ulica číslo
  representativeId: varchar("representative_id"), // Reprezentant (FK to users)
  city: text("city"), // Mesto
  laboratoryId: varchar("laboratory_id"), // Laboratórium (FK to laboratories)
  postalCode: text("postal_code"), // PSČ
  autoRecruiting: boolean("auto_recruiting").notNull().default(false), // Auto recruiting
  region: text("region"), // Oblasť
  responsiblePersonId: varchar("responsible_person_id"), // Zodpovedná osoba (FK to users)
  countryCode: text("country_code").notNull(), // Krajina
  contactPerson: text("contact_person"), // Kontaktná osoba
  svetZdravia: boolean("svet_zdravia").notNull().default(false), // Svet zdravia
  phone: text("phone"), // Telefón
  email: text("email"), // Email
  latitude: decimal("latitude", { precision: 10, scale: 7 }), // GPS súradnica
  longitude: decimal("longitude", { precision: 10, scale: 7 }), // GPS súradnica
  createdByCollaboratorId: varchar("created_by_collaborator_id"), // Pridal collaborator cez mobilnú app
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Clinics table - ambulancie (outpatient clinics)
export const clinics = pgTable("clinics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legacyId: text("legacy_id"), // Legacy ID from previous CRM
  name: text("name").notNull(), // Názov ambulancie
  doctorName: text("doctor_name"), // Meno lekára
  address: text("address"), // Adresa
  city: text("city"), // Mesto
  postalCode: text("postal_code"), // PSČ
  countryCode: text("country_code").notNull().default("SK"), // Krajina
  phone: text("phone"), // Telefón
  email: text("email"), // Email
  website: text("website"), // Web stránka ambulancie
  latitude: decimal("latitude", { precision: 10, scale: 7 }), // GPS súradnica
  longitude: decimal("longitude", { precision: 10, scale: 7 }), // GPS súradnica
  isActive: boolean("is_active").notNull().default(true), // Aktívna ambulancia
  notes: text("notes"), // Poznámky
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertClinicSchema = createInsertSchema(clinics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinics.$inferSelect;

// Client status types
export const CLIENT_STATUSES = [
  { value: "potential", label: "Potenciálny klient" },
  { value: "acquired", label: "Získaný klient" },
  { value: "terminated", label: "Ukončený klient" },
] as const;

export type ClientStatus = typeof CLIENT_STATUSES[number]["value"];

// Customers table - cord blood banking customers (extended)
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  internalId: text("internal_id"), // Interné číslo (prenos zo starej aplikácie)
  
  // Tab Klientka - Personal info
  titleBefore: text("title_before"), // Titul pred menom
  firstName: text("first_name").notNull(), // Krstné meno
  lastName: text("last_name").notNull(), // Priezvisko
  maidenName: text("maiden_name"), // Rodné meno
  titleAfter: text("title_after"), // Titul za menom
  phone: text("phone"), // Telefónne číslo
  mobile: text("mobile"), // Mobil
  mobile2: text("mobile_2"), // Mobil 2
  otherContact: text("other_contact"), // Iný kontakt
  email: text("email").notNull(), // Email
  email2: text("email_2"), // Email 2
  nationalId: text("national_id"), // Rodné číslo
  idCardNumber: text("id_card_number"), // Číslo občianskeho preukazu
  dateOfBirth: timestamp("date_of_birth"), // Dátum narodenia
  newsletter: boolean("newsletter").notNull().default(false), // Obžník
  
  // Tab Marketing
  complaintTypeId: varchar("complaint_type_id"), // FK to complaint_types
  cooperationTypeId: varchar("cooperation_type_id"), // FK to cooperation_types
  vipStatusId: varchar("vip_status_id"), // FK to vip_statuses
  
  // Tab Adresy - Permanent address
  country: text("country").notNull(), // Krajina (country code from global list)
  city: text("city"), // Mesto
  address: text("address"), // Ulica a číslo
  postalCode: text("postal_code"), // PSČ
  region: text("region"), // Oblasť
  
  // Correspondence address (if different)
  useCorrespondenceAddress: boolean("use_correspondence_address").notNull().default(false),
  corrName: text("corr_name"), // Meno
  corrAddress: text("corr_address"), // Ulica a číslo domu
  corrCity: text("corr_city"), // Mesto
  corrPostalCode: text("corr_postal_code"), // PSČ
  corrRegion: text("corr_region"), // Oblasť
  corrCountry: text("corr_country"), // Krajina
  
  // Tab Iné - Banking & Health insurance
  bankAccount: text("bank_account"), // Bankový účet (IBAN)
  bankCode: text("bank_code"), // Kód banky
  bankName: text("bank_name"), // Banka
  bankSwift: text("bank_swift"), // SWIFT kód
  healthInsuranceId: varchar("health_insurance_id"), // FK to health_insurance_companies
  
  // Client status
  clientStatus: text("client_status").notNull().default("potential"), // potential, acquired, terminated
  
  // Legacy/existing fields
  status: text("status").notNull().default("active"), // active, pending, inactive
  serviceType: text("service_type"), // cord_blood, cord_tissue, both
  notes: text("notes"),
  assignedUserId: varchar("assigned_user_id"),
  
  // Lead scoring
  leadScore: integer("lead_score").notNull().default(0), // Computed lead score 0-100
  leadScoreUpdatedAt: timestamp("lead_score_updated_at"),
  leadStatus: text("lead_status").notNull().default("cold"), // cold, warm, hot, qualified
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Products table - services/products offered by the company
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  countries: text("countries").array().notNull().default(sql`ARRAY[]::text[]`), // countries where product is available
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Market Product Instances - instances of products for specific markets
export const marketProductInstances = pgTable("market_product_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  countryCode: text("country_code").notNull().default("SK"),
  billingDetailsId: varchar("billing_details_id"),
  name: text("name").notNull(),
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Instance Prices - pricing for market product instances
export const instancePrices = pgTable("instance_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(),
  instanceType: text("instance_type").notNull().default("market"), // market or service
  countryCode: text("country_code"), // optional: specific country for this billing set
  name: text("name").notNull(),
  accountingCode: text("accounting_code"),
  analyticalAccount: text("analytical_account"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  amendment: text("amendment"),
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Instance Payment Options and Fees
export const instancePaymentOptions = pgTable("instance_payment_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(),
  instanceType: text("instance_type").notNull().default("market"), // market or service
  type: text("type"), // payment option type
  name: text("name").notNull(),
  invoiceItemText: text("invoice_item_text"),
  analyticalAccount: text("analytical_account"),
  accountingCode: text("accounting_code"),
  paymentTypeFee: decimal("payment_type_fee", { precision: 10, scale: 2 }),
  amendment: text("amendment"),
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  // Multi-payment installment fields
  isMultiPayment: boolean("is_multi_payment").notNull().default(false),
  frequency: text("frequency"), // monthly, quarterly, semi_annually, annually
  installmentCount: integer("installment_count"),
  calculationMode: text("calculation_mode"), // fixed, percentage
  basePriceId: varchar("base_price_id"), // FK to instance_prices for calculation
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Payment Installments - individual installments for multi-payment options
export const paymentInstallments = pgTable("payment_installments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentOptionId: varchar("payment_option_id").notNull(),
  installmentNumber: integer("installment_number").notNull(),
  label: text("label").notNull(), // "First installment", "Second installment", etc.
  calculationType: text("calculation_type").notNull().default("fixed"), // fixed, percentage
  amount: decimal("amount", { precision: 10, scale: 2 }),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  dueOffsetMonths: integer("due_offset_months").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Instance Discounts and Surcharges
export const instanceDiscounts = pgTable("instance_discounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(),
  instanceType: text("instance_type").notNull().default("market"), // market or service
  type: text("type"), // discount or surcharge type
  name: text("name").notNull(),
  invoiceItemText: text("invoice_item_text"),
  analyticalAccount: text("analytical_account"),
  accountingCode: text("accounting_code"),
  isFixed: boolean("is_fixed").notNull().default(false),
  fixedValue: decimal("fixed_value", { precision: 10, scale: 2 }),
  isPercentage: boolean("is_percentage").notNull().default(false),
  percentageValue: decimal("percentage_value", { precision: 5, scale: 2 }),
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Instance VAT Rates - VAT rates for market instances and services
export const instanceVatRates = pgTable("instance_vat_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(),
  instanceType: text("instance_type").notNull().default("market_instance"), // market_instance or service
  billingDetailsId: varchar("billing_details_id"), // optional accounting company
  category: text("category"),
  accountingCode: text("accounting_code"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }),
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  description: text("description"),
  createAsNewVat: boolean("create_as_new_vat").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertInstanceVatRateSchema = createInsertSchema(instanceVatRates).omit({ id: true, createdAt: true });
export type InsertInstanceVatRate = z.infer<typeof insertInstanceVatRateSchema>;
export type InstanceVatRate = typeof instanceVatRates.$inferSelect;

// Market Product Services - services within market product instances
export const marketProductServices = pgTable("market_product_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(), // FK to market_product_instances
  name: text("name").notNull(),
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  invoiceIdentifier: text("invoice_identifier"),
  invoiceable: boolean("invoiceable").notNull().default(false),
  collectable: boolean("collectable").notNull().default(false),
  storable: boolean("storable").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  blockAutomation: boolean("block_automation").notNull().default(false),
  certificateTemplate: text("certificate_template"),
  description: text("description"),
  // New invoicing fields
  allowProformaInvoices: boolean("allow_proforma_invoices").notNull().default(false),
  invoicingPeriodYears: integer("invoicing_period_years"),
  firstInvoiceAliquote: boolean("first_invoice_aliquote").notNull().default(false),
  constantSymbol: text("constant_symbol"),
  startInvoicing: text("start_invoicing"),
  endInvoicing: text("end_invoicing"),
  accountingIdOffset: integer("accounting_id_offset"),
  ledgerAccountProforma: text("ledger_account_proforma"),
  ledgerAccountInvoice: text("ledger_account_invoice"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Invoice barcode letter options
export const INVOICE_BARCODE_LETTERS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
  { value: "E", label: "E" },
  { value: "F", label: "F" },
  { value: "G", label: "G" },
  { value: "H", label: "H" },
  { value: "I", label: "I" },
  { value: "J", label: "J" },
  { value: "K", label: "K" },
  { value: "L", label: "L" },
  { value: "M", label: "M" },
  { value: "N", label: "N" },
  { value: "O", label: "O" },
  { value: "P", label: "P" },
  { value: "Q", label: "Q" },
  { value: "R", label: "R" },
  { value: "S", label: "S" },
  { value: "T", label: "T" },
  { value: "U", label: "U" },
  { value: "V", label: "V" },
  { value: "W", label: "W" },
  { value: "X", label: "X" },
  { value: "Y", label: "Y" },
  { value: "Z", label: "Z" },
] as const;

// Billing details (billing companies) - multiple per country allowed
export const billingDetails = pgTable("billing_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: text("country_code").notNull(), // Primary country (for backward compatibility)
  countryCodes: text("country_codes").array().notNull().default(sql`ARRAY[]::text[]`), // Multiple countries
  
  // Basic info
  code: text("code"), // Billing company code
  entityCode: text("entity_code"), // Entity code
  invoiceBarcodeLetter: text("invoice_barcode_letter"), // A-Z letter for barcode
  
  // Legacy fields (kept for backward compatibility)
  companyName: text("company_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  postalCode: text("postal_code"),
  taxId: text("tax_id"), // VAT ID / Tax number
  bankName: text("bank_name"),
  bankIban: text("bank_iban"),
  bankSwift: text("bank_swift"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull().default("20"),
  currency: text("currency").notNull().default("EUR"),
  paymentTerms: integer("payment_terms").array().notNull().default(sql`ARRAY[7,14,30]::integer[]`),
  defaultPaymentTerm: integer("default_payment_term").notNull().default(14),
  
  // Postal Address tab
  postalName: text("postal_name"), // Name
  postalStreet: text("postal_street"), // Street + house number
  postalCity: text("postal_city"), // City
  postalPostalCode: text("postal_postal_code"), // PSČ
  postalArea: text("postal_area"), // Area/Region
  postalCountry: text("postal_country"), // Country code
  
  // Residency Address tab
  residencyName: text("residency_name"), // Name
  residencyStreet: text("residency_street"), // Street + house number
  residencyCity: text("residency_city"), // City
  residencyPostalCode: text("residency_postal_code"), // PSČ
  residencyArea: text("residency_area"), // Area/Region
  residencyCountry: text("residency_country"), // Country for residency address
  
  // Details tab
  fullName: text("full_name"), // Full Name
  phone: text("phone"), // Tel. Number
  email: text("email"), // e-mail
  ico: text("ico"), // IČO
  dic: text("dic"), // DIČ
  vatNumber: text("vat_number"), // VAT number
  webFromEmail: text("web_from_email"), // Web "from" email
  coverLetterToEmail: text("cover_letter_to_email"), // Cover letter "to" email
  defaultLanguage: text("default_language"), // Default language (country code)
  sentCollectionKitToClient: boolean("sent_collection_kit_to_client").notNull().default(false),
  allowManualPaymentInsert: boolean("allow_manual_payment_insert").notNull().default(false),
  uidIsMandatory: boolean("uid_is_mandatory").notNull().default(false),
  allowEmptyChildNameInCollection: boolean("allow_empty_child_name_in_collection").notNull().default(false),
  
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Billing company bank accounts - multiple per billing company
export const billingCompanyAccounts = pgTable("billing_company_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingDetailsId: varchar("billing_details_id").notNull(),
  currency: text("currency").notNull().default("EUR"),
  name: text("name"), // Account name
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountBankCode: text("account_bank_code"),
  iban: text("iban"),
  swift: text("swift"),
  validFromDay: integer("valid_from_day"),
  validFromMonth: integer("valid_from_month"),
  validFromYear: integer("valid_from_year"),
  validToDay: integer("valid_to_day"),
  validToMonth: integer("valid_to_month"),
  validToYear: integer("valid_to_year"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Billing company audit log - tracks all changes
export const billingCompanyAuditLog = pgTable("billing_company_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingDetailsId: varchar("billing_details_id").notNull(),
  userId: varchar("user_id").notNull(), // Who made the change
  fieldName: text("field_name").notNull(), // Which field was changed
  oldValue: text("old_value"), // Previous value
  newValue: text("new_value"), // New value
  changeType: text("change_type").notNull().default("update"), // create, update, delete
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Billing company laboratories - junction table
export const billingCompanyLaboratories = pgTable("billing_company_laboratories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingDetailsId: varchar("billing_details_id").notNull(),
  laboratoryId: varchar("laboratory_id").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Billing company collaborators - junction table
export const billingCompanyCollaborators = pgTable("billing_company_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingDetailsId: varchar("billing_details_id").notNull(),
  collaboratorId: varchar("collaborator_id").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Billing company couriers - multiple per billing company
export const billingCompanyCouriers = pgTable("billing_company_couriers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingDetailsId: varchar("billing_details_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Customer products - products assigned to customers
export const customerProducts = pgTable("customer_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  productId: varchar("product_id").notNull(),
  instanceId: varchar("instance_id"), // optional FK to market_product_instances (collection)
  billsetId: varchar("billset_id"), // FK to product_sets (billing set / zostava)
  quantity: integer("quantity").notNull().default(1),
  priceOverride: decimal("price_override", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Invoices table - generated invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  legacyId: text("legacy_id"), // ID from old system
  customerId: varchar("customer_id").notNull(),
  billingDetailsId: varchar("billing_details_id"), // Reference to billing company
  bankAccountId: varchar("bank_account_id"), // Reference to bank account
  productId: varchar("product_id"), // Reference to product
  instancePriceId: varchar("instance_price_id"), // Reference to billing set
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"), // Amount already paid
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull().default("generated"), // generated, sent, paid, partially_paid, overdue, cancelled
  paymentTermDays: integer("payment_term_days").notNull().default(14),
  deliveryDate: timestamp("delivery_date"), // Dátum dodania
  issueDate: timestamp("issue_date"), // Dátum vystavenia
  sendDate: timestamp("send_date"), // Dátum odoslania
  dueDate: timestamp("due_date"), // Dátum splatnosti
  periodFrom: timestamp("period_from"), // Fakturačné obdobie od
  periodTo: timestamp("period_to"), // Fakturačné obdobie do
  variableSymbol: text("variable_symbol"), // Variabilný symbol
  constantSymbol: text("constant_symbol"), // Konštantný symbol
  specificSymbol: text("specific_symbol"), // Špecifický symbol
  barcodeType: text("barcode_type"), // Typ čiarového kódu
  barcodeValue: text("barcode_value"), // Hodnota čiarového kódu
  generatedAt: timestamp("generated_at").notNull().default(sql`now()`),
  pdfPath: text("pdf_path"),
  // Customer snapshot (metadata for template generation)
  customerName: text("customer_name"), // Full name from customers table
  customerAddress: text("customer_address"), // Street address
  customerCity: text("customer_city"),
  customerZip: text("customer_zip"),
  customerCountry: text("customer_country"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerCompanyName: text("customer_company_name"), // If business customer
  customerTaxId: text("customer_tax_id"), // IČO
  customerVatId: text("customer_vat_id"), // DIČ/IČ DPH
  // Billing company snapshot
  billingCompanyName: text("billing_company_name"),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingZip: text("billing_zip"),
  billingCountry: text("billing_country"),
  billingTaxId: text("billing_tax_id"),
  billingVatId: text("billing_vat_id"),
  billingEmail: text("billing_email"),
  billingPhone: text("billing_phone"),
  // Bank account snapshot
  billingBankName: text("billing_bank_name"),
  billingBankIban: text("billing_bank_iban"),
  billingBankSwift: text("billing_bank_swift"),
  billingBankAccountNumber: text("billing_bank_account_number"),
  // QR code configuration
  qrCodeType: text("qr_code_type"), // Type of QR code (PAY by square, etc.)
  qrCodeData: text("qr_code_data"), // Pay by Square QR code data
  epcQrCodeData: text("epc_qr_code_data"), // EPC QR code data (EU standard)
  qrCodeEnabled: boolean("qr_code_enabled").default(false),
  // Invoice items snapshot (JSON for template)
  itemsSnapshot: jsonb("items_snapshot"), // Complete items array with all details
  // Payment tracking (populated via economic system API)
  paymentDate: timestamp("payment_date"), // Date when payment was received
  paymentMethod: text("payment_method"), // bank_transfer, cash, card, etc.
  paymentReference: text("payment_reference"), // External reference from economic system
  // Wizard tracking
  wizardCreatedAt: timestamp("wizard_created_at"), // When invoice was created via wizard
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at"),
});

// Invoice items - individual line items on invoice
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  productId: varchar("product_id"),
  name: text("name").notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("0"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  accountingCode: text("accounting_code"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Invoice payments - payment records for invoices
export const invoicePayments = pgTable("invoice_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  transactionName: text("transaction_name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  amountInAccountingCurrency: decimal("amount_in_accounting_currency", { precision: 10, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmountInAccountingCurrency: decimal("paid_amount_in_accounting_currency", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"), // pending, completed, failed, refunded
  paymentDate: timestamp("payment_date"),
  externalReference: text("external_reference"), // Bank transaction reference
  notes: text("notes"),
  source: text("source").notNull().default("manual"), // manual, automated, bank_import
  createdBy: varchar("created_by"), // user ID who recorded the payment
  createdByName: text("created_by_name"), // display name of user who recorded
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Scheduled invoices - pending installment invoices waiting to be created
export const scheduledInvoices = pgTable("scheduled_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  billingDetailsId: varchar("billing_details_id"),
  bankAccountId: varchar("bank_account_id"),
  numberRangeId: varchar("number_range_id"),
  scheduledDate: timestamp("scheduled_date").notNull(), // When this invoice should be created
  installmentNumber: integer("installment_number").notNull(), // Which installment (2, 3, 4, etc.)
  totalInstallments: integer("total_installments").notNull(), // Total number of installments
  status: text("status").notNull().default("pending"), // pending, created, cancelled
  currency: text("currency").notNull().default("EUR"),
  paymentTermDays: integer("payment_term_days").notNull().default(14),
  variableSymbol: text("variable_symbol"),
  constantSymbol: text("constant_symbol"),
  specificSymbol: text("specific_symbol"),
  barcodeType: text("barcode_type"),
  items: jsonb("items").notNull(), // Array of invoice items
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }),
  parentInvoiceId: varchar("parent_invoice_id"), // Reference to the first invoice in the series
  createdInvoiceId: varchar("created_invoice_id"), // Reference to created invoice (when status = created)
  // Customer snapshot (metadata for template generation)
  customerName: text("customer_name"),
  customerAddress: text("customer_address"),
  customerCity: text("customer_city"),
  customerZip: text("customer_zip"),
  customerCountry: text("customer_country"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerCompanyName: text("customer_company_name"),
  customerTaxId: text("customer_tax_id"),
  customerVatId: text("customer_vat_id"),
  // Billing company snapshot
  billingCompanyName: text("billing_company_name"),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingZip: text("billing_zip"),
  billingCountry: text("billing_country"),
  billingTaxId: text("billing_tax_id"),
  billingVatId: text("billing_vat_id"),
  billingEmail: text("billing_email"),
  billingPhone: text("billing_phone"),
  // Bank account snapshot
  billingBankName: text("billing_bank_name"),
  billingBankIban: text("billing_bank_iban"),
  billingBankSwift: text("billing_bank_swift"),
  billingBankAccountNumber: text("billing_bank_account_number"),
  // QR code configuration
  qrCodeType: text("qr_code_type"),
  qrCodeData: text("qr_code_data"), // Pay by Square QR code data
  epcQrCodeData: text("epc_qr_code_data"), // EPC QR code data (EU standard)
  qrCodeEnabled: boolean("qr_code_enabled").default(false),
  // Wizard tracking
  wizardCreatedAt: timestamp("wizard_created_at"), // When scheduled invoice was created via wizard
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  createdBy: varchar("created_by"),
});

// Customer notes - individual notes on customer records
export const customerNotes = pgTable("customer_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  userId: varchar("user_id").notNull(), // who created the note
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Tasks - tasks assigned to users, optionally linked to customers
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  assignedUserId: varchar("assigned_user_id").notNull(),
  createdByUserId: varchar("created_by_user_id").notNull(),
  customerId: varchar("customer_id"), // optional - link to customer
  country: text("country"), // optional - for filtering by country
  resolution: text("resolution"), // solution/response when completing the task
  resolvedByUserId: varchar("resolved_by_user_id"), // who resolved the task
  resolvedAt: timestamp("resolved_at"), // when task was resolved
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Task comments - communication thread on tasks
export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({ id: true, createdAt: true });
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

export const TASK_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export const TASK_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

// Communication messages - tracks emails and SMS sent to customers
export const communicationMessages = pgTable("communication_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id"),
  userId: varchar("user_id"), // who sent the message
  type: text("type").notNull(), // email, sms
  direction: text("direction").notNull().default("outbound"), // outbound, inbound
  subject: text("subject"), // for emails
  content: text("content").notNull(),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  senderPhone: text("sender_phone"), // for incoming SMS
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed
  externalId: text("external_id"), // BulkGate sms_id or email provider id
  provider: text("provider"), // bulkgate, sendgrid, etc.
  deliveryStatus: text("delivery_status"), // delivery report status
  errorMessage: text("error_message"),
  metadata: text("metadata"), // JSON metadata including compositionDurationSeconds
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  // AI Analysis fields for incoming SMS
  aiAnalyzed: boolean("ai_analyzed").default(false),
  aiSentiment: text("ai_sentiment"), // positive, neutral, negative, angry
  aiAlertLevel: text("ai_alert_level"), // none, warning, critical
  aiHasAngryTone: boolean("ai_has_angry_tone"),
  aiHasRudeExpressions: boolean("ai_has_rude_expressions"),
  aiWantsToCancel: boolean("ai_wants_to_cancel"),
  aiWantsConsent: boolean("ai_wants_consent"),
  aiDoesNotAcceptContract: boolean("ai_does_not_accept_contract"),
  aiAnalysisNote: text("ai_analysis_note"),
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
});

// Saved searches - user saved filter presets
export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  module: text("module").notNull(), // customers, collaborators, hospitals, etc.
  filters: text("filters").notNull(), // JSON string of filter criteria
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true });
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;

// Activity logs - tracks all user actions in the system
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(), // login, logout, create, update, delete, view, export, consent_granted, consent_revoked
  entityType: text("entity_type"), // customer, product, invoice, user, consent, etc.
  entityId: varchar("entity_id"),
  entityName: text("entity_name"), // human-readable name for the entity
  details: text("details"), // JSON string with additional details
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// GDPR Customer Consents - tracks all consent records
export const customerConsents = pgTable("customer_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  consentType: text("consent_type").notNull(), // marketing_email, marketing_sms, data_processing, newsletter, third_party_sharing
  legalBasis: text("legal_basis").notNull(), // consent, contract, legal_obligation, vital_interests, public_task, legitimate_interests
  purpose: text("purpose").notNull(), // description of why data is processed
  granted: boolean("granted").notNull().default(false),
  grantedAt: timestamp("granted_at"),
  grantedByUserId: varchar("granted_by_user_id"), // who recorded the consent
  revokedAt: timestamp("revoked_at"),
  revokedByUserId: varchar("revoked_by_user_id"), // who recorded the revocation
  revokeReason: text("revoke_reason"),
  expiresAt: timestamp("expires_at"), // optional expiration date
  source: text("source"), // web_form, phone, email, in_person
  documentReference: text("document_reference"), // reference to signed document if any
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCustomerConsentSchema = createInsertSchema(customerConsents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomerConsent = z.infer<typeof insertCustomerConsentSchema>;
export type CustomerConsent = typeof customerConsents.$inferSelect;

// GDPR consent types enum
export const CONSENT_TYPES = [
  { value: "marketing_email", label: "Marketing email" },
  { value: "marketing_sms", label: "Marketing SMS" },
  { value: "marketing_phone", label: "Marketing telefón" },
  { value: "data_processing", label: "Spracovanie osobných údajov" },
  { value: "newsletter", label: "Newsletter" },
  { value: "third_party_sharing", label: "Zdieľanie s tretími stranami" },
  { value: "profiling", label: "Profilovanie" },
  { value: "automated_decisions", label: "Automatizované rozhodnutia" },
] as const;

// GDPR legal basis enum
export const LEGAL_BASIS_TYPES = [
  { value: "consent", label: "Súhlas" },
  { value: "contract", label: "Plnenie zmluvy" },
  { value: "legal_obligation", label: "Právna povinnosť" },
  { value: "vital_interests", label: "Životne dôležité záujmy" },
  { value: "public_task", label: "Verejný záujem" },
  { value: "legitimate_interests", label: "Oprávnený záujem" },
] as const;

// GDPR consent source enum
export const CONSENT_SOURCES = [
  { value: "web_form", label: "Webový formulár" },
  { value: "phone", label: "Telefonicky" },
  { value: "email", label: "Emailom" },
  { value: "in_person", label: "Osobne" },
  { value: "signed_document", label: "Podpísaný dokument" },
] as const;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  customers: many(customers),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [customers.assignedUserId],
    references: [users.id],
  }),
  customerProducts: many(customerProducts),
  invoices: many(invoices),
  notes: many(customerNotes),
  consents: many(customerConsents),
}));

export const customerConsentsRelations = relations(customerConsents, ({ one }) => ({
  customer: one(customers, {
    fields: [customerConsents.customerId],
    references: [customers.id],
  }),
  grantedByUser: one(users, {
    fields: [customerConsents.grantedByUserId],
    references: [users.id],
  }),
}));

export const customerNotesRelations = relations(customerNotes, ({ one }) => ({
  customer: one(customers, {
    fields: [customerNotes.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [customerNotes.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const communicationMessagesRelations = relations(communicationMessages, ({ one }) => ({
  customer: one(customers, {
    fields: [communicationMessages.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [communicationMessages.userId],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  customerProducts: many(customerProducts),
}));

export const customerProductsRelations = relations(customerProducts, ({ one }) => ({
  customer: one(customers, {
    fields: [customerProducts.customerId],
    references: [customers.id],
  }),
  product: one(products, {
    fields: [customerProducts.productId],
    references: [products.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  items: many(invoiceItems),
  payments: many(invoicePayments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const invoicePaymentsRelations = relations(invoicePayments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoicePayments.invoiceId],
    references: [invoices.id],
  }),
}));

// Insert schemas with proper optional fields
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().optional().default("user"),
  roleId: z.string().optional().nullable().transform(val => val === "" ? null : val),
  isActive: z.boolean().optional().default(true),
  assignedCountries: z.array(z.string()).optional().default([]),
});

// Schema for updating user (password optional)
export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(6).optional(),
  role: z.string().optional(),
  roleId: z.string().optional().nullable().transform(val => val === "" ? null : val),
  isActive: z.boolean().optional(),
  assignedCountries: z.array(z.string()).optional(),
});

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// User sessions schema for access logging
export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  loginAt: true,
  lastActivityAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
}).extend({
  // Personal info
  titleBefore: z.string().optional().nullable(),
  maidenName: z.string().optional().nullable(),
  titleAfter: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  mobile2: z.string().optional().nullable(),
  otherContact: z.string().optional().nullable(),
  email2: z.string().email().optional().nullable().or(z.literal("")),
  nationalId: z.string().optional().nullable(),
  idCardNumber: z.string().optional().nullable(),
  dateOfBirth: z.union([z.date(), z.string()]).optional().nullable().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  newsletter: z.boolean().optional().default(false),
  // Marketing
  complaintTypeId: z.string().optional().nullable(),
  cooperationTypeId: z.string().optional().nullable(),
  vipStatusId: z.string().optional().nullable(),
  // Address
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  // Correspondence address
  useCorrespondenceAddress: z.boolean().optional().default(false),
  corrName: z.string().optional().nullable(),
  corrAddress: z.string().optional().nullable(),
  corrCity: z.string().optional().nullable(),
  corrPostalCode: z.string().optional().nullable(),
  corrRegion: z.string().optional().nullable(),
  corrCountry: z.string().optional().nullable(),
  // Banking & health
  bankAccount: z.string().optional().nullable(),
  bankCode: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankSwift: z.string().optional().nullable(),
  healthInsuranceId: z.string().optional().nullable(),
  // Status
  clientStatus: z.string().optional().default("potential"),
  status: z.string().optional().default("pending"),
  serviceType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
});

// Configuration table schemas
export const insertComplaintTypeSchema = createInsertSchema(complaintTypes).omit({
  id: true,
  createdAt: true,
}).extend({
  countryCode: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const insertCooperationTypeSchema = createInsertSchema(cooperationTypes).omit({
  id: true,
  createdAt: true,
}).extend({
  countryCode: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const insertVipStatusSchema = createInsertSchema(vipStatuses).omit({
  id: true,
  createdAt: true,
}).extend({
  countryCode: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const insertCollectionStatusSchema = createInsertSchema(collectionStatuses).omit({
  createdAt: true,
}).extend({
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const insertHealthInsuranceSchema = createInsertSchema(healthInsuranceCompanies).omit({
  id: true,
  createdAt: true,
}).extend({
  isActive: z.boolean().optional().default(true),
});

// Laboratory schemas
export const insertLaboratorySchema = createInsertSchema(laboratories).omit({
  id: true,
  createdAt: true,
}).extend({
  isActive: z.boolean().optional().default(true),
});

// Hospital schemas
export const insertHospitalSchema = createInsertSchema(hospitals).omit({
  id: true,
  createdAt: true,
}).extend({
  isActive: z.boolean().optional().default(true),
  fullName: z.string().optional().nullable(),
  streetNumber: z.string().optional().nullable(),
  representativeId: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  laboratoryId: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  autoRecruiting: z.boolean().optional().default(false),
  region: z.string().optional().nullable(),
  responsiblePersonId: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  svetZdravia: z.boolean().optional().default(false),
});

// Product schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
}).extend({
  description: z.string().optional().nullable(),
  countries: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

// Market Product Instance schemas
export const insertMarketProductInstanceSchema = createInsertSchema(marketProductInstances).omit({
  id: true,
  createdAt: true,
}).extend({
  productId: z.string(),
  name: z.string().min(1),
  fromDate: z.string().optional().nullable(),
  toDate: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  description: z.string().optional().nullable(),
});

export type InsertMarketProductInstance = z.infer<typeof insertMarketProductInstanceSchema>;
export type MarketProductInstance = typeof marketProductInstances.$inferSelect;

// Instance Prices schemas
export const insertInstancePriceSchema = createInsertSchema(instancePrices).omit({
  id: true,
  createdAt: true,
}).extend({
  instanceId: z.string(),
  instanceType: z.string().optional().default("market"),
  countryCode: z.string().optional().nullable(),
  name: z.string().min(1),
  analyticalAccount: z.string().optional().nullable(),
  price: z.string(),
  currency: z.string().optional().default("EUR"),
  amendment: z.string().optional().nullable(),
  fromDate: z.string().optional().nullable(),
  toDate: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  description: z.string().optional().nullable(),
});

export type InsertInstancePrice = z.infer<typeof insertInstancePriceSchema>;
export type InstancePrice = typeof instancePrices.$inferSelect;

// Instance Payment Options schemas
export const insertInstancePaymentOptionSchema = createInsertSchema(instancePaymentOptions).omit({
  id: true,
  createdAt: true,
}).extend({
  instanceId: z.string(),
  instanceType: z.string().optional().default("market"),
  type: z.string().optional().nullable(),
  name: z.string().min(1),
  invoiceItemText: z.string().optional().nullable(),
  analyticalAccount: z.string().optional().nullable(),
  accountingCode: z.string().optional().nullable(),
  paymentTypeFee: z.string().optional().nullable(),
  amendment: z.string().optional().nullable(),
  fromDate: z.string().optional().nullable(),
  toDate: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  description: z.string().optional().nullable(),
  isMultiPayment: z.boolean().optional().default(false),
  frequency: z.string().optional().nullable(),
  installmentCount: z.number().int().optional().nullable(),
  calculationMode: z.string().optional().nullable(),
  basePriceId: z.string().optional().nullable(),
});

export type InsertInstancePaymentOption = z.infer<typeof insertInstancePaymentOptionSchema>;
export type InstancePaymentOption = typeof instancePaymentOptions.$inferSelect;

// Payment Installments schemas
export const insertPaymentInstallmentSchema = createInsertSchema(paymentInstallments).omit({
  id: true,
  createdAt: true,
}).extend({
  paymentOptionId: z.string(),
  installmentNumber: z.number().int(),
  label: z.string().min(1),
  calculationType: z.string().optional().default("fixed"),
  amount: z.string().optional().nullable(),
  percentage: z.string().optional().nullable(),
  dueOffsetMonths: z.number().int().optional().default(0),
});

export type InsertPaymentInstallment = z.infer<typeof insertPaymentInstallmentSchema>;
export type PaymentInstallment = typeof paymentInstallments.$inferSelect;

// Instance Discounts schemas
export const insertInstanceDiscountSchema = createInsertSchema(instanceDiscounts).omit({
  id: true,
  createdAt: true,
}).extend({
  instanceId: z.string(),
  instanceType: z.string().optional().default("market"),
  type: z.string().optional().nullable(),
  name: z.string().min(1),
  invoiceItemText: z.string().optional().nullable(),
  analyticalAccount: z.string().optional().nullable(),
  accountingCode: z.string().optional().nullable(),
  isFixed: z.boolean().optional().default(false),
  fixedValue: z.string().optional().nullable(),
  isPercentage: z.boolean().optional().default(false),
  percentageValue: z.string().optional().nullable(),
  fromDate: z.string().optional().nullable(),
  toDate: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  description: z.string().optional().nullable(),
});

export type InsertInstanceDiscount = z.infer<typeof insertInstanceDiscountSchema>;
export type InstanceDiscount = typeof instanceDiscounts.$inferSelect;

// Market Product Services schemas
export const insertMarketProductServiceSchema = createInsertSchema(marketProductServices).omit({
  id: true,
  createdAt: true,
}).extend({
  instanceId: z.string(),
  name: z.string().min(1),
  fromDate: z.string().optional().nullable(),
  toDate: z.string().optional().nullable(),
  invoiceIdentifier: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  blockAutomation: z.boolean().optional().default(false),
  certificateTemplate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  // New invoicing fields
  allowProformaInvoices: z.boolean().optional().default(false),
  invoicingPeriodYears: z.number().int().min(1).max(50).optional().nullable(),
  firstInvoiceAliquote: z.boolean().optional().default(false),
  constantSymbol: z.string().optional().nullable(),
  startInvoicing: z.string().optional().nullable(),
  endInvoicing: z.string().optional().nullable(),
  accountingIdOffset: z.number().int().optional().nullable(),
  ledgerAccountProforma: z.string().optional().nullable(),
  ledgerAccountInvoice: z.string().optional().nullable(),
});

export type InsertMarketProductService = z.infer<typeof insertMarketProductServiceSchema>;
export type MarketProductService = typeof marketProductServices.$inferSelect;

// Billing details schemas
export const insertBillingDetailsSchema = createInsertSchema(billingDetails).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
}).extend({
  code: z.string().optional().nullable(),
  entityCode: z.string().optional().nullable(),
  invoiceBarcodeLetter: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankIban: z.string().optional().nullable(),
  bankSwift: z.string().optional().nullable(),
  vatRate: z.string().optional().default("20"),
  currency: z.string().optional().default("EUR"),
  paymentTerms: z.array(z.number().int().positive()).optional().default([7, 14, 30]),
  defaultPaymentTerm: z.number().int().positive().optional().default(14),
  // Postal Address tab
  postalName: z.string().optional().nullable(),
  postalStreet: z.string().optional().nullable(),
  postalCity: z.string().optional().nullable(),
  postalPostalCode: z.string().optional().nullable(),
  postalArea: z.string().optional().nullable(),
  postalCountry: z.string().optional().nullable(),
  // Details tab
  fullName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  ico: z.string().optional().nullable(),
  dic: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  webFromEmail: z.string().optional().nullable(),
  coverLetterToEmail: z.string().optional().nullable(),
  defaultLanguage: z.string().optional().nullable(),
  sentCollectionKitToClient: z.boolean().optional().default(false),
  allowManualPaymentInsert: z.boolean().optional().default(false),
  uidIsMandatory: z.boolean().optional().default(false),
  allowEmptyChildNameInCollection: z.boolean().optional().default(false),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

// Billing company accounts schemas
export const insertBillingCompanyAccountSchema = createInsertSchema(billingCompanyAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  currency: z.string().optional().default("EUR"),
  name: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountBankCode: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  swift: z.string().optional().nullable(),
  validFromDay: z.number().int().min(1).max(31).optional().nullable(),
  validFromMonth: z.number().int().min(1).max(12).optional().nullable(),
  validFromYear: z.number().int().optional().nullable(),
  validToDay: z.number().int().min(1).max(31).optional().nullable(),
  validToMonth: z.number().int().min(1).max(12).optional().nullable(),
  validToYear: z.number().int().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
  description: z.string().optional().nullable(),
});

// Billing company audit log schemas
export const insertBillingCompanyAuditLogSchema = createInsertSchema(billingCompanyAuditLog).omit({
  id: true,
  createdAt: true,
}).extend({
  oldValue: z.string().optional().nullable(),
  newValue: z.string().optional().nullable(),
  changeType: z.string().optional().default("update"),
});

// Billing company laboratories schemas
export const insertBillingCompanyLaboratorySchema = createInsertSchema(billingCompanyLaboratories).omit({
  id: true,
  createdAt: true,
});

// Billing company collaborators schemas
export const insertBillingCompanyCollaboratorSchema = createInsertSchema(billingCompanyCollaborators).omit({
  id: true,
  createdAt: true,
});

// Billing company couriers schemas
export const insertBillingCompanyCourierSchema = createInsertSchema(billingCompanyCouriers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional().default(true),
  description: z.string().optional().nullable(),
});

// Invoice item schemas
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
}).extend({
  productId: z.string().optional().nullable(),
  quantity: z.number().int().positive().optional().default(1),
});

export const insertScheduledInvoiceSchema = createInsertSchema(scheduledInvoices).omit({
  id: true,
  createdAt: true,
  createdInvoiceId: true,
}).extend({
  status: z.string().optional().default("pending"),
});

// Customer product schemas
export const insertCustomerProductSchema = createInsertSchema(customerProducts).omit({
  id: true,
  createdAt: true,
}).extend({
  quantity: z.number().int().positive().optional().default(1),
  priceOverride: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Invoice schemas
export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  generatedAt: true,
}).extend({
  status: z.string().optional().default("generated"),
  pdfPath: z.string().optional().nullable(),
  currency: z.string().optional().default("EUR"),
  subtotal: z.string().optional().nullable(),
  vatRate: z.string().optional().nullable(),
  vatAmount: z.string().optional().nullable(),
  paymentTermDays: z.number().int().positive().optional().default(14),
  dueDate: z.date().optional().nullable(),
  billingCompanyName: z.string().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  billingCity: z.string().optional().nullable(),
  billingTaxId: z.string().optional().nullable(),
  billingBankName: z.string().optional().nullable(),
  billingBankIban: z.string().optional().nullable(),
  billingBankSwift: z.string().optional().nullable(),
});

// Customer notes schemas
export const insertCustomerNoteSchema = createInsertSchema(customerNotes).omit({
  id: true,
  createdAt: true,
});

// Activity logs schemas
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  entityType: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  entityName: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
});

// Communication message schemas
export const insertCommunicationMessageSchema = createInsertSchema(communicationMessages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
}).extend({
  subject: z.string().optional().nullable(),
  recipientEmail: z.string().optional().nullable(),
  recipientPhone: z.string().optional().nullable(),
  status: z.string().optional().default("pending"),
  errorMessage: z.string().optional().nullable(),
});

// Schema for sending email
export const sendEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Message content is required"),
});

// Schema for sending SMS
export const sendSmsSchema = z.object({
  content: z.string().min(1, "Message content is required").max(160, "SMS must be 160 characters or less"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type LoginInput = z.infer<typeof loginSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertCustomerProduct = z.infer<typeof insertCustomerProductSchema>;
export type CustomerProduct = typeof customerProducts.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertBillingDetails = z.infer<typeof insertBillingDetailsSchema>;
export type BillingDetails = typeof billingDetails.$inferSelect;
export type InsertBillingCompanyAccount = z.infer<typeof insertBillingCompanyAccountSchema>;
export type BillingCompanyAccount = typeof billingCompanyAccounts.$inferSelect;
export type InsertBillingCompanyAuditLog = z.infer<typeof insertBillingCompanyAuditLogSchema>;
export type BillingCompanyAuditLog = typeof billingCompanyAuditLog.$inferSelect;
export type InsertBillingCompanyLaboratory = z.infer<typeof insertBillingCompanyLaboratorySchema>;
export type BillingCompanyLaboratory = typeof billingCompanyLaboratories.$inferSelect;
export type InsertBillingCompanyCollaborator = z.infer<typeof insertBillingCompanyCollaboratorSchema>;
export type BillingCompanyCollaborator = typeof billingCompanyCollaborators.$inferSelect;
export type InsertBillingCompanyCourier = z.infer<typeof insertBillingCompanyCourierSchema>;
export type BillingCompanyCourier = typeof billingCompanyCouriers.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertScheduledInvoice = z.infer<typeof insertScheduledInvoiceSchema>;
export type ScheduledInvoice = typeof scheduledInvoices.$inferSelect;
export type InsertCustomerNote = z.infer<typeof insertCustomerNoteSchema>;
export type CustomerNote = typeof customerNotes.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertCommunicationMessage = z.infer<typeof insertCommunicationMessageSchema>;
export type CommunicationMessage = typeof communicationMessages.$inferSelect;
export type InsertComplaintType = z.infer<typeof insertComplaintTypeSchema>;
export type ComplaintType = typeof complaintTypes.$inferSelect;
export type InsertCooperationType = z.infer<typeof insertCooperationTypeSchema>;
export type CooperationType = typeof cooperationTypes.$inferSelect;
export type InsertVipStatus = z.infer<typeof insertVipStatusSchema>;
export type VipStatus = typeof vipStatuses.$inferSelect;
export type InsertCollectionStatus = z.infer<typeof insertCollectionStatusSchema>;
export type CollectionStatus = typeof collectionStatuses.$inferSelect;
export type InsertHealthInsurance = z.infer<typeof insertHealthInsuranceSchema>;
export type HealthInsurance = typeof healthInsuranceCompanies.$inferSelect;
export type InsertLaboratory = z.infer<typeof insertLaboratorySchema>;
export type Laboratory = typeof laboratories.$inferSelect;
export type InsertHospital = z.infer<typeof insertHospitalSchema>;
export type Hospital = typeof hospitals.$inferSelect;

// ==================== COLLABORATORS MODULE ====================

// Collaborator types
export const COLLABORATOR_TYPES = [
  { value: "doctor", labelKey: "doctor" },
  { value: "nurse", labelKey: "nurse" },
  { value: "resident", labelKey: "resident" },
  { value: "callCenter", labelKey: "callCenter" },
  { value: "headNurse", labelKey: "headNurse" },
  { value: "bm", labelKey: "bm" },
  { value: "vedono", labelKey: "vedono" },
  { value: "external", labelKey: "external" },
  { value: "representative", labelKey: "representative" },
  { value: "other", labelKey: "other" },
] as const;

export type CollaboratorType = typeof COLLABORATOR_TYPES[number]["value"];

// Marital status
export const MARITAL_STATUSES = [
  { value: "single", labelKey: "single" },
  { value: "married", labelKey: "married" },
  { value: "divorced", labelKey: "divorced" },
  { value: "widowed", labelKey: "widowed" },
] as const;

export type MaritalStatus = typeof MARITAL_STATUSES[number]["value"];

// Reward types for agreements
export const REWARD_TYPES = [
  { value: "recruitment", labelKey: "recruitment" },
  { value: "assistance", labelKey: "assistance" },
  { value: "puk_collection", labelKey: "pukCollection" },
  { value: "plk_collection", labelKey: "plkCollection" },
  { value: "tpu_collection", labelKey: "tpuCollection" },
  { value: "tpl_collection", labelKey: "tplCollection" },
  { value: "informing", labelKey: "informing" },
  { value: "emergency_grant", labelKey: "emergencyGrant" },
  { value: "prophylaxis", labelKey: "prophylaxis" },
  { value: "head_nurse", labelKey: "headNurse" },
  { value: "lecture", labelKey: "lecture" },
  { value: "management", labelKey: "management" },
  { value: "disability_card", labelKey: "disabilityCard" },
  { value: "old_age_pension", labelKey: "oldAgePension" },
  { value: "widow_pension", labelKey: "widowPension" },
  { value: "vip", labelKey: "vip" },
  { value: "dpa_signed", labelKey: "dpaSigned" },
  { value: "monthly_rewarding_signed", labelKey: "monthlyRewardingSigned" },
  { value: "internal_employee", labelKey: "internalEmployee" },
  { value: "contact_person_reward", labelKey: "contactPersonReward" },
  { value: "responsible_person_reward", labelKey: "responsiblePersonReward" },
] as const;

export type RewardType = typeof REWARD_TYPES[number]["value"];

// Address types for collaborator addresses
export const ADDRESS_TYPES = [
  { value: "permanent", labelKey: "permanent" },
  { value: "correspondence", labelKey: "correspondence" },
  { value: "work", labelKey: "work" },
  { value: "company", labelKey: "company" },
] as const;

export type AddressType = typeof ADDRESS_TYPES[number]["value"];

// Collaborators table - main collaborator data
export const collaborators = pgTable("collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legacyId: text("legacy_id"), // Legacy ID from previous CRM
  
  // Basic info
  countryCode: text("country_code").notNull(), // Primary country (for backward compatibility)
  countryCodes: text("country_codes").array().notNull().default(sql`ARRAY[]::text[]`), // Multiple countries
  titleBefore: text("title_before"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  maidenName: text("maiden_name"),
  titleAfter: text("title_after"),
  
  // Birth info
  birthNumber: text("birth_number"),
  birthDay: integer("birth_day"),
  birthMonth: integer("birth_month"),
  birthYear: integer("birth_year"),
  birthPlace: text("birth_place"),
  
  // Health and status
  healthInsuranceId: varchar("health_insurance_id"),
  maritalStatus: text("marital_status"),
  collaboratorType: text("collaborator_type"),
  
  // Contact info
  phone: text("phone"),
  mobile: text("mobile"),
  mobile2: text("mobile_2"),
  otherContact: text("other_contact"),
  email: text("email"),
  
  // Bank info
  bankAccountIban: text("bank_account_iban"),
  swiftCode: text("swift_code"),
  
  // Flags
  clientContact: boolean("client_contact").notNull().default(false),
  representativeId: varchar("representative_id"), // Legacy - single representative
  representativeIds: text("representative_ids").array().notNull().default(sql`ARRAY[]::text[]`), // Multiple representatives by country
  isActive: boolean("is_active").notNull().default(true),
  svetZdravia: boolean("svet_zdravia").notNull().default(false),
  
  // Company info
  companyName: text("company_name"),
  ico: text("ico"),
  dic: text("dic"),
  icDph: text("ic_dph"),
  companyIban: text("company_iban"),
  companySwift: text("company_swift"),
  
  // Other
  monthRewards: boolean("month_rewards").notNull().default(false),
  rewardType: text("reward_type"), // 'fixed' | 'percentage' | null
  fixedRewardAmount: text("fixed_reward_amount"),
  fixedRewardCurrency: text("fixed_reward_currency").default("EUR"),
  percentageRewards: jsonb("percentage_rewards").$type<Record<string, string>>().default({}),
  note: text("note"),
  hospitalId: varchar("hospital_id"),
  hospitalIds: text("hospital_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  
  // INDEXUS Connect mobile app access
  mobileAppEnabled: boolean("mobile_app_enabled").notNull().default(false),
  mobileUsername: text("mobile_username"),
  mobilePasswordHash: text("mobile_password_hash"),
  canEditHospitals: boolean("can_edit_hospitals").notNull().default(false), // Permission to add/edit hospitals
  lastMobileLogin: timestamp("last_mobile_login"),
  mobileLastActiveAt: timestamp("mobile_last_active_at"), // Updated on every mobile API request
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Collaborator addresses table
export const collaboratorAddresses = pgTable("collaborator_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legacyId: text("legacy_id"), // Legacy ID from previous CRM
  collaboratorId: varchar("collaborator_id").notNull(),
  addressType: text("address_type").notNull(), // permanent, correspondence, work, company
  name: text("name"),
  streetNumber: text("street_number"),
  city: text("city"),
  postalCode: text("postal_code"),
  region: text("region"),
  countryCode: text("country_code"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Collaborator other data (disability, pensions)
export const collaboratorOtherData = pgTable("collaborator_other_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legacyId: text("legacy_id"), // Legacy ID from previous CRM
  collaboratorId: varchar("collaborator_id").notNull().unique(),
  
  // ZŤP (disability)
  ztpDay: integer("ztp_day"),
  ztpMonth: integer("ztp_month"),
  ztpYear: integer("ztp_year"),
  
  // Old-age pension
  oldAgePensionDay: integer("old_age_pension_day"),
  oldAgePensionMonth: integer("old_age_pension_month"),
  oldAgePensionYear: integer("old_age_pension_year"),
  
  // Disability pension
  disabilityPensionDay: integer("disability_pension_day"),
  disabilityPensionMonth: integer("disability_pension_month"),
  disabilityPensionYear: integer("disability_pension_year"),
  
  // Widow pension
  widowPensionDay: integer("widow_pension_day"),
  widowPensionMonth: integer("widow_pension_month"),
  widowPensionYear: integer("widow_pension_year"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Collaborator agreements table
export const collaboratorAgreements = pgTable("collaborator_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legacyId: text("legacy_id"), // Legacy ID from previous CRM
  collaboratorId: varchar("collaborator_id").notNull(),
  
  // File info
  fileName: text("file_name"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  fileContentType: text("file_content_type"),
  extractedText: text("extracted_text"),
  
  // Agreement details
  billingCompanyId: varchar("billing_company_id"),
  contractNumber: text("contract_number"),
  
  // Valid from (day/month/year)
  validFromDay: integer("valid_from_day"),
  validFromMonth: integer("valid_from_month"),
  validFromYear: integer("valid_from_year"),
  
  // Valid to (day/month/year)
  validToDay: integer("valid_to_day"),
  validToMonth: integer("valid_to_month"),
  validToYear: integer("valid_to_year"),
  
  isValid: boolean("is_valid").notNull().default(true),
  
  // Agreement sent (day/month/year)
  agreementSentDay: integer("agreement_sent_day"),
  agreementSentMonth: integer("agreement_sent_month"),
  agreementSentYear: integer("agreement_sent_year"),
  
  // Agreement returned (day/month/year)
  agreementReturnedDay: integer("agreement_returned_day"),
  agreementReturnedMonth: integer("agreement_returned_month"),
  agreementReturnedYear: integer("agreement_returned_year"),
  
  agreementForm: text("agreement_form"),
  rewardTypes: text("reward_types").array().default(sql`ARRAY[]::text[]`),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Collaborator schemas
const emptyStringToNull = z.preprocess(
  (val) => (val === "" ? null : val),
  z.string().optional().nullable()
);

const optionalEmail = z.preprocess(
  (val) => (val === "" ? null : val),
  z.string().email().optional().nullable()
);

const optionalDay = z.preprocess(
  (val) => (val === 0 || val === "" || val === null || val === undefined ? null : val),
  z.number().min(1).max(31).optional().nullable()
);

const optionalMonth = z.preprocess(
  (val) => (val === 0 || val === "" || val === null || val === undefined ? null : val),
  z.number().min(1).max(12).optional().nullable()
);

const optionalYear = z.preprocess(
  (val) => (val === 0 || val === "" || val === null || val === undefined ? null : val),
  z.number().min(1900).max(2100).optional().nullable()
);

export const insertCollaboratorSchema = createInsertSchema(collaborators).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  countryCode: z.string().min(1, "Country is required"),
  birthDay: optionalDay,
  birthMonth: optionalMonth,
  birthYear: optionalYear,
  email: optionalEmail,
  legacyId: emptyStringToNull,
  titleBefore: emptyStringToNull,
  maidenName: emptyStringToNull,
  titleAfter: emptyStringToNull,
  birthNumber: emptyStringToNull,
  birthPlace: emptyStringToNull,
  maritalStatus: emptyStringToNull,
  collaboratorType: emptyStringToNull,
  phone: emptyStringToNull,
  mobile: emptyStringToNull,
  mobile2: emptyStringToNull,
  otherContact: emptyStringToNull,
  bankAccountIban: emptyStringToNull,
  swiftCode: emptyStringToNull,
  companyName: emptyStringToNull,
  ico: emptyStringToNull,
  dic: emptyStringToNull,
  icDph: emptyStringToNull,
  companyIban: emptyStringToNull,
  companySwift: emptyStringToNull,
  note: emptyStringToNull,
  representativeId: emptyStringToNull,
  hospitalId: emptyStringToNull,
  healthInsuranceId: emptyStringToNull,
});

export const insertCollaboratorAddressSchema = createInsertSchema(collaboratorAddresses).omit({
  id: true,
  createdAt: true,
}).extend({
  collaboratorId: z.string().min(1, "Collaborator ID is required"),
  addressType: z.string().min(1, "Address type is required"),
});

export const insertCollaboratorOtherDataSchema = createInsertSchema(collaboratorOtherData).omit({
  id: true,
  createdAt: true,
}).extend({
  collaboratorId: z.string().min(1, "Collaborator ID is required"),
});

export const insertCollaboratorAgreementSchema = createInsertSchema(collaboratorAgreements).omit({
  id: true,
  createdAt: true,
}).extend({
  collaboratorId: z.string().min(1, "Collaborator ID is required"),
  rewardTypes: z.array(z.string()).optional().default([]),
});

// Collaborator types
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;
export type Collaborator = typeof collaborators.$inferSelect;
export type InsertCollaboratorAddress = z.infer<typeof insertCollaboratorAddressSchema>;
export type CollaboratorAddress = typeof collaboratorAddresses.$inferSelect;
export type InsertCollaboratorOtherData = z.infer<typeof insertCollaboratorOtherDataSchema>;
export type CollaboratorOtherData = typeof collaboratorOtherData.$inferSelect;
export type InsertCollaboratorAgreement = z.infer<typeof insertCollaboratorAgreementSchema>;
export type CollaboratorAgreement = typeof collaboratorAgreements.$inferSelect;

// Visit Events - INDEXUS Connect field visit records
export const visitEvents = pgTable("visit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collaboratorId: varchar("collaborator_id").notNull(),
  countryCode: text("country_code").notNull(),
  
  // Subject/Type of visit
  subject: text("subject").notNull(), // visit type code (1-12)
  
  // Time
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isAllDay: boolean("is_all_day").notNull().default(false),
  
  // Location (GPS coordinates captured from mobile)
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  locationAddress: text("location_address"), // Reverse geocoded address
  
  // Hospital reference
  hospitalId: varchar("hospital_id"),
  
  // Remark - can be text or voice transcription
  remark: text("remark"),
  remarkVoiceUrl: text("remark_voice_url"), // URL to audio file if voice recorded
  
  // Remark detail (visited person type: 1-7)
  remarkDetail: text("remark_detail"),
  
  // Type of visit (1-12)
  visitType: text("visit_type"),
  
  // Place (1-6)
  place: text("place"),
  
  // Visit execution status and actual times
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled, not_realized
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  
  // GPS coordinates at start
  startLatitude: decimal("start_latitude", { precision: 10, scale: 7 }),
  startLongitude: decimal("start_longitude", { precision: 10, scale: 7 }),
  
  // GPS coordinates at end (completion)
  endLatitude: decimal("end_latitude", { precision: 10, scale: 7 }),
  endLongitude: decimal("end_longitude", { precision: 10, scale: 7 }),
  
  // Legacy status flags
  isCancelled: boolean("is_cancelled").notNull().default(false),
  isNotRealized: boolean("is_not_realized").notNull().default(false),
  
  // Sync info
  syncedFromMobile: boolean("synced_from_mobile").notNull().default(false),
  mobileDeviceInfo: text("mobile_device_info"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertVisitEventSchema = createInsertSchema(visitEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  collaboratorId: z.string().min(1, "Collaborator ID is required"),
  countryCode: z.string().min(1, "Country is required"),
  subject: z.string().min(1, "Subject is required"),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
});

export type InsertVisitEvent = z.infer<typeof insertVisitEventSchema>;
export type VisitEvent = typeof visitEvents.$inferSelect;

// Voice Notes for Visit Events (mobile app voice recordings)
export const voiceNotes = pgTable("voice_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitEventId: varchar("visit_event_id").notNull(),
  collaboratorId: varchar("collaborator_id").notNull(),
  
  filePath: text("file_path").notNull(),
  fileName: text("file_name"),
  durationSeconds: integer("duration_seconds"),
  fileSize: integer("file_size"),
  
  transcription: text("transcription"),
  isTranscribed: boolean("is_transcribed").notNull().default(false),
  transcriptionLanguage: text("transcription_language"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertVoiceNoteSchema = createInsertSchema(voiceNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
export type VoiceNote = typeof voiceNotes.$inferSelect;

// Mobile Push Notification Tokens
export const mobilePushTokens = pgTable("mobile_push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collaboratorId: varchar("collaborator_id").notNull(),
  
  token: text("token").notNull(),
  platform: text("platform").notNull(), // 'ios', 'android', 'expo'
  deviceId: text("device_id"),
  deviceName: text("device_name"),
  
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertMobilePushTokenSchema = createInsertSchema(mobilePushTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMobilePushToken = z.infer<typeof insertMobilePushTokenSchema>;
export type MobilePushToken = typeof mobilePushTokens.$inferSelect;

// Visit event subject/type options (localized)
export const VISIT_SUBJECTS = [
  { code: "1", en: "Standard visit to strengthen recommendations and CBC cooperation", sk: "Štandardná návšteva na posilnenie odporúčaní a spolupráce CBC", cs: "Standardní návštěva k posílení doporučení a spolupráce CBC", hu: "Ajánlásokat és CBC együttműködést erősítő standard látogatás", ro: "Vizită standard pentru consolidarea recomandărilor și cooperării CBC", it: "Visita standard per rafforzare raccomandazioni e cooperazione CBC", de: "Standardbesuch zur Stärkung von Empfehlungen und CBC-Kooperation" },
  { code: "2", en: "Individual training - collection process", sk: "Individuálne školenie - proces odberu", cs: "Individuální školení - proces odběru", hu: "Egyéni képzés – levétel menete", ro: "Instruire individuală - procesul de colectare", it: "Formazione individuale - processo di raccolta", de: "Einzelschulung - Entnahmeprozess" },
  { code: "3", en: "Examination of problematic collection", sk: "Preskúmanie problémového odberu", cs: "Prošetření problémového odběru", hu: "Problémás levétel kivizsgálása", ro: "Examinarea colectării problematice", it: "Esame della raccolta problematica", de: "Untersuchung problematischer Entnahme" },
  { code: "4", en: "Hospital kit delivery", sk: "Dodanie nemocničnej súpravy", cs: "Dodání nemocniční soupravy", hu: "Kórházi szett átadás", ro: "Livrarea kitului de spital", it: "Consegna kit ospedaliero", de: "Krankenhauskit-Lieferung" },
  { code: "5", en: "Pregnancy preparation lecture for pregnant women", sk: "Prednáška prípravy na pôrod pre tehotné", cs: "Přednáška přípravy na porod pro těhotné", hu: "Szülésfelkészítő előadás várandósoknak", ro: "Curs de pregătire pentru naștere pentru gravide", it: "Corso di preparazione al parto per gestanti", de: "Geburtsvorbereitung für Schwangere" },
  { code: "6", en: "Group lecture for midwives", sk: "Skupinová prednáška pre pôrodné asistentky", cs: "Skupinová přednáška pro porodní asistentky", hu: "Csoportos előadás szülésznőknek", ro: "Curs de grup pentru moașe", it: "Corso di gruppo per ostetriche", de: "Gruppenvortrag für Hebammen" },
  { code: "7", en: "Group lecture for doctors", sk: "Skupinová prednáška pre lekárov", cs: "Skupinová přednáška pro lékaře", hu: "Csoportos előadás orvosoknak", ro: "Curs de grup pentru medici", it: "Corso di gruppo per medici", de: "Gruppenvortrag für Ärzte" },
  { code: "8", en: "Hospital contract management", sk: "Správa nemocničnej zmluvy", cs: "Správa nemocniční smlouvy", hu: "Kórházi szerződés intézése", ro: "Gestionarea contractului de spital", it: "Gestione contratto ospedaliero", de: "Krankenhausvertragsmanagement" },
  { code: "9", en: "Doctor contract management", sk: "Správa lekárskej zmluvy", cs: "Správa lékařské smlouvy", hu: "Orvosi szerződés intézése", ro: "Gestionarea contractului de medic", it: "Gestione contratto medico", de: "Arztvertragsmanagement" },
  { code: "10", en: "Business partner contract management - other collaborator", sk: "Správa zmluvy s obchodným partnerom - iný spolupracovník", cs: "Správa smlouvy s obchodním partnerem - jiný spolupracovník", hu: "Üzleti partner szerződés intézése – egyéb együttműködő", ro: "Gestionarea contractului partener de afaceri - alt colaborator", it: "Gestione contratto partner commerciale - altro collaboratore", de: "Geschäftspartnervertragsmanagement - anderer Mitarbeiter" },
  { code: "11", en: "Other", sk: "Iné", cs: "Jiné", hu: "Egyéb", ro: "Altele", it: "Altro", de: "Sonstiges" },
  { code: "12", en: "Phone call / Video conference", sk: "Telefonát / Videokonferencia", cs: "Telefonát / Videokonference", hu: "Telefonhívás / Videokonferencia", ro: "Apel telefonic / Videoconferință", it: "Telefonata / Videoconferenza", de: "Telefonat / Videokonferenz" },
] as const;

// Remark detail options (visited person type)
export const REMARK_DETAIL_OPTIONS = [
  { code: "1", en: "Price", sk: "Cena", cs: "Cena", hu: "Ár", ro: "Preț", it: "Prezzo", de: "Preis" },
  { code: "2", en: "Competitors", sk: "Konkurencia", cs: "Konkurence", hu: "Versenytársak", ro: "Concurenți", it: "Concorrenti", de: "Wettbewerber" },
  { code: "3", en: "Doctor", sk: "Lekár", cs: "Lékař", hu: "Orvos", ro: "Medic", it: "Medico", de: "Arzt" },
  { code: "4", en: "Resident", sk: "Rezident", cs: "Rezident", hu: "Rezidens", ro: "Rezident", it: "Residente", de: "Assistenzarzt" },
  { code: "5", en: "Midwife", sk: "Pôrodná asistentka", cs: "Porodní asistentka", hu: "Szülésznő", ro: "Moașă", it: "Ostetrica", de: "Hebamme" },
  { code: "6", en: "Business partner - other collaborator", sk: "Obchodný partner - iný spolupracovník", cs: "Obchodní partner - jiný spolupracovník", hu: "Üzleti partner – egyéb együttműködő", ro: "Partener de afaceri - alt colaborator", it: "Partner commerciale - altro collaboratore", de: "Geschäftspartner - anderer Mitarbeiter" },
  { code: "7", en: "Other", sk: "Iné", cs: "Jiné", hu: "Egyéb", ro: "Altele", it: "Altro", de: "Sonstiges" },
] as const;

// Place options
export const VISIT_PLACE_OPTIONS = [
  { code: "1", en: "Department of Obstetrics, Hospital", sk: "Pôrodnícke oddelenie, Nemocnica", cs: "Porodnické oddělení, Nemocnice", hu: "Kórház szülészeti osztálya", ro: "Secția de obstetrică, Spital", it: "Reparto di Ostetricia, Ospedale", de: "Geburtshilfe-Abteilung, Krankenhaus" },
  { code: "2", en: "Private doctor's office", sk: "Súkromná ordinácia lekára", cs: "Soukromá ordinace lékaře", hu: "Orvos magánrendelője", ro: "Cabinet medical privat", it: "Studio medico privato", de: "Private Arztpraxis" },
  { code: "3", en: "State doctor's office", sk: "Štátna ordinácia lekára", cs: "Státní ordinace lékaře", hu: "Orvos szakrendelője", ro: "Cabinet medical de stat", it: "Studio medico statale", de: "Staatliche Arztpraxis" },
  { code: "4", en: "Hospital management department", sk: "Vedenie nemocnice", cs: "Vedení nemocnice", hu: "Kórház vezetőségi osztály", ro: "Departamentul de management al spitalului", it: "Direzione ospedaliera", de: "Krankenhausverwaltung" },
  { code: "5", en: "Other", sk: "Iné", cs: "Jiné", hu: "Egyéb", ro: "Altele", it: "Altro", de: "Sonstiges" },
  { code: "6", en: "Phone call / Video conference", sk: "Telefonát / Videokonferencia", cs: "Telefonát / Videokonference", hu: "Telefonhívás / Videokonferencia", ro: "Apel telefonic / Videoconferință", it: "Telefonata / Videoconferenza", de: "Telefonat / Videokonferenz" },
] as const;

// Customer Potential Cases - extended data for potential clients
export const customerPotentialCases = pgTable("customer_potential_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().unique(),
  
  // Tab Stav (Status)
  caseStatus: text("case_status"), // Zrealizovaný, Duplikát, Prebieha, Odložený, Nezáujem, Zrušený
  
  // Tab Odber (Collection)
  expectedDateDay: integer("expected_date_day"),
  expectedDateMonth: integer("expected_date_month"),
  expectedDateYear: integer("expected_date_year"),
  hospitalId: varchar("hospital_id"),
  obstetricianId: varchar("obstetrician_id"),
  isMultiplePregnancy: boolean("is_multiple_pregnancy").notNull().default(false),
  childCount: integer("child_count").default(1),
  
  // Tab Otec (Father)
  fatherTitleBefore: text("father_title_before"),
  fatherFirstName: text("father_first_name"),
  fatherLastName: text("father_last_name"),
  fatherTitleAfter: text("father_title_after"),
  fatherPhone: text("father_phone"),
  fatherMobile: text("father_mobile"),
  fatherEmail: text("father_email"),
  fatherStreet: text("father_street"),
  fatherCity: text("father_city"),
  fatherPostalCode: text("father_postal_code"),
  fatherRegion: text("father_region"),
  fatherCountry: text("father_country"),
  
  // Tab Produkt (Product)
  productId: varchar("product_id"),
  productType: text("product_type"),
  paymentType: text("payment_type"),
  giftVoucher: text("gift_voucher"),
  contactDateDay: integer("contact_date_day"),
  contactDateMonth: integer("contact_date_month"),
  contactDateYear: integer("contact_date_year"),
  existingContracts: text("existing_contracts"),
  recruiting: text("recruiting"),
  
  // Tab Iné (Other)
  salesChannel: text("sales_channel"), // CCP, CCP+D, CCAI, CCAI+D, CCAE, CCAE+D, I
  infoSource: text("info_source"), // Internet, Friends, Doctor, etc.
  marketingAction: text("marketing_action"),
  marketingCode: text("marketing_code"),
  newsletterOptIn: boolean("newsletter_opt_in").notNull().default(false),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Case status enum values
export const CASE_STATUSES = [
  "realized", // Zrealizovaný
  "duplicate", // Duplikát
  "in_progress", // Prebieha
  "postponed", // Odložený
  "no_interest", // Nezáujem
  "cancelled", // Zrušený
] as const;

// Sales channel enum values
export const SALES_CHANNELS = [
  "CCP", // Pasívne call centrum
  "CCP+D", // Pasívne call centrum + lekár
  "CCAI", // Aktívne interné call centrum
  "CCAI+D", // Aktívne interné call centrum + lekár
  "CCAE", // Aktívne externé call centrum
  "CCAE+D", // Aktívne externé call centrum + lekár
  "I", // Internet
] as const;

// Info source enum values
export const INFO_SOURCES = [
  "internet",
  "friends",
  "doctor",
  "positive_experience",
  "conference",
  "tv",
  "radio",
  "prenatal_course",
  "hospital_doctor",
  "other",
] as const;

// Customer potential case schema
export const insertCustomerPotentialCaseSchema = createInsertSchema(customerPotentialCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  customerId: z.string().min(1, "Customer ID is required"),
  childCount: z.number().min(1).max(20).optional().nullable(),
  expectedDateDay: z.number().min(1).max(31).optional().nullable(),
  expectedDateMonth: z.number().min(1).max(12).optional().nullable(),
  expectedDateYear: z.number().min(1900).max(2100).optional().nullable(),
  contactDateDay: z.number().min(1).max(31).optional().nullable(),
  contactDateMonth: z.number().min(1).max(12).optional().nullable(),
  contactDateYear: z.number().min(1900).max(2100).optional().nullable(),
  fatherEmail: z.string().email().optional().nullable().or(z.literal("")),
});

export type InsertCustomerPotentialCase = z.infer<typeof insertCustomerPotentialCaseSchema>;
export type CustomerPotentialCase = typeof customerPotentialCases.$inferSelect;

// Lead status enum values
export const LEAD_STATUSES = [
  "cold",      // New lead, no interaction
  "warm",      // Some engagement shown
  "hot",       // High engagement, ready to convert
  "qualified", // Qualified lead, active discussion
] as const;

// Lead scoring criteria table - configurable scoring rules
export const leadScoringCriteria = pgTable("lead_scoring_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Criterion name
  description: text("description"),
  category: text("category").notNull(), // demographic, engagement, behavior, profile
  field: text("field").notNull(), // Field to evaluate (e.g., "hasPhone", "hasEmail", "hasCase", "newsletterOptIn")
  condition: text("condition").notNull(), // equals, not_empty, greater_than, less_than, contains
  value: text("value"), // Value to compare against
  points: integer("points").notNull().default(0), // Points to add/subtract
  isActive: boolean("is_active").notNull().default(true),
  countryCode: text("country_code"), // null = global, or specific country
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertLeadScoringCriteriaSchema = createInsertSchema(leadScoringCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLeadScoringCriteria = z.infer<typeof insertLeadScoringCriteriaSchema>;
export type LeadScoringCriteria = typeof leadScoringCriteria.$inferSelect;

// Service configurations for Konfigurator
export const serviceConfigurations = pgTable("service_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceCode: text("service_code").notNull(), // e.g., "CORD_BLOOD", "CORD_TISSUE"
  serviceName: text("service_name").notNull(), // Display name
  description: text("description"),
  countryCode: text("country_code").notNull(), // Country this config applies to
  isActive: boolean("is_active").notNull().default(true),
  invoiceable: boolean("invoiceable").notNull().default(false), // Can be invoiced
  collectable: boolean("collectable").notNull().default(false), // Can be collected
  storable: boolean("storable").notNull().default(false), // Can be stored
  basePrice: decimal("base_price", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("EUR"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }),
  processingDays: integer("processing_days"), // Standard processing time
  storageYears: integer("storage_years"), // Storage duration
  additionalOptions: text("additional_options"), // JSON string of extra options
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertServiceConfigurationSchema = createInsertSchema(serviceConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertServiceConfiguration = z.infer<typeof insertServiceConfigurationSchema>;
export type ServiceConfiguration = typeof serviceConfigurations.$inferSelect;

// Service instances - specific instances of services with invoicing configuration
export const serviceInstances = pgTable("service_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull(), // Reference to serviceConfigurations
  // Detail tab fields
  name: text("name").notNull(),
  fromDate: date("from_date"),
  toDate: date("to_date"),
  invoiceIdentifier: text("invoice_identifier"), // Empty for now
  isActive: boolean("is_active").notNull().default(true),
  certificateTemplate: text("certificate_template"), // Empty for now
  description: text("description"),
  // Invoicing tab fields
  billingDetailsId: varchar("billing_details_id"), // Reference to billingDetails (export invoicing to)
  allowProformaInvoices: boolean("allow_proforma_invoices").notNull().default(false),
  invoicingPeriodYears: integer("invoicing_period_years").default(1), // 1-100
  constantSymbol: text("constant_symbol"),
  startInvoicingField: text("start_invoicing_field").default("REALIZED"),
  endInvoicingField: text("end_invoicing_field"),
  accountingIdOffset: integer("accounting_id_offset"),
  ledgerAccountProforma: text("ledger_account_proforma"), // Numeric string
  ledgerAccountInvoice: text("ledger_account_invoice"), // Numeric string
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertServiceInstanceSchema = createInsertSchema(serviceInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertServiceInstance = z.infer<typeof insertServiceInstanceSchema>;
export type ServiceInstance = typeof serviceInstances.$inferSelect;

// Number ranges - for invoice/proforma/contract numbering configuration
export const numberRanges = pgTable("number_ranges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  billingDetailsId: varchar("billing_details_id"), // Reference to billing company
  year: integer("year").notNull(),
  useServiceCode: boolean("use_service_code").notNull().default(false),
  type: text("type").notNull().default("invoice"), // invoice, proforma, contract
  prefix: text("prefix"),
  suffix: text("suffix"),
  digitsToGenerate: integer("digits_to_generate").notNull().default(6),
  startNumber: integer("start_number").notNull().default(1),
  endNumber: integer("end_number").notNull().default(999999),
  lastNumberUsed: integer("last_number_used").default(0),
  accountingCode: text("accounting_code"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertNumberRangeSchema = createInsertSchema(numberRanges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNumberRange = z.infer<typeof insertNumberRangeSchema>;
export type NumberRange = typeof numberRanges.$inferSelect;

// Invoice templates for Konfigurator
export const invoiceTemplates = pgTable("invoice_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  countryCode: text("country_code").notNull(),
  languageCode: text("language_code").notNull().default("en"), // Template language
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  templateType: text("template_type").notNull().default("standard"), // standard, proforma, credit_note
  headerHtml: text("header_html"), // Custom header content
  footerHtml: text("footer_html"), // Custom footer content
  logoPath: text("logo_path"), // Path to logo file
  primaryColor: text("primary_color").default("#6B2346"), // Brand color
  showVat: boolean("show_vat").notNull().default(true),
  showPaymentQr: boolean("show_payment_qr").notNull().default(false),
  paymentInstructions: text("payment_instructions"),
  legalText: text("legal_text"),
  docxTemplatePath: text("docx_template_path"), // Path to DOCX template file
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertInvoiceTemplateSchema = createInsertSchema(invoiceTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoiceTemplate = z.infer<typeof insertInvoiceTemplateSchema>;
export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;

// Invoice layout configurations - for the invoice editor
export const invoiceLayouts = pgTable("invoice_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  layoutConfig: text("layout_config").notNull(), // JSON configuration of layout
  paperSize: text("paper_size").notNull().default("A4"), // A4, Letter, etc.
  orientation: text("orientation").notNull().default("portrait"),
  marginTop: integer("margin_top").default(20),
  marginBottom: integer("margin_bottom").default(20),
  marginLeft: integer("margin_left").default(15),
  marginRight: integer("margin_right").default(15),
  fontSize: integer("font_size").default(10),
  fontFamily: text("font_family").default("Arial"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertInvoiceLayoutSchema = createInsertSchema(invoiceLayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoiceLayout = z.infer<typeof insertInvoiceLayoutSchema>;
export type InvoiceLayout = typeof invoiceLayouts.$inferSelect;

// DOCX Templates for invoice generation
export const docxTemplates = pgTable("docx_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  filePath: text("file_path").notNull(), // Path to uploaded DOCX file
  originalFileName: text("original_file_name"), // Original uploaded filename
  countryCode: text("country_code"), // Country-specific template (SK, CZ, HU, RO, IT, DE, US)
  year: integer("year"), // Year for which the template is valid
  version: integer("version").notNull().default(1), // Version number for revisions
  parentTemplateId: varchar("parent_template_id"), // Reference to parent template for version history
  templateType: text("template_type").notNull().default("invoice"), // invoice, proforma, credit_note
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"), // User who uploaded the template
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertDocxTemplateSchema = createInsertSchema(docxTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocxTemplate = z.infer<typeof insertDocxTemplateSchema>;
export type DocxTemplate = typeof docxTemplates.$inferSelect;

// Departments table - organizational structure
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  parentId: varchar("parent_id"), // FK to self for hierarchy
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  contactFirstName: text("contact_first_name"),
  contactLastName: text("contact_last_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

// Roles table - custom roles for RBAC
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  department: text("department"), // management, sales, operations, finance, customer_service, it, medical
  legacyRole: text("legacy_role"), // Maps to legacy role enum (admin, manager, user) for backward compatibility
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false), // system roles cannot be deleted
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  createdBy: varchar("created_by"), // FK to users
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Role module permissions - which modules a role can access
export const roleModulePermissions = pgTable("role_module_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  moduleKey: text("module_key").notNull(), // dashboard, customers, hospitals, etc.
  access: text("access").notNull().default("visible"), // visible, hidden
  canAdd: boolean("can_add").notNull().default(true), // can add new records
  canEdit: boolean("can_edit").notNull().default(true), // can edit existing records
});

export const insertRoleModulePermissionSchema = createInsertSchema(roleModulePermissions).omit({
  id: true,
});

export type InsertRoleModulePermission = z.infer<typeof insertRoleModulePermissionSchema>;
export type RoleModulePermission = typeof roleModulePermissions.$inferSelect;

// Role field permissions - field-level access within modules
export const roleFieldPermissions = pgTable("role_field_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  moduleKey: text("module_key").notNull(),
  fieldKey: text("field_key").notNull(),
  permission: text("permission").notNull().default("editable"), // editable, readonly, hidden
});

export const insertRoleFieldPermissionSchema = createInsertSchema(roleFieldPermissions).omit({
  id: true,
});

export type InsertRoleFieldPermission = z.infer<typeof insertRoleFieldPermissionSchema>;
export type RoleFieldPermission = typeof roleFieldPermissions.$inferSelect;

// User roles assignment - assign roles to users (many-to-many)
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  roleId: varchar("role_id").notNull(),
  assignedAt: timestamp("assigned_at").notNull().default(sql`now()`),
  assignedBy: varchar("assigned_by"), // FK to users
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  assignedAt: true,
});

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

// Campaigns - marketing/sales campaigns with dynamic criteria
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("marketing"), // marketing, sales, follow_up, retention, upsell, other
  channel: text("channel").notNull().default("phone"), // phone, email, sms, mixed - communication channel for the campaign
  status: text("status").notNull().default("draft"), // draft, active, paused, completed, cancelled
  countryCodes: text("country_codes").array().notNull().default(sql`ARRAY[]::text[]`),
  criteria: text("criteria"), // JSON string with filter criteria
  settings: text("settings"), // JSON string with schedule/settings
  script: text("script"), // Operator script - instructions for call center agents
  defaultActiveTab: text("default_active_tab").default("phone"), // phone, script, email, sms - which tab opens first when agent activates contact
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  targetContactCount: integer("target_contact_count").default(0),
  conversionGoal: numeric("conversion_goal", { precision: 5, scale: 2 }).default("0"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const CAMPAIGN_CHANNELS = ["phone", "email", "sms", "mixed"] as const;
export type CampaignChannel = typeof CAMPAIGN_CHANNELS[number];

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  description: z.string().optional().nullable(),
  type: z.enum(["marketing", "sales", "follow_up", "retention", "upsell", "other"]).optional().default("marketing"),
  channel: z.enum(["phone", "email", "sms", "mixed"]).optional().default("phone"),
  status: z.enum(["draft", "active", "paused", "completed", "cancelled"]).optional().default("draft"),
  countryCodes: z.array(z.string()).optional().default([]),
  criteria: z.string().optional().nullable(),
  settings: z.string().optional().nullable(),
  script: z.string().optional().nullable(),
  defaultActiveTab: z.enum(["phone", "script", "email", "sms"]).optional().default("phone"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  targetContactCount: z.number().optional().default(0),
  conversionGoal: z.string().optional().default("0"),
  createdBy: z.string().optional().nullable(),
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// Campaign agents - users assigned to work on a campaign
export const campaignAgents = pgTable("campaign_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("agent"), // agent, supervisor
  assignedAt: timestamp("assigned_at").notNull().default(sql`now()`),
  assignedBy: varchar("assigned_by"),
});

export const insertCampaignAgentSchema = createInsertSchema(campaignAgents).omit({
  id: true,
  assignedAt: true,
});
export type InsertCampaignAgent = z.infer<typeof insertCampaignAgentSchema>;
export type CampaignAgent = typeof campaignAgents.$inferSelect;

// Agent workspace access - controls which users can access Agent Workspace for which countries
export const agentWorkspaceAccess = pgTable("agent_workspace_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  countryCode: text("country_code").notNull(), // SK, CZ, HU, RO, IT, DE, US
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  createdBy: varchar("created_by"),
});

export const insertAgentWorkspaceAccessSchema = createInsertSchema(agentWorkspaceAccess).omit({
  id: true,
  createdAt: true,
});
export type InsertAgentWorkspaceAccess = z.infer<typeof insertAgentWorkspaceAccessSchema>;
export type AgentWorkspaceAccess = typeof agentWorkspaceAccess.$inferSelect;

// Campaign contacts - customers targeted in a campaign
export const campaignContacts = pgTable("campaign_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, contacted, completed, failed, no_answer, callback_scheduled, not_interested
  assignedTo: varchar("assigned_to"), // user id
  notes: text("notes"),
  dispositionCode: text("disposition_code"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  priorityScore: integer("priority_score").notNull().default(50), // 0-100, higher = more priority
  callbackDate: timestamp("callback_date"),
  contactedAt: timestamp("contacted_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCampaignContactSchema = createInsertSchema(campaignContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["pending", "contacted", "completed", "failed", "no_answer", "callback_scheduled", "not_interested"]).optional().default("pending"),
  assignedTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  dispositionCode: z.string().optional().nullable(),
  attemptCount: z.number().optional().default(0),
  lastAttemptAt: z.string().optional().nullable(),
  priorityScore: z.number().optional().default(50),
  callbackDate: z.string().optional().nullable(),
  contactedAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
});

export type InsertCampaignContact = z.infer<typeof insertCampaignContactSchema>;
export type CampaignContact = typeof campaignContacts.$inferSelect;

// Campaign contact history - log of all interactions
export const campaignContactHistory = pgTable("campaign_contact_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignContactId: varchar("campaign_contact_id").notNull(),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(), // status_change, note_added, callback_set
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCampaignContactHistorySchema = createInsertSchema(campaignContactHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertCampaignContactHistory = z.infer<typeof insertCampaignContactHistorySchema>;
export type CampaignContactHistory = typeof campaignContactHistory.$inferSelect;

// Campaign templates - reusable campaign configurations
export const campaignTemplates = pgTable("campaign_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("marketing"),
  countryCodes: text("country_codes").array().notNull().default(sql`ARRAY[]::text[]`),
  criteria: text("criteria"),
  settings: text("settings"),
  script: text("script"),
  isDefault: boolean("is_default").notNull().default(false),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCampaignTemplateSchema = createInsertSchema(campaignTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  description: z.string().optional().nullable(),
  type: z.enum(["marketing", "sales", "follow_up", "retention", "upsell", "other"]).optional().default("marketing"),
  countryCodes: z.array(z.string()).optional().default([]),
  criteria: z.string().optional().nullable(),
  settings: z.string().optional().nullable(),
  script: z.string().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  createdBy: z.string().optional().nullable(),
});

export type InsertCampaignTemplate = z.infer<typeof insertCampaignTemplateSchema>;
export type CampaignTemplate = typeof campaignTemplates.$inferSelect;

// Campaign schedules - working hours and scheduling rules
export const campaignSchedules = pgTable("campaign_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().unique(),
  workingDays: text("working_days").array().notNull().default(sql`ARRAY['monday','tuesday','wednesday','thursday','friday']::text[]`),
  workingHoursStart: text("working_hours_start").notNull().default("09:00"),
  workingHoursEnd: text("working_hours_end").notNull().default("17:00"),
  maxAttemptsPerContact: integer("max_attempts_per_contact").notNull().default(3),
  minHoursBetweenAttempts: integer("min_hours_between_attempts").notNull().default(24),
  autoAssignContacts: boolean("auto_assign_contacts").notNull().default(true),
  prioritizeCallbacks: boolean("prioritize_callbacks").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCampaignScheduleSchema = createInsertSchema(campaignSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  workingDays: z.array(z.string()).optional().default(["monday", "tuesday", "wednesday", "thursday", "friday"]),
  workingHoursStart: z.string().optional().default("09:00"),
  workingHoursEnd: z.string().optional().default("17:00"),
  maxAttemptsPerContact: z.number().optional().default(3),
  minHoursBetweenAttempts: z.number().optional().default(24),
  autoAssignContacts: z.boolean().optional().default(true),
  prioritizeCallbacks: z.boolean().optional().default(true),
});

export type InsertCampaignSchedule = z.infer<typeof insertCampaignScheduleSchema>;
export type CampaignSchedule = typeof campaignSchedules.$inferSelect;

// Campaign operator settings - operator assignments with workload weights
export const campaignOperatorSettings = pgTable("campaign_operator_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  userId: varchar("user_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  workloadWeight: integer("workload_weight").notNull().default(100), // 100 = normal, 50 = half load
  maxContactsPerDay: integer("max_contacts_per_day").default(50),
  assignedCountries: text("assigned_countries").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCampaignOperatorSettingSchema = createInsertSchema(campaignOperatorSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  isActive: z.boolean().optional().default(true),
  workloadWeight: z.number().optional().default(100),
  maxContactsPerDay: z.number().optional().nullable().default(50),
  assignedCountries: z.array(z.string()).optional().default([]),
});

export type InsertCampaignOperatorSetting = z.infer<typeof insertCampaignOperatorSettingSchema>;
export type CampaignOperatorSetting = typeof campaignOperatorSettings.$inferSelect;

// Campaign contact sessions - individual call/contact attempt logs
export const campaignContactSessions = pgTable("campaign_contact_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignContactId: varchar("campaign_contact_id").notNull(),
  userId: varchar("user_id").notNull(),
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
  outcome: text("outcome").notNull().default("pending"), // pending, answered, no_answer, busy, voicemail, failed
  notes: text("notes"),
  callbackScheduled: boolean("callback_scheduled").default(false),
  callbackDate: timestamp("callback_date"),
});

export const insertCampaignContactSessionSchema = createInsertSchema(campaignContactSessions).omit({
  id: true,
}).extend({
  startedAt: z.string().optional(),
  endedAt: z.string().optional().nullable(),
  durationSeconds: z.number().optional().nullable(),
  outcome: z.enum(["pending", "answered", "no_answer", "busy", "voicemail", "failed"]).optional().default("pending"),
  notes: z.string().optional().nullable(),
  callbackScheduled: z.boolean().optional().default(false),
  callbackDate: z.string().optional().nullable(),
});

export type InsertCampaignContactSession = z.infer<typeof insertCampaignContactSessionSchema>;
export type CampaignContactSession = typeof campaignContactSessions.$inferSelect;

// Campaign metrics snapshots - aggregated metrics for reporting
export const campaignMetricsSnapshots = pgTable("campaign_metrics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  snapshotHour: integer("snapshot_hour"), // null for daily snapshots, 0-23 for hourly
  totalContacts: integer("total_contacts").notNull().default(0),
  pendingContacts: integer("pending_contacts").notNull().default(0),
  contactedContacts: integer("contacted_contacts").notNull().default(0),
  completedContacts: integer("completed_contacts").notNull().default(0),
  failedContacts: integer("failed_contacts").notNull().default(0),
  totalCalls: integer("total_calls").notNull().default(0),
  successfulCalls: integer("successful_calls").notNull().default(0),
  avgCallDurationSeconds: integer("avg_call_duration_seconds").default(0),
  conversionRate: numeric("conversion_rate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCampaignMetricsSnapshotSchema = createInsertSchema(campaignMetricsSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertCampaignMetricsSnapshot = z.infer<typeof insertCampaignMetricsSnapshotSchema>;
export type CampaignMetricsSnapshot = typeof campaignMetricsSnapshots.$inferSelect;

// Campaign dispositions - configurable contact outcomes per campaign
export const campaignDispositions = pgTable("campaign_dispositions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  parentId: varchar("parent_id"),
  name: text("name").notNull(),
  code: text("code").notNull(),
  channel: text("channel").notNull().default("phone"),
  icon: text("icon"),
  color: text("color"),
  actionType: text("action_type").notNull().default("none"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const DISPOSITION_ACTION_TYPES = ["none", "callback", "dnd", "complete", "convert", "send_email", "send_sms", "schedule_email", "schedule_sms"] as const;
export type DispositionActionType = typeof DISPOSITION_ACTION_TYPES[number];

export const insertCampaignDispositionSchema = createInsertSchema(campaignDispositions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  parentId: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  actionType: z.enum(DISPOSITION_ACTION_TYPES).optional().default("none"),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0),
});

export type InsertCampaignDisposition = z.infer<typeof insertCampaignDispositionSchema>;
export type CampaignDisposition = typeof campaignDispositions.$inferSelect;

export const DEFAULT_PHONE_DISPOSITIONS = [
  { name: "Záujem", code: "interested", icon: "ThumbsUp", color: "green", actionType: "convert" as const, channel: "phone" as const, children: [
    { name: "Chce informácie", code: "wants_info", icon: "Info", color: "green" },
    { name: "Chce stretnutie", code: "wants_meeting", icon: "Calendar", color: "green" },
    { name: "Chce cenovú ponuku", code: "wants_quote", icon: "FileText", color: "green" },
  ]},
  { name: "Zavolať neskôr", code: "callback", icon: "CalendarPlus", color: "blue", actionType: "callback" as const, channel: "phone" as const, children: [
    { name: "Požiadal o termín", code: "requested_date", icon: "Calendar", color: "blue" },
    { name: "Nemal čas", code: "no_time", icon: "Clock", color: "blue" },
    { name: "Chce rozmyslieť", code: "thinking", icon: "Clock", color: "blue" },
  ]},
  { name: "Nezáujem", code: "not_interested", icon: "ThumbsDown", color: "orange", actionType: "complete" as const, channel: "phone" as const, children: [
    { name: "Momentálne nie", code: "not_now", icon: "Clock", color: "orange" },
    { name: "Nikdy", code: "never", icon: "XCircle", color: "orange" },
    { name: "Má konkurenciu", code: "has_competitor", icon: "Users", color: "orange" },
  ]},
  { name: "Nedvíha", code: "no_answer", icon: "PhoneOff", color: "gray", actionType: "none" as const, channel: "phone" as const, children: [] },
  { name: "Obsadené", code: "busy", icon: "Phone", color: "yellow", actionType: "callback" as const, channel: "phone" as const, children: [] },
  { name: "Hlasová schránka", code: "voicemail", icon: "MessageSquare", color: "gray", actionType: "callback" as const, channel: "phone" as const, children: [] },
  { name: "Zlé číslo", code: "wrong_number", icon: "AlertCircle", color: "red", actionType: "complete" as const, channel: "phone" as const, children: [] },
  { name: "Nevolať (DND)", code: "dnd", icon: "XCircle", color: "red", actionType: "dnd" as const, channel: "phone" as const, children: [] },
];

export const DEFAULT_EMAIL_DISPOSITIONS = [
  { name: "Email odoslaný", code: "email_sent", icon: "Send", color: "green", actionType: "send_email" as const, channel: "email" as const, children: [] },
  { name: "Odpovedal - záujem", code: "replied_interested", icon: "ThumbsUp", color: "green", actionType: "convert" as const, channel: "email" as const, children: [] },
  { name: "Odpovedal - nezáujem", code: "replied_not_interested", icon: "ThumbsDown", color: "orange", actionType: "complete" as const, channel: "email" as const, children: [] },
  { name: "Neodpovedal", code: "no_reply", icon: "Clock", color: "gray", actionType: "none" as const, channel: "email" as const, children: [] },
  { name: "Email neplatný", code: "invalid_email", icon: "AlertCircle", color: "red", actionType: "complete" as const, channel: "email" as const, children: [] },
  { name: "Odhlásený", code: "unsubscribed", icon: "XCircle", color: "red", actionType: "dnd" as const, channel: "email" as const, children: [] },
  { name: "Naplánovať ďalší email", code: "schedule_next_email", icon: "CalendarPlus", color: "blue", actionType: "schedule_email" as const, channel: "email" as const, children: [] },
  { name: "Preposlať neskôr", code: "resend_later", icon: "CalendarPlus", color: "blue", actionType: "callback" as const, channel: "email" as const, children: [] },
];

export const DEFAULT_SMS_DISPOSITIONS = [
  { name: "SMS odoslaná", code: "sms_sent", icon: "Send", color: "green", actionType: "send_sms" as const, channel: "sms" as const, children: [] },
  { name: "Odpovedal - záujem", code: "sms_replied_interested", icon: "ThumbsUp", color: "green", actionType: "convert" as const, channel: "sms" as const, children: [] },
  { name: "Odpovedal - nezáujem", code: "sms_replied_not_interested", icon: "ThumbsDown", color: "orange", actionType: "complete" as const, channel: "sms" as const, children: [] },
  { name: "Neodpovedal", code: "sms_no_reply", icon: "Clock", color: "gray", actionType: "none" as const, channel: "sms" as const, children: [] },
  { name: "Číslo neplatné", code: "invalid_number", icon: "AlertCircle", color: "red", actionType: "complete" as const, channel: "sms" as const, children: [] },
  { name: "Odhlásený", code: "sms_unsubscribed", icon: "XCircle", color: "red", actionType: "dnd" as const, channel: "sms" as const, children: [] },
  { name: "Naplánovať ďalšiu SMS", code: "schedule_next_sms", icon: "CalendarPlus", color: "blue", actionType: "schedule_sms" as const, channel: "sms" as const, children: [] },
];

export const DISPOSITION_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  interested: { en: 'Interested', sk: 'Záujem', cs: 'Zájem', hu: 'Érdeklődik', ro: 'Interesat', it: 'Interessato', de: 'Interessiert' },
  wants_info: { en: 'Wants information', sk: 'Chce informácie', cs: 'Chce informace', hu: 'Információt kér', ro: 'Vrea informații', it: 'Vuole informazioni', de: 'Möchte Informationen' },
  wants_meeting: { en: 'Wants meeting', sk: 'Chce stretnutie', cs: 'Chce schůzku', hu: 'Találkozót kér', ro: 'Vrea întâlnire', it: 'Vuole incontro', de: 'Möchte Treffen' },
  wants_quote: { en: 'Wants quote', sk: 'Chce cenovú ponuku', cs: 'Chce cenovou nabídku', hu: 'Árajánlatot kér', ro: 'Vrea ofertă', it: 'Vuole preventivo', de: 'Möchte Angebot' },
  callback: { en: 'Call back later', sk: 'Zavolať neskôr', cs: 'Zavolat později', hu: 'Visszahívás később', ro: 'Reapelați mai târziu', it: 'Richiamare più tardi', de: 'Später anrufen' },
  requested_date: { en: 'Requested date', sk: 'Požiadal o termín', cs: 'Požádal o termín', hu: 'Időpontot kért', ro: 'A solicitat dată', it: 'Ha richiesto data', de: 'Termin gewünscht' },
  no_time: { en: 'No time', sk: 'Nemal čas', cs: 'Neměl čas', hu: 'Nem volt ideje', ro: 'Nu a avut timp', it: 'Non aveva tempo', de: 'Keine Zeit' },
  thinking: { en: 'Thinking about it', sk: 'Chce rozmyslieť', cs: 'Chce rozmyslet', hu: 'Gondolkodik', ro: 'Vrea să se gândească', it: 'Vuole pensarci', de: 'Überlegt noch' },
  not_interested: { en: 'Not interested', sk: 'Nezáujem', cs: 'Nezájem', hu: 'Nem érdekli', ro: 'Neinteresat', it: 'Non interessato', de: 'Kein Interesse' },
  not_now: { en: 'Not now', sk: 'Momentálne nie', cs: 'Momentálně ne', hu: 'Most nem', ro: 'Nu acum', it: 'Non ora', de: 'Nicht jetzt' },
  never: { en: 'Never', sk: 'Nikdy', cs: 'Nikdy', hu: 'Soha', ro: 'Niciodată', it: 'Mai', de: 'Nie' },
  has_competitor: { en: 'Has competitor', sk: 'Má konkurenciu', cs: 'Má konkurenci', hu: 'Van konkurencia', ro: 'Are concurență', it: 'Ha concorrenza', de: 'Hat Konkurrenz' },
  no_answer: { en: 'No answer', sk: 'Nedvíha', cs: 'Nezvedá', hu: 'Nem veszi fel', ro: 'Nu răspunde', it: 'Non risponde', de: 'Keine Antwort' },
  busy: { en: 'Busy', sk: 'Obsadené', cs: 'Obsazeno', hu: 'Foglalt', ro: 'Ocupat', it: 'Occupato', de: 'Besetzt' },
  voicemail: { en: 'Voicemail', sk: 'Hlasová schránka', cs: 'Hlasová schránka', hu: 'Hangposta', ro: 'Mesagerie vocală', it: 'Segreteria', de: 'Mailbox' },
  wrong_number: { en: 'Wrong number', sk: 'Zlé číslo', cs: 'Špatné číslo', hu: 'Rossz szám', ro: 'Număr greșit', it: 'Numero sbagliato', de: 'Falsche Nummer' },
  dnd: { en: 'Do not call (DND)', sk: 'Nevolať (DND)', cs: 'Nevolat (DND)', hu: 'Ne hívja (DND)', ro: 'Nu apelați (DND)', it: 'Non chiamare (DND)', de: 'Nicht anrufen (DND)' },
  replied_interested: { en: 'Replied - interested', sk: 'Odpovedal - záujem', cs: 'Odpověděl - zájem', hu: 'Válaszolt - érdekli', ro: 'A răspuns - interesat', it: 'Ha risposto - interessato', de: 'Geantwortet - interessiert' },
  replied_not_interested: { en: 'Replied - not interested', sk: 'Odpovedal - nezáujem', cs: 'Odpověděl - nezájem', hu: 'Válaszolt - nem érdekli', ro: 'A răspuns - neinteresat', it: 'Ha risposto - non interessato', de: 'Geantwortet - kein Interesse' },
  no_reply: { en: 'No reply', sk: 'Neodpovedal', cs: 'Neodpověděl', hu: 'Nem válaszolt', ro: 'Nu a răspuns', it: 'Non ha risposto', de: 'Keine Antwort' },
  invalid_email: { en: 'Invalid email', sk: 'Email neplatný', cs: 'Email neplatný', hu: 'Érvénytelen email', ro: 'Email invalid', it: 'Email non valida', de: 'Ungültige E-Mail' },
  unsubscribed: { en: 'Unsubscribed', sk: 'Odhlásený', cs: 'Odhlášen', hu: 'Leiratkozott', ro: 'Dezabonat', it: 'Cancellato', de: 'Abgemeldet' },
  resend_later: { en: 'Resend later', sk: 'Preposlať neskôr', cs: 'Přeposlat později', hu: 'Később újraküldeni', ro: 'Retrimite mai târziu', it: 'Rinviare più tardi', de: 'Später erneut senden' },
  invalid_number: { en: 'Invalid number', sk: 'Číslo neplatné', cs: 'Číslo neplatné', hu: 'Érvénytelen szám', ro: 'Număr invalid', it: 'Numero non valido', de: 'Ungültige Nummer' },
  email_sent: { en: 'Email sent', sk: 'Email odoslaný', cs: 'Email odeslán', hu: 'Email elküldve', ro: 'Email trimis', it: 'Email inviata', de: 'E-Mail gesendet' },
  schedule_next_email: { en: 'Schedule next email', sk: 'Naplánovať ďalší email', cs: 'Naplánovat další email', hu: 'Következő email ütemezése', ro: 'Programează următorul email', it: 'Pianifica prossima email', de: 'Nächste E-Mail planen' },
  sms_sent: { en: 'SMS sent', sk: 'SMS odoslaná', cs: 'SMS odeslána', hu: 'SMS elküldve', ro: 'SMS trimis', it: 'SMS inviato', de: 'SMS gesendet' },
  sms_replied_interested: { en: 'Replied - interested', sk: 'Odpovedal - záujem', cs: 'Odpověděl - zájem', hu: 'Válaszolt - érdekli', ro: 'A răspuns - interesat', it: 'Ha risposto - interessato', de: 'Geantwortet - interessiert' },
  sms_replied_not_interested: { en: 'Replied - not interested', sk: 'Odpovedal - nezáujem', cs: 'Odpověděl - nezájem', hu: 'Válaszolt - nem érdekli', ro: 'A răspuns - neinteresat', it: 'Ha risposto - non interessato', de: 'Geantwortet - kein Interesse' },
  sms_no_reply: { en: 'No reply', sk: 'Neodpovedal', cs: 'Neodpověděl', hu: 'Nem válaszolt', ro: 'Nu a răspuns', it: 'Non ha risposto', de: 'Keine Antwort' },
  sms_unsubscribed: { en: 'Unsubscribed', sk: 'Odhlásený', cs: 'Odhlášen', hu: 'Leiratkozott', ro: 'Dezabonat', it: 'Cancellato', de: 'Abgemeldet' },
  schedule_next_sms: { en: 'Schedule next SMS', sk: 'Naplánovať ďalšiu SMS', cs: 'Naplánovat další SMS', hu: 'Következő SMS ütemezése', ro: 'Programează următorul SMS', it: 'Pianifica prossimo SMS', de: 'Nächste SMS planen' },
};

// Operator Script Types - structured interactive scripts for call center agents
export const scriptElementTypes = [
  "heading",
  "paragraph", 
  "select",
  "multiselect",
  "checkbox",
  "checkboxGroup",
  "radio",
  "textInput",
  "textarea",
  "divider",
  "note",
  "outcome"
] as const;

export type ScriptElementType = typeof scriptElementTypes[number];

export const scriptElementSchema = z.object({
  id: z.string(),
  type: z.enum(scriptElementTypes),
  label: z.string().optional(),
  content: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional().default(false),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    nextStepId: z.string().optional(),
  })).optional(),
  style: z.enum(["default", "info", "warning", "success", "error"]).optional(),
  size: z.enum(["sm", "md", "lg"]).optional(),
});

export type ScriptElement = z.infer<typeof scriptElementSchema>;

export const scriptStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  elements: z.array(scriptElementSchema),
  nextStepId: z.string().optional(),
  isEndStep: z.boolean().optional().default(false),
});

export type ScriptStep = z.infer<typeof scriptStepSchema>;

export const operatorScriptSchema = z.object({
  version: z.number().default(1),
  name: z.string().optional(),
  description: z.string().optional(),
  steps: z.array(scriptStepSchema),
  startStepId: z.string().optional(),
});

export type OperatorScript = z.infer<typeof operatorScriptSchema>;

export const scriptResponseSchema = z.object({
  elementId: z.string(),
  value: z.union([z.string(), z.array(z.string()), z.boolean()]),
  timestamp: z.string(),
});

export type ScriptResponse = z.infer<typeof scriptResponseSchema>;

export const scriptSessionSchema = z.object({
  scriptVersion: z.number(),
  currentStepId: z.string(),
  completedStepIds: z.array(z.string()),
  responses: z.array(scriptResponseSchema),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

export type ScriptSession = z.infer<typeof scriptSessionSchema>;

// SIP Settings - global SIP server configuration (singleton)
export const sipSettings = pgTable("sip_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  server: text("server").notNull().default(""),
  port: integer("port").notNull().default(5060),
  wsPort: integer("ws_port").notNull().default(8089),
  wsPath: text("ws_path").notNull().default("/ws"),
  transport: text("transport").notNull().default("wss"), // ws, wss, tcp, udp
  realm: text("realm").default(""),
  stunServer: text("stun_server").default(""),
  turnServer: text("turn_server").default(""),
  turnUsername: text("turn_username").default(""),
  turnPassword: text("turn_password").default(""),
  isEnabled: boolean("is_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  updatedBy: varchar("updated_by"),
});

export const insertSipSettingsSchema = createInsertSchema(sipSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSipSettings = z.infer<typeof insertSipSettingsSchema>;
export type SipSettings = typeof sipSettings.$inferSelect;

// SIP Extensions Pool - pre-configured SIP extensions with encrypted passwords
export const sipExtensions = pgTable("sip_extensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: text("country_code").notNull(), // SK, CZ, HU, etc.
  extension: text("extension").notNull().unique(), // e.g. 2003
  sipUsername: text("sip_username").notNull(), // usually same as extension
  sipPasswordHash: text("sip_password_hash").notNull(), // encrypted password
  assignedToUserId: varchar("assigned_to_user_id"), // null if available
  assignedAt: timestamp("assigned_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertSipExtensionSchema = createInsertSchema(sipExtensions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSipExtension = z.infer<typeof insertSipExtensionSchema>;
export type SipExtension = typeof sipExtensions.$inferSelect;

// Call Logs - tracks all SIP calls made by users
export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  customerId: varchar("customer_id"),
  campaignId: varchar("campaign_id"),
  campaignContactId: varchar("campaign_contact_id"),
  phoneNumber: text("phone_number").notNull(),
  direction: text("direction").notNull().default("outbound"), // inbound, outbound
  status: text("status").notNull().default("initiated"), // initiated, ringing, answered, completed, failed, no_answer, busy, cancelled
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  answeredAt: timestamp("answered_at"),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds").default(0),
  hungUpBy: text("hung_up_by"), // 'customer' | 'user' | null - who ended the call
  sipCallId: text("sip_call_id"),
  notes: text("notes"),
  metadata: text("metadata"), // JSON string for additional data
  inboundQueueId: varchar("inbound_queue_id"),
  inboundQueueName: text("inbound_queue_name"),
  inboundCallLogId: varchar("inbound_call_log_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  startedAt: z.string().optional(),
  answeredAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
});

export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type CallLog = typeof callLogs.$inferSelect;

// ========== CALL RECORDINGS ==========
export const callRecordings = pgTable("call_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callLogId: varchar("call_log_id").notNull(),
  userId: varchar("user_id").notNull(),
  customerId: varchar("customer_id"),
  campaignId: varchar("campaign_id"),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull().default("audio/webm"),
  fileSizeBytes: integer("file_size_bytes"),
  durationSeconds: integer("duration_seconds"),
  customerName: text("customer_name"),
  agentName: text("agent_name"),
  campaignName: text("campaign_name"),
  phoneNumber: text("phone_number"),
  analysisStatus: text("analysis_status").default("pending"),
  analysisResult: jsonb("analysis_result"),
  transcriptionText: text("transcription_text"),
  transcriptionLanguage: text("transcription_language"),
  sentiment: text("sentiment"),
  qualityScore: integer("quality_score"),
  summary: text("summary"),
  keyTopics: text("key_topics").array(),
  actionItems: text("action_items").array(),
  complianceNotes: text("compliance_notes"),
  scriptComplianceScore: integer("script_compliance_score"),
  alertKeywords: text("alert_keywords").array(),
  analyzedAt: timestamp("analyzed_at"),
  direction: text("direction").default("outbound"),
  inboundQueueId: varchar("inbound_queue_id"),
  inboundQueueName: text("inbound_queue_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCallRecordingSchema = createInsertSchema(callRecordings).omit({
  id: true,
  createdAt: true,
});

export type InsertCallRecording = z.infer<typeof insertCallRecordingSchema>;
export type CallRecording = typeof callRecordings.$inferSelect;

// ========== ZOSTAVY (Product Sets) ==========

// Product Sets - billing set configurations
export const productSets = pgTable("product_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  countryCode: text("country_code"),
  name: text("name").notNull(),
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  currency: text("currency").notNull().default("EUR"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  emailAlertEnabled: boolean("email_alert_enabled").notNull().default(false),
  // Calculated totals (updated on save)
  totalNetAmount: decimal("total_net_amount", { precision: 12, scale: 2 }),
  totalDiscountAmount: decimal("total_discount_amount", { precision: 12, scale: 2 }),
  totalVatAmount: decimal("total_vat_amount", { precision: 12, scale: 2 }),
  totalGrossAmount: decimal("total_gross_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertProductSetSchema = createInsertSchema(productSets).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  totalNetAmount: true,
  totalDiscountAmount: true,
  totalVatAmount: true,
  totalGrossAmount: true,
});
export type InsertProductSet = z.infer<typeof insertProductSetSchema>;
export type ProductSet = typeof productSets.$inferSelect;

// Product Set Collections - links product set to Odbery (market instances)
export const productSetCollections = pgTable("product_set_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productSetId: varchar("product_set_id").notNull(),
  instanceId: varchar("instance_id").notNull(), // FK to market_product_instances
  priceId: varchar("price_id"), // selected price from instance_prices
  paymentOptionId: varchar("payment_option_id"), // selected payment from instance_payment_options
  discountId: varchar("discount_id"), // selected discount from instance_discounts
  vatRateId: varchar("vat_rate_id"), // selected VAT from instance_vat_rates
  quantity: integer("quantity").notNull().default(1),
  priceOverride: decimal("price_override", { precision: 12, scale: 2 }), // optional custom price
  sortOrder: integer("sort_order").notNull().default(0),
  // Calculated line totals
  lineNetAmount: decimal("line_net_amount", { precision: 12, scale: 2 }),
  lineDiscountAmount: decimal("line_discount_amount", { precision: 12, scale: 2 }),
  lineVatAmount: decimal("line_vat_amount", { precision: 12, scale: 2 }),
  lineGrossAmount: decimal("line_gross_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertProductSetCollectionSchema = createInsertSchema(productSetCollections).omit({ 
  id: true, 
  createdAt: true,
  lineNetAmount: true,
  lineDiscountAmount: true,
  lineVatAmount: true,
  lineGrossAmount: true,
});
export type InsertProductSetCollection = z.infer<typeof insertProductSetCollectionSchema>;
export type ProductSetCollection = typeof productSetCollections.$inferSelect;

// Product Set Storage - links product set to Skladovanie (services)
export const productSetStorage = pgTable("product_set_storage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productSetId: varchar("product_set_id").notNull(),
  serviceId: varchar("service_id").notNull(), // FK to market_product_services
  priceId: varchar("price_id"), // selected price from instance_prices (for service)
  discountId: varchar("discount_id"), // selected discount from instance_discounts (for service)
  vatRateId: varchar("vat_rate_id"), // selected VAT from instance_vat_rates (for service)
  paymentOptionId: varchar("payment_option_id"), // selected payment option from instance_payment_options (for service)
  quantity: integer("quantity").notNull().default(1),
  priceOverride: decimal("price_override", { precision: 12, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
  // Calculated line totals
  lineNetAmount: decimal("line_net_amount", { precision: 12, scale: 2 }),
  lineDiscountAmount: decimal("line_discount_amount", { precision: 12, scale: 2 }),
  lineVatAmount: decimal("line_vat_amount", { precision: 12, scale: 2 }),
  lineGrossAmount: decimal("line_gross_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertProductSetStorageSchema = createInsertSchema(productSetStorage).omit({ 
  id: true, 
  createdAt: true,
  lineNetAmount: true,
  lineDiscountAmount: true,
  lineVatAmount: true,
  lineGrossAmount: true,
});
export type InsertProductSetStorage = z.infer<typeof insertProductSetStorageSchema>;
export type ProductSetStorage = typeof productSetStorage.$inferSelect;

// Chat Messages - direct messages between users
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull(),
  receiverId: varchar("receiver_id").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Exchange Rates - daily ECB exchange rates from NBS
export const exchangeRates = pgTable("exchange_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  currencyCode: text("currency_code").notNull(), // e.g., "USD", "CZK", "HUF"
  currencyName: text("currency_name").notNull(), // e.g., "americký dolár"
  rate: decimal("rate", { precision: 12, scale: 6 }).notNull(), // rate against EUR
  rateDate: date("rate_date").notNull(), // date of the rate
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ id: true, updatedAt: true });
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;

// Inflation Rates - Slovak inflation data (annual rates)
export const inflationRates = pgTable("inflation_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(), // e.g., 2024
  country: varchar("country", { length: 2 }).notNull().default("SK"), // ISO country code
  rate: decimal("rate", { precision: 6, scale: 2 }).notNull(), // e.g., 10.5 (percent)
  source: text("source"), // data source
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertInflationRateSchema = createInsertSchema(inflationRates).omit({ id: true, updatedAt: true });
export type InsertInflationRate = z.infer<typeof insertInflationRateSchema>;
export type InflationRate = typeof inflationRates.$inferSelect;

// ============================================
// CONTRACT MANAGEMENT MODULE
// ============================================

// Contract Categories - categories for organizing contract templates
export const contractCategories = pgTable("contract_categories", {
  id: serial("id").primaryKey(),
  value: varchar("value", { length: 50 }).notNull().unique(), // e.g., "general", "cord_blood"
  label: text("label").notNull(), // Default display label e.g., "Všeobecná zmluva"
  labelSk: text("label_sk"), // Slovak
  labelCz: text("label_cz"), // Czech
  labelHu: text("label_hu"), // Hungarian
  labelRo: text("label_ro"), // Romanian
  labelIt: text("label_it"), // Italian
  labelDe: text("label_de"), // German
  labelUs: text("label_us"), // English (US)
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertContractCategorySchema = createInsertSchema(contractCategories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractCategory = z.infer<typeof insertContractCategorySchema>;
export type ContractCategory = typeof contractCategories.$inferSelect;

// Contract Category Default Templates - per-country default templates for categories
// Supports two template types:
// 1. "pdf_form" - Fillable PDF with AcroForm fields (filled via pdf-lib)
// 2. "docx" - Word document with {{placeholders}} (processed via docxtemplater, converted to PDF)
export const contractCategoryDefaultTemplates = pgTable("contract_category_default_templates", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(), // FK to contract_categories
  countryCode: varchar("country_code", { length: 2 }).notNull(), // SK, CZ, HU, RO, IT, DE, US
  templateType: varchar("template_type", { length: 20 }).notNull().default("pdf_form"), // pdf_form, docx
  templateId: varchar("template_id"), // FK to contract_templates (optional - if linked to existing template)
  sourcePdfPath: text("source_pdf_path"), // Path to uploaded source PDF (for pdf_form type)
  sourceDocxPath: text("source_docx_path"), // Path to uploaded source DOCX (for docx type) - may be modified by AI
  originalDocxPath: text("original_docx_path"), // Path to original unmodified DOCX (backup for reset)
  previewPdfPath: text("preview_pdf_path"), // Path to generated PDF preview (from DOCX)
  extractedFields: text("extracted_fields"), // JSON array of field/placeholder names found in template
  placeholderMappings: text("placeholder_mappings"), // JSON mapping of template fields to CRM data fields
  htmlContent: text("html_content"), // Legacy HTML content (deprecated - not used)
  conversionStatus: varchar("conversion_status", { length: 20 }).notNull().default("pending"), // pending, processing, completed, failed
  conversionError: text("conversion_error"), // Error message if conversion failed
  conversionMetadata: text("conversion_metadata"), // JSON with conversion details
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertContractCategoryDefaultTemplateSchema = createInsertSchema(contractCategoryDefaultTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractCategoryDefaultTemplate = z.infer<typeof insertContractCategoryDefaultTemplateSchema>;
export type ContractCategoryDefaultTemplate = typeof contractCategoryDefaultTemplates.$inferSelect;

// Contract Template Versions - version history for template changes
export const contractTemplateVersions = pgTable("contract_template_versions", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  docxFilePath: text("docx_file_path").notNull(),
  htmlContent: text("html_content"),
  changeDescription: text("change_description"),
  createdBy: varchar("created_by"),
  createdByName: text("created_by_name"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContractTemplateVersionSchema = createInsertSchema(contractTemplateVersions).omit({ id: true, createdAt: true });
export type InsertContractTemplateVersion = z.infer<typeof insertContractTemplateVersionSchema>;
export type ContractTemplateVersion = typeof contractTemplateVersions.$inferSelect;

// Contract Templates - reusable contract document templates
export const contractTemplates = pgTable("contract_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  countryCode: varchar("country_code", { length: 2 }).notNull(), // SK, CZ, HU, RO, IT, DE, US
  languageCode: varchar("language_code", { length: 5 }).notNull(), // sk, cs, hu, ro, it, de, en
  category: varchar("category", { length: 50 }).notNull().default("general"), // general, cord_blood, service, storage
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, published, archived
  contentHtml: text("content_html"), // HTML content with Handlebars placeholders
  placeholders: text("placeholders"), // JSON array of available placeholders with descriptions
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;

// Contract Instances - actual contracts generated from templates
export const contractInstances = pgTable("contract_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractNumber: varchar("contract_number", { length: 50 }).notNull(), // e.g., ZML-2025-00001
  templateId: varchar("template_id").notNull(),
  templateVersionId: varchar("template_version_id"), // optional - only used if versioning is enabled
  customerId: varchar("customer_id").notNull(),
  billingDetailsId: varchar("billing_details_id").notNull(),
  // Initiation source
  initiatedFrom: varchar("initiated_from", { length: 20 }), // potential_case, quick_contact, direct
  potentialCaseId: varchar("potential_case_id"),
  quickContactId: varchar("quick_contact_id"),
  // Status workflow
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, sent, pending_signature, signed, completed, cancelled, expired
  // Validity
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  // Financial totals
  totalNetAmount: decimal("total_net_amount", { precision: 12, scale: 2 }),
  totalVatAmount: decimal("total_vat_amount", { precision: 12, scale: 2 }),
  totalGrossAmount: decimal("total_gross_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  // Rendered content
  renderedHtml: text("rendered_html"), // Final rendered HTML with all variables filled
  pdfPath: text("pdf_path"), // Path to generated PDF
  pdfGeneratedAt: timestamp("pdf_generated_at"), // When PDF was generated
  pdfFileSize: integer("pdf_file_size"), // PDF file size in bytes
  pdfFileHash: text("pdf_file_hash"), // SHA-256 hash for integrity verification
  pdfGeneratedBy: varchar("pdf_generated_by"), // User ID who generated the PDF
  // Signature settings
  signatureMode: varchar("signature_mode", { length: 20 }).notNull().default("simple"), // simple, advanced, qualified
  // Denormalized snapshots for legal immutability
  customerSnapshot: text("customer_snapshot"), // JSON snapshot of customer data at contract time
  billingSnapshot: text("billing_snapshot"), // JSON snapshot of billing company data
  // Product selection
  selectedProductId: varchar("selected_product_id", { length: 50 }), // e.g., standard, premium, premium_tissue
  // Notes
  internalNotes: text("internal_notes"),
  // Legacy
  internalId: varchar("internal_id", { length: 100 }),
  // Lifecycle dates
  contactDate: timestamp("contact_date"),
  filledDate: timestamp("filled_date"),
  createdContractDate: timestamp("created_contract_date"),
  sentContractDate: timestamp("sent_contract_date"),
  receivedByClientDate: timestamp("received_by_client_date"),
  returnedDate: timestamp("returned_date"),
  verifiedDate: timestamp("verified_date"),
  executedDate: timestamp("executed_date"),
  terminatedDate: timestamp("terminated_date"),
  terminationReason: text("termination_reason"),
  // Medical
  ambulantDoctor: text("ambulant_doctor"),
  expectedDeliveryDate: date("expected_delivery_date"),
  hospitalId: integer("hospital_id"),
  obstetrician: text("obstetrician"),
  multiplePregnancy: boolean("multiple_pregnancy").default(false),
  // Sales & Marketing
  salesChannel: varchar("sales_channel", { length: 100 }),
  infoSource: varchar("info_source", { length: 100 }),
  selectionReason: text("selection_reason"),
  marketingAction: text("marketing_action"),
  marketingCode: varchar("marketing_code", { length: 100 }),
  // Refinancing
  refinancing: text("refinancing"),
  refinancingId: varchar("refinancing_id", { length: 100 }),
  // Gift & Collection kit
  giftVoucher: text("gift_voucher"),
  collectionKit: text("collection_kit"),
  collectionKitSentDate: timestamp("collection_kit_sent_date"),
  // Client
  clientNote: text("client_note"),
  representativeId: varchar("representative_id"),
  indicatedContract: boolean("indicated_contract").default(false),
  // Product references
  initialProductId: varchar("initial_product_id"),
  recruitedToProductId: varchar("recruited_to_product_id"),
  recruitedDate: timestamp("recruited_date"),
  // Audit
  createdBy: varchar("created_by"),
  sentAt: timestamp("sent_at"),
  sentBy: varchar("sent_by"),
  signedAt: timestamp("signed_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertContractInstanceSchema = createInsertSchema(contractInstances).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractInstance = z.infer<typeof insertContractInstanceSchema>;
export type ContractInstance = typeof contractInstances.$inferSelect;

// Contract Instance Products - products/billsets linked to a contract
export const contractInstanceProducts = pgTable("contract_instance_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  productSetId: varchar("product_set_id"), // FK to product_sets (billset)
  productId: varchar("product_id"), // FK to market_products (individual product if not billset)
  // Pricing snapshot (for legal immutability)
  productSnapshot: text("product_snapshot"), // JSON with product name, description, etc.
  priceSnapshot: text("price_snapshot"), // JSON with pricing details
  installmentSnapshot: text("installment_snapshot"), // JSON with installment schedule if applicable
  // Line amounts
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }),
  lineNetAmount: decimal("line_net_amount", { precision: 12, scale: 2 }),
  lineVatAmount: decimal("line_vat_amount", { precision: 12, scale: 2 }),
  lineGrossAmount: decimal("line_gross_amount", { precision: 12, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContractInstanceProductSchema = createInsertSchema(contractInstanceProducts).omit({ id: true, createdAt: true });
export type InsertContractInstanceProduct = z.infer<typeof insertContractInstanceProductSchema>;
export type ContractInstanceProduct = typeof contractInstanceProducts.$inferSelect;

// Contract Participants - parties involved in the contract
export const contractParticipants = pgTable("contract_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  participantType: varchar("participant_type", { length: 20 }).notNull(), // customer, billing_company, internal_witness, guarantor
  // Contact details (snapshot)
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  personalId: text("personal_id"), // for natural persons
  companyId: text("company_id"), // IČO for companies
  taxId: text("tax_id"), // DIČ
  vatNumber: text("vat_number"), // IČ DPH
  // Role and status
  role: varchar("role", { length: 50 }), // signer, witness, authorized_representative
  signatureRequired: boolean("signature_required").notNull().default(false),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContractParticipantSchema = createInsertSchema(contractParticipants).omit({ id: true, createdAt: true });
export type InsertContractParticipant = z.infer<typeof insertContractParticipantSchema>;
export type ContractParticipant = typeof contractParticipants.$inferSelect;

// Contract Signature Requests - signature collection with OTP verification
export const contractSignatureRequests = pgTable("contract_signature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  participantId: varchar("participant_id").notNull(), // FK to contract_participants
  // Signer info
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email"),
  signerPhone: text("signer_phone"),
  // Verification
  verificationMethod: varchar("verification_method", { length: 20 }).notNull().default("email_otp"), // email_otp, sms_otp, both
  otpCode: varchar("otp_code", { length: 10 }), // Generated OTP
  otpExpiresAt: timestamp("otp_expires_at"),
  otpVerifiedAt: timestamp("otp_verified_at"),
  otpAttempts: integer("otp_attempts").notNull().default(0),
  // Signature data
  signatureType: varchar("signature_type", { length: 20 }).notNull().default("drawn"), // drawn, uploaded, typed
  signatureData: text("signature_data"), // Base64 signature image or typed name
  signatureHash: text("signature_hash"), // SHA-256 hash of signature
  // Audit trail
  requestSentAt: timestamp("request_sent_at"),
  signedAt: timestamp("signed_at"),
  signerIpAddress: text("signer_ip_address"),
  signerUserAgent: text("signer_user_agent"),
  // Public signing link
  signingToken: varchar("signing_token", { length: 64 }), // Unique token for public signing URL
  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, sent, otp_verified, signed, expired, cancelled
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContractSignatureRequestSchema = createInsertSchema(contractSignatureRequests).omit({ id: true, createdAt: true });
export type InsertContractSignatureRequest = z.infer<typeof insertContractSignatureRequestSchema>;
export type ContractSignatureRequest = typeof contractSignatureRequests.$inferSelect;

// Contract Audit Log - complete audit trail for contracts
export const contractAuditLog = pgTable("contract_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(), // created, updated, sent, viewed, otp_sent, otp_verified, signed, completed, cancelled
  actorId: varchar("actor_id"), // User ID who performed action (null for system/customer)
  actorType: varchar("actor_type", { length: 20 }).notNull().default("user"), // user, system, customer
  actorName: text("actor_name"),
  actorEmail: text("actor_email"),
  // Context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: text("details"), // JSON with additional details
  previousValue: text("previous_value"), // For updates, JSON of previous state
  newValue: text("new_value"), // For updates, JSON of new state
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContractAuditLogSchema = createInsertSchema(contractAuditLog).omit({ id: true, createdAt: true });
export type InsertContractAuditLog = z.infer<typeof insertContractAuditLogSchema>;
export type ContractAuditLog = typeof contractAuditLog.$inferSelect;

// ============================================
// CONTRACT AUDIT SHARE TOKENS
// Shareable links for customer audit timeline view
// ============================================

export const contractAuditShareTokens = pgTable("contract_audit_share_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  email: text("email").notNull(),
  createdById: varchar("created_by_id"),
  createdByName: text("created_by_name"),
  expiresAt: timestamp("expires_at"),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContractAuditShareTokenSchema = createInsertSchema(contractAuditShareTokens).omit({ id: true, createdAt: true, accessCount: true, lastAccessedAt: true });
export type InsertContractAuditShareToken = z.infer<typeof insertContractAuditShareTokenSchema>;
export type ContractAuditShareToken = typeof contractAuditShareTokens.$inferSelect;

// ============================================
// VARIABLE REGISTRY SYSTEM
// Centralized management of all template variables
// ============================================

// Variable Blocks - Categories/groups of variables (customer, mother, father, company, etc.)
export const variableBlocks = pgTable("variable_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 50 }).notNull().unique(), // e.g., "customer", "mother", "father", "company"
  displayName: text("display_name").notNull(), // Slovak display name
  displayNameEn: text("display_name_en"), // English display name
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // lucide icon name
  priority: integer("priority").default(0), // For ordering in UI
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertVariableBlockSchema = createInsertSchema(variableBlocks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVariableBlock = z.infer<typeof insertVariableBlockSchema>;
export type VariableBlock = typeof variableBlocks.$inferSelect;

// Variables - All template variables from forms across the application
export const variables = pgTable("variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockId: varchar("block_id").notNull(), // FK to variable_blocks
  key: varchar("key", { length: 100 }).notNull(), // e.g., "customer.fullName", "mother.birthDate"
  label: text("label").notNull(), // Slovak label
  labelEn: text("label_en"), // English label
  description: text("description"),
  dataType: varchar("data_type", { length: 20 }).notNull().default("text"), // text, date, number, boolean, email, phone, address, iban
  sourceForm: varchar("source_form", { length: 100 }), // Which form this variable comes from
  example: text("example"), // Example value for preview
  isComputed: boolean("is_computed").default(false), // Whether it's derived from other fields
  computeExpression: text("compute_expression"), // For computed fields, the expression
  isRequired: boolean("is_required").default(false),
  isDeprecated: boolean("is_deprecated").default(false),
  defaultValue: text("default_value"),
  priority: integer("priority").default(0), // For ordering within block
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertVariableSchema = createInsertSchema(variables).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVariable = z.infer<typeof insertVariableSchema>;
export type Variable = typeof variables.$inferSelect;

// Variable Keywords - Keywords that identify which block a document section belongs to
export const variableKeywords = pgTable("variable_keywords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockId: varchar("block_id").notNull(), // FK to variable_blocks
  keyword: varchar("keyword", { length: 100 }).notNull(), // The keyword to match
  locale: varchar("locale", { length: 5 }).notNull().default("sk"), // sk, cs, hu, ro, it, de, en
  weight: integer("weight").default(1), // Higher weight = stronger match
  isExact: boolean("is_exact").default(false), // Whether to match exactly or as substring
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertVariableKeywordSchema = createInsertSchema(variableKeywords).omit({ id: true, createdAt: true });
export type InsertVariableKeyword = z.infer<typeof insertVariableKeywordSchema>;
export type VariableKeyword = typeof variableKeywords.$inferSelect;

// Variable Block Relations
export const variableBlocksRelations = relations(variableBlocks, ({ many }) => ({
  variables: many(variables),
  keywords: many(variableKeywords),
}));

export const variablesRelations = relations(variables, ({ one }) => ({
  block: one(variableBlocks, {
    fields: [variables.blockId],
    references: [variableBlocks.id],
  }),
}));

export const variableKeywordsRelations = relations(variableKeywords, ({ one }) => ({
  block: one(variableBlocks, {
    fields: [variableKeywords.blockId],
    references: [variableBlocks.id],
  }),
}));

// Contract status enum for frontend use
export const CONTRACT_STATUSES = [
  { value: "draft", label: "Draft", color: "gray" },
  { value: "sent", label: "Sent", color: "blue" },
  { value: "pending_signature", label: "Pending Signature", color: "yellow" },
  { value: "signed", label: "Signed", color: "green" },
  { value: "completed", label: "Completed", color: "emerald" },
  { value: "cancelled", label: "Cancelled", color: "red" },
  { value: "expired", label: "Expired", color: "orange" },
] as const;

// Contract template placeholders reference
export const CONTRACT_PLACEHOLDERS = {
  customer: [
    { key: "customer.fullName", label: "Customer Full Name", example: "Ján Novák" },
    { key: "customer.firstName", label: "Customer First Name", example: "Ján" },
    { key: "customer.lastName", label: "Customer Last Name", example: "Novák" },
    { key: "customer.email", label: "Customer Email", example: "jan.novak@email.com" },
    { key: "customer.phone", label: "Customer Phone", example: "+421 900 123 456" },
    { key: "customer.address", label: "Customer Address", example: "Hlavná 1, 811 01 Bratislava" },
    { key: "customer.birthDate", label: "Customer Birth Date", example: "15.03.1985" },
    { key: "customer.personalId", label: "Customer Personal ID", example: "850315/1234" },
  ],
  billing: [
    { key: "billing.companyName", label: "Company Name", example: "INDEXUS s.r.o." },
    { key: "billing.ico", label: "IČO", example: "12345678" },
    { key: "billing.dic", label: "DIČ", example: "2012345678" },
    { key: "billing.vatNumber", label: "IČ DPH", example: "SK2012345678" },
    { key: "billing.address", label: "Company Address", example: "Podnikateľská 5, 821 04 Bratislava" },
    { key: "billing.iban", label: "IBAN", example: "SK12 1100 0000 0012 3456 7890" },
    { key: "billing.swift", label: "SWIFT/BIC", example: "TATRSKBX" },
    { key: "billing.bankName", label: "Bank Name", example: "Tatra banka" },
    { key: "billing.phone", label: "Company Phone", example: "+421 2 1234 5678" },
    { key: "billing.email", label: "Company Email", example: "info@indexus.sk" },
  ],
  contract: [
    { key: "contract.number", label: "Contract Number", example: "ZML-2025-00001" },
    { key: "contract.date", label: "Contract Date", example: "04.01.2025" },
    { key: "contract.validFrom", label: "Valid From", example: "04.01.2025" },
    { key: "contract.validTo", label: "Valid To", example: "04.01.2045" },
    { key: "contract.totalNet", label: "Total Net Amount", example: "1 500,00" },
    { key: "contract.totalVat", label: "Total VAT Amount", example: "300,00" },
    { key: "contract.totalGross", label: "Total Gross Amount", example: "1 800,00" },
    { key: "contract.currency", label: "Currency", example: "EUR" },
  ],
  products: [
    { key: "products", label: "Product List (loop)", example: "{{#each products}}...{{/each}}" },
    { key: "product.name", label: "Product Name", example: "Cord Blood Collection" },
    { key: "product.price", label: "Product Price", example: "1 200,00" },
    { key: "product.vat", label: "Product VAT", example: "240,00" },
    { key: "product.total", label: "Product Total", example: "1 440,00" },
    { key: "product.description", label: "Product Description", example: "Full cord blood collection service" },
  ],
  installments: [
    { key: "installments", label: "Installment Schedule (loop)", example: "{{#each installments}}...{{/each}}" },
    { key: "installment.number", label: "Installment Number", example: "1" },
    { key: "installment.amount", label: "Installment Amount", example: "600,00" },
    { key: "installment.dueDate", label: "Installment Due Date", example: "15.02.2025" },
  ],
} as const;

// ============================================
// SALES PIPELINE MODULE (Pipedrive-like)
// ============================================

// Sales Pipelines - each pipeline represents a sales process
export const pipelines = pgTable("pipelines", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  countryCodes: text("country_codes").array(),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPipelineSchema = createInsertSchema(pipelines).omit({ 
  createdAt: true, 
  updatedAt: true 
});
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type Pipeline = typeof pipelines.$inferSelect;

// Pipeline Stages - stages within a pipeline (e.g., Lead, Qualified, Proposal, Negotiation, Won, Lost)
export const pipelineStages = pgTable("pipeline_stages", {
  id: varchar("id").primaryKey(),
  pipelineId: varchar("pipeline_id").references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 50 }).default("#3b82f6"),
  order: integer("order").notNull().default(0),
  probability: integer("probability").default(0), // Default win probability for deals in this stage (0-100)
  rottingDays: integer("rotting_days"), // Number of days after which a deal in this stage is considered "rotting" (null = disabled)
  isWonStage: boolean("is_won_stage").default(false),
  isLostStage: boolean("is_lost_stage").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({ 
  createdAt: true 
});
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

// Deals - sales opportunities
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  pipelineId: varchar("pipeline_id").references(() => pipelines.id).notNull(),
  stageId: varchar("stage_id").references(() => pipelineStages.id).notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  contractInstanceId: varchar("contract_instance_id").references(() => contractInstances.id),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  value: decimal("value", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).default("EUR"),
  probability: integer("probability").default(0), // Win probability (0-100)
  expectedCloseDate: date("expected_close_date"),
  actualCloseDate: date("actual_close_date"),
  status: varchar("status", { length: 50 }).default("open"), // open, won, lost
  lostReason: text("lost_reason"),
  source: varchar("source", { length: 255 }), // Lead source
  countryCode: varchar("country_code", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDealSchema = createInsertSchema(deals).omit({ 
  createdAt: true, 
  updatedAt: true 
});
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

// Deal Activities - calls, emails, meetings, tasks
export const dealActivities = pgTable("deal_activities", {
  id: varchar("id").primaryKey(),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(), // call, email, meeting, task, note
  subject: varchar("subject", { length: 500 }).notNull(),
  description: text("description"),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  outcome: varchar("outcome", { length: 255 }), // For calls: answered, no_answer, busy, etc.
  duration: integer("duration"), // Duration in minutes
  isCompleted: boolean("is_completed").default(false),
  reminderAt: timestamp("reminder_at"), // When to send reminder
  reminderSent: boolean("reminder_sent").default(false),
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealActivitySchema = createInsertSchema(dealActivities).omit({ 
  createdAt: true 
});
export type InsertDealActivity = z.infer<typeof insertDealActivitySchema>;
export type DealActivity = typeof dealActivities.$inferSelect;

// Relations for pipeline module
export const pipelinesRelations = relations(pipelines, ({ many }) => ({
  stages: many(pipelineStages),
  deals: many(deals),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [pipelineStages.pipelineId],
    references: [pipelines.id],
  }),
  deals: many(deals),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(pipelineStages, {
    fields: [deals.stageId],
    references: [pipelineStages.id],
  }),
  customer: one(customers, {
    fields: [deals.customerId],
    references: [customers.id],
  }),
  campaign: one(campaigns, {
    fields: [deals.campaignId],
    references: [campaigns.id],
  }),
  contractInstance: one(contractInstances, {
    fields: [deals.contractInstanceId],
    references: [contractInstances.id],
  }),
  assignedUser: one(users, {
    fields: [deals.assignedUserId],
    references: [users.id],
  }),
  activities: many(dealActivities),
  products: many(dealProducts),
}));

export const dealActivitiesRelations = relations(dealActivities, ({ one }) => ({
  deal: one(deals, {
    fields: [dealActivities.dealId],
    references: [deals.id],
  }),
  user: one(users, {
    fields: [dealActivities.userId],
    references: [users.id],
  }),
}));

// Deal status and activity type constants
export const DEAL_STATUSES = [
  { value: "open", label: "Otvorený", labelEn: "Open", color: "blue" },
  { value: "won", label: "Vyhraný", labelEn: "Won", color: "green" },
  { value: "lost", label: "Prehraný", labelEn: "Lost", color: "red" },
] as const;

export const DEAL_ACTIVITY_TYPES = [
  { value: "call", label: "Hovor", labelEn: "Call", icon: "Phone" },
  { value: "email", label: "Email", labelEn: "Email", icon: "Mail" },
  { value: "meeting", label: "Stretnutie", labelEn: "Meeting", icon: "Calendar" },
  { value: "task", label: "Úloha", labelEn: "Task", icon: "CheckSquare" },
  { value: "note", label: "Poznámka", labelEn: "Note", icon: "FileText" },
] as const;

export const DEAL_SOURCES = [
  { value: "website", label: "Web stránka" },
  { value: "referral", label: "Odporúčanie" },
  { value: "campaign", label: "Kampaň" },
  { value: "cold_call", label: "Studený hovor" },
  { value: "partner", label: "Partner" },
  { value: "event", label: "Akcia/Event" },
  { value: "other", label: "Iné" },
] as const;

// Deal Products - products linked to a deal
export const dealProducts = pgTable("deal_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertDealProductSchema = createInsertSchema(dealProducts).omit({ id: true, createdAt: true });
export type InsertDealProduct = z.infer<typeof insertDealProductSchema>;
export type DealProduct = typeof dealProducts.$inferSelect;

export const dealProductsRelations = relations(dealProducts, ({ one }) => ({
  deal: one(deals, {
    fields: [dealProducts.dealId],
    references: [deals.id],
  }),
  product: one(products, {
    fields: [dealProducts.productId],
    references: [products.id],
  }),
}));

// ============================================
// PIPELINE AUTOMATIONS
// ============================================

export const AUTOMATION_TRIGGER_TYPES = [
  { value: "deal_created", label: "Nový deal vytvorený", labelEn: "Deal created", icon: "Plus" },
  { value: "stage_changed", label: "Zmena fázy", labelEn: "Stage changed", icon: "ArrowRight" },
  { value: "deal_won", label: "Deal vyhraný", labelEn: "Deal won", icon: "Trophy" },
  { value: "deal_lost", label: "Deal prehraný", labelEn: "Deal lost", icon: "XCircle" },
  { value: "deal_rotting", label: "Deal neaktívny (rotting)", labelEn: "Deal rotting", icon: "Clock" },
  { value: "activity_completed", label: "Aktivita dokončená", labelEn: "Activity completed", icon: "CheckCircle" },
  { value: "customer_updated", label: "Zmena údajov zákazníka", labelEn: "Customer data updated", icon: "User" },
] as const;

export const CUSTOMER_TRACKED_FIELDS = [
  { value: "firstName", label: "Meno" },
  { value: "lastName", label: "Priezvisko" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefón" },
  { value: "status", label: "Status" },
  { value: "clientStatus", label: "Status klienta" },
  { value: "potentialCase", label: "Potenciál (Case)" },
  { value: "leadScore", label: "Lead score" },
  { value: "country", label: "Krajina" },
  { value: "city", label: "Mesto" },
  { value: "address", label: "Adresa" },
  { value: "serviceType", label: "Typ služby" },
  { value: "expectedDueDate", label: "Očakávaný dátum" },
  { value: "notes", label: "Poznámky" },
] as const;

export const CUSTOMER_STATUS_VALUES = [
  { value: "active", label: "Aktívny" },
  { value: "pending", label: "Čakajúci" },
  { value: "inactive", label: "Neaktívny" },
] as const;

export const LEAD_SCORE_RANGES = [
  { value: "0-20", label: "0-20 (Studený)" },
  { value: "21-40", label: "21-40 (Chladný)" },
  { value: "41-60", label: "41-60 (Teplý)" },
  { value: "61-80", label: "61-80 (Horúci)" },
  { value: "81-100", label: "81-100 (Kvalifikovaný)" },
] as const;

export const AUTOMATION_ACTION_TYPES = [
  { value: "create_activity", label: "Vytvoriť aktivitu", labelEn: "Create activity", icon: "Calendar" },
  { value: "send_email", label: "Odoslať email", labelEn: "Send email", icon: "Mail" },
  { value: "assign_owner", label: "Priradiť vlastníka", labelEn: "Assign owner", icon: "User" },
  { value: "update_deal", label: "Aktualizovať deal", labelEn: "Update deal", icon: "Edit" },
  { value: "move_stage", label: "Presunúť do fázy", labelEn: "Move to stage", icon: "ArrowRight" },
  { value: "add_note", label: "Pridať poznámku", labelEn: "Add note", icon: "FileText" },
  { value: "create_deal", label: "Vytvoriť deal (konverzia)", labelEn: "Create deal (conversion)", icon: "Plus" },
] as const;

export const automationRules = pgTable("automation_rules", {
  id: varchar("id").primaryKey(),
  pipelineId: varchar("pipeline_id").references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // deal_created, stage_changed, deal_won, deal_lost, deal_rotting, activity_completed
  triggerConfig: jsonb("trigger_config").$type<{
    stageId?: string; // For stage_changed trigger
    fromStageId?: string; // For stage transitions
    toStageId?: string;
    rottingDays?: number; // For deal_rotting trigger
    activityType?: string; // For activity_completed trigger
    trackedFields?: string[]; // For customer_updated trigger - which fields to watch
    fieldConditions?: { field: string; operator: string; value: string }[]; // Optional conditions
  }>(),
  actionType: varchar("action_type", { length: 50 }).notNull(), // create_activity, send_email, assign_owner, update_deal, move_stage, add_note
  actionConfig: jsonb("action_config").$type<{
    activityType?: string; // For create_activity action
    activitySubject?: string;
    activityDescription?: string;
    activityDueDays?: number; // Days from now
    emailTemplateId?: string; // For send_email action
    emailSubject?: string;
    emailBody?: string;
    assignUserId?: string; // For assign_owner action
    targetStageId?: string; // For move_stage action
    noteText?: string; // For add_note action
    updateField?: string; // For update_deal action
    updateValue?: string;
    dealStageId?: string; // For create_deal action - target stage for new deal
    dealTitle?: string; // For create_deal - title template
  }>(),
  executionCount: integer("execution_count").default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAutomationRuleSchema = createInsertSchema(automationRules).omit({ 
  createdAt: true, 
  updatedAt: true,
  executionCount: true,
  lastExecutedAt: true,
});
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type AutomationRule = typeof automationRules.$inferSelect;

export const automationRulesRelations = relations(automationRules, ({ one }) => ({
  pipeline: one(pipelines, {
    fields: [automationRules.pipelineId],
    references: [pipelines.id],
  }),
  createdByUser: one(users, {
    fields: [automationRules.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// MS365 USER CONNECTIONS
// ============================================

// User MS365 connections - each user can have their own MS365 account connected
export const userMs365Connections = pgTable("user_ms365_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  accountId: text("account_id"), // MSAL homeAccountId for silent token refresh
  email: text("email").notNull(), // The connected MS365 email
  displayName: text("display_name"),
  isConnected: boolean("is_connected").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertUserMs365ConnectionSchema = createInsertSchema(userMs365Connections).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertUserMs365Connection = z.infer<typeof insertUserMs365ConnectionSchema>;
export type UserMs365Connection = typeof userMs365Connections.$inferSelect;

export const userMs365ConnectionsRelations = relations(userMs365Connections, ({ one, many }) => ({
  user: one(users, {
    fields: [userMs365Connections.userId],
    references: [users.id],
  }),
  sharedMailboxes: many(userMs365SharedMailboxes),
}));

// User MS365 shared mailboxes - users can have access to multiple shared mailboxes
export const userMs365SharedMailboxes = pgTable("user_ms365_shared_mailboxes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").references(() => userMs365Connections.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(), // Shared mailbox email (e.g., info@company.sk)
  displayName: text("display_name").notNull(), // Display name for the mailbox
  isDefault: boolean("is_default").notNull().default(false), // Default mailbox for sending
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertUserMs365SharedMailboxSchema = createInsertSchema(userMs365SharedMailboxes).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertUserMs365SharedMailbox = z.infer<typeof insertUserMs365SharedMailboxSchema>;
export type UserMs365SharedMailbox = typeof userMs365SharedMailboxes.$inferSelect;

export const userMs365SharedMailboxesRelations = relations(userMs365SharedMailboxes, ({ one }) => ({
  connection: one(userMs365Connections, {
    fields: [userMs365SharedMailboxes.connectionId],
    references: [userMs365Connections.id],
  }),
  user: one(users, {
    fields: [userMs365SharedMailboxes.userId],
    references: [users.id],
  }),
}));

// Email signatures - HTML signatures for mailboxes
export const emailSignatures = pgTable("email_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  mailboxEmail: text("mailbox_email").notNull(), // 'personal' or shared mailbox email
  htmlContent: text("html_content").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertEmailSignatureSchema = createInsertSchema(emailSignatures).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertEmailSignature = z.infer<typeof insertEmailSignatureSchema>;
export type EmailSignature = typeof emailSignatures.$inferSelect;

export const emailSignaturesRelations = relations(emailSignatures, ({ one }) => ({
  user: one(users, {
    fields: [emailSignatures.userId],
    references: [users.id],
  }),
}));

// ============================================
// EMAIL ROUTING RULES
// ============================================

// Priority levels for email routing
export const EMAIL_PRIORITIES = [
  { value: "low", label: "Nízka", color: "gray" },
  { value: "normal", label: "Normálna", color: "blue" },
  { value: "high", label: "Vysoká", color: "orange" },
  { value: "urgent", label: "Urgentná", color: "red" },
] as const;

// Importance levels for email routing
export const EMAIL_IMPORTANCE = [
  { value: "low", label: "Nízka", color: "gray" },
  { value: "normal", label: "Normálna", color: "blue" },
  { value: "high", label: "Vysoká", color: "orange" },
] as const;

// Condition types for email routing rules
export const EMAIL_CONDITION_TYPES = [
  { value: "sender_email", label: "Odosielateľ (email)", description: "Emailová adresa odosielateľa" },
  { value: "sender_domain", label: "Odosielateľ (doména)", description: "Doména odosielateľa (napr. @firma.sk)" },
  { value: "subject_contains", label: "Predmet obsahuje", description: "Kľúčové slová v predmete" },
  { value: "body_contains", label: "Obsah obsahuje", description: "Kľúčové slová v tele emailu" },
  { value: "cc_contains", label: "CC obsahuje", description: "Emailová adresa v kópii" },
  { value: "to_contains", label: "Príjemca obsahuje", description: "Emailová adresa príjemcu" },
  { value: "has_attachment", label: "Obsahuje prílohu", description: "Email má prílohu" },
  { value: "customer_email", label: "Email zákazníka", description: "Odosielateľ je registrovaný zákazník" },
] as const;

// Action types for email routing rules
export const EMAIL_ACTION_TYPES = [
  { value: "set_priority", label: "Nastaviť prioritu", description: "Priradí prioritu emailu" },
  { value: "set_importance", label: "Nastaviť dôležitosť", description: "Priradí dôležitosť emailu" },
  { value: "add_tag", label: "Pridať tag", description: "Pridá tag k emailu" },
  { value: "create_notification", label: "Vytvoriť notifikáciu", description: "Vytvorí notifikáciu pre zákazníka" },
  { value: "assign_to_user", label: "Priradiť používateľovi", description: "Priradí email konkrétnemu používateľovi" },
  { value: "auto_reply", label: "Automatická odpoveď", description: "Odošle automatickú odpoveď" },
] as const;

// Email routing rules table
export const emailRoutingRules = pgTable("email_routing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0), // Rule execution order (higher = first)
  stopProcessing: boolean("stop_processing").notNull().default(false), // Stop after this rule matches
  
  // Conditions - stored as JSON array of condition objects
  conditions: jsonb("conditions").$type<{
    type: string; // sender_email, sender_domain, subject_contains, etc.
    operator: string; // equals, contains, starts_with, ends_with, regex
    value: string;
    caseSensitive?: boolean;
  }[]>().notNull().default([]),
  
  // Match mode - all conditions must match (AND) or any condition (OR)
  matchMode: text("match_mode").notNull().default("all"), // 'all' or 'any'
  
  // Actions - stored as JSON array of action objects
  actions: jsonb("actions").$type<{
    type: string; // set_priority, set_importance, add_tag, create_notification, etc.
    value: string; // priority level, importance level, tag name, etc.
    config?: Record<string, any>; // Additional configuration
  }[]>().notNull().default([]),
  
  // Mailbox filter - apply to specific mailboxes or all
  mailboxFilter: text("mailbox_filter").array().default(sql`ARRAY[]::text[]`), // Empty = all mailboxes
  
  // Auto-assign emails to customer history when sender matches customer email
  autoAssignCustomer: boolean("auto_assign_customer").notNull().default(true),
  
  // AI content analysis - analyze incoming emails for sentiment and inappropriate content
  enableAiAnalysis: boolean("enable_ai_analysis").notNull().default(false),
  
  // AI-triggered pipeline automation - move customer to specific stage based on AI analysis
  aiPipelineActions: jsonb("ai_pipeline_actions").$type<{
    onAngryTone?: { enabled: boolean; stageId: string };
    onRudeExpressions?: { enabled: boolean; stageId: string };
    onWantsToCancel?: { enabled: boolean; stageId: string };
    onWantsConsent?: { enabled: boolean; stageId: string };
    onDoesNotAcceptContract?: { enabled: boolean; stageId: string };
  }>(),
  
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertEmailRoutingRuleSchema = createInsertSchema(emailRoutingRules).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertEmailRoutingRule = z.infer<typeof insertEmailRoutingRuleSchema>;
export type EmailRoutingRule = typeof emailRoutingRules.$inferSelect;

export const emailRoutingRulesRelations = relations(emailRoutingRules, ({ one }) => ({
  createdByUser: one(users, {
    fields: [emailRoutingRules.createdBy],
    references: [users.id],
  }),
}));

// Email tags - custom tags that can be applied to emails
export const emailTags = pgTable("email_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#6B7280"), // Hex color
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertEmailTagSchema = createInsertSchema(emailTags).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertEmailTag = z.infer<typeof insertEmailTagSchema>;
export type EmailTag = typeof emailTags.$inferSelect;

// Email metadata - stores routing results and tags for processed emails
export const emailMetadata = pgTable("email_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: text("message_id").notNull(), // MS Graph message ID
  mailboxEmail: text("mailbox_email").notNull(),
  priority: text("priority").default("normal"), // low, normal, high, urgent
  importance: text("importance").default("normal"), // low, normal, high
  tags: text("tags").array().default(sql`ARRAY[]::text[]`), // Array of tag names
  matchedRules: text("matched_rules").array().default(sql`ARRAY[]::text[]`), // Rule IDs that matched
  customerId: varchar("customer_id").references(() => customers.id), // Linked customer if any
  isProcessed: boolean("is_processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  
  // AI content analysis results
  aiAnalyzed: boolean("ai_analyzed").notNull().default(false),
  aiSentiment: text("ai_sentiment"), // positive, neutral, negative, angry
  aiHasInappropriateContent: boolean("ai_has_inappropriate_content").notNull().default(false),
  aiAlertLevel: text("ai_alert_level"), // none, warning, critical
  aiAnalysisNote: text("ai_analysis_note"), // Explanation from AI
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
  
  // Extended AI characteristics
  aiHasAngryTone: boolean("ai_has_angry_tone").notNull().default(false),
  aiHasRudeExpressions: boolean("ai_has_rude_expressions").notNull().default(false),
  aiWantsToCancel: boolean("ai_wants_to_cancel").notNull().default(false), // Chce zrušiť zmluvu
  aiWantsConsent: boolean("ai_wants_consent").notNull().default(false), // Chce urobiť súhlas
  aiDoesNotAcceptContract: boolean("ai_does_not_accept_contract").notNull().default(false), // Neakceptuje zmluvu
  
  // Pipeline automation result
  aiPipelineActionTaken: boolean("ai_pipeline_action_taken").notNull().default(false),
  aiPipelineStageId: varchar("ai_pipeline_stage_id"), // Stage ID where customer was moved
  aiPipelineStageName: varchar("ai_pipeline_stage_name"), // Full stage name (Pipeline → Stage)
  aiPipelineActionReason: text("ai_pipeline_action_reason"), // Reason for the move
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertEmailMetadataSchema = createInsertSchema(emailMetadata).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});
export type InsertEmailMetadata = z.infer<typeof insertEmailMetadataSchema>;
export type EmailMetadata = typeof emailMetadata.$inferSelect;

export const emailMetadataRelations = relations(emailMetadata, ({ one }) => ({
  customer: one(customers, {
    fields: [emailMetadata.customerId],
    references: [customers.id],
  }),
}));

// Customer email notifications - notifications in customer detail when email arrives
export const customerEmailNotifications = pgTable("customer_email_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  messageId: text("message_id").notNull(), // MS Graph message ID
  mailboxEmail: text("mailbox_email").notNull(),
  subject: text("subject").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name"),
  recipientEmail: text("recipient_email"), // For outbound emails
  direction: text("direction").notNull().default("inbound"), // "inbound" or "outbound"
  bodyPreview: text("body_preview"), // Short preview of email body
  receivedAt: timestamp("received_at").notNull(),
  priority: text("priority").default("normal"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  readBy: varchar("read_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCustomerEmailNotificationSchema = createInsertSchema(customerEmailNotifications).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertCustomerEmailNotification = z.infer<typeof insertCustomerEmailNotificationSchema>;
export type CustomerEmailNotification = typeof customerEmailNotifications.$inferSelect;

export const customerEmailNotificationsRelations = relations(customerEmailNotifications, ({ one }) => ({
  customer: one(customers, {
    fields: [customerEmailNotifications.customerId],
    references: [customers.id],
  }),
  readByUser: one(users, {
    fields: [customerEmailNotifications.readBy],
    references: [users.id],
  }),
}));

// ==================== GSM SENDER CONFIGURATION ====================

// Sender ID types for BulkGate
export const GSM_SENDER_ID_TYPES = [
  { value: "gSystem", label: "Systémové číslo", needsValue: false },
  { value: "gShort", label: "Short Code", needsValue: false },
  { value: "gText", label: "Textový odosielateľ", needsValue: true },
  { value: "gMobile", label: "Mobile Connect", needsValue: true },
  { value: "gPush", label: "Mobile Connect Push", needsValue: false },
  { value: "gOwn", label: "Vlastné číslo (vyžaduje overenie)", needsValue: true },
  { value: "gProfile", label: "BulkGate Profil ID", needsValue: true },
] as const;

export type GsmSenderIdType = typeof GSM_SENDER_ID_TYPES[number]["value"];

// GSM sender configuration per country
export const gsmSenderConfigs = pgTable("gsm_sender_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: varchar("country_code", { length: 10 }).notNull().unique(),
  senderIdType: varchar("sender_id_type", { length: 20 }).notNull(), // gSystem, gShort, gText, gMobile, gPush, gOwn, gProfile
  senderIdValue: varchar("sender_id_value", { length: 50 }), // Text value for gText, profile ID for gProfile, phone for gOwn
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertGsmSenderConfigSchema = createInsertSchema(gsmSenderConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGsmSenderConfig = z.infer<typeof insertGsmSenderConfigSchema>;
export type GsmSenderConfig = typeof gsmSenderConfigs.$inferSelect;

// ==================== COUNTRY SYSTEM SETTINGS ====================
// System settings per country for automated emails and SMS alerts

export const countrySystemSettings = pgTable("country_system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: varchar("country_code", { length: 10 }).notNull().unique(),
  
  // System email configuration (MS365 account for automated emails/alerts)
  systemEmailEnabled: boolean("system_email_enabled").notNull().default(false),
  systemEmailAddress: varchar("system_email_address", { length: 255 }), // MS365 email address
  systemEmailDisplayName: varchar("system_email_display_name", { length: 100 }), // Display name for outgoing emails
  systemEmailUserId: varchar("system_email_user_id", { length: 255 }), // MS365 user ID if needed
  
  // System SMS configuration (BulkGate method for automated SMS/alerts)
  systemSmsEnabled: boolean("system_sms_enabled").notNull().default(false),
  systemSmsSenderType: varchar("system_sms_sender_type", { length: 20 }), // gSystem, gShort, gText, gMobile, gPush, gOwn, gProfile
  systemSmsSenderValue: varchar("system_sms_sender_value", { length: 50 }), // Value based on sender type
  
  // System branding
  systemBrandName: varchar("system_brand_name", { length: 100 }),
  systemEmailSignature: text("system_email_signature"),
  systemSmsSignature: varchar("system_sms_signature", { length: 160 }),

  // Additional settings
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCountrySystemSettingsSchema = createInsertSchema(countrySystemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCountrySystemSettings = z.infer<typeof insertCountrySystemSettingsSchema>;
export type CountrySystemSettings = typeof countrySystemSettings.$inferSelect;

// System MS365 connections - each country can have its own MS365 account for system emails
export const systemMs365Connections = pgTable("system_ms365_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: varchar("country_code", { length: 10 }).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  accountId: text("account_id"),
  email: text("email").notNull(),
  displayName: text("display_name"),
  isConnected: boolean("is_connected").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  connectedByUserId: varchar("connected_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertSystemMs365ConnectionSchema = createInsertSchema(systemMs365Connections).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSystemMs365Connection = z.infer<typeof insertSystemMs365ConnectionSchema>;
export type SystemMs365Connection = typeof systemMs365Connections.$inferSelect;

// MS365 PKCE Store - persisted to database to survive server restarts
export const ms365PkceStore = pgTable("ms365_pkce_store", {
  state: varchar("state", { length: 255 }).primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'user' or 'system'
  countryCode: varchar("country_code", { length: 10 }), // For system connections
  userId: varchar("user_id").references(() => users.id), // User who initiated
  expiresAt: timestamp("expires_at").notNull(), // Auto-expire after 10 minutes
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type Ms365PkceStoreEntry = typeof ms365PkceStore.$inferSelect;

// ==================== NOTIFICATION CENTER ====================
// Real-time notifications for users

// Notification types
export const NOTIFICATION_TYPES = [
  { value: "new_email", label: "Nový email", icon: "mail" },
  { value: "new_sms", label: "Nová SMS odpoveď", icon: "message-square" },
  { value: "new_customer", label: "Nový zákazník", icon: "user-plus" },
  { value: "status_change", label: "Zmena statusu", icon: "refresh-cw" },
  { value: "sentiment_alert", label: "Sentiment alert", icon: "alert-triangle" },
  { value: "task_assigned", label: "Priradená úloha", icon: "clipboard" },
  { value: "task_due", label: "Úloha - termín", icon: "clock" },
  { value: "task_completed", label: "Úloha dokončená", icon: "check-circle" },
  { value: "mention", label: "Zmienka", icon: "at-sign" },
  { value: "system", label: "Systémové", icon: "info" },
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number]["value"];

// Priority levels
export const NOTIFICATION_PRIORITIES = [
  { value: "low", label: "Nízka", color: "gray" },
  { value: "normal", label: "Normálna", color: "blue" },
  { value: "high", label: "Vysoká", color: "orange" },
  { value: "urgent", label: "Urgentná", color: "red" },
] as const;

export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[number]["value"];

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Notification content
  type: varchar("type", { length: 50 }).notNull(), // new_email, new_sms, new_customer, status_change, sentiment_alert, task_assigned, etc.
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"), // low, normal, high, urgent
  
  // Related entity (for navigation)
  entityType: varchar("entity_type", { length: 50 }), // customer, email, sms, task, campaign
  entityId: varchar("entity_id"),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional data like customer name, sender, etc.
  countryCode: varchar("country_code", { length: 10 }),
  
  // Status
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  dismissedAt: timestamp("dismissed_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Notification rules - automated alerts
export const notificationRules = pgTable("notification_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule name and description
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  
  // Trigger conditions
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // new_email, new_sms, new_customer, status_change, sentiment_negative, task_overdue
  triggerConditions: jsonb("trigger_conditions"), // JSON with specific conditions like { countryCode: "SK", status: "active" }
  
  // Filter by country (null = all countries)
  countryCodes: text("country_codes").array(), // List of country codes this rule applies to
  
  // Target users (who receives notifications)
  targetType: varchar("target_type", { length: 50 }).notNull(), // all, role, specific_users, assignee
  targetRoles: text("target_roles").array(), // For role-based targeting
  targetUserIds: text("target_user_ids").array(), // For specific user targeting
  
  // Notification settings
  notificationTitle: varchar("notification_title", { length: 255 }).notNull(),
  notificationMessage: text("notification_message"),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  
  // Channels
  sendPush: boolean("send_push").notNull().default(true), // In-app notification
  sendEmail: boolean("send_email").notNull().default(false), // Email notification
  sendSms: boolean("send_sms").notNull().default(false), // SMS notification
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertNotificationRuleSchema = createInsertSchema(notificationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNotificationRule = z.infer<typeof insertNotificationRuleSchema>;
export type NotificationRule = typeof notificationRules.$inferSelect;

export const notificationRulesRelations = relations(notificationRules, ({ one }) => ({
  creator: one(users, {
    fields: [notificationRules.createdBy],
    references: [users.id],
  }),
}));

// ========================================
// ODBERY (Collections) - Cord Blood Collections
// ========================================

export const collections = pgTable("collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legacyId: text("legacy_id"),
  cbuNumber: text("cbu_number"),
  
  // Company and product
  billingCompanyId: varchar("billing_company_id"),
  productId: varchar("product_id"),
  billsetId: varchar("billset_id"),
  countryCode: text("country_code").notNull(),
  
  // Client (Klientka) - linked to customer
  customerId: varchar("customer_id"),
  clientFirstName: text("client_first_name"),
  clientLastName: text("client_last_name"),
  clientPhone: text("client_phone"),
  clientMobile: text("client_mobile"),
  clientBirthNumber: text("client_birth_number"),
  clientBirthDay: integer("client_birth_day"),
  clientBirthMonth: integer("client_birth_month"),
  clientBirthYear: integer("client_birth_year"),
  
  // Child (Dieťa)
  childFirstName: text("child_first_name"),
  childLastName: text("child_last_name"),
  childGender: text("child_gender"),
  
  // Collection (Odber) - staff
  collectionDate: timestamp("collection_date"),
  hospitalId: varchar("hospital_id"),
  cordBloodCollectorId: varchar("cord_blood_collector_id"),
  tissueCollectorId: varchar("tissue_collector_id"),
  placentaCollectorId: varchar("placenta_collector_id"),
  assistantNurseId: varchar("assistant_nurse_id"),
  secondNurseId: varchar("second_nurse_id"),
  representativeId: varchar("representative_id"),
  
  // Status dates
  statusCreatedAt: timestamp("status_created_at"),
  statusPairedAt: timestamp("status_paired_at"),
  statusEvaluatedAt: timestamp("status_evaluated_at"),
  statusVerifiedAt: timestamp("status_verified_at"),
  statusStoredAt: timestamp("status_stored_at"),
  statusTransferredAt: timestamp("status_transferred_at"),
  statusReleasedAt: timestamp("status_released_at"),
  statusAwaitingDisposalAt: timestamp("status_awaiting_disposal_at"),
  statusDisposedAt: timestamp("status_disposed_at"),
  
  // State and certificate
  state: text("state"),
  certificate: text("certificate"),
  laboratoryId: varchar("laboratory_id"),
  responsibleCoordinatorId: varchar("responsible_coordinator_id"),
  contractId: varchar("contract_id"),
  
  // Status code (numeric ID from collection_statuses table)
  status: integer("status"),
  
  // Notes
  doctorNote: text("doctor_note"),
  note: text("note"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

// Collection Lab Results - detailed laboratory results
export const collectionLabResults = pgTable("collection_lab_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").notNull(),
  clientResultId: text("client_result_id").unique(),
  
  // Basic info
  usability: text("usability"),
  resultsDate: timestamp("results_date"),
  labNote: text("lab_note"),
  
  // CBU specific
  cbu: text("cbu"),
  collectionFor: text("collection_for"),
  processing: text("processing"),
  title: text("title"),
  firstName: text("first_name"),
  surname: text("surname"),
  idBirthNumber: text("id_birth_number"),
  dateOfCollection: timestamp("date_of_collection"),
  timeOfCollection: text("time_of_collection"),
  dateOfPrintingResults: timestamp("date_of_printing_results"),
  dateOfSendingResults: timestamp("date_of_sending_results"),
  
  // Sterility and infection
  sterility: text("sterility"),
  sterilityType: text("sterility_type"),
  reasonForCharge: text("reason_for_charge"),
  transplantProcessing: text("transplant_processing"),
  resultOfSterility: text("result_of_sterility"),
  resultOfSterilityBagB: text("result_of_sterility_bag_b"),
  infectionAgents: text("infection_agents"),
  letterToPediatrician: text("letter_to_pediatrician"),
  status: text("status"),
  finalAnalyses: text("final_analyses"),
  
  // Volume and counts
  tncCount: text("tnc_count"),
  maxWeight: text("max_weight"),
  volume: text("volume"),
  volumeInBag: text("volume_in_bag"),
  volumeInSyringesBagB: text("volume_in_syringes_bag_b"),
  volumeOfCpdInSyr: text("volume_of_cpd_in_syr"),
  
  // Umbilical tissue
  umbilicalTissue: text("umbilical_tissue"),
  tissueProcessed: text("tissue_processed"),
  tissueSterility: text("tissue_sterility"),
  tissueInfectionAgents: text("tissue_infection_agents"),
  premiumStatus: text("premium_status"),
  transferredTo: text("transferred_to"),
  tissueUsability: text("tissue_usability"),
  
  // Bag A
  bagAUsability: text("bag_a_usability"),
  bagAVolume: text("bag_a_volume"),
  bagATnc: text("bag_a_tnc"),
  bagAAtbSensit: text("bag_a_atb_sensit"),
  bagABacteriaRisk: text("bag_a_bacteria_risk"),
  bagAInfectionAgent: text("bag_a_infection_agent"),
  bagASignificance: text("bag_a_significance"),
  
  // Bag B
  bagBUsability: text("bag_b_usability"),
  bagBVolume: text("bag_b_volume"),
  bagBTnc: text("bag_b_tnc"),
  bagBAtbSensit: text("bag_b_atb_sensit"),
  bagBBacteriaRisk: text("bag_b_bacteria_risk"),
  bagBInfectionAgent: text("bag_b_infection_agent"),
  bagBSignificance: text("bag_b_significance"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCollectionLabResultSchema = createInsertSchema(collectionLabResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCollectionLabResult = z.infer<typeof insertCollectionLabResultSchema>;
export type CollectionLabResult = typeof collectionLabResults.$inferSelect;

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  customer: one(customers, {
    fields: [collections.customerId],
    references: [customers.id],
  }),
  billingCompany: one(billingDetails, {
    fields: [collections.billingCompanyId],
    references: [billingDetails.id],
  }),
  product: one(products, {
    fields: [collections.productId],
    references: [products.id],
  }),
  hospital: one(hospitals, {
    fields: [collections.hospitalId],
    references: [hospitals.id],
  }),
  cordBloodCollector: one(collaborators, {
    fields: [collections.cordBloodCollectorId],
    references: [collaborators.id],
  }),
  representative: one(users, {
    fields: [collections.representativeId],
    references: [users.id],
  }),
  labResults: many(collectionLabResults),
}));

export const collectionLabResultsRelations = relations(collectionLabResults, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionLabResults.collectionId],
    references: [collections.id],
  }),
}));

// ========================================
// API Keys - for external system integration
// ========================================

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  
  permissions: text("permissions").array().notNull().default(sql`ARRAY['lab_results:write']::text[]`),
  rateLimit: integer("rate_limit").notNull().default(60),
  
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// ========================================
// ALERT RULES - Customizable Metric-Based Alerts
// ========================================

// Alert metric types
export const ALERT_METRICS = [
  { value: 'pending_lab_results', label: 'Pending Lab Results', category: 'collections' },
  { value: 'collections_without_hospital', label: 'Collections Without Hospital', category: 'collections' },
  { value: 'overdue_collections', label: 'Overdue Collections (no activity)', category: 'collections' },
  { value: 'pending_evaluations', label: 'Pending Evaluations', category: 'collections' },
  { value: 'expiring_api_keys', label: 'Expiring API Keys', category: 'system' },
  { value: 'inactive_customers', label: 'Inactive Customers', category: 'customers' },
  { value: 'upcoming_collection_dates', label: 'Upcoming Collection Dates', category: 'collections' },
  { value: 'low_collection_rate', label: 'Low Collection Rate', category: 'collections' },
  { value: 'pending_invoices', label: 'Pending Invoices', category: 'billing' },
  { value: 'overdue_tasks', label: 'Overdue Tasks', category: 'tasks' },
] as const;

export const ALERT_COMPARISON_OPERATORS = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
  { value: 'neq', label: '!=' },
] as const;

export const ALERT_CHECK_FREQUENCIES = [
  { value: 'hourly', label: 'Every Hour', intervalMs: 3600000 },
  { value: 'every_6_hours', label: 'Every 6 Hours', intervalMs: 21600000 },
  { value: 'daily', label: 'Once a Day', intervalMs: 86400000 },
  { value: 'weekly', label: 'Once a Week', intervalMs: 604800000 },
] as const;

export const alertRules = pgTable("alert_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule identification
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  
  // Metric configuration
  metricType: varchar("metric_type", { length: 50 }).notNull(), // From ALERT_METRICS
  comparisonOperator: varchar("comparison_operator", { length: 10 }).notNull().default("gt"), // gt, gte, lt, lte, eq, neq
  thresholdValue: integer("threshold_value").notNull(), // The value to compare against
  
  // Scope filters
  countryCodes: text("country_codes").array(), // null = all countries
  
  // Schedule
  checkFrequency: varchar("check_frequency", { length: 20 }).notNull().default("daily"), // hourly, every_6_hours, daily, weekly
  lastCheckedAt: timestamp("last_checked_at"),
  nextCheckAt: timestamp("next_check_at"),
  
  // Notification settings
  notificationPriority: varchar("notification_priority", { length: 20 }).notNull().default("high"), // low, normal, high, urgent
  
  // Target users
  targetType: varchar("target_type", { length: 50 }).notNull().default("role"), // all, role, specific_users
  targetRoles: text("target_roles").array(), // For role-based targeting
  targetUserIds: text("target_user_ids").array(), // For specific user targeting
  
  // Cooldown (avoid repeated alerts)
  cooldownMinutes: integer("cooldown_minutes").notNull().default(60), // Minimum time between alerts
  lastAlertedAt: timestamp("last_alerted_at"),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  // Tracking
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  lastCheckedAt: true,
  nextCheckAt: true,
  lastAlertedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

export const alertRulesRelations = relations(alertRules, ({ one }) => ({
  creator: one(users, {
    fields: [alertRules.createdBy],
    references: [users.id],
  }),
}));

// Alert instances - individual alert occurrences
export const alertInstances = pgTable("alert_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertRuleId: varchar("alert_rule_id").notNull().references(() => alertRules.id, { onDelete: 'cascade' }),
  
  // Snapshot of alert data
  metricValue: integer("metric_value").notNull(), // The actual value when alert was triggered
  thresholdValue: integer("threshold_value").notNull(), // The threshold at time of alert
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, acknowledged, resolved
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  
  // Related notifications
  notificationsSent: integer("notifications_sent").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAlertInstanceSchema = createInsertSchema(alertInstances).omit({
  id: true,
  createdAt: true,
});
export type InsertAlertInstance = z.infer<typeof insertAlertInstanceSchema>;
export type AlertInstance = typeof alertInstances.$inferSelect;

export const alertInstancesRelations = relations(alertInstances, ({ one }) => ({
  alertRule: one(alertRules, {
    fields: [alertInstances.alertRuleId],
    references: [alertRules.id],
  }),
  acknowledger: one(users, {
    fields: [alertInstances.acknowledgedBy],
    references: [users.id],
  }),
}));

// ============================================
// MESSAGE TEMPLATES SYSTEM
// Email and SMS templates with variable support
// ============================================

export const MESSAGE_TEMPLATE_TYPES = ["email", "sms"] as const;
export const MESSAGE_TEMPLATE_FORMATS = ["text", "html"] as const;

// Template categories for organization
export const templateCategories = pgTable("template_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  departmentCode: varchar("department_code", { length: 50 }), // sales, support, marketing, etc.
  icon: varchar("icon", { length: 50 }), // lucide icon name
  color: varchar("color", { length: 20 }), // for UI display
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertTemplateCategorySchema = createInsertSchema(templateCategories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplateCategory = z.infer<typeof insertTemplateCategorySchema>;
export type TemplateCategory = typeof templateCategories.$inferSelect;

// Message templates - email and SMS templates
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic info
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  
  // Type and format
  type: varchar("type", { length: 20 }).notNull(), // email, sms
  format: varchar("format", { length: 20 }).notNull().default("text"), // text, html
  
  // Content
  subject: text("subject"), // For emails only
  content: text("content").notNull(), // Template content with {{variables}}
  contentHtml: text("content_html"), // HTML version for rich emails
  
  // Categorization
  categoryId: varchar("category_id").references(() => templateCategories.id),
  tags: text("tags").array(), // Additional tags for filtering
  
  // Language
  language: varchar("language", { length: 10 }).default("sk"), // sk, cs, hu, de, it, ro, en
  
  // Default and priority settings
  isDefault: boolean("is_default").default(false), // Default template for category
  priority: integer("priority").default(0), // For ordering
  
  // AI matching
  aiMatchScore: integer("ai_match_score"), // AI-calculated relevance score
  aiSuggestedFor: text("ai_suggested_for").array(), // Types of responses this template is best for
  lastAiAnalysis: timestamp("last_ai_analysis"),
  
  // Usage tracking
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({ 
  id: true, 
  usageCount: true,
  lastUsedAt: true,
  aiMatchScore: true,
  lastAiAnalysis: true,
  createdAt: true, 
  updatedAt: true 
});
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

export const messageTemplatesRelations = relations(messageTemplates, ({ one }) => ({
  category: one(templateCategories, {
    fields: [messageTemplates.categoryId],
    references: [templateCategories.id],
  }),
  creator: one(users, {
    fields: [messageTemplates.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [messageTemplates.updatedBy],
    references: [users.id],
  }),
}));

export const templateCategoriesRelations = relations(templateCategories, ({ many }) => ({
  templates: many(messageTemplates),
}));

// ============================================
// AGENT SESSION MANAGEMENT
// Session tracking, activity logging, and break management
// ============================================

export const AGENT_SESSION_STATUSES = ["available", "busy", "break", "wrap_up", "offline"] as const;
export type AgentSessionStatus = typeof AGENT_SESSION_STATUSES[number];

export const AGENT_ACTIVITY_TYPES = ["call", "email", "sms", "chat", "wrap_up", "status_change", "disposition"] as const;
export type AgentActivityType = typeof AGENT_ACTIVITY_TYPES[number];

export const agentSessions = pgTable("agent_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).notNull().default("available"),
  campaignId: varchar("campaign_id"),
  campaignIds: text("campaign_ids").array().default(sql`ARRAY[]::text[]`),
  inboundQueueIds: text("inbound_queue_ids").array().default(sql`ARRAY[]::text[]`),
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  endedAt: timestamp("ended_at"),
  lastActiveAt: timestamp("last_active_at").notNull().default(sql`now()`),
  totalWorkTime: integer("total_work_time").default(0),
  totalBreakTime: integer("total_break_time").default(0),
  totalCallTime: integer("total_call_time").default(0),
  totalEmailTime: integer("total_email_time").default(0),
  totalSmsTime: integer("total_sms_time").default(0),
  totalWrapUpTime: integer("total_wrap_up_time").default(0),
  contactsHandled: integer("contacts_handled").default(0),
  metadata: jsonb("metadata"),
});

export const insertAgentSessionSchema = createInsertSchema(agentSessions).omit({
  id: true,
  startedAt: true,
  endedAt: true,
  lastActiveAt: true,
  totalWorkTime: true,
  totalBreakTime: true,
  totalCallTime: true,
  totalEmailTime: true,
  totalSmsTime: true,
  totalWrapUpTime: true,
  contactsHandled: true,
});
export type InsertAgentSession = z.infer<typeof insertAgentSessionSchema>;
export type AgentSession = typeof agentSessions.$inferSelect;

export const agentSessionActivities = pgTable("agent_session_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => agentSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 30 }).notNull(),
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
  contactId: varchar("contact_id"),
  campaignId: varchar("campaign_id"),
  metadata: jsonb("metadata"),
});

export const insertAgentSessionActivitySchema = createInsertSchema(agentSessionActivities).omit({
  id: true,
  startedAt: true,
  endedAt: true,
  durationSeconds: true,
});
export type InsertAgentSessionActivity = z.infer<typeof insertAgentSessionActivitySchema>;
export type AgentSessionActivity = typeof agentSessionActivities.$inferSelect;

export const agentBreakTypes = pgTable("agent_break_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  campaignId: varchar("campaign_id"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  maxDurationMinutes: integer("max_duration_minutes"),
  expectedDurationMinutes: integer("expected_duration_minutes"),
  translations: jsonb("translations"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAgentBreakTypeSchema = createInsertSchema(agentBreakTypes).omit({
  id: true,
  createdAt: true,
});
export type InsertAgentBreakType = z.infer<typeof insertAgentBreakTypeSchema>;
export type AgentBreakType = typeof agentBreakTypes.$inferSelect;

export const agentBreaks = pgTable("agent_breaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => agentSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  breakTypeId: varchar("break_type_id").references(() => agentBreakTypes.id),
  breakTypeName: varchar("break_type_name", { length: 100 }),
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
});

export const insertAgentBreakSchema = createInsertSchema(agentBreaks).omit({
  id: true,
  startedAt: true,
  endedAt: true,
  durationSeconds: true,
});
export type InsertAgentBreak = z.infer<typeof insertAgentBreakSchema>;
export type AgentBreak = typeof agentBreaks.$inferSelect;

export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  user: one(users, { fields: [agentSessions.userId], references: [users.id] }),
  activities: many(agentSessionActivities),
  breaks: many(agentBreaks),
}));

export const agentSessionActivitiesRelations = relations(agentSessionActivities, ({ one }) => ({
  session: one(agentSessions, { fields: [agentSessionActivities.sessionId], references: [agentSessions.id] }),
}));

export const agentBreaksRelations = relations(agentBreaks, ({ one }) => ({
  session: one(agentSessions, { fields: [agentBreaks.sessionId], references: [agentSessions.id] }),
  breakType: one(agentBreakTypes, { fields: [agentBreaks.breakTypeId], references: [agentBreakTypes.id] }),
}));

// Executive Summaries - AI-generated summaries from collection data
export const executiveSummaries = pgTable("executive_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  countryCode: text("country_code"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  periodType: text("period_type").notNull(), // "monthly", "quarterly", "yearly", "custom"
  totalCollections: integer("total_collections").notNull().default(0),
  summaryText: text("summary_text").notNull(),
  trends: jsonb("trends"), // { key, direction, value, description }[]
  anomalies: jsonb("anomalies"), // { severity, title, description, metric }[]
  kpis: jsonb("kpis"), // { label, value, change, changePercent }[]
  metadata: jsonb("metadata"), // additional raw stats used for generation
  generatedBy: varchar("generated_by"),
  status: text("status").notNull().default("completed"), // "generating", "completed", "failed"
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertExecutiveSummarySchema = createInsertSchema(executiveSummaries).omit({
  id: true,
  createdAt: true,
});
export type InsertExecutiveSummary = z.infer<typeof insertExecutiveSummarySchema>;
export type ExecutiveSummary = typeof executiveSummaries.$inferSelect;

export const scheduledReports = pgTable("scheduled_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  reportTypes: text("report_types").array().notNull(),
  recipientUserIds: text("recipient_user_ids").array().notNull(),
  externalEmails: text("external_emails").array().default(sql`'{}'::text[]`),
  sendTime: varchar("send_time", { length: 5 }).notNull(),
  dateRangeType: text("date_range_type").notNull().default("yesterday"),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({
  id: true,
  lastRunAt: true,
  nextRunAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;

// ========== INBOUND QUEUE SYSTEM (ASTERISK ARI) ==========

// ARI Connection Settings - Asterisk REST Interface connection configuration
export const ariSettings = pgTable("ari_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(8088),
  protocol: text("protocol").notNull().default("http"), // http, https
  username: text("username").notNull().default(""),
  password: text("password").notNull().default(""),
  appName: text("app_name").notNull().default("indexus-crm"),
  wsProtocol: text("ws_protocol").notNull().default("ws"), // ws, wss
  wsPort: integer("ws_port").notNull().default(8088),
  isEnabled: boolean("is_enabled").notNull().default(false),
  autoConnect: boolean("auto_connect").notNull().default(false),
  sshPort: integer("ssh_port").notNull().default(22),
  sshUsername: text("ssh_username").notNull().default(""),
  sshPassword: text("ssh_password").notNull().default(""),
  asteriskSoundsPath: text("asterisk_sounds_path").notNull().default("/var/lib/asterisk/sounds/custom"),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  updatedBy: varchar("updated_by"),
});

export const insertAriSettingsSchema = createInsertSchema(ariSettings).omit({
  id: true,
  updatedAt: true,
});
export type InsertAriSettings = z.infer<typeof insertAriSettingsSchema>;
export type AriSettings = typeof ariSettings.$inferSelect;

// Inbound Queues - call queue definitions managed from CRM
export const inboundQueues = pgTable("inbound_queues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  countryCode: text("country_code"), // SK, CZ, HU, etc.
  didNumber: text("did_number"), // DID/phone number routed to this queue
  strategy: text("strategy").notNull().default("round-robin"), // round-robin, least-calls, longest-idle, skills-based, random
  maxWaitTime: integer("max_wait_time").notNull().default(300), // max wait in seconds before overflow
  wrapUpTime: integer("wrap_up_time").notNull().default(30), // wrap-up time after call in seconds
  maxQueueSize: integer("max_queue_size").notNull().default(50), // max callers in queue
  priority: integer("priority").notNull().default(1), // queue priority (higher = more important)
  welcomeMessageId: varchar("welcome_message_id"), // IVR welcome message
  holdMusicId: varchar("hold_music_id"), // hold music file
  overflowAction: text("overflow_action").notNull().default("voicemail"), // voicemail, hangup, transfer, queue, user_pjsip
  overflowTarget: text("overflow_target"), // target number/queue for overflow
  overflowUserId: varchar("overflow_user_id"), // user ID for user_pjsip overflow action
  announcePosition: boolean("announce_position").notNull().default(true),
  announceWaitTime: boolean("announce_wait_time").notNull().default(true),
  announceFrequency: integer("announce_frequency").notNull().default(30), // seconds between announcements
  announcePositionMessageId: varchar("announce_position_message_id"), // IVR message for position announcement
  announceWaitTimeMessageId: varchar("announce_wait_time_message_id"), // IVR message for wait time announcement
  serviceLevelTarget: integer("service_level_target").notNull().default(20), // target answer time in seconds (for SLA)
  activeFrom: text("active_from"), // business hours start "HH:MM" e.g. "08:00"
  activeTo: text("active_to"), // business hours end "HH:MM" e.g. "17:00"
  activeDays: text("active_days").array().default(sql`ARRAY['1','2','3','4','5']::text[]`), // days of week: 0=Sun, 1=Mon..6=Sat
  timezone: text("timezone").notNull().default("Europe/Bratislava"),
  afterHoursAction: text("after_hours_action").notNull().default("voicemail"), // voicemail, hangup, transfer, queue
  afterHoursTarget: text("after_hours_target"), // target queue/number for after-hours routing
  afterHoursMessageId: varchar("after_hours_message_id"), // IVR message to play after hours
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertInboundQueueSchema = createInsertSchema(inboundQueues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInboundQueue = z.infer<typeof insertInboundQueueSchema>;
export type InboundQueue = typeof inboundQueues.$inferSelect;

// Queue Members - agents assigned to queues
export const queueMembers = pgTable("queue_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queueId: varchar("queue_id").notNull().references(() => inboundQueues.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  penalty: integer("penalty").notNull().default(0), // lower = higher priority in queue
  skills: text("skills").array().default(sql`'{}'::text[]`), // skill tags for skills-based routing
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertQueueMemberSchema = createInsertSchema(queueMembers).omit({
  id: true,
  createdAt: true,
});
export type InsertQueueMember = z.infer<typeof insertQueueMemberSchema>;
export type QueueMember = typeof queueMembers.$inferSelect;

// IVR Audio Messages - welcome messages, hold music, announcements
export const ivrMessages = pgTable("ivr_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("welcome"), // welcome, hold_music, announcement, overflow, position, wait_time, ivr_prompt
  source: text("source").notNull().default("upload"), // upload, tts
  filePath: text("file_path"), // path to audio file
  textContent: text("text_content"), // for TTS text
  ttsVoice: text("tts_voice"), // OpenAI voice: alloy, echo, fable, onyx, nova, shimmer
  ttsGender: text("tts_gender"), // male, female
  language: text("language").notNull().default("sk"), // sk, cs, hu, ro, it, de, en
  countryCode: text("country_code"), // SK, CZ, HU, etc.
  duration: integer("duration"), // duration in seconds
  fileSize: integer("file_size"), // file size in bytes
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertIvrMessageSchema = createInsertSchema(ivrMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIvrMessage = z.infer<typeof insertIvrMessageSchema>;
export type IvrMessage = typeof ivrMessages.$inferSelect;

// IVR Menus - IVR decision trees with DTMF options
export const ivrMenus = pgTable("ivr_menus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  countryCode: text("country_code"),
  promptMessageId: varchar("prompt_message_id").references(() => ivrMessages.id),
  invalidMessageId: varchar("invalid_message_id").references(() => ivrMessages.id),
  timeoutMessageId: varchar("timeout_message_id").references(() => ivrMessages.id),
  maxRetries: integer("max_retries").notNull().default(3),
  timeout: integer("timeout").notNull().default(5), // seconds to wait for DTMF
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertIvrMenuSchema = createInsertSchema(ivrMenus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIvrMenu = z.infer<typeof insertIvrMenuSchema>;
export type IvrMenu = typeof ivrMenus.$inferSelect;

// IVR Menu Options - DTMF key mappings
export const ivrMenuOptions = pgTable("ivr_menu_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  menuId: varchar("menu_id").notNull().references(() => ivrMenus.id, { onDelete: "cascade" }),
  dtmfKey: text("dtmf_key").notNull(), // 0-9, *, #
  label: text("label").notNull(),
  action: text("action").notNull(), // queue, submenu, transfer, hangup, voicemail, repeat
  targetId: text("target_id"), // queue ID, submenu ID, or phone number
  announcementId: varchar("announcement_id").references(() => ivrMessages.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertIvrMenuOptionSchema = createInsertSchema(ivrMenuOptions).omit({
  id: true,
  createdAt: true,
});
export type InsertIvrMenuOption = z.infer<typeof insertIvrMenuOptionSchema>;
export type IvrMenuOption = typeof ivrMenuOptions.$inferSelect;

// Inbound Call Log - tracks inbound calls through the queue system
export const inboundCallLogs = pgTable("inbound_call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queueId: varchar("queue_id").references(() => inboundQueues.id),
  callLogId: varchar("call_log_id").references(() => callLogs.id), // linked to existing call_logs when answered
  callerNumber: text("caller_number").notNull(),
  callerName: text("caller_name"), // caller ID name if available
  customerId: varchar("customer_id"), // auto-matched customer
  assignedAgentId: varchar("assigned_agent_id"),
  ariChannelId: text("ari_channel_id"), // Asterisk ARI channel ID
  status: text("status").notNull().default("queued"), // queued, ringing, answered, completed, abandoned, timeout, overflow
  enteredQueueAt: timestamp("entered_queue_at").notNull().default(sql`now()`),
  answeredAt: timestamp("answered_at"),
  completedAt: timestamp("completed_at"),
  waitDurationSeconds: integer("wait_duration_seconds").default(0),
  talkDurationSeconds: integer("talk_duration_seconds").default(0),
  queuePosition: integer("queue_position"),
  abandonReason: text("abandon_reason"), // caller_hangup, timeout, overflow
  transferredTo: text("transferred_to"), // if call was transferred
  metadata: jsonb("metadata"), // additional ARI event data
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertInboundCallLogSchema = createInsertSchema(inboundCallLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertInboundCallLog = z.infer<typeof insertInboundCallLogSchema>;
export type InboundCallLog = typeof inboundCallLogs.$inferSelect;

// Agent Queue Status - real-time agent availability tracking per queue
export const agentQueueStatus = pgTable("agent_queue_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("offline"), // available, busy, break, wrap_up, offline
  currentCallId: varchar("current_call_id"), // current inbound call being handled
  lastCallEndedAt: timestamp("last_call_ended_at"),
  callsHandled: integer("calls_handled").notNull().default(0),
  loginAt: timestamp("login_at"),
  totalTalkTime: integer("total_talk_time").notNull().default(0), // seconds
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
