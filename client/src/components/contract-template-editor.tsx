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

const DEFAULT_CONTRACT_TEMPLATE = `<div style="font-family: 'Times New Roman', serif; font-size: 10pt; line-height: 1.4; max-width: 900px; margin: 0 auto; padding: 30px;">

  <!-- Hlavička zmluvy -->
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="font-size: 16pt; font-weight: bold; margin-bottom: 5px; color: #000;">
      Zmluva o odbere
    </h1>
    <p style="font-size: 10pt; margin: 5px 0;">číslo zmluvy: {{contract.number}}</p>
    <p style="font-size: 9pt; color: #333; margin-top: 10px;">
      uzavretá podľa § 262 ods. 1 a § 269 ods. 2 zákona č. 513/1991 Zb. Obchodný zákonník v znení neskorších predpisov
    </p>
  </div>

  <!-- Zmluvné strany - dvojstĺpcové rozloženie -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 25px; gap: 30px;">
    <div style="width: 48%;">
      <p style="font-weight: bold; margin-bottom: 8px;">medzi</p>
      <p style="margin: 2px 0;"><strong>{{billing.companyName}}</strong></p>
      <p style="margin: 2px 0; font-size: 9pt;">so sídlom: {{billing.address}}, {{billing.postalCode}} {{billing.city}}, {{billing.country}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">Identifikačné číslo: {{billing.taxId}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">Daňové Identifikačné číslo: {{billing.dic}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">Identifikačné číslo DPH: {{billing.vatId}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">IBAN: {{billing.iban}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">SWIFT: {{billing.swift}}</p>
      <p style="margin: 8px 0; font-size: 9pt; font-style: italic;">(ďalej ako spoločnosť „CBC AG")</p>
    </div>
    <div style="width: 48%;">
      <p style="font-weight: bold; margin-bottom: 8px;">a</p>
      <p style="margin: 2px 0;">pani: <strong>{{customer.fullName}}</strong> (ďalej len „RODIČKA")</p>
      <p style="margin: 2px 0; font-size: 9pt;">trvale bytom: {{customer.address}}, {{customer.postalCode}} {{customer.city}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">dátum narodenia: {{customer.dateOfBirth}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">rodné číslo: {{customer.birthNumber}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">e-mail: {{customer.email}}</p>
      <p style="margin: 2px 0; font-size: 9pt;">telefón: {{customer.phone}}</p>
      <p style="margin: 8px 0; font-size: 9pt;">a</p>
      <p style="margin: 2px 0;">pán: {{father.fullName}} (ďalej len „Otec")</p>
      <p style="margin: 2px 0; font-size: 9pt;">trvale bytom: {{father.address}}, {{father.postalCode}} {{father.city}}</p>
    </div>
  </div>

  <p style="text-align: center; margin-bottom: 20px; font-size: 9pt;">(ďalej len „Zmluva") takto:</p>

  <!-- Článok I - Preambula -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 10px;">
      Článok I - Preambula
    </h2>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>I.1</strong> Zmluvné strany sa dohodli, že túto Zmluvu uzatvárajú podľa § 262 ods. 1 Obchodného zákonníka 
      a v zmysle § 269 ods. 2 Obchodného zákonníka.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>I.2</strong> Zmluvné strany vyhlasujú, že túto Zmluvu uzatvárajú slobodne, vážne a bez omylu, že sú spôsobilé 
      na právne úkony v plnom rozsahu, obsah Zmluvy im je dobre známy v celom jeho rozsahu a Zmluvu neuzatvárajú 
      v tiesni alebo za nápadne nevýhodných podmienok.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>I.3</strong> CBC AG je obchodná spoločnosť, ktorá zabezpečuje niektoré činnosti registra pupočníkovej 
      a placentárnej krvi, tkaniva pupočníka a placenty, pričom predmetná činnosť zahŕňa najmä zabezpečenie odberu 
      krvotvorných kmeňových buniek z pupočníkovej a placentárnej krvi a tkaniva pupočníka a placenty zdravotníckym 
      zariadením pri pôrode dieťaťa RODIČKY a ich následné spracovanie na autológnu transplantáciu.
    </p>
  </div>

  <!-- Článok II - Predmet Zmluvy -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 10px;">
      Článok II - Predmet Zmluvy
    </h2>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>II.1</strong> Predmetom záväzku CBC AG podľa tejto Zmluvy pre RODIČKU je zabezpečenie odberu pupočníkovej 
      a/alebo placentárnej krvi (ďalej len „krv") a/alebo tkaniva pupočníka a/alebo placenty (ďalej len „tkanivo") 
      zdravotníckym zariadením pri pôrode dieťaťa RODIČKY, ich následné spracovanie (ďalej spoločne len "transplantát"), 
      ako aj na základe záujmu RODIČKY zabezpečenie následného skladovania transplantátu za podmienok nižšie uvedených v Zmluve.
    </p>
  </div>

  <!-- Článok III – Zabezpečenie činností -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 10px;">
      Článok III – Zabezpečenie činností
    </h2>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>III.1</strong> RODIČKA podpisom Zmluvy vyjadruje svoj výslovný súhlas so zabezpečením činností CBC AG 
      v súlade s bodom II.1 Zmluvy, pričom sa zaväzuje zaplatiť dohodnutú odplatu podľa tejto Zmluvy.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>III.2</strong> Transplantát môže byť použitý na autológnu transplantáciu. Transplantát môže byť pripravený 
      spracovaním z pupočníkovej krvi (ďalej ako „<strong>{{product.name}}</strong>").
    </p>
  </div>

  <!-- Článok IV - Transplantát -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 10px;">
      Článok IV - Transplantát
    </h2>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>IV.1</strong> CBC AG je povinná zabezpečiť spracovanie krvi a/alebo tkaniva na transplantát alebo časti 
      transplantátu RODIČKE v stave použiteľnom na účely autológnej transplantácie.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>IV.2</strong> Transplantát sa v zmysle Zmluvy považuje za použiteľný na účely autológnej transplantácie, ak:
    </p>
    <ul style="margin-left: 30px; margin-bottom: 10px; font-size: 9pt;">
      <li>a) odobratá krv a/alebo tkanivo je/sú spracovaná/é v súlade s platnou právnou úpravou a odbornými postupmi,</li>
      <li>b) transplantát je v momente jeho vydania riadne vyšetrený a boli vykonané požadované testy v súlade s platnou právnou úpravou,</li>
      <li>c) je stanovený počet jadrových buniek v krvi.</li>
    </ul>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>IV.3</strong> Po spracovaní krvi a/alebo tkaniva bude S.R.P.K.B. písomne informovať RODIČKU o použiteľnosti 
      transplantátu, ako aj o výsledkoch spracovania krvi a/alebo tkaniva (ďalej len „Výsledky spracovania").
    </p>
  </div>

  <!-- Článok V - Odplata -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 10px;">
      Článok V - Odplata
    </h2>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>V.1</strong> Za zabezpečenie odberu a spracovania krvi a/alebo tkaniva na transplantát pre RODIČKU, 
      prináleží CBC AG odplata. Zmluvné strany sa dohodli, že RODIČKA a Otec sú solidárne (spoločne a nerozdielne) 
      povinní dohodnutú odplatu CBC AG zaplatiť včas.
    </p>
    
    <!-- Cenová tabuľka -->
    <div style="margin: 15px 0;">
      <p style="font-weight: bold; margin-bottom: 8px; font-size: 9pt; text-transform: uppercase;">
        Pre zmluvné strany je záväzná nasledovná odplata:
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 15px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #333; padding: 8px; text-align: left;">Typ produktu</th>
            <th style="border: 1px solid #333; padding: 8px; text-align: right;">Celková suma</th>
            <th style="border: 1px solid #333; padding: 8px; text-align: center;">Počet platieb</th>
            <th style="border: 1px solid #333; padding: 8px; text-align: right;">Zálohová platba</th>
            <th style="border: 1px solid #333; padding: 8px; text-align: right;">Zostávajúca platba</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #333; padding: 8px; font-weight: bold;">{{product.name}}</td>
            <td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold;">{{billset.totalGrossAmount}} {{billset.currency}}</td>
            <td style="border: 1px solid #333; padding: 8px; text-align: center;">{{payment.installments}}</td>
            <td style="border: 1px solid #333; padding: 8px; text-align: right;">{{payment.depositAmount}} {{billset.currency}}</td>
            <td style="border: 1px solid #333; padding: 8px; text-align: right;">{{payment.remainingAmount}} {{billset.currency}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>V.2</strong> Zmluvné strany sa dohodli na nasledovnom postupe úhrady odplaty:
    </p>
    <ul style="margin-left: 30px; margin-bottom: 10px; font-size: 9pt;">
      <li>zálohová platba v sume {{payment.depositAmount}} {{billset.currency}} je splatná do 14 kalendárnych dní odo dňa vystavenia zálohovej faktúry,</li>
      <li>zostatok odplaty po odpočítaní zaplatenej zálohovej platby je splatný do 14 kalendárnych dní odo dňa vystavenia faktúry.</li>
    </ul>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>V.3</strong> RODIČKA a Otec sú povinní spoločne a nerozdielne uhradiť odplatu CBC AG na bankový účet 
      uvedený v záhlaví Zmluvy.
    </p>
  </div>

  <!-- Článok VI - Ďalšie zmluvné ustanovenia -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 10px;">
      Článok VI - Ďalšie zmluvné ustanovenia
    </h2>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>VI.1</strong> CBC AG sa zaväzuje zabezpečovať plnenie predmetu Zmluvy prostredníctvom riadne 
      licencovaných subjektov v Slovenskej republike s tým, že za výsledok ich činnosti zodpovedá akoby plnila sama.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>VI.2</strong> V prípade poškodenia transplantátu do času jeho odovzdania na skladovanie, keď medzi 
      zavineným porušením povinností zo strany CBC AG a spôsobenou škodou existuje priama príčinná súvislosť, 
      sa CBC AG zaväzuje nahradiť RODIČKE vzniknutú skutočnú škodu.
    </p>
  </div>

  <!-- Článok VII - Záverečné ustanovenia -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 10px;">
      Článok VII - Záverečné ustanovenia
    </h2>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>VII.1</strong> Zmluvné strany sa dohodli, že v prípade smrti RODIČKY prechádzajú všetky práva 
      a povinnosti zo Zmluvy na dieťa narodené bezprostredne pred odberom krvi a/alebo tkaniva za účelom 
      ich spracovania na transplantát.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>VII.4</strong> Táto Zmluva sa uzatvára na dobu určitú, a to na dobu od podpisu tejto Zmluvy 
      až do momentu akceptácie transplantátu RODIČKOU.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>VII.6</strong> Zmluva nadobúda platnosť a účinnosť dňom jej podpísania oboma zmluvnými stranami. 
      Zmluva a vzťahy z nej vyplývajúce sa budú vykladať a riadiť právnym poriadkom Slovenskej republiky.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>VII.7</strong> Zmluva je vyhotovená v dvoch exemplároch s platnosťou originálu, pričom CBC AG 
      obdrží jedno (1) vyhotovenie a RODIČKA a Otec spoločne obdržia jedno (1) vyhotovenie.
    </p>
    <p style="margin-bottom: 8px; text-align: justify;">
      <strong>VII.8</strong> Súčasťou Zmluvy je „Dotazník pre rodičku", „Informácie pre rodičov", 
      „Informácia o spracúvaní osobných údajov dotknutej osoby". Všetky prílohy tejto Zmluvy tvoria jej neoddeliteľnú časť.
    </p>
  </div>

  <!-- Zlom strany pred podpismi -->
  <div style="page-break-before: always;"></div>

  <!-- Podpisy -->
  <div style="margin-top: 40px;">
    <div style="display: flex; justify-content: space-between; gap: 40px;">
      <div style="width: 45%; text-align: center;">
        <p style="margin-bottom: 5px; font-size: 9pt;">V {{contract.signaturePlace}} dňa {{contract.date}}</p>
        <div style="margin-top: 60px;">
          <div style="border-top: 1px solid #000; padding-top: 8px;">
            <p style="margin: 0; font-size: 9pt;">za CBC AG</p>
            <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 10pt;">{{billing.representative}}</p>
            <p style="margin: 0; font-size: 8pt; color: #666;">(splnomocnenec)</p>
          </div>
        </div>
      </div>
      <div style="width: 45%;">
        <p style="margin-bottom: 5px; font-size: 9pt; text-align: center;">V _________________ dňa {{contract.date}}</p>
        <div style="margin-top: 60px; text-align: center;">
          <div style="border-top: 1px solid #000; padding-top: 8px; margin-bottom: 40px;">
            <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 10pt;">{{customer.fullName}}</p>
            <p style="margin: 0; font-size: 8pt; color: #666;">(RODIČKA)</p>
          </div>
          <div style="border-top: 1px solid #000; padding-top: 8px; margin-top: 50px;">
            <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 10pt;">{{father.fullName}}</p>
            <p style="margin: 0; font-size: 8pt; color: #666;">(Otec)</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Referenčné číslo verzie -->
  <div style="position: absolute; bottom: 20px; right: 30px;">
    <p style="font-size: 7pt; color: #999;">CBCAG-ZDLMO-V003</p>
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
      // Billset fields
      "billset.name": "Premium Plus 25 rokov",
      "billset.productName": "Uchovávanie kmeňových buniek",
      "billset.currency": "EUR",
      "billset.validFrom": "01.01.2024",
      "billset.validTo": "31.12.2026",
      "billset.notes": "",
      "billset.totalNetAmount": "2 500,00",
      "billset.totalDiscountAmount": "250,00",
      "billset.totalVatAmount": "450,00",
      "billset.totalGrossAmount": "2 700,00",
      // Payment conditions
      "payment.method": "Splátky",
      "payment.installments": "24",
      "payment.installmentAmount": "112,50",
      "payment.firstPaymentDue": "15.02.2026",
      "payment.frequency": "mesačne",
      "payment.depositAmount": "500,00",
      "payment.remainingAmount": "2 200,00",
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
      case "loop": return List;
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
