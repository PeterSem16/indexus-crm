import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertUserSchema, insertCustomerSchema, updateUserSchema, loginSchema,
  insertProductSchema, insertCustomerProductSchema, insertBillingDetailsSchema,
  insertCustomerNoteSchema, insertActivityLogSchema, sendEmailSchema, sendSmsSchema,
  insertComplaintTypeSchema, insertCooperationTypeSchema, insertVipStatusSchema, insertHealthInsuranceSchema,
  insertLaboratorySchema, insertHospitalSchema,
  insertCollaboratorSchema, insertCollaboratorAddressSchema, insertCollaboratorOtherDataSchema, insertCollaboratorAgreementSchema,
  insertLeadScoringCriteriaSchema,
  insertServiceConfigurationSchema, insertServiceInstanceSchema, insertInvoiceTemplateSchema, insertInvoiceLayoutSchema,
  insertRoleSchema, insertRoleModulePermissionSchema, insertRoleFieldPermissionSchema,
  insertSavedSearchSchema,
  insertCampaignSchema, insertCampaignContactSchema, insertCampaignContactHistorySchema,
  insertSipSettingsSchema, insertCallLogSchema,
  insertInstanceVatRateSchema,
  type SafeUser, type Customer, type Product, type BillingDetails, type ActivityLog, type LeadScoringCriteria,
  type ServiceConfiguration, type InvoiceTemplate, type InvoiceLayout, type Role,
  type Campaign, type CampaignContact
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import multer from "multer";

// Configure multer for agreement file uploads
const agreementStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "agreements");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `agreement-${uniqueSuffix}${ext}`);
  },
});

const uploadAgreement = multer({
  storage: agreementStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPEG, PNG, DOC, DOCX are allowed."));
    }
  },
});

// Configure multer for invoice image uploads
const invoiceImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "invoice-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `invoice-image-${uniqueSuffix}${ext}`);
  },
});

const uploadInvoiceImage = multer({
  storage: invoiceImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, WEBP, SVG are allowed."));
    }
  },
});

// Configure multer for user avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "avatars");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, WEBP are allowed."));
    }
  },
});

// Helper function to convert date strings to Date objects
function parseDateFields(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  if (typeof result.fromDate === 'string') {
    result.fromDate = result.fromDate ? new Date(result.fromDate) : null;
  }
  if (typeof result.toDate === 'string') {
    result.toDate = result.toDate ? new Date(result.toDate) : null;
  }
  return result;
}

// Extract text from PDF
async function extractPdfText(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    // Dynamic import for pdf-parse which doesn't have proper ESM exports
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(dataBuffer);
    return data.text || "";
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return "";
  }
}

declare module "express-session" {
  interface SessionData {
    user: SafeUser;
  }
}

const MemoryStoreSession = MemoryStore(session);

