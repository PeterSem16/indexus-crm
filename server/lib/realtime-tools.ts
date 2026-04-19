import { storage } from "../storage";

export const REALTIME_TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "lookup_customer",
    description: "Find a customer by phone number or email. Returns basic customer info including id, name, status. Use this at the start of a call to identify the caller.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Phone number (any format, including country prefix)" },
        email: { type: "string", description: "Email address" },
      },
    },
  },
  {
    type: "function",
    name: "get_contracts",
    description: "Get all contracts for a customer by customer ID. Returns contract number, status, and product info.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer ID returned by lookup_customer" },
      },
      required: ["customerId"],
    },
  },
  {
    type: "function",
    name: "get_documents",
    description: "Get documents related to a contract. Returns document type, name and signed status.",
    parameters: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "Contract ID returned by get_contracts" },
      },
      required: ["contractId"],
    },
  },
];

function normalizePhone(p: string): string {
  return (p || "").replace(/[^\d+]/g, "").replace(/^00/, "+");
}

export async function executeRealtimeTool(
  name: string,
  args: any
): Promise<{ ok: boolean; data?: any; error?: string; ms: number }> {
  const t0 = Date.now();
  try {
    if (name === "lookup_customer") {
      const phone = args?.phone ? normalizePhone(args.phone) : null;
      const email = args?.email ? String(args.email).trim().toLowerCase() : null;
      let results: any[] = [];
      if (phone) results = await storage.findCustomersByPhone(phone);
      if ((!results || results.length === 0) && email) {
        results = await storage.findCustomersByEmail(email);
      }
      const slim = (results || []).slice(0, 5).map((c: any) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(" "),
        status: c.status,
        countryCode: c.countryCode,
        phone: c.phone || c.mobile,
        email: c.email,
      }));
      return { ok: true, data: { count: slim.length, customers: slim }, ms: Date.now() - t0 };
    }

    if (name === "get_contracts") {
      const customerId = String(args?.customerId || "");
      if (!customerId) return { ok: false, error: "customerId required", ms: Date.now() - t0 };
      const contracts = await storage.getContractInstancesByCustomer(customerId);
      const slim = (contracts || []).slice(0, 10).map((c: any) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        status: c.status,
        signedAt: c.signedAt,
        createdAt: c.createdAt,
        countryCode: c.countryCode,
      }));
      return { ok: true, data: { count: slim.length, contracts: slim }, ms: Date.now() - t0 };
    }

    if (name === "get_documents") {
      const contractId = String(args?.contractId || "");
      if (!contractId) return { ok: false, error: "contractId required", ms: Date.now() - t0 };
      const products = await storage.getContractInstanceProducts(contractId);
      const participants = await storage.getContractParticipants(contractId);
      const sigReqs = await storage.getContractSignatureRequests(contractId);
      return {
        ok: true,
        data: {
          products: (products || []).map((p: any) => ({ id: p.id, name: p.productName, qty: p.quantity })),
          participants: (participants || []).map((p: any) => ({ id: p.id, name: p.name, role: p.role, signed: !!p.signedAt })),
          signatureRequests: (sigReqs || []).map((s: any) => ({ id: s.id, status: s.status, sentAt: s.sentAt })),
        },
        ms: Date.now() - t0,
      };
    }

    return { ok: false, error: `Unknown tool: ${name}`, ms: Date.now() - t0 };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Tool execution failed", ms: Date.now() - t0 };
  }
}
