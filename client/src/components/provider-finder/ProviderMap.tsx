import { useEffect, useRef, useState } from "react";
import type { FinderPoint, FinderResult } from "@shared/provider-finder";
import type { ProviderFinderCopy } from "@/i18n/provider-finder-translations";
import { finderApi } from "./api";

let loader: Promise<any> | undefined;
function loadGoogleMaps(browserKey: string): Promise<any> {
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve((window as any).google.maps);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const callback = "__indexusProviderMaps";
    (window as any)[callback] = () => { delete (window as any)[callback]; resolve((window as any).google.maps); };
    const params = new URLSearchParams({ key: browserKey, v: "weekly", loading: "async", callback });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => { delete (window as any)[callback]; script.remove(); loader = undefined; reject(new Error("maps_unavailable")); };
    document.head.appendChild(script);
  });
  return loader;
}
export function ProviderMap({ prefix, point, results, selected, onSelect, c }: {
  prefix: string; point: FinderPoint; results: FinderResult[]; selected?: string; onSelect: (id: string) => void; c: ProviderFinderCopy;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapState, setMapState] = useState<{ map: any; google: any; Marker: any; Bounds: any } | null>(null);
  const markerButtons = useRef<{ key: string; button: HTMLButtonElement }[]>([]);
  const selectRef = useRef(onSelect); selectRef.current = onSelect;
  useEffect(() => {
    let cancelled = false;
    setError(""); setLoading(true);
    (async () => {
      const config = await finderApi<{ browserKey: string }>(`${prefix}/map-config`);
      const google = await loadGoogleMaps(config.browserKey);
      const [{ Map }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
        google.importLibrary("maps"), google.importLibrary("marker"), google.importLibrary("core"),
      ]);
      if (cancelled || !container.current) return;
      const map = new Map(container.current, { center: point, zoom: 12, mapId: "DEMO_MAP_ID", mapTypeControl: false, streetViewControl: false });
      setMapState({ map, google, Marker: AdvancedMarkerElement, Bounds: LatLngBounds });
      setLoading(false);
    })().catch((e: { code?: string }) => { if (!cancelled) { setError(e.code === "maps_not_configured" ? c.mapsMissing : c.error); setLoading(false); } });
    return () => { cancelled = true; setMapState(null); };
  }, [prefix, c]);
  useEffect(() => {
      if (!mapState) return;
      const { map, Marker, Bounds } = mapState;
      const markers: any[] = []; markerButtons.current = [];
      const bounds = new Bounds(); bounds.extend(point);
      const origin = document.createElement("div");
      origin.className = "pf-map-marker selected"; origin.textContent = "◎"; origin.title = c.origin;
      markers.push(new Marker({ map, position: point, content: origin, title: c.origin }));
      for (const [index, row] of results.entries()) {
        if (row.lat === null || row.lng === null) continue;
        const position = { lat: row.lat, lng: row.lng }; bounds.extend(position);
        const button = document.createElement("button"); button.type = "button";
        button.className = `pf-map-marker${selected === `${row.type}:${row.id}` ? " selected" : ""}`;
        button.textContent = String(index + 1); button.setAttribute("aria-label", `${index + 1}. ${row.name}`);
        button.onclick = () => selectRef.current(`${row.type}:${row.id}`);
        markerButtons.current.push({ key: `${row.type}:${row.id}`, button });
        markers.push(new Marker({ map, position, content: button, title: row.name }));
      }
      if (results.length) map.fitBounds(bounds, 35);
      return () => { for (const marker of markers) marker.map = null; markerButtons.current = []; };
  }, [mapState, point.lat, point.lng, results, c]);
  useEffect(() => {
    for (const { key, button } of markerButtons.current) button.classList.toggle("selected", key === selected);
  }, [selected, mapState, results]);
  return <div className="pf-map-host" aria-label={c.map}>
    <div className="pf-map-canvas" ref={container} />
    {(loading || error) && <div className={`pf-message ${error ? "pf-error" : ""}`} role={error ? "alert" : "status"} style={{ position: "relative", margin: 12 }}>{error || c.loading}</div>}
  </div>;
}
