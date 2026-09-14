import React from "react";
import { MapPin } from "lucide-react";
import { getPriorityContactCityLocation, isPriorityReferral, type PriorityContact } from "./priority-builder";

export interface QueueMetadataBadgeCopy {
  referralBadge: string;
  cityCountrySeparator: string;
}

interface QueueMetadataBadgesProps {
  contact: PriorityContact;
  copy: QueueMetadataBadgeCopy;
  testIdSuffix?: string;
}

/**
 * Shared renderer for scheduled/callback queue metadata.  A missing location
 * is intentionally omitted instead of displaying a guessed or placeholder
 * city; the priority helper remains the single type-aware location source.
 */
export function QueueMetadataBadges({ contact, copy, testIdSuffix }: QueueMetadataBadgesProps) {
  const location = getPriorityContactCityLocation(contact);
  const cityLabel = location
    ? `${location.city}${location.countryCode && location.countryCode !== "??" ? copy.cityCountrySeparator + location.countryCode : ""}`
    : null;
  if (!isPriorityReferral(contact) && !cityLabel) return null;

  return (
    <>
      {isPriorityReferral(contact) && (
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0"
          style={{ background: "#f1ebfb", color: "#654d96", border: "1px solid #d7c9ed" }}
          data-testid={testIdSuffix ? `badge-scheduled-referral-${testIdSuffix}` : undefined}
        >
          {copy.referralBadge}
        </span>
      )}
      {cityLabel && (
        <span
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0"
          title={cityLabel}
          data-testid={testIdSuffix ? `badge-scheduled-city-${testIdSuffix}` : undefined}
        >
          <MapPin className="h-2.5 w-2.5" />
          {cityLabel}
        </span>
      )}
    </>
  );
}