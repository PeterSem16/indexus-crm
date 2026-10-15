import type { RegistryPerson } from "@shared/healthcare-legal-entity";

function timestamp(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const calendar = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (calendar) {
    const year = Number(calendar[1]), month = Number(calendar[2]), day = Number(calendar[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Newest known role start first; undated roles retain their source order. */
export function sortRegistryPeopleForTimeline(people: readonly RegistryPerson[]): RegistryPerson[] {
  return people
    .map((person, index) => ({
      person,
      index,
      date: timestamp(person.validFrom) ?? timestamp(person.validTo),
    }))
    .sort((a, b) => {
      if (a.date === undefined) return b.date === undefined ? a.index - b.index : 1;
      if (b.date === undefined) return -1;
      return b.date - a.date || a.index - b.index;
    })
    .map(({ person }) => person);
}
