import { useEffect, useRef, useState } from "react";
import type { FinderContext, FinderPoint, FinderResult, FinderSelection } from "@shared/provider-finder";
import type { ProviderFinderCopy } from "@/i18n/provider-finder-translations";
import { finderApi } from "./api";

export type SearchFilters = {
  address: string; radius: number; types: ("clinic" | "hospital")[];
  peopleOnly: boolean; personQuery: string;
};
export type FinderCandidate = { label: string; point: FinderPoint; approximate: boolean };
export type RankedFinderResult = FinderResult & {
  cooperating?: boolean; uploadedContract?: boolean; hasRepresentative?: boolean; priorityScore?: number;
};
export type ProviderFinderProps = {
  context: FinderContext; prefix: string; initialAddress?: string; customerName?: string; locale: string;
  publicView?: boolean; onSelect: (selection: FinderSelection, result: FinderResult) => Promise<void> | void;
  onClose?: () => void; onInvalidate?: () => void;
};
export const providerKey = (row: FinderResult) => `${row.type}:${row.id}`;

function messageFor(error: unknown, c: ProviderFinderCopy) {
  const code = (error as { code?: string })?.code || "";
  if (code === "maps_not_configured") return c.mapsMissing;
  if (["maps_authorization", "maps_auth", "maps_unauthorized", "maps_forbidden"].includes(code)) return c.mapsAuthorization;
  if (["maps_billing_or_quota", "maps_over_query_limit"].includes(code)) return c.mapsBillingOrQuota;
  if (["maps_quota", "rate_limited"].includes(code)) return c.mapsQuota;
  if (["maps_unavailable", "maps_timeout"].includes(code)) return c.mapUnavailable;
  if (["queue_full", "geocode_queue_full", "geocode_wait_timeout"].includes(code)) return c.geocodeRetry;
  return c.error;
}

