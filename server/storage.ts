import { 
  users, customers, products, customerProducts, invoices, billingDetails, invoiceItems,
  customerNotes, activityLogs, communicationMessages,
  complaintTypes, cooperationTypes, vipStatuses, healthInsuranceCompanies,
  laboratories, hospitals,
  collaborators, collaboratorAddresses, collaboratorOtherData, collaboratorAgreements,
  customerPotentialCases, leadScoringCriteria,
  serviceConfigurations, invoiceTemplates, invoiceLayouts,
  roles, roleModulePermissions, roleFieldPermissions, userRoles, departments,
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
  type CollaboratorAgreement, type InsertCollaboratorAgreement,
  type CustomerPotentialCase, type InsertCustomerPotentialCase,
  type LeadScoringCriteria, type InsertLeadScoringCriteria,
  type ServiceConfiguration, type InsertServiceConfiguration,
  type InvoiceTemplate, type InsertInvoiceTemplate,
  type InvoiceLayout, type InsertInvoiceLayout,
  type Role, type InsertRole,
  type RoleModulePermission, type InsertRoleModulePermission,
  type RoleFieldPermission, type InsertRoleFieldPermission,
  type UserRole, type InsertUserRole,
  type Department, type InsertDepartment,
  savedSearches, type SavedSearch, type InsertSavedSearch,
  campaigns, campaignContacts, campaignContactHistory, campaignTemplates,
  campaignSchedules, campaignOperatorSettings, campaignContactSessions, campaignMetricsSnapshots,
  type Campaign, type InsertCampaign,
  type CampaignContact, type InsertCampaignContact,
  type CampaignTemplate, type InsertCampaignTemplate,
  type CampaignContactHistory, type InsertCampaignContactHistory,
  type CampaignSchedule, type InsertCampaignSchedule,
  type CampaignOperatorSetting, type InsertCampaignOperatorSetting,
  type CampaignContactSession, type InsertCampaignContactSession,
  type CampaignMetricsSnapshot, type InsertCampaignMetricsSnapshot,
  sipSettings, callLogs,
  type SipSettings, type InsertSipSettings,
  type CallLog, type InsertCallLog
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
  getAllCustomerNotes(): Promise<CustomerNote[]>;
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

  // Customer Potential Cases
  getCustomerPotentialCase(customerId: string): Promise<CustomerPotentialCase | undefined>;
  upsertCustomerPotentialCase(data: InsertCustomerPotentialCase): Promise<CustomerPotentialCase>;

  // Lead Scoring
  getAllLeadScoringCriteria(): Promise<LeadScoringCriteria[]>;
  getLeadScoringCriteriaByCountry(countryCode: string | null): Promise<LeadScoringCriteria[]>;
  createLeadScoringCriteria(data: InsertLeadScoringCriteria): Promise<LeadScoringCriteria>;
  updateLeadScoringCriteria(id: string, data: Partial<InsertLeadScoringCriteria>): Promise<LeadScoringCriteria | undefined>;
  deleteLeadScoringCriteria(id: string): Promise<boolean>;
  updateCustomerLeadScore(customerId: string, score: number, status: string): Promise<Customer | undefined>;

  // Service Configurations
  getAllServiceConfigurations(): Promise<ServiceConfiguration[]>;
  getServiceConfigurationsByCountry(countryCodes: string[]): Promise<ServiceConfiguration[]>;
  createServiceConfiguration(data: InsertServiceConfiguration): Promise<ServiceConfiguration>;
  updateServiceConfiguration(id: string, data: Partial<InsertServiceConfiguration>): Promise<ServiceConfiguration | undefined>;
  deleteServiceConfiguration(id: string): Promise<boolean>;

  // Invoice Templates
  getAllInvoiceTemplates(): Promise<InvoiceTemplate[]>;
  getInvoiceTemplatesByCountry(countryCodes: string[]): Promise<InvoiceTemplate[]>;
  createInvoiceTemplate(data: InsertInvoiceTemplate): Promise<InvoiceTemplate>;
  updateInvoiceTemplate(id: string, data: Partial<InsertInvoiceTemplate>): Promise<InvoiceTemplate | undefined>;
  deleteInvoiceTemplate(id: string): Promise<boolean>;

  // Invoice Layouts
  getAllInvoiceLayouts(): Promise<InvoiceLayout[]>;
  getInvoiceLayoutsByCountry(countryCodes: string[]): Promise<InvoiceLayout[]>;
  createInvoiceLayout(data: InsertInvoiceLayout): Promise<InvoiceLayout>;
  updateInvoiceLayout(id: string, data: Partial<InsertInvoiceLayout>): Promise<InvoiceLayout | undefined>;
  deleteInvoiceLayout(id: string): Promise<boolean>;

  // Roles
  getAllRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  createRole(data: InsertRole): Promise<Role>;
  updateRole(id: string, data: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
  copyRole(sourceRoleId: string, newName: string, createdBy?: string): Promise<Role>;

  // Role Module Permissions
  getRoleModulePermissions(roleId: string): Promise<RoleModulePermission[]>;
  setRoleModulePermissions(roleId: string, permissions: InsertRoleModulePermission[]): Promise<RoleModulePermission[]>;

  // Role Field Permissions
  getRoleFieldPermissions(roleId: string): Promise<RoleFieldPermission[]>;
  setRoleFieldPermissions(roleId: string, permissions: InsertRoleFieldPermission[]): Promise<RoleFieldPermission[]>;

  // User Roles
  getUserRoles(userId: string): Promise<UserRole[]>;
  assignRoleToUser(data: InsertUserRole): Promise<UserRole>;
  removeRoleFromUser(userId: string, roleId: string): Promise<boolean>;

  // Departments
  getAllDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(data: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;

  // Saved Searches
  getSavedSearchesByUser(userId: string, module?: string): Promise<SavedSearch[]>;
  createSavedSearch(data: InsertSavedSearch): Promise<SavedSearch>;
  deleteSavedSearch(id: string): Promise<boolean>;
  deleteSavedSearchForUser(id: string, userId: string): Promise<boolean>;

  // Campaigns
  getAllCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // Campaign Contacts
  getCampaignContacts(campaignId: string): Promise<CampaignContact[]>;
  getCampaignContact(id: string): Promise<CampaignContact | undefined>;
  createCampaignContact(data: InsertCampaignContact): Promise<CampaignContact>;
  createCampaignContacts(data: InsertCampaignContact[]): Promise<CampaignContact[]>;
  updateCampaignContact(id: string, data: Partial<InsertCampaignContact>): Promise<CampaignContact | undefined>;
  deleteCampaignContact(id: string): Promise<boolean>;
  deleteCampaignContactsByCampaign(campaignId: string): Promise<boolean>;

  // Campaign Contact History
  getCampaignContactHistory(campaignContactId: string): Promise<CampaignContactHistory[]>;
  createCampaignContactHistory(data: InsertCampaignContactHistory): Promise<CampaignContactHistory>;

  // Campaign Templates
  getAllCampaignTemplates(): Promise<CampaignTemplate[]>;
  getCampaignTemplate(id: string): Promise<CampaignTemplate | undefined>;
  createCampaignTemplate(data: InsertCampaignTemplate): Promise<CampaignTemplate>;
  updateCampaignTemplate(id: string, data: Partial<InsertCampaignTemplate>): Promise<CampaignTemplate | undefined>;
  deleteCampaignTemplate(id: string): Promise<boolean>;

  // Campaign Schedules
  getCampaignSchedule(campaignId: string): Promise<CampaignSchedule | undefined>;
  createCampaignSchedule(data: InsertCampaignSchedule): Promise<CampaignSchedule>;
  updateCampaignSchedule(campaignId: string, data: Partial<InsertCampaignSchedule>): Promise<CampaignSchedule | undefined>;
  deleteCampaignSchedule(campaignId: string): Promise<boolean>;

  // Campaign Operator Settings
  getCampaignOperators(campaignId: string): Promise<CampaignOperatorSetting[]>;
  getCampaignOperatorSetting(id: string): Promise<CampaignOperatorSetting | undefined>;
  createCampaignOperatorSetting(data: InsertCampaignOperatorSetting): Promise<CampaignOperatorSetting>;
  updateCampaignOperatorSetting(id: string, data: Partial<InsertCampaignOperatorSetting>): Promise<CampaignOperatorSetting | undefined>;
  deleteCampaignOperatorSetting(id: string): Promise<boolean>;
  deleteCampaignOperatorsByCampaign(campaignId: string): Promise<boolean>;

  // Campaign Contact Sessions
  getContactSessions(campaignContactId: string): Promise<CampaignContactSession[]>;
  createContactSession(data: InsertCampaignContactSession): Promise<CampaignContactSession>;
  updateContactSession(id: string, data: Partial<InsertCampaignContactSession>): Promise<CampaignContactSession | undefined>;

  // Campaign Metrics
  getCampaignMetrics(campaignId: string): Promise<CampaignMetricsSnapshot[]>;
  createCampaignMetricsSnapshot(data: InsertCampaignMetricsSnapshot): Promise<CampaignMetricsSnapshot>;
  getCampaignStats(campaignId: string): Promise<{
    totalContacts: number;
    pendingContacts: number;
    contactedContacts: number;
    completedContacts: number;
    failedContacts: number;
    noAnswerContacts: number;
    callbackContacts: number;
    notInterestedContacts: number;
  }>;

  // SIP Settings
  getSipSettings(): Promise<SipSettings | undefined>;
  upsertSipSettings(data: InsertSipSettings): Promise<SipSettings>;

  // Call Logs
  getCallLog(id: string): Promise<CallLog | undefined>;
  getCallLogsByUser(userId: string, limit?: number): Promise<CallLog[]>;
  getCallLogsByCustomer(customerId: string): Promise<CallLog[]>;
  getCallLogsByCampaign(campaignId: string): Promise<CallLog[]>;
  getAllCallLogs(limit?: number): Promise<CallLog[]>;
  createCallLog(data: InsertCallLog): Promise<CallLog>;
  updateCallLog(id: string, data: Partial<InsertCallLog>): Promise<CallLog | undefined>;
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
    const { password, roleId, ...userData } = insertUser;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    const [user] = await db.insert(users).values({
      ...userData,
      passwordHash,
      roleId: roleId || null,
    }).returning();
    
    return toSafeUser(user);
  }

  async updateUser(id: string, updateData: UpdateUser): Promise<SafeUser | undefined> {
    const { password, roleId, ...userData } = updateData;
    
    let dataToUpdate: Partial<User> = { ...userData };
    
    // Explicitly handle roleId to ensure it's stored as null when empty
    if (roleId !== undefined) {
      dataToUpdate.roleId = roleId || null;
    }
    
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

  async getAllCustomerNotes(): Promise<CustomerNote[]> {
    return db.select().from(customerNotes).orderBy(desc(customerNotes.createdAt));
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

  // Customer Potential Cases
  async getCustomerPotentialCase(customerId: string): Promise<CustomerPotentialCase | undefined> {
    const [data] = await db.select().from(customerPotentialCases)
      .where(eq(customerPotentialCases.customerId, customerId));
    return data || undefined;
  }

  async upsertCustomerPotentialCase(data: InsertCustomerPotentialCase): Promise<CustomerPotentialCase> {
    const existing = await this.getCustomerPotentialCase(data.customerId);
    if (existing) {
      const [updated] = await db.update(customerPotentialCases)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(customerPotentialCases.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(customerPotentialCases).values(data).returning();
    return created;
  }

  // Lead Scoring Criteria
  async getAllLeadScoringCriteria(): Promise<LeadScoringCriteria[]> {
    return db.select().from(leadScoringCriteria).orderBy(leadScoringCriteria.category);
  }

  async getLeadScoringCriteriaByCountry(countryCode: string | null): Promise<LeadScoringCriteria[]> {
    if (countryCode === null) {
      // Get global criteria only
      return db.select().from(leadScoringCriteria)
        .where(sql`${leadScoringCriteria.countryCode} IS NULL`)
        .orderBy(leadScoringCriteria.category);
    }
    // Get criteria for specific country OR global ones
    return db.select().from(leadScoringCriteria)
      .where(sql`${leadScoringCriteria.countryCode} = ${countryCode} OR ${leadScoringCriteria.countryCode} IS NULL`)
      .orderBy(leadScoringCriteria.category);
  }

  async createLeadScoringCriteria(data: InsertLeadScoringCriteria): Promise<LeadScoringCriteria> {
    const [created] = await db.insert(leadScoringCriteria).values(data).returning();
    return created;
  }

  async updateLeadScoringCriteria(id: string, data: Partial<InsertLeadScoringCriteria>): Promise<LeadScoringCriteria | undefined> {
    const [updated] = await db.update(leadScoringCriteria)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leadScoringCriteria.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteLeadScoringCriteria(id: string): Promise<boolean> {
    const result = await db.delete(leadScoringCriteria).where(eq(leadScoringCriteria.id, id)).returning();
    return result.length > 0;
  }

  async updateCustomerLeadScore(customerId: string, score: number, status: string): Promise<Customer | undefined> {
    const [updated] = await db.update(customers)
      .set({ 
        leadScore: score, 
        leadStatus: status,
        leadScoreUpdatedAt: new Date() 
      })
      .where(eq(customers.id, customerId))
      .returning();
    return updated || undefined;
  }

  // Service Configurations
  async getAllServiceConfigurations(): Promise<ServiceConfiguration[]> {
    return db.select().from(serviceConfigurations).orderBy(serviceConfigurations.serviceName);
  }

  async getServiceConfigurationsByCountry(countryCodes: string[]): Promise<ServiceConfiguration[]> {
    if (countryCodes.length === 0) {
      return this.getAllServiceConfigurations();
    }
    return db.select().from(serviceConfigurations)
      .where(inArray(serviceConfigurations.countryCode, countryCodes))
      .orderBy(serviceConfigurations.serviceName);
  }

  async createServiceConfiguration(data: InsertServiceConfiguration): Promise<ServiceConfiguration> {
    const [created] = await db.insert(serviceConfigurations).values(data).returning();
    return created;
  }

  async updateServiceConfiguration(id: string, data: Partial<InsertServiceConfiguration>): Promise<ServiceConfiguration | undefined> {
    const [updated] = await db.update(serviceConfigurations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceConfigurations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteServiceConfiguration(id: string): Promise<boolean> {
    const result = await db.delete(serviceConfigurations).where(eq(serviceConfigurations.id, id)).returning();
    return result.length > 0;
  }

  // Invoice Templates
  async getAllInvoiceTemplates(): Promise<InvoiceTemplate[]> {
    return db.select().from(invoiceTemplates).orderBy(invoiceTemplates.name);
  }

  async getInvoiceTemplatesByCountry(countryCodes: string[]): Promise<InvoiceTemplate[]> {
    if (countryCodes.length === 0) {
      return this.getAllInvoiceTemplates();
    }
    return db.select().from(invoiceTemplates)
      .where(inArray(invoiceTemplates.countryCode, countryCodes))
      .orderBy(invoiceTemplates.name);
  }

  async createInvoiceTemplate(data: InsertInvoiceTemplate): Promise<InvoiceTemplate> {
    const [created] = await db.insert(invoiceTemplates).values(data).returning();
    return created;
  }

  async updateInvoiceTemplate(id: string, data: Partial<InsertInvoiceTemplate>): Promise<InvoiceTemplate | undefined> {
    const [updated] = await db.update(invoiceTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoiceTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteInvoiceTemplate(id: string): Promise<boolean> {
    const result = await db.delete(invoiceTemplates).where(eq(invoiceTemplates.id, id)).returning();
    return result.length > 0;
  }

  // Invoice Layouts
  async getAllInvoiceLayouts(): Promise<InvoiceLayout[]> {
    return db.select().from(invoiceLayouts).orderBy(invoiceLayouts.name);
  }

  async getInvoiceLayoutsByCountry(countryCodes: string[]): Promise<InvoiceLayout[]> {
    if (countryCodes.length === 0) {
      return this.getAllInvoiceLayouts();
    }
    return db.select().from(invoiceLayouts)
      .where(inArray(invoiceLayouts.countryCode, countryCodes))
      .orderBy(invoiceLayouts.name);
  }

  async createInvoiceLayout(data: InsertInvoiceLayout): Promise<InvoiceLayout> {
    const [created] = await db.insert(invoiceLayouts).values(data).returning();
    return created;
  }

  async updateInvoiceLayout(id: string, data: Partial<InsertInvoiceLayout>): Promise<InvoiceLayout | undefined> {
    const [updated] = await db.update(invoiceLayouts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoiceLayouts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteInvoiceLayout(id: string): Promise<boolean> {
    const result = await db.delete(invoiceLayouts).where(eq(invoiceLayouts.id, id)).returning();
    return result.length > 0;
  }

  // Roles
  async getAllRoles(): Promise<Role[]> {
    return db.select().from(roles).orderBy(roles.name);
  }

  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role || undefined;
  }

  async createRole(data: InsertRole): Promise<Role> {
    const [created] = await db.insert(roles).values(data).returning();
    return created;
  }

  async updateRole(id: string, data: Partial<InsertRole>): Promise<Role | undefined> {
    const [updated] = await db.update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRole(id: string): Promise<boolean> {
    await db.delete(roleModulePermissions).where(eq(roleModulePermissions.roleId, id));
    await db.delete(roleFieldPermissions).where(eq(roleFieldPermissions.roleId, id));
    await db.delete(userRoles).where(eq(userRoles.roleId, id));
    const result = await db.delete(roles).where(eq(roles.id, id)).returning();
    return result.length > 0;
  }

  async copyRole(sourceRoleId: string, newName: string, createdBy?: string): Promise<Role> {
    const sourceRole = await this.getRole(sourceRoleId);
    if (!sourceRole) {
      throw new Error("Source role not found");
    }

    const newRole = await this.createRole({
      name: newName,
      description: sourceRole.description,
      department: sourceRole.department,
      isActive: sourceRole.isActive,
      isSystem: false,
      createdBy: createdBy || null,
    });

    const modulePerms = await this.getRoleModulePermissions(sourceRoleId);
    if (modulePerms.length > 0) {
      const newModulePerms = modulePerms.map(p => ({
        roleId: newRole.id,
        moduleKey: p.moduleKey,
        access: p.access,
        canAdd: p.canAdd,
        canEdit: p.canEdit,
      }));
      await this.setRoleModulePermissions(newRole.id, newModulePerms);
    }

    const fieldPerms = await this.getRoleFieldPermissions(sourceRoleId);
    if (fieldPerms.length > 0) {
      const newFieldPerms = fieldPerms.map(p => ({
        roleId: newRole.id,
        moduleKey: p.moduleKey,
        fieldKey: p.fieldKey,
        permission: p.permission,
      }));
      await this.setRoleFieldPermissions(newRole.id, newFieldPerms);
    }

    return newRole;
  }

  // Role Module Permissions
  async getRoleModulePermissions(roleId: string): Promise<RoleModulePermission[]> {
    return db.select().from(roleModulePermissions).where(eq(roleModulePermissions.roleId, roleId));
  }

  async setRoleModulePermissions(roleId: string, permissions: InsertRoleModulePermission[]): Promise<RoleModulePermission[]> {
    await db.delete(roleModulePermissions).where(eq(roleModulePermissions.roleId, roleId));
    if (permissions.length === 0) return [];
    const created = await db.insert(roleModulePermissions).values(permissions).returning();
    return created;
  }

  // Role Field Permissions
  async getRoleFieldPermissions(roleId: string): Promise<RoleFieldPermission[]> {
    return db.select().from(roleFieldPermissions).where(eq(roleFieldPermissions.roleId, roleId));
  }

  async setRoleFieldPermissions(roleId: string, permissions: InsertRoleFieldPermission[]): Promise<RoleFieldPermission[]> {
    await db.delete(roleFieldPermissions).where(eq(roleFieldPermissions.roleId, roleId));
    if (permissions.length === 0) return [];
    const created = await db.insert(roleFieldPermissions).values(permissions).returning();
    return created;
  }

  // User Roles
  async getUserRoles(userId: string): Promise<UserRole[]> {
    return db.select().from(userRoles).where(eq(userRoles.userId, userId));
  }

  async assignRoleToUser(data: InsertUserRole): Promise<UserRole> {
    const [created] = await db.insert(userRoles).values(data).returning();
    return created;
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
    const result = await db.delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .returning();
    return result.length > 0;
  }

  // Departments
  async getAllDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(departments.sortOrder);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department || undefined;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [created] = await db.insert(departments).values(data).returning();
    return created;
  }

  async updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [updated] = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
    return updated || undefined;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id)).returning();
    return result.length > 0;
  }

  // Saved Searches
  async getSavedSearchesByUser(userId: string, module?: string): Promise<SavedSearch[]> {
    if (module) {
      return db.select().from(savedSearches)
        .where(and(eq(savedSearches.userId, userId), eq(savedSearches.module, module)))
        .orderBy(desc(savedSearches.createdAt));
    }
    return db.select().from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
  }

  async createSavedSearch(data: InsertSavedSearch): Promise<SavedSearch> {
    const [created] = await db.insert(savedSearches).values(data).returning();
    return created;
  }

  async deleteSavedSearch(id: string): Promise<boolean> {
    const result = await db.delete(savedSearches).where(eq(savedSearches.id, id)).returning();
    return result.length > 0;
  }

  async deleteSavedSearchForUser(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Campaigns
  async getAllCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [created] = await db.insert(campaigns).values({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    }).returning();
    return created;
  }

  async updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    
    const [updated] = await db.update(campaigns).set(updateData).where(eq(campaigns.id, id)).returning();
    return updated || undefined;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    await db.delete(campaignContactHistory)
      .where(inArray(campaignContactHistory.campaignContactId, 
        db.select({ id: campaignContacts.id }).from(campaignContacts).where(eq(campaignContacts.campaignId, id))
      ));
    await db.delete(campaignContacts).where(eq(campaignContacts.campaignId, id));
    const result = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
    return result.length > 0;
  }

  // Campaign Contacts
  async getCampaignContacts(campaignId: string): Promise<CampaignContact[]> {
    return db.select().from(campaignContacts)
      .where(eq(campaignContacts.campaignId, campaignId))
      .orderBy(desc(campaignContacts.createdAt));
  }

  async getCampaignContact(id: string): Promise<CampaignContact | undefined> {
    const [contact] = await db.select().from(campaignContacts).where(eq(campaignContacts.id, id));
    return contact || undefined;
  }

  async createCampaignContact(data: InsertCampaignContact): Promise<CampaignContact> {
    const [created] = await db.insert(campaignContacts).values({
      ...data,
      callbackDate: data.callbackDate ? new Date(data.callbackDate) : null,
      contactedAt: data.contactedAt ? new Date(data.contactedAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
    }).returning();
    return created;
  }

  async createCampaignContacts(data: InsertCampaignContact[]): Promise<CampaignContact[]> {
    if (data.length === 0) return [];
    const values = data.map(d => ({
      ...d,
      callbackDate: d.callbackDate ? new Date(d.callbackDate) : null,
      contactedAt: d.contactedAt ? new Date(d.contactedAt) : null,
      completedAt: d.completedAt ? new Date(d.completedAt) : null,
    }));
    return db.insert(campaignContacts).values(values).returning();
  }

  async updateCampaignContact(id: string, data: Partial<InsertCampaignContact>): Promise<CampaignContact | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.callbackDate) updateData.callbackDate = new Date(data.callbackDate);
    if (data.contactedAt) updateData.contactedAt = new Date(data.contactedAt);
    if (data.completedAt) updateData.completedAt = new Date(data.completedAt);
    
    const [updated] = await db.update(campaignContacts).set(updateData).where(eq(campaignContacts.id, id)).returning();
    return updated || undefined;
  }

  async deleteCampaignContact(id: string): Promise<boolean> {
    await db.delete(campaignContactHistory).where(eq(campaignContactHistory.campaignContactId, id));
    const result = await db.delete(campaignContacts).where(eq(campaignContacts.id, id)).returning();
    return result.length > 0;
  }

  async deleteCampaignContactsByCampaign(campaignId: string): Promise<boolean> {
    await db.delete(campaignContactHistory)
      .where(inArray(campaignContactHistory.campaignContactId, 
        db.select({ id: campaignContacts.id }).from(campaignContacts).where(eq(campaignContacts.campaignId, campaignId))
      ));
    await db.delete(campaignContacts).where(eq(campaignContacts.campaignId, campaignId));
    return true;
  }

  // Campaign Contact History
  async getCampaignContactHistory(campaignContactId: string): Promise<CampaignContactHistory[]> {
    return db.select().from(campaignContactHistory)
      .where(eq(campaignContactHistory.campaignContactId, campaignContactId))
      .orderBy(desc(campaignContactHistory.createdAt));
  }

  async createCampaignContactHistory(data: InsertCampaignContactHistory): Promise<CampaignContactHistory> {
    const [created] = await db.insert(campaignContactHistory).values(data).returning();
    return created;
  }

  // Campaign Templates
  async getAllCampaignTemplates(): Promise<CampaignTemplate[]> {
    return db.select().from(campaignTemplates).orderBy(desc(campaignTemplates.createdAt));
  }

  async getCampaignTemplate(id: string): Promise<CampaignTemplate | undefined> {
    const [template] = await db.select().from(campaignTemplates).where(eq(campaignTemplates.id, id));
    return template || undefined;
  }

  async createCampaignTemplate(data: InsertCampaignTemplate): Promise<CampaignTemplate> {
    const [created] = await db.insert(campaignTemplates).values(data).returning();
    return created;
  }

  async updateCampaignTemplate(id: string, data: Partial<InsertCampaignTemplate>): Promise<CampaignTemplate | undefined> {
    const [updated] = await db.update(campaignTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaignTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCampaignTemplate(id: string): Promise<boolean> {
    const result = await db.delete(campaignTemplates).where(eq(campaignTemplates.id, id));
    return !!result;
  }

  // Campaign Schedules
  async getCampaignSchedule(campaignId: string): Promise<CampaignSchedule | undefined> {
    const [schedule] = await db.select().from(campaignSchedules).where(eq(campaignSchedules.campaignId, campaignId));
    return schedule || undefined;
  }

  async createCampaignSchedule(data: InsertCampaignSchedule): Promise<CampaignSchedule> {
    const [created] = await db.insert(campaignSchedules).values(data).returning();
    return created;
  }

  async updateCampaignSchedule(campaignId: string, data: Partial<InsertCampaignSchedule>): Promise<CampaignSchedule | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(campaignSchedules).set(updateData).where(eq(campaignSchedules.campaignId, campaignId)).returning();
    return updated || undefined;
  }

  async deleteCampaignSchedule(campaignId: string): Promise<boolean> {
    const result = await db.delete(campaignSchedules).where(eq(campaignSchedules.campaignId, campaignId)).returning();
    return result.length > 0;
  }

  // Campaign Operator Settings
  async getCampaignOperators(campaignId: string): Promise<CampaignOperatorSetting[]> {
    return db.select().from(campaignOperatorSettings).where(eq(campaignOperatorSettings.campaignId, campaignId));
  }

  async getCampaignOperatorSetting(id: string): Promise<CampaignOperatorSetting | undefined> {
    const [setting] = await db.select().from(campaignOperatorSettings).where(eq(campaignOperatorSettings.id, id));
    return setting || undefined;
  }

  async createCampaignOperatorSetting(data: InsertCampaignOperatorSetting): Promise<CampaignOperatorSetting> {
    const [created] = await db.insert(campaignOperatorSettings).values(data).returning();
    return created;
  }

  async updateCampaignOperatorSetting(id: string, data: Partial<InsertCampaignOperatorSetting>): Promise<CampaignOperatorSetting | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(campaignOperatorSettings).set(updateData).where(eq(campaignOperatorSettings.id, id)).returning();
    return updated || undefined;
  }

  async deleteCampaignOperatorSetting(id: string): Promise<boolean> {
    const result = await db.delete(campaignOperatorSettings).where(eq(campaignOperatorSettings.id, id)).returning();
    return result.length > 0;
  }

  async deleteCampaignOperatorsByCampaign(campaignId: string): Promise<boolean> {
    await db.delete(campaignOperatorSettings).where(eq(campaignOperatorSettings.campaignId, campaignId));
    return true;
  }

  // Campaign Contact Sessions
  async getContactSessions(campaignContactId: string): Promise<CampaignContactSession[]> {
    return db.select().from(campaignContactSessions)
      .where(eq(campaignContactSessions.campaignContactId, campaignContactId))
      .orderBy(desc(campaignContactSessions.startedAt));
  }

  async createContactSession(data: InsertCampaignContactSession): Promise<CampaignContactSession> {
    const values: any = { ...data };
    if (data.startedAt) values.startedAt = new Date(data.startedAt);
    if (data.endedAt) values.endedAt = new Date(data.endedAt);
    if (data.callbackDate) values.callbackDate = new Date(data.callbackDate);
    const [created] = await db.insert(campaignContactSessions).values(values).returning();
    return created;
  }

  async updateContactSession(id: string, data: Partial<InsertCampaignContactSession>): Promise<CampaignContactSession | undefined> {
    const updateData: any = { ...data };
    if (data.endedAt) updateData.endedAt = new Date(data.endedAt);
    if (data.callbackDate) updateData.callbackDate = new Date(data.callbackDate);
    const [updated] = await db.update(campaignContactSessions).set(updateData).where(eq(campaignContactSessions.id, id)).returning();
    return updated || undefined;
  }

  // Campaign Metrics
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetricsSnapshot[]> {
    return db.select().from(campaignMetricsSnapshots)
      .where(eq(campaignMetricsSnapshots.campaignId, campaignId))
      .orderBy(desc(campaignMetricsSnapshots.snapshotDate));
  }

  async createCampaignMetricsSnapshot(data: InsertCampaignMetricsSnapshot): Promise<CampaignMetricsSnapshot> {
    const values: any = { ...data };
    if (data.snapshotDate) values.snapshotDate = new Date(data.snapshotDate as any);
    const [created] = await db.insert(campaignMetricsSnapshots).values(values).returning();
    return created;
  }

  async getCampaignStats(campaignId: string): Promise<{
    totalContacts: number;
    pendingContacts: number;
    contactedContacts: number;
    completedContacts: number;
    failedContacts: number;
    noAnswerContacts: number;
    callbackContacts: number;
    notInterestedContacts: number;
  }> {
    const contacts = await db.select().from(campaignContacts).where(eq(campaignContacts.campaignId, campaignId));
    
    return {
      totalContacts: contacts.length,
      pendingContacts: contacts.filter(c => c.status === 'pending').length,
      contactedContacts: contacts.filter(c => c.status === 'contacted').length,
      completedContacts: contacts.filter(c => c.status === 'completed').length,
      failedContacts: contacts.filter(c => c.status === 'failed').length,
      noAnswerContacts: contacts.filter(c => c.status === 'no_answer').length,
      callbackContacts: contacts.filter(c => c.status === 'callback_scheduled').length,
      notInterestedContacts: contacts.filter(c => c.status === 'not_interested').length,
    };
  }

  // SIP Settings
  async getSipSettings(): Promise<SipSettings | undefined> {
    const [settings] = await db.select().from(sipSettings).limit(1);
    return settings || undefined;
  }

  async upsertSipSettings(data: InsertSipSettings): Promise<SipSettings> {
    const existing = await this.getSipSettings();
    if (existing) {
      const [updated] = await db.update(sipSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(sipSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(sipSettings).values(data).returning();
      return created;
    }
  }

  // Call Logs
  async getCallLog(id: string): Promise<CallLog | undefined> {
    const [log] = await db.select().from(callLogs).where(eq(callLogs.id, id));
    return log || undefined;
  }

  async getCallLogsByUser(userId: string, limit: number = 100): Promise<CallLog[]> {
    return db.select().from(callLogs)
      .where(eq(callLogs.userId, userId))
      .orderBy(desc(callLogs.startedAt))
      .limit(limit);
  }

  async getCallLogsByCustomer(customerId: string): Promise<CallLog[]> {
    return db.select().from(callLogs)
      .where(eq(callLogs.customerId, customerId))
      .orderBy(desc(callLogs.startedAt));
  }

  async getCallLogsByCampaign(campaignId: string): Promise<CallLog[]> {
    return db.select().from(callLogs)
      .where(eq(callLogs.campaignId, campaignId))
      .orderBy(desc(callLogs.startedAt));
  }

  async getAllCallLogs(limit: number = 1000): Promise<CallLog[]> {
    return db.select().from(callLogs)
      .orderBy(desc(callLogs.startedAt))
      .limit(limit);
  }

  async createCallLog(data: InsertCallLog): Promise<CallLog> {
    const values: any = { ...data };
    if (data.startedAt) values.startedAt = new Date(data.startedAt);
    if (data.answeredAt) values.answeredAt = new Date(data.answeredAt);
    if (data.endedAt) values.endedAt = new Date(data.endedAt);
    const [created] = await db.insert(callLogs).values(values).returning();
    return created;
  }

  async updateCallLog(id: string, data: Partial<InsertCallLog>): Promise<CallLog | undefined> {
    const values: any = { ...data };
    if (data.startedAt) values.startedAt = new Date(data.startedAt);
    if (data.answeredAt) values.answeredAt = new Date(data.answeredAt);
    if (data.endedAt) values.endedAt = new Date(data.endedAt);
    const [updated] = await db.update(callLogs)
      .set(values)
      .where(eq(callLogs.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
