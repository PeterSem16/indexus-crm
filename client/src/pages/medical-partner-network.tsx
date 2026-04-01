import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Building2, Users, Settings, LayoutDashboard, Plus, Edit, Trash2,
  Phone, Mail, MessageCircle, Star, Search, Filter, Hospital, Stethoscope,
  UserCheck, UserX, Link2, ChevronRight, Building, Clock, Loader2,
  Network, MapPin, X, User, Sparkles, ZoomIn, ZoomOut, Maximize2
} from "lucide-react";

type PartnerCategory = {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  entityScope: string;
  sortOrder: number;
  isActive: boolean;
};

type MpnStats = {
  totalHospitals: number;
  totalClinics: number;
  totalPersons: number;
  totalAssignments: number;
  totalChannels: number;
  totalCategories: number;
  unassignedPersons: number;
  unassignedInstitutions: number;
};

type Institution = {
  id: string;
  name: string;
  city: string | null;
  countryCode: string;
  isActive: boolean;
  type: "hospital" | "clinic";
  phone?: string | null;
  email?: string | null;
};

type Person = {
  id: string;
  source: "collaborator" | "clinic" | "hospital";
  titleBefore: string;
  firstName: string;
  lastName: string;
  titleAfter: string;
  fullName: string;
  phone: string;
  mobile: string;
  email: string;
  isActive: boolean;
  countryCode: string;
  institutionName: string;
  institutionId: string;
  linkedInstitutions: { type: string; id: string; name: string }[];
  collaboratorType: string;
};

type NetworkNode = {
  id: string;
  type: "hospital" | "clinic" | "person";
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  isPrimary?: boolean;
  isCenter?: boolean;
  role?: string;
  department?: string;
  position?: string;
  categoryName?: string;
};

type NetworkEdge = {
  from: string;
  to: string;
  label?: string;
};

// ═══════════════════════════════════════════════════════════════
// NETWORK EXPLORER - search-first + SVG network visualization
// ═══════════════════════════════════════════════════════════════

const NODE_COLORS = {
  hospital: { fill: "#3b82f6", stroke: "#2563eb", text: "#ffffff", glow: "rgba(59,130,246,0.3)" },
  clinic: { fill: "#10b981", stroke: "#059669", text: "#ffffff", glow: "rgba(16,185,129,0.3)" },
  person: { fill: "#8b5cf6", stroke: "#7c3aed", text: "#ffffff", glow: "rgba(139,92,246,0.3)" },
};

function layoutNodes(
  center: { id: string; type: string; label: string; sublabel?: string },
  ring1: { id: string; type: string; label: string; sublabel?: string; role?: string; department?: string; position?: string; categoryName?: string; isPrimary?: boolean }[],
  ring2Map: Map<string, { id: string; type: string; label: string; sublabel?: string }[]>,
): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const cx = 450, cy = 300;

  nodes.push({ ...center, x: cx, y: cy, isCenter: true } as NetworkNode);

  const ring1Radius = Math.max(180, ring1.length * 25);
  ring1.forEach((item, i) => {
    const angle = (2 * Math.PI * i) / Math.max(ring1.length, 1) - Math.PI / 2;
    const nx = cx + ring1Radius * Math.cos(angle);
    const ny = cy + ring1Radius * Math.sin(angle);
    nodes.push({ ...item, x: nx, y: ny } as NetworkNode);
    edges.push({ from: center.id, to: item.id, label: item.role || item.position || "" });

    const ring2Items = ring2Map.get(item.id) || [];
    const ring2Radius = 100;
    ring2Items.forEach((r2, j) => {
      if (nodes.some(n => n.id === r2.id)) {
        edges.push({ from: item.id, to: r2.id });
        return;
      }
      const spread = Math.min(Math.PI * 0.6, ring2Items.length * 0.3);
      const baseAngle = angle;
      const a2 = baseAngle - spread / 2 + (spread * j) / Math.max(ring2Items.length - 1, 1);
      const r2x = nx + ring2Radius * Math.cos(a2);
      const r2y = ny + ring2Radius * Math.sin(a2);
      nodes.push({ ...r2, x: r2x, y: r2y } as NetworkNode);
      edges.push({ from: item.id, to: r2.id });
    });
  });

  return { nodes, edges };
}

