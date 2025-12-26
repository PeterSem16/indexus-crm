import { useState, useCallback, useRef } from "react";
import { Rnd } from "react-rnd";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Type,
  User,
  Building2,
  FileText,
  Plus,
  Trash2,
  Save,
  Eye,
  Settings,
  GripVertical,
  Image,
  Table,
  Minus,
  Square,
  RotateCcw,
  Copy,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Loader2,
  X,
} from "lucide-react";

export interface DesignerElement {
  id: string;
  type: "data-field" | "text-block" | "image" | "line" | "table" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  props: {
    fieldKey?: string;
    fieldLabel?: string;
    text?: string;
    fontSize?: number;
    fontWeight?: "normal" | "bold";
    textAlign?: "left" | "center" | "right";
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    imageUrl?: string;
    columns?: string[];
  };
}

export interface InvoiceDesignerConfig {
  elements: DesignerElement[];
  paperSize: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  margins: { top: number; bottom: number; left: number; right: number };
}

const AVAILABLE_FIELDS = {
  customer: [
    { key: "customer.fullName", label: "Customer Full Name" },
    { key: "customer.firstName", label: "First Name" },
    { key: "customer.lastName", label: "Last Name" },
    { key: "customer.email", label: "Email" },
    { key: "customer.phone", label: "Phone" },
    { key: "customer.address", label: "Address" },
    { key: "customer.city", label: "City" },
    { key: "customer.postalCode", label: "Postal Code" },
    { key: "customer.country", label: "Country" },
    { key: "customer.taxId", label: "Tax ID" },
    { key: "customer.companyName", label: "Company Name" },
    { key: "customer.ico", label: "ICO" },
    { key: "customer.dic", label: "DIC" },
    { key: "customer.icDph", label: "IC DPH" },
  ],
  billing: [
    { key: "billing.companyName", label: "Billing Company Name" },
    { key: "billing.address", label: "Billing Address" },
    { key: "billing.city", label: "Billing City" },
    { key: "billing.postalCode", label: "Billing Postal Code" },
    { key: "billing.country", label: "Billing Country" },
    { key: "billing.taxId", label: "Billing Tax ID" },
    { key: "billing.vatId", label: "Billing VAT ID" },
    { key: "billing.bankName", label: "Bank Name" },
    { key: "billing.iban", label: "IBAN" },
    { key: "billing.swift", label: "SWIFT" },
    { key: "billing.email", label: "Billing Email" },
    { key: "billing.phone", label: "Billing Phone" },
    { key: "billing.website", label: "Website" },
  ],
  invoice: [
    { key: "invoice.number", label: "Invoice Number" },
    { key: "invoice.date", label: "Invoice Date" },
    { key: "invoice.dueDate", label: "Due Date" },
    { key: "invoice.subtotal", label: "Subtotal" },
    { key: "invoice.vatAmount", label: "VAT Amount" },
    { key: "invoice.total", label: "Total Amount" },
    { key: "invoice.currency", label: "Currency" },
    { key: "invoice.paymentTerms", label: "Payment Terms" },
    { key: "invoice.variableSymbol", label: "Variable Symbol" },
    { key: "invoice.constantSymbol", label: "Constant Symbol" },
  ],
};

const PAPER_SIZES = {
  A4: { portrait: { width: 595, height: 842 }, landscape: { width: 842, height: 595 } },
  Letter: { portrait: { width: 612, height: 792 }, landscape: { width: 792, height: 612 } },
};

const CANVAS_SCALE = 0.8;

interface InvoiceDesignerProps {
  initialConfig?: InvoiceDesignerConfig;
  onSave: (config: InvoiceDesignerConfig) => void;
  onCancel: () => void;
}

