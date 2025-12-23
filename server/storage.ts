import { 
  users, customers, products, customerProducts, invoices, billingDetails, invoiceItems,
  customerNotes, activityLogs, communicationMessages,
  complaintTypes, cooperationTypes, vipStatuses, healthInsuranceCompanies,
  laboratories, hospitals,
  collaborators, collaboratorAddresses, collaboratorOtherData, collaboratorAgreements,
  type User, type InsertUser, type UpdateUser, type SafeUser,
  type Customer, type InsertCustomer,
  type Product, type InsertProduct,
  type CustomerProduct, type InsertCustomerProduct,
  type Invoice, type InsertInvoice,
  type BillingDetails, type InsertBillingDetails,
  type InvoiceItem, type InsertInvoiceItem,
  type CustomerNote, type InsertCustomerNote,
  type ActivityLog, type InsertActivityLog,
  type CommunicationMessage, type InsertCommunicationMessage,
  type ComplaintType, type InsertComplaintType,
  type CooperationType, type InsertCooperationType,
  type VipStatus, type InsertVipStatus,
  type HealthInsurance, type InsertHealthInsurance,
  type Laboratory, type InsertLaboratory,
  type Hospital, type InsertHospital,
  type Collaborator, type InsertCollaborator,
  type CollaboratorAddress, type InsertCollaboratorAddress,
  type CollaboratorOtherData, type InsertCollaboratorOtherData,
  type CollaboratorAgreement, type InsertCollaboratorAgreement
} from "@shared/schema";
import { db } from "./db";
import { eq, inArray, sql, desc, and } from "drizzle-orm";
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

  // Billing Details (Billing Companies)
  getBillingDetails(countryCode: string): Promise<BillingDetails | undefined>;
  getBillingDetailsByCountry(countryCode: string): Promise<BillingDetails[]>;
  getBillingDetailsById(id: string): Promise<BillingDetails | undefined>;
  getAllBillingDetails(): Promise<BillingDetails[]>;
  createBillingDetails(data: InsertBillingDetails): Promise<BillingDetails>;
  updateBillingDetails(id: string, data: Partial<InsertBillingDetails>): Promise<BillingDetails>;
  deleteBillingDetails(id: string): Promise<boolean>;
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

  // Communication Messages
  createCommunicationMessage(message: InsertCommunicationMessage): Promise<CommunicationMessage>;
  updateCommunicationMessage(id: string, data: Partial<CommunicationMessage>): Promise<CommunicationMessage | undefined>;
  getCommunicationMessagesByCustomer(customerId: string): Promise<CommunicationMessage[]>;
  getAllCommunicationMessages(limit?: number): Promise<CommunicationMessage[]>;

  // Complaint Types
  getAllComplaintTypes(): Promise<ComplaintType[]>;
  getComplaintTypesByCountry(countryCode: string | null): Promise<ComplaintType[]>;
  createComplaintType(data: InsertComplaintType): Promise<ComplaintType>;
  updateComplaintType(id: string, data: Partial<InsertComplaintType>): Promise<ComplaintType | undefined>;
  deleteComplaintType(id: string): Promise<boolean>;

  // Cooperation Types
  getAllCooperationTypes(): Promise<CooperationType[]>;
  getCooperationTypesByCountry(countryCode: string | null): Promise<CooperationType[]>;
  createCooperationType(data: InsertCooperationType): Promise<CooperationType>;
  updateCooperationType(id: string, data: Partial<InsertCooperationType>): Promise<CooperationType | undefined>;
  deleteCooperationType(id: string): Promise<boolean>;

  // VIP Statuses
  getAllVipStatuses(): Promise<VipStatus[]>;
  getVipStatusesByCountry(countryCode: string | null): Promise<VipStatus[]>;
  createVipStatus(data: InsertVipStatus): Promise<VipStatus>;
  updateVipStatus(id: string, data: Partial<InsertVipStatus>): Promise<VipStatus | undefined>;
  deleteVipStatus(id: string): Promise<boolean>;

  // Health Insurance Companies
  getAllHealthInsuranceCompanies(): Promise<HealthInsurance[]>;
  getHealthInsuranceByCountry(countryCode: string): Promise<HealthInsurance[]>;
  createHealthInsurance(data: InsertHealthInsurance): Promise<HealthInsurance>;
  updateHealthInsurance(id: string, data: Partial<InsertHealthInsurance>): Promise<HealthInsurance | undefined>;
  deleteHealthInsurance(id: string): Promise<boolean>;

  // Laboratories
  getAllLaboratories(): Promise<Laboratory[]>;
  getLaboratoriesByCountry(countryCode: string): Promise<Laboratory[]>;
  createLaboratory(data: InsertLaboratory): Promise<Laboratory>;
  updateLaboratory(id: string, data: Partial<InsertLaboratory>): Promise<Laboratory | undefined>;
  deleteLaboratory(id: string): Promise<boolean>;

  // Hospitals
  getHospital(id: string): Promise<Hospital | undefined>;
  getAllHospitals(): Promise<Hospital[]>;
  getHospitalsByCountry(countryCodes: string[]): Promise<Hospital[]>;
  createHospital(data: InsertHospital): Promise<Hospital>;
  updateHospital(id: string, data: Partial<InsertHospital>): Promise<Hospital | undefined>;
  deleteHospital(id: string): Promise<boolean>;

  // Collaborators
  getCollaborator(id: string): Promise<Collaborator | undefined>;
  getAllCollaborators(): Promise<Collaborator[]>;
  getCollaboratorsByCountry(countryCodes: string[]): Promise<Collaborator[]>;
  createCollaborator(data: InsertCollaborator): Promise<Collaborator>;
  updateCollaborator(id: string, data: Partial<InsertCollaborator>): Promise<Collaborator | undefined>;
  deleteCollaborator(id: string): Promise<boolean>;

  // Collaborator Addresses
  getCollaboratorAddresses(collaboratorId: string): Promise<CollaboratorAddress[]>;
  getCollaboratorAddressByType(collaboratorId: string, addressType: string): Promise<CollaboratorAddress | undefined>;
  upsertCollaboratorAddress(data: InsertCollaboratorAddress): Promise<CollaboratorAddress>;
  deleteCollaboratorAddress(id: string): Promise<boolean>;

  // Collaborator Other Data
  getCollaboratorOtherData(collaboratorId: string): Promise<CollaboratorOtherData | undefined>;
  upsertCollaboratorOtherData(data: InsertCollaboratorOtherData): Promise<CollaboratorOtherData>;

  // Collaborator Agreements
  getCollaboratorAgreements(collaboratorId: string): Promise<CollaboratorAgreement[]>;
  getAllCollaboratorAgreements(): Promise<CollaboratorAgreement[]>;
  createCollaboratorAgreement(data: InsertCollaboratorAgreement): Promise<CollaboratorAgreement>;
  updateCollaboratorAgreement(id: string, data: Partial<InsertCollaboratorAgreement>): Promise<CollaboratorAgreement | undefined>;
  deleteCollaboratorAgreement(id: string): Promise<boolean>;
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

  // Billing Details (Billing Companies)
  async getBillingDetails(countryCode: string): Promise<BillingDetails | undefined> {
    // Get the default billing company for a country, or the first one if no default
    const [defaultDetails] = await db.select().from(billingDetails)
      .where(and(eq(billingDetails.countryCode, countryCode), eq(billingDetails.isDefault, true)));
    if (defaultDetails) return defaultDetails;
    
    const [firstDetails] = await db.select().from(billingDetails)
      .where(eq(billingDetails.countryCode, countryCode));
    return firstDetails || undefined;
  }

  async getBillingDetailsByCountry(countryCode: string): Promise<BillingDetails[]> {
    return db.select().from(billingDetails)
      .where(eq(billingDetails.countryCode, countryCode));
  }

  async getBillingDetailsById(id: string): Promise<BillingDetails | undefined> {
    const [details] = await db.select().from(billingDetails).where(eq(billingDetails.id, id));
    return details || undefined;
  }

  async getAllBillingDetails(): Promise<BillingDetails[]> {
    return db.select().from(billingDetails);
  }

  async createBillingDetails(data: InsertBillingDetails): Promise<BillingDetails> {
    // If this is marked as default, unset other defaults for this country
    if (data.isDefault) {
      await db.update(billingDetails)
        .set({ isDefault: false })
        .where(eq(billingDetails.countryCode, data.countryCode));
    }
    const [created] = await db.insert(billingDetails).values(data).returning();
    return created;
  }

  async updateBillingDetails(id: string, data: Partial<InsertBillingDetails>): Promise<BillingDetails> {
    // If setting as default, unset other defaults for this country
    if (data.isDefault) {
      const existing = await this.getBillingDetailsById(id);
      if (existing) {
        await db.update(billingDetails)
          .set({ isDefault: false })
          .where(and(eq(billingDetails.countryCode, existing.countryCode), sql`id != ${id}`));
      }
    }
    const [updated] = await db
      .update(billingDetails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(billingDetails.id, id))
      .returning();
    return updated;
  }

  async deleteBillingDetails(id: string): Promise<boolean> {
    const result = await db.delete(billingDetails).where(eq(billingDetails.id, id)).returning();
    return result.length > 0;
  }

  async upsertBillingDetails(data: InsertBillingDetails): Promise<BillingDetails> {
    // Legacy method - creates new billing company
    return this.createBillingDetails(data);
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

  // Communication Messages
  async createCommunicationMessage(message: InsertCommunicationMessage): Promise<CommunicationMessage> {
    const [created] = await db.insert(communicationMessages).values(message).returning();
    return created;
  }

  async updateCommunicationMessage(id: string, data: Partial<CommunicationMessage>): Promise<CommunicationMessage | undefined> {
    const [updated] = await db
      .update(communicationMessages)
      .set(data)
      .where(eq(communicationMessages.id, id))
      .returning();
    return updated || undefined;
  }

  async getCommunicationMessagesByCustomer(customerId: string): Promise<CommunicationMessage[]> {
    return db.select().from(communicationMessages)
      .where(eq(communicationMessages.customerId, customerId))
      .orderBy(desc(communicationMessages.createdAt));
  }

  async getAllCommunicationMessages(limit: number = 100): Promise<CommunicationMessage[]> {
    return db.select().from(communicationMessages)
      .orderBy(desc(communicationMessages.createdAt))
      .limit(limit);
  }

  // Complaint Types
  async getAllComplaintTypes(): Promise<ComplaintType[]> {
    return db.select().from(complaintTypes).orderBy(complaintTypes.name);
  }

  async getComplaintTypesByCountry(countryCode: string | null): Promise<ComplaintType[]> {
    if (countryCode === null) {
      return db.select().from(complaintTypes)
        .where(sql`${complaintTypes.countryCode} IS NULL`)
        .orderBy(complaintTypes.name);
    }
    return db.select().from(complaintTypes)
      .where(sql`${complaintTypes.countryCode} = ${countryCode} OR ${complaintTypes.countryCode} IS NULL`)
      .orderBy(complaintTypes.name);
  }

  async createComplaintType(data: InsertComplaintType): Promise<ComplaintType> {
    const [created] = await db.insert(complaintTypes).values(data).returning();
    return created;
  }

  async updateComplaintType(id: string, data: Partial<InsertComplaintType>): Promise<ComplaintType | undefined> {
    const [updated] = await db.update(complaintTypes).set(data).where(eq(complaintTypes.id, id)).returning();
    return updated || undefined;
  }

  async deleteComplaintType(id: string): Promise<boolean> {
    const result = await db.delete(complaintTypes).where(eq(complaintTypes.id, id)).returning();
    return result.length > 0;
  }

  // Cooperation Types
  async getAllCooperationTypes(): Promise<CooperationType[]> {
    return db.select().from(cooperationTypes).orderBy(cooperationTypes.name);
  }

  async getCooperationTypesByCountry(countryCode: string | null): Promise<CooperationType[]> {
    if (countryCode === null) {
      return db.select().from(cooperationTypes)
        .where(sql`${cooperationTypes.countryCode} IS NULL`)
        .orderBy(cooperationTypes.name);
    }
    return db.select().from(cooperationTypes)
      .where(sql`${cooperationTypes.countryCode} = ${countryCode} OR ${cooperationTypes.countryCode} IS NULL`)
      .orderBy(cooperationTypes.name);
  }

  async createCooperationType(data: InsertCooperationType): Promise<CooperationType> {
    const [created] = await db.insert(cooperationTypes).values(data).returning();
    return created;
  }

  async updateCooperationType(id: string, data: Partial<InsertCooperationType>): Promise<CooperationType | undefined> {
    const [updated] = await db.update(cooperationTypes).set(data).where(eq(cooperationTypes.id, id)).returning();
    return updated || undefined;
  }

  async deleteCooperationType(id: string): Promise<boolean> {
    const result = await db.delete(cooperationTypes).where(eq(cooperationTypes.id, id)).returning();
    return result.length > 0;
  }

  // VIP Statuses
  async getAllVipStatuses(): Promise<VipStatus[]> {
    return db.select().from(vipStatuses).orderBy(vipStatuses.name);
  }

  async getVipStatusesByCountry(countryCode: string | null): Promise<VipStatus[]> {
    if (countryCode === null) {
      return db.select().from(vipStatuses)
        .where(sql`${vipStatuses.countryCode} IS NULL`)
        .orderBy(vipStatuses.name);
    }
    return db.select().from(vipStatuses)
      .where(sql`${vipStatuses.countryCode} = ${countryCode} OR ${vipStatuses.countryCode} IS NULL`)
      .orderBy(vipStatuses.name);
  }

  async createVipStatus(data: InsertVipStatus): Promise<VipStatus> {
    const [created] = await db.insert(vipStatuses).values(data).returning();
    return created;
  }

  async updateVipStatus(id: string, data: Partial<InsertVipStatus>): Promise<VipStatus | undefined> {
    const [updated] = await db.update(vipStatuses).set(data).where(eq(vipStatuses.id, id)).returning();
    return updated || undefined;
  }

  async deleteVipStatus(id: string): Promise<boolean> {
    const result = await db.delete(vipStatuses).where(eq(vipStatuses.id, id)).returning();
    return result.length > 0;
  }

  // Health Insurance Companies
  async getAllHealthInsuranceCompanies(): Promise<HealthInsurance[]> {
    return db.select().from(healthInsuranceCompanies).orderBy(healthInsuranceCompanies.name);
  }

  async getHealthInsuranceByCountry(countryCode: string): Promise<HealthInsurance[]> {
    return db.select().from(healthInsuranceCompanies)
      .where(eq(healthInsuranceCompanies.countryCode, countryCode))
      .orderBy(healthInsuranceCompanies.name);
  }

  async createHealthInsurance(data: InsertHealthInsurance): Promise<HealthInsurance> {
    const [created] = await db.insert(healthInsuranceCompanies).values(data).returning();
    return created;
  }

  async updateHealthInsurance(id: string, data: Partial<InsertHealthInsurance>): Promise<HealthInsurance | undefined> {
    const [updated] = await db.update(healthInsuranceCompanies).set(data).where(eq(healthInsuranceCompanies.id, id)).returning();
    return updated || undefined;
  }

  async deleteHealthInsurance(id: string): Promise<boolean> {
    const result = await db.delete(healthInsuranceCompanies).where(eq(healthInsuranceCompanies.id, id)).returning();
    return result.length > 0;
  }

  // Laboratories
  async getAllLaboratories(): Promise<Laboratory[]> {
    return db.select().from(laboratories).orderBy(laboratories.name);
  }

  async getLaboratoriesByCountry(countryCode: string): Promise<Laboratory[]> {
    return db.select().from(laboratories)
      .where(eq(laboratories.countryCode, countryCode))
      .orderBy(laboratories.name);
  }

  async createLaboratory(data: InsertLaboratory): Promise<Laboratory> {
    const [created] = await db.insert(laboratories).values(data).returning();
    return created;
  }

  async updateLaboratory(id: string, data: Partial<InsertLaboratory>): Promise<Laboratory | undefined> {
    const [updated] = await db.update(laboratories).set(data).where(eq(laboratories.id, id)).returning();
    return updated || undefined;
  }

  async deleteLaboratory(id: string): Promise<boolean> {
    const result = await db.delete(laboratories).where(eq(laboratories.id, id)).returning();
    return result.length > 0;
  }

  // Hospitals
  async getHospital(id: string): Promise<Hospital | undefined> {
    const [hospital] = await db.select().from(hospitals).where(eq(hospitals.id, id));
    return hospital || undefined;
  }

  async getAllHospitals(): Promise<Hospital[]> {
    return db.select().from(hospitals).orderBy(hospitals.name);
  }

  async getHospitalsByCountry(countryCodes: string[]): Promise<Hospital[]> {
    if (countryCodes.length === 0) {
      return this.getAllHospitals();
    }
    return db.select().from(hospitals)
      .where(inArray(hospitals.countryCode, countryCodes))
      .orderBy(hospitals.name);
  }

  async createHospital(data: InsertHospital): Promise<Hospital> {
    const [created] = await db.insert(hospitals).values(data).returning();
    return created;
  }

  async updateHospital(id: string, data: Partial<InsertHospital>): Promise<Hospital | undefined> {
    const [updated] = await db.update(hospitals).set(data).where(eq(hospitals.id, id)).returning();
    return updated || undefined;
  }

  async deleteHospital(id: string): Promise<boolean> {
    const result = await db.delete(hospitals).where(eq(hospitals.id, id)).returning();
    return result.length > 0;
  }

  // Collaborators
  async getCollaborator(id: string): Promise<Collaborator | undefined> {
    const [collaborator] = await db.select().from(collaborators).where(eq(collaborators.id, id));
    return collaborator || undefined;
  }

  async getAllCollaborators(): Promise<Collaborator[]> {
    return db.select().from(collaborators).orderBy(collaborators.lastName, collaborators.firstName);
  }

  async getCollaboratorsByCountry(countryCodes: string[]): Promise<Collaborator[]> {
    if (countryCodes.length === 0) {
      return this.getAllCollaborators();
    }
    return db.select().from(collaborators)
      .where(inArray(collaborators.countryCode, countryCodes))
      .orderBy(collaborators.lastName, collaborators.firstName);
  }

  async createCollaborator(data: InsertCollaborator): Promise<Collaborator> {
    const [created] = await db.insert(collaborators).values(data).returning();
    return created;
  }

  async updateCollaborator(id: string, data: Partial<InsertCollaborator>): Promise<Collaborator | undefined> {
    const [updated] = await db.update(collaborators)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(collaborators.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCollaborator(id: string): Promise<boolean> {
    await db.delete(collaboratorAddresses).where(eq(collaboratorAddresses.collaboratorId, id));
    await db.delete(collaboratorOtherData).where(eq(collaboratorOtherData.collaboratorId, id));
    await db.delete(collaboratorAgreements).where(eq(collaboratorAgreements.collaboratorId, id));
    const result = await db.delete(collaborators).where(eq(collaborators.id, id)).returning();
    return result.length > 0;
  }

  // Collaborator Addresses
  async getCollaboratorAddresses(collaboratorId: string): Promise<CollaboratorAddress[]> {
    return db.select().from(collaboratorAddresses)
      .where(eq(collaboratorAddresses.collaboratorId, collaboratorId));
  }

  async getCollaboratorAddressByType(collaboratorId: string, addressType: string): Promise<CollaboratorAddress | undefined> {
    const [address] = await db.select().from(collaboratorAddresses)
      .where(and(
        eq(collaboratorAddresses.collaboratorId, collaboratorId),
        eq(collaboratorAddresses.addressType, addressType)
      ));
    return address || undefined;
  }

  async upsertCollaboratorAddress(data: InsertCollaboratorAddress): Promise<CollaboratorAddress> {
    const existing = await this.getCollaboratorAddressByType(data.collaboratorId, data.addressType);
    if (existing) {
      const [updated] = await db.update(collaboratorAddresses)
        .set(data)
        .where(eq(collaboratorAddresses.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(collaboratorAddresses).values(data).returning();
    return created;
  }

  async deleteCollaboratorAddress(id: string): Promise<boolean> {
    const result = await db.delete(collaboratorAddresses).where(eq(collaboratorAddresses.id, id)).returning();
    return result.length > 0;
  }

  // Collaborator Other Data
  async getCollaboratorOtherData(collaboratorId: string): Promise<CollaboratorOtherData | undefined> {
    const [data] = await db.select().from(collaboratorOtherData)
      .where(eq(collaboratorOtherData.collaboratorId, collaboratorId));
    return data || undefined;
  }

  async upsertCollaboratorOtherData(data: InsertCollaboratorOtherData): Promise<CollaboratorOtherData> {
    const existing = await this.getCollaboratorOtherData(data.collaboratorId);
    if (existing) {
      const [updated] = await db.update(collaboratorOtherData)
        .set(data)
        .where(eq(collaboratorOtherData.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(collaboratorOtherData).values(data).returning();
    return created;
  }

  // Collaborator Agreements
  async getCollaboratorAgreements(collaboratorId: string): Promise<CollaboratorAgreement[]> {
    return db.select().from(collaboratorAgreements)
      .where(eq(collaboratorAgreements.collaboratorId, collaboratorId))
      .orderBy(desc(collaboratorAgreements.createdAt));
  }

  async getAllCollaboratorAgreements(): Promise<CollaboratorAgreement[]> {
    return db.select().from(collaboratorAgreements)
      .orderBy(desc(collaboratorAgreements.createdAt));
  }

  async createCollaboratorAgreement(data: InsertCollaboratorAgreement): Promise<CollaboratorAgreement> {
    const [created] = await db.insert(collaboratorAgreements).values(data).returning();
    return created;
  }

  async updateCollaboratorAgreement(id: string, data: Partial<InsertCollaboratorAgreement>): Promise<CollaboratorAgreement | undefined> {
    const [updated] = await db.update(collaboratorAgreements)
      .set(data)
      .where(eq(collaboratorAgreements.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCollaboratorAgreement(id: string): Promise<boolean> {
    const result = await db.delete(collaboratorAgreements).where(eq(collaboratorAgreements.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
