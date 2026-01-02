import { 
  users, customers, products, customerProducts, invoices, billingDetails, invoiceItems,
  customerNotes, activityLogs, communicationMessages,
  complaintTypes, cooperationTypes, vipStatuses, healthInsuranceCompanies,
  laboratories, hospitals,
  collaborators, collaboratorAddresses, collaboratorOtherData, collaboratorAgreements,
  customerPotentialCases, leadScoringCriteria,
  serviceConfigurations, serviceInstances, numberRanges, invoiceTemplates, invoiceLayouts,
  roles, roleModulePermissions, roleFieldPermissions, userRoles, departments,
  billingCompanyAccounts, billingCompanyAuditLog, billingCompanyLaboratories, billingCompanyCollaborators, billingCompanyCouriers,
  marketProductInstances, instancePrices, instancePaymentOptions, instanceDiscounts, instanceVatRates, marketProductServices, paymentInstallments,
  type User, type InsertUser, type UpdateUser, type SafeUser,
  type Customer, type InsertCustomer,
  type Product, type InsertProduct,
  type CustomerProduct, type InsertCustomerProduct,
  type Invoice, type InsertInvoice,
  type BillingDetails, type InsertBillingDetails,
  type BillingCompanyAccount, type InsertBillingCompanyAccount,
  type BillingCompanyAuditLog, type InsertBillingCompanyAuditLog,
  type BillingCompanyLaboratory, type InsertBillingCompanyLaboratory,
  type BillingCompanyCollaborator, type InsertBillingCompanyCollaborator,
  type BillingCompanyCourier, type InsertBillingCompanyCourier,
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
  type ServiceInstance, type InsertServiceInstance,
  type NumberRange, type InsertNumberRange,
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
  sipSettings, callLogs, chatMessages, exchangeRates,
  productSets, productSetCollections, productSetStorage, customerConsents, tasks,
  type SipSettings, type InsertSipSettings,
  type CallLog, type InsertCallLog,
  type ProductSet, type InsertProductSet,
  type ProductSetCollection, type InsertProductSetCollection,
  type ProductSetStorage, type InsertProductSetStorage,
  type CustomerConsent, type InsertCustomerConsent,
  type Task, type InsertTask,
  type ChatMessage, type InsertChatMessage,
  type ExchangeRate, type InsertExchangeRate
} from "@shared/schema";
import { db } from "./db";
import { eq, inArray, sql, desc, and, or } from "drizzle-orm";
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

  // Market Product Instances
  getMarketProductInstances(productId: string): Promise<any[]>;
  createMarketProductInstance(data: any): Promise<any>;
  updateMarketProductInstance(id: string, data: any): Promise<any | undefined>;
  deleteMarketProductInstance(id: string): Promise<boolean>;

  // Instance Prices
  getInstancePrices(instanceId: string, instanceType: string): Promise<any[]>;
  createInstancePrice(data: any): Promise<any>;
  updateInstancePrice(id: string, data: any): Promise<any | undefined>;
  deleteInstancePrice(id: string): Promise<boolean>;

  // Instance Payment Options
  getInstancePaymentOptions(instanceId: string, instanceType: string): Promise<any[]>;
  createInstancePaymentOption(data: any): Promise<any>;
  updateInstancePaymentOption(id: string, data: any): Promise<any | undefined>;
  deleteInstancePaymentOption(id: string): Promise<boolean>;

  // Payment Installments
  getPaymentInstallments(paymentOptionId: string): Promise<any[]>;
  createPaymentInstallment(data: any): Promise<any>;
  updatePaymentInstallment(id: string, data: any): Promise<any | undefined>;
  deletePaymentInstallment(id: string): Promise<boolean>;
  deletePaymentInstallmentsByOption(paymentOptionId: string): Promise<boolean>;
  bulkCreatePaymentInstallments(data: any[]): Promise<any[]>;

  // Instance Discounts
  getInstanceDiscounts(instanceId: string, instanceType: string): Promise<any[]>;
  createInstanceDiscount(data: any): Promise<any>;
  updateInstanceDiscount(id: string, data: any): Promise<any | undefined>;
  deleteInstanceDiscount(id: string): Promise<boolean>;

  // Market Product Services
  getMarketProductServices(instanceId: string): Promise<any[]>;
  createMarketProductService(data: any): Promise<any>;
  updateMarketProductService(id: string, data: any): Promise<any | undefined>;
  deleteMarketProductService(id: string): Promise<boolean>;

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
  updateBillingDetails(id: string, data: Partial<InsertBillingDetails>, userId?: string): Promise<BillingDetails>;
  deleteBillingDetails(id: string): Promise<boolean>;
  upsertBillingDetails(data: InsertBillingDetails): Promise<BillingDetails>;

  // Billing Company Accounts
  getBillingCompanyAccounts(billingDetailsId: string): Promise<BillingCompanyAccount[]>;
  getBillingCompanyAccountById(id: string): Promise<BillingCompanyAccount | undefined>;
  createBillingCompanyAccount(data: InsertBillingCompanyAccount): Promise<BillingCompanyAccount>;
  updateBillingCompanyAccount(id: string, data: Partial<InsertBillingCompanyAccount>): Promise<BillingCompanyAccount | undefined>;
  deleteBillingCompanyAccount(id: string): Promise<boolean>;
  setDefaultBillingCompanyAccount(billingDetailsId: string, accountId: string): Promise<void>;

  // Billing Company Audit Log
  getBillingCompanyAuditLog(billingDetailsId: string): Promise<BillingCompanyAuditLog[]>;
  createBillingCompanyAuditLog(data: InsertBillingCompanyAuditLog): Promise<BillingCompanyAuditLog>;

  // Billing Company Laboratories
  getBillingCompanyLaboratories(billingDetailsId: string): Promise<BillingCompanyLaboratory[]>;
  setBillingCompanyLaboratories(billingDetailsId: string, laboratoryIds: string[]): Promise<void>;

  // Billing Company Collaborators
  getBillingCompanyCollaborators(billingDetailsId: string): Promise<BillingCompanyCollaborator[]>;
  setBillingCompanyCollaborators(billingDetailsId: string, collaboratorIds: string[]): Promise<void>;

  // Billing Company Couriers
  getBillingCompanyCouriers(billingDetailsId: string): Promise<BillingCompanyCourier[]>;
  getBillingCompanyCourierById(id: string): Promise<BillingCompanyCourier | undefined>;
  createBillingCompanyCourier(data: InsertBillingCompanyCourier): Promise<BillingCompanyCourier>;
  updateBillingCompanyCourier(id: string, data: Partial<InsertBillingCompanyCourier>): Promise<BillingCompanyCourier | undefined>;
  deleteBillingCompanyCourier(id: string): Promise<boolean>;

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

  // Customer Consents (GDPR)
  getCustomerConsents(customerId: string): Promise<CustomerConsent[]>;
  getCustomerConsentById(id: string): Promise<CustomerConsent | undefined>;
  createCustomerConsent(consent: InsertCustomerConsent): Promise<CustomerConsent>;
  updateCustomerConsent(id: string, data: Partial<InsertCustomerConsent>): Promise<CustomerConsent | undefined>;
  revokeCustomerConsent(id: string, userId: string, reason?: string): Promise<CustomerConsent | undefined>;
  getActiveConsentsForCustomer(customerId: string): Promise<CustomerConsent[]>;
  getCustomerDataExport(customerId: string): Promise<any>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  getTasksByUser(userId: string): Promise<Task[]>;
  getTasksByCustomer(customerId: string): Promise<Task[]>;
  getTasksByCountry(countryCodes: string[]): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

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

  // Service Instances
  getServiceInstances(serviceId: string): Promise<ServiceInstance[]>;
  getAllServiceInstances(): Promise<ServiceInstance[]>;
  createServiceInstance(data: InsertServiceInstance): Promise<ServiceInstance>;
  updateServiceInstance(id: string, data: Partial<InsertServiceInstance>): Promise<ServiceInstance | undefined>;
  deleteServiceInstance(id: string): Promise<boolean>;

  // Number Ranges
  getAllNumberRanges(): Promise<NumberRange[]>;
  getNumberRangesByCountry(countryCodes: string[]): Promise<NumberRange[]>;
  createNumberRange(data: InsertNumberRange): Promise<NumberRange>;
  updateNumberRange(id: string, data: Partial<InsertNumberRange>): Promise<NumberRange | undefined>;
  deleteNumberRange(id: string): Promise<boolean>;

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

  // Product Sets (Zostavy)
  getProductSets(productId: string): Promise<ProductSet[]>;
  getProductSet(id: string): Promise<ProductSet | undefined>;
  createProductSet(data: InsertProductSet): Promise<ProductSet>;
  updateProductSet(id: string, data: Partial<InsertProductSet>): Promise<ProductSet | undefined>;
  deleteProductSet(id: string): Promise<boolean>;
  
  // Product Set Collections
  getProductSetCollections(setId: string): Promise<ProductSetCollection[]>;
  createProductSetCollection(data: InsertProductSetCollection): Promise<ProductSetCollection>;
  updateProductSetCollection(id: string, data: Partial<InsertProductSetCollection>): Promise<ProductSetCollection | undefined>;
  deleteProductSetCollection(id: string): Promise<boolean>;
  
  // Product Set Storage
  getProductSetStorage(setId: string): Promise<ProductSetStorage[]>;
  createProductSetStorage(data: InsertProductSetStorage): Promise<ProductSetStorage>;
  updateProductSetStorage(id: string, data: Partial<InsertProductSetStorage>): Promise<ProductSetStorage | undefined>;
  deleteProductSetStorage(id: string): Promise<boolean>;

  // Product Duplication
  duplicateProduct(productId: string, newName: string): Promise<Product>;

  // Chat Messages
  getChatMessages(userId1: string, userId2: string, limit?: number): Promise<ChatMessage[]>;
  getChatConversations(userId: string): Promise<{ partnerId: string; lastMessage: ChatMessage; unreadCount: number }[]>;
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  markMessagesAsRead(senderId: string, receiverId: string): Promise<void>;

  // Exchange Rates
  getLatestExchangeRates(): Promise<ExchangeRate[]>;
  getExchangeRateByCode(currencyCode: string): Promise<ExchangeRate | undefined>;
  upsertExchangeRates(rates: InsertExchangeRate[]): Promise<ExchangeRate[]>;
  getExchangeRatesLastUpdate(): Promise<Date | null>;
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

  // Market Product Instances
  async getMarketProductInstances(productId: string): Promise<any[]> {
    return await db.select().from(marketProductInstances).where(eq(marketProductInstances.productId, productId));
  }

  async createMarketProductInstance(data: any): Promise<any> {
    const [instance] = await db.insert(marketProductInstances).values(data).returning();
    return instance;
  }

  async updateMarketProductInstance(id: string, data: any): Promise<any | undefined> {
    const [instance] = await db.update(marketProductInstances).set(data).where(eq(marketProductInstances.id, id)).returning();
    return instance;
  }

  async deleteMarketProductInstance(id: string): Promise<boolean> {
    const result = await db.delete(marketProductInstances).where(eq(marketProductInstances.id, id)).returning();
    return result.length > 0;
  }

  // Instance Prices
  async getInstancePrices(instanceId: string, instanceType: string): Promise<any[]> {
    return await db.select().from(instancePrices).where(
      and(eq(instancePrices.instanceId, instanceId), eq(instancePrices.instanceType, instanceType))
    );
  }

  async createInstancePrice(data: any): Promise<any> {
    const [price] = await db.insert(instancePrices).values(data).returning();
    return price;
  }

  async updateInstancePrice(id: string, data: any): Promise<any | undefined> {
    const [price] = await db.update(instancePrices).set(data).where(eq(instancePrices.id, id)).returning();
    return price;
  }

  async deleteInstancePrice(id: string): Promise<boolean> {
    const result = await db.delete(instancePrices).where(eq(instancePrices.id, id)).returning();
    return result.length > 0;
  }

  // Instance Payment Options
  async getInstancePaymentOptions(instanceId: string, instanceType: string): Promise<any[]> {
    return await db.select().from(instancePaymentOptions).where(
      and(eq(instancePaymentOptions.instanceId, instanceId), eq(instancePaymentOptions.instanceType, instanceType))
    );
  }

  async createInstancePaymentOption(data: any): Promise<any> {
    const [option] = await db.insert(instancePaymentOptions).values(data).returning();
    return option;
  }

  async updateInstancePaymentOption(id: string, data: any): Promise<any | undefined> {
    const [option] = await db.update(instancePaymentOptions).set(data).where(eq(instancePaymentOptions.id, id)).returning();
    return option;
  }

  async deleteInstancePaymentOption(id: string): Promise<boolean> {
    // Also delete related installments
    await db.delete(paymentInstallments).where(eq(paymentInstallments.paymentOptionId, id));
    const result = await db.delete(instancePaymentOptions).where(eq(instancePaymentOptions.id, id)).returning();
    return result.length > 0;
  }

  // Payment Installments
  async getPaymentInstallments(paymentOptionId: string): Promise<any[]> {
    return await db.select().from(paymentInstallments)
      .where(eq(paymentInstallments.paymentOptionId, paymentOptionId))
      .orderBy(paymentInstallments.installmentNumber);
  }

  async createPaymentInstallment(data: any): Promise<any> {
    const [installment] = await db.insert(paymentInstallments).values(data).returning();
    return installment;
  }

  async updatePaymentInstallment(id: string, data: any): Promise<any | undefined> {
    const [installment] = await db.update(paymentInstallments).set(data).where(eq(paymentInstallments.id, id)).returning();
    return installment;
  }

  async deletePaymentInstallment(id: string): Promise<boolean> {
    const result = await db.delete(paymentInstallments).where(eq(paymentInstallments.id, id)).returning();
    return result.length > 0;
  }

  async deletePaymentInstallmentsByOption(paymentOptionId: string): Promise<boolean> {
    await db.delete(paymentInstallments).where(eq(paymentInstallments.paymentOptionId, paymentOptionId));
    return true;
  }

  async bulkCreatePaymentInstallments(data: any[]): Promise<any[]> {
    if (data.length === 0) return [];
    const result = await db.insert(paymentInstallments).values(data).returning();
    return result;
  }

  // Instance Discounts
  async getInstanceDiscounts(instanceId: string, instanceType: string): Promise<any[]> {
    return await db.select().from(instanceDiscounts).where(
      and(eq(instanceDiscounts.instanceId, instanceId), eq(instanceDiscounts.instanceType, instanceType))
    );
  }

  async createInstanceDiscount(data: any): Promise<any> {
    const [discount] = await db.insert(instanceDiscounts).values(data).returning();
    return discount;
  }

  async updateInstanceDiscount(id: string, data: any): Promise<any | undefined> {
    const [discount] = await db.update(instanceDiscounts).set(data).where(eq(instanceDiscounts.id, id)).returning();
    return discount;
  }

  async deleteInstanceDiscount(id: string): Promise<boolean> {
    const result = await db.delete(instanceDiscounts).where(eq(instanceDiscounts.id, id)).returning();
    return result.length > 0;
  }

  // Instance VAT Rates
  async getInstanceVatRates(instanceId: string, instanceType: string): Promise<any[]> {
    return await db.select().from(instanceVatRates).where(
      and(eq(instanceVatRates.instanceId, instanceId), eq(instanceVatRates.instanceType, instanceType))
    );
  }

  async createInstanceVatRate(data: any): Promise<any> {
    const [vatRate] = await db.insert(instanceVatRates).values(data).returning();
    return vatRate;
  }

  async updateInstanceVatRate(id: string, data: any): Promise<any> {
    const [vatRate] = await db.update(instanceVatRates).set(data).where(eq(instanceVatRates.id, id)).returning();
    return vatRate;
  }

  async deleteInstanceVatRate(id: string): Promise<boolean> {
    const result = await db.delete(instanceVatRates).where(eq(instanceVatRates.id, id)).returning();
    return result.length > 0;
  }

  // Market Product Services
  async getMarketProductServices(instanceId: string): Promise<any[]> {
    return await db.select().from(marketProductServices).where(eq(marketProductServices.instanceId, instanceId));
  }

  async createMarketProductService(data: any): Promise<any> {
    const [service] = await db.insert(marketProductServices).values(data).returning();
    return service;
  }

  async updateMarketProductService(id: string, data: any): Promise<any | undefined> {
    const [service] = await db.update(marketProductServices).set(data).where(eq(marketProductServices.id, id)).returning();
    return service;
  }

  async deleteMarketProductService(id: string): Promise<boolean> {
    const result = await db.delete(marketProductServices).where(eq(marketProductServices.id, id)).returning();
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
    // Get all billing details and filter by countryCode or countryCodes array
    const allDetails = await db.select().from(billingDetails);
    return allDetails.filter(d => {
      // Check if country is in the countryCodes array or matches countryCode
      return d.countryCodes?.includes(countryCode) || d.countryCode === countryCode;
    });
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

  async updateBillingDetails(id: string, data: Partial<InsertBillingDetails>, userId?: string): Promise<BillingDetails> {
    // Get existing data for audit logging
    const existing = await this.getBillingDetailsById(id);
    
    // If setting as default, unset other defaults for this country
    if (data.isDefault && existing) {
      await db.update(billingDetails)
        .set({ isDefault: false })
        .where(and(eq(billingDetails.countryCode, existing.countryCode), sql`id != ${id}`));
    }
    
    const [updated] = await db
      .update(billingDetails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(billingDetails.id, id))
      .returning();
    
    // Create audit log entries for changed fields
    if (userId && existing) {
      const fieldsToTrack = Object.keys(data) as (keyof typeof data)[];
      for (const field of fieldsToTrack) {
        const oldVal = String(existing[field as keyof typeof existing] ?? "");
        const newVal = String(data[field] ?? "");
        if (oldVal !== newVal) {
          await this.createBillingCompanyAuditLog({
            billingDetailsId: id,
            userId,
            fieldName: field,
            oldValue: oldVal,
            newValue: newVal,
            changeType: "update",
          });
        }
      }
    }
    
    return updated;
  }

  async deleteBillingDetails(id: string): Promise<boolean> {
    // Delete related records first
    await db.delete(billingCompanyAccounts).where(eq(billingCompanyAccounts.billingDetailsId, id));
    await db.delete(billingCompanyLaboratories).where(eq(billingCompanyLaboratories.billingDetailsId, id));
    await db.delete(billingCompanyCollaborators).where(eq(billingCompanyCollaborators.billingDetailsId, id));
    await db.delete(billingCompanyCouriers).where(eq(billingCompanyCouriers.billingDetailsId, id));
    await db.delete(billingCompanyAuditLog).where(eq(billingCompanyAuditLog.billingDetailsId, id));
    
    const result = await db.delete(billingDetails).where(eq(billingDetails.id, id)).returning();
    return result.length > 0;
  }

  async upsertBillingDetails(data: InsertBillingDetails): Promise<BillingDetails> {
    // Legacy method - creates new billing company
    return this.createBillingDetails(data);
  }

  // Billing Company Accounts
  async getBillingCompanyAccounts(billingDetailsId: string): Promise<BillingCompanyAccount[]> {
    return db.select().from(billingCompanyAccounts)
      .where(eq(billingCompanyAccounts.billingDetailsId, billingDetailsId))
      .orderBy(desc(billingCompanyAccounts.isDefault), billingCompanyAccounts.createdAt);
  }

  async getBillingCompanyAccountById(id: string): Promise<BillingCompanyAccount | undefined> {
    const [account] = await db.select().from(billingCompanyAccounts).where(eq(billingCompanyAccounts.id, id));
    return account || undefined;
  }

  async createBillingCompanyAccount(data: InsertBillingCompanyAccount): Promise<BillingCompanyAccount> {
    // If this is marked as default, unset other defaults for this billing company
    if (data.isDefault) {
      await db.update(billingCompanyAccounts)
        .set({ isDefault: false })
        .where(eq(billingCompanyAccounts.billingDetailsId, data.billingDetailsId));
    }
    const [created] = await db.insert(billingCompanyAccounts).values(data).returning();
    return created;
  }

  async updateBillingCompanyAccount(id: string, data: Partial<InsertBillingCompanyAccount>): Promise<BillingCompanyAccount | undefined> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      const [existing] = await db.select().from(billingCompanyAccounts).where(eq(billingCompanyAccounts.id, id));
      if (existing) {
        await db.update(billingCompanyAccounts)
          .set({ isDefault: false })
          .where(and(eq(billingCompanyAccounts.billingDetailsId, existing.billingDetailsId), sql`id != ${id}`));
      }
    }
    const [updated] = await db
      .update(billingCompanyAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(billingCompanyAccounts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBillingCompanyAccount(id: string): Promise<boolean> {
    const result = await db.delete(billingCompanyAccounts).where(eq(billingCompanyAccounts.id, id)).returning();
    return result.length > 0;
  }

  async setDefaultBillingCompanyAccount(billingDetailsId: string, accountId: string): Promise<void> {
    // Unset all defaults for this billing company
    await db.update(billingCompanyAccounts)
      .set({ isDefault: false })
      .where(eq(billingCompanyAccounts.billingDetailsId, billingDetailsId));
    // Set the specified account as default
    await db.update(billingCompanyAccounts)
      .set({ isDefault: true })
      .where(eq(billingCompanyAccounts.id, accountId));
  }

  // Billing Company Audit Log
  async getBillingCompanyAuditLog(billingDetailsId: string): Promise<BillingCompanyAuditLog[]> {
    return db.select().from(billingCompanyAuditLog)
      .where(eq(billingCompanyAuditLog.billingDetailsId, billingDetailsId))
      .orderBy(desc(billingCompanyAuditLog.createdAt));
  }

  async createBillingCompanyAuditLog(data: InsertBillingCompanyAuditLog): Promise<BillingCompanyAuditLog> {
    const [created] = await db.insert(billingCompanyAuditLog).values(data).returning();
    return created;
  }

  // Billing Company Laboratories
  async getBillingCompanyLaboratories(billingDetailsId: string): Promise<BillingCompanyLaboratory[]> {
    return db.select().from(billingCompanyLaboratories)
      .where(eq(billingCompanyLaboratories.billingDetailsId, billingDetailsId));
  }

  async setBillingCompanyLaboratories(billingDetailsId: string, laboratoryIds: string[]): Promise<void> {
    // Delete existing associations
    await db.delete(billingCompanyLaboratories)
      .where(eq(billingCompanyLaboratories.billingDetailsId, billingDetailsId));
    // Insert new associations
    if (laboratoryIds.length > 0) {
      await db.insert(billingCompanyLaboratories).values(
        laboratoryIds.map(laboratoryId => ({ billingDetailsId, laboratoryId }))
      );
    }
  }

  // Billing Company Collaborators
  async getBillingCompanyCollaborators(billingDetailsId: string): Promise<BillingCompanyCollaborator[]> {
    return db.select().from(billingCompanyCollaborators)
      .where(eq(billingCompanyCollaborators.billingDetailsId, billingDetailsId));
  }

  async setBillingCompanyCollaborators(billingDetailsId: string, collaboratorIds: string[]): Promise<void> {
    // Delete existing associations
    await db.delete(billingCompanyCollaborators)
      .where(eq(billingCompanyCollaborators.billingDetailsId, billingDetailsId));
    // Insert new associations
    if (collaboratorIds.length > 0) {
      await db.insert(billingCompanyCollaborators).values(
        collaboratorIds.map(collaboratorId => ({ billingDetailsId, collaboratorId }))
      );
    }
  }

  // Billing Company Couriers
  async getBillingCompanyCouriers(billingDetailsId: string): Promise<BillingCompanyCourier[]> {
    return db.select().from(billingCompanyCouriers)
      .where(eq(billingCompanyCouriers.billingDetailsId, billingDetailsId))
      .orderBy(billingCompanyCouriers.createdAt);
  }

  async getBillingCompanyCourierById(id: string): Promise<BillingCompanyCourier | undefined> {
    const [courier] = await db.select().from(billingCompanyCouriers).where(eq(billingCompanyCouriers.id, id));
    return courier || undefined;
  }

  async createBillingCompanyCourier(data: InsertBillingCompanyCourier): Promise<BillingCompanyCourier> {
    const [created] = await db.insert(billingCompanyCouriers).values(data).returning();
    return created;
  }

  async updateBillingCompanyCourier(id: string, data: Partial<InsertBillingCompanyCourier>): Promise<BillingCompanyCourier | undefined> {
    const [updated] = await db
      .update(billingCompanyCouriers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(billingCompanyCouriers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBillingCompanyCourier(id: string): Promise<boolean> {
    const result = await db.delete(billingCompanyCouriers).where(eq(billingCompanyCouriers.id, id)).returning();
    return result.length > 0;
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

  // Customer Consents (GDPR)
  async getCustomerConsents(customerId: string): Promise<CustomerConsent[]> {
    return db.select().from(customerConsents)
      .where(eq(customerConsents.customerId, customerId))
      .orderBy(desc(customerConsents.createdAt));
  }

  async getCustomerConsentById(id: string): Promise<CustomerConsent | undefined> {
    const [consent] = await db.select().from(customerConsents).where(eq(customerConsents.id, id));
    return consent;
  }

  async createCustomerConsent(consent: InsertCustomerConsent): Promise<CustomerConsent> {
    const [created] = await db.insert(customerConsents).values(consent).returning();
    return created;
  }

  async updateCustomerConsent(id: string, data: Partial<InsertCustomerConsent>): Promise<CustomerConsent | undefined> {
    const [updated] = await db.update(customerConsents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customerConsents.id, id))
      .returning();
    return updated;
  }

  async revokeCustomerConsent(id: string, userId: string, reason?: string): Promise<CustomerConsent | undefined> {
    const [revoked] = await db.update(customerConsents)
      .set({
        granted: false,
        revokedAt: new Date(),
        revokedByUserId: userId,
        revokeReason: reason,
        updatedAt: new Date()
      })
      .where(eq(customerConsents.id, id))
      .returning();
    return revoked;
  }

  async getActiveConsentsForCustomer(customerId: string): Promise<CustomerConsent[]> {
    return db.select().from(customerConsents)
      .where(and(
        eq(customerConsents.customerId, customerId),
        eq(customerConsents.granted, true)
      ))
      .orderBy(desc(customerConsents.grantedAt));
  }

  async getCustomerDataExport(customerId: string): Promise<any> {
    // Get all customer data for GDPR export
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!customer) return null;

    const customerProducts = await this.getCustomerProducts(customerId);
    const customerInvoices = await this.getCustomerInvoices(customerId);
    const notes = await this.getCustomerNotes(customerId);
    const consents = await this.getCustomerConsents(customerId);
    const messages = await this.getCommunicationMessagesByCustomer(customerId);
    const accessLogs = await db.select().from(activityLogs)
      .where(and(
        eq(activityLogs.entityType, "customer"),
        eq(activityLogs.entityId, customerId)
      ))
      .orderBy(desc(activityLogs.createdAt));

    return {
      exportDate: new Date().toISOString(),
      customer: {
        personalData: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          maidenName: customer.maidenName,
          titleBefore: customer.titleBefore,
          titleAfter: customer.titleAfter,
          email: customer.email,
          email2: customer.email2,
          phone: customer.phone,
          mobile: customer.mobile,
          mobile2: customer.mobile2,
          dateOfBirth: customer.dateOfBirth,
          nationalId: customer.nationalId,
          idCardNumber: customer.idCardNumber,
        },
        address: {
          permanentStreet: customer.permanentStreet,
          permanentCity: customer.permanentCity,
          permanentPostalCode: customer.permanentPostalCode,
          permanentCountry: customer.permanentCountry,
          correspondenceStreet: customer.correspondenceStreet,
          correspondenceCity: customer.correspondenceCity,
          correspondencePostalCode: customer.correspondencePostalCode,
          correspondenceCountry: customer.correspondenceCountry,
        },
        status: customer.status,
        country: customer.country,
        newsletter: customer.newsletter,
        createdAt: customer.createdAt,
      },
      products: customerProducts,
      invoices: customerInvoices,
      notes: notes.map(n => ({ content: n.content, createdAt: n.createdAt })),
      consents: consents,
      communications: messages.map(m => ({
        type: m.type,
        subject: m.subject,
        sentAt: m.sentAt,
        status: m.status
      })),
      accessLogs: accessLogs.map(l => ({
        action: l.action,
        createdAt: l.createdAt,
        details: l.details
      }))
    };
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getAllTasks(): Promise<Task[]> {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTasksByUser(userId: string): Promise<Task[]> {
    return db.select().from(tasks)
      .where(eq(tasks.assignedUserId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTasksByCustomer(customerId: string): Promise<Task[]> {
    return db.select().from(tasks)
      .where(eq(tasks.customerId, customerId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTasksByCountry(countryCodes: string[]): Promise<Task[]> {
    if (countryCodes.length === 0) return [];
    return db.select().from(tasks)
      .where(inArray(tasks.country, countryCodes))
      .orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
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

  // Service Instances
  async getServiceInstances(serviceId: string): Promise<ServiceInstance[]> {
    return db.select().from(serviceInstances)
      .where(eq(serviceInstances.serviceId, serviceId))
      .orderBy(serviceInstances.name);
  }

  async getAllServiceInstances(): Promise<ServiceInstance[]> {
    return db.select().from(serviceInstances).orderBy(serviceInstances.name);
  }

  async createServiceInstance(data: InsertServiceInstance): Promise<ServiceInstance> {
    const [created] = await db.insert(serviceInstances).values(data).returning();
    return created;
  }

  async updateServiceInstance(id: string, data: Partial<InsertServiceInstance>): Promise<ServiceInstance | undefined> {
    const [updated] = await db.update(serviceInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceInstances.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteServiceInstance(id: string): Promise<boolean> {
    const result = await db.delete(serviceInstances).where(eq(serviceInstances.id, id)).returning();
    return result.length > 0;
  }

  // Number Ranges
  async getAllNumberRanges(): Promise<NumberRange[]> {
    return db.select().from(numberRanges).orderBy(numberRanges.name);
  }

  async getNumberRangesByCountry(countryCodes: string[]): Promise<NumberRange[]> {
    if (countryCodes.length === 0) {
      return this.getAllNumberRanges();
    }
    return db.select().from(numberRanges)
      .where(inArray(numberRanges.countryCode, countryCodes))
      .orderBy(numberRanges.name);
  }

  async createNumberRange(data: InsertNumberRange): Promise<NumberRange> {
    const [created] = await db.insert(numberRanges).values(data).returning();
    return created;
  }

  async updateNumberRange(id: string, data: Partial<InsertNumberRange>): Promise<NumberRange | undefined> {
    const [updated] = await db.update(numberRanges)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(numberRanges.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNumberRange(id: string): Promise<boolean> {
    const result = await db.delete(numberRanges).where(eq(numberRanges.id, id)).returning();
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

  // Product Sets (Zostavy)
  async getProductSets(productId: string): Promise<ProductSet[]> {
    return db.select().from(productSets)
      .where(eq(productSets.productId, productId))
      .orderBy(desc(productSets.createdAt));
  }

  async getProductSet(id: string): Promise<ProductSet | undefined> {
    const [set] = await db.select().from(productSets).where(eq(productSets.id, id));
    return set || undefined;
  }

  async createProductSet(data: InsertProductSet): Promise<ProductSet> {
    const values: any = { ...data };
    if (data.fromDate) values.fromDate = new Date(data.fromDate as any);
    if (data.toDate) values.toDate = new Date(data.toDate as any);
    const [created] = await db.insert(productSets).values(values).returning();
    return created;
  }

  async updateProductSet(id: string, data: Partial<InsertProductSet>): Promise<ProductSet | undefined> {
    const values: any = { ...data, updatedAt: new Date() };
    if (data.fromDate) values.fromDate = new Date(data.fromDate as any);
    if (data.toDate) values.toDate = new Date(data.toDate as any);
    const [updated] = await db.update(productSets)
      .set(values)
      .where(eq(productSets.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductSet(id: string): Promise<boolean> {
    // Delete related collections and storage first
    await db.delete(productSetCollections).where(eq(productSetCollections.productSetId, id));
    await db.delete(productSetStorage).where(eq(productSetStorage.productSetId, id));
    const result = await db.delete(productSets).where(eq(productSets.id, id));
    return true;
  }

  // Product Set Collections
  async getProductSetCollections(setId: string): Promise<ProductSetCollection[]> {
    return db.select().from(productSetCollections)
      .where(eq(productSetCollections.productSetId, setId))
      .orderBy(productSetCollections.sortOrder);
  }

  async createProductSetCollection(data: InsertProductSetCollection): Promise<ProductSetCollection> {
    const [created] = await db.insert(productSetCollections).values(data).returning();
    return created;
  }

  async updateProductSetCollection(id: string, data: Partial<InsertProductSetCollection>): Promise<ProductSetCollection | undefined> {
    const [updated] = await db.update(productSetCollections)
      .set(data)
      .where(eq(productSetCollections.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductSetCollection(id: string): Promise<boolean> {
    await db.delete(productSetCollections).where(eq(productSetCollections.id, id));
    return true;
  }

  // Product Set Storage
  async getProductSetStorage(setId: string): Promise<ProductSetStorage[]> {
    return db.select().from(productSetStorage)
      .where(eq(productSetStorage.productSetId, setId))
      .orderBy(productSetStorage.sortOrder);
  }

  async createProductSetStorage(data: InsertProductSetStorage): Promise<ProductSetStorage> {
    const [created] = await db.insert(productSetStorage).values(data).returning();
    return created;
  }

  async updateProductSetStorage(id: string, data: Partial<InsertProductSetStorage>): Promise<ProductSetStorage | undefined> {
    const [updated] = await db.update(productSetStorage)
      .set(data)
      .where(eq(productSetStorage.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductSetStorage(id: string): Promise<boolean> {
    await db.delete(productSetStorage).where(eq(productSetStorage.id, id));
    return true;
  }

  // Product Duplication - deep clone product with all configurations
  async duplicateProduct(productId: string, newName: string): Promise<Product> {
    // 1. Get original product
    const [originalProduct] = await db.select().from(products).where(eq(products.id, productId));
    if (!originalProduct) {
      throw new Error("Product not found");
    }

    // 2. Create new product
    const [newProduct] = await db.insert(products).values({
      name: newName,
      countries: originalProduct.countries,
      description: originalProduct.description,
      isActive: originalProduct.isActive,
    }).returning();

    // ID mappings for relinking
    const instanceIdMap = new Map<string, string>(); // old -> new instance IDs
    const serviceIdMap = new Map<string, string>(); // old -> new service IDs
    const priceIdMap = new Map<string, string>(); // old -> new price IDs
    const paymentOptionIdMap = new Map<string, string>(); // old -> new payment option IDs
    const discountIdMap = new Map<string, string>(); // old -> new discount IDs
    const vatRateIdMap = new Map<string, string>(); // old -> new VAT rate IDs

    // 3. Clone market product instances (Odbery)
    const originalInstances = await db.select().from(marketProductInstances)
      .where(eq(marketProductInstances.productId, productId));

    for (const instance of originalInstances) {
      const [newInstance] = await db.insert(marketProductInstances).values({
        productId: newProduct.id,
        countryCode: instance.countryCode,
        billingDetailsId: instance.billingDetailsId,
        name: instance.name,
        fromDate: instance.fromDate,
        toDate: instance.toDate,
        isActive: instance.isActive,
        description: instance.description,
      }).returning();
      instanceIdMap.set(instance.id, newInstance.id);

      // 3a. Clone instance prices
      const prices = await db.select().from(instancePrices)
        .where(and(eq(instancePrices.instanceId, instance.id), eq(instancePrices.instanceType, "market")));
      for (const price of prices) {
        const [newPrice] = await db.insert(instancePrices).values({
          instanceId: newInstance.id,
          instanceType: "market",
          name: price.name,
          accountingCode: price.accountingCode,
          analyticalAccount: price.analyticalAccount,
          price: price.price,
          currency: price.currency,
          amendment: price.amendment,
          fromDate: price.fromDate,
          toDate: price.toDate,
          isActive: price.isActive,
          description: price.description,
        }).returning();
        priceIdMap.set(price.id, newPrice.id);
      }

      // 3b. Clone instance payment options and installments
      const paymentOptions = await db.select().from(instancePaymentOptions)
        .where(and(eq(instancePaymentOptions.instanceId, instance.id), eq(instancePaymentOptions.instanceType, "market_instance")));
      for (const option of paymentOptions) {
        const [newOption] = await db.insert(instancePaymentOptions).values({
          instanceId: newInstance.id,
          instanceType: "market_instance",
          type: option.type,
          name: option.name,
          invoiceItemText: option.invoiceItemText,
          analyticalAccount: option.analyticalAccount,
          accountingCode: option.accountingCode,
          paymentTypeFee: option.paymentTypeFee,
          amendment: option.amendment,
          fromDate: option.fromDate,
          toDate: option.toDate,
          isActive: option.isActive,
          description: option.description,
          isMultiPayment: option.isMultiPayment,
          frequency: option.frequency,
          installmentCount: option.installmentCount,
          calculationMode: option.calculationMode,
          basePriceId: option.basePriceId ? priceIdMap.get(option.basePriceId) || option.basePriceId : null,
        }).returning();
        paymentOptionIdMap.set(option.id, newOption.id);

        // Clone installments
        const installments = await db.select().from(paymentInstallments)
          .where(eq(paymentInstallments.paymentOptionId, option.id));
        for (const inst of installments) {
          await db.insert(paymentInstallments).values({
            paymentOptionId: newOption.id,
            installmentNumber: inst.installmentNumber,
            label: inst.label,
            calculationType: inst.calculationType,
            amount: inst.amount,
            percentage: inst.percentage,
            dueOffsetMonths: inst.dueOffsetMonths,
          });
        }
      }

      // 3c. Clone instance discounts
      const discounts = await db.select().from(instanceDiscounts)
        .where(and(eq(instanceDiscounts.instanceId, instance.id), eq(instanceDiscounts.instanceType, "market")));
      for (const discount of discounts) {
        const [newDiscount] = await db.insert(instanceDiscounts).values({
          instanceId: newInstance.id,
          instanceType: "market",
          type: discount.type,
          name: discount.name,
          invoiceItemText: discount.invoiceItemText,
          analyticalAccount: discount.analyticalAccount,
          accountingCode: discount.accountingCode,
          isFixed: discount.isFixed,
          fixedValue: discount.fixedValue,
          isPercentage: discount.isPercentage,
          percentageValue: discount.percentageValue,
          fromDate: discount.fromDate,
          toDate: discount.toDate,
          isActive: discount.isActive,
          description: discount.description,
        }).returning();
        discountIdMap.set(discount.id, newDiscount.id);
      }

      // 3d. Clone instance VAT rates
      const vatRates = await db.select().from(instanceVatRates)
        .where(and(eq(instanceVatRates.instanceId, instance.id), eq(instanceVatRates.instanceType, "market_instance")));
      for (const vat of vatRates) {
        const [newVat] = await db.insert(instanceVatRates).values({
          instanceId: newInstance.id,
          instanceType: "market_instance",
          billingDetailsId: vat.billingDetailsId,
          category: vat.category,
          accountingCode: vat.accountingCode,
          vatRate: vat.vatRate,
          fromDate: vat.fromDate,
          toDate: vat.toDate,
          description: vat.description,
          createAsNewVat: vat.createAsNewVat,
          isActive: vat.isActive,
        }).returning();
        vatRateIdMap.set(vat.id, newVat.id);
      }

      // 4. Clone market product services (Skladovanie)
      const services = await db.select().from(marketProductServices)
        .where(eq(marketProductServices.instanceId, instance.id));
      for (const service of services) {
        const [newService] = await db.insert(marketProductServices).values({
          instanceId: newInstance.id,
          name: service.name,
          fromDate: service.fromDate,
          toDate: service.toDate,
          invoiceIdentifier: service.invoiceIdentifier,
          invoiceable: service.invoiceable,
          collectable: service.collectable,
          storable: service.storable,
          isActive: service.isActive,
          blockAutomation: service.blockAutomation,
          certificateTemplate: service.certificateTemplate,
          description: service.description,
          allowProformaInvoices: service.allowProformaInvoices,
          invoicingPeriodYears: service.invoicingPeriodYears,
          firstInvoiceAliquote: service.firstInvoiceAliquote,
          constantSymbol: service.constantSymbol,
          startInvoicing: service.startInvoicing,
          endInvoicing: service.endInvoicing,
          accountingIdOffset: service.accountingIdOffset,
          ledgerAccountProforma: service.ledgerAccountProforma,
          ledgerAccountInvoice: service.ledgerAccountInvoice,
        }).returning();
        serviceIdMap.set(service.id, newService.id);

        // Clone service prices
        const servicePrices = await db.select().from(instancePrices)
          .where(and(eq(instancePrices.instanceId, service.id), eq(instancePrices.instanceType, "service")));
        for (const price of servicePrices) {
          const [newPrice] = await db.insert(instancePrices).values({
            instanceId: newService.id,
            instanceType: "service",
            name: price.name,
            accountingCode: price.accountingCode,
            analyticalAccount: price.analyticalAccount,
            price: price.price,
            currency: price.currency,
            amendment: price.amendment,
            fromDate: price.fromDate,
            toDate: price.toDate,
            isActive: price.isActive,
            description: price.description,
          }).returning();
          priceIdMap.set(price.id, newPrice.id);
        }

        // Clone service payment options
        const servicePaymentOptions = await db.select().from(instancePaymentOptions)
          .where(and(eq(instancePaymentOptions.instanceId, service.id), eq(instancePaymentOptions.instanceType, "service")));
        for (const option of servicePaymentOptions) {
          const [newOption] = await db.insert(instancePaymentOptions).values({
            instanceId: newService.id,
            instanceType: "service",
            type: option.type,
            name: option.name,
            invoiceItemText: option.invoiceItemText,
            analyticalAccount: option.analyticalAccount,
            accountingCode: option.accountingCode,
            paymentTypeFee: option.paymentTypeFee,
            amendment: option.amendment,
            fromDate: option.fromDate,
            toDate: option.toDate,
            isActive: option.isActive,
            description: option.description,
            isMultiPayment: option.isMultiPayment,
            frequency: option.frequency,
            installmentCount: option.installmentCount,
            calculationMode: option.calculationMode,
            basePriceId: option.basePriceId ? priceIdMap.get(option.basePriceId) || option.basePriceId : null,
          }).returning();
          paymentOptionIdMap.set(option.id, newOption.id);

          // Clone installments
          const installments = await db.select().from(paymentInstallments)
            .where(eq(paymentInstallments.paymentOptionId, option.id));
          for (const inst of installments) {
            await db.insert(paymentInstallments).values({
              paymentOptionId: newOption.id,
              installmentNumber: inst.installmentNumber,
              label: inst.label,
              calculationType: inst.calculationType,
              amount: inst.amount,
              percentage: inst.percentage,
              dueOffsetMonths: inst.dueOffsetMonths,
            });
          }
        }

        // Clone service discounts
        const serviceDiscounts = await db.select().from(instanceDiscounts)
          .where(and(eq(instanceDiscounts.instanceId, service.id), eq(instanceDiscounts.instanceType, "service")));
        for (const discount of serviceDiscounts) {
          const [newDiscount] = await db.insert(instanceDiscounts).values({
            instanceId: newService.id,
            instanceType: "service",
            type: discount.type,
            name: discount.name,
            invoiceItemText: discount.invoiceItemText,
            analyticalAccount: discount.analyticalAccount,
            accountingCode: discount.accountingCode,
            isFixed: discount.isFixed,
            fixedValue: discount.fixedValue,
            isPercentage: discount.isPercentage,
            percentageValue: discount.percentageValue,
            fromDate: discount.fromDate,
            toDate: discount.toDate,
            isActive: discount.isActive,
            description: discount.description,
          }).returning();
          discountIdMap.set(discount.id, newDiscount.id);
        }

        // Clone service VAT rates
        const serviceVatRates = await db.select().from(instanceVatRates)
          .where(and(eq(instanceVatRates.instanceId, service.id), eq(instanceVatRates.instanceType, "service")));
        for (const vat of serviceVatRates) {
          const [newVat] = await db.insert(instanceVatRates).values({
            instanceId: newService.id,
            instanceType: "service",
            billingDetailsId: vat.billingDetailsId,
            category: vat.category,
            accountingCode: vat.accountingCode,
            vatRate: vat.vatRate,
            fromDate: vat.fromDate,
            toDate: vat.toDate,
            description: vat.description,
            createAsNewVat: vat.createAsNewVat,
            isActive: vat.isActive,
          }).returning();
          vatRateIdMap.set(vat.id, newVat.id);
        }
      }
    }

    // 5. Clone product sets (Zostavy)
    const originalSets = await db.select().from(productSets)
      .where(eq(productSets.productId, productId));

    for (const set of originalSets) {
      const [newSet] = await db.insert(productSets).values({
        productId: newProduct.id,
        name: set.name,
        fromDate: set.fromDate,
        toDate: set.toDate,
        currency: set.currency,
        notes: set.notes,
        isActive: set.isActive,
        emailAlertEnabled: set.emailAlertEnabled,
        totalNetAmount: set.totalNetAmount,
        totalDiscountAmount: set.totalDiscountAmount,
        totalVatAmount: set.totalVatAmount,
        totalGrossAmount: set.totalGrossAmount,
      }).returning();

      // Clone set collections
      const collections = await db.select().from(productSetCollections)
        .where(eq(productSetCollections.productSetId, set.id));
      for (const col of collections) {
        await db.insert(productSetCollections).values({
          productSetId: newSet.id,
          instanceId: instanceIdMap.get(col.instanceId) || col.instanceId,
          priceId: col.priceId ? priceIdMap.get(col.priceId) || col.priceId : null,
          paymentOptionId: col.paymentOptionId ? paymentOptionIdMap.get(col.paymentOptionId) || col.paymentOptionId : null,
          discountId: col.discountId ? discountIdMap.get(col.discountId) || col.discountId : null,
          vatRateId: col.vatRateId ? vatRateIdMap.get(col.vatRateId) || col.vatRateId : null,
          quantity: col.quantity,
          priceOverride: col.priceOverride,
          sortOrder: col.sortOrder,
          lineNetAmount: col.lineNetAmount,
          lineDiscountAmount: col.lineDiscountAmount,
          lineVatAmount: col.lineVatAmount,
          lineGrossAmount: col.lineGrossAmount,
        });
      }

      // Clone set storage items
      const storageItems = await db.select().from(productSetStorage)
        .where(eq(productSetStorage.productSetId, set.id));
      for (const item of storageItems) {
        await db.insert(productSetStorage).values({
          productSetId: newSet.id,
          serviceId: serviceIdMap.get(item.serviceId) || item.serviceId,
          priceId: item.priceId ? priceIdMap.get(item.priceId) || item.priceId : null,
          discountId: item.discountId ? discountIdMap.get(item.discountId) || item.discountId : null,
          vatRateId: item.vatRateId ? vatRateIdMap.get(item.vatRateId) || item.vatRateId : null,
          paymentOptionId: item.paymentOptionId ? paymentOptionIdMap.get(item.paymentOptionId) || item.paymentOptionId : null,
          quantity: item.quantity,
          priceOverride: item.priceOverride,
          sortOrder: item.sortOrder,
          lineNetAmount: item.lineNetAmount,
          lineDiscountAmount: item.lineDiscountAmount,
          lineVatAmount: item.lineVatAmount,
          lineGrossAmount: item.lineGrossAmount,
        });
      }
    }

    return newProduct;
  }

  // Chat Messages
  async getChatMessages(userId1: string, userId2: string, limit: number = 50): Promise<ChatMessage[]> {
    return await db.select()
      .from(chatMessages)
      .where(
        or(
          and(eq(chatMessages.senderId, userId1), eq(chatMessages.receiverId, userId2)),
          and(eq(chatMessages.senderId, userId2), eq(chatMessages.receiverId, userId1))
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async getChatConversations(userId: string): Promise<{ partnerId: string; lastMessage: ChatMessage; unreadCount: number }[]> {
    const messages = await db.select()
      .from(chatMessages)
      .where(
        or(
          eq(chatMessages.senderId, userId),
          eq(chatMessages.receiverId, userId)
        )
      )
      .orderBy(desc(chatMessages.createdAt));

    const conversationMap = new Map<string, { lastMessage: ChatMessage; unreadCount: number }>();

    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      
      if (!conversationMap.has(partnerId)) {
        const unreadCount = messages.filter(
          m => m.senderId === partnerId && m.receiverId === userId && !m.isRead
        ).length;
        conversationMap.set(partnerId, { lastMessage: msg, unreadCount });
      }
    }

    return Array.from(conversationMap.entries()).map(([partnerId, data]) => ({
      partnerId,
      ...data
    }));
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(data).returning();
    return message;
  }

  async markMessagesAsRead(senderId: string, receiverId: string): Promise<void> {
    await db.update(chatMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(chatMessages.senderId, senderId),
          eq(chatMessages.receiverId, receiverId),
          eq(chatMessages.isRead, false)
        )
      );
  }

  // Exchange Rates
  async getLatestExchangeRates(): Promise<ExchangeRate[]> {
    const rates = await db.select()
      .from(exchangeRates)
      .orderBy(exchangeRates.currencyCode);
    return rates;
  }

  async getExchangeRateByCode(currencyCode: string): Promise<ExchangeRate | undefined> {
    const [rate] = await db.select()
      .from(exchangeRates)
      .where(eq(exchangeRates.currencyCode, currencyCode));
    return rate || undefined;
  }

  async upsertExchangeRates(rates: InsertExchangeRate[]): Promise<ExchangeRate[]> {
    const results: ExchangeRate[] = [];
    
    for (const rate of rates) {
      const existing = await this.getExchangeRateByCode(rate.currencyCode);
      
      if (existing) {
        const [updated] = await db.update(exchangeRates)
          .set({
            currencyName: rate.currencyName,
            rate: rate.rate,
            rateDate: rate.rateDate,
            updatedAt: sql`now()`
          })
          .where(eq(exchangeRates.currencyCode, rate.currencyCode))
          .returning();
        results.push(updated);
      } else {
        const [created] = await db.insert(exchangeRates)
          .values(rate)
          .returning();
        results.push(created);
      }
    }
    
    return results;
  }

  async getExchangeRatesLastUpdate(): Promise<Date | null> {
    const [rate] = await db.select()
      .from(exchangeRates)
      .orderBy(desc(exchangeRates.updatedAt))
      .limit(1);
    return rate?.updatedAt || null;
  }
}

export const storage = new DatabaseStorage();
