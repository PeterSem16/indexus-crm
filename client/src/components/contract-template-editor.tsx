import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
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
  Percent,
  DollarSign,
  Globe,
  Info,
  Code,
  Type,
  Image,
  SeparatorHorizontal,
  Table,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Receipt,
  CreditCard,
  Tags,
  Calculator,
  Layers,
} from "lucide-react";
import Editor, { BtnBold, BtnItalic, BtnUnderline, BtnStrikeThrough, BtnUndo, BtnRedo, BtnBulletList, BtnNumberedList, BtnLink, Separator as EditorSeparator, Toolbar } from "react-simple-wysiwyg";

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
      { key: "billing.representative", label: "Zástupca / Splnomocnenec", type: "text" },
    ],
  },
  father: {
    label: "Otec",
    icon: User,
    fields: [
      { key: "father.fullName", label: "Celé meno", type: "text" },
      { key: "father.firstName", label: "Meno", type: "text" },
      { key: "father.lastName", label: "Priezvisko", type: "text" },
      { key: "father.address", label: "Adresa", type: "address" },
      { key: "father.city", label: "Mesto", type: "text" },
      { key: "father.postalCode", label: "PSČ", type: "text" },
      { key: "father.dateOfBirth", label: "Dátum narodenia", type: "date" },
      { key: "father.birthNumber", label: "Rodné číslo", type: "text" },
      { key: "father.email", label: "E-mail", type: "email" },
      { key: "father.phone", label: "Telefón", type: "phone" },
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
  billset: {
    label: "Cenová sada (Billset)",
    icon: Receipt,
    fields: [
      { key: "billset.name", label: "Názov cenovej sady", type: "text" },
      { key: "billset.productName", label: "Názov produktu", type: "text" },
      { key: "billset.currency", label: "Mena", type: "text" },
      { key: "billset.validFrom", label: "Platnosť od", type: "date" },
      { key: "billset.validTo", label: "Platnosť do", type: "date" },
      { key: "billset.notes", label: "Poznámky", type: "text" },
      { key: "billset.totalNetAmount", label: "Celkom bez DPH", type: "currency" },
      { key: "billset.totalDiscountAmount", label: "Celková zľava", type: "currency" },
      { key: "billset.totalVatAmount", label: "Celková DPH", type: "currency" },
      { key: "billset.totalGrossAmount", label: "Celkom s DPH", type: "currency" },
    ],
  },
  billsetItems: {
    label: "Položky cenovej sady",
    icon: Layers,
    fields: [
      { key: "billset.items", label: "Všetky položky (loop)", type: "loop" },
      { key: "item.name", label: "Názov položky", type: "text" },
      { key: "item.type", label: "Typ (odber/služba)", type: "text" },
      { key: "item.quantity", label: "Množstvo", type: "number" },
      { key: "item.unitPrice", label: "Jednotková cena", type: "currency" },
      { key: "item.discountPercent", label: "Zľava %", type: "percent" },
      { key: "item.discountAmount", label: "Suma zľavy", type: "currency" },
      { key: "item.vatRate", label: "Sadzba DPH %", type: "percent" },
      { key: "item.vatAmount", label: "Suma DPH", type: "currency" },
      { key: "item.netAmount", label: "Suma bez DPH", type: "currency" },
      { key: "item.grossAmount", label: "Suma s DPH", type: "currency" },
    ],
  },
  paymentConditions: {
    label: "Platobné podmienky",
    icon: CreditCard,
    fields: [
      { key: "payment.method", label: "Spôsob platby", type: "text" },
      { key: "payment.installments", label: "Počet splátok", type: "number" },
      { key: "payment.installmentAmount", label: "Výška splátky", type: "currency" },
      { key: "payment.firstPaymentDue", label: "Prvá splátka do", type: "date" },
      { key: "payment.frequency", label: "Frekvencia", type: "text" },
      { key: "payment.depositAmount", label: "Záloha", type: "currency" },
      { key: "payment.remainingAmount", label: "Zostatok", type: "currency" },
    ],
  },
  discounts: {
    label: "Zľavy",
    icon: Tags,
    fields: [
      { key: "discount.name", label: "Názov zľavy", type: "text" },
      { key: "discount.type", label: "Typ (% / suma)", type: "text" },
      { key: "discount.value", label: "Hodnota", type: "text" },
      { key: "discount.amount", label: "Suma zľavy", type: "currency" },
      { key: "discount.validFrom", label: "Platnosť od", type: "date" },
      { key: "discount.validTo", label: "Platnosť do", type: "date" },
      { key: "discount.reason", label: "Dôvod", type: "text" },
    ],
  },
  vatInfo: {
    label: "DPH informácie",
    icon: Calculator,
    fields: [
      { key: "vat.rate", label: "Sadzba DPH %", type: "percent" },
      { key: "vat.baseAmount", label: "Základ dane", type: "currency" },
      { key: "vat.amount", label: "Suma DPH", type: "currency" },
      { key: "vat.exemptReason", label: "Dôvod oslobodenia", type: "text" },
    ],
  },
};

// Special elements that can be inserted into the template
const SPECIAL_ELEMENTS = {
  pageBreak: {
    label: "Zalomenie strany",
    icon: SeparatorHorizontal,
    html: '<div style="page-break-after: always; border-bottom: 1px dashed #ccc; margin: 20px 0; padding: 5px; text-align: center; color: #999; font-size: 10px;">[ZALOMENIE STRANY]</div>',
  },
  invoiceTable: {
    label: "Tabuľka položiek (Invoice)",
    icon: Table,
    html: `<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
      <th style="padding: 10px; text-align: left; font-weight: bold;">Položka</th>
      <th style="padding: 10px; text-align: center; font-weight: bold;">Množstvo</th>
      <th style="padding: 10px; text-align: right; font-weight: bold;">Cena/ks</th>
      <th style="padding: 10px; text-align: right; font-weight: bold;">Zľava</th>
      <th style="padding: 10px; text-align: right; font-weight: bold;">DPH</th>
      <th style="padding: 10px; text-align: right; font-weight: bold;">Celkom</th>
    </tr>
  </thead>
  <tbody>
    {{#each billset.items}}
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px;">{{this.name}}</td>
      <td style="padding: 8px; text-align: center;">{{this.quantity}}</td>
      <td style="padding: 8px; text-align: right;">{{this.unitPrice}} {{../billset.currency}}</td>
      <td style="padding: 8px; text-align: right;">{{this.discountAmount}} {{../billset.currency}}</td>
      <td style="padding: 8px; text-align: right;">{{this.vatAmount}} {{../billset.currency}}</td>
      <td style="padding: 8px; text-align: right; font-weight: bold;">{{this.grossAmount}} {{../billset.currency}}</td>
    </tr>
    {{/each}}
  </tbody>
  <tfoot>
    <tr style="border-top: 2px solid #ddd;">
      <td colspan="5" style="padding: 10px; text-align: right; font-weight: bold;">Medzisúčet:</td>
      <td style="padding: 10px; text-align: right;">{{billset.totalNetAmount}} {{billset.currency}}</td>
    </tr>
    <tr>
      <td colspan="5" style="padding: 5px; text-align: right;">Zľava:</td>
      <td style="padding: 5px; text-align: right; color: green;">-{{billset.totalDiscountAmount}} {{billset.currency}}</td>
    </tr>
    <tr>
      <td colspan="5" style="padding: 5px; text-align: right;">DPH:</td>
      <td style="padding: 5px; text-align: right;">{{billset.totalVatAmount}} {{billset.currency}}</td>
    </tr>
    <tr style="background: #f5f5f5; font-weight: bold; font-size: 1.1em;">
      <td colspan="5" style="padding: 10px; text-align: right;">CELKOM:</td>
      <td style="padding: 10px; text-align: right;">{{billset.totalGrossAmount}} {{billset.currency}}</td>
    </tr>
  </tfoot>
</table>`,
  },
  priceBreakdown: {
    label: "Rozpis ceny (kompaktný)",
    icon: Receipt,
    html: `<div style="background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin: 15px 0;">
  <h4 style="margin: 0 0 10px 0; font-size: 12pt; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Cenová kalkulácia</h4>
  <div style="display: flex; justify-content: space-between; padding: 5px 0;">
    <span>Základ:</span>
    <span>{{billset.totalNetAmount}} {{billset.currency}}</span>
  </div>
  {{#if billset.totalDiscountAmount}}
  <div style="display: flex; justify-content: space-between; padding: 5px 0; color: green;">
    <span>Zľava:</span>
    <span>-{{billset.totalDiscountAmount}} {{billset.currency}}</span>
  </div>
  {{/if}}
  <div style="display: flex; justify-content: space-between; padding: 5px 0;">
    <span>DPH ({{vat.rate}}%):</span>
    <span>{{billset.totalVatAmount}} {{billset.currency}}</span>
  </div>
  <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #333; font-weight: bold; font-size: 1.1em;">
    <span>CELKOM:</span>
    <span>{{billset.totalGrossAmount}} {{billset.currency}}</span>
  </div>
</div>`,
  },
  paymentSchedule: {
    label: "Splátkový kalendár",
    icon: CreditCard,
    html: `<div style="margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px;">
  <h4 style="margin: 0 0 10px 0; font-size: 12pt;">Platobné podmienky</h4>
  <p><strong>Spôsob platby:</strong> {{payment.method}}</p>
  {{#if payment.installments}}
  <p><strong>Počet splátok:</strong> {{payment.installments}}</p>
  <p><strong>Výška splátky:</strong> {{payment.installmentAmount}} {{billset.currency}}</p>
  <p><strong>Frekvencia:</strong> {{payment.frequency}}</p>
  {{#if payment.depositAmount}}
  <p><strong>Záloha:</strong> {{payment.depositAmount}} {{billset.currency}}</p>
  {{/if}}
  {{else}}
  <p><strong>Platba:</strong> Jednorazová</p>
  {{/if}}
  <p><strong>Splatnosť:</strong> {{billing.paymentTermsDays}} dní od vystavenia faktúry</p>
</div>`,
  },
  signaturePlaceholder: {
    label: "Podpisové pole",
    icon: FileText,
    html: `<div style="margin-top: 50px; display: flex; justify-content: space-between;">
  <div style="width: 45%; text-align: center;">
    <div style="border-top: 1px solid #333; padding-top: 5px; margin-top: 60px;">
      <p style="margin: 5px 0; font-size: 10pt;">{{billing.companyName}}</p>
      <p style="margin: 0; font-size: 9pt; color: #666;">Poskytovateľ</p>
    </div>
  </div>
  <div style="width: 45%; text-align: center;">
    <div style="border-top: 1px solid #333; padding-top: 5px; margin-top: 60px;">
      <p style="margin: 5px 0; font-size: 10pt;">{{customer.fullName}}</p>
      <p style="margin: 0; font-size: 9pt; color: #666;">Objednávateľ</p>
    </div>
  </div>
</div>`,
  },
  imagePlaceholder: {
    label: "Obrázok / Logo",
    icon: Image,
    html: '<div style="text-align: center; padding: 20px; border: 1px dashed #ccc; margin: 10px 0;"><img src="{{company.logoUrl}}" alt="Logo" style="max-width: 200px; max-height: 100px;" /><p style="font-size: 9pt; color: #999; margin-top: 5px;">[Logo spoločnosti]</p></div>',
  },
};

const DEFAULT_CONTRACT_TEMPLATE = `<div style="font-family: 'Times New Roman', serif; font-size: 9pt; line-height: 1.35; max-width: 900px; margin: 0 auto; padding: 20px;">

  <!-- Hlavička zmluvy -->
  <div style="text-align: center; margin-bottom: 15px;">
    <h1 style="font-size: 14pt; font-weight: bold; margin-bottom: 5px; color: #000;">Zmluva o odbere</h1>
    <p style="font-size: 10pt; margin: 5px 0;">číslo zmluvy: {{contract.number}}</p>
    <p style="font-size: 8pt; color: #333; margin-top: 8px;">uzavretá podľa § 262 ods. 1 a § 269 ods. 2 zákona č. 513/1991 Zb. Obchodný zákonník v znení neskorších predpisov (ďalej len „Obchodný zákonník")</p>
  </div>

  <!-- Zmluvné strany - dvojstĺpcové rozloženie -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 15px; gap: 20px;">
    <div style="width: 48%;">
      <p style="font-weight: bold; margin-bottom: 5px;">medzi</p>
      <p style="margin: 2px 0;"><strong>{{billing.companyName}}</strong></p>
      <p style="margin: 2px 0; font-size: 8pt;">so sídlom: {{billing.address}}, {{billing.postalCode}} {{billing.city}}, {{billing.country}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">Identifikačné číslo: {{billing.taxId}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">Daňové Identifikačné číslo: {{billing.dic}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">Identifikačné číslo DPH: {{billing.vatId}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">Zastúpená na základe plnomocenstva: {{billing.representative}}, splnomocnenec</p>
      <p style="margin: 2px 0; font-size: 8pt;">IBAN: {{billing.iban}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">SWIFT: {{billing.swift}}</p>
      <p style="margin: 5px 0; font-size: 8pt; font-style: italic;">(ďalej ako spoločnosť „CBC AG" v príslušnom ženskom rode)</p>
    </div>
    <div style="width: 48%;">
      <p style="font-weight: bold; margin-bottom: 5px;">a</p>
      <p style="margin: 2px 0;">pani: <strong>{{customer.fullName}}</strong> (ďalej len „RODIČKA")</p>
      <p style="margin: 2px 0; font-size: 8pt;">trvale bytom: {{customer.address}}, {{customer.postalCode}} {{customer.city}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">dátum narodenia: {{customer.dateOfBirth}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">rodné číslo: {{customer.birthNumber}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">e-mail: {{customer.email}}</p>
      <p style="margin: 2px 0; font-size: 8pt;">telefón: {{customer.phone}}</p>
      <p style="margin: 5px 0; font-size: 8pt;">a</p>
      <p style="margin: 2px 0;">pán: <strong>{{father.fullName}}</strong> (ďalej len „Otec")</p>
      <p style="margin: 2px 0; font-size: 8pt;">trvale bytom: {{father.address}}, {{father.postalCode}} {{father.city}}</p>
    </div>
  </div>

  <p style="text-align: center; margin-bottom: 15px; font-size: 8pt;">(ďalej len „Zmluva") takto:</p>

  <!-- Článok I - Preambula -->
  <div style="margin-bottom: 12px;">
    <h2 style="font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 8px;">Článok I - Preambula</h2>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>I.1</strong> Zmluvné strany sa dohodli, že túto Zmluvu uzatvárajú podľa § 262 ods. 1 Obchodného zákonníka a v zmysle § 269 ods. 2 Obchodného zákonníka.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>I.2</strong> Zmluvné strany vyhlasujú, že túto Zmluvu uzatvárajú slobodne, vážne a bez omylu, že sú spôsobilé na právne úkony v plnom rozsahu, obsah Zmluvy im je dobre známy v celom jeho rozsahu a Zmluvu neuzatvárajú v tiesni alebo za nápadne nevýhodných podmienok.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>I.3</strong> CBC AG je obchodná spoločnosť založená a existujúca podľa práva Švajčiarskej konfederácie, ktorá zabezpečuje niektoré činnosti registra pupočníkovej a placentárnej krvi, tkaniva pupočníka a placenty, pričom predmetná činnosť zahŕňa najmä zabezpečenie odberu krvotvorných kmeňových buniek z pupočníkovej a placentárnej krvi a tkaniva pupočníka a placenty zdravotníckym zariadením pri pôrode dieťaťa RODIČKY a ich následné spracovanie na autológnu transplantáciu.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>I.4</strong> CBC AG so súhlasom RODIČKY zabezpečuje činnosti podľa bodu I.3 a plní si svoje povinnosti v súlade s ustanovením bodu VI.1 tejto Zmluvy prostredníctvom na takúto činnosť riadne licencovaného subjektu na území Slovenskej republiky (Slovenský register placentárnych krvotvorných buniek, Dúbravská cesta 9, 841 04 Bratislava, IČO: 31771165 (ďalej len „S.R.P.K.B."), resp. iným riadne licencovaným subjektom v Slovenskej republike). Pre vylúčenie akýchkoľvek pochybností, sa zmluvné strany dohodli, že plnenie akýchkoľvek povinností, záväzkov a práv CBC AG podľa tejto Zmluvy, ktoré by spočívalo vo vykonávaní akejkoľvek činnosti, podliehajúcej osobitnej regulácii poskytovania zdravotnej starostlivosti v Slovenskej republike, bude tieto CBC AG vždy zabezpečovať výlučne prostredníctvom riadne licencovaného subjektu v Slovenskej republike.</p>
  </div>

  <!-- Článok II - Predmet Zmluvy -->
  <div style="margin-bottom: 12px;">
    <h2 style="font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 8px;">Článok II - Predmet Zmluvy</h2>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>II.1</strong> Predmetom záväzku CBC AG podľa tejto Zmluvy pre RODIČKU je zabezpečenie odberu pupočníkovej a/alebo placentárnej krvi (ďalej len „krv") a/alebo tkaniva pupočníka a/alebo placenty (ďalej len „tkanivo") zdravotníckym zariadením pri pôrode dieťaťa RODIČKY, ich následné spracovanie (ďalej spoločne len "transplantát"), ako aj na základe záujmu RODIČKY zabezpečenie následného skladovania transplantátu za podmienok nižšie uvedených v Zmluve.</p>
  </div>

  <!-- Článok III – Zabezpečenie činností -->
  <div style="margin-bottom: 12px;">
    <h2 style="font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 8px;">Článok III – Zabezpečenie činností</h2>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>III.1</strong> RODIČKA podpisom Zmluvy vyjadruje svoj výslovný súhlas so zabezpečením činností CBC AG v súlade s bodom II.1 Zmluvy, pričom sa zaväzuje zaplatiť dohodnutú odplatu podľa tejto Zmluvy. Zabezpečenie skladovania transplantátu bude medzi zmluvnými stranami upravené prostredníctvom osobitnej Zmluvy o skladovaní.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>III.2</strong> Transplantát môže byť použitý na autológnu transplantáciu. Transplantát môže byť pripravený spracovaním z pupočníkovej krvi (ďalej ako „Produkt Štandard") alebo z pupočníkovej a placentárnej krvi alebo iba z placentárnej krvi (ďalej ako „Produkt Prémium") alebo z pupočníkovej krvi a tkaniva pupočníka (ďalej ako „Produkt Štandard + tkanivo pupočníka") alebo z pupočníkovej a placentárnej krvi alebo iba z placentárnej krvi a tkaniva pupočníka (ďalej ako „Produkt Prémium + tkanivo pupočníka") alebo z pupočníkovej a placentárnej krvi alebo iba z placentárnej krvi a tkaniva pupočníka a tkaniva placenty (ďalej ako „Produkt Prémium + tkanivo pupočníka + tkanivo placenty") alebo iba z tkaniva pupočníka (ďalej ako „Produkt Tkanivo pupočníka").</p>
  </div>

  <!-- Článok IV - Transplantát -->
  <div style="margin-bottom: 12px;">
    <h2 style="font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 8px;">Článok IV - Transplantát</h2>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.1</strong> CBC AG je povinná zabezpečiť spracovanie krvi a/alebo tkaniva na transplantát alebo časti transplantátu RODIČKE v stave použiteľnom na účely autológnej transplantácie, pokiaľ nie je v Zmluve uvedené inak alebo pokiaľ sa zmluvné strany nedohodnú inak. RODIČKA berie na vedomie, že transplantáciu do tela príjemcu je možné uskutočniť výlučne len, ak to zdravotný stav príjemcu dovoľuje podľa posúdenia ošetrujúcim, prípadne iným príslušným lekárom a príjemca, resp. jeho zákonný zástupca pred transplantáciou riadne poskytol informovaný súhlas po jeho predchádzajúcom poučení, pričom výber príjemcu sa riadi výlučne medicínskym hľadiskom.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.2</strong> Transplantát sa v zmysle Zmluvy považuje za použiteľný na účely autológnej transplantácie, ak:</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">a) odobratá krv a/alebo tkanivo je/sú spracovaná/é v súlade s platnou právnou úpravou a odbornými postupmi,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">b) transplantát je v momente jeho vydania riadne vyšetrený a boli vykonané požadované testy v súlade s platnou právnou úpravou,</p>
    <p style="margin-bottom: 6px; text-align: justify; margin-left: 20px;">c) je stanovený počet jadrových buniek v krvi.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.3</strong> Po spracovaní krvi a/alebo tkaniva bude S.R.P.K.B. písomne informovať RODIČKU o použiteľnosti transplantátu, ako aj o výsledkoch spracovania krvi a/alebo tkaniva (ďalej len „Výsledky spracovania"). Na základe Výsledkov spracovania má RODIČKA právo rozhodnúť sa, že nevyužije svoje právo na akceptáciu pripraveného transplantátu, a teda pripravený transplantát odmietne a tým ho zároveň daruje S.R.P.K.B. na vedecké a medicínske účely alebo na zabezpečenie jeho likvidácie v súlade s príslušnými právnymi predpismi, s čím RODIČKA výslovne súhlasí.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.4</strong> V prípade, ak sa RODIČKA rozhodne pre odmietnutie a darovanie pripraveného transplantátu, je povinná túto skutočnosť bezodkladne, najneskôr do 14 kalendárnych dní odo dňa doručenia Výsledkov spracovania, písomne oznámiť CBC AG, ak v Zmluve nie je uvedené inak. Za moment akceptácie sa pritom považuje okamih zaplatenia celej odplaty v zmysle bodu V.1 tejto Zmluvy a následné zabezpečenie transplantátu na účely jeho skladovania podľa osobitnej Zmluvy o skladovaní uzavretej medzi zmluvnými stranami alebo iným Subjektom (tak ako je definovaný v bode IV.9 nižšie) v súlade s a za podmienok tejto Zmluvy.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.5</strong> V súvislosti s odberom a spracovaním krvi a/alebo tkaniva na transplantát RODIČKA:</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">a) je povinná pred odberom krvi a/alebo tkaniva vyplniť Dotazník pre rodičku a poskytnúť všetky údaje požadované v tomto dotazníku úplne, pravdivo a správne,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">b) je povinná pred odberom krvi a/alebo tkaniva podpísať informovaný súhlas vyžadovaný platnou právnou úpravou,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">c) je povinná bezodkladne informovať CBC AG o akejkoľvek zmene údajov uvedených v Dotazníku pre rodičku,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">d) je povinná poskytnúť CBC AG, resp. S.R.P.K.B. alebo inému licencovanému subjektu v Slovenskej republike, prostredníctvom ktorého CBC AG plní Zmluvu, alebo príslušnému zdravotníckemu zariadeniu, vzorky krvi potrebné na vykonanie vyšetrení a testov podľa platnej právnej úpravy,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">e) má právo kedykoľvek od CBC AG požadovať podrobné informácie o predmete plnenia podľa tejto Zmluvy,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">f) má právo nahliadať do dokumentácie CBC AG súvisiacej s plnením tejto Zmluvy za prítomnosti oprávneného zamestnanca CBC AG alebo S.R.P.K.B.,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">g) má právo kedykoľvek písomne odstúpiť od Zmluvy bez akýchkoľvek sankcií pred vykonaním odberu,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">h) má právo sa do 14 kalendárnych dní odo dňa doručenia Výsledkov spracovania rozhodnúť, či využije právo na akceptáciu transplantátu alebo ho odmietne a daruje S.R.P.K.B. na vedecké a medicínske účely alebo na zabezpečenie jeho likvidácie v súlade s príslušnými právnymi predpismi; v prípade odmietnutia je RODIČKA povinná zaslať CBC AG doporučený list,</p>
    <p style="margin-bottom: 6px; text-align: justify; margin-left: 20px;">i) v prípade mikrobiologickej kontaminácie transplantátu má právo písomne odstúpiť od celej Zmluvy alebo od časti Zmluvy týkajúcej sa kontaminovaného transplantátu, a to do 8 týždňov odo dňa doručenia Výsledkov spracovania, ak v Zmluve nie je uvedené inak.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.6</strong> Povinnosti podľa bodu IV.5 písm. a), b) a d) Zmluvy sa v plnom rozsahu vzťahujú aj na Otca, ktorý podpisom Zmluvy s nimi vyjadruje výslovný súhlas a zaväzuje sa ich dodržiavať. Ostatné práva a povinnosti podľa tejto Zmluvy vykonáva RODIČKA v súlade s ustanovením bodu VII.11 Zmluvy.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.7</strong> V súvislosti s odberom a spracovaním krvi a/alebo tkaniva na transplantát CBC AG:</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">a) sa zaväzuje plniť predmet Zmluvy s vynaložením odbornej starostlivosti,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">b) pred odberom zabezpečí vysvetlenie významu a dôvodov vyšetrenia krvi a/alebo tkaniva, dôvodov zisťovania anamnézy RODIČKY a údajov o jej predchádzajúcich liečeniach,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">c) sa zaväzuje vrátiť RODIČKE v celom rozsahu už poskytnuté finančné plnenie v súlade s bodom V.1 Zmluvy v prípade, že sa RODIČKA rozhodne odstúpiť od zamýšľaného odberu v súlade s bodom IV.5 písm. g) alebo písm. i) tejto Zmluvy, a to do 28 kalendárnych dní od doručenia písomného odstúpenia,</p>
    <p style="margin-bottom: 6px; text-align: justify; margin-left: 20px;">d) je povinná zabezpečiť realizáciu vyšetrení a testov podľa platnej právnej úpravy najmä tie, ktoré sú uvedené v bode IV.2 písm. b) a písm. c) Zmluvy.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.8</strong> V prípade, ak RODIČKA v súlade s bodom IV.4 tejto Zmluvy najneskôr do 14 kalendárnych dní odo dňa doručenia Výsledkov spracovania oznámi CBC AG, že odmieta transplantát, dohodli sa zmluvné strany, že RODIČKA transplantát darováva S.R.P.K.B. na vedecké a medicínske účely podľa tejto Zmluvy, resp. na zabezpečenie jeho likvidácie v súlade s príslušnými právnymi predpismi, s čím RODIČKA výslovne súhlasí. V takomto prípade sa CBC AG zaväzuje vrátiť RODIČKE v celom rozsahu už poskytnuté finančné plnenie v súlade s bodom V.1 Zmluvy do 28 kalendárnych dní odo dňa, kedy bude CBC AG toto písomné oznámenie doručené spolu s číslom účtu, na ktoré má byť finančné plnenie vrátené.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>IV.9</strong> Bezodkladne po uhradení celej odplaty v zmysle bodu V.1 Zmluvy, CBC AG zabezpečí skladovanie transplantátu v súlade s podmienkami podľa osobitnej Zmluvy o skladovaní. V prípade, ak RODIČKA zvolila možnosť úhrady odplaty podľa bodu V.1 Zmluvy o odbere formou postupných mesačných splátok, CBC AG zabezpečí skladovanie transplantátu momentom uhradenia zálohovej platby a prvej mesačnej splátky odplaty podľa bodu V.1 tejto Zmluvy. V prípade, ak si bude RODIČKA želať skladovanie prostredníctvom tretej osoby, CBC AG zabezpečí umožniť, aby transplantát prevzalo RODIČKOU písomne určené a na takúto činnosť riadne licencované zdravotnícke zariadenie (ďalej len „Subjekt").</p>
  </div>

  <!-- Článok V - Odplata -->
  <div style="margin-bottom: 12px;">
    <h2 style="font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 8px;">Článok V - Odplata</h2>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>V.1</strong> Za zabezpečenie odberu a spracovania krvi a/alebo tkaniva na transplantát pre RODIČKU, prináleží CBC AG odplata. Zmluvné strany sa dohodli, že RODIČKA a Otec sú solidárne (spoločne a nerozdielne) povinní dohodnutú odplatu CBC AG zaplatiť včas, pokiaľ v Zmluve nie je dohodnuté inak. Zmluvné strany sa dohodli na nasledovnej odplate podľa typu produktu:</p>
    
    <!-- Cenová tabuľka -->
    <div style="margin: 10px 0;">
      <p style="font-weight: bold; margin-bottom: 6px; font-size: 8pt; text-transform: uppercase;">Pre zmluvné strany je záväzná možnosť označená krížikom:</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10px;">
        <thead>
          <tr style="background-color: #2c3e50; color: white;">
            <th style="border: 1px solid #34495e; padding: 8px; text-align: center; width: 30px;">X</th>
            <th style="border: 1px solid #34495e; padding: 8px; text-align: left;">Typ produktu</th>
            <th style="border: 1px solid #34495e; padding: 8px; text-align: right;">Celková suma</th>
            <th style="border: 1px solid #34495e; padding: 8px; text-align: center;">Počet platieb</th>
            <th style="border: 1px solid #34495e; padding: 8px; text-align: right;">Zálohová platba</th>
            <th style="border: 1px solid #34495e; padding: 8px; text-align: right; background-color: #f39c12;">Výška zostávajúcej platby*</th>
          </tr>
        </thead>
        <tbody>
          <tr data-product-id="standard" style="background-color: #ecf0f1;">
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;"><span class="product-radio" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #2c3e50; border-radius: 50%;"></span></td>
            <td style="border: 1px solid #bdc3c7; padding: 8px;">Štandard</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">590 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">2</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">150 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right; background-color: #fff9c4; font-weight: bold;">440 EUR</td>
          </tr>
          <tr data-product-id="standard_tissue" style="background-color: #ffffff;">
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;"><span class="product-radio" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #2c3e50; border-radius: 50%;"></span></td>
            <td style="border: 1px solid #bdc3c7; padding: 8px;">Štandard + tkanivo pupočníka</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">790 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">2</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">150 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right; background-color: #fff9c4; font-weight: bold;">640 EUR</td>
          </tr>
          <tr data-product-id="premium" style="background-color: #ecf0f1;">
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;"><span class="product-radio" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #2c3e50; border-radius: 50%;"></span></td>
            <td style="border: 1px solid #bdc3c7; padding: 8px;">Prémium</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">790 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">2</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">150 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right; background-color: #fff9c4; font-weight: bold;">640 EUR</td>
          </tr>
          <tr data-product-id="premium_tissue" style="background-color: #ffffff;">
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;"><span class="product-radio" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #2c3e50; border-radius: 50%;"></span></td>
            <td style="border: 1px solid #bdc3c7; padding: 8px;">Prémium + tkanivo pupočníka</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">990 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">2</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">150 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right; background-color: #fff9c4; font-weight: bold;">840 EUR</td>
          </tr>
          <tr data-product-id="tissue_only" style="background-color: #ecf0f1;">
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;"><span class="product-radio" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #2c3e50; border-radius: 50%;"></span></td>
            <td style="border: 1px solid #bdc3c7; padding: 8px;">Tkanivo pupočníka**</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">300 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">1</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">0 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right; background-color: #fff9c4; font-weight: bold;">300 EUR</td>
          </tr>
          <tr data-product-id="premium_all" style="background-color: #ffffff;">
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;"><span class="product-radio" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #2c3e50; border-radius: 50%;"></span></td>
            <td style="border: 1px solid #bdc3c7; padding: 8px;">Prémium + tkanivo pupočníka + tkanivo placenty</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">1 490 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">2</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right;">150 EUR</td>
            <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: right; background-color: #fff9c4; font-weight: bold;">1 340 EUR</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 7pt; color: #666; margin-bottom: 3px;">* Po odbere a obdržaní Výsledkov spracovania.</p>
      <p style="font-size: 7pt; color: #666;">** Odplata CBC AG za zabezpečenie odberu Tkaniva pupočníka pri kontaminácii časti odberu, pokiaľ sa zmluvné strany nedohodli inak.</p>
      
      <!-- Súhrn vybraného produktu - žltý box -->
      <div style="background-color: #fff9c4; border: 3px solid #f9a825; border-radius: 8px; padding: 15px; margin-top: 15px;">
        <h4 style="margin: 0 0 12px 0; color: #e65100; font-size: 10pt; border-bottom: 2px solid #f9a825; padding-bottom: 8px; text-transform: uppercase;">VYBRANÝ PRODUKT</h4>
        <table style="width: 100%; font-size: 9pt;">
          <tr>
            <td style="padding: 5px 0; width: 50%;"><strong>Názov produktu:</strong></td>
            <td style="padding: 5px 0; text-align: right; font-weight: bold; font-size: 10pt;">{{product.name}}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Celková suma:</strong></td>
            <td style="padding: 5px 0; text-align: right; font-weight: bold; color: #c62828; font-size: 10pt;">{{billset.totalGrossAmount}} {{billset.currency}}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Počet platieb:</strong></td>
            <td style="padding: 5px 0; text-align: right;">{{payment.installments}}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Zálohová platba:</strong></td>
            <td style="padding: 5px 0; text-align: right;">{{payment.depositAmount}} {{billset.currency}}</td>
          </tr>
          <tr style="background-color: #ffeb3b;">
            <td style="padding: 10px 6px; font-size: 10pt;"><strong>VÝŠKA ZOSTÁVAJÚCEJ PLATBY:</strong></td>
            <td style="padding: 10px 6px; text-align: right; font-weight: bold; font-size: 12pt; color: #1a237e;">{{payment.remainingAmount}} {{billset.currency}}</td>
          </tr>
        </table>
      </div>
    </div>

    <p style="margin-bottom: 6px; text-align: justify;"><input type="checkbox" style="margin-right: 5px;" /> Mám záujem o postupné mesačné platby formou splátok bez navýšenia.</p>
    <p style="margin-bottom: 6px; text-align: justify;">Zmluvné strany sa dohodli na nasledovnom postupe úhrady odplaty podľa bodu V.1 Zmluvy:</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">- zálohová platba v sume 150 EUR je splatná do 14 kalendárnych dní odo dňa vystavenia zálohovej faktúry,</p>
    <p style="margin-bottom: 3px; text-align: justify; margin-left: 20px;">- zostatok odplaty po odpočítaní zaplatenej zálohovej platby je splatný do 14 kalendárnych dní odo dňa vystavenia faktúry (vystavená do 10 dní odo dňa doručenia Výsledkov spracovania),</p>
    <p style="margin-bottom: 6px; text-align: justify; margin-left: 20px;">- v prípade, ak si RODIČKA zvolila možnosť platby formou postupných mesačných splátok, tieto budú rozdelené na jednorazovú zálohovú platbu v sume 150 EUR a následné rovnaké mesačné platby, maximálne v počte 10. Podmienky platby budú upravené splátkovým kalendárom medzi RODIČKOU a CBC AG, ktorý sa stane súčasťou tejto Zmluvy.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>V.2</strong> V prípade, ak bude RODIČKA alebo Otec v omeškaní s úhradou akejkoľvek platby odplaty v zmysle bodu V.1 Zmluvy o 90 a viac kalendárnych dní, a to aj napriek písomnej upomienke zaslanej RODIČKE v rámci tejto lehoty, dohodli sa zmluvné strany, že RODIČKA nemá záujem o transplantát a tento darováva S.R.P.K.B. na vedecké a medicínske účely, resp. na zabezpečenie jeho likvidácie v súlade s príslušnými právnymi predpismi, s čím RODIČKA výslovne súhlasí.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>V.3</strong> RODIČKA a Otec sú povinní spoločne a nerozdielne uhradiť odplatu CBC AG na bankový účet uvedený v záhlaví Zmluvy. V prípade zmeny bankového spojenia oznámi CBC AG túto skutočnosť bezodkladne RODIČKE a RODIČKA a Otec sú povinní odo dňa oznámenia používať v platobnom styku výlučne nové bankové účty CBC AG.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>V.4</strong> Odplata sa považuje za zaplatenú dňom jej riadneho pripísania na bankový účet CBC AG.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>V.5</strong> V prípade, ak RODIČKA na základe Výsledkov spracovania, ktoré preukázali mikrobiologickú kontamináciu transplantátu, neodstúpi od Zmluvy alebo jej časti v súlade s bodom IV.5 i) Zmluvy, ale písomne oznámi do 8 týždňov odo dňa doručenia Výsledkov spracovania, že má záujem o zabezpečenie skladovania takéhoto transplantátu, a ak v tomto čase došlo zmluvnými stranami k podpisu Zmluvy o skladovaní, táto nezaniká, zmluvné strany sa však dohodli, že CBC AG má vo vzťahu ku kontaminovanej časti transplantátu nárok len na odplatu podľa tejto Zmluvy v sume 1 EUR.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>V.6</strong> V prípade, že RODIČKA a Otec po splnení podmienok určených právnymi predpismi výslovne požiadajú CBC AG o zabezpečenie likvidácie transplantátu z iných dôvodov ako sú uvedené v bode IV.5 i) Zmluvy alebo bez udania dôvodu po uplynutí lehoty uvedenej v bode IV.5 h) Zmluvy, sú RODIČKA a Otec povinní spoločne a nerozdielne uhradiť poplatok za likvidáciu vo výške 200 EUR.</p>
  </div>

  <!-- Článok VI - Ďalšie zmluvné ustanovenia -->
  <div style="margin-bottom: 12px;">
    <h2 style="font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 8px;">Článok VI - Ďalšie zmluvné ustanovenia</h2>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VI.1</strong> CBC AG sa zaväzuje zabezpečovať plnenie predmetu Zmluvy prostredníctvom riadne licencovaných subjektov v Slovenskej republike (najmä prostredníctvom S.R.P.K.B.) s tým, že za výsledok ich činnosti zodpovedá akoby plnila sama.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VI.2</strong> V prípade poškodenia transplantátu do času jeho odovzdania na skladovanie, keď medzi zavineným porušením povinností zo strany CBC AG a spôsobenou škodou existuje priama príčinná súvislosť, sa CBC AG zaväzuje nahradiť RODIČKE vzniknutú skutočnú škodu. CBC AG predpokladá a predvída pri podpise tejto Zmluvy, že výška škody môže byť maximálne vo výške odplaty zaplatenej RODIČKOU. CBC AG nezodpovedá za škody vzniknuté na transplantáte, pokiaľ nedošlo k zavineniu zo strany CBC AG ako aj v prípade poškodenia zapríčineného tzv. vyššou mocou, napr. živelnou pohromou, vojnou alebo inou udalosťou a pod., ktorej CBC AG nemohla zabrániť ani pri vynaložení odbornej starostlivosti.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VI.3</strong> Ak v dôsledku konania alebo nekonania RODIČKY alebo Otca v rozpore so Zmluvou nebude môcť CBC AG, resp. S.R.P.K.B. alebo iný licencovaný subjekt v Slovenskej republike, prostredníctvom ktorého CBC AG plní Zmluvu, riadne a včas splniť niektorú zo svojich povinností podľa Zmluvy, na základe výslovnej dohody zmluvných strán sa má za to, že k splneniu týchto povinností vyplývajúcich zo Zmluvy došlo riadne a včas.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VI.4</strong> Ak RODIČKA neoznámi CBC AG zvolený Subjekt a čas prevzatia transplantátu podľa Zmluvy v lehote do 6 mesiacov odo dňa doručenia Výsledkov spracovania a ak sa zmluvné strany nedohodnú inak (napríklad neuzatvoria Zmluvu o skladovaní), a to ani po predchádzajúcej výzve CBC AG uskutočnenej v lehote 3 mesiacov odo dňa doručenia Výsledkov spracovania, dohodli sa zmluvné strany, že RODIČKA darováva transplantát S.R.P.K.B. na vedecké a medicínske účely alebo S.R.P.K.B. je oprávnené zabezpečiť likvidáciu transplantátu v súlade s príslušnými právnymi predpismi, s čím RODIČKA výslovne súhlasí.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VI.5</strong> Pri prevzatí transplantátu Subjektom podpíšu CBC AG a RODIČKA protokol o prevzatí transplantátu, v ktorom opíšu stav transplantátu pri jeho prevzatí Subjektom a uvedú dátum prevzatia transplantátu Subjektom. Od momentu prevzatia transplantátu Subjektom, CBC AG nenesie žiadnu zodpovednosť za stav a použiteľnosť transplantátu.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VI.6</strong> CBC AG nie je povinná zabezpečiť spôsobom podľa bodu IV.9 umožnenie prevzatia transplantátu Subjektom, resp. inou treťou osobou, a to aj napriek tomu, že je riadne licencovaná, kým nie sú uhradené všetky dlžné pohľadávky CBC AG voči RODIČKE.</p>
  </div>

  <!-- Článok VII - Záverečné ustanovenia -->
  <div style="margin-bottom: 12px;">
    <h2 style="font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 8px;">Článok VII - Záverečné ustanovenia</h2>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.1</strong> Zmluvné strany sa dohodli, že v prípade smrti RODIČKY prechádzajú všetky práva a povinnosti zo Zmluvy na dieťa narodené bezprostredne pred odberom krvi a/alebo tkaniva za účelom ich spracovania na transplantát. V prípade úmrtia Otca je RODIČKA povinná v čo najkratšom čase vysporiadať príslušné práva a oznámiť CBC AG, kto vstúpi do práv Otca vyplývajúcich zo Zmluvy.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.2</strong> V prípade zániku CBC AG bez právneho nástupcu sa CBC AG zaväzuje oznámiť bez zbytočného odkladu túto skutočnosť RODIČKE a na základe písomného požiadania RODIČKY uskutočneného v lehote do 12 mesiacov od doručenia vyššie uvedeného oznámenia zabezpečiť umožnenie prevzatia uskladneného transplantátu v súlade s bodom IV.9 Zmluvy zo strany RODIČKY resp. Subjektu.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.3</strong> Zmluvné strany sa dohodli, že CBC AG je oprávnená kedykoľvek postúpiť (previesť) svoje práva a povinnosti v zmysle tejto Zmluvy na inú entitu a táto iná entita je oprávnená prevziať povinnosti CBC AG vyplývajúce jej z tejto Zmluvy ak, (i) je táto entita členom skupiny CBC, (ii) má materiálno-technické zabezpečenie k plneniu povinností CBC AG v zmysle tejto Zmluvy, (iii) nebol voči nej vyhlásený konkurz alebo schválená reštrukturalizácia, (iv) nie je v predĺžení ani v likvidácii (ďalej len „Postúpenie"). V prípade potreby sa RODIČKA s Otcom zaväzujú vykonať akýkoľvek úkon, vrátane ale nie výlučne, podpísania súhlasu alebo dodatku, na základe ktorého dôjde k potvrdeniu účinného Postúpenia.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.4</strong> Táto Zmluva sa uzatvára na dobu určitú, a to na dobu od podpisu tejto Zmluvy až do momentu akceptácie transplantátu RODIČKOU. Ostatné dojednania uvedené v tejto Zmluve tým nie sú dotknuté (najmä v prípade odmietnutia pripraveného transplantátu RODIČKOU, resp. aj Otcom, neplnenie finančných záväzkov voči CBC AG a pod.). Zmluvu možno meniť a dopĺňať len na základe súhlasu obidvoch zmluvných strán formou písomných dodatkov, s výslovným odvolaním sa na Zmluvu, ak sa zmluvné strany výslovne nedohodnú inak.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.5</strong> Ak sa akékoľvek ustanovenie tejto Zmluvy stane neplatným či nevymáhateľným, nebude to mať vplyv na platnosť a vymáhateľnosť ostatných ustanovení tejto Zmluvy. Zmluvné strany sa zaväzujú nahradiť neplatné alebo nevymáhateľné ustanovenia novým ustanovením, ktorého znenie bude zodpovedať úmyslu vyjadrenému pôvodným ustanovením a touto Zmluvou ako celkom.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.6</strong> Zmluva nadobúda platnosť a účinnosť dňom jej podpísania oboma zmluvnými stranami. Zmluva a vzťahy z nej vyplývajúce sa budú vykladať a riadiť právnym poriadkom Slovenskej republiky.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.7</strong> Zmluva je vyhotovená v dvoch exemplároch s platnosťou originálu, pričom CBC AG obdrží jedno (1) vyhotovenie a RODIČKA a Otec spoločne obdržia jedno (1) vyhotovenie.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.8</strong> Súčasťou Zmluvy je „Dotazník pre rodičku", „Informácie pre rodičov", „Informácia o spracúvaní osobných údajov dotknutej osoby". Všetky prílohy tejto Zmluvy tvoria jej neoddeliteľnú časť.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.9</strong> Ak počas pôrodu bude odobratých menej ako 20 mililitrov krvi a/alebo tkanivo nebude odobraté v súlade so schváleným štandardným pracovným postupom a ak sa zmluvné strany nedohodnú inak, má sa za to, že RODIČKA nemá záujem o spracovanie krvi a/alebo tkaniva. V takom prípade CBC AG nebude ďalej zabezpečovať následné plnenie podľa tejto Zmluvy, a teda S.R.P.K.B. nepoužije odobratú krv a/alebo tkanivo na prípravu transplantátu a ani nevystaví a neposkytne RODIČKE Výsledky spracovania.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.10</strong> RODIČKA je povinná CBC AG bezodkladne oznámiť akúkoľvek zmenu svojej adresy alebo akýchkoľvek iných údajov. V prípade, ak CBC AG zašle akúkoľvek písomnosť na adresu RODIČKY uvedenú v záhlaví Zmluvy, alebo na poslednú oznámenú adresu RODIČKY, považuje sa takáto písomnosť za doručenú siedmym pracovným dňom po jej podaní na poštovú prepravu.</p>
    <p style="margin-bottom: 6px; text-align: justify;"><strong>VII.11</strong> Otec podpisom tejto Zmluvy vyjadruje svoj výslovný súhlas s tým, aby všetky práva resp. povinnosti súvisiace s plnením tejto Zmluvy patriace Otcovi vykonávala resp. plnila v Otcovom mene RODIČKA, na čo jej podpisom tejto Zmluvy udeľuje plnomocenstvo, okrem prípadov, kedy je v tejto Zmluve uvedené, že sa vyžaduje aj súhlas Otca. Otec zároveň súhlasí s tým, aby boli všetky písomnosti podľa tejto Zmluvy adresované RODIČKE alebo Otcovi zasielané len RODIČKE. RODIČKA sa podpisom tejto Zmluvy zaväzuje informovať Otca o doručení písomností a ich obsahu. V prípade, že Otec nebude účastníkom tejto Zmluvy, všetky práva a povinnosti Otca vyplývajúce z tejto Zmluvy bude vykonávať výlučne RODIČKA.</p>
  </div>

  <!-- Podpisy -->
  <div style="margin-top: 30px;">
    <div style="display: flex; justify-content: space-between; gap: 30px;">
      <div style="width: 45%; text-align: center;">
        <p style="margin-bottom: 5px; font-size: 8pt;">V {{contract.signaturePlace}} dňa {{contract.date}}</p>
        <div style="margin-top: 50px;">
          <div style="border-top: 1px solid #000; padding-top: 6px;">
            <p style="margin: 0; font-size: 8pt;">za CBC AG</p>
            <p style="margin: 3px 0 0 0; font-weight: bold; font-size: 9pt;">{{billing.representative}}</p>
            <p style="margin: 0; font-size: 7pt; color: #666;">(splnomocnenec)</p>
          </div>
        </div>
      </div>
      <div style="width: 45%;">
        <p style="margin-bottom: 5px; font-size: 8pt; text-align: center;">V _________________ dňa {{contract.date}}</p>
        <div style="margin-top: 50px; text-align: center;">
          <div style="border-top: 1px solid #000; padding-top: 6px; margin-bottom: 30px;">
            <p style="margin: 3px 0 0 0; font-weight: bold; font-size: 9pt;">{{customer.fullName}}</p>
            <p style="margin: 0; font-size: 7pt; color: #666;">(RODIČKA)</p>
          </div>
          <div style="border-top: 1px solid #000; padding-top: 6px; margin-top: 40px;">
            <p style="margin: 3px 0 0 0; font-weight: bold; font-size: 9pt;">{{father.fullName}}</p>
            <p style="margin: 0; font-size: 7pt; color: #666;">(Otec)</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div style="margin-top: 20px; text-align: right;">
    <p style="font-size: 7pt; color: #999;">CBCAG-ZDLMO-V003-P080322</p>
  </div>

</div>`;

interface PageImage {
  pageNumber: number;
  imageUrl: string;
  fileName: string;
}

interface ContractTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  onLoadDefault?: () => void;
  pageImages?: PageImage[];
}