// Helper function to log user activities
async function logActivity(
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  entityName?: string,
  details?: object,
  ipAddress?: string
) {
  try {
    await storage.createActivityLog({
      userId,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      entityName: entityName || null,
      details: details ? JSON.stringify(details) : null,
      ipAddress: ipAddress || null,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "nexus-biolink-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Serve uploaded files statically
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Helper to check billing company country access
  const checkBillingCompanyAccess = async (req: Request, res: Response, billingDetailsId: string): Promise<boolean> => {
    const userCountries = req.session.user?.assignedCountries || [];
    const billingCompany = await storage.getBillingDetailsById(billingDetailsId);
    if (!billingCompany) {
      res.status(404).json({ error: "Billing company not found" });
      return false;
    }
    // Check if user has access to any of the billing company's countries
    const billingCountries = billingCompany.countryCodes?.length ? billingCompany.countryCodes : [billingCompany.countryCode];
    const hasAccess = billingCountries.some(country => userCountries.includes(country));
    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" });
      return false;
    }
    return true;
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.validatePassword(username, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ error: "Account is deactivated" });
      }
      
      const { passwordHash, ...safeUser } = user;
      req.session.user = safeUser;
      
      // Log login activity
      await logActivity(user.id, "login", "user", user.id, user.fullName, undefined, req.ip);
      
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.user?.id;
    const userName = req.session.user?.fullName;
    
    if (userId) {
      await logActivity(userId, "logout", "user", userId, userName, undefined, req.ip);
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.user) {
      return res.json({ user: null });
    }
    res.json({ user: req.session.user });
  });

  // Users API (protected)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check for existing username
      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Check for existing email
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = updateUserSchema.parse(req.body);
      
      // Check for duplicate username if updating
      if (validatedData.username) {
        const existing = await storage.getUserByUsername(validatedData.username);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }
      
      // Check for duplicate email if updating
      if (validatedData.email) {
        const existing = await storage.getUserByEmail(validatedData.email);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "Email already exists" });
        }
      }
      
      const user = await storage.updateUser(req.params.id, validatedData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // User avatar upload
  app.post("/api/users/:id/avatar", requireAuth, uploadAvatar.single("avatar"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const user = await storage.updateUser(req.params.id, { avatarUrl });
      
      if (!user) {
        // Delete the uploaded file if user not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update session if it's the current user
      if (req.session.user && req.session.user.id === req.params.id) {
        req.session.user = { ...req.session.user, avatarUrl } as SafeUser;
      }
      
      res.json({ avatarUrl, user });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  // Customers API (protected)
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      
      // Log activity
      await logActivity(
        req.session.user!.id,
        "create",
        "customer",
        customer.id,
        `${customer.firstName} ${customer.lastName}`,
        { country: customer.country },
        req.ip
      );
      
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertCustomerSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const customer = await storage.updateCustomer(req.params.id, validatedData);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      // Log activity
      await logActivity(
        req.session.user!.id,
        "update",
        "customer",
        customer.id,
        `${customer.firstName} ${customer.lastName}`,
        { changes: Object.keys(validatedData) },
        req.ip
      );
      
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // GDPR Customer Consents API
  app.get("/api/customers/:id/consents", requireAuth, async (req, res) => {
    try {
      const consents = await storage.getCustomerConsents(req.params.id);
      res.json(consents);
    } catch (error) {
      console.error("Error fetching consents:", error);
      res.status(500).json({ error: "Failed to fetch consents" });
    }
  });

  app.post("/api/customers/:id/consents", requireAuth, async (req, res) => {
    try {
      const consentData = {
        ...req.body,
        customerId: req.params.id,
        grantedByUserId: req.session.user!.id,
        grantedAt: req.body.granted ? new Date() : null,
      };
      const consent = await storage.createCustomerConsent(consentData);
      
      // Log activity
      await logActivity(
        req.session.user!.id,
        req.body.granted ? "consent_granted" : "consent_created",
        "consent",
        consent.id,
        `${req.body.consentType} for customer ${req.params.id}`,
        { consentType: req.body.consentType, legalBasis: req.body.legalBasis },
        req.ip
      );
      
      res.status(201).json(consent);
    } catch (error) {
      console.error("Error creating consent:", error);
      res.status(500).json({ error: "Failed to create consent" });
    }
  });

  app.patch("/api/customers/:customerId/consents/:id", requireAuth, async (req, res) => {
    try {
      const consent = await storage.updateCustomerConsent(req.params.id, req.body);
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }
      res.json(consent);
    } catch (error) {
      console.error("Error updating consent:", error);
      res.status(500).json({ error: "Failed to update consent" });
    }
  });

  app.post("/api/customers/:customerId/consents/:id/revoke", requireAuth, async (req, res) => {
    try {
      const consent = await storage.revokeCustomerConsent(
        req.params.id,
        req.session.user!.id,
        req.body.reason
      );
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }
      
      // Log activity
      await logActivity(
        req.session.user!.id,
        "consent_revoked",
        "consent",
        consent.id,
        `${consent.consentType} for customer ${req.params.customerId}`,
        { consentType: consent.consentType, reason: req.body.reason },
        req.ip
      );
      
      res.json(consent);
    } catch (error) {
      console.error("Error revoking consent:", error);
      res.status(500).json({ error: "Failed to revoke consent" });
    }
  });

  // GDPR Data Export
  app.get("/api/customers/:id/gdpr-export", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      const exportData = await storage.getCustomerDataExport(req.params.id);
      
      // Log the export activity
      await logActivity(
        req.session.user!.id,
        "export",
        "customer",
        req.params.id,
        `${customer.firstName} ${customer.lastName}`,
        { exportType: "gdpr_data_export" },
        req.ip
      );
      
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting customer data:", error);
      res.status(500).json({ error: "Failed to export customer data" });
    }
  });

  // GDPR Access Log for Customer
  app.get("/api/customers/:id/access-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getActivityLogsByEntity("customer", req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching access logs:", error);
      res.status(500).json({ error: "Failed to fetch access logs" });
    }
  });

  // Tasks API (protected)
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/my", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTasksByUser(req.session.user!.id);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching user tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const taskData = {
        ...req.body,
        createdByUserId: req.session.user!.id,
      };
      const task = await storage.createTask(taskData);
      
      await logActivity(
        req.session.user!.id,
        "create",
        "task",
        task.id,
        task.title,
        { priority: task.priority, assignedUserId: task.assignedUserId },
        req.ip
      );
      
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "update",
        "task",
        task.id,
        task.title,
        req.body,
        req.ip
      );
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      const deleted = await storage.deleteTask(req.params.id);
      if (deleted) {
        await logActivity(
          req.session.user!.id,
          "delete",
          "task",
          req.params.id,
          task.title,
          {},
          req.ip
        );
      }
      
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Products API (protected)
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertProductSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const product = await storage.updateProduct(req.params.id, validatedData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Duplicate Product API
  app.post("/api/products/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const { newName } = req.body;
      if (!newName || typeof newName !== "string") {
        return res.status(400).json({ error: "New product name is required" });
      }
      const newProduct = await storage.duplicateProduct(req.params.id, newName);
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error duplicating product:", error);
      res.status(500).json({ error: "Failed to duplicate product" });
    }
  });

  // Market Product Instances API
  app.get("/api/products/:productId/instances", requireAuth, async (req, res) => {
    try {
      const instances = await storage.getMarketProductInstances(req.params.productId);
      res.json(instances);
    } catch (error) {
      console.error("Error fetching market product instances:", error);
      res.status(500).json({ error: "Failed to fetch instances" });
    }
  });

  app.post("/api/products/:productId/instances", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields({ ...req.body, productId: req.params.productId });
      const instance = await storage.createMarketProductInstance(data);
      res.status(201).json(instance);
    } catch (error) {
      console.error("Error creating market product instance:", error);
      res.status(500).json({ error: "Failed to create instance" });
    }
  });

  app.patch("/api/product-instances/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      const instance = await storage.updateMarketProductInstance(req.params.id, data);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }
      res.json(instance);
    } catch (error) {
      console.error("Error updating market product instance:", error);
      res.status(500).json({ error: "Failed to update instance" });
    }
  });

  app.delete("/api/product-instances/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteMarketProductInstance(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Instance not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting market product instance:", error);
      res.status(500).json({ error: "Failed to delete instance" });
    }
  });

  // Instance Prices API
  app.get("/api/instance-prices/:instanceId/:instanceType", requireAuth, async (req, res) => {
    try {
      const prices = await storage.getInstancePrices(req.params.instanceId, req.params.instanceType);
      res.json(prices);
    } catch (error) {
      console.error("Error fetching instance prices:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  app.post("/api/instance-prices", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      const price = await storage.createInstancePrice(data);
      res.status(201).json(price);
    } catch (error) {
      console.error("Error creating instance price:", error);
      res.status(500).json({ error: "Failed to create price" });
    }
  });

  app.patch("/api/instance-prices/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      const price = await storage.updateInstancePrice(req.params.id, data);
      if (!price) {
        return res.status(404).json({ error: "Price not found" });
      }
      res.json(price);
    } catch (error) {
      console.error("Error updating instance price:", error);
      res.status(500).json({ error: "Failed to update price" });
    }
  });

  app.delete("/api/instance-prices/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteInstancePrice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Price not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting instance price:", error);
      res.status(500).json({ error: "Failed to delete price" });
    }
  });

  // Instance Payment Options API
  app.get("/api/instance-payment-options/:instanceId/:instanceType", requireAuth, async (req, res) => {
    try {
      const options = await storage.getInstancePaymentOptions(req.params.instanceId, req.params.instanceType);
      res.json(options);
    } catch (error) {
      console.error("Error fetching payment options:", error);
      res.status(500).json({ error: "Failed to fetch payment options" });
    }
  });

  app.post("/api/instance-payment-options", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      // Convert empty strings to null for numeric fields
      if (data.paymentTypeFee === "") data.paymentTypeFee = null;
      if (data.installmentCount === "") data.installmentCount = null;
      const option = await storage.createInstancePaymentOption(data);
      res.status(201).json(option);
    } catch (error) {
      console.error("Error creating payment option:", error);
      res.status(500).json({ error: "Failed to create payment option" });
    }
  });

  app.patch("/api/instance-payment-options/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      // Convert empty strings to null for numeric fields
      if (data.paymentTypeFee === "") data.paymentTypeFee = null;
      if (data.installmentCount === "") data.installmentCount = null;
      const option = await storage.updateInstancePaymentOption(req.params.id, data);
      if (!option) {
        return res.status(404).json({ error: "Payment option not found" });
      }
      res.json(option);
    } catch (error) {
      console.error("Error updating payment option:", error);
      res.status(500).json({ error: "Failed to update payment option" });
    }
  });

  app.delete("/api/instance-payment-options/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteInstancePaymentOption(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payment option not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment option:", error);
      res.status(500).json({ error: "Failed to delete payment option" });
    }
  });

  // Payment Installments API
  app.get("/api/payment-installments/:paymentOptionId", requireAuth, async (req, res) => {
    try {
      const installments = await storage.getPaymentInstallments(req.params.paymentOptionId);
      res.json(installments);
    } catch (error) {
      console.error("Error fetching payment installments:", error);
      res.status(500).json({ error: "Failed to fetch payment installments" });
    }
  });

  app.post("/api/payment-installments", requireAuth, async (req, res) => {
    try {
      const installment = await storage.createPaymentInstallment(req.body);
      res.status(201).json(installment);
    } catch (error) {
      console.error("Error creating payment installment:", error);
      res.status(500).json({ error: "Failed to create payment installment" });
    }
  });

  app.post("/api/payment-installments/bulk", requireAuth, async (req, res) => {
    try {
      const { paymentOptionId, installments } = req.body;
      // First delete existing installments
      await storage.deletePaymentInstallmentsByOption(paymentOptionId);
      // Then create new ones
      const created = await storage.bulkCreatePaymentInstallments(installments);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error bulk creating payment installments:", error);
      res.status(500).json({ error: "Failed to create payment installments" });
    }
  });

  app.patch("/api/payment-installments/:id", requireAuth, async (req, res) => {
    try {
      const installment = await storage.updatePaymentInstallment(req.params.id, req.body);
      if (!installment) {
        return res.status(404).json({ error: "Payment installment not found" });
      }
      res.json(installment);
    } catch (error) {
      console.error("Error updating payment installment:", error);
      res.status(500).json({ error: "Failed to update payment installment" });
    }
  });

  app.delete("/api/payment-installments/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deletePaymentInstallment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payment installment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment installment:", error);
      res.status(500).json({ error: "Failed to delete payment installment" });
    }
  });

  // Instance Discounts API
  app.get("/api/instance-discounts/:instanceId/:instanceType", requireAuth, async (req, res) => {
    try {
      const discounts = await storage.getInstanceDiscounts(req.params.instanceId, req.params.instanceType);
      res.json(discounts);
    } catch (error) {
      console.error("Error fetching discounts:", error);
      res.status(500).json({ error: "Failed to fetch discounts" });
    }
  });

  app.post("/api/instance-discounts", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      // Convert empty strings to null for numeric fields
      if (data.fixedValue === "") data.fixedValue = null;
      if (data.percentageValue === "") data.percentageValue = null;
      const discount = await storage.createInstanceDiscount(data);
      res.status(201).json(discount);
    } catch (error) {
      console.error("Error creating discount:", error);
      res.status(500).json({ error: "Failed to create discount" });
    }
  });

  app.patch("/api/instance-discounts/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      // Convert empty strings to null for numeric fields
      if (data.fixedValue === "") data.fixedValue = null;
      if (data.percentageValue === "") data.percentageValue = null;
      const discount = await storage.updateInstanceDiscount(req.params.id, data);
      if (!discount) {
        return res.status(404).json({ error: "Discount not found" });
      }
      res.json(discount);
    } catch (error) {
      console.error("Error updating discount:", error);
      res.status(500).json({ error: "Failed to update discount" });
    }
  });

  app.delete("/api/instance-discounts/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteInstanceDiscount(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Discount not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting discount:", error);
      res.status(500).json({ error: "Failed to delete discount" });
    }
  });

  // Instance VAT Rates API
  app.get("/api/instance-vat-rates/:instanceId/:instanceType", requireAuth, async (req, res) => {
    try {
      const vatRates = await storage.getInstanceVatRates(req.params.instanceId, req.params.instanceType);
      res.json(vatRates);
    } catch (error) {
      console.error("Error fetching VAT rates:", error);
      res.status(500).json({ error: "Failed to fetch VAT rates" });
    }
  });

  app.post("/api/instance-vat-rates", requireAuth, async (req, res) => {
    try {
      // Preprocess data - convert empty strings to null for optional fields
      const rawData = parseDateFields(req.body);
      if (rawData.vatRate === "") rawData.vatRate = null;
      if (rawData.accountingCode === "") rawData.accountingCode = null;
      if (rawData.billingDetailsId === "") rawData.billingDetailsId = null;
      if (rawData.category === "") rawData.category = null;
      if (rawData.description === "") rawData.description = null;
      
      // Validate with Zod schema
      const validationResult = insertInstanceVatRateSchema.safeParse(rawData);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Validation failed", details: validationResult.error.flatten() });
      }
      
      const vatRate = await storage.createInstanceVatRate(validationResult.data);
      res.status(201).json(vatRate);
    } catch (error) {
      console.error("Error creating VAT rate:", error);
      res.status(500).json({ error: "Failed to create VAT rate" });
    }
  });

  app.patch("/api/instance-vat-rates/:id", requireAuth, async (req, res) => {
    try {
      // Preprocess data - convert empty strings to null for optional fields
      const rawData = parseDateFields(req.body);
      if (rawData.vatRate === "") rawData.vatRate = null;
      if (rawData.accountingCode === "") rawData.accountingCode = null;
      if (rawData.billingDetailsId === "") rawData.billingDetailsId = null;
      if (rawData.category === "") rawData.category = null;
      if (rawData.description === "") rawData.description = null;
      
      const vatRate = await storage.updateInstanceVatRate(req.params.id, rawData);
      if (!vatRate) {
        return res.status(404).json({ error: "VAT rate not found" });
      }
      res.json(vatRate);
    } catch (error) {
      console.error("Error updating VAT rate:", error);
      res.status(500).json({ error: "Failed to update VAT rate" });
    }
  });

  app.delete("/api/instance-vat-rates/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteInstanceVatRate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "VAT rate not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting VAT rate:", error);
      res.status(500).json({ error: "Failed to delete VAT rate" });
    }
  });

  // Market Product Services API
  app.get("/api/product-instances/:instanceId/services", requireAuth, async (req, res) => {
    try {
      const services = await storage.getMarketProductServices(req.params.instanceId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.post("/api/product-instances/:instanceId/services", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields({ ...req.body, instanceId: req.params.instanceId });
      const service = await storage.createMarketProductService(data);
      res.status(201).json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.patch("/api/product-services/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      const service = await storage.updateMarketProductService(req.params.id, data);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/product-services/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteMarketProductService(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // Customer Products API (protected)
  app.get("/api/customers/:customerId/products", requireAuth, async (req, res) => {
    try {
      const customerProducts = await storage.getCustomerProducts(req.params.customerId);
      res.json(customerProducts);
    } catch (error) {
      console.error("Error fetching customer products:", error);
      res.status(500).json({ error: "Failed to fetch customer products" });
    }
  });

  app.post("/api/customers/:customerId/products", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCustomerProductSchema.parse({
        ...req.body,
        customerId: req.params.customerId,
      });
      const customerProduct = await storage.addProductToCustomer(validatedData);
      res.status(201).json(customerProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error adding product to customer:", error);
      res.status(500).json({ error: "Failed to add product to customer" });
    }
  });

  app.delete("/api/customer-products/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.removeProductFromCustomer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing product from customer:", error);
      res.status(500).json({ error: "Failed to remove product from customer" });
    }
  });

  // Invoices API (protected)
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/customers/:customerId/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByCustomer(req.params.customerId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching customer invoices:", error);
      res.status(500).json({ error: "Failed to fetch customer invoices" });
    }
  });

  // Generate invoice for a single customer
  app.post("/api/customers/:customerId/invoices/generate", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const customerProducts = await storage.getCustomerProducts(req.params.customerId);
      if (customerProducts.length === 0) {
        return res.status(400).json({ error: "Customer has no products to invoice" });
      }

      const invoiceNumber = await storage.getNextInvoiceNumber();
      let totalAmount = 0;
      
      for (const cp of customerProducts) {
        const price = cp.priceOverride ? parseFloat(cp.priceOverride) : 0;
        totalAmount += price * cp.quantity;
      }

      // Get billing details for the customer's country
      const billingInfo = await storage.getBillingDetails(customer.country);
      const paymentTermDays = billingInfo?.defaultPaymentTerm || 14;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTermDays);

      const invoice = await storage.createInvoice({
        invoiceNumber,
        customerId: customer.id,
        totalAmount: totalAmount.toFixed(2),
        currency: "EUR",
        status: "generated",
        pdfPath: null,
        paymentTermDays,
        dueDate,
        billingCompanyName: billingInfo?.companyName || null,
        billingAddress: billingInfo?.address || null,
        billingCity: billingInfo?.city || null,
        billingTaxId: billingInfo?.taxId || null,
        billingBankName: billingInfo?.bankName || null,
        billingBankIban: billingInfo?.bankIban || null,
        billingBankSwift: billingInfo?.bankSwift || null,
      });

      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error generating invoice:", error);
      res.status(500).json({ error: "Failed to generate invoice" });
    }
  });

  // Generate PDF for an invoice
  app.get("/api/invoices/:id/pdf", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const invoiceItems = await storage.getInvoiceItems(invoice.id);
      const customerProducts = await storage.getCustomerProducts(invoice.customerId);

      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      
      doc.pipe(res);

      // Header with billing company info
      if (invoice.billingCompanyName) {
        doc.fontSize(18).font("Helvetica-Bold").text(invoice.billingCompanyName, { align: "left" });
        doc.fontSize(9).font("Helvetica");
        if (invoice.billingAddress) doc.text(invoice.billingAddress);
        if (invoice.billingCity) doc.text(invoice.billingCity);
        if (invoice.billingTaxId) doc.text(`Tax ID: ${invoice.billingTaxId}`);
        doc.moveDown();
        if (invoice.billingBankName) doc.text(`Bank: ${invoice.billingBankName}`);
        if (invoice.billingBankIban) doc.text(`IBAN: ${invoice.billingBankIban}`);
        if (invoice.billingBankSwift) doc.text(`SWIFT: ${invoice.billingBankSwift}`);
      } else {
        doc.fontSize(18).font("Helvetica-Bold").text("INDEXUS", { align: "left" });
        doc.fontSize(10).font("Helvetica").text("Cord Blood Banking Services");
      }
      doc.moveDown(2);

      // Invoice details
      doc.fontSize(16).font("Helvetica-Bold").text("INVOICE", { align: "left" });
      doc.fontSize(10).font("Helvetica");
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Issue Date: ${new Date(invoice.generatedAt).toLocaleDateString()}`);
      if (invoice.dueDate) {
        doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
        doc.text(`Payment Terms: ${invoice.paymentTermDays} days`);
      }
      doc.text(`Status: ${invoice.status.toUpperCase()}`);
      doc.moveDown();

      // Customer details
      doc.fontSize(12).font("Helvetica-Bold").text("Bill To:");
      doc.fontSize(10).font("Helvetica");
      doc.text(`${customer.firstName} ${customer.lastName}`);
      doc.text(customer.email);
      if (customer.address) doc.text(customer.address);
      if (customer.city) doc.text(customer.city);
      doc.text(customer.country);
      doc.moveDown(2);

      // Products table header
      doc.fontSize(10).font("Helvetica-Bold");
      const tableTop = doc.y;
      doc.text("Description", 50, tableTop, { width: 200 });
      doc.text("Qty", 250, tableTop, { width: 50, align: "center" });
      doc.text("Price", 300, tableTop, { width: 100, align: "right" });
      doc.text("Total", 400, tableTop, { width: 100, align: "right" });
      
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
      doc.moveDown();

      // Items - use invoice items if available, otherwise customer products
      doc.font("Helvetica");
      let subtotal = 0;
      
      if (invoiceItems.length > 0) {
        for (const item of invoiceItems) {
          const price = parseFloat(item.unitPrice);
          const lineTotal = parseFloat(item.lineTotal);
          subtotal += lineTotal;

          const y = doc.y;
          doc.text(item.description, 50, y, { width: 200 });
          doc.text(item.quantity.toString(), 250, y, { width: 50, align: "center" });
          doc.text(`${price.toFixed(2)} ${invoice.currency}`, 300, y, { width: 100, align: "right" });
          doc.text(`${lineTotal.toFixed(2)} ${invoice.currency}`, 400, y, { width: 100, align: "right" });
          doc.moveDown(0.5);
        }
      } else {
        for (const cp of customerProducts) {
          const price = cp.priceOverride ? parseFloat(cp.priceOverride) : 0;
          const lineTotal = price * cp.quantity;
          subtotal += lineTotal;

          const y = doc.y;
          doc.text(cp.product.name, 50, y, { width: 200 });
          doc.text(cp.quantity.toString(), 250, y, { width: 50, align: "center" });
          doc.text(`${price.toFixed(2)} EUR`, 300, y, { width: 100, align: "right" });
          doc.text(`${lineTotal.toFixed(2)} EUR`, 400, y, { width: 100, align: "right" });
          doc.moveDown(0.5);
        }
      }

      // Totals
      doc.moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).stroke();
      doc.moveDown();
      doc.fontSize(10).font("Helvetica");
      
      if (invoice.subtotal && invoice.vatRate && invoice.vatAmount) {
        doc.text(`Subtotal: ${parseFloat(invoice.subtotal).toFixed(2)} ${invoice.currency}`, { align: "right" });
        doc.text(`VAT (${parseFloat(invoice.vatRate).toFixed(0)}%): ${parseFloat(invoice.vatAmount).toFixed(2)} ${invoice.currency}`, { align: "right" });
        doc.moveDown(0.5);
      }
      
      doc.fontSize(12).font("Helvetica-Bold");
      doc.text(`Total: ${parseFloat(invoice.totalAmount).toFixed(2)} ${invoice.currency}`, { align: "right" });
      doc.moveDown(3);

      // Footer
      doc.fontSize(8).font("Helvetica").fillColor("gray");
      doc.text("Thank you for choosing INDEXUS for your cord blood banking needs.", { align: "center" });

      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Bulk invoice generation
  app.post("/api/invoices/bulk-generate", requireAuth, async (req, res) => {
    try {
      const { customerIds } = req.body as { customerIds: string[] };
      
      if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
        return res.status(400).json({ error: "Please provide an array of customer IDs" });
      }

      const results: { customerId: string; success: boolean; invoiceId?: string; error?: string }[] = [];

      for (const customerId of customerIds) {
        try {
          const customer = await storage.getCustomer(customerId);
          if (!customer) {
            results.push({ customerId, success: false, error: "Customer not found" });
            continue;
          }

          const customerProducts = await storage.getCustomerProducts(customerId);
          if (customerProducts.length === 0) {
            results.push({ customerId, success: false, error: "No products to invoice" });
            continue;
          }

          const invoiceNumber = await storage.getNextInvoiceNumber();
          let totalAmount = 0;
          
          for (const cp of customerProducts) {
            const price = cp.priceOverride ? parseFloat(cp.priceOverride) : 0;
            totalAmount += price * cp.quantity;
          }

          const billingInfo = await storage.getBillingDetails(customer.country);
          const paymentTermDays = billingInfo?.defaultPaymentTerm || 14;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + paymentTermDays);

          const invoice = await storage.createInvoice({
            invoiceNumber,
            customerId,
            totalAmount: totalAmount.toFixed(2),
            currency: "EUR",
            status: "generated",
            pdfPath: null,
            paymentTermDays,
            dueDate,
            billingCompanyName: billingInfo?.companyName || null,
            billingAddress: billingInfo?.address || null,
            billingCity: billingInfo?.city || null,
            billingTaxId: billingInfo?.taxId || null,
            billingBankName: billingInfo?.bankName || null,
            billingBankIban: billingInfo?.bankIban || null,
            billingBankSwift: billingInfo?.bankSwift || null,
          });

          results.push({ customerId, success: true, invoiceId: invoice.id });
        } catch (error) {
          results.push({ customerId, success: false, error: "Failed to generate invoice" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({ 
        message: `Generated ${successCount} of ${customerIds.length} invoices`,
        results 
      });
    } catch (error) {
      console.error("Error in bulk invoice generation:", error);
      res.status(500).json({ error: "Failed to generate invoices" });
    }
  });

  // Billing Details (Billing Companies) API (protected)
  app.get("/api/billing-details", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      const { country } = req.query;
      
      if (country && typeof country === 'string') {
        // Only allow access if user has access to this country
        if (!userCountries.includes(country)) {
          return res.json([]);
        }
        const details = await storage.getBillingDetailsByCountry(country);
        return res.json(details);
      }
      
      // Filter all billing details by user's assigned countries (check countryCodes array)
      const allDetails = await storage.getAllBillingDetails();
      const filteredDetails = allDetails.filter(d => {
        const billingCountries = d.countryCodes?.length ? d.countryCodes : [d.countryCode];
        return billingCountries.some(country => userCountries.includes(country));
      });
      res.json(filteredDetails);
    } catch (error) {
      console.error("Error fetching billing details:", error);
      res.status(500).json({ error: "Failed to fetch billing details" });
    }
  });

  app.get("/api/billing-details/:id", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      const param = req.params.id;
      
      // Try to get by ID first
      const details = await storage.getBillingDetailsById(param);
      if (!details) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      
      // Check if user has access to any of this billing company's countries
      const billingCountries = details.countryCodes?.length ? details.countryCodes : [details.countryCode];
      const hasAccess = billingCountries.some(country => userCountries.includes(country));
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(details);
    } catch (error) {
      console.error("Error fetching billing details:", error);
      res.status(500).json({ error: "Failed to fetch billing details" });
    }
  });

  app.post("/api/billing-details", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      const validatedData = insertBillingDetailsSchema.parse(req.body);
      
      // Normalize countryCodes - ensure it's populated
      const billingCountries = validatedData.countryCodes?.length 
        ? validatedData.countryCodes 
        : (validatedData.countryCode ? [validatedData.countryCode] : []);
      
      if (!billingCountries.length) {
        return res.status(400).json({ error: "At least one country must be selected" });
      }
      
      const hasAccess = billingCountries.every(country => userCountries.includes(country));
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied - you cannot create billing companies for these countries" });
      }
      
      // Normalize data: ensure countryCode is synchronized with first country in array
      const normalizedData = {
        ...validatedData,
        countryCodes: billingCountries,
        countryCode: billingCountries[0],
      };
      
      const details = await storage.createBillingDetails(normalizedData);
      res.status(201).json(details);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating billing company:", error);
      res.status(500).json({ error: "Failed to create billing company" });
    }
  });

  app.patch("/api/billing-details/:id", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      const userId = req.session.user?.id;
      
      // Check if user has access to this billing company's countries
      const existing = await storage.getBillingDetailsById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      const existingCountries = existing.countryCodes?.length ? existing.countryCodes : [existing.countryCode];
      const hasExistingAccess = existingCountries.some(country => userCountries.includes(country));
      if (!hasExistingAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Normalize the update payload
      let normalizedBody = { ...req.body };
      
      // If countryCodes is being updated, validate and normalize
      if ('countryCodes' in req.body) {
        const newCountries = Array.isArray(req.body.countryCodes) ? req.body.countryCodes : [];
        
        if (!newCountries.length) {
          return res.status(400).json({ error: "At least one country must be selected" });
        }
        
        const hasAccessToAll = newCountries.every(country => userCountries.includes(country));
        if (!hasAccessToAll) {
          return res.status(403).json({ error: "Access denied - you cannot assign countries you don't have access to" });
        }
        
        // Synchronize countryCode with first country
        normalizedBody.countryCodes = newCountries;
        normalizedBody.countryCode = newCountries[0];
      } else if ('countryCode' in req.body && req.body.countryCode !== existing.countryCode) {
        // If only countryCode is being updated (without countryCodes), validate access
        const newCountryCode = req.body.countryCode;
        if (!userCountries.includes(newCountryCode)) {
          return res.status(403).json({ error: "Access denied - you cannot assign a country you don't have access to" });
        }
        // Synchronize countryCodes with the new countryCode
        normalizedBody.countryCodes = [newCountryCode];
      }
      
      const details = await storage.updateBillingDetails(req.params.id, normalizedBody, userId);
      res.json(details);
    } catch (error) {
      console.error("Error updating billing company:", error);
      res.status(500).json({ error: "Failed to update billing company" });
    }
  });

  app.delete("/api/billing-details/:id", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      
      // Check if user has access to this billing company's countries
      const existing = await storage.getBillingDetailsById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      const existingCountries = existing.countryCodes?.length ? existing.countryCodes : [existing.countryCode];
      const hasAccess = existingCountries.some(country => userCountries.includes(country));
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const success = await storage.deleteBillingDetails(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting billing company:", error);
      res.status(500).json({ error: "Failed to delete billing company" });
    }
  });

  // Billing Company Accounts
  app.get("/api/billing-details/:id/accounts", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const accounts = await storage.getBillingCompanyAccounts(req.params.id);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching billing company accounts:", error);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.post("/api/billing-details/:id/accounts", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const account = await storage.createBillingCompanyAccount({
        ...req.body,
        billingDetailsId: req.params.id,
      });
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating billing company account:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.patch("/api/billing-company-accounts/:id", requireAuth, async (req, res) => {
    try {
      // Get the account first to find its billing company
      const existingAccount = await storage.getBillingCompanyAccountById(req.params.id);
      if (!existingAccount) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!await checkBillingCompanyAccess(req, res, existingAccount.billingDetailsId)) return;
      
      const account = await storage.updateBillingCompanyAccount(req.params.id, req.body);
      res.json(account);
    } catch (error) {
      console.error("Error updating billing company account:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.delete("/api/billing-company-accounts/:id", requireAuth, async (req, res) => {
    try {
      // Get the account first to find its billing company
      const existingAccount = await storage.getBillingCompanyAccountById(req.params.id);
      if (!existingAccount) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!await checkBillingCompanyAccess(req, res, existingAccount.billingDetailsId)) return;
      
      const success = await storage.deleteBillingCompanyAccount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting billing company account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.post("/api/billing-details/:id/accounts/:accountId/default", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      await storage.setDefaultBillingCompanyAccount(req.params.id, req.params.accountId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default account:", error);
      res.status(500).json({ error: "Failed to set default account" });
    }
  });

  // Billing Company Audit Log
  app.get("/api/billing-details/:id/audit-log", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const logs = await storage.getBillingCompanyAuditLog(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // Billing Company Laboratories
  app.get("/api/billing-details/:id/laboratories", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const labs = await storage.getBillingCompanyLaboratories(req.params.id);
      res.json(labs);
    } catch (error) {
      console.error("Error fetching laboratories:", error);
      res.status(500).json({ error: "Failed to fetch laboratories" });
    }
  });

  app.put("/api/billing-details/:id/laboratories", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const { laboratoryIds } = req.body as { laboratoryIds: string[] };
      await storage.setBillingCompanyLaboratories(req.params.id, laboratoryIds || []);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting laboratories:", error);
      res.status(500).json({ error: "Failed to set laboratories" });
    }
  });

  // Billing Company Collaborators
  app.get("/api/billing-details/:id/collaborators", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const collabs = await storage.getBillingCompanyCollaborators(req.params.id);
      res.json(collabs);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      res.status(500).json({ error: "Failed to fetch collaborators" });
    }
  });

  app.put("/api/billing-details/:id/collaborators", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const { collaboratorIds } = req.body as { collaboratorIds: string[] };
      await storage.setBillingCompanyCollaborators(req.params.id, collaboratorIds || []);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting collaborators:", error);
      res.status(500).json({ error: "Failed to set collaborators" });
    }
  });

  // Billing company couriers
  app.get("/api/billing-details/:id/couriers", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const couriers = await storage.getBillingCompanyCouriers(req.params.id);
      res.json(couriers);
    } catch (error) {
      console.error("Error fetching couriers:", error);
      res.status(500).json({ error: "Failed to fetch couriers" });
    }
  });

  app.post("/api/billing-details/:id/couriers", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const courier = await storage.createBillingCompanyCourier({
        ...req.body,
        billingDetailsId: req.params.id,
      });
      res.json(courier);
    } catch (error) {
      console.error("Error creating courier:", error);
      res.status(500).json({ error: "Failed to create courier" });
    }
  });

  app.patch("/api/billing-details/:billingId/couriers/:courierId", requireAuth, async (req, res) => {
    try {
      // Verify the courier exists and belongs to the specified billing company
      const existingCourier = await storage.getBillingCompanyCourierById(req.params.courierId);
      if (!existingCourier) {
        return res.status(404).json({ error: "Courier not found" });
      }
      if (existingCourier.billingDetailsId !== req.params.billingId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!await checkBillingCompanyAccess(req, res, existingCourier.billingDetailsId)) return;
      
      const courier = await storage.updateBillingCompanyCourier(req.params.courierId, req.body);
      res.json(courier);
    } catch (error) {
      console.error("Error updating courier:", error);
      res.status(500).json({ error: "Failed to update courier" });
    }
  });

  app.delete("/api/billing-details/:billingId/couriers/:courierId", requireAuth, async (req, res) => {
    try {
      // Verify the courier exists and belongs to the specified billing company
      const existingCourier = await storage.getBillingCompanyCourierById(req.params.courierId);
      if (!existingCourier) {
        return res.status(404).json({ error: "Courier not found" });
      }
      if (existingCourier.billingDetailsId !== req.params.billingId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!await checkBillingCompanyAccess(req, res, existingCourier.billingDetailsId)) return;
      
      const deleted = await storage.deleteBillingCompanyCourier(req.params.courierId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting courier:", error);
      res.status(500).json({ error: "Failed to delete courier" });
    }
  });

  // Legacy endpoint for backwards compatibility
  app.put("/api/billing-details/:countryCode", requireAuth, async (req, res) => {
    try {
      const validatedData = insertBillingDetailsSchema.parse({
        ...req.body,
        countryCode: req.params.countryCode,
      });
      const details = await storage.upsertBillingDetails(validatedData);
      res.json(details);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating billing details:", error);
      res.status(500).json({ error: "Failed to update billing details" });
    }
  });

  // Manual invoice creation with items
  app.post("/api/customers/:customerId/invoices/manual", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const { items, currency, paymentTermDays: requestedPaymentDays } = req.body as {
        items: Array<{ productId?: string; description: string; quantity: number; unitPrice: string }>;
        currency: string;
        paymentTermDays?: number;
      };

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "At least one item is required" });
      }

      // Get billing details for the customer's country
      const billingInfo = await storage.getBillingDetails(customer.country);
      const vatRate = billingInfo ? parseFloat(billingInfo.vatRate) : 0;
      const paymentTermDays = requestedPaymentDays || billingInfo?.defaultPaymentTerm || 14;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTermDays);

      // Calculate totals
      let subtotal = 0;
      const invoiceItems: Array<{ productId: string | null; description: string; quantity: number; unitPrice: string; lineTotal: string }> = [];

      for (const item of items) {
        const lineTotal = parseFloat(item.unitPrice) * item.quantity;
        subtotal += lineTotal;
        invoiceItems.push({
          productId: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: lineTotal.toFixed(2),
        });
      }

      const vatAmount = subtotal * (vatRate / 100);
      const totalAmount = subtotal + vatAmount;

      // Create invoice
      const invoiceNumber = await storage.getNextInvoiceNumber();
      const invoice = await storage.createInvoice({
        invoiceNumber,
        customerId: customer.id,
        subtotal: subtotal.toFixed(2),
        vatRate: vatRate.toString(),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: currency || billingInfo?.currency || "EUR",
        status: "generated",
        pdfPath: null,
        paymentTermDays,
        dueDate,
        billingCompanyName: billingInfo?.companyName || null,
        billingAddress: billingInfo?.address || null,
        billingCity: billingInfo?.city || null,
        billingTaxId: billingInfo?.taxId || null,
        billingBankName: billingInfo?.bankName || null,
        billingBankIban: billingInfo?.bankIban || null,
        billingBankSwift: billingInfo?.bankSwift || null,
      });

      // Create invoice items
      await storage.createInvoiceItems(
        invoiceItems.map(item => ({
          invoiceId: invoice.id,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        }))
      );

      res.status(201).json({ 
        invoice,
        subtotal: subtotal.toFixed(2),
        vatRate,
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      });
    } catch (error) {
      console.error("Error creating manual invoice:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Get invoice with items
  app.get("/api/invoices/:id/details", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const items = await storage.getInvoiceItems(invoice.id);
      const customer = await storage.getCustomer(invoice.customerId);
      const billingInfo = customer ? await storage.getBillingDetails(customer.country) : null;
      
      res.json({ invoice, items, customer, billingInfo });
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      res.status(500).json({ error: "Failed to fetch invoice details" });
    }
  });

  // Customer Notes API
  app.get("/api/customers/:customerId/notes", requireAuth, async (req, res) => {
    try {
      const notes = await storage.getCustomerNotes(req.params.customerId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching customer notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/customers/:customerId/notes", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Note content is required" });
      }

      const note = await storage.createCustomerNote({
        customerId: req.params.customerId,
        userId: req.session.user!.id,
        content,
      });

      // Log activity
      await logActivity(
        req.session.user!.id,
        "create_note",
        "customer",
        customer.id,
        `${customer.firstName} ${customer.lastName}`,
        { noteId: note.id },
        req.ip
      );

      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating customer note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.delete("/api/customers/:customerId/notes/:noteId", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCustomerNote(req.params.noteId);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  // Activity Logs API
  app.get("/api/activity-logs", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAllActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/users/:userId/activity-logs", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getActivityLogsByUser(req.params.userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user activity logs:", error);
      res.status(500).json({ error: "Failed to fetch user activity logs" });
    }
  });

  app.get("/api/customers/:customerId/activity-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getActivityLogsByEntity("customer", req.params.customerId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching customer activity logs:", error);
      res.status(500).json({ error: "Failed to fetch customer activity logs" });
    }
  });

  // Communication Messages API
  app.get("/api/customers/:customerId/messages", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getCommunicationMessagesByCustomer(req.params.customerId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching customer messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/customers/:customerId/messages/email", requireAuth, async (req, res) => {
    try {
      const parsed = sendEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      const { subject, content } = parsed.data;
      
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (!customer.email) {
        return res.status(400).json({ error: "Customer has no email address" });
      }

      const user = req.session.user!;
      
      // Create message record
      const message = await storage.createCommunicationMessage({
        customerId: req.params.customerId,
        userId: user.id,
        type: "email",
        subject,
        content,
        recipientEmail: customer.email,
        status: "pending",
      });

      // Try to send email via SendGrid or fallback to simulation
      const sendGridApiKey = process.env.SENDGRID_API_KEY;
      const fromEmail = process.env.EMAIL_FROM || "noreply@nexusbiolink.com";
      
      if (sendGridApiKey) {
        try {
          const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${sendGridApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: customer.email }] }],
              from: { email: fromEmail },
              subject,
              content: [{ type: "text/plain", value: content }],
            }),
          });

          if (response.ok) {
            await storage.updateCommunicationMessage(message.id, {
              status: "sent",
              sentAt: new Date(),
            });
            
            await logActivity(user.id, "send_email", "communication", message.id, 
              `Email to ${customer.firstName} ${customer.lastName}`, { subject });
            
            return res.json({ ...message, status: "sent", sentAt: new Date() });
          } else {
            const errorText = await response.text();
            await storage.updateCommunicationMessage(message.id, {
              status: "failed",
              errorMessage: errorText,
            });
            return res.status(500).json({ error: "Failed to send email", details: errorText });
          }
        } catch (emailError: any) {
          await storage.updateCommunicationMessage(message.id, {
            status: "failed",
            errorMessage: emailError.message,
          });
          return res.status(500).json({ error: "Failed to send email", details: emailError.message });
        }
      } else {
        // Simulate sending (for demo purposes when no API key configured)
        await storage.updateCommunicationMessage(message.id, {
          status: "sent",
          sentAt: new Date(),
        });
        
        await logActivity(user.id, "send_email", "communication", message.id, 
          `Email to ${customer.firstName} ${customer.lastName}`, { subject, simulated: true });
        
        res.json({ ...message, status: "sent", sentAt: new Date(), simulated: true });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/customers/:customerId/messages/sms", requireAuth, async (req, res) => {
    try {
      const parsed = sendSmsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      const { content } = parsed.data;
      
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (!customer.phone) {
        return res.status(400).json({ error: "Customer has no phone number" });
      }

      const user = req.session.user!;
      
      // Create message record
      const message = await storage.createCommunicationMessage({
        customerId: req.params.customerId,
        userId: user.id,
        type: "sms",
        content,
        recipientPhone: customer.phone,
        status: "pending",
      });

      // Try to send SMS via Twilio or fallback to simulation
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
      
      if (twilioSid && twilioToken && twilioPhone) {
        try {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: customer.phone,
                From: twilioPhone,
                Body: content,
              }),
            }
          );

          if (response.ok) {
            await storage.updateCommunicationMessage(message.id, {
              status: "sent",
              sentAt: new Date(),
            });
            
            await logActivity(user.id, "send_sms", "communication", message.id, 
              `SMS to ${customer.firstName} ${customer.lastName}`);
            
            return res.json({ ...message, status: "sent", sentAt: new Date() });
          } else {
            const errorData = await response.json();
            await storage.updateCommunicationMessage(message.id, {
              status: "failed",
              errorMessage: errorData.message || "Twilio error",
            });
            return res.status(500).json({ error: "Failed to send SMS", details: errorData.message });
          }
        } catch (smsError: any) {
          await storage.updateCommunicationMessage(message.id, {
            status: "failed",
            errorMessage: smsError.message,
          });
          return res.status(500).json({ error: "Failed to send SMS", details: smsError.message });
        }
      } else {
        // Simulate sending (for demo purposes when no credentials configured)
        await storage.updateCommunicationMessage(message.id, {
          status: "sent",
          sentAt: new Date(),
        });
        
        await logActivity(user.id, "send_sms", "communication", message.id, 
          `SMS to ${customer.firstName} ${customer.lastName}`, { simulated: true });
        
        res.json({ ...message, status: "sent", sentAt: new Date(), simulated: true });
      }
    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  app.get("/api/communication-messages", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const messages = await storage.getAllCommunicationMessages(limit);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching communication messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // ========== CONFIGURATION TABLES ==========

  // Complaint Types
  app.get("/api/config/complaint-types", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const types = countryCode 
        ? await storage.getComplaintTypesByCountry(countryCode)
        : await storage.getAllComplaintTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch complaint types" });
    }
  });

  app.post("/api/config/complaint-types", requireAuth, async (req, res) => {
    try {
      const parsed = insertComplaintTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const type = await storage.createComplaintType(parsed.data);
      await logActivity(req.session.user!.id, "create", "complaint_type", type.id, type.name);
      res.status(201).json(type);
    } catch (error) {
      res.status(500).json({ error: "Failed to create complaint type" });
    }
  });

  app.put("/api/config/complaint-types/:id", requireAuth, async (req, res) => {
    try {
      const type = await storage.updateComplaintType(req.params.id, req.body);
      if (!type) return res.status(404).json({ error: "Complaint type not found" });
      await logActivity(req.session.user!.id, "update", "complaint_type", type.id, type.name);
      res.json(type);
    } catch (error) {
      res.status(500).json({ error: "Failed to update complaint type" });
    }
  });

  app.delete("/api/config/complaint-types/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteComplaintType(req.params.id);
      if (!success) return res.status(404).json({ error: "Complaint type not found" });
      await logActivity(req.session.user!.id, "delete", "complaint_type", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete complaint type" });
    }
  });

  // Cooperation Types
  app.get("/api/config/cooperation-types", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const types = countryCode 
        ? await storage.getCooperationTypesByCountry(countryCode)
        : await storage.getAllCooperationTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cooperation types" });
    }
  });

  app.post("/api/config/cooperation-types", requireAuth, async (req, res) => {
    try {
      const parsed = insertCooperationTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const type = await storage.createCooperationType(parsed.data);
      await logActivity(req.session.user!.id, "create", "cooperation_type", type.id, type.name);
      res.status(201).json(type);
    } catch (error) {
      res.status(500).json({ error: "Failed to create cooperation type" });
    }
  });

  app.put("/api/config/cooperation-types/:id", requireAuth, async (req, res) => {
    try {
      const type = await storage.updateCooperationType(req.params.id, req.body);
      if (!type) return res.status(404).json({ error: "Cooperation type not found" });
      await logActivity(req.session.user!.id, "update", "cooperation_type", type.id, type.name);
      res.json(type);
    } catch (error) {
      res.status(500).json({ error: "Failed to update cooperation type" });
    }
  });

  app.delete("/api/config/cooperation-types/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteCooperationType(req.params.id);
      if (!success) return res.status(404).json({ error: "Cooperation type not found" });
      await logActivity(req.session.user!.id, "delete", "cooperation_type", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete cooperation type" });
    }
  });

  // VIP Statuses
  app.get("/api/config/vip-statuses", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const statuses = countryCode 
        ? await storage.getVipStatusesByCountry(countryCode)
        : await storage.getAllVipStatuses();
      res.json(statuses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch VIP statuses" });
    }
  });

  app.post("/api/config/vip-statuses", requireAuth, async (req, res) => {
    try {
      const parsed = insertVipStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const status = await storage.createVipStatus(parsed.data);
      await logActivity(req.session.user!.id, "create", "vip_status", status.id, status.name);
      res.status(201).json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to create VIP status" });
    }
  });

  app.put("/api/config/vip-statuses/:id", requireAuth, async (req, res) => {
    try {
      const status = await storage.updateVipStatus(req.params.id, req.body);
      if (!status) return res.status(404).json({ error: "VIP status not found" });
      await logActivity(req.session.user!.id, "update", "vip_status", status.id, status.name);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to update VIP status" });
    }
  });

  app.delete("/api/config/vip-statuses/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteVipStatus(req.params.id);
      if (!success) return res.status(404).json({ error: "VIP status not found" });
      await logActivity(req.session.user!.id, "delete", "vip_status", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete VIP status" });
    }
  });

  // Health Insurance Companies
  app.get("/api/config/health-insurance", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string;
      const companies = countryCode 
        ? await storage.getHealthInsuranceByCountry(countryCode)
        : await storage.getAllHealthInsuranceCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch health insurance companies" });
    }
  });

  app.post("/api/config/health-insurance", requireAuth, async (req, res) => {
    try {
      const parsed = insertHealthInsuranceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const company = await storage.createHealthInsurance(parsed.data);
      await logActivity(req.session.user!.id, "create", "health_insurance", company.id, company.name);
      res.status(201).json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to create health insurance company" });
    }
  });

  app.put("/api/config/health-insurance/:id", requireAuth, async (req, res) => {
    try {
      const company = await storage.updateHealthInsurance(req.params.id, req.body);
      if (!company) return res.status(404).json({ error: "Health insurance company not found" });
      await logActivity(req.session.user!.id, "update", "health_insurance", company.id, company.name);
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to update health insurance company" });
    }
  });

  app.patch("/api/config/health-insurance/:id", requireAuth, async (req, res) => {
    try {
      const company = await storage.updateHealthInsurance(req.params.id, req.body);
      if (!company) return res.status(404).json({ error: "Health insurance company not found" });
      await logActivity(req.session.user!.id, "update", "health_insurance", company.id, company.name);
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to update health insurance company" });
    }
  });

  app.delete("/api/config/health-insurance/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteHealthInsurance(req.params.id);
      if (!success) return res.status(404).json({ error: "Health insurance company not found" });
      await logActivity(req.session.user!.id, "delete", "health_insurance", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete health insurance company" });
    }
  });

  // Laboratories
  app.get("/api/config/laboratories", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string;
      const laboratories = countryCode 
        ? await storage.getLaboratoriesByCountry(countryCode)
        : await storage.getAllLaboratories();
      res.json(laboratories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch laboratories" });
    }
  });

  app.post("/api/config/laboratories", requireAuth, async (req, res) => {
    try {
      const parsed = insertLaboratorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const laboratory = await storage.createLaboratory(parsed.data);
      await logActivity(req.session.user!.id, "create", "laboratory", laboratory.id, laboratory.name);
      res.status(201).json(laboratory);
    } catch (error) {
      res.status(500).json({ error: "Failed to create laboratory" });
    }
  });

  app.put("/api/config/laboratories/:id", requireAuth, async (req, res) => {
    try {
      const laboratory = await storage.updateLaboratory(req.params.id, req.body);
      if (!laboratory) return res.status(404).json({ error: "Laboratory not found" });
      await logActivity(req.session.user!.id, "update", "laboratory", laboratory.id, laboratory.name);
      res.json(laboratory);
    } catch (error) {
      res.status(500).json({ error: "Failed to update laboratory" });
    }
  });

  app.patch("/api/config/laboratories/:id", requireAuth, async (req, res) => {
    try {
      const laboratory = await storage.updateLaboratory(req.params.id, req.body);
      if (!laboratory) return res.status(404).json({ error: "Laboratory not found" });
      await logActivity(req.session.user!.id, "update", "laboratory", laboratory.id, laboratory.name);
      res.json(laboratory);
    } catch (error) {
      res.status(500).json({ error: "Failed to update laboratory" });
    }
  });

  app.delete("/api/config/laboratories/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteLaboratory(req.params.id);
      if (!success) return res.status(404).json({ error: "Laboratory not found" });
      await logActivity(req.session.user!.id, "delete", "laboratory", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete laboratory" });
    }
  });

  // Hospitals
  app.get("/api/hospitals", requireAuth, async (req, res) => {
    try {
      const countryCodes = req.query.countries as string;
      const hospitals = countryCodes 
        ? await storage.getHospitalsByCountry(countryCodes.split(","))
        : await storage.getAllHospitals();
      res.json(hospitals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  app.get("/api/hospitals/:id", requireAuth, async (req, res) => {
    try {
      const hospital = await storage.getHospital(req.params.id);
      if (!hospital) return res.status(404).json({ error: "Hospital not found" });
      res.json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hospital" });
    }
  });

  app.post("/api/hospitals", requireAuth, async (req, res) => {
    try {
      const parsed = insertHospitalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const hospital = await storage.createHospital(parsed.data);
      await logActivity(req.session.user!.id, "create", "hospital", hospital.id, hospital.name);
      res.status(201).json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to create hospital" });
    }
  });

  app.put("/api/hospitals/:id", requireAuth, async (req, res) => {
    try {
      const hospital = await storage.updateHospital(req.params.id, req.body);
      if (!hospital) return res.status(404).json({ error: "Hospital not found" });
      await logActivity(req.session.user!.id, "update", "hospital", hospital.id, hospital.name);
      res.json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to update hospital" });
    }
  });

  app.delete("/api/hospitals/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteHospital(req.params.id);
      if (!success) return res.status(404).json({ error: "Hospital not found" });
      await logActivity(req.session.user!.id, "delete", "hospital", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete hospital" });
    }
  });

  // Collaborators routes
  app.get("/api/collaborators", requireAuth, async (req, res) => {
    try {
      const countryCodes = req.query.countries ? String(req.query.countries).split(",") : undefined;
      const collaborators = countryCodes 
        ? await storage.getCollaboratorsByCountry(countryCodes)
        : await storage.getAllCollaborators();
      res.json(collaborators);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collaborators" });
    }
  });

  app.get("/api/collaborators/:id", requireAuth, async (req, res) => {
    try {
      const collaborator = await storage.getCollaborator(req.params.id);
      if (!collaborator) return res.status(404).json({ error: "Collaborator not found" });
      res.json(collaborator);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collaborator" });
    }
  });

  app.post("/api/collaborators", requireAuth, async (req, res) => {
    try {
      const parsed = insertCollaboratorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const collaborator = await storage.createCollaborator(parsed.data);
      await logActivity(req.session.user!.id, "create", "collaborator", collaborator.id, `${collaborator.firstName} ${collaborator.lastName}`);
      res.status(201).json(collaborator);
    } catch (error) {
      res.status(500).json({ error: "Failed to create collaborator" });
    }
  });

  app.put("/api/collaborators/:id", requireAuth, async (req, res) => {
    try {
      const collaborator = await storage.updateCollaborator(req.params.id, req.body);
      if (!collaborator) return res.status(404).json({ error: "Collaborator not found" });
      await logActivity(req.session.user!.id, "update", "collaborator", collaborator.id, `${collaborator.firstName} ${collaborator.lastName}`);
      res.json(collaborator);
    } catch (error) {
      res.status(500).json({ error: "Failed to update collaborator" });
    }
  });

  app.delete("/api/collaborators/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteCollaborator(req.params.id);
      if (!success) return res.status(404).json({ error: "Collaborator not found" });
      await logActivity(req.session.user!.id, "delete", "collaborator", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete collaborator" });
    }
  });

  // Collaborator Addresses routes
  app.get("/api/collaborators/:id/addresses", requireAuth, async (req, res) => {
    try {
      const addresses = await storage.getCollaboratorAddresses(req.params.id);
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch addresses" });
    }
  });

  app.put("/api/collaborators/:id/addresses/:type", requireAuth, async (req, res) => {
    try {
      const parsed = insertCollaboratorAddressSchema.safeParse({
        ...req.body,
        collaboratorId: req.params.id,
        addressType: req.params.type
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const address = await storage.upsertCollaboratorAddress(parsed.data);
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "update_address", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { addressType: req.params.type }
      );
      res.json(address);
    } catch (error) {
      res.status(500).json({ error: "Failed to save address" });
    }
  });

  // Collaborator Other Data routes
  app.get("/api/collaborators/:id/other-data", requireAuth, async (req, res) => {
    try {
      const data = await storage.getCollaboratorOtherData(req.params.id);
      res.json(data || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch other data" });
    }
  });

  app.put("/api/collaborators/:id/other-data", requireAuth, async (req, res) => {
    try {
      const parsed = insertCollaboratorOtherDataSchema.safeParse({
        ...req.body,
        collaboratorId: req.params.id
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const data = await storage.upsertCollaboratorOtherData(parsed.data);
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "update_other_data", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : ""
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to save other data" });
    }
  });

  // Collaborator Agreements routes
  app.get("/api/collaborators/:id/agreements", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getCollaboratorAgreements(req.params.id);
      res.json(agreements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agreements" });
    }
  });

  app.post("/api/collaborators/:id/agreements", requireAuth, async (req, res) => {
    try {
      const parsed = insertCollaboratorAgreementSchema.safeParse({
        ...req.body,
        collaboratorId: req.params.id
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const agreement = await storage.createCollaboratorAgreement(parsed.data);
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "create_agreement", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { billingCompany: req.body.billingCompanyId, contractNumber: req.body.contractNumber }
      );
      res.status(201).json(agreement);
    } catch (error) {
      res.status(500).json({ error: "Failed to create agreement" });
    }
  });

  app.put("/api/collaborators/:id/agreements/:agreementId", requireAuth, async (req, res) => {
    try {
      const agreement = await storage.updateCollaboratorAgreement(req.params.agreementId, req.body);
      if (!agreement) return res.status(404).json({ error: "Agreement not found" });
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "update_agreement", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { agreementId: req.params.agreementId }
      );
      res.json(agreement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update agreement" });
    }
  });

  app.delete("/api/collaborators/:id/agreements/:agreementId", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteCollaboratorAgreement(req.params.agreementId);
      if (!success) return res.status(404).json({ error: "Agreement not found" });
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "delete_agreement", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { agreementId: req.params.agreementId }
      );
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete agreement" });
    }
  });

  // Get activity logs for a specific collaborator
  app.get("/api/collaborators/:id/activity-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getActivityLogsByEntity("collaborator", req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // File upload for agreements
  app.post("/api/collaborators/:id/agreements/:agreementId/upload", requireAuth, uploadAgreement.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname;
      const fileSize = req.file.size;
      const fileContentType = req.file.mimetype;

      // Extract text from PDF if applicable
      let extractedText = "";
      if (fileContentType === "application/pdf") {
        extractedText = await extractPdfText(filePath);
      }

      // Update agreement with file info
      const agreement = await storage.updateCollaboratorAgreement(req.params.agreementId, {
        fileName,
        filePath,
        fileSize,
        fileContentType,
        extractedText,
      });

      if (!agreement) {
        // Clean up uploaded file if agreement not found
        fs.unlinkSync(filePath);
        return res.status(404).json({ error: "Agreement not found" });
      }

      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "upload_file", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { fileName, agreementId: req.params.agreementId }
      );

      res.json(agreement);
    } catch (error) {
      console.error("File upload failed:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Invoice image upload endpoint
  app.post("/api/upload/invoice-image", requireAuth, uploadInvoiceImage.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const imageUrl = `/uploads/invoice-images/${req.file.filename}`;
      
      await logActivity(
        req.session.user!.id,
        "upload_invoice_image",
        "invoice",
        undefined,
        req.file.originalname
      );

      res.json({ 
        imageUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });
    } catch (error) {
      console.error("Invoice image upload failed:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Download/view agreement file
  app.get("/api/collaborators/:id/agreements/:agreementId/file", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getCollaboratorAgreements(req.params.id);
      const agreement = agreements.find(a => a.id === req.params.agreementId);
      
      if (!agreement || !agreement.filePath) {
        return res.status(404).json({ error: "File not found" });
      }

      if (!fs.existsSync(agreement.filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      const contentType = agreement.fileContentType || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${agreement.fileName}"`);
      
      const fileStream = fs.createReadStream(agreement.filePath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Download agreement file (force download)
  app.get("/api/collaborators/:id/agreements/:agreementId/download", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getCollaboratorAgreements(req.params.id);
      const agreement = agreements.find(a => a.id === req.params.agreementId);
      
      if (!agreement || !agreement.filePath) {
        return res.status(404).json({ error: "File not found" });
      }

      if (!fs.existsSync(agreement.filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.download(agreement.filePath, agreement.fileName || "agreement.pdf");
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Customer Potential Cases
  app.get("/api/customers/:id/potential-case", requireAuth, async (req, res) => {
    try {
      const data = await storage.getCustomerPotentialCase(req.params.id);
      res.json(data || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch potential case" });
    }
  });

  app.post("/api/customers/:id/potential-case", requireAuth, async (req, res) => {
    try {
      const customerId = req.params.id;
      const caseData = {
        ...req.body,
        customerId,
      };
      
      const data = await storage.upsertCustomerPotentialCase(caseData);
      
      // If case status is set (not empty), automatically update customer's clientStatus to "acquired" and status to "active"
      if (caseData.caseStatus && caseData.caseStatus.trim() !== "") {
        await storage.updateCustomer(customerId, { clientStatus: "acquired", status: "active" });
      }
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to save potential case" });
    }
  });

  // Global search endpoint - searches across all modules and files
  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const query = String(req.query.q || "").toLowerCase().trim();
      if (!query || query.length < 2) {
        return res.json({ results: [] });
      }

      const results: { type: string; id: string; title: string; subtitle: string; url: string }[] = [];

      // Search customers
      const customers = await storage.getAllCustomers();
      for (const c of customers) {
        const searchText = `${c.firstName} ${c.lastName} ${c.email || ""} ${c.phone || ""} ${c.mobile || ""} ${c.internalId || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "customer",
            id: c.id,
            title: `${c.firstName} ${c.lastName}`,
            subtitle: c.internalId ? `${c.internalId} - ${c.email || c.phone || ""}` : (c.email || c.phone || ""),
            url: `/customers?id=${c.id}`,
          });
        }
      }

      // Search collaborators
      const collaborators = await storage.getAllCollaborators();
      for (const c of collaborators) {
        const searchText = `${c.firstName} ${c.lastName} ${c.email || ""} ${c.phone || ""} ${c.mobile || ""} ${c.legacyId || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "collaborator",
            id: c.id,
            title: `${c.firstName} ${c.lastName}`,
            subtitle: c.legacyId ? `${c.legacyId} - ${c.email || c.phone || ""}` : (c.email || c.phone || ""),
            url: `/collaborators?id=${c.id}`,
          });
        }
      }

      // Search users
      const users = await storage.getAllUsers();
      for (const u of users) {
        const searchText = `${u.fullName} ${u.email || ""} ${u.username}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "user",
            id: u.id,
            title: u.fullName,
            subtitle: u.email || u.username,
            url: `/users?id=${u.id}`,
          });
        }
      }

      // Search products
      const products = await storage.getAllProducts();
      for (const p of products) {
        const searchText = `${p.name} ${p.description || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "product",
            id: p.id,
            title: p.name,
            subtitle: p.description || "",
            url: `/products?id=${p.id}`,
          });
        }
      }

      // Search invoices
      const invoices = await storage.getAllInvoices();
      for (const inv of invoices) {
        const searchText = `${inv.invoiceNumber} ${inv.billingCompanyName || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          const customer = customers.find(c => c.id === inv.customerId);
          results.push({
            type: "invoice",
            id: inv.id,
            title: inv.invoiceNumber,
            subtitle: customer ? `${customer.firstName} ${customer.lastName}` : "",
            url: `/invoices?id=${inv.id}`,
          });
        }
      }

      // Search agreement files (extracted text)
      const agreements = await storage.getAllCollaboratorAgreements();
      for (const a of agreements) {
        if (a.extractedText && a.extractedText.toLowerCase().includes(query)) {
          const collaborator = collaborators.find(c => c.id === a.collaboratorId);
          results.push({
            type: "agreement",
            id: a.id,
            title: a.fileName || "Agreement",
            subtitle: collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
            url: `/collaborators?id=${a.collaboratorId}&tab=agreements`,
          });
        }
      }

      // Search hospitals
      const hospitals = await storage.getAllHospitals();
      for (const h of hospitals) {
        const searchText = `${h.name} ${h.fullName || ""} ${h.city || ""} ${h.streetNumber || ""} ${h.legacyId || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "hospital",
            id: h.id,
            title: h.name,
            subtitle: h.city || h.countryCode || "",
            url: `/hospitals?id=${h.id}`,
          });
        }
      }

      // Search health insurance companies
      const healthInsurances = await storage.getAllHealthInsuranceCompanies();
      for (const hi of healthInsurances) {
        const searchText = `${hi.name}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "healthInsurance",
            id: hi.id,
            title: hi.name,
            subtitle: hi.countryCode || "",
            url: `/settings`,
          });
        }
      }

      // Search laboratories
      const laboratories = await storage.getAllLaboratories();
      for (const lab of laboratories) {
        const searchText = `${lab.name}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "laboratory",
            id: lab.id,
            title: lab.name,
            subtitle: lab.countryCode || "",
            url: `/settings`,
          });
        }
      }

      // Search billing companies
      const billingDetails = await storage.getAllBillingDetails();
      for (const bd of billingDetails) {
        const searchText = `${bd.companyName} ${bd.address || ""} ${bd.taxId || ""} ${bd.bankIban || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "billingCompany",
            id: bd.id,
            title: bd.companyName,
            subtitle: bd.countryCode || "",
            url: `/settings`,
          });
        }
      }

      // Search customer notes
      const notes = await storage.getAllCustomerNotes();
      for (const n of notes) {
        if (n.content && n.content.toLowerCase().includes(query)) {
          const customer = customers.find(c => c.id === n.customerId);
          results.push({
            type: "note",
            id: n.id,
            title: n.content.substring(0, 50) + (n.content.length > 50 ? "..." : ""),
            subtitle: customer ? `${customer.firstName} ${customer.lastName}` : "",
            url: `/customers?id=${n.customerId}`,
          });
        }
      }

      res.json({ results: results.slice(0, 50) }); // Limit to 50 results
    } catch (error) {
      console.error("Global search failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // ============= Saved Searches Routes =============
  
  app.get("/api/saved-searches", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const module = req.query.module as string | undefined;
      const searches = await storage.getSavedSearchesByUser(userId, module);
      res.json(searches);
    } catch (error) {
      console.error("Failed to fetch saved searches:", error);
      res.status(500).json({ error: "Failed to fetch saved searches" });
    }
  });

  app.post("/api/saved-searches", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const validatedData = insertSavedSearchSchema.parse({
        ...req.body,
        userId,
      });
      
      const search = await storage.createSavedSearch(validatedData);
      res.status(201).json(search);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Failed to create saved search:", error);
      res.status(500).json({ error: "Failed to create saved search" });
    }
  });

  app.delete("/api/saved-searches/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user!.id;
      
      // Verify ownership before deleting
      const deleted = await storage.deleteSavedSearchForUser(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Saved search not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete saved search:", error);
      res.status(500).json({ error: "Failed to delete saved search" });
    }
  });

  // ============= Lead Scoring Criteria Routes =============
  
  // Get all lead scoring criteria
  app.get("/api/lead-scoring-criteria", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      let criteria: LeadScoringCriteria[];
      
      if (countryCode) {
        criteria = await storage.getLeadScoringCriteriaByCountry(countryCode);
      } else {
        criteria = await storage.getAllLeadScoringCriteria();
      }
      
      res.json(criteria);
    } catch (error) {
      console.error("Failed to fetch lead scoring criteria:", error);
      res.status(500).json({ error: "Failed to fetch lead scoring criteria" });
    }
  });

  // Create lead scoring criteria
  app.post("/api/lead-scoring-criteria", requireAuth, async (req, res) => {
    try {
      const validatedData = insertLeadScoringCriteriaSchema.parse(req.body);
      const criteria = await storage.createLeadScoringCriteria(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created",
        "leadScoringCriteria",
        criteria.id,
        criteria.name,
        { category: criteria.category, points: criteria.points },
        req.ip
      );
      
      res.status(201).json(criteria);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Failed to create lead scoring criteria:", error);
      res.status(500).json({ error: "Failed to create lead scoring criteria" });
    }
  });

  // Update lead scoring criteria
  app.patch("/api/lead-scoring-criteria/:id", requireAuth, async (req, res) => {
    try {
      const criteria = await storage.updateLeadScoringCriteria(req.params.id, req.body);
      if (!criteria) {
        return res.status(404).json({ error: "Criteria not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "updated",
        "leadScoringCriteria",
        criteria.id,
        criteria.name,
        undefined,
        req.ip
      );
      
      res.json(criteria);
    } catch (error) {
      console.error("Failed to update lead scoring criteria:", error);
      res.status(500).json({ error: "Failed to update lead scoring criteria" });
    }
  });

  // Delete lead scoring criteria
  app.delete("/api/lead-scoring-criteria/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteLeadScoringCriteria(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Criteria not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "deleted",
        "leadScoringCriteria",
        req.params.id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete lead scoring criteria:", error);
      res.status(500).json({ error: "Failed to delete lead scoring criteria" });
    }
  });

  // Calculate lead score for a customer
  app.post("/api/customers/:id/calculate-lead-score", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Get potential case for this customer
      const potentialCase = await storage.getCustomerPotentialCase(req.params.id);
      
      // Get applicable criteria (global + country-specific)
      const criteria = await storage.getLeadScoringCriteriaByCountry(customer.country);
      const activeCriteria = criteria.filter(c => c.isActive);

      let totalScore = 0;
      const appliedCriteria: { name: string; points: number }[] = [];

      for (const criterion of activeCriteria) {
        let conditionMet = false;
        let fieldValue: any = null;

        // Evaluate the field value based on criterion.field
        switch (criterion.field) {
          case "hasPhone":
            fieldValue = !!(customer.phone || customer.mobile || customer.mobile2);
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasEmail":
            fieldValue = !!customer.email;
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasAddress":
            fieldValue = !!(customer.address && customer.city);
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasCase":
            fieldValue = !!potentialCase;
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "newsletterOptIn":
            fieldValue = potentialCase?.newsletterOptIn || customer.newsletter;
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "caseStatus":
            if (potentialCase) {
              fieldValue = potentialCase.caseStatus;
              conditionMet = criterion.condition === "equals" && fieldValue === criterion.value;
            }
            break;
          case "hasExpectedDate":
            fieldValue = !!(potentialCase?.expectedDateMonth && potentialCase?.expectedDateYear);
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasFatherInfo":
            fieldValue = !!(potentialCase?.fatherFirstName && potentialCase?.fatherLastName);
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasProduct":
            fieldValue = !!potentialCase?.productId;
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "clientStatus":
            fieldValue = customer.clientStatus;
            conditionMet = criterion.condition === "equals" && fieldValue === criterion.value;
            break;
          case "daysFromCreation":
            if (customer.createdAt) {
              const daysSinceCreation = Math.floor((Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              fieldValue = daysSinceCreation;
              if (criterion.condition === "less_than") {
                conditionMet = daysSinceCreation < parseInt(criterion.value || "0");
              } else if (criterion.condition === "greater_than") {
                conditionMet = daysSinceCreation > parseInt(criterion.value || "0");
              }
            }
            break;
          default:
            // Check if it's a direct customer field
            if (criterion.field in customer) {
              fieldValue = (customer as any)[criterion.field];
              if (criterion.condition === "not_empty") {
                conditionMet = !!fieldValue;
              } else if (criterion.condition === "equals") {
                conditionMet = fieldValue === criterion.value;
              } else if (criterion.condition === "contains" && typeof fieldValue === "string") {
                conditionMet = fieldValue.toLowerCase().includes((criterion.value || "").toLowerCase());
              }
            }
        }

        if (conditionMet) {
          totalScore += criterion.points;
          appliedCriteria.push({ name: criterion.name, points: criterion.points });
        }
      }

      // Normalize score to 0-100 range
      totalScore = Math.max(0, Math.min(100, totalScore));

      // Determine lead status based on score
      let leadStatus = "cold";
      if (totalScore >= 75) {
        leadStatus = "qualified";
      } else if (totalScore >= 50) {
        leadStatus = "hot";
      } else if (totalScore >= 25) {
        leadStatus = "warm";
      }

      // Update customer with new lead score
      const updatedCustomer = await storage.updateCustomerLeadScore(customer.id, totalScore, leadStatus);

      await logActivity(
        req.session.user!.id,
        "calculated_lead_score",
        "customer",
        customer.id,
        `${customer.firstName} ${customer.lastName}`,
        { score: totalScore, status: leadStatus, appliedCriteria },
        req.ip
      );

      res.json({
        score: totalScore,
        status: leadStatus,
        appliedCriteria,
        customer: updatedCustomer
      });
    } catch (error) {
      console.error("Failed to calculate lead score:", error);
      res.status(500).json({ error: "Failed to calculate lead score" });
    }
  });

  // Bulk recalculate lead scores for all customers
  app.post("/api/lead-scoring/recalculate-all", requireAuth, async (req, res) => {
    try {
      const allCustomers = await storage.getAllCustomers();
      const potentialCustomers = allCustomers.filter(c => c.clientStatus === "potential");
      
      let updated = 0;
      const criteria = await storage.getAllLeadScoringCriteria();
      const activeCriteria = criteria.filter(c => c.isActive);

      for (const customer of potentialCustomers) {
        const potentialCase = await storage.getCustomerPotentialCase(customer.id);
        const applicableCriteria = activeCriteria.filter(
          c => !c.countryCode || c.countryCode === customer.country
        );

        let totalScore = 0;

        for (const criterion of applicableCriteria) {
          let conditionMet = false;

          switch (criterion.field) {
            case "hasPhone":
              conditionMet = !!(customer.phone || customer.mobile || customer.mobile2) === (criterion.value === "true");
              break;
            case "hasEmail":
              conditionMet = !!customer.email === (criterion.value === "true");
              break;
            case "hasAddress":
              conditionMet = !!(customer.address && customer.city) === (criterion.value === "true");
              break;
            case "hasCase":
              conditionMet = !!potentialCase === (criterion.value === "true");
              break;
            case "newsletterOptIn":
              conditionMet = (potentialCase?.newsletterOptIn || customer.newsletter) === (criterion.value === "true");
              break;
            case "caseStatus":
              if (potentialCase && criterion.condition === "equals") {
                conditionMet = potentialCase.caseStatus === criterion.value;
              }
              break;
            case "hasExpectedDate":
              conditionMet = !!(potentialCase?.expectedDateMonth && potentialCase?.expectedDateYear) === (criterion.value === "true");
              break;
            case "hasFatherInfo":
              conditionMet = !!(potentialCase?.fatherFirstName && potentialCase?.fatherLastName) === (criterion.value === "true");
              break;
            case "hasProduct":
              conditionMet = !!potentialCase?.productId === (criterion.value === "true");
              break;
            default:
              if (criterion.field in customer && criterion.condition === "not_empty") {
                conditionMet = !!(customer as any)[criterion.field];
              }
          }

          if (conditionMet) {
            totalScore += criterion.points;
          }
        }

        totalScore = Math.max(0, Math.min(100, totalScore));
        let leadStatus = "cold";
        if (totalScore >= 75) leadStatus = "qualified";
        else if (totalScore >= 50) leadStatus = "hot";
        else if (totalScore >= 25) leadStatus = "warm";

        await storage.updateCustomerLeadScore(customer.id, totalScore, leadStatus);
        updated++;
      }

      await logActivity(
        req.session.user!.id,
        "bulk_recalculated_lead_scores",
        "system",
        undefined,
        undefined,
        { customersUpdated: updated },
        req.ip
      );

      res.json({ success: true, customersUpdated: updated });
    } catch (error) {
      console.error("Failed to recalculate lead scores:", error);
      res.status(500).json({ error: "Failed to recalculate lead scores" });
    }
  });

  // Seed default lead scoring criteria
  app.post("/api/lead-scoring-criteria/seed-defaults", requireAuth, async (req, res) => {
    try {
      const existingCriteria = await storage.getAllLeadScoringCriteria();
      
      if (existingCriteria.length > 0) {
        return res.status(400).json({ error: "Criteria already exist. Delete existing criteria first." });
      }

      const defaultCriteria = [
        // Profile completeness
        { name: "Has phone number", category: "profile", field: "hasPhone", condition: "equals", value: "true", points: 10 },
        { name: "Has email", category: "profile", field: "hasEmail", condition: "equals", value: "true", points: 10 },
        { name: "Has address", category: "profile", field: "hasAddress", condition: "equals", value: "true", points: 10 },
        
        // Case information
        { name: "Has potential case", category: "engagement", field: "hasCase", condition: "equals", value: "true", points: 15 },
        { name: "Has expected date", category: "engagement", field: "hasExpectedDate", condition: "equals", value: "true", points: 15 },
        { name: "Has father info", category: "engagement", field: "hasFatherInfo", condition: "equals", value: "true", points: 10 },
        { name: "Has product selected", category: "engagement", field: "hasProduct", condition: "equals", value: "true", points: 20 },
        
        // Marketing
        { name: "Newsletter opt-in", category: "engagement", field: "newsletterOptIn", condition: "equals", value: "true", points: 5 },
        
        // Case status
        { name: "Case in progress", category: "behavior", field: "caseStatus", condition: "equals", value: "in_progress", points: 15 },
        { name: "Case realized", category: "behavior", field: "caseStatus", condition: "equals", value: "realized", points: 25 },
      ];

      const created = [];
      for (const c of defaultCriteria) {
        const criterion = await storage.createLeadScoringCriteria({
          name: c.name,
          category: c.category,
          field: c.field,
          condition: c.condition,
          value: c.value,
          points: c.points,
          isActive: true,
          countryCode: null,
        });
        created.push(criterion);
      }

      await logActivity(
        req.session.user!.id,
        "seeded_default_lead_scoring_criteria",
        "system",
        undefined,
        undefined,
        { count: created.length },
        req.ip
      );

      res.status(201).json({ success: true, criteria: created });
    } catch (error) {
      console.error("Failed to seed default criteria:", error);
      res.status(500).json({ error: "Failed to seed default criteria" });
    }
  });

  // ============ CONFIGURATOR ENDPOINTS ============

  // Service Configurations
  app.get("/api/configurator/services", requireAuth, async (req, res) => {
    try {
      const countries = req.query.countries as string | undefined;
      const countryCodes = countries ? countries.split(",") : [];
      const services = await storage.getServiceConfigurationsByCountry(countryCodes);
      res.json(services);
    } catch (error) {
      console.error("Failed to get service configurations:", error);
      res.status(500).json({ error: "Failed to get service configurations" });
    }
  });

  app.post("/api/configurator/services", requireAuth, async (req, res) => {
    try {
      // Convert empty strings to null for numeric fields
      const cleanedBody = {
        ...req.body,
        basePrice: req.body.basePrice === "" ? null : req.body.basePrice,
        vatRate: req.body.vatRate === "" ? null : req.body.vatRate,
        processingDays: req.body.processingDays === "" ? null : req.body.processingDays,
        storageYears: req.body.storageYears === "" ? null : req.body.storageYears,
      };
      const validatedData = insertServiceConfigurationSchema.parse(cleanedBody);
      const service = await storage.createServiceConfiguration(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created_service_configuration",
        "service_configuration",
        service.id,
        service.serviceName,
        { serviceCode: service.serviceCode },
        req.ip
      );
      
      res.status(201).json(service);
    } catch (error) {
      console.error("Failed to create service configuration:", error);
      res.status(500).json({ error: "Failed to create service configuration" });
    }
  });

  app.patch("/api/configurator/services/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      // Convert empty strings to null for numeric fields
      const cleanedBody = {
        ...req.body,
        basePrice: req.body.basePrice === "" ? null : req.body.basePrice,
        vatRate: req.body.vatRate === "" ? null : req.body.vatRate,
        processingDays: req.body.processingDays === "" ? null : req.body.processingDays,
        storageYears: req.body.storageYears === "" ? null : req.body.storageYears,
      };
      const service = await storage.updateServiceConfiguration(id, cleanedBody);
      
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_service_configuration",
        "service_configuration",
        service.id,
        service.serviceName,
        undefined,
        req.ip
      );
      
      res.json(service);
    } catch (error) {
      console.error("Failed to update service configuration:", error);
      res.status(500).json({ error: "Failed to update service configuration" });
    }
  });

  app.delete("/api/configurator/services/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteServiceConfiguration(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Service not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_service_configuration",
        "service_configuration",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete service configuration:", error);
      res.status(500).json({ error: "Failed to delete service configuration" });
    }
  });

  // Service Instances
  app.get("/api/configurator/services/:serviceId/instances", requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const instances = await storage.getServiceInstances(serviceId);
      res.json(instances);
    } catch (error) {
      console.error("Failed to get service instances:", error);
      res.status(500).json({ error: "Failed to get service instances" });
    }
  });

  app.get("/api/configurator/service-instances", requireAuth, async (req, res) => {
    try {
      const instances = await storage.getAllServiceInstances();
      res.json(instances);
    } catch (error) {
      console.error("Failed to get all service instances:", error);
      res.status(500).json({ error: "Failed to get all service instances" });
    }
  });

  app.post("/api/configurator/service-instances", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.fromDate === "") data.fromDate = null;
      if (data.toDate === "") data.toDate = null;
      if (data.invoicingPeriodYears === "") data.invoicingPeriodYears = null;
      if (data.billingDetailsId === "") data.billingDetailsId = null;
      
      const validatedData = insertServiceInstanceSchema.parse(data);
      const instance = await storage.createServiceInstance(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created_service_instance",
        "service_instance",
        instance.id,
        instance.name,
        { serviceId: instance.serviceId },
        req.ip
      );
      
      res.status(201).json(instance);
    } catch (error) {
      console.error("Failed to create service instance:", error);
      res.status(500).json({ error: "Failed to create service instance" });
    }
  });

  app.patch("/api/configurator/service-instances/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = { ...req.body };
      if (data.fromDate === "") data.fromDate = null;
      if (data.toDate === "") data.toDate = null;
      if (data.invoicingPeriodYears === "") data.invoicingPeriodYears = null;
      if (data.billingDetailsId === "") data.billingDetailsId = null;
      
      const instance = await storage.updateServiceInstance(id, data);
      
      if (!instance) {
        return res.status(404).json({ error: "Service instance not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_service_instance",
        "service_instance",
        instance.id,
        instance.name,
        undefined,
        req.ip
      );
      
      res.json(instance);
    } catch (error) {
      console.error("Failed to update service instance:", error);
      res.status(500).json({ error: "Failed to update service instance" });
    }
  });

  app.delete("/api/configurator/service-instances/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteServiceInstance(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Service instance not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_service_instance",
        "service_instance",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete service instance:", error);
      res.status(500).json({ error: "Failed to delete service instance" });
    }
  });

  // Number Ranges
  app.get("/api/configurator/number-ranges", requireAuth, async (req, res) => {
    try {
      const countries = req.query.countries as string | undefined;
      const countryCodes = countries ? countries.split(",") : [];
      const ranges = await storage.getNumberRangesByCountry(countryCodes);
      res.json(ranges);
    } catch (error) {
      console.error("Failed to get number ranges:", error);
      res.status(500).json({ error: "Failed to get number ranges" });
    }
  });

  app.post("/api/configurator/number-ranges", requireAuth, async (req, res) => {
    try {
      const range = await storage.createNumberRange(req.body);
      
      await logActivity(
        req.session.user!.id,
        "created_number_range",
        "number_range",
        range.id,
        range.name,
        undefined,
        req.ip
      );
      
      res.status(201).json(range);
    } catch (error) {
      console.error("Failed to create number range:", error);
      res.status(500).json({ error: "Failed to create number range" });
    }
  });

  app.patch("/api/configurator/number-ranges/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const range = await storage.updateNumberRange(id, req.body);
      
      if (!range) {
        return res.status(404).json({ error: "Number range not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_number_range",
        "number_range",
        range.id,
        range.name,
        undefined,
        req.ip
      );
      
      res.json(range);
    } catch (error) {
      console.error("Failed to update number range:", error);
      res.status(500).json({ error: "Failed to update number range" });
    }
  });

  app.delete("/api/configurator/number-ranges/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteNumberRange(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Number range not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_number_range",
        "number_range",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete number range:", error);
      res.status(500).json({ error: "Failed to delete number range" });
    }
  });

  // Invoice Templates
  app.get("/api/configurator/invoice-templates", requireAuth, async (req, res) => {
    try {
      const countries = req.query.countries as string | undefined;
      const countryCodes = countries ? countries.split(",") : [];
      const templates = await storage.getInvoiceTemplatesByCountry(countryCodes);
      res.json(templates);
    } catch (error) {
      console.error("Failed to get invoice templates:", error);
      res.status(500).json({ error: "Failed to get invoice templates" });
    }
  });

  app.post("/api/configurator/invoice-templates", requireAuth, async (req, res) => {
    try {
      const validatedData = insertInvoiceTemplateSchema.parse(req.body);
      const template = await storage.createInvoiceTemplate(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created_invoice_template",
        "invoice_template",
        template.id,
        template.name,
        undefined,
        req.ip
      );
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to create invoice template:", error);
      res.status(500).json({ error: "Failed to create invoice template" });
    }
  });

  app.patch("/api/configurator/invoice-templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const template = await storage.updateInvoiceTemplate(id, req.body);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_invoice_template",
        "invoice_template",
        template.id,
        template.name,
        undefined,
        req.ip
      );
      
      res.json(template);
    } catch (error) {
      console.error("Failed to update invoice template:", error);
      res.status(500).json({ error: "Failed to update invoice template" });
    }
  });

  app.delete("/api/configurator/invoice-templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteInvoiceTemplate(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_invoice_template",
        "invoice_template",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete invoice template:", error);
      res.status(500).json({ error: "Failed to delete invoice template" });
    }
  });

  // Invoice Layouts
  app.get("/api/configurator/invoice-layouts", requireAuth, async (req, res) => {
    try {
      const countries = req.query.countries as string | undefined;
      const countryCodes = countries ? countries.split(",") : [];
      const layouts = await storage.getInvoiceLayoutsByCountry(countryCodes);
      res.json(layouts);
    } catch (error) {
      console.error("Failed to get invoice layouts:", error);
      res.status(500).json({ error: "Failed to get invoice layouts" });
    }
  });

  app.post("/api/configurator/invoice-layouts", requireAuth, async (req, res) => {
    try {
      const validatedData = insertInvoiceLayoutSchema.parse(req.body);
      const layout = await storage.createInvoiceLayout(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created_invoice_layout",
        "invoice_layout",
        layout.id,
        layout.name,
        undefined,
        req.ip
      );
      
      res.status(201).json(layout);
    } catch (error) {
      console.error("Failed to create invoice layout:", error);
      res.status(500).json({ error: "Failed to create invoice layout" });
    }
  });

  app.patch("/api/configurator/invoice-layouts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const layout = await storage.updateInvoiceLayout(id, req.body);
      
      if (!layout) {
        return res.status(404).json({ error: "Layout not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_invoice_layout",
        "invoice_layout",
        layout.id,
        layout.name,
        undefined,
        req.ip
      );
      
      res.json(layout);
    } catch (error) {
      console.error("Failed to update invoice layout:", error);
      res.status(500).json({ error: "Failed to update invoice layout" });
    }
  });

  app.delete("/api/configurator/invoice-layouts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteInvoiceLayout(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Layout not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_invoice_layout",
        "invoice_layout",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete invoice layout:", error);
      res.status(500).json({ error: "Failed to delete invoice layout" });
    }
  });

  // ===== Roles & Permissions Routes =====

  app.get("/api/roles", requireAuth, async (req, res) => {
    try {
      const roles = await storage.getAllRoles();
      res.json(roles);
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const role = await storage.getRole(id);
      
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      const modulePermissions = await storage.getRoleModulePermissions(id);
      const fieldPermissions = await storage.getRoleFieldPermissions(id);
      
      res.json({
        ...role,
        modulePermissions,
        fieldPermissions,
      });
    } catch (error) {
      console.error("Failed to fetch role:", error);
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", requireAuth, async (req, res) => {
    try {
      const { modulePermissions, fieldPermissions, ...roleData } = req.body;
      
      const validatedRole = insertRoleSchema.parse({
        ...roleData,
        createdBy: req.session.user!.id,
      });
      
      const role = await storage.createRole(validatedRole);
      
      if (modulePermissions && modulePermissions.length > 0) {
        const validModulePerms = modulePermissions.map((p: any) => ({
          roleId: role.id,
          moduleKey: p.moduleKey,
          access: p.access,
          canAdd: p.canAdd ?? true,
          canEdit: p.canEdit ?? true,
        }));
        await storage.setRoleModulePermissions(role.id, validModulePerms);
      }
      
      if (fieldPermissions && fieldPermissions.length > 0) {
        const validFieldPerms = fieldPermissions.map((p: any) => ({
          roleId: role.id,
          moduleKey: p.moduleKey,
          fieldKey: p.fieldKey,
          permission: p.permission,
        }));
        await storage.setRoleFieldPermissions(role.id, validFieldPerms);
      }

      await logActivity(
        req.session.user!.id,
        "created_role",
        "role",
        role.id,
        role.name,
        undefined,
        req.ip
      );
      
      res.status(201).json(role);
    } catch (error) {
      console.error("Failed to create role:", error);
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  app.patch("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { modulePermissions, fieldPermissions, ...roleData } = req.body;
      
      const role = await storage.updateRole(id, roleData);
      
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      if (modulePermissions !== undefined) {
        const validModulePerms = modulePermissions.map((p: any) => ({
          roleId: id,
          moduleKey: p.moduleKey,
          access: p.access,
          canAdd: p.canAdd ?? true,
          canEdit: p.canEdit ?? true,
        }));
        await storage.setRoleModulePermissions(id, validModulePerms);
      }
      
      if (fieldPermissions !== undefined) {
        const validFieldPerms = fieldPermissions.map((p: any) => ({
          roleId: id,
          moduleKey: p.moduleKey,
          fieldKey: p.fieldKey,
          permission: p.permission,
        }));
        await storage.setRoleFieldPermissions(id, validFieldPerms);
      }

      await logActivity(
        req.session.user!.id,
        "updated_role",
        "role",
        role.id,
        role.name,
        undefined,
        req.ip
      );
      
      res.json(role);
    } catch (error) {
      console.error("Failed to update role:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const role = await storage.getRole(id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      if (role.isSystem) {
        return res.status(403).json({ error: "Cannot delete system role" });
      }
      
      const deleted = await storage.deleteRole(id);

      await logActivity(
        req.session.user!.id,
        "deleted_role",
        "role",
        id,
        role.name,
        undefined,
        req.ip
      );
      
      res.json({ success: deleted });
    } catch (error) {
      console.error("Failed to delete role:", error);
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  app.post("/api/roles/:id/copy", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "New role name is required" });
      }
      
      const newRole = await storage.copyRole(id, name, req.session.user!.id);

      await logActivity(
        req.session.user!.id,
        "copied_role",
        "role",
        newRole.id,
        `Copied from role ${id} as ${name}`,
        undefined,
        req.ip
      );
      
      res.status(201).json(newRole);
    } catch (error) {
      console.error("Failed to copy role:", error);
      res.status(500).json({ error: "Failed to copy role" });
    }
  });

  // Update single module permission
  app.put("/api/roles/:roleId/modules/:moduleKey", requireAuth, async (req, res) => {
    try {
      const { roleId, moduleKey } = req.params;
      const { access, canAdd, canEdit } = req.body;
      
      if (access && !["visible", "hidden"].includes(access)) {
        return res.status(400).json({ error: "Invalid access value" });
      }
      
      const role = await storage.getRole(roleId);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      // Get current module permissions
      const currentPerms = await storage.getRoleModulePermissions(roleId);
      
      // Update or add the specific module permission
      const existingPerm = currentPerms.find(p => p.moduleKey === moduleKey);
      if (existingPerm) {
        // Update existing - merge with current values
        const updatedPerms = currentPerms.map(p => 
          p.moduleKey === moduleKey 
            ? { 
                roleId, 
                moduleKey, 
                access: access ?? p.access, 
                canAdd: canAdd ?? p.canAdd, 
                canEdit: canEdit ?? p.canEdit 
              } 
            : { roleId: p.roleId, moduleKey: p.moduleKey, access: p.access, canAdd: p.canAdd, canEdit: p.canEdit }
        );
        await storage.setRoleModulePermissions(roleId, updatedPerms);
      } else {
        // Add new
        const newPerms = [...currentPerms.map(p => ({ 
          roleId: p.roleId, 
          moduleKey: p.moduleKey, 
          access: p.access,
          canAdd: p.canAdd,
          canEdit: p.canEdit
        })), { roleId, moduleKey, access: access ?? "visible", canAdd: canAdd ?? true, canEdit: canEdit ?? true }];
        await storage.setRoleModulePermissions(roleId, newPerms);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update module permission:", error);
      res.status(500).json({ error: "Failed to update module permission" });
    }
  });

  // Update single field permission
  app.put("/api/roles/:roleId/modules/:moduleKey/fields/:fieldKey", requireAuth, async (req, res) => {
    try {
      const { roleId, moduleKey, fieldKey } = req.params;
      const { permission } = req.body;
      
      if (!permission || !["editable", "readonly", "hidden"].includes(permission)) {
        return res.status(400).json({ error: "Invalid permission value" });
      }
      
      const role = await storage.getRole(roleId);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      // Get current field permissions
      const currentPerms = await storage.getRoleFieldPermissions(roleId);
      
      // Update or add the specific field permission
      const existingPerm = currentPerms.find(p => p.moduleKey === moduleKey && p.fieldKey === fieldKey);
      if (existingPerm) {
        // Update existing
        const updatedPerms = currentPerms.map(p => 
          (p.moduleKey === moduleKey && p.fieldKey === fieldKey)
            ? { roleId, moduleKey, fieldKey, permission } 
            : { roleId: p.roleId, moduleKey: p.moduleKey, fieldKey: p.fieldKey, permission: p.permission }
        );
        await storage.setRoleFieldPermissions(roleId, updatedPerms);
      } else {
        // Add new
        const newPerms = [...currentPerms.map(p => ({ 
          roleId: p.roleId, 
          moduleKey: p.moduleKey, 
          fieldKey: p.fieldKey, 
          permission: p.permission 
        })), { roleId, moduleKey, fieldKey, permission }];
        await storage.setRoleFieldPermissions(roleId, newPerms);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update field permission:", error);
      res.status(500).json({ error: "Failed to update field permission" });
    }
  });

  // Seed default roles
  app.post("/api/roles/seed", requireAuth, async (req, res) => {
    try {
      const existingRoles = await storage.getAllRoles();
      
      // Define the 3 system roles with legacyRole for backward compatibility
      const systemRoles = [
        {
          name: "Administrator",
          description: "Full access to all modules and features",
          department: "management",
          legacyRole: "admin",
          isSystem: true,
          moduleAccess: {
            dashboard: "visible",
            customers: "visible",
            hospitals: "visible",
            collaborators: "visible",
            invoices: "visible",
            users: "visible",
            settings: "visible",
            configurator: "visible",
          },
        },
        {
          name: "User",
          description: "Access to operational modules",
          department: "operations",
          legacyRole: "user",
          isSystem: true,
          moduleAccess: {
            dashboard: "visible",
            customers: "visible",
            hospitals: "visible",
            collaborators: "visible",
            invoices: "visible",
            users: "hidden",
            settings: "hidden",
            configurator: "hidden",
          },
        },
        {
          name: "Manager",
          description: "Dashboard access only",
          department: "management",
          legacyRole: "manager",
          isSystem: true,
          moduleAccess: {
            dashboard: "visible",
            customers: "hidden",
            hospitals: "hidden",
            collaborators: "hidden",
            invoices: "hidden",
            users: "hidden",
            settings: "hidden",
            configurator: "hidden",
          },
        },
      ];

      const createdRoles: Role[] = [];

      for (const roleData of systemRoles) {
        // Skip if role already exists
        const existingRole = existingRoles.find(r => r.name === roleData.name);
        if (existingRole) {
          createdRoles.push(existingRole);
          continue;
        }

        // Create the role
        const role = await storage.createRole({
          name: roleData.name,
          description: roleData.description,
          department: roleData.department,
          legacyRole: roleData.legacyRole,
          isSystem: roleData.isSystem,
          isActive: true,
          createdBy: req.session.user!.id,
        });

        // Set module permissions
        const modulePerms = Object.entries(roleData.moduleAccess).map(([moduleKey, access]) => ({
          roleId: role.id,
          moduleKey,
          access,
        }));
        await storage.setRoleModulePermissions(role.id, modulePerms);

        createdRoles.push(role);
      }

      res.json({ 
        success: true, 
        message: "System roles created successfully",
        roles: createdRoles 
      });
    } catch (error) {
      console.error("Failed to seed roles:", error);
      res.status(500).json({ error: "Failed to seed roles" });
    }
  });

  // ===== Departments API =====
  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const allDepartments = await storage.getAllDepartments();
      res.json(allDepartments);
    } catch (error) {
      console.error("Failed to get departments:", error);
      res.status(500).json({ error: "Failed to get departments" });
    }
  });

  app.post("/api/departments", requireAuth, async (req, res) => {
    try {
      const department = await storage.createDepartment(req.body);
      await logActivity(
        req.session.user!.id,
        "created_department",
        "department",
        department.id,
        department.name,
        undefined,
        req.ip
      );
      res.status(201).json(department);
    } catch (error) {
      console.error("Failed to create department:", error);
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const department = await storage.updateDepartment(id, req.body);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      await logActivity(
        req.session.user!.id,
        "updated_department",
        "department",
        department.id,
        department.name,
        undefined,
        req.ip
      );
      res.json(department);
    } catch (error) {
      console.error("Failed to update department:", error);
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const department = await storage.getDepartment(id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      const deleted = await storage.deleteDepartment(id);
      await logActivity(
        req.session.user!.id,
        "deleted_department",
        "department",
        id,
        department.name,
        undefined,
        req.ip
      );
      res.json({ success: deleted });
    } catch (error) {
      console.error("Failed to delete department:", error);
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // ============= Campaigns Routes =============

  app.get("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const campaigns = await storage.getAllCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.parse({
        ...req.body,
        createdBy: req.session.user!.id,
      });
      const campaign = await storage.createCampaign(validatedData);
      await logActivity(
        req.session.user!.id,
        "created_campaign",
        "campaign",
        campaign.id,
        campaign.name,
        undefined,
        req.ip
      );
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Failed to create campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      await logActivity(
        req.session.user!.id,
        "updated_campaign",
        "campaign",
        campaign.id,
        campaign.name,
        undefined,
        req.ip
      );
      res.json(campaign);
    } catch (error) {
      console.error("Failed to update campaign:", error);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const deleted = await storage.deleteCampaign(req.params.id);
      await logActivity(
        req.session.user!.id,
        "deleted_campaign",
        "campaign",
        req.params.id,
        campaign.name,
        undefined,
        req.ip
      );
      res.json({ success: deleted });
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Preview customers matching campaign criteria
  app.post("/api/campaigns/:id/preview", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      let customers = await storage.getAllCustomers();
      
      // Filter by campaign country codes
      if (campaign.countryCodes && campaign.countryCodes.length > 0) {
        customers = customers.filter(c => campaign.countryCodes.includes(c.country));
      }
      
      // Apply criteria filtering if exists
      if (campaign.criteria) {
        try {
          const criteria = JSON.parse(campaign.criteria);
          customers = applyCustomerCriteria(customers, criteria);
        } catch (e) {
          // Invalid criteria JSON, return all customers
        }
      }
      
      res.json({ count: customers.length, customers: customers.slice(0, 100) });
    } catch (error) {
      console.error("Failed to preview campaign:", error);
      res.status(500).json({ error: "Failed to preview campaign" });
    }
  });

  // Generate contacts from criteria
  app.post("/api/campaigns/:id/generate-contacts", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      // Delete existing contacts
      await storage.deleteCampaignContactsByCampaign(req.params.id);
      
      let customers = await storage.getAllCustomers();
      
      // Filter by campaign country codes
      if (campaign.countryCodes && campaign.countryCodes.length > 0) {
        customers = customers.filter(c => campaign.countryCodes.includes(c.country));
      }
      
      // Apply criteria filtering if exists
      if (campaign.criteria) {
        try {
          const criteria = JSON.parse(campaign.criteria);
          customers = applyCustomerCriteria(customers, criteria);
        } catch (e) {
          // Invalid criteria JSON
        }
      }
      
      // Create contacts with default values for required fields
      const contactsData = customers.map(c => ({
        campaignId: req.params.id,
        customerId: c.id,
        status: "pending" as const,
        attemptCount: 0,
        priorityScore: 50, // Default priority
      }));
      
      const contacts = await storage.createCampaignContacts(contactsData);
      
      await logActivity(
        req.session.user!.id,
        "generated_campaign_contacts",
        "campaign",
        campaign.id,
        campaign.name,
        { count: contacts.length },
        req.ip
      );
      
      res.json({ count: contacts.length });
    } catch (error) {
      console.error("Failed to generate campaign contacts:", error);
      res.status(500).json({ error: "Failed to generate campaign contacts" });
    }
  });

  // Campaign Contacts
  app.get("/api/campaigns/:id/contacts", requireAuth, async (req, res) => {
    try {
      const contacts = await storage.getCampaignContacts(req.params.id);
      
      // Enrich with customer data
      const enrichedContacts = await Promise.all(
        contacts.map(async (contact) => {
          const customer = await storage.getCustomer(contact.customerId);
          return { ...contact, customer };
        })
      );
      
      res.json(enrichedContacts);
    } catch (error) {
      console.error("Failed to fetch campaign contacts:", error);
      res.status(500).json({ error: "Failed to fetch campaign contacts" });
    }
  });

  app.patch("/api/campaigns/:campaignId/contacts/:contactId", requireAuth, async (req, res) => {
    try {
      const existingContact = await storage.getCampaignContact(req.params.contactId);
      if (!existingContact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      const previousStatus = existingContact.status;
      const contact = await storage.updateCampaignContact(req.params.contactId, req.body);
      
      // Log history if status changed
      if (req.body.status && req.body.status !== previousStatus) {
        await storage.createCampaignContactHistory({
          campaignContactId: req.params.contactId,
          userId: req.session.user!.id,
          action: "status_change",
          previousStatus,
          newStatus: req.body.status,
          notes: req.body.notes || null,
        });
      } else if (req.body.notes) {
        await storage.createCampaignContactHistory({
          campaignContactId: req.params.contactId,
          userId: req.session.user!.id,
          action: "note_added",
          notes: req.body.notes,
        });
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Failed to update campaign contact:", error);
      res.status(500).json({ error: "Failed to update campaign contact" });
    }
  });

  app.get("/api/campaigns/:campaignId/contacts/:contactId/history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getCampaignContactHistory(req.params.contactId);
      res.json(history);
    } catch (error) {
      console.error("Failed to fetch contact history:", error);
      res.status(500).json({ error: "Failed to fetch contact history" });
    }
  });

  // Bulk update campaign contacts
  app.post("/api/campaigns/:id/contacts/bulk-update", requireAuth, async (req, res) => {
    try {
      const { contactIds, status, priority, assignedTo } = req.body;
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "contactIds is required and must be a non-empty array" });
      }

      const updateData: any = {};
      if (status) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

      let updatedCount = 0;
      for (const contactId of contactIds) {
        try {
          const existingContact = await storage.getCampaignContact(contactId);
          if (existingContact && existingContact.campaignId === req.params.id) {
            await storage.updateCampaignContact(contactId, updateData);
            
            if (status && status !== existingContact.status) {
              await storage.createCampaignContactHistory({
                campaignContactId: contactId,
                userId: req.session.user!.id,
                action: "status_change",
                previousStatus: existingContact.status,
                newStatus: status,
                notes: "Bulk update",
              });
            }
            updatedCount++;
          }
        } catch (err) {
          console.error(`Failed to update contact ${contactId}:`, err);
        }
      }

      res.json({ count: updatedCount });
    } catch (error) {
      console.error("Failed to bulk update contacts:", error);
      res.status(500).json({ error: "Failed to bulk update contacts" });
    }
  });

  // Campaign Templates endpoints
  app.get("/api/campaign-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getAllCampaignTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Failed to fetch campaign templates:", error);
      res.status(500).json({ error: "Failed to fetch campaign templates" });
    }
  });

  app.get("/api/campaign-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getCampaignTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Failed to fetch campaign template:", error);
      res.status(500).json({ error: "Failed to fetch campaign template" });
    }
  });

  app.post("/api/campaign-templates", requireAuth, async (req, res) => {
    try {
      const template = await storage.createCampaignTemplate({
        ...req.body,
        createdBy: req.session.user!.id,
      });
      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to create campaign template:", error);
      res.status(500).json({ error: "Failed to create campaign template" });
    }
  });

  app.patch("/api/campaign-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.updateCampaignTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Failed to update campaign template:", error);
      res.status(500).json({ error: "Failed to update campaign template" });
    }
  });

  app.delete("/api/campaign-templates/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCampaignTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete campaign template:", error);
      res.status(500).json({ error: "Failed to delete campaign template" });
    }
  });

  // Clone campaign endpoint
  app.post("/api/campaigns/:id/clone", requireAuth, async (req, res) => {
    try {
      const sourceCampaign = await storage.getCampaign(req.params.id);
      if (!sourceCampaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { name } = req.body;
      const clonedCampaign = await storage.createCampaign({
        name: name || `${sourceCampaign.name} (kópia)`,
        description: sourceCampaign.description,
        type: sourceCampaign.type as any,
        status: "draft",
        countryCodes: sourceCampaign.countryCodes || [],
        criteria: sourceCampaign.criteria,
        settings: sourceCampaign.settings,
        createdBy: req.session.user!.id,
      });

      res.status(201).json(clonedCampaign);
    } catch (error) {
      console.error("Failed to clone campaign:", error);
      res.status(500).json({ error: "Failed to clone campaign" });
    }
  });

  // Save campaign as template
  app.post("/api/campaigns/:id/save-as-template", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { name, description } = req.body;
      const template = await storage.createCampaignTemplate({
        name: name || `${campaign.name} - Šablóna`,
        description: description || campaign.description,
        type: campaign.type as any,
        countryCodes: campaign.countryCodes || [],
        criteria: campaign.criteria,
        settings: campaign.settings,
        createdBy: req.session.user!.id,
      });

      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to save campaign as template:", error);
      res.status(500).json({ error: "Failed to save campaign as template" });
    }
  });

  // Create campaign from template
  app.post("/api/campaign-templates/:id/create-campaign", requireAuth, async (req, res) => {
    try {
      const template = await storage.getCampaignTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const { name } = req.body;
      const campaign = await storage.createCampaign({
        name: name || `${template.name} - Kampaň`,
        description: template.description,
        type: template.type as any,
        status: "draft",
        countryCodes: template.countryCodes || [],
        criteria: template.criteria,
        settings: template.settings,
        createdBy: req.session.user!.id,
      });

      res.status(201).json(campaign);
    } catch (error) {
      console.error("Failed to create campaign from template:", error);
      res.status(500).json({ error: "Failed to create campaign from template" });
    }
  });

  // Campaign Schedule endpoints
  app.get("/api/campaigns/:id/schedule", requireAuth, async (req, res) => {
    try {
      const schedule = await storage.getCampaignSchedule(req.params.id);
      res.json(schedule || null);
    } catch (error) {
      console.error("Failed to fetch campaign schedule:", error);
      res.status(500).json({ error: "Failed to fetch campaign schedule" });
    }
  });

  app.post("/api/campaigns/:id/schedule", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getCampaignSchedule(req.params.id);
      if (existing) {
        const updated = await storage.updateCampaignSchedule(req.params.id, req.body);
        res.json(updated);
      } else {
        const schedule = await storage.createCampaignSchedule({
          campaignId: req.params.id,
          ...req.body,
        });
        res.json(schedule);
      }
    } catch (error) {
      console.error("Failed to save campaign schedule:", error);
      res.status(500).json({ error: "Failed to save campaign schedule" });
    }
  });

  // Campaign Operator Settings endpoints
  app.get("/api/campaigns/:id/operators", requireAuth, async (req, res) => {
    try {
      const operators = await storage.getCampaignOperators(req.params.id);
      res.json(operators);
    } catch (error) {
      console.error("Failed to fetch campaign operators:", error);
      res.status(500).json({ error: "Failed to fetch campaign operators" });
    }
  });

  app.post("/api/campaigns/:id/operators", requireAuth, async (req, res) => {
    try {
      const operator = await storage.createCampaignOperatorSetting({
        campaignId: req.params.id,
        ...req.body,
      });
      res.json(operator);
    } catch (error) {
      console.error("Failed to add campaign operator:", error);
      res.status(500).json({ error: "Failed to add campaign operator" });
    }
  });

  app.patch("/api/campaigns/:campaignId/operators/:operatorId", requireAuth, async (req, res) => {
    try {
      const operator = await storage.updateCampaignOperatorSetting(req.params.operatorId, req.body);
      if (!operator) {
        return res.status(404).json({ error: "Operator setting not found" });
      }
      res.json(operator);
    } catch (error) {
      console.error("Failed to update campaign operator:", error);
      res.status(500).json({ error: "Failed to update campaign operator" });
    }
  });

  app.delete("/api/campaigns/:campaignId/operators/:operatorId", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCampaignOperatorSetting(req.params.operatorId);
      if (!deleted) {
        return res.status(404).json({ error: "Operator setting not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove campaign operator:", error);
      res.status(500).json({ error: "Failed to remove campaign operator" });
    }
  });

  // Contact Sessions endpoints
  app.get("/api/campaigns/:campaignId/contacts/:contactId/sessions", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getContactSessions(req.params.contactId);
      res.json(sessions);
    } catch (error) {
      console.error("Failed to fetch contact sessions:", error);
      res.status(500).json({ error: "Failed to fetch contact sessions" });
    }
  });

  app.post("/api/campaigns/:campaignId/contacts/:contactId/sessions", requireAuth, async (req, res) => {
    try {
      const session = await storage.createContactSession({
        campaignContactId: req.params.contactId,
        operatorId: req.session.user!.id,
        ...req.body,
      });
      res.json(session);
    } catch (error) {
      console.error("Failed to create contact session:", error);
      res.status(500).json({ error: "Failed to create contact session" });
    }
  });

  app.patch("/api/campaigns/:campaignId/contacts/:contactId/sessions/:sessionId", requireAuth, async (req, res) => {
    try {
      const session = await storage.updateContactSession(req.params.sessionId, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Failed to update contact session:", error);
      res.status(500).json({ error: "Failed to update contact session" });
    }
  });

  // Campaign Stats endpoint
  app.get("/api/campaigns/:id/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getCampaignStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch campaign stats:", error);
      res.status(500).json({ error: "Failed to fetch campaign stats" });
    }
  });

  // Campaign Metrics Snapshots
  app.get("/api/campaigns/:id/metrics", requireAuth, async (req, res) => {
    try {
      const metrics = await storage.getCampaignMetrics(req.params.id);
      res.json(metrics);
    } catch (error) {
      console.error("Failed to fetch campaign metrics:", error);
      res.status(500).json({ error: "Failed to fetch campaign metrics" });
    }
  });

  // ===== SIP Settings Routes =====
  
  // Get SIP settings (global server configuration)
  app.get("/api/sip-settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSipSettings();
      res.json(settings || null);
    } catch (error) {
      console.error("Failed to fetch SIP settings:", error);
      res.status(500).json({ error: "Failed to fetch SIP settings" });
    }
  });

  // Update SIP settings (admin only)
  app.post("/api/sip-settings", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      if (req.session.user?.role !== "admin") {
        return res.status(403).json({ error: "Only admins can modify SIP settings" });
      }
      
      const validated = insertSipSettingsSchema.parse(req.body);
      const settings = await storage.upsertSipSettings(validated);
      
      await logActivity(
        req.session.user.id,
        "sip_settings_updated",
        "sip_settings",
        settings.id,
        "SIP Settings",
        { serverAddress: settings.serverAddress },
        req.ip
      );
      
      res.json(settings);
    } catch (error: any) {
      console.error("Failed to update SIP settings:", error);
      res.status(400).json({ error: error.message || "Failed to update SIP settings" });
    }
  });

  // ===== Call Logs Routes =====
  
  // Get all call logs (with optional filters)
  app.get("/api/call-logs", requireAuth, async (req, res) => {
    try {
      const { userId, customerId, campaignId, limit } = req.query;
      
      let logs;
      if (userId) {
        logs = await storage.getCallLogsByUser(userId as string, limit ? parseInt(limit as string) : undefined);
      } else if (customerId) {
        logs = await storage.getCallLogsByCustomer(customerId as string);
      } else if (campaignId) {
        logs = await storage.getCallLogsByCampaign(campaignId as string);
      } else {
        logs = await storage.getAllCallLogs(limit ? parseInt(limit as string) : undefined);
      }
      
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch call logs:", error);
      res.status(500).json({ error: "Failed to fetch call logs" });
    }
  });

  // Get call log by ID
  app.get("/api/call-logs/:id", requireAuth, async (req, res) => {
    try {
      const log = await storage.getCallLog(req.params.id);
      if (!log) {
        return res.status(404).json({ error: "Call log not found" });
      }
      res.json(log);
    } catch (error) {
      console.error("Failed to fetch call log:", error);
      res.status(500).json({ error: "Failed to fetch call log" });
    }
  });

  // Create a new call log (when call starts)
  app.post("/api/call-logs", requireAuth, async (req, res) => {
    try {
      const validated = insertCallLogSchema.parse({
        ...req.body,
        userId: req.session.user?.id
      });
      const log = await storage.createCallLog(validated);
      res.status(201).json(log);
    } catch (error: any) {
      console.error("Failed to create call log:", error);
      res.status(400).json({ error: error.message || "Failed to create call log" });
    }
  });

  // Update a call log (when call ends or status changes)
  app.patch("/api/call-logs/:id", requireAuth, async (req, res) => {
    try {
      const log = await storage.updateCallLog(req.params.id, req.body);
      if (!log) {
        return res.status(404).json({ error: "Call log not found" });
      }
      res.json(log);
    } catch (error: any) {
      console.error("Failed to update call log:", error);
      res.status(400).json({ error: error.message || "Failed to update call log" });
    }
  });

  // Get call logs for current user
  app.get("/api/my-call-logs", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getCallLogsByUser(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch user call logs:", error);
      res.status(500).json({ error: "Failed to fetch call logs" });
    }
  });

  // ========== PRODUCT SETS (ZOSTAVY) ==========

  // Get all product sets for a product
  app.get("/api/products/:productId/sets", requireAuth, async (req, res) => {
    try {
      const sets = await storage.getProductSets(req.params.productId);
      res.json(sets);
    } catch (error) {
      console.error("Failed to fetch product sets:", error);
      res.status(500).json({ error: "Failed to fetch product sets" });
    }
  });

  // Get single product set with collections and storage
  app.get("/api/product-sets/:id", requireAuth, async (req, res) => {
    try {
      const set = await storage.getProductSet(req.params.id);
      if (!set) {
        return res.status(404).json({ error: "Product set not found" });
      }
      const collections = await storage.getProductSetCollections(req.params.id);
      const storageItems = await storage.getProductSetStorage(req.params.id);
      res.json({ ...set, collections, storage: storageItems });
    } catch (error) {
      console.error("Failed to fetch product set:", error);
      res.status(500).json({ error: "Failed to fetch product set" });
    }
  });

  // Create product set
  app.post("/api/products/:productId/sets", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields({ ...req.body, productId: req.params.productId });
      const set = await storage.createProductSet(data);
      res.status(201).json(set);
    } catch (error: any) {
      console.error("Failed to create product set:", error);
      res.status(400).json({ error: error.message || "Failed to create product set" });
    }
  });

  // Update product set
  app.patch("/api/product-sets/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      const set = await storage.updateProductSet(req.params.id, data);
      if (!set) {
        return res.status(404).json({ error: "Product set not found" });
      }
      res.json(set);
    } catch (error: any) {
      console.error("Failed to update product set:", error);
      res.status(400).json({ error: error.message || "Failed to update product set" });
    }
  });

  // Delete product set
  app.delete("/api/product-sets/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProductSet(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete product set:", error);
      res.status(500).json({ error: "Failed to delete product set" });
    }
  });

  // Get collections for a product set
  app.get("/api/product-sets/:setId/collections", requireAuth, async (req, res) => {
    try {
      const collections = await storage.getProductSetCollections(req.params.setId);
      res.json(collections);
    } catch (error) {
      console.error("Failed to fetch set collections:", error);
      res.status(500).json({ error: "Failed to fetch set collections" });
    }
  });

  // Add collection to product set
  app.post("/api/product-sets/:setId/collections", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, productSetId: req.params.setId };
      const collection = await storage.createProductSetCollection(data);
      res.status(201).json(collection);
    } catch (error: any) {
      console.error("Failed to add collection to set:", error);
      res.status(400).json({ error: error.message || "Failed to add collection" });
    }
  });

  // Update set collection
  app.patch("/api/product-set-collections/:id", requireAuth, async (req, res) => {
    try {
      const collection = await storage.updateProductSetCollection(req.params.id, req.body);
      if (!collection) {
        return res.status(404).json({ error: "Set collection not found" });
      }
      res.json(collection);
    } catch (error: any) {
      console.error("Failed to update set collection:", error);
      res.status(400).json({ error: error.message || "Failed to update set collection" });
    }
  });

  // Delete set collection
  app.delete("/api/product-set-collections/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProductSetCollection(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete set collection:", error);
      res.status(500).json({ error: "Failed to delete set collection" });
    }
  });

  // Get storage items for a product set
  app.get("/api/product-sets/:setId/storage", requireAuth, async (req, res) => {
    try {
      const storageItems = await storage.getProductSetStorage(req.params.setId);
      res.json(storageItems);
    } catch (error) {
      console.error("Failed to fetch set storage:", error);
      res.status(500).json({ error: "Failed to fetch set storage" });
    }
  });

  // Add storage to product set
  app.post("/api/product-sets/:setId/storage", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, productSetId: req.params.setId };
      const storageItem = await storage.createProductSetStorage(data);
      res.status(201).json(storageItem);
    } catch (error: any) {
      console.error("Failed to add storage to set:", error);
      res.status(400).json({ error: error.message || "Failed to add storage" });
    }
  });

  // Update set storage
  app.patch("/api/product-set-storage/:id", requireAuth, async (req, res) => {
    try {
      const storageItem = await storage.updateProductSetStorage(req.params.id, req.body);
      if (!storageItem) {
        return res.status(404).json({ error: "Set storage not found" });
      }
      res.json(storageItem);
    } catch (error: any) {
      console.error("Failed to update set storage:", error);
      res.status(400).json({ error: error.message || "Failed to update set storage" });
    }
  });

  // Delete set storage
  app.delete("/api/product-set-storage/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProductSetStorage(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete set storage:", error);
      res.status(500).json({ error: "Failed to delete set storage" });
    }
  });

  // ==== Chat System with WebSocket ====
  
  // Track online users and their WebSocket connections
  const onlineUsers = new Map<string, { ws: WebSocket; user: SafeUser }>();
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });
  console.log("[Chat] WebSocket server initialized on path /ws/chat");
  
  wss.on("connection", (ws, req) => {
    console.log("[Chat] New WebSocket connection from:", req.socket.remoteAddress);
    let userId: string | null = null;
    let user: SafeUser | null = null;
    
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "auth":
            // Authenticate user by session or user info passed from client
            userId = message.userId;
            if (userId) {
              console.log("[Chat] Auth attempt for user:", userId);
              const fullUser = await storage.getUser(userId);
              if (fullUser) {
                const { passwordHash, ...safeUser } = fullUser;
                user = safeUser;
                onlineUsers.set(userId, { ws, user });
                console.log("[Chat] User authenticated:", fullUser.fullName, "| Total online:", onlineUsers.size);
                
                // Broadcast user online status to all connected clients
                broadcastPresence();
                
                ws.send(JSON.stringify({ type: "auth_success", userId }));
              } else {
                console.log("[Chat] User not found:", userId);
              }
            }
            break;
            
          case "chat_message":
            if (!userId || !user) {
              ws.send(JSON.stringify({ type: "error", error: "Not authenticated" }));
              return;
            }
            
            const { receiverId, content } = message;
            
            // Store message in database
            const chatMsg = await storage.createChatMessage({
              senderId: userId,
              receiverId,
              content,
              isRead: false,
            });
            
            // Send confirmation to sender
            ws.send(JSON.stringify({ 
              type: "message_sent", 
              message: chatMsg 
            }));
            
            // Deliver to recipient if online
            const recipient = onlineUsers.get(receiverId);
            if (recipient) {
              recipient.ws.send(JSON.stringify({
                type: "new_message",
                message: chatMsg,
                sender: user
              }));
            }
            break;
            
          case "mark_read":
            if (!userId) return;
            const { senderId } = message;
            await storage.markMessagesAsRead(senderId, userId);
            
            // Notify sender that messages were read
            const sender = onlineUsers.get(senderId);
            if (sender) {
              sender.ws.send(JSON.stringify({
                type: "messages_read",
                readBy: userId
              }));
            }
            break;
            
          case "typing":
            if (!userId) return;
            const typingRecipient = onlineUsers.get(message.receiverId);
            if (typingRecipient) {
              typingRecipient.ws.send(JSON.stringify({
                type: "user_typing",
                userId: userId,
                isTyping: message.isTyping
              }));
            }
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
      }
    });
    
    ws.on("close", () => {
      if (userId) {
        onlineUsers.delete(userId);
        broadcastPresence();
      }
    });
    
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      if (userId) {
        onlineUsers.delete(userId);
      }
    });
  });
  
  function broadcastPresence() {
    const onlineUserList = Array.from(onlineUsers.values()).map(u => ({
      id: u.user.id,
      fullName: u.user.fullName,
      username: u.user.username,
      avatarUrl: u.user.avatarUrl
    }));
    
    const presenceMessage = JSON.stringify({
      type: "presence_update",
      onlineUsers: onlineUserList
    });
    
    for (const { ws } of onlineUsers.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(presenceMessage);
      }
    }
  }
  
  // REST API for chat history
  app.get("/api/chat/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const conversations = await storage.getChatConversations(userId);
      
      // Enrich with user data
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const partner = await storage.getUser(conv.partnerId);
          return {
            ...conv,
            partner: partner ? { 
              id: partner.id, 
              fullName: partner.fullName, 
              username: partner.username,
              avatarUrl: partner.avatarUrl 
            } : null
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  
  app.get("/api/chat/messages/:partnerId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const { partnerId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const messages = await storage.getChatMessages(userId, partnerId, limit);
      
      // Mark messages as read
      await storage.markMessagesAsRead(partnerId, userId);
      
      res.json(messages.reverse()); // Return in chronological order
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  
  app.get("/api/chat/online-users", requireAuth, async (req, res) => {
    try {
      const onlineUserList = Array.from(onlineUsers.values()).map(u => ({
        id: u.user.id,
        fullName: u.user.fullName,
        username: u.user.username,
        avatarUrl: u.user.avatarUrl
      }));
      res.json(onlineUserList);
    } catch (error) {
      console.error("Failed to fetch online users:", error);
      res.status(500).json({ error: "Failed to fetch online users" });
    }
  });

  return httpServer;
}

// Helper function to apply customer criteria
interface CriteriaCondition {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
}

interface CriteriaGroup {
  id: string;
  logic: "AND" | "OR";
  conditions: CriteriaCondition[];
}

function evaluateCondition(customer: Customer, condition: CriteriaCondition): boolean {
  const value = customer[condition.field as keyof Customer];
  const condValue = condition.value;
  
  switch (condition.operator) {
    case "equals":
      return String(value || "") === String(condValue);
    case "notEquals":
      return String(value || "") !== String(condValue);
    case "contains":
      return String(value || "").toLowerCase().includes(String(condValue).toLowerCase());
    case "startsWith":
      return String(value || "").toLowerCase().startsWith(String(condValue).toLowerCase());
    case "endsWith":
      return String(value || "").toLowerCase().endsWith(String(condValue).toLowerCase());
    case "in":
      const inValues = Array.isArray(condValue) ? condValue : String(condValue).split(",").map(s => s.trim());
      return inValues.includes(String(value || ""));
    case "notIn":
      const notInValues = Array.isArray(condValue) ? condValue : String(condValue).split(",").map(s => s.trim());
      return !notInValues.includes(String(value || ""));
    default:
      return true;
  }
}

function evaluateGroup(customer: Customer, group: CriteriaGroup): boolean {
  if (group.conditions.length === 0) return true;
  
  if (group.logic === "AND") {
    return group.conditions.every(cond => evaluateCondition(customer, cond));
  } else {
    return group.conditions.some(cond => evaluateCondition(customer, cond));
  }
}

function applyCustomerCriteria(customers: Customer[], criteria: CriteriaGroup[]): Customer[] {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return customers;
  }
  
  return customers.filter(customer => {
    return criteria.every(group => evaluateGroup(customer, group));
  });
}