function NetworkSVG({ nodes, edges, onNodeClick }: { nodes: NetworkNode[]; edges: NetworkEdge[]; onNodeClick?: (node: NetworkNode) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 900, h: 600 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map(n => n.x)) - 80;
    const minY = Math.min(...nodes.map(n => n.y)) - 60;
    const maxX = Math.max(...nodes.map(n => n.x)) + 80;
    const maxY = Math.max(...nodes.map(n => n.y)) + 60;
    setViewBox({ x: minX, y: minY, w: Math.max(maxX - minX, 400), h: Math.max(maxY - minY, 300) });
  }, [nodes]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(vb => ({
      x: vb.x + vb.w * (1 - scale) / 2,
      y: vb.y + vb.h * (1 - scale) / 2,
      w: vb.w * scale,
      h: vb.h * scale,
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) * (viewBox.w / rect.width);
    const dy = (e.clientY - dragStart.y) * (viewBox.h / rect.height);
    setViewBox(vb => ({ ...vb, x: vb.x - dx, y: vb.y - dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [dragging, dragStart, viewBox]);

  const handleMouseUp = useCallback(() => { setDragging(false); }, []);

  const zoom = (factor: number) => {
    setViewBox(vb => ({
      x: vb.x + vb.w * (1 - factor) / 2,
      y: vb.y + vb.h * (1 - factor) / 2,
      w: vb.w * factor,
      h: vb.h * factor,
    }));
  };

  const fitAll = () => {
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map(n => n.x)) - 80;
    const minY = Math.min(...nodes.map(n => n.y)) - 60;
    const maxX = Math.max(...nodes.map(n => n.x)) + 80;
    const maxY = Math.max(...nodes.map(n => n.y)) + 60;
    setViewBox({ x: minX, y: minY, w: Math.max(maxX - minX, 400), h: Math.max(maxY - minY, 300) });
  };

  const getNodeRadius = (node: NetworkNode) => node.isCenter ? 38 : 28;

  const getIcon = (type: string) => {
    if (type === "hospital") return "H";
    if (type === "clinic") return "C";
    return "P";
  };

  const truncateLabel = (label: string, max: number) =>
    label.length > max ? label.slice(0, max - 1) + "…" : label;

  if (nodes.length === 0) return null;

  return (
    <div className="relative w-full border rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden" style={{ height: 500 }}>
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => zoom(0.8)} data-testid="btn-zoom-in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => zoom(1.25)} data-testid="btn-zoom-out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={fitAll} data-testid="btn-fit-all">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="glow-hospital" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor={NODE_COLORS.hospital.glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-clinic" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor={NODE_COLORS.clinic.glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-person" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor={NODE_COLORS.person.glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>

        {edges.map((edge, i) => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;
          const isHovered = hoveredNode === edge.from || hoveredNode === edge.to;
          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const fromR = getNodeRadius(fromNode);
          const toR = getNodeRadius(toNode);
          const x1 = fromNode.x + (dx / dist) * fromR;
          const y1 = fromNode.y + (dy / dist) * fromR;
          const x2 = toNode.x - (dx / dist) * toR;
          const y2 = toNode.y - (dy / dist) * toR;

          return (
            <g key={`edge-${i}`}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isHovered ? "#64748b" : "#cbd5e1"}
                strokeWidth={isHovered ? 2.5 : 1.5}
                strokeDasharray={isHovered ? "" : ""}
                opacity={hoveredNode && !isHovered ? 0.2 : 1}
                className="transition-all duration-200"
              />
              {edge.label && isHovered && (
                <text
                  x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-500 dark:fill-slate-400 pointer-events-none"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map(node => {
          const colors = NODE_COLORS[node.type];
          const r = getNodeRadius(node);
          const isHovered = hoveredNode === node.id;
          const dimmed = hoveredNode && !isHovered && !edges.some(
            e => (e.from === hoveredNode && e.to === node.id) || (e.to === hoveredNode && e.from === node.id)
          );

          return (
            <g
              key={node.id}
              className="cursor-pointer transition-all duration-200"
              opacity={dimmed ? 0.25 : 1}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onNodeClick?.(node)}
            >
              <circle
                cx={node.x} cy={node.y} r={r + (isHovered ? 4 : 0)}
                fill={colors.fill}
                stroke={isHovered ? "#fff" : colors.stroke}
                strokeWidth={isHovered ? 3 : 2}
                filter={node.isCenter ? `url(#glow-${node.type})` : undefined}
              />
              {node.isPrimary && (
                <polygon
                  points={`${node.x},${node.y - r - 8} ${node.x + 5},${node.y - r - 2} ${node.x + 3},${node.y - r + 4} ${node.x - 3},${node.y - r + 4} ${node.x - 5},${node.y - r - 2}`}
                  fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5"
                />
              )}
              <text
                x={node.x} y={node.y + 1}
                textAnchor="middle" dominantBaseline="middle"
                className="pointer-events-none font-bold"
                fill={colors.text}
                fontSize={node.isCenter ? 16 : 12}
              >
                {getIcon(node.type)}
              </text>
              <text
                x={node.x} y={node.y + r + 14}
                textAnchor="middle"
                className="pointer-events-none font-medium"
                fill="currentColor"
                fontSize={node.isCenter ? 12 : 10}
              >
                {truncateLabel(node.label, node.isCenter ? 30 : 20)}
              </text>
              {node.sublabel && (
                <text
                  x={node.x} y={node.y + r + 26}
                  textAnchor="middle"
                  className="pointer-events-none"
                  fill="#94a3b8"
                  fontSize={9}
                >
                  {truncateLabel(node.sublabel, 25)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-3 left-3 flex gap-2 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.hospital.fill }} /> Nemocnica</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.clinic.fill }} /> Ambulancia</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.person.fill }} /> Osoba</span>
      </div>
    </div>
  );
}

function NetworkExplorer() {
  const { t } = useI18n();
  const [searchType, setSearchType] = useState<"institution" | "person">("institution");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedResult, setSelectedResult] = useState<{ type: "institution" | "person"; entityType?: string; id: string; name: string } | null>(null);

  const searchTimeout = useRef<any>(null);
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setDebouncedSearch(val); }, 300);
  };

  const instQueryParams: Record<string, string> = { page: "1", limit: "15" };
  if (debouncedSearch) instQueryParams.search = debouncedSearch;

  const personQueryParams: Record<string, string> = { page: "1", limit: "15" };
  if (debouncedSearch) personQueryParams.search = debouncedSearch;

  const { data: instResults, isLoading: instLoading } = useQuery<{ data: Institution[] }>({
    queryKey: ["/api/mpn/institutions", instQueryParams],
    enabled: searchType === "institution" && debouncedSearch.length >= 2,
  });

  const { data: personResults, isLoading: personLoading } = useQuery<{ data: Person[] }>({
    queryKey: ["/api/mpn/persons", personQueryParams],
    enabled: searchType === "person" && debouncedSearch.length >= 2,
  });

  const networkUrl = selectedResult
    ? (selectedResult.type === "person"
      ? `/api/mpn/network/person/${selectedResult.id}`
      : `/api/mpn/network/institution/${selectedResult.entityType}/${selectedResult.id}`)
    : null;

  const { data: networkData, isLoading: networkLoading } = useQuery<any>({
    queryKey: ["mpn-network", networkUrl],
    queryFn: async () => {
      if (!networkUrl) return null;
      const res = await fetch(networkUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load network data");
      return res.json();
    },
    enabled: !!networkUrl,
    staleTime: 0,
    gcTime: 0,
  });

  const { nodes, edges } = useMemo(() => {
    if (!networkData || !selectedResult) return { nodes: [], edges: [] };

    if (selectedResult.type === "institution") {
      const inst = networkData.institution;
      const center = {
        id: `inst-${inst.entityType}-${inst.id}`,
        type: inst.entityType as "hospital" | "clinic",
        label: inst.name,
        sublabel: inst.city || "",
      };
      const ring1 = (networkData.persons || []).map((p: any) => ({
        id: `person-${p.person_id}`,
        type: "person" as const,
        label: [p.title_before, p.first_name, p.last_name].filter(Boolean).join(" "),
        sublabel: p.collaborator_type || "",
        role: p.role,
        department: p.department,
        position: p.position,
        categoryName: p.category_name,
        isPrimary: p.is_primary,
      }));
      const ring2Map = new Map<string, any[]>();
      for (const oa of (networkData.otherAssignments || [])) {
        const personKey = `person-${oa.person_id}`;
        const item = {
          id: `inst-${oa.entity_type}-${oa.entity_id}`,
          type: oa.entity_type as "hospital" | "clinic",
          label: oa.entity_name || "?",
          sublabel: oa.entity_city || "",
        };
        if (!ring2Map.has(personKey)) ring2Map.set(personKey, []);
        const existing = ring2Map.get(personKey)!;
        if (!existing.some(x => x.id === item.id)) existing.push(item);
      }
      return layoutNodes(center, ring1, ring2Map);
    } else {
      const person = networkData.person;
      const center = {
        id: `person-${person.id}`,
        type: "person" as const,
        label: [person.title_before, person.first_name, person.last_name].filter(Boolean).join(" "),
        sublabel: person.collaborator_type || "",
      };
      const ring1 = (networkData.institutions || []).map((inst: any) => ({
        id: `inst-${inst.entity_type}-${inst.entity_id}`,
        type: inst.entity_type as "hospital" | "clinic",
        label: inst.entity_name || "?",
        sublabel: inst.entity_city || "",
        role: inst.role,
        department: inst.department,
        position: inst.position,
        categoryName: inst.category_name,
        isPrimary: inst.is_primary,
      }));
      const ring2Map = new Map<string, any[]>();
      for (const op of (networkData.otherPersons || [])) {
        const instKey = `inst-${op.entity_type}-${op.entity_id}`;
        const item = {
          id: `person-${op.person_id}`,
          type: "person" as const,
          label: [op.title_before, op.first_name, op.last_name].filter(Boolean).join(" "),
          sublabel: op.collaborator_type || "",
        };
        if (!ring2Map.has(instKey)) ring2Map.set(instKey, []);
        const existing = ring2Map.get(instKey)!;
        if (!existing.some(x => x.id === item.id)) existing.push(item);
      }
      return layoutNodes(center, ring1, ring2Map);
    }
  }, [networkData, selectedResult]);

  const [detailNode, setDetailNode] = useState<NetworkNode | null>(null);

  const searchResults = searchType === "institution"
    ? (instResults?.data || [])
    : (personResults?.data || []);
  const isSearching = searchType === "institution" ? instLoading : personLoading;
  const showResults = debouncedSearch.length >= 2 && !selectedResult;

  return (
    <div className="space-y-4" data-testid="network-explorer">
      <div className="flex gap-3 items-start">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2 items-center">
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  searchType === "institution" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setSearchType("institution"); setSearch(""); setDebouncedSearch(""); setSelectedResult(null); }}
                data-testid="btn-search-institution"
              >
                <Building2 className="h-3.5 w-3.5 inline mr-1" />
                Inštitúcia
              </button>
              <button
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  searchType === "person" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setSearchType("person"); setSearch(""); setDebouncedSearch(""); setSelectedResult(null); }}
                data-testid="btn-search-person"
              >
                <User className="h-3.5 w-3.5 inline mr-1" />
                Osoba
              </button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchType === "institution" ? "Vyhľadajte nemocnicu alebo ambulanciu..." : "Vyhľadajte osobu (meno, priezvisko)..."}
                value={search}
                onChange={e => { handleSearch(e.target.value); if (selectedResult) setSelectedResult(null); }}
                className="pl-9"
                data-testid="input-network-search"
              />
            </div>
            {selectedResult && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedResult(null); setSearch(""); setDebouncedSearch(""); setDetailNode(null); }} data-testid="btn-clear-selection">
                <X className="h-4 w-4 mr-1" /> Zrušiť
              </Button>
            )}
          </div>

          {showResults && (
            <Card className="absolute z-50 w-[calc(100%-2rem)] max-w-2xl max-h-80 overflow-y-auto shadow-xl border-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {debouncedSearch.length < 2 ? "Zadajte aspoň 2 znaky" : "Žiadne výsledky"}
                </div>
              ) : (
                <div className="divide-y">
                  {searchType === "institution" ? (
                    (searchResults as Institution[]).map((inst) => (
                      <button
                        key={`${inst.type}-${inst.id}`}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3 transition-colors"
                        onClick={() => {
                          setSelectedResult({ type: "institution", entityType: inst.type, id: inst.id, name: inst.name });
                          setSearch(inst.name);
                          setDebouncedSearch("");
                        }}
                        data-testid={`search-result-${inst.id}`}
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          inst.type === "hospital" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600")}>
                          {inst.type === "hospital" ? <Hospital className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{inst.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {inst.city && <span><MapPin className="h-3 w-3 inline" /> {inst.city}</span>}
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{inst.type === "hospital" ? "Nemocnica" : "Ambulancia"}</Badge>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    (searchResults as Person[]).map((person) => (
                      <button
                        key={person.id}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3 transition-colors"
                        onClick={() => {
                          setSelectedResult({ type: "person", id: person.id, name: person.fullName || `${person.firstName} ${person.lastName}` });
                          setSearch(person.fullName || `${person.firstName} ${person.lastName}`);
                          setDebouncedSearch("");
                        }}
                        data-testid={`search-result-${person.id}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {person.fullName || [person.titleBefore, person.firstName, person.lastName, person.titleAfter].filter(Boolean).join(" ")}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {person.collaboratorType && <span>{person.collaboratorType}</span>}
                            {person.linkedInstitutions?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Link2 className="h-3 w-3" />
                                {person.linkedInstitutions.length} {person.linkedInstitutions.length === 1 ? "inštitúcia" : "inštitúcie"}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {!selectedResult && !showResults && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-900/30 dark:to-violet-900/30 flex items-center justify-center mb-6">
            <Network className="h-10 w-10 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Medical Partner Network</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Vyhľadajte nemocnicu, ambulanciu alebo osobu pre zobrazenie medicínskej siete a vzťahov.
          </p>
          <div className="flex gap-6 mt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full" style={{ background: NODE_COLORS.hospital.fill }} /> Nemocnica</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full" style={{ background: NODE_COLORS.clinic.fill }} /> Ambulancia</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full" style={{ background: NODE_COLORS.person.fill }} /> Osoba</span>
          </div>
        </div>
      )}

      {selectedResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1 gap-1.5">
              {selectedResult.type === "person" ? (
                <><User className="h-4 w-4" /> {selectedResult.name}</>
              ) : selectedResult.entityType === "hospital" ? (
                <><Hospital className="h-4 w-4" /> {selectedResult.name}</>
              ) : (
                <><Stethoscope className="h-4 w-4" /> {selectedResult.name}</>
              )}
            </Badge>
            {nodes.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {nodes.length} uzlov · {edges.length} prepojení
              </span>
            )}
          </div>

          {networkLoading ? (
            <div className="flex items-center justify-center py-20 border rounded-xl bg-muted/20">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Načítavam sieť...</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-muted/20 text-center">
              <Network className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Žiadne prepojenia v sieti</p>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <NetworkSVG nodes={nodes} edges={edges} onNodeClick={setDetailNode} />
              </div>
              {detailNode && (
                <Card className="w-72 shrink-0 self-start">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold",
                          detailNode.type === "hospital" ? "bg-blue-500" : detailNode.type === "clinic" ? "bg-emerald-500" : "bg-violet-500")}>
                          {detailNode.type === "hospital" ? "H" : detailNode.type === "clinic" ? "C" : "P"}
                        </div>
                        <div>
                          <CardTitle className="text-sm">{detailNode.label}</CardTitle>
                          {detailNode.sublabel && <CardDescription className="text-xs">{detailNode.sublabel}</CardDescription>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDetailNode(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {detailNode.type === "hospital" ? "Nemocnica" : detailNode.type === "clinic" ? "Ambulancia" : "Osoba"}
                    </Badge>
                    {detailNode.isPrimary && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 ml-1">
                        <Star className="h-3 w-3 mr-0.5" /> Primárne
                      </Badge>
                    )}
                    {detailNode.department && (
                      <div><span className="text-muted-foreground">Oddelenie:</span> <span className="font-medium">{detailNode.department}</span></div>
                    )}
                    {detailNode.position && (
                      <div><span className="text-muted-foreground">Pozícia:</span> <span className="font-medium">{detailNode.position}</span></div>
                    )}
                    {detailNode.role && (
                      <div><span className="text-muted-foreground">Rola:</span> <span className="font-medium">{detailNode.role}</span></div>
                    )}
                    {detailNode.categoryName && (
                      <div><span className="text-muted-foreground">Kategória:</span> <span className="font-medium">{detailNode.categoryName}</span></div>
                    )}
                    <Separator />
                    <div className="text-muted-foreground">
                      Prepojenia: {edges.filter(e => e.from === detailNode.id || e.to === detailNode.id).length}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════

function OverviewTab() {
  const { t } = useI18n();
  const { data: stats } = useQuery<MpnStats>({ queryKey: ["/api/mpn/stats"] });

  if (!stats) return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const cards = [
    { label: t.mpn.totalHospitals, value: stats.totalHospitals, icon: Hospital, color: "text-blue-600" },
    { label: t.mpn.totalClinics, value: stats.totalClinics, icon: Stethoscope, color: "text-green-600" },
    { label: t.mpn.totalPersons, value: stats.totalPersons, icon: Users, color: "text-indigo-600" },
    { label: t.mpn.totalAssignments, value: stats.totalAssignments, icon: Link2, color: "text-amber-600" },
    { label: t.mpn.totalChannels, value: stats.totalChannels, icon: Phone, color: "text-cyan-600" },
    { label: t.mpn.unassignedPersons, value: stats.unassignedPersons, icon: UserX, color: "text-red-600" },
    { label: t.mpn.unassignedInstitutions, value: stats.unassignedInstitutions, icon: Building, color: "text-orange-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="mpn-overview-grid">
      {cards.map((c) => (
        <Card key={c.label} data-testid={`stat-card-${c.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-bold mt-1">{c.value}</p>
              </div>
              <c.icon className={`h-8 w-8 ${c.color} opacity-80`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB (categories, schedules, protocols)
// ═══════════════════════════════════════════════════════════════

function channelIcon(type: string) {
  switch (type) {
    case "phone": case "landline": return <Phone className="h-4 w-4" />;
    case "mobile": return <Phone className="h-4 w-4" />;
    case "email": return <Mail className="h-4 w-4" />;
    case "whatsapp": case "viber": case "signal": return <MessageCircle className="h-4 w-4" />;
    default: return <Phone className="h-4 w-4" />;
  }
}

function scopeBadge(scope: string, t: any) {
  const colors: Record<string, string> = {
    hospital: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    clinic: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    independent: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  const labels: Record<string, string> = { hospital: t.mpn.hospital, clinic: t.mpn.clinic, independent: t.mpn.independent };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[scope] || ""}`}>{labels[scope] || scope}</span>;
}

function SettingsTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [settingsTab, setSettingsTab] = useState("categories");
  const [editCategory, setEditCategory] = useState<PartnerCategory | null>(null);
  const [addCategory, setAddCategory] = useState(false);

  const { data: categories } = useQuery<PartnerCategory[]>({ queryKey: ["/api/mpn/categories"] });

  const deleteCatMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/mpn/categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mpn/categories"] }); toast({ title: "OK" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Tabs value={settingsTab} onValueChange={setSettingsTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="categories" data-testid="tab-categories">
          <Star className="h-4 w-4 mr-1" /> {t.mpn.categories}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="categories">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t.mpn.categories}</CardTitle>
            <Button size="sm" onClick={() => setAddCategory(true)} data-testid="btn-add-category">
              <Plus className="h-4 w-4 mr-1" /> {t.mpn.addCategory}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.mpn.categoryCode}</TableHead>
                  <TableHead>{t.mpn.categoryName}</TableHead>
                  <TableHead>{t.mpn.entityScope}</TableHead>
                  <TableHead>{t.mpn.sortOrder}</TableHead>
                  <TableHead>{t.mpn.status}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(categories || []).map((cat) => (
                  <TableRow key={cat.id} data-testid={`row-category-${cat.id}`}>
                    <TableCell className="font-mono">{cat.code}</TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>{scopeBadge(cat.entityScope, t)}</TableCell>
                    <TableCell>{cat.sortOrder}</TableCell>
                    <TableCell>
                      <Badge variant={cat.isActive ? "default" : "secondary"}>
                        {cat.isActive ? t.mpn.active : t.mpn.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditCategory(cat)} data-testid={`btn-edit-category-${cat.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCatMut.mutate(cat.id)} data-testid={`btn-delete-category-${cat.id}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {(editCategory || addCategory) && (
        <CategoryFormDialog
          category={editCategory}
          onClose={() => { setEditCategory(null); setAddCategory(false); }}
        />
      )}
    </Tabs>
  );
}

function CategoryFormDialog({ category, onClose }: { category: PartnerCategory | null; onClose: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const isEdit = !!category;

  const [form, setForm] = useState({
    code: category?.code || "",
    name: category?.name || "",
    nameEn: category?.nameEn || "",
    entityScope: category?.entityScope || "hospital",
    sortOrder: category?.sortOrder || 0,
    isActive: category?.isActive ?? true,
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return apiRequest("PATCH", `/api/mpn/categories/${category!.id}`, form);
      }
      return apiRequest("POST", "/api/mpn/categories", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mpn/categories"] });
      toast({ title: "OK" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t.mpn.editCategory : t.mpn.addCategory}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.mpn.categoryCode}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="input-category-code" />
            </div>
            <div>
              <Label>{t.mpn.sortOrder}</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} data-testid="input-sort-order" />
            </div>
          </div>
          <div>
            <Label>{t.mpn.categoryName} (SK)</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-category-name" />
          </div>
          <div>
            <Label>{t.mpn.categoryName} (EN)</Label>
            <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} data-testid="input-category-name-en" />
          </div>
          <div>
            <Label>{t.mpn.entityScope}</Label>
            <Select value={form.entityScope} onValueChange={(v) => setForm({ ...form, entityScope: v })}>
              <SelectTrigger data-testid="select-entity-scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hospital">{t.mpn.hospital}</SelectItem>
                <SelectItem value="clinic">{t.mpn.clinic}</SelectItem>
                <SelectItem value="independent">{t.mpn.independent}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-testid="switch-is-active" />
            <Label>{t.mpn.active}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common?.cancel || "Cancel"}</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="btn-save-category">
            {saveMut.isPending ? "..." : (t.common?.save || "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function MedicalPartnerNetworkPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("network");

  return (
    <div className="p-6 space-y-6" data-testid="mpn-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-mpn-title">
          <Network className="h-6 w-6" />
          {t.mpn.title}
        </h1>
        <p className="text-muted-foreground mt-1">{t.mpn.description}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3" data-testid="mpn-tabs">
          <TabsTrigger value="network" className="gap-1" data-testid="tab-network">
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">Sieť</span>
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.overview}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.settings}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="network"><NetworkExplorer /></TabsContent>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
