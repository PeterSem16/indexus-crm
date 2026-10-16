import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FinderPoint, FinderResult } from "@shared/provider-finder";
import type { ProviderFinderCopy } from "@/i18n/provider-finder-translations";
import { finderApi } from "./api";

type ResultMarker = { key: string; marker: L.Marker; button: HTMLButtonElement; onClick: () => void };

export function ProviderMap({ prefix, point, results, selected, onSelect, c }: {
  prefix: string;
  point: FinderPoint;
  results: FinderResult[];
  selected?: string;
  onSelect: (id: string) => void;
  c: ProviderFinderCopy;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const resultMarkers = useRef<ResultMarker[]>([]);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [map, setMap] = useState<L.Map | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let leafletMap: L.Map | null = null;
    let tileLayer: L.TileLayer | null = null;
    let resizeObserver: ResizeObserver | undefined;
    const host = container.current;

    setError("");
    setLoading(true);
    if (!host) return;

    finderApi<{ tileUrl: string }>(`${prefix}/map-config`)
      .then(({ tileUrl }) => {
        if (cancelled || !container.current) return;
        leafletMap = L.map(container.current, {
          center: [point.lat, point.lng],
          zoom: 12,
          zoomControl: true,
          scrollWheelZoom: true,
        });
        mapRef.current = leafletMap;
        tileLayer = L.tileLayer(tileUrl, {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          maxZoom: 19,
        });
        tileLayer.on("tileerror", () => {
          if (!cancelled) setError(c.error);
        });
        tileLayer.addTo(leafletMap);

        resizeObserver = new ResizeObserver(() => leafletMap?.invalidateSize({ pan: false }));
        resizeObserver.observe(host);
        window.addEventListener("resize", invalidate);
        setMap(leafletMap);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(c.error);
          setLoading(false);
        }
      });

    function invalidate() {
      leafletMap?.invalidateSize({ pan: false });
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", invalidate);
      if (tileLayer) {
        tileLayer.off("tileerror");
        tileLayer.remove();
      }
      leafletMap?.off();
      leafletMap?.remove();
      if (mapRef.current === leafletMap) mapRef.current = null;
      resultMarkers.current = [];
      setMap((current) => current === leafletMap ? null : current);
    };
  }, [prefix, point.lat, point.lng, c.error]);

  useEffect(() => {
    if (!map) return;
    const markers: ResultMarker[] = [];
    const bounds = L.latLngBounds([point.lat, point.lng], [point.lat, point.lng]);

    const origin = L.circleMarker([point.lat, point.lng], {
      radius: 8,
      color: "#fffefa",
      weight: 3,
      fillColor: "#3c7e7b",
      fillOpacity: 1,
      bubblingMouseEvents: false,
    }).addTo(map);
    origin.bindTooltip(c.origin, { direction: "top", offset: [0, -8] });

    for (const [index, row] of results.entries()) {
      if (row.lat === null || row.lng === null) continue;
      const key = `${row.type}:${row.id}`;
      const position: L.LatLngExpression = [row.lat, row.lng];
      bounds.extend(position);

      const button = document.createElement("button");
      button.type = "button";
      button.className = `pf-map-marker${selected === key ? " selected" : ""}`;
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `${index + 1}. ${row.name}`);
      button.title = row.name;
      const onClick = () => selectRef.current(key);
      button.addEventListener("click", onClick);

      const marker = L.marker(position, {
        title: row.name,
        keyboard: false,
        icon: L.divIcon({
          className: "pf-leaflet-marker",
          html: button,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(map);
      markers.push({ key, marker, button, onClick });
    }
    resultMarkers.current = markers;

    if (markers.length) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    } else {
      map.setView([point.lat, point.lng], 12);
    }

    return () => {
      origin.remove();
      for (const { marker, button, onClick } of markers) {
        button.removeEventListener("click", onClick);
        marker.off();
        marker.remove();
      }
      if (resultMarkers.current === markers) resultMarkers.current = [];
    };
  }, [map, point.lat, point.lng, results, c.origin]);

  useEffect(() => {
    for (const { key, button } of resultMarkers.current) {
      const isSelected = key === selected;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    }
  }, [selected, map, results]);

  return <div className="pf-map-host" aria-label={c.map}>
    <div className="pf-map-canvas" ref={container} />
    {(loading || error) && <div className={`pf-message ${error ? "pf-error" : ""}`} role={error ? "alert" : "status"} style={{ position: "relative", margin: 12 }}>
      {error || c.loading}
    </div>}
  </div>;
}