const PRODUCT_OPTIONS = [
  { id: "standard", name: "Štandard", total: 590, payments: 2, deposit: 150, remaining: 440 },
  { id: "standard_tissue", name: "Štandard + tkanivo pupočníka", total: 790, payments: 2, deposit: 150, remaining: 640 },
  { id: "premium", name: "Prémium", total: 790, payments: 2, deposit: 150, remaining: 640 },
  { id: "premium_tissue", name: "Prémium + tkanivo pupočníka", total: 990, payments: 2, deposit: 150, remaining: 840 },
  { id: "tissue_only", name: "Tkanivo pupočníka", total: 300, payments: 1, deposit: 0, remaining: 300 },
  { id: "premium_all", name: "Prémium + tkanivo pupočníka + tkanivo placenty", total: 1490, payments: 2, deposit: 150, remaining: 1340 },
];

export function ContractTemplateEditor({ value, onChange, onLoadDefault, pageImages = [] }: ContractTemplateEditorProps) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    customer: true,
    billing: true,
    father: false,
    product: false,
    contract: false,
    billset: false,
    payment: false,
    discount: false,
    vat: false,
  });
  const [previewHtml, setPreviewHtml] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"wysiwyg" | "html">("wysiwyg");
  const [selectedProduct, setSelectedProduct] = useState(PRODUCT_OPTIONS[0]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const insertField = useCallback((fieldKey: string) => {
    const placeholder = `{{${fieldKey}}}`;
    
    if (editorMode === "html") {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + placeholder + value.substring(end);
      
      onChange(newValue);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    } else {
      onChange(value + placeholder);
    }

    toast({
      title: "Pole vložené",
      description: `${placeholder}`,
    });
  }, [value, onChange, toast, editorMode]);

  const copyField = useCallback((fieldKey: string) => {
    const placeholder = `{{${fieldKey}}}`;
    navigator.clipboard.writeText(placeholder);
    toast({
      title: "Skopírované",
      description: placeholder,
    });
  }, [toast]);

  const insertSpecialElement = useCallback((elementKey: string) => {
    const element = SPECIAL_ELEMENTS[elementKey as keyof typeof SPECIAL_ELEMENTS];
    if (!element) return;

    if (editorMode === "html") {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + "\n" + element.html + "\n" + value.substring(end);
      
      onChange(newValue);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + element.html.length + 2, start + element.html.length + 2);
      }, 0);
    } else {
      onChange(value + "\n" + element.html);
    }

    toast({
      title: "Element vložený",
      description: element.label,
    });
  }, [value, onChange, toast, editorMode]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
  }, []);

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
      "billing.representative": "Ján Šidlík, MBA",
      // Father fields
      "father.fullName": "Peter Novák",
      "father.firstName": "Peter",
      "father.lastName": "Novák",
      "father.address": "Hlavná 123",
      "father.city": "Bratislava",
      "father.postalCode": "811 01",
      "father.dateOfBirth": "20.05.1983",
      "father.birthNumber": "830520/1234",
      "father.email": "peter.novak@email.sk",
      "father.phone": "+421 900 987 654",
      "product.name": selectedProduct.name,
      "product.code": "PP-25",
      "product.description": "Kompletné spracovanie a uchovávanie kmeňových buniek z pupočníkovej krvi",
      "product.category": "Uchovávanie",
      "product.basePrice": selectedProduct.total.toLocaleString("sk-SK"),
      "product.currency": "EUR",
      "product.vatRate": "20",
      "product.priceWithVat": selectedProduct.total.toLocaleString("sk-SK"),
      "product.storageYears": "25",
      "product.installments": selectedProduct.payments.toString(),
      "product.monthlyPayment": (selectedProduct.remaining / (selectedProduct.payments > 1 ? 10 : 1)).toLocaleString("sk-SK"),
      "product.totalPrice": selectedProduct.total.toLocaleString("sk-SK"),
      "product.totalPriceWords": "",
      "product.vatAmount": Math.round(selectedProduct.total * 0.2).toLocaleString("sk-SK"),
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
      // Billset fields
      "billset.name": selectedProduct.name,
      "billset.productName": selectedProduct.name,
      "billset.currency": "EUR",
      "billset.validFrom": "01.01.2024",
      "billset.validTo": "31.12.2026",
      "billset.notes": "",
      "billset.totalNetAmount": selectedProduct.total.toLocaleString("sk-SK"),
      "billset.totalDiscountAmount": "0,00",
      "billset.totalVatAmount": Math.round(selectedProduct.total * 0.2).toLocaleString("sk-SK"),
      "billset.totalGrossAmount": selectedProduct.total.toLocaleString("sk-SK"),
      // Payment conditions
      "payment.method": selectedProduct.payments > 1 ? "Splátky" : "Jednorazová platba",
      "payment.installments": selectedProduct.payments.toString(),
      "payment.installmentAmount": (selectedProduct.remaining / (selectedProduct.payments > 1 ? 10 : 1)).toLocaleString("sk-SK"),
      "payment.firstPaymentDue": "15.02.2026",
      "payment.frequency": "mesačne",
      "payment.depositAmount": selectedProduct.deposit.toLocaleString("sk-SK"),
      "payment.remainingAmount": selectedProduct.remaining.toLocaleString("sk-SK"),
      // Discounts
      "discount.name": "Včasná registrácia",
      "discount.type": "percentuálna",
      "discount.value": "10%",
      "discount.amount": "250,00",
      "discount.reason": "Zľava za registráciu pred narodením",
      // VAT info
      "vat.rate": "20",
      "vat.baseAmount": "2 250,00",
      "vat.amount": "450,00",
    };

    let preview = value;
    Object.entries(sampleData).forEach(([key, val]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key.replace(".", "\\.")}\\}\\}`, "g"), val);
    });
    
    preview = preview.replace(/\{\{#if\s+\w+\.?\w*\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, "$1");
    preview = preview.replace(/\{\{#if\s+\w+\.?\w*\}\}([\s\S]*?)\{\{\/if\}\}/g, "$1");
    
    setPreviewHtml(preview);
    setIsPreviewOpen(true);
  }, [value, selectedProduct]);

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
      case "loop": return List;
      default: return Info;
    }
  };

  return (
    <div className={`grid gap-4 h-full ${pageImages.length > 0 ? 'grid-cols-1 lg:grid-cols-4' : 'grid-cols-1 lg:grid-cols-3'}`}>
      {pageImages.length > 0 && (
        <div className="lg:col-span-1 flex flex-col border rounded-md overflow-hidden bg-muted/30">
          <div className="flex items-center justify-between p-2 border-b bg-muted/50">
            <h3 className="text-sm font-semibold">Obrázky stránok PDF</h3>
            <Badge variant="secondary" className="text-xs">{pageImages.length}</Badge>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex gap-1 p-2 border-b overflow-x-auto flex-shrink-0">
              {pageImages.map((page, idx) => (
                <button
                  key={page.pageNumber}
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`shrink-0 w-10 h-14 border rounded overflow-hidden transition-all ${
                    selectedPageIndex === idx 
                      ? 'ring-2 ring-primary border-primary' 
                      : 'hover:border-primary/50'
                  }`}
                  data-testid={`page-thumb-${page.pageNumber}`}
                >
                  <img 
                    src={page.imageUrl} 
                    alt={`Strana ${page.pageNumber}`}
                    className="w-full h-full object-cover object-top"
                  />
                </button>
              ))}
            </div>
            
            <ScrollArea className="flex-1 p-2">
              {pageImages[selectedPageIndex] && (
                <div className="space-y-2">
                  <div className="text-xs text-center text-muted-foreground">
                    Strana {pageImages[selectedPageIndex].pageNumber} z {pageImages.length}
                  </div>
                  <a
                    href={pageImages[selectedPageIndex].imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img 
                      src={pageImages[selectedPageIndex].imageUrl} 
                      alt={`Strana ${pageImages[selectedPageIndex].pageNumber}`}
                      className="w-full border rounded shadow-sm hover:shadow-md transition-shadow cursor-zoom-in"
                    />
                  </a>
                  <p className="text-[10px] text-center text-muted-foreground">
                    Kliknutím zväčšíte
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
      
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
            
            {/* Product Selection Panel */}
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Výber produktu pre náhľad</h4>
              <div className="space-y-1 bg-muted/50 rounded-md p-2">
                {PRODUCT_OPTIONS.map((product) => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                      selectedProduct.id === product.id 
                        ? "bg-primary/10 border border-primary/30" 
                        : "hover-elevate"
                    }`}
                    onClick={() => setSelectedProduct(product)}
                    data-testid={`product-select-${product.id}`}
                  >
                    <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                      selectedProduct.id === product.id 
                        ? "border-primary bg-primary" 
                        : "border-muted-foreground"
                    }`}>
                      {selectedProduct.id === product.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{product.name}</p>
                      <p className="text-[10px] text-muted-foreground">{product.total} EUR</p>
                    </div>
                  </div>
                ))}
                {selectedProduct && (
                  <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-md text-xs space-y-1">
                    <p className="font-semibold text-yellow-800 dark:text-yellow-200">Vybraný produkt:</p>
                    <p className="text-yellow-700 dark:text-yellow-300">{selectedProduct.name}</p>
                    <p className="text-yellow-700 dark:text-yellow-300">Celkom: {selectedProduct.total} EUR</p>
                    <p className="text-yellow-700 dark:text-yellow-300">Záloha: {selectedProduct.deposit} EUR</p>
                    <p className="text-yellow-700 dark:text-yellow-300 font-bold">Zostáva: {selectedProduct.remaining} EUR</p>
                  </div>
                )}
              </div>
            </div>

            {/* Special Elements Section */}
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Špeciálne elementy</h4>
              <div className="space-y-1">
                {Object.entries(SPECIAL_ELEMENTS).map(([key, element]) => {
                  const ElementIcon = element.icon;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate cursor-pointer border border-dashed"
                      onClick={() => insertSpecialElement(key)}
                      data-testid={`element-${key}`}
                    >
                      <ElementIcon className="h-4 w-4 text-primary" />
                      <span className="text-xs">{element.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
      
      <div className="lg:col-span-2 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Obsah šablóny</h3>
            <div className="flex items-center rounded-md border bg-muted p-0.5">
              <Button
                variant={editorMode === "wysiwyg" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setEditorMode("wysiwyg")}
                data-testid="button-mode-wysiwyg"
              >
                <Type className="h-3 w-3 mr-1" />
                Vizuálny
              </Button>
              <Button
                variant={editorMode === "html" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setEditorMode("html")}
                data-testid="button-mode-html"
              >
                <Code className="h-3 w-3 mr-1" />
                HTML
              </Button>
            </div>
          </div>
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
        
        {editorMode === "wysiwyg" ? (
          <div className="flex-1 border rounded-md overflow-hidden" style={{ minHeight: "400px" }}>
            <Editor
              value={value}
              onChange={(e) => onChange(e.target.value)}
              containerProps={{
                style: { 
                  minHeight: "400px",
                  resize: "vertical",
                }
              }}
              data-testid="wysiwyg-editor"
            >
              <Toolbar>
                <BtnUndo />
                <BtnRedo />
                <EditorSeparator />
                <BtnBold />
                <BtnItalic />
                <BtnUnderline />
                <BtnStrikeThrough />
                <EditorSeparator />
                <BtnBulletList />
                <BtnNumberedList />
                <EditorSeparator />
                <BtnLink />
              </Toolbar>
            </Editor>
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Vložte HTML obsah šablóny zmluvy. Použite {{pole}} pre dynamické hodnoty..."
            className="flex-1 font-mono text-xs resize-none"
            style={{ minHeight: "400px" }}
            data-testid="textarea-template-content"
          />
        )}
        
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>Tip: Kliknutím na pole ho vložíte do šablóny.</span>
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
