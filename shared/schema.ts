import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, decimal, integer } from "drizzle-orm/pg-core";
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
] as const;

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
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
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
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

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
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  category: text("category"), // cord_blood, cord_tissue, storage, processing
  countries: text("countries").array().notNull().default(sql`ARRAY[]::text[]`), // countries where product is available
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Billing details (billing companies) - multiple per country allowed
export const billingDetails = pgTable("billing_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: text("country_code").notNull(),
  companyName: text("company_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  postalCode: text("postal_code"),
  taxId: text("tax_id"), // VAT ID / Tax number
  bankName: text("bank_name"),
  bankIban: text("bank_iban"),
  bankSwift: text("bank_swift"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull().default("20"), // VAT percentage
  currency: text("currency").notNull().default("EUR"),
  paymentTerms: integer("payment_terms").array().notNull().default(sql`ARRAY[7,14,30]::integer[]`), // Payment term options in days
  defaultPaymentTerm: integer("default_payment_term").notNull().default(14), // Default payment term in days
  isDefault: boolean("is_default").notNull().default(false), // Default billing company for this country
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Invoice items - individual line items in an invoice
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  productId: varchar("product_id"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// Customer products - products assigned to customers
export const customerProducts = pgTable("customer_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  priceOverride: decimal("price_override", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Invoices table - generated invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: varchar("customer_id").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull().default("generated"), // generated, sent, paid, overdue
  paymentTermDays: integer("payment_term_days").notNull().default(14),
  dueDate: timestamp("due_date"),
  generatedAt: timestamp("generated_at").notNull().default(sql`now()`),
  pdfPath: text("pdf_path"),
  billingCompanyName: text("billing_company_name"),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingTaxId: text("billing_tax_id"),
  billingBankName: text("billing_bank_name"),
  billingBankIban: text("billing_bank_iban"),
  billingBankSwift: text("billing_bank_swift"),
});

// Customer notes - individual notes on customer records
export const customerNotes = pgTable("customer_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  userId: varchar("user_id").notNull(), // who created the note
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Communication messages - tracks emails and SMS sent to customers
export const communicationMessages = pgTable("communication_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  userId: varchar("user_id").notNull(), // who sent the message
  type: text("type").notNull(), // email, sms
  subject: text("subject"), // for emails
  content: text("content").notNull(),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  status: text("status").notNull().default("pending"), // pending, sent, failed
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Activity logs - tracks all user actions in the system
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(), // login, logout, create, update, delete, view
  entityType: text("entity_type"), // customer, product, invoice, user, etc.
  entityId: varchar("entity_id"),
  entityName: text("entity_name"), // human-readable name for the entity
  details: text("details"), // JSON string with additional details
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

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
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
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
  category: z.string().optional().nullable(),
  countries: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
  currency: z.string().optional().default("EUR"),
});

// Billing details schemas
export const insertBillingDetailsSchema = createInsertSchema(billingDetails).omit({
  id: true,
  updatedAt: true,
}).extend({
  postalCode: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankIban: z.string().optional().nullable(),
  bankSwift: z.string().optional().nullable(),
  vatRate: z.string().optional().default("20"),
  currency: z.string().optional().default("EUR"),
  paymentTerms: z.array(z.number().int().positive()).optional().default([7, 14, 30]),
  defaultPaymentTerm: z.number().int().positive().optional().default(14),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

// Invoice item schemas
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
}).extend({
  productId: z.string().optional().nullable(),
  quantity: z.number().int().positive().optional().default(1),
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
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
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
  { value: "assistant_doctor", labelKey: "assistantDoctor" },
  { value: "head_nurse", labelKey: "headNurse" },
  { value: "call_center", labelKey: "callCenter" },
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
  
  // Basic info
  countryCode: text("country_code").notNull(),
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
  representativeId: varchar("representative_id"),
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
  note: text("note"),
  hospitalId: varchar("hospital_id"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Collaborator addresses table
export const collaboratorAddresses = pgTable("collaborator_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collaboratorId: varchar("collaborator_id").notNull(),
  addressType: text("address_type").notNull(), // permanent, correspondence, work, company
  name: text("name"),
  streetNumber: text("street_number"),
  postalCode: text("postal_code"),
  region: text("region"),
  countryCode: text("country_code"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Collaborator other data (disability, pensions)
export const collaboratorOtherData = pgTable("collaborator_other_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
export const insertCollaboratorSchema = createInsertSchema(collaborators).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  countryCode: z.string().min(1, "Country is required"),
  birthDay: z.number().min(1).max(31).optional().nullable(),
  birthMonth: z.number().min(1).max(12).optional().nullable(),
  birthYear: z.number().min(1900).max(2100).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
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

// Departments table - organizational structure
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  parentId: varchar("parent_id"), // FK to self for hierarchy
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
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