export function InvoiceDesigner({ initialConfig, onSave, onCancel }: InvoiceDesignerProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [elements, setElements] = useState<DesignerElement[]>(initialConfig?.elements || []);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState<"A4" | "Letter">(initialConfig?.paperSize || "A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(initialConfig?.orientation || "portrait");
  const [margins, setMargins] = useState(initialConfig?.margins || { top: 40, bottom: 40, left: 40, right: 40 });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const canvasDimensions = PAPER_SIZES[paperSize][orientation];
  const scaledWidth = canvasDimensions.width * CANVAS_SCALE;
  const scaledHeight = canvasDimensions.height * CANVAS_SCALE;

  const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const getDefaultDimensions = (type: DesignerElement["type"]) => {
    switch (type) {
      case "line": return { width: 200, height: 2 };
      case "text-block": return { width: 150, height: 60 };
      case "image": return { width: 120, height: 80 };
      case "table": return { width: 400, height: 150 };
      case "rectangle": return { width: 150, height: 100 };
      default: return { width: 120, height: 20 };
    }
  };

  const addElement = useCallback((type: DesignerElement["type"], props: Partial<DesignerElement["props"]> = {}) => {
    const dimensions = getDefaultDimensions(type);
    const newElement: DesignerElement = {
      id: generateId(),
      type,
      x: 50,
      y: 50,
      width: dimensions.width,
      height: dimensions.height,
      props: {
        fontSize: 12,
        fontWeight: "normal",
        textAlign: "left",
        color: "#000000",
        backgroundColor: "transparent",
        borderColor: "#000000",
        borderWidth: 0,
        ...props,
      },
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedElement(newElement.id);
  }, []);

  const loadDefaultTemplate = useCallback(() => {
    const defaultElements: DesignerElement[] = [
      { id: generateId(), type: "image", x: 40, y: 40, width: 120, height: 60, props: { imageUrl: "", backgroundColor: "transparent" } },
      { id: generateId(), type: "text-block", x: 40, y: 110, width: 200, height: 25, props: { text: "INVOICE", fontSize: 24, fontWeight: "bold", color: "#1a1a1a" } },
      { id: generateId(), type: "data-field", x: 380, y: 40, width: 170, height: 20, props: { fieldKey: "billing.companyName", fieldLabel: "Billing Company Name", text: "{Billing Company Name}", fontSize: 14, fontWeight: "bold" } },
      { id: generateId(), type: "data-field", x: 380, y: 65, width: 170, height: 18, props: { fieldKey: "billing.address", fieldLabel: "Billing Address", text: "{Billing Address}", fontSize: 10 } },
      { id: generateId(), type: "data-field", x: 380, y: 85, width: 170, height: 18, props: { fieldKey: "billing.city", fieldLabel: "Billing City", text: "{Billing City}", fontSize: 10 } },
      { id: generateId(), type: "data-field", x: 380, y: 105, width: 170, height: 18, props: { fieldKey: "billing.taxId", fieldLabel: "Billing Tax ID", text: "{Billing Tax ID}", fontSize: 10 } },
      { id: generateId(), type: "line", x: 40, y: 145, width: 515, height: 2, props: { color: "#e0e0e0" } },
      { id: generateId(), type: "text-block", x: 40, y: 160, width: 100, height: 18, props: { text: "Invoice Number:", fontSize: 10, fontWeight: "bold", color: "#666666" } },
      { id: generateId(), type: "data-field", x: 145, y: 160, width: 100, height: 18, props: { fieldKey: "invoice.number", fieldLabel: "Invoice Number", text: "{Invoice Number}", fontSize: 10 } },
      { id: generateId(), type: "text-block", x: 40, y: 180, width: 100, height: 18, props: { text: "Date:", fontSize: 10, fontWeight: "bold", color: "#666666" } },
      { id: generateId(), type: "data-field", x: 145, y: 180, width: 100, height: 18, props: { fieldKey: "invoice.date", fieldLabel: "Invoice Date", text: "{Invoice Date}", fontSize: 10 } },
      { id: generateId(), type: "text-block", x: 40, y: 200, width: 100, height: 18, props: { text: "Due Date:", fontSize: 10, fontWeight: "bold", color: "#666666" } },
      { id: generateId(), type: "data-field", x: 145, y: 200, width: 100, height: 18, props: { fieldKey: "invoice.dueDate", fieldLabel: "Due Date", text: "{Due Date}", fontSize: 10 } },
      { id: generateId(), type: "text-block", x: 40, y: 240, width: 100, height: 18, props: { text: "Bill To:", fontSize: 12, fontWeight: "bold", color: "#1a1a1a" } },
      { id: generateId(), type: "data-field", x: 40, y: 260, width: 200, height: 18, props: { fieldKey: "customer.fullName", fieldLabel: "Customer Full Name", text: "{Customer Full Name}", fontSize: 11, fontWeight: "bold" } },
      { id: generateId(), type: "data-field", x: 40, y: 280, width: 200, height: 18, props: { fieldKey: "customer.address", fieldLabel: "Address", text: "{Address}", fontSize: 10 } },
      { id: generateId(), type: "data-field", x: 40, y: 300, width: 200, height: 18, props: { fieldKey: "customer.city", fieldLabel: "City", text: "{City}", fontSize: 10 } },
      { id: generateId(), type: "data-field", x: 40, y: 320, width: 200, height: 18, props: { fieldKey: "customer.email", fieldLabel: "Email", text: "{Email}", fontSize: 10 } },
      { id: generateId(), type: "table", x: 40, y: 360, width: 515, height: 180, props: { fontSize: 10 } },
      { id: generateId(), type: "line", x: 40, y: 560, width: 515, height: 2, props: { color: "#e0e0e0" } },
      { id: generateId(), type: "text-block", x: 380, y: 580, width: 80, height: 18, props: { text: "Subtotal:", fontSize: 10, textAlign: "right", color: "#666666" } },
      { id: generateId(), type: "data-field", x: 470, y: 580, width: 85, height: 18, props: { fieldKey: "invoice.subtotal", fieldLabel: "Subtotal", text: "{Subtotal}", fontSize: 10, textAlign: "right" } },
      { id: generateId(), type: "text-block", x: 380, y: 600, width: 80, height: 18, props: { text: "VAT:", fontSize: 10, textAlign: "right", color: "#666666" } },
      { id: generateId(), type: "data-field", x: 470, y: 600, width: 85, height: 18, props: { fieldKey: "invoice.vatAmount", fieldLabel: "VAT Amount", text: "{VAT Amount}", fontSize: 10, textAlign: "right" } },
      { id: generateId(), type: "text-block", x: 380, y: 625, width: 80, height: 22, props: { text: "Total:", fontSize: 14, fontWeight: "bold", textAlign: "right", color: "#1a1a1a" } },
      { id: generateId(), type: "data-field", x: 470, y: 625, width: 85, height: 22, props: { fieldKey: "invoice.total", fieldLabel: "Total Amount", text: "{Total Amount}", fontSize: 14, fontWeight: "bold", textAlign: "right" } },
      { id: generateId(), type: "line", x: 40, y: 660, width: 515, height: 2, props: { color: "#e0e0e0" } },
      { id: generateId(), type: "text-block", x: 40, y: 680, width: 100, height: 18, props: { text: "Bank Details:", fontSize: 10, fontWeight: "bold", color: "#666666" } },
      { id: generateId(), type: "data-field", x: 40, y: 700, width: 250, height: 18, props: { fieldKey: "billing.bankName", fieldLabel: "Bank Name", text: "{Bank Name}", fontSize: 10 } },
      { id: generateId(), type: "data-field", x: 40, y: 720, width: 250, height: 18, props: { fieldKey: "billing.iban", fieldLabel: "IBAN", text: "{IBAN}", fontSize: 10 } },
      { id: generateId(), type: "data-field", x: 40, y: 740, width: 150, height: 18, props: { fieldKey: "billing.swift", fieldLabel: "SWIFT", text: "{SWIFT}", fontSize: 10 } },
      { id: generateId(), type: "text-block", x: 40, y: 780, width: 515, height: 30, props: { text: "Thank you for your business!", fontSize: 10, textAlign: "center", color: "#666666" } },
    ];
    setElements(defaultElements);
    setSelectedElement(null);
  }, []);

  const addDataField = (fieldKey: string, fieldLabel: string) => {
    addElement("data-field", { fieldKey, fieldLabel, text: `{${fieldLabel}}` });
  };

  const updateElement = useCallback((id: string, updates: Partial<DesignerElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  }, []);

  const updateElementProps = useCallback((id: string, propUpdates: Partial<DesignerElement["props"]>) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === id ? { ...el, props: { ...el.props, ...propUpdates } } : el
      )
    );
  }, []);

  const handleImageUpload = useCallback(async (elementId: string, file: File) => {
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload/invoice-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      updateElementProps(elementId, { imageUrl: data.imageUrl });
      toast({
        title: t.common.saved || "Success",
        description: t.konfigurator.imageUploaded || "Image uploaded successfully",
      });
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: t.common.error || "Error",
        description: t.konfigurator.imageUploadFailed || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  }, [t, toast, updateElementProps]);

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedElement === id) {
      setSelectedElement(null);
    }
  }, [selectedElement]);

  const duplicateElement = useCallback((id: string) => {
    const element = elements.find((el) => el.id === id);
    if (element) {
      const newElement: DesignerElement = {
        ...element,
        id: generateId(),
        x: element.x + 20,
        y: element.y + 20,
      };
      setElements((prev) => [...prev, newElement]);
      setSelectedElement(newElement.id);
    }
  }, [elements]);

  const handleSave = () => {
    onSave({
      elements,
      paperSize,
      orientation,
      margins,
    });
  };

  const selectedEl = elements.find((el) => el.id === selectedElement);

  const renderElement = (element: DesignerElement, isPreview = false) => {
    const style: React.CSSProperties = {
      width: "100%",
      height: "100%",
      fontSize: element.props.fontSize,
      fontWeight: element.props.fontWeight,
      textAlign: element.props.textAlign as React.CSSProperties["textAlign"],
      color: element.props.color,
      backgroundColor: element.props.backgroundColor,
      border: element.props.borderWidth
        ? `${element.props.borderWidth}px solid ${element.props.borderColor}`
        : "none",
      display: "flex",
      alignItems: "center",
      justifyContent: element.props.textAlign === "center" ? "center" : element.props.textAlign === "right" ? "flex-end" : "flex-start",
      padding: "2px 4px",
      overflow: "hidden",
      boxSizing: "border-box",
    };

    switch (element.type) {
      case "data-field":
        return (
          <div style={style} className="select-none">
            <span className="text-muted-foreground italic">
              {element.props.fieldLabel || element.props.fieldKey}
            </span>
          </div>
        );
      case "text-block":
        if (editingText === element.id && !isPreview) {
          return (
            <Textarea
              value={element.props.text || ""}
              onChange={(e) => updateElementProps(element.id, { text: e.target.value })}
              onBlur={() => setEditingText(null)}
              autoFocus
              className="w-full h-full resize-none border-0 p-1"
              style={{ fontSize: element.props.fontSize }}
            />
          );
        }
        return (
          <div
            style={style}
            onDoubleClick={() => !isPreview && setEditingText(element.id)}
            className="select-none cursor-text whitespace-pre-wrap"
          >
            {element.props.text || "Double-click to edit"}
          </div>
        );
      case "line":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: element.props.color || "#000000",
            }}
          />
        );
      case "rectangle":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: element.props.backgroundColor || "transparent",
              border: `${element.props.borderWidth || 1}px solid ${element.props.borderColor || "#000000"}`,
            }}
          />
        );
      case "table":
        return (
          <div style={style} className="border text-xs">
            <table className="w-full h-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-1">Item</th>
                  <th className="border p-1">Qty</th>
                  <th className="border p-1">Price</th>
                  <th className="border p-1">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-1 text-muted-foreground italic">Items...</td>
                  <td className="border p-1"></td>
                  <td className="border p-1"></td>
                  <td className="border p-1"></td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      case "image":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: element.props.backgroundColor || "transparent",
              border: element.props.borderWidth
                ? `${element.props.borderWidth}px solid ${element.props.borderColor}`
                : "none",
            }}
          >
            {element.props.imageUrl ? (
              <img
                src={element.props.imageUrl}
                alt="Logo/Image"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground text-xs">
                <Image className="h-6 w-6 mb-1" />
                <span>Add image URL</span>
              </div>
            )}
          </div>
        );
      default:
        return <div style={style}>{element.type}</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex gap-4 p-4">
      <ScrollArea className="w-64 flex-shrink-0">
        <div className="flex flex-col gap-4 pr-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t.konfigurator.addElements || "Add Elements"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addElement("text-block", { text: "Text" })}
              data-testid="button-add-text"
            >
              <Type className="h-4 w-4 mr-2" />
              {t.konfigurator.textBlock || "Text Block"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addElement("line")}
              data-testid="button-add-line"
            >
              <Minus className="h-4 w-4 mr-2" />
              {t.konfigurator.line || "Line"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addElement("rectangle", { borderWidth: 1 })}
              data-testid="button-add-rectangle"
            >
              <Square className="h-4 w-4 mr-2" />
              {t.konfigurator.rectangle || "Rectangle"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addElement("table")}
              data-testid="button-add-table"
            >
              <Table className="h-4 w-4 mr-2" />
              {t.konfigurator.itemsTable || "Items Table"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addElement("image", { imageUrl: "" })}
              data-testid="button-add-image"
            >
              <Image className="h-4 w-4 mr-2" />
              {t.konfigurator.image || "Image / Logo"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              {t.konfigurator.customerFields || "Customer Fields"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {AVAILABLE_FIELDS.customer.map((field) => (
                  <Button
                    key={field.key}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7"
                    onClick={() => addDataField(field.key, field.label)}
                    data-testid={`button-field-${field.key}`}
                  >
                    {field.label}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t.konfigurator.billingFields || "Billing Fields"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {AVAILABLE_FIELDS.billing.map((field) => (
                  <Button
                    key={field.key}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7"
                    onClick={() => addDataField(field.key, field.label)}
                    data-testid={`button-field-${field.key}`}
                  >
                    {field.label}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t.konfigurator.invoiceFields || "Invoice Fields"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {AVAILABLE_FIELDS.invoice.map((field) => (
                  <Button
                    key={field.key}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7"
                    onClick={() => addDataField(field.key, field.label)}
                    data-testid={`button-field-${field.key}`}
                  >
                    {field.label}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        </div>
      </ScrollArea>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap border-b pb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onCancel} data-testid="button-close-designer">
              <X className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">{t.konfigurator.invoiceEditor}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Select value={paperSize} onValueChange={(v) => setPaperSize(v as "A4" | "Letter")}>
              <SelectTrigger className="w-24" data-testid="select-paper-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orientation} onValueChange={(v) => setOrientation(v as "portrait" | "landscape")}>
              <SelectTrigger className="w-28" data-testid="select-orientation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">{t.konfigurator.portrait}</SelectItem>
                <SelectItem value="landscape">{t.konfigurator.landscape}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadDefaultTemplate} data-testid="button-load-template">
              <RotateCcw className="h-4 w-4 mr-2" />
              {t.konfigurator.loadDefaultTemplate || "Load Template"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)} data-testid="button-preview">
              <Eye className="h-4 w-4 mr-2" />
              {t.konfigurator.preview || "Preview"}
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-design">
              {t.common.cancel}
            </Button>
            <Button size="sm" onClick={handleSave} data-testid="button-save-design">
              <Save className="h-4 w-4 mr-2" />
              {t.common.save}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-muted/50 rounded-lg p-4 flex justify-center">
          <div
            className="relative bg-white shadow-lg"
            style={{
              width: scaledWidth,
              height: scaledHeight,
              minWidth: scaledWidth,
              minHeight: scaledHeight,
            }}
            onClick={() => setSelectedElement(null)}
            data-testid="design-canvas"
          >
            <div
              className="absolute border border-dashed border-muted-foreground/30"
              style={{
                left: margins.left * CANVAS_SCALE,
                top: margins.top * CANVAS_SCALE,
                right: margins.right * CANVAS_SCALE,
                bottom: margins.bottom * CANVAS_SCALE,
              }}
            />
            {elements.map((element) => (
              <Rnd
                key={element.id}
                size={{ width: element.width * CANVAS_SCALE, height: element.height * CANVAS_SCALE }}
                position={{ x: element.x * CANVAS_SCALE, y: element.y * CANVAS_SCALE }}
                onDragStop={(e, d) => {
                  updateElement(element.id, {
                    x: d.x / CANVAS_SCALE,
                    y: d.y / CANVAS_SCALE,
                  });
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  updateElement(element.id, {
                    width: parseInt(ref.style.width) / CANVAS_SCALE,
                    height: parseInt(ref.style.height) / CANVAS_SCALE,
                    x: position.x / CANVAS_SCALE,
                    y: position.y / CANVAS_SCALE,
                  });
                }}
                bounds="parent"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedElement(element.id);
                }}
                className={`${selectedElement === element.id ? "ring-2 ring-primary ring-offset-1" : ""}`}
                enableResizing={selectedElement === element.id}
                dragHandleClassName="drag-handle"
              >
                <div className="w-full h-full relative group">
                  {selectedElement === element.id && (
                    <div className="absolute -top-6 left-0 flex items-center gap-1 bg-primary text-primary-foreground rounded px-1 py-0.5 text-xs drag-handle cursor-move">
                      <GripVertical className="h-3 w-3" />
                      <span className="capitalize">{element.type.replace("-", " ")}</span>
                    </div>
                  )}
                  {renderElement(element)}
                </div>
              </Rnd>
            ))}
          </div>
        </div>
      </div>

      <div className="w-64">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t.konfigurator.properties || "Properties"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="capitalize">
                    {selectedEl.type.replace("-", " ")}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => duplicateElement(selectedEl.id)}
                      data-testid="button-duplicate"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteElement(selectedEl.id)}
                      data-testid="button-delete-element"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <Separator />

                {(selectedEl.type === "text-block" || selectedEl.type === "data-field") && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">{t.konfigurator.fontSize || "Font Size"}</label>
                      <Input
                        type="number"
                        value={selectedEl.props.fontSize || 12}
                        onChange={(e) => updateElementProps(selectedEl.id, { fontSize: parseInt(e.target.value) || 12 })}
                        className="h-8"
                        data-testid="input-font-size"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium">{t.konfigurator.fontWeight || "Font Weight"}</label>
                      <Select
                        value={selectedEl.props.fontWeight || "normal"}
                        onValueChange={(v) => updateElementProps(selectedEl.id, { fontWeight: v as "normal" | "bold" })}
                      >
                        <SelectTrigger className="h-8" data-testid="select-font-weight">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium">{t.konfigurator.textAlign || "Text Align"}</label>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant={selectedEl.props.textAlign === "left" ? "default" : "outline"}
                          className="h-8 w-8"
                          onClick={() => updateElementProps(selectedEl.id, { textAlign: "left" })}
                        >
                          <AlignLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant={selectedEl.props.textAlign === "center" ? "default" : "outline"}
                          className="h-8 w-8"
                          onClick={() => updateElementProps(selectedEl.id, { textAlign: "center" })}
                        >
                          <AlignCenter className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant={selectedEl.props.textAlign === "right" ? "default" : "outline"}
                          className="h-8 w-8"
                          onClick={() => updateElementProps(selectedEl.id, { textAlign: "right" })}
                        >
                          <AlignRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium">{t.konfigurator.color || "Color"}</label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={selectedEl.props.color || "#000000"}
                      onChange={(e) => updateElementProps(selectedEl.id, { color: e.target.value })}
                      className="w-12 h-8 p-1"
                      data-testid="input-color"
                    />
                    <Input
                      value={selectedEl.props.color || "#000000"}
                      onChange={(e) => updateElementProps(selectedEl.id, { color: e.target.value })}
                      className="h-8 flex-1"
                    />
                  </div>
                </div>

                {(selectedEl.type === "rectangle" || selectedEl.type === "text-block") && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium">{t.konfigurator.backgroundColor || "Background"}</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={selectedEl.props.backgroundColor || "#ffffff"}
                        onChange={(e) => updateElementProps(selectedEl.id, { backgroundColor: e.target.value })}
                        className="w-12 h-8 p-1"
                        data-testid="input-bg-color"
                      />
                      <Input
                        value={selectedEl.props.backgroundColor || "transparent"}
                        onChange={(e) => updateElementProps(selectedEl.id, { backgroundColor: e.target.value })}
                        className="h-8 flex-1"
                      />
                    </div>
                  </div>
                )}

                {selectedEl.type === "image" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">{t.konfigurator.uploadImage || "Upload Image"}</Label>
                      <div className="flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && selectedEl) {
                              handleImageUpload(selectedEl.id, file);
                            }
                            e.target.value = "";
                          }}
                          data-testid="input-image-file"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage}
                          data-testid="button-upload-image"
                        >
                          {isUploadingImage ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {isUploadingImage ? (t.common.loading || "Uploading...") : (t.konfigurator.selectFile || "Select File")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.konfigurator.supportedFormats || "JPEG, PNG, GIF, WebP, SVG (max 5MB)"}
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">{t.konfigurator.imageUrl || "Or paste URL"}</Label>
                      <Input
                        value={selectedEl.props.imageUrl || ""}
                        onChange={(e) => updateElementProps(selectedEl.id, { imageUrl: e.target.value })}
                        placeholder="https://..."
                        className="h-8"
                        data-testid="input-image-url"
                      />
                    </div>
                    
                    {selectedEl.props.imageUrl && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">{t.konfigurator.preview || "Preview"}</Label>
                        <div className="border rounded-md p-2 bg-muted/50">
                          <img
                            src={selectedEl.props.imageUrl}
                            alt="Preview"
                            className="max-h-24 mx-auto object-contain"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-destructive"
                          onClick={() => updateElementProps(selectedEl.id, { imageUrl: "" })}
                          data-testid="button-remove-image"
                        >
                          <X className="h-4 w-4 mr-2" />
                          {t.konfigurator.removeImage || "Remove Image"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {selectedEl.type !== "line" && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium">{t.konfigurator.border || "Border"}</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={selectedEl.props.borderWidth || 0}
                        onChange={(e) => updateElementProps(selectedEl.id, { borderWidth: parseInt(e.target.value) || 0 })}
                        className="w-16 h-8"
                        min={0}
                        max={10}
                        data-testid="input-border-width"
                      />
                      <Input
                        type="color"
                        value={selectedEl.props.borderColor || "#000000"}
                        onChange={(e) => updateElementProps(selectedEl.id, { borderColor: e.target.value })}
                        className="w-12 h-8 p-1"
                        data-testid="input-border-color"
                      />
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-muted-foreground">X</label>
                    <Input
                      type="number"
                      value={Math.round(selectedEl.x)}
                      onChange={(e) => updateElement(selectedEl.id, { x: parseInt(e.target.value) || 0 })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground">Y</label>
                    <Input
                      type="number"
                      value={Math.round(selectedEl.y)}
                      onChange={(e) => updateElement(selectedEl.id, { y: parseInt(e.target.value) || 0 })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground">W</label>
                    <Input
                      type="number"
                      value={Math.round(selectedEl.width)}
                      onChange={(e) => updateElement(selectedEl.id, { width: parseInt(e.target.value) || 50 })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground">H</label>
                    <Input
                      type="number"
                      value={Math.round(selectedEl.height)}
                      onChange={(e) => updateElement(selectedEl.id, { height: parseInt(e.target.value) || 20 })}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t.konfigurator.selectElement || "Select an element to edit its properties"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t.konfigurator.invoicePreview || "Invoice Preview"}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-4 bg-muted rounded-lg">
            <div
              className="relative bg-white shadow-lg"
              style={{
                width: canvasDimensions.width,
                height: canvasDimensions.height,
                transform: "scale(0.7)",
                transformOrigin: "top center",
              }}
            >
              {elements.map((element) => (
                <div
                  key={element.id}
                  style={{
                    position: "absolute",
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                  }}
                >
                  {renderElement(element, true)}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              {t.common.close || "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
