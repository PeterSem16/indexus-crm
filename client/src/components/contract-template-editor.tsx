import { useState, useCallback, useRef, useEffect } from "react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  User,
  Building2,
  Package,
  FileText,
  Plus,
  Save,
  Eye,
  RotateCcw,
  Copy,
  ChevronDown,
  ChevronRight,
  Hash,
  Calendar,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Percent,
  DollarSign,
  Globe,
  Info,
} from "lucide-react";

const AVAILABLE_FIELDS = {
  customer: {
    label: "Zákazník",
    icon: User,
    fields: [
      { key: "customer.id", label: "ID zákazníka", type: "id" },
      { key: "customer.firstName", label: "Meno", type: "text" },
      { key: "customer.lastName", label: "Priezvisko", type: "text" },
      { key: "customer.fullName", label: "Celé meno", type: "text" },
      { key: "customer.email", label: "E-mail", type: "email" },
      { key: "customer.phone", label: "Telefón", type: "phone" },
      { key: "customer.dateOfBirth", label: "Dátum narodenia", type: "date" },
      { key: "customer.birthNumber", label: "Rodné číslo", type: "text" },
      { key: "customer.idCardNumber", label: "Číslo OP", type: "text" },
      { key: "customer.address", label: "Adresa", type: "address" },
      { key: "customer.city", label: "Mesto", type: "text" },
      { key: "customer.postalCode", label: "PSČ", type: "text" },
      { key: "customer.country", label: "Krajina", type: "text" },
      { key: "customer.companyName", label: "Názov spoločnosti", type: "text" },
      { key: "customer.ico", label: "IČO", type: "text" },
      { key: "customer.dic", label: "DIČ", type: "text" },
      { key: "customer.icDph", label: "IČ DPH", type: "text" },
      { key: "customer.bankAccount", label: "Bankový účet", type: "text" },
      { key: "customer.iban", label: "IBAN", type: "text" },
      { key: "customer.registrationDate", label: "Dátum registrácie", type: "date" },
      { key: "customer.status", label: "Stav", type: "status" },
    ],
  },
  billing: {
    label: "Fakturačná spoločnosť",
    icon: Building2,
    fields: [
      { key: "billing.companyName", label: "Názov spoločnosti", type: "text" },
      { key: "billing.legalName", label: "Právny názov", type: "text" },
      { key: "billing.address", label: "Adresa", type: "address" },
      { key: "billing.city", label: "Mesto", type: "text" },
      { key: "billing.postalCode", label: "PSČ", type: "text" },
      { key: "billing.country", label: "Krajina", type: "text" },
      { key: "billing.countryCode", label: "Kód krajiny", type: "text" },
      { key: "billing.taxId", label: "IČO", type: "text" },
      { key: "billing.vatId", label: "IČ DPH", type: "text" },
      { key: "billing.dic", label: "DIČ", type: "text" },
      { key: "billing.bankName", label: "Názov banky", type: "text" },
      { key: "billing.iban", label: "IBAN", type: "text" },
      { key: "billing.swift", label: "SWIFT/BIC", type: "text" },
      { key: "billing.email", label: "E-mail", type: "email" },
      { key: "billing.phone", label: "Telefón", type: "phone" },
      { key: "billing.website", label: "Web", type: "url" },
      { key: "billing.vatRate", label: "Sadzba DPH (%)", type: "percent" },
      { key: "billing.paymentTermsDays", label: "Splatnosť (dni)", type: "number" },
      { key: "billing.defaultCurrency", label: "Mena", type: "text" },
      { key: "billing.registrationInfo", label: "Registračné údaje", type: "text" },
      { key: "billing.courtRegistration", label: "Registrácia súd", type: "text" },
    ],
  },
  product: {
    label: "Produkt / Služba",
    icon: Package,
    fields: [
      { key: "product.name", label: "Názov produktu", type: "text" },
      { key: "product.code", label: "Kód produktu", type: "text" },
      { key: "product.description", label: "Popis", type: "text" },
      { key: "product.category", label: "Kategória", type: "text" },
      { key: "product.basePrice", label: "Základná cena", type: "currency" },
      { key: "product.currency", label: "Mena", type: "text" },
      { key: "product.vatRate", label: "Sadzba DPH (%)", type: "percent" },
      { key: "product.priceWithVat", label: "Cena s DPH", type: "currency" },
      { key: "product.validFrom", label: "Platnosť od", type: "date" },
      { key: "product.validTo", label: "Platnosť do", type: "date" },
      { key: "product.storageYears", label: "Roky uloženia", type: "number" },
      { key: "product.installments", label: "Počet splátok", type: "number" },
      { key: "product.monthlyPayment", label: "Mesačná splátka", type: "currency" },
      { key: "product.totalPrice", label: "Celková cena", type: "currency" },
      { key: "product.discount", label: "Zľava", type: "percent" },
      { key: "product.discountAmount", label: "Suma zľavy", type: "currency" },
      { key: "product.vatAmount", label: "Suma DPH", type: "currency" },
      { key: "product.totalPriceWords", label: "Celková cena slovom", type: "text" },
    ],
  },
  contract: {
    label: "Zmluva",
    icon: FileText,
    fields: [
      { key: "contract.number", label: "Číslo zmluvy", type: "id" },
      { key: "contract.date", label: "Dátum zmluvy", type: "date" },
      { key: "contract.validFrom", label: "Platnosť od", type: "date" },
      { key: "contract.validTo", label: "Platnosť do", type: "date" },
      { key: "contract.signatureDate", label: "Dátum podpisu", type: "date" },
      { key: "contract.signaturePlace", label: "Miesto podpisu", type: "text" },
      { key: "contract.totalAmount", label: "Celková suma", type: "currency" },
      { key: "contract.currency", label: "Mena", type: "text" },
      { key: "contract.paymentMethod", label: "Spôsob platby", type: "text" },
      { key: "contract.notes", label: "Poznámky", type: "text" },
      { key: "currentDate", label: "Dnešný dátum", type: "date" },
      { key: "currentYear", label: "Aktuálny rok", type: "number" },
    ],
  },
};

