import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, insertCustomerSchema, updateUserSchema, loginSchema,
  insertProductSchema, insertCustomerProductSchema, insertBillingDetailsSchema,
  insertCustomerNoteSchema, insertActivityLogSchema, sendEmailSchema, sendSmsSchema,
  insertComplaintTypeSchema, insertCooperationTypeSchema, insertVipStatusSchema, insertHealthInsuranceSchema,
  insertLaboratorySchema, insertHospitalSchema,
  type SafeUser, type Customer, type Product, type BillingDetails, type ActivityLog
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

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
        doc.fontSize(18).font("Helvetica-Bold").text("Nexus BioLink", { align: "left" });
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
      doc.text("Thank you for choosing Nexus BioLink for your cord blood banking needs.", { align: "center" });

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

  return httpServer;
}
