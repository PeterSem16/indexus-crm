import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, insertCustomerSchema, updateUserSchema, loginSchema,
  insertProductSchema, insertCustomerProductSchema, insertBillingDetailsSchema,
  insertCustomerNoteSchema, insertActivityLogSchema, sendEmailSchema, sendSmsSchema,
  insertComplaintTypeSchema, insertCooperationTypeSchema, insertVipStatusSchema, insertHealthInsuranceSchema,
  insertLaboratorySchema, insertHospitalSchema,
  insertCollaboratorSchema, insertCollaboratorAddressSchema, insertCollaboratorOtherDataSchema, insertCollaboratorAgreementSchema,
  insertLeadScoringCriteriaSchema,
  insertServiceConfigurationSchema, insertInvoiceTemplateSchema, insertInvoiceLayoutSchema,
  insertRoleSchema, insertRoleModulePermissionSchema, insertRoleFieldPermissionSchema,
  insertSavedSearchSchema,
  type SafeUser, type Customer, type Product, type BillingDetails, type ActivityLog, type LeadScoringCriteria,
  type ServiceConfiguration, type InvoiceTemplate, type InvoiceLayout, type Role
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
        const price = cp.priceOverride ? parseFloat(cp.priceOverride) : parseFloat(cp.product.price);
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
        currency: customerProducts[0]?.product.currency || "EUR",
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
          const price = cp.priceOverride ? parseFloat(cp.priceOverride) : parseFloat(cp.product.price);
          const lineTotal = price * cp.quantity;
          subtotal += lineTotal;

          const y = doc.y;
          doc.text(cp.product.name, 50, y, { width: 200 });
          doc.text(cp.quantity.toString(), 250, y, { width: 50, align: "center" });
          doc.text(`${price.toFixed(2)} ${cp.product.currency}`, 300, y, { width: 100, align: "right" });
          doc.text(`${lineTotal.toFixed(2)} ${cp.product.currency}`, 400, y, { width: 100, align: "right" });
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
            const price = cp.priceOverride ? parseFloat(cp.priceOverride) : parseFloat(cp.product.price);
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
            currency: customerProducts[0]?.product.currency || "EUR",
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
      const { country } = req.query;
      if (country && typeof country === 'string') {
        const details = await storage.getBillingDetailsByCountry(country);
        return res.json(details);
      }
      const details = await storage.getAllBillingDetails();
      res.json(details);
    } catch (error) {
      console.error("Error fetching billing details:", error);
      res.status(500).json({ error: "Failed to fetch billing details" });
    }
  });

  app.get("/api/billing-details/:id", requireAuth, async (req, res) => {
    try {
      // Check if it's an ID (UUID) or a country code
      const param = req.params.id;
      if (param.length === 2) {
        // Country code - get all for that country
        const details = await storage.getBillingDetailsByCountry(param);
        return res.json(details);
      }
      // Otherwise it's an ID
      const details = await storage.getBillingDetailsById(param);
      if (!details) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      res.json(details);
    } catch (error) {
      console.error("Error fetching billing details:", error);
      res.status(500).json({ error: "Failed to fetch billing details" });
    }
  });

  app.post("/api/billing-details", requireAuth, async (req, res) => {
    try {
      const validatedData = insertBillingDetailsSchema.parse(req.body);
      const details = await storage.createBillingDetails(validatedData);
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
      const details = await storage.updateBillingDetails(req.params.id, req.body);
      res.json(details);
    } catch (error) {
      console.error("Error updating billing company:", error);
      res.status(500).json({ error: "Failed to update billing company" });
    }
  });

  app.delete("/api/billing-details/:id", requireAuth, async (req, res) => {
    try {
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
            subtitle: p.category || "",
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
      const validatedData = insertServiceConfigurationSchema.parse(req.body);
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
      const service = await storage.updateServiceConfiguration(id, req.body);
      
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

  return httpServer;
}
