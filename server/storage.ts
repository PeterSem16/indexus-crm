import { 
  users, customers, products, customerProducts, invoices, billingDetails, invoiceItems,
  customerNotes, activityLogs,
  type User, type InsertUser, type UpdateUser, type SafeUser,
  type Customer, type InsertCustomer,
  type Product, type InsertProduct,
  type CustomerProduct, type InsertCustomerProduct,
  type Invoice, type InsertInvoice,
  type BillingDetails, type InsertBillingDetails,
  type InvoiceItem, type InsertInvoiceItem,
  type CustomerNote, type InsertCustomerNote,
  type ActivityLog, type InsertActivityLog
} from "@shared/schema";
import { db } from "./db";
import { eq, inArray, sql, desc } from "drizzle-orm";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<SafeUser[]>;
  createUser(user: InsertUser): Promise<SafeUser>;
  updateUser(id: string, user: UpdateUser): Promise<SafeUser | undefined>;
  deleteUser(id: string): Promise<boolean>;
  validatePassword(username: string, password: string): Promise<User | null>;
  
  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getAllCustomers(): Promise<Customer[]>;
  getCustomersByCountry(countryCodes: string[]): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;

  // Products
  getProduct(id: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Customer Products
  getCustomerProducts(customerId: string): Promise<(CustomerProduct & { product: Product })[]>;
  addProductToCustomer(data: InsertCustomerProduct): Promise<CustomerProduct>;
  updateCustomerProduct(id: string, data: Partial<InsertCustomerProduct>): Promise<CustomerProduct | undefined>;
  removeProductFromCustomer(id: string): Promise<boolean>;

  // Invoices
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicesByCustomer(customerId: string): Promise<Invoice[]>;
  getAllInvoices(): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  getNextInvoiceNumber(): Promise<string>;

  // Billing Details
  getBillingDetails(countryCode: string): Promise<BillingDetails | undefined>;
  getAllBillingDetails(): Promise<BillingDetails[]>;
  upsertBillingDetails(data: InsertBillingDetails): Promise<BillingDetails>;

  // Invoice Items
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  createInvoiceItems(items: InsertInvoiceItem[]): Promise<InvoiceItem[]>;

  // Customer Notes
  getCustomerNotes(customerId: string): Promise<CustomerNote[]>;
  createCustomerNote(note: InsertCustomerNote): Promise<CustomerNote>;
  deleteCustomerNote(id: string): Promise<boolean>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByUser(userId: string, limit?: number): Promise<ActivityLog[]>;
  getActivityLogsByEntity(entityType: string, entityId: string): Promise<ActivityLog[]>;
  getAllActivityLogs(limit?: number): Promise<ActivityLog[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getAllUsers(): Promise<SafeUser[]> {
    const allUsers = await db.select().from(users);
    return allUsers.map(toSafeUser);
  }

  async createUser(insertUser: InsertUser): Promise<SafeUser> {
    const { password, ...userData } = insertUser;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    const [user] = await db.insert(users).values({
      ...userData,
      passwordHash,
    }).returning();
    
    return toSafeUser(user);
  }

  async updateUser(id: string, updateData: UpdateUser): Promise<SafeUser | undefined> {
    const { password, ...userData } = updateData;
    
    let dataToUpdate: Partial<User> = { ...userData };
    
    if (password) {
      dataToUpdate.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }
    
    const [user] = await db
      .update(users)
      .set(dataToUpdate)
      .where(eq(users.id, id))
      .returning();
    
    return user ? toSafeUser(user) : undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async validatePassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return db.select().from(customers);
  }

  async getCustomersByCountry(countryCodes: string[]): Promise<Customer[]> {
    const allCustomers = await db.select().from(customers);
    return allCustomers.filter(c => countryCodes.includes(c.country));
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: string, updateData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  // Products
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();
    return product || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Customer Products
  async getCustomerProducts(customerId: string): Promise<(CustomerProduct & { product: Product })[]> {
    const cps = await db.select().from(customerProducts).where(eq(customerProducts.customerId, customerId));
    const result: (CustomerProduct & { product: Product })[] = [];
    
    for (const cp of cps) {
      const product = await this.getProduct(cp.productId);
      if (product) {
        result.push({ ...cp, product });
      }
    }
    
    return result;
  }

  async addProductToCustomer(data: InsertCustomerProduct): Promise<CustomerProduct> {
    const [cp] = await db.insert(customerProducts).values(data).returning();
    return cp;
  }

  async updateCustomerProduct(id: string, data: Partial<InsertCustomerProduct>): Promise<CustomerProduct | undefined> {
    const [cp] = await db
      .update(customerProducts)
      .set(data)
      .where(eq(customerProducts.id, id))
      .returning();
    return cp || undefined;
  }

  async removeProductFromCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customerProducts).where(eq(customerProducts.id, id)).returning();
    return result.length > 0;
  }

  // Invoices
  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.customerId, customerId));
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices);
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [inv] = await db.insert(invoices).values(invoice).returning();
    return inv;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db
      .update(invoices)
      .set(data)
      .where(eq(invoices.id, id))
      .returning();
    return invoice || undefined;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices);
    const count = Number(result?.count || 0) + 1;
    return `INV-${year}-${String(count).padStart(5, '0')}`;
  }

  // Billing Details
  async getBillingDetails(countryCode: string): Promise<BillingDetails | undefined> {
    const [details] = await db.select().from(billingDetails).where(eq(billingDetails.countryCode, countryCode));
    return details || undefined;
  }

  async getAllBillingDetails(): Promise<BillingDetails[]> {
    return db.select().from(billingDetails);
  }

  async upsertBillingDetails(data: InsertBillingDetails): Promise<BillingDetails> {
    const existing = await this.getBillingDetails(data.countryCode);
    if (existing) {
      const [updated] = await db
        .update(billingDetails)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(billingDetails.countryCode, data.countryCode))
        .returning();
      return updated;
    }
    const [created] = await db.insert(billingDetails).values(data).returning();
    return created;
  }

  // Invoice Items
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem> {
    const [created] = await db.insert(invoiceItems).values(item).returning();
    return created;
  }

  async createInvoiceItems(items: InsertInvoiceItem[]): Promise<InvoiceItem[]> {
    if (items.length === 0) return [];
    return db.insert(invoiceItems).values(items).returning();
  }

  // Customer Notes
  async getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
    return db.select().from(customerNotes)
      .where(eq(customerNotes.customerId, customerId))
      .orderBy(desc(customerNotes.createdAt));
  }

  async createCustomerNote(note: InsertCustomerNote): Promise<CustomerNote> {
    const [created] = await db.insert(customerNotes).values(note).returning();
    return created;
  }

  async deleteCustomerNote(id: string): Promise<boolean> {
    const result = await db.delete(customerNotes).where(eq(customerNotes.id, id)).returning();
    return result.length > 0;
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async getActivityLogsByUser(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    return db.select().from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async getActivityLogsByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    return db.select().from(activityLogs)
      .where(sql`${activityLogs.entityType} = ${entityType} AND ${activityLogs.entityId} = ${entityId}`)
      .orderBy(desc(activityLogs.createdAt));
  }

  async getAllActivityLogs(limit: number = 100): Promise<ActivityLog[]> {
    return db.select().from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
