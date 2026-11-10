import React, { useState } from "react";
import { calculateLocalIban } from "@shared/bank-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Translations } from "@/i18n/translations";

type Props = {
  bankAccountIban: string; swiftCode: string;
  onIbanChange: (value: string) => void; onSwiftChange: (value: string) => void;
  countryCode: string; t: Translations;
  isHidden: (field: string) => boolean; isReadonly: (field: string) => boolean;
  bankAccountName?: string; onAccountNameChange?: (value: string) => void;
  accountNumber?: string; onAccountNumberChange?: (value: string) => void;
  bankCode?: string; onBankCodeChange?: (value: string) => void;
};

/** Shared by Persons and Clinics; controlled local-bank fields are persisted by Clinics. */
export function BankAccountSection(props: Props) {
  const [localAccount, setLocalAccount] = useState("");
  const [localCode, setLocalCode] = useState("");
  const { t, isHidden, isReadonly } = props;
  if (isHidden("bank_account")) return null;
  const readonly = isReadonly("bank_account");
  const account = props.accountNumber ?? localAccount;
  const bank = props.bankCode ?? localCode;
  const calculated = calculateLocalIban(props.countryCode, account, bank);
  return <div className="min-w-0 space-y-4" data-testid="bank-account-section">
    {props.bankAccountName !== undefined && <div className="space-y-2">
      <Label htmlFor="clinic-bank-account-name">{t.clinicBanking.accountName}</Label>
      <Input id="clinic-bank-account-name" data-testid="input-clinic-bank-account-name" maxLength={200}
        value={props.bankAccountName} disabled={readonly} onChange={e => props.onAccountNameChange?.(e.target.value)} />
    </div>}
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <Label className="text-sm font-medium">{t.collaborators.fields.accountAndBankCode}</Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="bank-local-account" className="text-xs text-muted-foreground">{t.collaborators.fields.accountNumber}</Label>
          <Input id="bank-local-account" data-testid="wizard-input-account-number" value={account} placeholder="1234567890" disabled={readonly}
            onChange={e => { const value = e.target.value.replace(/[^0-9-]/g, ""); if (props.onAccountNumberChange) props.onAccountNumberChange(value); else setLocalAccount(value); }} />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="bank-local-code" className="text-xs text-muted-foreground">{t.collaborators.fields.bankCode}</Label>
          <Input id="bank-local-code" data-testid="wizard-input-bank-code" value={bank} placeholder="0200" maxLength={4} disabled={readonly}
            onChange={e => { const value = e.target.value.replace(/\D/g, "").slice(0, 4); if (props.onBankCodeChange) props.onBankCodeChange(value); else setLocalCode(value); }} />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" className="w-full" data-testid="btn-convert-iban"
            disabled={readonly || !calculated} onClick={() => props.onIbanChange(calculated)}>{t.collaborators.fields.calculateIban}</Button>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <Label htmlFor="bank-iban">{t.collaborators.fields.bankAccountIban}</Label>
        <Input id="bank-iban" data-testid="wizard-input-collaborator-iban" value={props.bankAccountIban} disabled={readonly}
          onChange={e => props.onIbanChange(e.target.value)} placeholder={`${props.countryCode || "SK"}...`} />
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor="bank-swift">{t.collaborators.fields.swiftCode}</Label>
        <Input id="bank-swift" data-testid="wizard-input-collaborator-swift" value={props.swiftCode} disabled={readonly}
          onChange={e => props.onSwiftChange(e.target.value)} />
      </div>
    </div>
  </div>;
}