const DEFAULT_CONTRACT_TEMPLATE = `<div style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px;">

  <!-- Hlavička -->
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 18pt; font-weight: bold; margin-bottom: 5px; color: #1a1a1a;">
      ZMLUVA O UCHOVÁVANÍ KRVOTVORNÝCH BUNIEK
    </h1>
    <p style="font-size: 10pt; color: #666;">Číslo zmluvy: {{contract.number}}</p>
  </div>

  <!-- Zmluvné strany -->
  <div style="margin-bottom: 25px;">
    <h2 style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">
      I. ZMLUVNÉ STRANY
    </h2>
    
    <div style="margin-bottom: 15px;">
      <p style="font-weight: bold; margin-bottom: 5px;">Poskytovateľ:</p>
      <p style="margin: 0;">{{billing.companyName}}</p>
      <p style="margin: 0;">{{billing.address}}, {{billing.postalCode}} {{billing.city}}</p>
      <p style="margin: 0;">IČO: {{billing.taxId}}, DIČ: {{billing.dic}}, IČ DPH: {{billing.vatId}}</p>
      <p style="margin: 0;">Bankové spojenie: {{billing.bankName}}, IBAN: {{billing.iban}}</p>
      <p style="margin: 0;">Zapísaná: {{billing.courtRegistration}}</p>
      <p style="margin: 0; font-size: 10pt;">(ďalej len "Poskytovateľ")</p>
    </div>
    
    <div>
      <p style="font-weight: bold; margin-bottom: 5px;">Objednávateľ:</p>
      <p style="margin: 0;">{{customer.fullName}}</p>
      <p style="margin: 0;">Dátum narodenia: {{customer.dateOfBirth}}, Rodné číslo: {{customer.birthNumber}}</p>
      <p style="margin: 0;">Adresa: {{customer.address}}, {{customer.postalCode}} {{customer.city}}</p>
      <p style="margin: 0;">E-mail: {{customer.email}}, Tel: {{customer.phone}}</p>
      <p style="margin: 0; font-size: 10pt;">(ďalej len "Objednávateľ")</p>
    </div>
  </div>

  <!-- Predmet zmluvy -->
  <div style="margin-bottom: 25px;">
    <h2 style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">
      II. PREDMET ZMLUVY
    </h2>
    <p style="margin-bottom: 10px;">
      <strong>2.1</strong> Poskytovateľ sa zaväzuje poskytnúť Objednávateľovi službu <strong>{{product.name}}</strong> 
      v súlade s podmienkami stanovenými touto zmluvou.
    </p>
    <p style="margin-bottom: 10px;">
      <strong>2.2</strong> Popis služby: {{product.description}}
    </p>
    <p style="margin-bottom: 10px;">
      <strong>2.3</strong> Doba uloženia: {{product.storageYears}} rokov
    </p>
  </div>

  <!-- Cena a platobné podmienky -->
  <div style="margin-bottom: 25px;">
    <h2 style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">
      III. CENA A PLATOBNÉ PODMIENKY
    </h2>
    <p style="margin-bottom: 10px;">
      <strong>3.1</strong> Celková cena za poskytnutie služby: <strong>{{product.totalPrice}} {{product.currency}}</strong>
      (slovom: <em>{{product.totalPriceWords}}</em>)
    </p>
    <p style="margin-bottom: 10px;">
      <strong>3.2</strong> Cena bez DPH: {{product.basePrice}} {{product.currency}}
    </p>
    <p style="margin-bottom: 10px;">
      <strong>3.3</strong> DPH ({{product.vatRate}}%): {{product.vatAmount}} {{product.currency}}
    </p>
    <p style="margin-bottom: 10px;">
      <strong>3.4</strong> Spôsob platby: {{#if product.installments}}Splátky - {{product.installments}}x {{product.monthlyPayment}} {{product.currency}}/mesiac{{else}}Jednorazová platba{{/if}}
    </p>
    <p style="margin-bottom: 10px;">
      <strong>3.5</strong> Splatnosť faktúry: {{billing.paymentTermsDays}} dní od vystavenia
    </p>
  </div>

  <!-- Práva a povinnosti -->
  <div style="margin-bottom: 25px;">
    <h2 style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">
      IV. PRÁVA A POVINNOSTI ZMLUVNÝCH STRÁN
    </h2>
    <p style="margin-bottom: 10px;">
      <strong>4.1</strong> Poskytovateľ sa zaväzuje:
    </p>
    <ul style="margin-left: 20px; margin-bottom: 15px;">
      <li>poskytnúť služby v súlade s platnými predpismi a štandardami</li>
      <li>zabezpečiť odborné spracovanie a uchovávanie</li>
      <li>informovať Objednávateľa o všetkých podstatných skutočnostiach</li>
    </ul>
    <p style="margin-bottom: 10px;">
      <strong>4.2</strong> Objednávateľ sa zaväzuje:
    </p>
    <ul style="margin-left: 20px;">
      <li>uhradiť cenu za služby v stanovených termínoch</li>
      <li>poskytnúť potrebnú súčinnosť</li>
      <li>informovať o zmenách kontaktných údajov</li>
    </ul>
  </div>

  <!-- Záverečné ustanovenia -->
  <div style="margin-bottom: 25px;">
    <h2 style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">
      V. ZÁVEREČNÉ USTANOVENIA
    </h2>
    <p style="margin-bottom: 10px;">
      <strong>5.1</strong> Táto zmluva nadobúda platnosť dňom jej podpisu oboma zmluvnými stranami.
    </p>
    <p style="margin-bottom: 10px;">
      <strong>5.2</strong> Zmluva je vyhotovená v dvoch rovnopisoch, z ktorých každá zmluvná strana obdrží jeden.
    </p>
    <p style="margin-bottom: 10px;">
      <strong>5.3</strong> Akékoľvek zmeny a doplnky tejto zmluvy musia byť vykonané písomne.
    </p>
  </div>

  <!-- Podpisy -->
  <div style="margin-top: 50px;">
    <div style="display: flex; justify-content: space-between;">
      <div style="width: 45%; text-align: center;">
        <p style="margin-bottom: 5px;">V {{contract.signaturePlace}}, dňa {{contract.date}}</p>
        <div style="border-top: 1px solid #000; padding-top: 10px; margin-top: 60px;">
          <p style="font-weight: bold; margin: 0;">{{billing.companyName}}</p>
          <p style="font-size: 10pt; margin: 0;">Poskytovateľ</p>
        </div>
      </div>
      <div style="width: 45%; text-align: center;">
        <p style="margin-bottom: 5px;">V ________________, dňa {{contract.date}}</p>
        <div style="border-top: 1px solid #000; padding-top: 10px; margin-top: 60px;">
          <p style="font-weight: bold; margin: 0;">{{customer.fullName}}</p>
          <p style="font-size: 10pt; margin: 0;">Objednávateľ</p>
        </div>
      </div>
    </div>
  </div>

</div>`;

