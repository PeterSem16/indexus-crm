import type { RegistryPerson } from "@shared/healthcare-legal-entity";
import { Badge } from "@/components/ui/badge";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { sortRegistryPeopleForTimeline } from "@/lib/registry-roles-timeline";
import { useI18n } from "@/i18n";

type RegistryRolesTimelineProps = {
  people: RegistryPerson[];
  c: HealthcareLegalEntityCopy;
};

function formatRegistryDate(value: string | null, locale: string, c: HealthcareLegalEntityCopy) {
  if (value == null || value.trim() === "") return c.registryDateMissing;

  let date: Date;
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day
    ) {
      return c.registryDateInvalid;
    }
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return c.registryDateInvalid;
  date = new Date(timestamp);

  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return c.registryDateInvalid;
  }
}

export function RegistryRolesTimeline({ people, c }: RegistryRolesTimelineProps) {
  const { locale } = useI18n();
  const sortedPeople = sortRegistryPeopleForTimeline(people);

  return (
    <ol
      data-testid="registry-roles-timeline"
      className="relative space-y-3 before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-border"
    >
      {sortedPeople.map((person) => (
        <li
          key={person.key}
          data-testid={`registry-role-${person.key}`}
          className="relative pl-8"
        >
          <span
            aria-hidden="true"
            className={`absolute left-1.5 top-4 h-3 w-3 rounded-full border-2 bg-background ${
              person.current ? "border-primary" : "border-muted-foreground/50"
            }`}
          />
          <article className="rounded-lg border bg-card px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0">
                <h4 className="break-words font-medium leading-snug">{person.name}</h4>
                <p className="mt-1 break-words text-sm text-muted-foreground">{person.role}</p>
              </div>
              <Badge variant={person.current ? "secondary" : "outline"} className="shrink-0">
                {person.current ? c.current : c.ended}
              </Badge>
            </div>
            <dl className="mt-3 grid gap-2 border-t pt-3 text-xs sm:grid-cols-2 sm:gap-4">
              <div className="flex min-w-0 flex-wrap gap-x-1.5">
                <dt className="text-muted-foreground">{c.validFrom}:</dt>
                <dd className="font-medium tabular-nums">{formatRegistryDate(person.validFrom, locale, c)}</dd>
              </div>
              <div className="flex min-w-0 flex-wrap gap-x-1.5">
                <dt className="text-muted-foreground">{c.validTo}:</dt>
                <dd className="font-medium tabular-nums">{person.current && !person.validTo?.trim() ? c.registryPresent : formatRegistryDate(person.validTo, locale, c)}</dd>
              </div>
            </dl>
          </article>
        </li>
      ))}
    </ol>
  );
}
