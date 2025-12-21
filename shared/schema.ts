import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Country codes for the CRM system
export const COUNTRIES = [
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "US", name: "USA", flag: "🇺🇸" },
] as const;

export type CountryCode = typeof COUNTRIES[number]["code"];

// Users table - CRM system users who can access the system
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // admin, manager, user
  isActive: boolean("is_active").notNull().default(true),
  assignedCountries: text("assigned_countries").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Customers table - cord blood banking customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  country: text("country").notNull(), // country code
  city: text("city"),
  address: text("address"),
  status: text("status").notNull().default("active"), // active, pending, inactive
  serviceType: text("service_type"), // cord_blood, cord_tissue, both
  notes: text("notes"),
  assignedUserId: varchar("assigned_user_id"),
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

// Billing details per country
export const billingDetails = pgTable("billing_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: text("country_code").notNull().unique(),
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
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.string().optional().default("pending"),
  serviceType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
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