interface ContractTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  onLoadDefault?: () => void;
}

export function ContractTemplateEditor({ value, onChange, onLoadDefault }: ContractTemplateEditorProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    customer: true,
    billing: true,
    product: false,
    contract: false,
  });
  const [previewHtml, setPreviewHtml] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const insertField = useCallback((fieldKey: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const placeholder = `{{${fieldKey}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + placeholder + value.substring(end);
    
    onChange(newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);

    toast({
      title: "Pole vložené",
      description: `${placeholder}`,
    });
  }, [value, onChange, toast]);

  const copyField = useCallback((fieldKey: string) => {
    const placeholder = `{{${fieldKey}}}`;
    navigator.clipboard.writeText(placeholder);
    toast({
      title: "Skopírované",
      description: placeholder,
    });
  }, [toast]);

  const loadDefaultTemplate = useCallback(() => {
    onChange(DEFAULT_CONTRACT_TEMPLATE);
    toast({
      title: "Šablóna načítaná",
      description: "Predvolená šablóna zmluvy bola načítaná",
    });
  }, [onChange, toast]);

  const generatePreview = useCallback(() => {
    const sampleData: Record<string, string> = {
      "customer.id": "CUS-2024-001234",
      "customer.firstName": "Ján",
      "customer.lastName": "Novák",
      "customer.fullName": "Ján Novák",
      "customer.email": "jan.novak@email.sk",
      "customer.phone": "+421 900 123 456",
      "customer.dateOfBirth": "15.03.1985",
      "customer.birthNumber": "850315/1234",
      "customer.idCardNumber": "EA123456",
      "customer.address": "Hlavná 123",
      "customer.city": "Bratislava",
      "customer.postalCode": "811 01",
      "customer.country": "Slovensko",
      "billing.companyName": "CORD BLOOD SK, s.r.o.",
      "billing.legalName": "CORD BLOOD SK, s.r.o.",
      "billing.address": "Námestie slobody 10",
      "billing.city": "Bratislava",
      "billing.postalCode": "811 01",
      "billing.country": "Slovensko",
      "billing.countryCode": "SK",
      "billing.taxId": "12345678",
      "billing.vatId": "SK2012345678",
      "billing.dic": "2012345678",
      "billing.bankName": "Slovenská sporiteľňa",
      "billing.iban": "SK12 1234 5678 9012 3456 7890",
      "billing.swift": "GIBASKBX",
      "billing.email": "info@cordblood.sk",
      "billing.phone": "+421 2 1234 5678",
      "billing.website": "www.cordblood.sk",
      "billing.vatRate": "20",
      "billing.paymentTermsDays": "14",
      "billing.defaultCurrency": "EUR",
      "billing.registrationInfo": "OR Bratislava I, oddiel Sro, vložka 12345/B",
      "billing.courtRegistration": "Okresný súd Bratislava I, oddiel Sro, vložka 12345/B",
      "product.name": "Premium Plus - Uchovávanie kmeňových buniek",
      "product.code": "PP-25",
      "product.description": "Kompletné spracovanie a uchovávanie kmeňových buniek z pupočníkovej krvi na 25 rokov",
      "product.category": "Uchovávanie",
      "product.basePrice": "2 500,00",
      "product.currency": "EUR",
      "product.vatRate": "20",
      "product.priceWithVat": "3 000,00",
      "product.storageYears": "25",
      "product.installments": "24",
      "product.monthlyPayment": "125,00",
      "product.totalPrice": "3 000,00",
      "product.totalPriceWords": "tritisíc eur",
      "product.vatAmount": "500,00",
      "contract.number": "ZML-2024-00123",
      "contract.date": "04.01.2026",
      "contract.validFrom": "04.01.2026",
      "contract.validTo": "04.01.2051",
      "contract.signatureDate": "04.01.2026",
      "contract.signaturePlace": "Bratislava",
      "contract.totalAmount": "3 000,00",
      "contract.currency": "EUR",
      "currentDate": new Date().toLocaleDateString("sk-SK"),
      "currentYear": new Date().getFullYear().toString(),
    };

    let preview = value;
    Object.entries(sampleData).forEach(([key, val]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key.replace(".", "\\.")}\\}\\}`, "g"), val);
    });
    
    preview = preview.replace(/\{\{#if\s+\w+\.?\w*\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, "$1");
    preview = preview.replace(/\{\{#if\s+\w+\.?\w*\}\}([\s\S]*?)\{\{\/if\}\}/g, "$1");
    
    setPreviewHtml(preview);
    setIsPreviewOpen(true);
  }, [value]);

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "email": return Mail;
      case "phone": return Phone;
      case "address": return MapPin;
      case "date": return Calendar;
      case "id": return Hash;
      case "currency": return DollarSign;
      case "percent": return Percent;
      case "number": return Hash;
      case "url": return Globe;
      default: return Info;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      <div className="lg:col-span-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Dostupné polia</h3>
          <Badge variant="secondary" className="text-xs">Handlebars</Badge>
        </div>
        
        <ScrollArea className="flex-1 pr-2" style={{ maxHeight: "500px" }}>
          <div className="space-y-2">
            {Object.entries(AVAILABLE_FIELDS).map(([sectionKey, section]) => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections[sectionKey];
              
              return (
                <Collapsible
                  key={sectionKey}
                  open={isExpanded}
                  onOpenChange={() => toggleSection(sectionKey)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-2 py-1.5"
                      data-testid={`toggle-section-${sectionKey}`}
                    >
                      <div className="flex items-center gap-2">
                        <SectionIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{section.label}</span>
                        <Badge variant="outline" className="text-xs ml-1">
                          {section.fields.length}
                        </Badge>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pl-2 pt-1">
                    <div className="space-y-0.5">
                      {section.fields.map((field) => {
                        const FieldIcon = getFieldIcon(field.type);
                        return (
                          <div
                            key={field.key}
                            className="flex items-center justify-between group px-2 py-1 rounded-md hover-elevate cursor-pointer"
                            onClick={() => insertField(field.key)}
                            data-testid={`field-${field.key}`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FieldIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs truncate">{field.label}</span>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyField(field.key);
                                  }}
                                  data-testid={`copy-${field.key}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs">Kopírovať: {`{{${field.key}}}`}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </div>
      
      <div className="lg:col-span-2 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold">Obsah šablóny (HTML + Handlebars)</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDefaultTemplate}
              data-testid="button-load-default"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Načítať vzor
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generatePreview}
              data-testid="button-preview"
            >
              <Eye className="h-3 w-3 mr-1" />
              Náhľad
            </Button>
          </div>
        </div>
        
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Vložte HTML obsah šablóny zmluvy. Použite {{pole}} pre dynamické hodnoty..."
          className="flex-1 font-mono text-xs resize-none"
          style={{ minHeight: "400px" }}
          data-testid="textarea-template-content"
        />
        
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>Tip: Kliknutím na pole ho vložíte na pozíciu kurzora.</span>
          <span>|</span>
          <span>Syntax: {`{{pole.názov}}`}</span>
          <span>|</span>
          <span>Podmienky: {`{{#if pole}}...{{/if}}`}</span>
        </div>
      </div>

      {isPreviewOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <Card 
            className="max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Náhľad zmluvy</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPreviewOpen(false)}
                  data-testid="button-close-preview"
                >
                  Zavrieť
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[70vh]">
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_CONTRACT_TEMPLATE, AVAILABLE_FIELDS };
