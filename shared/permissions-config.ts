export const DEPARTMENTS = [
  { id: "management", name: "Management" },
  { id: "sales", name: "Sales" },
  { id: "operations", name: "Operations" },
  { id: "finance", name: "Finance" },
  { id: "customer_service", name: "Customer Service" },
  { id: "it", name: "IT" },
  { id: "medical", name: "Medical" },
] as const;

export type DepartmentId = typeof DEPARTMENTS[number]["id"];

export type FieldPermission = "editable" | "readonly" | "hidden";
export type ModuleAccess = "visible" | "hidden";

export interface ModuleField {
  key: string;
  label: string;
  defaultPermission: FieldPermission;
}

export interface ModuleDefinition {
  key: string;
  label: string;
  icon: string;
  category: string;
  defaultAccess: ModuleAccess;
  fields: ModuleField[];
}

export const CRM_MODULES: ModuleDefinition[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    category: "main",
    defaultAccess: "visible",
    fields: [
      { key: "stats_overview", label: "Statistics Overview", defaultPermission: "readonly" },
      { key: "recent_customers", label: "Recent Customers", defaultPermission: "readonly" },
      { key: "activity_feed", label: "Activity Feed", defaultPermission: "readonly" },
      { key: "pipeline_overview", label: "Pipeline Overview", defaultPermission: "readonly" },
      { key: "revenue_charts", label: "Revenue Charts", defaultPermission: "readonly" },
    ],
  },
  {
    key: "hospitals",
    label: "Hospitals & Clinics",
    icon: "Building2",
    category: "main",
    defaultAccess: "visible",
    fields: [
      { key: "name", label: "Name", defaultPermission: "editable" },
      { key: "full_name", label: "Full Name", defaultPermission: "editable" },
      { key: "street_number", label: "Street Number", defaultPermission: "editable" },
      { key: "city", label: "City", defaultPermission: "editable" },
      { key: "postal_code", label: "Postal Code", defaultPermission: "editable" },
      { key: "region", label: "Region", defaultPermission: "editable" },
      { key: "country_code", label: "Country", defaultPermission: "editable" },
      { key: "representative", label: "Representative", defaultPermission: "editable" },
      { key: "laboratory", label: "Laboratory", defaultPermission: "editable" },
      { key: "auto_recruiting", label: "Auto Recruiting", defaultPermission: "editable" },
      { key: "responsible_person", label: "Responsible Person", defaultPermission: "editable" },
      { key: "contact_person", label: "Contact Person", defaultPermission: "editable" },
      { key: "svet_zdravia", label: "Svet Zdravia", defaultPermission: "editable" },
      { key: "is_active", label: "Is Active", defaultPermission: "editable" },
    ],
  },
  {
    key: "pipeline",
    label: "Pipeline",
    icon: "Kanban",
    category: "main",
    defaultAccess: "visible",
    fields: [
      { key: "pipeline_board", label: "Pipeline Board", defaultPermission: "editable" },
      { key: "stage_management", label: "Stage Management", defaultPermission: "editable" },
      { key: "deal_values", label: "Deal Values", defaultPermission: "editable" },
      { key: "assigned_user", label: "Assigned User", defaultPermission: "editable" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: "BarChart3",
    category: "main",
    defaultAccess: "visible",
    fields: [
      { key: "customer_audit", label: "Customer Audit Report", defaultPermission: "readonly" },
      { key: "export_data", label: "Export Data", defaultPermission: "editable" },
    ],
  },

  {
    key: "customers",
    label: "Customers",
    icon: "Users",
    category: "customers",
    defaultAccess: "visible",
    fields: [
      { key: "internal_id", label: "Internal ID", defaultPermission: "editable" },
      { key: "title_before", label: "Title Before", defaultPermission: "editable" },
      { key: "first_name", label: "First Name", defaultPermission: "editable" },
      { key: "last_name", label: "Last Name", defaultPermission: "editable" },
      { key: "maiden_name", label: "Maiden Name", defaultPermission: "editable" },
      { key: "title_after", label: "Title After", defaultPermission: "editable" },
      { key: "phone", label: "Phone", defaultPermission: "editable" },
      { key: "mobile", label: "Mobile", defaultPermission: "editable" },
      { key: "mobile_2", label: "Mobile 2", defaultPermission: "editable" },
      { key: "email", label: "Email", defaultPermission: "editable" },
      { key: "email_2", label: "Email 2", defaultPermission: "editable" },
      { key: "national_id", label: "National ID", defaultPermission: "editable" },
      { key: "id_card_number", label: "ID Card Number", defaultPermission: "editable" },
      { key: "date_of_birth", label: "Date of Birth", defaultPermission: "editable" },
      { key: "newsletter", label: "Newsletter", defaultPermission: "editable" },
      { key: "complaint_type", label: "Complaint Type", defaultPermission: "editable" },
      { key: "cooperation_type", label: "Cooperation Type", defaultPermission: "editable" },
      { key: "vip_status", label: "VIP Status", defaultPermission: "editable" },
      { key: "country", label: "Country", defaultPermission: "editable" },
      { key: "city", label: "City", defaultPermission: "editable" },
      { key: "address", label: "Address", defaultPermission: "editable" },
      { key: "postal_code", label: "Postal Code", defaultPermission: "editable" },
      { key: "region", label: "Region", defaultPermission: "editable" },
      { key: "correspondence_address", label: "Correspondence Address", defaultPermission: "editable" },
      { key: "bank_account", label: "Bank Account", defaultPermission: "editable" },
      { key: "health_insurance", label: "Health Insurance", defaultPermission: "editable" },
      { key: "client_status", label: "Client Status", defaultPermission: "editable" },
      { key: "lead_score", label: "Lead Score", defaultPermission: "readonly" },
      { key: "notes", label: "Notes", defaultPermission: "editable" },
      { key: "assigned_user", label: "Assigned User", defaultPermission: "editable" },
    ],
  },
  {
    key: "contracts",
    label: "Contracts",
    icon: "FileSignature",
    category: "customers",
    defaultAccess: "visible",
    fields: [
      { key: "contract_number", label: "Contract Number", defaultPermission: "editable" },
      { key: "customer", label: "Customer", defaultPermission: "editable" },
      { key: "type", label: "Type", defaultPermission: "editable" },
      { key: "status", label: "Status", defaultPermission: "editable" },
      { key: "start_date", label: "Start Date", defaultPermission: "editable" },
      { key: "end_date", label: "End Date", defaultPermission: "editable" },
      { key: "value", label: "Value", defaultPermission: "editable" },
      { key: "products", label: "Products", defaultPermission: "editable" },
      { key: "documents", label: "Documents", defaultPermission: "editable" },
      { key: "notes", label: "Notes", defaultPermission: "editable" },
    ],
  },
  {
    key: "collections",
    label: "Collections",
    icon: "Wallet",
    category: "customers",
    defaultAccess: "visible",
    fields: [
      { key: "collection_number", label: "Collection Number", defaultPermission: "readonly" },
      { key: "customer", label: "Customer", defaultPermission: "editable" },
      { key: "amount", label: "Amount", defaultPermission: "editable" },
      { key: "status", label: "Status", defaultPermission: "editable" },
      { key: "type", label: "Type", defaultPermission: "editable" },
      { key: "date", label: "Date", defaultPermission: "editable" },
      { key: "payment_method", label: "Payment Method", defaultPermission: "editable" },
      { key: "notes", label: "Notes", defaultPermission: "editable" },
    ],
  },
  {
    key: "invoices",
    label: "Customer Invoices",
    icon: "FileText",
    category: "customers",
    defaultAccess: "visible",
    fields: [
      { key: "invoice_number", label: "Invoice Number", defaultPermission: "readonly" },
      { key: "customer", label: "Customer", defaultPermission: "editable" },
      { key: "billing_company", label: "Billing Company", defaultPermission: "editable" },
      { key: "issue_date", label: "Issue Date", defaultPermission: "editable" },
      { key: "due_date", label: "Due Date", defaultPermission: "editable" },
      { key: "items", label: "Items", defaultPermission: "editable" },
      { key: "subtotal", label: "Subtotal", defaultPermission: "readonly" },
      { key: "vat_amount", label: "VAT Amount", defaultPermission: "readonly" },
      { key: "total_amount", label: "Total Amount", defaultPermission: "readonly" },
      { key: "status", label: "Status", defaultPermission: "editable" },
      { key: "notes", label: "Notes", defaultPermission: "editable" },
    ],
  },

  {
    key: "collaborators",
    label: "Collaborators",
    icon: "Handshake",
    category: "collaborators",
    defaultAccess: "visible",
    fields: [
      { key: "title_before", label: "Title Before", defaultPermission: "editable" },
      { key: "first_name", label: "First Name", defaultPermission: "editable" },
      { key: "last_name", label: "Last Name", defaultPermission: "editable" },
      { key: "title_after", label: "Title After", defaultPermission: "editable" },
      { key: "email", label: "Email", defaultPermission: "editable" },
      { key: "phone", label: "Phone", defaultPermission: "editable" },
      { key: "mobile", label: "Mobile", defaultPermission: "editable" },
      { key: "date_of_birth", label: "Date of Birth", defaultPermission: "editable" },
      { key: "national_id", label: "National ID", defaultPermission: "editable" },
      { key: "id_card_number", label: "ID Card Number", defaultPermission: "editable" },
      { key: "company_name", label: "Company Name", defaultPermission: "editable" },
      { key: "company_ico", label: "Company ICO", defaultPermission: "editable" },
      { key: "company_dic", label: "Company DIC", defaultPermission: "editable" },
      { key: "company_ic_dph", label: "Company IC DPH", defaultPermission: "editable" },
      { key: "bank_account", label: "Bank Account", defaultPermission: "editable" },
      { key: "addresses", label: "Addresses", defaultPermission: "editable" },
      { key: "agreements", label: "Agreements", defaultPermission: "editable" },
      { key: "pension_dates", label: "Pension Dates", defaultPermission: "editable" },
      { key: "is_active", label: "Is Active", defaultPermission: "editable" },
    ],
  },
  {
    key: "visitEvents",
    label: "Visit Events",
    icon: "CalendarCheck",
    category: "collaborators",
    defaultAccess: "visible",
    fields: [
      { key: "collaborator", label: "Collaborator", defaultPermission: "editable" },
      { key: "customer", label: "Customer", defaultPermission: "editable" },
      { key: "date", label: "Date", defaultPermission: "editable" },
      { key: "type", label: "Type", defaultPermission: "editable" },
      { key: "status", label: "Status", defaultPermission: "editable" },
      { key: "notes", label: "Notes", defaultPermission: "editable" },
      { key: "products", label: "Products", defaultPermission: "editable" },
    ],
  },
  {
    key: "collaboratorReports",
    label: "Collaborator Reports",
    icon: "ClipboardList",
    category: "collaborators",
    defaultAccess: "visible",
    fields: [
      { key: "report_data", label: "Report Data", defaultPermission: "readonly" },
      { key: "export_data", label: "Export Data", defaultPermission: "editable" },
    ],
  },

  {
    key: "email",
    label: "NEXUS Omni",
    icon: "Network",
    category: "nexus",
    defaultAccess: "visible",
    fields: [
      { key: "send_email", label: "Send Email", defaultPermission: "editable" },
      { key: "send_sms", label: "Send SMS", defaultPermission: "editable" },
      { key: "templates", label: "Templates", defaultPermission: "editable" },
      { key: "mass_communication", label: "Mass Communication", defaultPermission: "editable" },
      { key: "view_history", label: "View History", defaultPermission: "readonly" },
    ],
  },
  {
    key: "nexusPulse",
    label: "NEXUS Pulse",
    icon: "Zap",
    category: "nexus",
    defaultAccess: "visible",
    fields: [
      { key: "agent_workspace", label: "Agent Workspace", defaultPermission: "editable" },
      { key: "call_interface", label: "Call Interface", defaultPermission: "editable" },
      { key: "call_scripts", label: "Call Scripts", defaultPermission: "editable" },
      { key: "contact_queue", label: "Contact Queue", defaultPermission: "editable" },
      { key: "call_history", label: "Call History", defaultPermission: "readonly" },
    ],
  },
  {
    key: "campaigns",
    label: "NEXUS Missions",
    icon: "Target",
    category: "nexus",
    defaultAccess: "visible",
    fields: [
      { key: "campaign_management", label: "Campaign Management", defaultPermission: "editable" },
      { key: "campaign_contacts", label: "Campaign Contacts", defaultPermission: "editable" },
      { key: "campaign_reports", label: "Campaign Reports", defaultPermission: "readonly" },
      { key: "campaign_templates", label: "Campaign Templates", defaultPermission: "editable" },
    ],
  },

  {
    key: "users",
    label: "Users",
    icon: "UserCog",
    category: "admin",
    defaultAccess: "hidden",
    fields: [
      { key: "username", label: "Username", defaultPermission: "editable" },
      { key: "email", label: "Email", defaultPermission: "editable" },
      { key: "full_name", label: "Full Name", defaultPermission: "editable" },
      { key: "role", label: "Role", defaultPermission: "editable" },
      { key: "assigned_countries", label: "Assigned Countries", defaultPermission: "editable" },
      { key: "is_active", label: "Is Active", defaultPermission: "editable" },
      { key: "password", label: "Password", defaultPermission: "editable" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: "Settings",
    category: "admin",
    defaultAccess: "hidden",
    fields: [
      { key: "complaint_types", label: "Complaint Types", defaultPermission: "editable" },
      { key: "cooperation_types", label: "Cooperation Types", defaultPermission: "editable" },
      { key: "vip_statuses", label: "VIP Statuses", defaultPermission: "editable" },
      { key: "health_insurance", label: "Health Insurance Companies", defaultPermission: "editable" },
      { key: "laboratories", label: "Laboratories", defaultPermission: "editable" },
      { key: "countries", label: "Countries Management", defaultPermission: "editable" },
      { key: "sources", label: "Lead Sources", defaultPermission: "editable" },
    ],
  },
  {
    key: "configurator",
    label: "Configurator",
    icon: "Cog",
    category: "admin",
    defaultAccess: "hidden",
    fields: [
      { key: "services", label: "Services Configuration", defaultPermission: "editable" },
      { key: "products", label: "Products", defaultPermission: "editable" },
      { key: "invoice_templates", label: "Invoice Templates", defaultPermission: "editable" },
      { key: "invoice_editor", label: "Invoice Editor", defaultPermission: "editable" },
      { key: "permissions_roles", label: "Permissions & Roles", defaultPermission: "editable" },
      { key: "departments", label: "Departments", defaultPermission: "editable" },
      { key: "scheduled_invoices", label: "Scheduled Invoices", defaultPermission: "editable" },
    ],
  },
];

export const MODULE_CATEGORIES = [
  { key: "main", label: "Main Navigation", icon: "LayoutDashboard" },
  { key: "customers", label: "Customers Section", icon: "Users" },
  { key: "collaborators", label: "Collaborators Section", icon: "Handshake" },
  { key: "nexus", label: "NEXUS Platform", icon: "Zap" },
  { key: "admin", label: "Administration", icon: "Shield" },
] as const;

export function getModuleByKey(key: string): ModuleDefinition | undefined {
  return CRM_MODULES.find((m) => m.key === key);
}

export function getFieldByKey(moduleKey: string, fieldKey: string): ModuleField | undefined {
  const module = getModuleByKey(moduleKey);
  return module?.fields.find((f) => f.key === fieldKey);
}

export function getModulesByCategory(category: string): ModuleDefinition[] {
  return CRM_MODULES.filter((m) => m.category === category);
}
