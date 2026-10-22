import { useEffect, useRef, useState } from "react";
import type { FinderPoint, FinderResult } from "@shared/provider-finder";
import type { ProviderFinderCopy } from "@/i18n/provider-finder-translations";
import { finderApi } from "./api";
import { importGoogleMapsLibraries, loadGoogleMaps, onGoogleMapsAuthorizationFailure } from "./google-maps-loader";

type MapLibraries = {
  map: any;
  Marker: any;
  Bounds: any;
};
type MapMarkerRecord = { marker: any; cleanup?: () => void };

function mapErrorMessage(error: unknown, c: ProviderFinderCopy) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : error instanceof Error ? error.message : "";
  if (code === "maps_not_configured") return c.mapsMissing;
  if (["maps_authorization", "maps_auth", "maps_unauthorized", "maps_forbidden"].includes(code)) return c.mapsAuthorization;
  if (["maps_billing_or_quota", "maps_over_query_limit"].includes(code)) return c.mapsBillingOrQuota;
  if (["maps_quota", "rate_limited"].includes(code)) return c.mapsQuota;
  return c.mapUnavailable;
}

export function ProviderMap({ prefix, point, results, selected, onSelect, c, locale, showRecommendations = true }: {
  prefix: string;
  point: FinderPoint;
  results: FinderResult[];
  selected?: string;
  onSelect: (id: string) => void;
  c: ProviderFinderCopy;
  locale: string;
  showRecommendations?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const markerButtons = useRef<{ key: string; button: HTMLButtonElement }[]>([]);
  const [libraries, setLibraries] = useState<MapLibraries | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let authFailed = false;
    let observer: ResizeObserver | undefined;
    let map: any;
    const host = container.current;
    setError("");
    setLoading(true);
    setLibraries(null);
    if (!host) return;

    const unsubscribeAuth = onGoogleMapsAuthorizationFailure(() => {
      authFailed = true;
      if (!cancelled) {
        setLibraries(null);
        setError(c.mapsAuthorization);
        setLoading(false);
      }
    });
    void (async () => {
      const config = await finderApi<{ browserKey: string }>(`${prefix}/map-config`);
      if (!config.browserKey) throw new Error("maps_not_configured");
      const google = await loadGoogleMaps(config.browserKey, locale);
      const [mapsLibrary, markerLibrary, coreLibrary] = await importGoogleMapsLibraries(google);
      if (cancelled || authFailed || !container.current) return;
      map = new mapsLibrary.Map(container.current, {
        center: { lat: point.lat, lng: point.lng },
        zoom: 12,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      observer = new ResizeObserver(() => {
        if (map && !cancelled) {
          // Google Maps observes its container, but a resize event is needed when
          // a responsive modal changes from the list pane to the map pane.
          window.dispatchEvent(new Event("resize"));
        }
      });
      observer.observe(container.current);
      if (cancelled) return;
      setLibraries({ map, Marker: markerLibrary.AdvancedMarkerElement, Bounds: coreLibrary.LatLngBounds });
      setLoading(false);
    })().catch((reason: unknown) => {
      if (!cancelled) {
        setError(mapErrorMessage(reason, c));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      observer?.disconnect();
      markerButtons.current = [];
      if (map) window.google?.maps?.event?.clearInstanceListeners?.(map);
      map = null;
    };
  }, [prefix, locale, c.mapsAuthorization, c.mapsMissing, c.mapsQuota, c.mapUnavailable]);

  useEffect(() => {
    if (!libraries) return;
    const { map, Marker, Bounds } = libraries;
    const markers: MapMarkerRecord[] = [];
    const cleanup = () => {
      for (const { marker, cleanup } of markers) {
        cleanup?.();
        // SDK failures must not escape React's effect cleanup either.
        try { marker.map = null; } catch { /* Best-effort disposal of an SDK object. */ }
      }
      markers.length = 0;
      markerButtons.current = [];
    };

    try {
      const bounds = new Bounds();
      bounds.extend({ lat: point.lat, lng: point.lng });

      const origin = document.createElement("div");
      origin.className = "pf-map-origin-marker";
      origin.setAttribute("aria-hidden", "true");
      const originMarker = new Marker({
        position: { lat: point.lat, lng: point.lng },
        content: origin,
        title: c.origin,
      });
      markers.push({ marker: originMarker });
      originMarker.map = map;

      const visibleResults = results.flatMap((row, index) => {
        if (row.lat === null || row.lng === null) return [];
        const key = `${row.type}:${row.id}`;
        const position = { lat: row.lat, lng: row.lng };
        bounds.extend(position);

        const button = document.createElement("button");
        button.type = "button";
        button.className = `pf-map-marker${showRecommendations && row.quality?.tier === "recommended" ? " recommended" : ""}${selected === key ? " selected" : ""}`;
        button.textContent = String(index + 1);
        button.setAttribute("aria-label", `${index + 1}. ${row.name}`);
        button.setAttribute("aria-pressed", String(selected === key));
        button.title = row.name;
        const marker = new Marker({ position, content: button, title: row.name });
        const select = () => selectRef.current(key);
        button.addEventListener("click", select);
        markers.push({ marker, cleanup: () => button.removeEventListener("click", select) });
        marker.map = map;
        return [{ key, button }];
      });
      markerButtons.current = visibleResults;
      if (visibleResults.length) map.fitBounds(bounds, 36);
      else map.setCenter({ lat: point.lat, lng: point.lng });
      setError("");
    } catch (reason) {
      cleanup();
      setLoading(false);
      setError(mapErrorMessage(reason, c));
    }
    return cleanup;
  }, [libraries, point.lat, point.lng, results, c.origin, c.mapUnavailable, c.mapsAuthorization, c.mapsMissing, c.mapsQuota, c.mapsBillingOrQuota, showRecommendations]);

  useEffect(() => {
    for (const { key, button } of markerButtons.current) {
      const isSelected = key === selected;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    }
  }, [selected, libraries, results]);

  return <div className="pf-map-host" aria-label={c.map} data-testid="provider-results-map">
    <div className="pf-map-canvas" ref={container} style={error ? { visibility: "hidden" } : undefined} aria-hidden={!!error} />
    {(loading || error) && <div className={`pf-message ${error ? "pf-error absolute inset-0 z-10 grid content-center text-center" : ""}`} role={error ? "alert" : "status"}>
      {error || c.loading}
    </div>}
  </div>;
}