export function useProviderFinder(props: ProviderFinderProps, c: ProviderFinderCopy) {
  const { context, prefix, initialAddress = "", locale, publicView = false } = props;
  const defaults = (): SearchFilters => ({
    address: initialAddress.trim(), radius: context.policy.defaultRadiusKm,
    types: ["clinic", "hospital"], peopleOnly: false, personQuery: "",
  });
  const scope = JSON.stringify([prefix, context.billingCompanyId, context.country, initialAddress, context.policy.defaultRadiusKm]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const propsRef = useRef(props); propsRef.current = props;
  const copyRef = useRef(c); copyRef.current = c;
  const sequence = useRef(0);
  const controller = useRef<AbortController>();
  const [stateScope, setStateScope] = useState(scope);
  const [filters, setFilters] = useState<SearchFilters>(defaults);
  const [draft, setDraft] = useState<SearchFilters>(defaults);
  const [editing, setEditing] = useState(initialAddress.trim().length < 4);
  const [point, setPoint] = useState<FinderPoint | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [candidates, setCandidates] = useState<FinderCandidate[]>([]);
  const [results, setResults] = useState<RankedFinderResult[]>([]);
  const [missing, setMissing] = useState(0);
  const [busy, setBusy] = useState(initialAddress.trim().length >= 4);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const sameScope = stateScope === scope;

  async function run(input: SearchFilters, suppliedPoint?: FinderPoint, useGps = false, suppliedLabel?: string) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const request = ++sequence.current;
    const owner = scope;
    const active = () => sequence.current === request && scopeRef.current === owner && !abort.signal.aborted;
    setFilters(input); setDraft(input); setEditing(false); setError("");
    setCandidates([]); setResults([]); setSelected(""); setSelectedPerson("");
    setMissing(0); setSearched(false); setBusy(true); setPoint(suppliedPoint || null);
    setOriginLabel(suppliedPoint ? suppliedLabel || input.address : "");
    propsRef.current.onInvalidate?.();
    try {
      let origin = suppliedPoint;
      let label = suppliedLabel || input.address;
      if (useGps) {
        if (!navigator.geolocation) throw new Error("geolocation_unavailable");
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 0 }));
        if (!active()) return;
        origin = { lat: position.coords.latitude, lng: position.coords.longitude };
        label = copyRef.current.gps;
      } else if (!origin) {
        const response = await finderApi<{ candidates: FinderCandidate[] }>(`${prefix}/geocode`, "POST",
          { address: input.address, language: locale }, abort.signal);
        if (!active()) return;
        // Only a single precise location can proceed without user intervention.
        // Ambiguous/approximate formatted Google addresses are shown without ANY map.
        if (response.candidates.length !== 1 || response.candidates[0].approximate) {
          setCandidates(response.candidates);
          setEditing(response.candidates.length === 0);
          if (!response.candidates.length) setError(copyRef.current.addressNotFound);
          return;
        }
        origin = response.candidates[0].point;
      }
      if (!active() || !origin) return;
      // Map captions use only the original user input, never Google's formatted address.
      setCandidates([]); setPoint(origin); setOriginLabel(label);
      const response = await finderApi<{ results: RankedFinderResult[]; missingLocations?: number }>(`${prefix}/search`, "POST", {
        point: origin, radiusKm: input.radius, service: "", types: input.types,
        peopleOnly: input.peopleOnly, personQuery: input.personQuery,
      }, abort.signal);
      if (!active()) return;
      setResults(response.results); setMissing(response.missingLocations || 0); setSearched(true);
    } catch (reason) {
      if (active()) { setError(messageFor(reason, copyRef.current)); setEditing(true); }
    } finally {
      if (active()) setBusy(false);
    }
  }

  useEffect(() => {
    const input = defaults();
    setStateScope(scope); setFilters(input); setDraft(input); setSaving(false);
    setResults([]); setPoint(null); setOriginLabel(""); setCandidates([]);
    setSelected(""); setSelectedPerson(""); setError(""); setSearched(false); setMissing(0);
    if (input.address.length >= 4) void run(input);
    else {
      controller.current?.abort(); sequence.current++;
      propsRef.current.onInvalidate?.();
      setEditing(true); setBusy(false); setError(copyRef.current.addressRequired);
    }
    return () => { sequence.current++; controller.current?.abort(); };
  }, [scope]);

  const visibleResults = sameScope ? results : [];
  const current = visibleResults.find(row => providerKey(row) === selected);
  const requiredPerson = current?.suggestedPersonId || (!publicView ? current?.quality?.personId : undefined);
  const personValid = !selectedPerson || !!current?.people.some(person => person.id === selectedPerson);
  const missingPerson = !!requiredPerson && !selectedPerson;
  const canConfirm = sameScope && !!current && !busy && !saving && !editing && !candidates.length && !missingPerson && personValid;

  function openEditor() {
    setDraft({ ...filters, types: [...filters.types] });
    setError(""); setEditing(true);
  }
  function apply() {
    if (saving || !sameScope) return;
    const input = { ...draft, address: draft.address.trim(), personQuery: draft.personQuery.trim() };
    if (input.address.length < 4) { setError(c.addressRequired); setEditing(true); return; }
    if (!input.types.length) { setError(c.chooseType); setEditing(true); return; }
    if (input.radius < 1 || input.radius > context.policy.maxRadiusKm) return;
    const reuse = point && input.address === filters.address && originLabel === filters.address ? point : undefined;
    void run(input, reuse);
  }
  function pick(key: string) {
    if (busy || saving || !sameScope) return;
    const row = visibleResults.find(result => providerKey(result) === key);
    if (!row) return;
    setSelected(key);
    const suggestion = row.suggestedPersonId || (!publicView ? row.quality?.personId : undefined);
    setSelectedPerson(suggestion && row.people.some(person => person.id === suggestion) ? suggestion : "");
    setError("");
  }
  async function confirm() {
    if (!canConfirm || !current || scopeRef.current !== scope) return;
    const owner = sequence.current;
    setSaving(true); setError("");
    try {
      await props.onSelect({
        id: current.id, type: current.type, billingCompanyId: context.billingCompanyId, country: context.country,
        ...(selectedPerson ? { personId: selectedPerson } : {}),
      }, current);
    } catch {
      if (scopeRef.current === scope && sequence.current === owner) setError(copyRef.current.error);
    } finally {
      if (scopeRef.current === scope && sequence.current === owner) setSaving(false);
    }
  }
  return {
    filters: sameScope ? filters : defaults(), draft, setDraft, editing, setEditing, openEditor, apply,
    point: sameScope ? point : null, originLabel: sameScope ? originLabel : "",
    candidates: sameScope ? candidates : [], results: visibleResults, missing,
    busy: !sameScope || busy, saving, searched: sameScope && searched, error: sameScope ? error : "",
    selected, selectedPerson, setSelectedPerson, current, requiredPerson, missingPerson, canConfirm, pick, confirm,
    confirmCandidate: (candidate: FinderCandidate) => { if (!saving) void run(filters, candidate.point); },
    gps: () => {
      if (saving) return;
      if (!draft.types.length) { setError(c.chooseType); return; }
      void run({ ...draft, address: draft.address.trim(), personQuery: draft.personQuery.trim() }, undefined, true);
    },
    expand: () => {
      if (point && !saving) void run({ ...filters, radius: Math.min(context.policy.maxRadiusKm, filters.radius + 25) }, point, false, originLabel);
    },
  };
}
