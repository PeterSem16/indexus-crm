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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS, type Locale } from "date-fns/locale";
import { CollaboratorReportsContent } from "@/pages/collaborator-reports";
import type { VisitEvent, Collaborator } from "@shared/schema";
import { VISIT_SUBJECTS, VISIT_PLACE_OPTIONS, COUNTRIES } from "@shared/schema";
import { getCountryFlag } from "@/lib/countries";
import {
  Building2, Users, Settings, LayoutDashboard, Plus, Edit, Trash2,
  Phone, Mail, MessageCircle, Star, Search, Filter, Hospital, Stethoscope,
  UserCheck, UserX, Link2, ChevronLeft, ChevronRight, Building, Clock, Loader2,
  Network, MapPin, X, User, Sparkles, ZoomIn, ZoomOut, Maximize2,
  Activity, Calendar, CheckCircle, XCircle, AlertCircle, LogIn, Database, Download
} from "lucide-react";

type PartnerCategory = {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  nameSk: string | null;
  nameCs: string | null;
  nameHu: string | null;
  nameRo: string | null;
  nameIt: string | null;
  nameDe: string | null;
  entityScope: string;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
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
  entityId?: string;
  entityType?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  countryCode?: string;
  collaboratorType?: string;
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
  hospital: { fill: "#3b82f6", fillEnd: "#1d4ed8", stroke: "#2563eb", text: "#ffffff", glow: "rgba(59,130,246,0.35)", shadow: "rgba(59,130,246,0.2)" },
  clinic: { fill: "#10b981", fillEnd: "#047857", stroke: "#059669", text: "#ffffff", glow: "rgba(16,185,129,0.35)", shadow: "rgba(16,185,129,0.2)" },
  person: { fill: "#8b5cf6", fillEnd: "#6d28d9", stroke: "#7c3aed", text: "#ffffff", glow: "rgba(139,92,246,0.35)", shadow: "rgba(139,92,246,0.2)" },
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

  const getNodeRadius = (node: NetworkNode) => node.isCenter ? 32 : 24;

  const renderNodeIcon = (type: string, x: number, y: number, isCenter: boolean) => {
    const size = isCenter ? 18 : 13;
    const ox = x - size / 2;
    const oy = y - size / 2;
    if (type === "hospital") {
      return (
        <g transform={`translate(${ox},${oy})`}>
          <rect x={size*0.15} y={size*0.05} width={size*0.7} height={size*0.85} rx={size*0.08} fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" />
          <line x1={size*0.5} y1={size*0.25} x2={size*0.5} y2={size*0.65} stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
          <line x1={size*0.3} y1={size*0.45} x2={size*0.7} y2={size*0.45} stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
          <line x1={size*0.15} y1={size*0.9} x2={size*0.85} y2={size*0.9} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" />
        </g>
      );
    }
    if (type === "clinic") {
      return (
        <g transform={`translate(${ox},${oy})`}>
          <circle cx={size*0.65} cy={size*0.2} r={size*0.12} fill="none" stroke="#fff" strokeWidth={1.3} />
          <path d={`M${size*0.65} ${size*0.32} Q${size*0.65} ${size*0.55} ${size*0.35} ${size*0.75}`} fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
          <path d={`M${size*0.35} ${size*0.75} L${size*0.15} ${size*0.55}`} fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
          <path d={`M${size*0.35} ${size*0.75} L${size*0.55} ${size*0.95}`} fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      );
    }
    return (
      <g transform={`translate(${ox},${oy})`}>
        <circle cx={size*0.5} cy={size*0.3} r={size*0.2} fill="none" stroke="#fff" strokeWidth={1.3} />
        <path d={`M${size*0.15} ${size*0.95} Q${size*0.15} ${size*0.6} ${size*0.5} ${size*0.55} Q${size*0.85} ${size*0.6} ${size*0.85} ${size*0.95}`} fill="none" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" />
      </g>
    );
  };

  const truncateLabel = (label: string, max: number) =>
    label.length > max ? label.slice(0, max - 1) + "…" : label;

  if (nodes.length === 0) return null;

  return (
    <div className="relative w-full border rounded-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 overflow-hidden shadow-sm" style={{ height: 500 }}>
      <div className="absolute top-3 right-3 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => zoom(0.8)} data-testid="btn-zoom-in">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => zoom(1.25)} data-testid="btn-zoom-out">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px bg-slate-200 dark:bg-slate-600 my-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-slate-100 dark:hover:bg-slate-700" onClick={fitAll} data-testid="btn-fit-all">
          <Maximize2 className="h-3.5 w-3.5" />
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
          <linearGradient id="grad-hospital" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NODE_COLORS.hospital.fill} />
            <stop offset="100%" stopColor={NODE_COLORS.hospital.fillEnd} />
          </linearGradient>
          <linearGradient id="grad-clinic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NODE_COLORS.clinic.fill} />
            <stop offset="100%" stopColor={NODE_COLORS.clinic.fillEnd} />
          </linearGradient>
          <linearGradient id="grad-person" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NODE_COLORS.person.fill} />
            <stop offset="100%" stopColor={NODE_COLORS.person.fillEnd} />
          </linearGradient>
          <filter id="node-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(0,0,0,0.12)" floodOpacity="1" />
          </filter>
          <filter id="glow-hospital" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor={NODE_COLORS.hospital.glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-clinic" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor={NODE_COLORS.clinic.glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-person" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor={NODE_COLORS.person.glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="edge-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#94a3b8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.3" />
          </linearGradient>
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

          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const perpX = -(y2 - y1) * 0.08;
          const perpY = (x2 - x1) * 0.08;
          const cx1 = mx + perpX;
          const cy1 = my + perpY;

          const fromColors = NODE_COLORS[fromNode.type];
          const toColors = NODE_COLORS[toNode.type];
          const gradId = `edge-grad-${i}`;

          return (
            <g key={`edge-${i}`}>
              <defs>
                <linearGradient id={gradId} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={isHovered ? fromColors.fill : "#cbd5e1"} stopOpacity={isHovered ? 0.8 : 0.5} />
                  <stop offset="100%" stopColor={isHovered ? toColors.fill : "#cbd5e1"} stopOpacity={isHovered ? 0.8 : 0.5} />
                </linearGradient>
              </defs>
              <path
                d={`M${x1},${y1} Q${cx1},${cy1} ${x2},${y2}`}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth={isHovered ? 2.5 : 1.8}
                opacity={hoveredNode && !isHovered ? 0.15 : 1}
                className="transition-all duration-300"
              />
              {isHovered && (
                <circle r="3" fill={toColors.fill}>
                  <animateMotion dur="1.5s" repeatCount="indefinite" path={`M${x1},${y1} Q${cx1},${cy1} ${x2},${y2}`} />
                </circle>
              )}
              {edge.label && isHovered && (
                <g>
                  <rect
                    x={mx - 30} y={my - 16} width={60} height={14} rx={4}
                    fill="white" fillOpacity="0.9" stroke="#e2e8f0" strokeWidth="0.5"
                  />
                  <text
                    x={mx} y={my - 7}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none"
                    fill="#64748b"
                    fontSize={8}
                    fontWeight={500}
                  >
                    {edge.label}
                  </text>
                </g>
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
          const hoverR = isHovered ? r + 3 : r;

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              opacity={dimmed ? 0.2 : 1}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onNodeClick?.(node)}
              style={{ transition: 'opacity 0.3s ease' }}
            >
              {isHovered && (
                <circle
                  cx={node.x} cy={node.y} r={hoverR + 6}
                  fill="none"
                  stroke={colors.fill}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.5}
                >
                  <animate attributeName="r" values={`${hoverR + 5};${hoverR + 8};${hoverR + 5}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={node.x} cy={node.y} r={hoverR}
                fill={`url(#grad-${node.type})`}
                stroke={isHovered ? "rgba(255,255,255,0.8)" : colors.stroke}
                strokeWidth={isHovered ? 2.5 : 1.5}
                filter={node.isCenter ? `url(#glow-${node.type})` : "url(#node-shadow)"}
              />

              {node.isPrimary && (
                <g transform={`translate(${node.x + r * 0.6}, ${node.y - r * 0.6})`}>
                  <circle r="7" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
                  <text textAnchor="middle" dominantBaseline="middle" fill="#92400e" fontSize="8" fontWeight="bold">★</text>
                </g>
              )}

              {renderNodeIcon(node.type, node.x, node.y, !!node.isCenter)}

              <text
                x={node.x} y={node.y + r + 14}
                textAnchor="middle"
                className="pointer-events-none"
                fill="currentColor"
                fontSize={node.isCenter ? 11 : 9.5}
                fontWeight={600}
                letterSpacing="0.01em"
              >
                {truncateLabel(node.label, node.isCenter ? 28 : 20)}
              </text>
              {node.sublabel && (
                <text
                  x={node.x} y={node.y + r + 25}
                  textAnchor="middle"
                  className="pointer-events-none"
                  fill="#94a3b8"
                  fontSize={8}
                  fontWeight={400}
                >
                  {truncateLabel(node.sublabel, 25)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: `linear-gradient(135deg, ${NODE_COLORS.hospital.fill}, ${NODE_COLORS.hospital.fillEnd})` }} />
          Nemocnica
        </span>
        <span className="w-px h-3 bg-slate-200 dark:bg-slate-600" />
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: `linear-gradient(135deg, ${NODE_COLORS.clinic.fill}, ${NODE_COLORS.clinic.fillEnd})` }} />
          Ambulancia
        </span>
        <span className="w-px h-3 bg-slate-200 dark:bg-slate-600" />
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: `linear-gradient(135deg, ${NODE_COLORS.person.fill}, ${NODE_COLORS.person.fillEnd})` }} />
          Osoba
        </span>
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
  const [drawerEntity, setDrawerEntity] = useState<{ type: "hospital" | "clinic" | "person"; id: string } | null>(null);

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

  const [networkData, setNetworkData] = useState<any>(null);
  const [networkLoading, setNetworkLoading] = useState(false);

  useEffect(() => {
    if (!selectedResult) {
      setNetworkData(null);
      return;
    }
    const url = selectedResult.type === "person"
      ? `/api/mpn/network/person/${selectedResult.id}`
      : `/api/mpn/network/institution/${selectedResult.entityType}/${selectedResult.id}`;

    setNetworkLoading(true);
    setNetworkData(null);
    fetch(url, { credentials: "include" })
      .then(res => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then(data => {
        setNetworkData(data);
        setNetworkLoading(false);
      })
      .catch(() => {
        setNetworkData(null);
        setNetworkLoading(false);
      });
  }, [selectedResult]);

  const { nodes, edges } = useMemo(() => {
    if (!networkData || !selectedResult) return { nodes: [], edges: [] };

    if (selectedResult.type === "institution") {
      const inst = networkData.institution;
      const center = {
        id: `inst-${inst.entityType}-${inst.id}`,
        type: inst.entityType as "hospital" | "clinic",
        label: inst.name,
        sublabel: inst.city || "",
        entityId: inst.id,
        entityType: inst.entityType,
        phone: inst.phone,
        email: inst.email,
        address: inst.address,
        city: inst.city,
        countryCode: inst.countryCode,
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
        entityId: p.person_id,
        phone: p.phone,
        email: p.email,
        collaboratorType: p.collaborator_type,
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
        entityId: person.id,
        phone: person.phone,
        email: person.email,
        collaboratorType: person.collaborator_type,
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
        entityId: inst.entity_id,
        entityType: inst.entity_type,
        city: inst.entity_city,
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

  const { data: drawerData, isLoading: drawerLoading } = useQuery<any>({
    queryKey: ["/api/mpn/drawer-entity", drawerEntity?.type, drawerEntity?.id],
    queryFn: async () => {
      if (!drawerEntity) return null;
      if (drawerEntity.type === "person") {
        const res = await fetch(`/api/collaborators/lookup?ids=${drawerEntity.id}`, { credentials: "include" });
        if (!res.ok) return null;
        const list = await res.json();
        return list[0] || null;
      } else {
        const endpoint = drawerEntity.type === "hospital" ? "hospitals" : "clinics";
        const res = await fetch(`/api/${endpoint}/${drawerEntity.id}`, { credentials: "include" });
        if (!res.ok) return null;
        return res.json();
      }
    },
    enabled: !!drawerEntity,
  });

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
                {t.mpn.institution}
              </button>
              <button
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  searchType === "person" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setSearchType("person"); setSearch(""); setDebouncedSearch(""); setSelectedResult(null); }}
                data-testid="btn-search-person"
              >
                <User className="h-3.5 w-3.5 inline mr-1" />
                {t.mpn.person}
              </button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchType === "institution" ? t.mpn.searchInstitution : t.mpn.searchPerson}
                value={search}
                onChange={e => { handleSearch(e.target.value); if (selectedResult) setSelectedResult(null); }}
                className="pl-9"
                data-testid="input-network-search"
              />
            </div>
            {selectedResult && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedResult(null); setSearch(""); setDebouncedSearch(""); setDetailNode(null); }} data-testid="btn-clear-selection">
                <X className="h-4 w-4 mr-1" /> {t.mpn.clearSelection}
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
                  {debouncedSearch.length < 2 ? t.mpn.minChars : t.mpn.noResults}
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
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{inst.type === "hospital" ? t.mpn.hospital : t.mpn.clinic}</Badge>
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
                                {person.linkedInstitutions.length} {t.mpn.institutions.toLowerCase()}
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
          <h3 className="text-xl font-semibold mb-2">{t.mpn.title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {t.mpn.networkIntro}
          </p>
          <div className="flex gap-6 mt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full" style={{ background: NODE_COLORS.hospital.fill }} /> {t.mpn.hospital}</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full" style={{ background: NODE_COLORS.clinic.fill }} /> {t.mpn.clinic}</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full" style={{ background: NODE_COLORS.person.fill }} /> {t.mpn.person}</span>
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
                {nodes.length} {t.mpn.nodes} · {edges.length} {t.mpn.connections}
              </span>
            )}
          </div>

          {networkLoading ? (
            <div className="flex items-center justify-center py-20 border rounded-xl bg-muted/20">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t.mpn.loadingNetwork}</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-muted/20 text-center">
              <Network className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t.mpn.noConnections}</p>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <NetworkSVG nodes={nodes} edges={edges} onNodeClick={setDetailNode} />
              </div>
              {detailNode && (
                <Card className="w-80 shrink-0 self-start">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold",
                          detailNode.type === "hospital" ? "bg-blue-500" : detailNode.type === "clinic" ? "bg-emerald-500" : "bg-violet-500")}>
                          {detailNode.type === "hospital" ? "H" : detailNode.type === "clinic" ? "C" : "P"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm truncate">{detailNode.label}</CardTitle>
                          {detailNode.sublabel && <CardDescription className="text-xs">{detailNode.sublabel}</CardDescription>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setDetailNode(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3 text-xs">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {detailNode.type === "hospital" ? t.mpn.hospital : detailNode.type === "clinic" ? t.mpn.clinic : t.mpn.person}
                      </Badge>
                      {detailNode.isPrimary && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                          <Star className="h-3 w-3 mr-0.5" /> {t.mpn.primary}
                        </Badge>
                      )}
                      {detailNode.collaboratorType && (
                        <Badge variant="secondary" className="text-[10px]">{detailNode.collaboratorType}</Badge>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {detailNode.department && (
                        <div className="flex items-start gap-1.5">
                          <Building2 className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div><span className="text-muted-foreground">{t.mpn.department}:</span> <span className="font-medium">{detailNode.department}</span></div>
                        </div>
                      )}
                      {detailNode.position && (
                        <div className="flex items-start gap-1.5">
                          <UserCheck className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div><span className="text-muted-foreground">{t.mpn.position}:</span> <span className="font-medium">{detailNode.position}</span></div>
                        </div>
                      )}
                      {detailNode.role && (
                        <div className="flex items-start gap-1.5">
                          <User className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div><span className="text-muted-foreground">{t.mpn.role}:</span> <span className="font-medium">{detailNode.role}</span></div>
                        </div>
                      )}
                      {detailNode.categoryName && (
                        <div className="flex items-start gap-1.5">
                          <Filter className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div><span className="text-muted-foreground">{t.mpn.category}:</span> <span className="font-medium">{detailNode.categoryName}</span></div>
                        </div>
                      )}
                      {detailNode.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{detailNode.phone}</span>
                        </div>
                      )}
                      {detailNode.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{detailNode.email}</span>
                        </div>
                      )}
                      {detailNode.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{detailNode.address}{detailNode.city ? `, ${detailNode.city}` : ""}</span>
                        </div>
                      )}
                      {!detailNode.address && detailNode.city && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{detailNode.city}</span>
                        </div>
                      )}
                    </div>

                    <Separator />
                    <div className="text-muted-foreground">
                      {t.mpn.connectionCount}: {edges.filter(e => e.from === detailNode.id || e.to === detailNode.id).length}
                    </div>

                    {detailNode.entityId && (
                      <div className="pt-1">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full text-xs"
                          data-testid={`btn-open-detail-${detailNode.entityId}`}
                          onClick={() => setDrawerEntity({ type: detailNode.type, id: detailNode.entityId! })}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          {detailNode.type === "hospital" ? t.mpn.hospital : detailNode.type === "clinic" ? t.mpn.clinic : t.mpn.person} — {t.common.detail || "Detail"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      <Sheet open={!!drawerEntity} onOpenChange={(open) => { if (!open) setDrawerEntity(null); }}>
        <SheetContent className="sm:max-w-xl overflow-y-auto" data-testid="entity-detail-drawer">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {drawerEntity?.type === "hospital" ? <Hospital className="h-5 w-5 text-blue-600" /> :
               drawerEntity?.type === "clinic" ? <Stethoscope className="h-5 w-5 text-emerald-600" /> :
               <User className="h-5 w-5 text-violet-600" />}
              {drawerLoading ? "..." : drawerData?.name || drawerData?.firstName ? `${drawerData.titleBefore || drawerData.title_before || ""} ${drawerData.firstName || drawerData.first_name || ""} ${drawerData.lastName || drawerData.last_name || ""}`.trim() : ""}
            </SheetTitle>
          </SheetHeader>
          {drawerLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : drawerData ? (
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">
                  {drawerEntity?.type === "hospital" ? t.mpn.hospital : drawerEntity?.type === "clinic" ? t.mpn.clinic : t.mpn.person}
                </Badge>
                {drawerData.collaboratorType && <Badge variant="secondary">{drawerData.collaboratorType}</Badge>}
                {drawerData.isActive === true && <Badge className="bg-green-600 text-white text-xs">{t.common.active}</Badge>}
                {drawerData.isActive === false && <Badge variant="destructive" className="text-xs">{t.common.inactive}</Badge>}
                {drawerData.countryCode && <Badge variant="outline">{getCountryFlag(drawerData.countryCode || drawerData.country_code)} {drawerData.countryCode || drawerData.country_code}</Badge>}
              </div>

              <Card>
                <CardContent className="p-4 space-y-2 text-sm">
                  {(drawerEntity?.type === "hospital" || drawerEntity?.type === "clinic") && (
                    <>
                      {drawerData.name && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{drawerData.name}</span>
                        </div>
                      )}
                      {drawerData.city && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{[drawerData.address, drawerData.city, drawerData.zip].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                      {drawerData.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{drawerData.phone}</span>
                        </div>
                      )}
                      {drawerData.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{drawerData.email}</span>
                        </div>
                      )}
                      {drawerData.website && (
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a href={drawerData.website} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{drawerData.website}</a>
                        </div>
                      )}
                      {drawerData.type && (
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{t.common.type || "Type"}: <span className="font-medium">{drawerData.type}</span></span>
                        </div>
                      )}
                      {drawerData.beds != null && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{t.common.beds || "Beds"}: <span className="font-medium">{drawerData.beds}</span></span>
                        </div>
                      )}
                      {drawerData.departments && (
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span>{t.mpn.department}: <span className="font-medium">{Array.isArray(drawerData.departments) ? drawerData.departments.join(", ") : drawerData.departments}</span></span>
                        </div>
                      )}
                      {drawerData.notes && (
                        <div className="flex items-start gap-2 mt-2">
                          <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground italic">{drawerData.notes}</span>
                        </div>
                      )}
                    </>
                  )}

                  {drawerEntity?.type === "person" && (
                    <>
                      {(drawerData.titleBefore || drawerData.firstName || drawerData.lastName) && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">
                            {[drawerData.titleBefore, drawerData.firstName, drawerData.lastName, drawerData.titleAfter].filter(Boolean).join(" ")}
                          </span>
                        </div>
                      )}
                      {drawerData.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{drawerData.phone}</span>
                        </div>
                      )}
                      {drawerData.mobile && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{drawerData.mobile}</span>
                        </div>
                      )}
                      {drawerData.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{drawerData.email}</span>
                        </div>
                      )}
                      {drawerData.collaboratorType && (
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{t.common.type || "Type"}: <span className="font-medium">{drawerData.collaboratorType}</span></span>
                        </div>
                      )}
                      {drawerData.specialization && (
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{drawerData.specialization}</span>
                        </div>
                      )}
                      {drawerData.notes && (
                        <div className="flex items-start gap-2 mt-2">
                          <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground italic">{drawerData.notes}</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
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
    <div className="space-y-6">
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

      <Separator />

      <CollaboratorReportsContent embedded={true} />
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

function getLocalizedCategoryName(cat: PartnerCategory, locale: string): string {
  const localeMap: Record<string, string | null> = {
    sk: cat.nameSk, cs: cat.nameCs, en: cat.nameEn,
    hu: cat.nameHu, ro: cat.nameRo, it: cat.nameIt, de: cat.nameDe,
  };
  return localeMap[locale] || cat.name;
}

function SettingsTab() {
  const { t, locale } = useI18n();
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

  const seedDefaultsMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mpn/categories/seed-defaults"),
    onSuccess: async (res: any) => {
      const data = typeof res === 'object' ? res : await res;
      queryClient.invalidateQueries({ queryKey: ["/api/mpn/categories"] });
      toast({ title: "OK", description: `Seeded: ${data?.seeded || 0}, Updated: ${data?.updated || 0}` });
    },
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
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => seedDefaultsMut.mutate()} disabled={seedDefaultsMut.isPending} data-testid="btn-seed-default-categories">
                <Database className="h-4 w-4 mr-1" /> {seedDefaultsMut.isPending ? "..." : ((t.mpn as any).seedDefaults || "Seed Defaults")}
              </Button>
              <Button size="sm" onClick={() => setAddCategory(true)} data-testid="btn-add-category">
                <Plus className="h-4 w-4 mr-1" /> {t.mpn.addCategory}
              </Button>
            </div>
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
                    <TableCell className="font-mono text-xs">{cat.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{getLocalizedCategoryName(cat, locale)}</div>
                      {locale !== "sk" && cat.nameSk && (
                        <div className="text-xs text-muted-foreground">{cat.nameSk}</div>
                      )}
                    </TableCell>
                    <TableCell>{scopeBadge(cat.entityScope, t)}</TableCell>
                    <TableCell>{cat.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={cat.isActive ? "default" : "secondary"}>
                          {cat.isActive ? t.mpn.active : t.mpn.inactive}
                        </Badge>
                        {cat.isDefault && (
                          <Badge variant="outline" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditCategory(cat)} data-testid={`btn-edit-category-${cat.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!cat.isDefault && (
                        <Button variant="ghost" size="icon" onClick={() => deleteCatMut.mutate(cat.id)} data-testid={`btn-delete-category-${cat.id}`}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
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
  const [isTranslating, setIsTranslating] = useState(false);

  const [form, setForm] = useState({
    code: category?.code || "",
    name: category?.name || "",
    nameEn: category?.nameEn || "",
    nameSk: category?.nameSk || "",
    nameCs: category?.nameCs || "",
    nameHu: category?.nameHu || "",
    nameRo: category?.nameRo || "",
    nameIt: category?.nameIt || "",
    nameDe: category?.nameDe || "",
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

  const handleAiTranslate = async () => {
    const sourceText = form.name || form.nameSk || form.nameEn;
    if (!sourceText) {
      toast({ title: "Error", description: "Enter a category name first", variant: "destructive" });
      return;
    }
    setIsTranslating(true);
    try {
      const sourceLang = form.name ? "Slovak" : form.nameEn ? "English" : "Slovak";
      const res = await apiRequest("POST", "/api/mpn/categories/ai-translate", { text: sourceText, sourceLang });
      const data = res as Record<string, string>;
      setForm(prev => ({
        ...prev,
        name: data.sk || prev.name,
        nameSk: data.sk || prev.nameSk,
        nameCs: data.cs || prev.nameCs,
        nameEn: data.en || prev.nameEn,
        nameHu: data.hu || prev.nameHu,
        nameRo: data.ro || prev.nameRo,
        nameIt: data.it || prev.nameIt,
        nameDe: data.de || prev.nameDe,
      }));
      toast({ title: "OK", description: "Translations generated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsTranslating(false);
    }
  };

  const langFields: { key: keyof typeof form; label: string; flag: string }[] = [
    { key: "nameSk", label: "Slovenčina", flag: "🇸🇰" },
    { key: "nameCs", label: "Čeština", flag: "🇨🇿" },
    { key: "nameEn", label: "English", flag: "🇬🇧" },
    { key: "nameHu", label: "Magyar", flag: "🇭🇺" },
    { key: "nameRo", label: "Română", flag: "🇷🇴" },
    { key: "nameIt", label: "Italiano", flag: "🇮🇹" },
    { key: "nameDe", label: "Deutsch", flag: "🇩🇪" },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <Label>{t.mpn.categoryName} (SK - Primary)</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, nameSk: e.target.value })} data-testid="input-category-name" />
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

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Localization</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAiTranslate}
                disabled={isTranslating}
                className="gap-1.5"
                data-testid="btn-ai-translate"
              >
                {isTranslating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Translating...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> AI Translate</>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {langFields.map(({ key, label, flag }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-lg w-7 text-center flex-shrink-0">{flag}</span>
                  <Label className="w-20 text-xs text-muted-foreground flex-shrink-0">{label}</Label>
                  <Input
                    value={(form[key] as string) || ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="flex-1 h-8 text-sm"
                    placeholder={label}
                    data-testid={`input-category-${key}`}
                  />
                </div>
              ))}
            </div>
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
// MEDICAL REPRESENTATIVES TAB
// ═══════════════════════════════════════════════════════════════

const dateLocales: Record<string, Locale> = {
  sk, cs, hu, ro, it, de, en: enUS
};

type ActivityType = "all" | "visit_scheduled" | "visit_started" | "visit_completed" | "visit_cancelled" | "call_recording" | "call";
type DateRange = "today" | "yesterday" | "week" | "month" | "all";

interface ActivityItem {
  id: string;
  type: "visit_scheduled" | "visit_started" | "visit_completed" | "visit_cancelled" | "visit_not_realized" | "login" | "call_recording" | "call";
  collaboratorId: string;
  collaboratorName: string;
  timestamp: Date;
  details: {
    hospitalName?: string;
    visitType?: string;
    place?: string;
    remarkDetail?: string;
    reason?: string;
    callDuration?: number;
    callDirection?: string;
    callStatus?: string;
    phoneNumber?: string;
    recordingId?: string;
    transcriptionText?: string;
    sentiment?: string;
    notes?: string;
  };
}

function MeetingScheduleDrawer({ collaborator, hospitals, open, onClose }: {
  collaborator: Collaborator;
  hospitals: any[];
  open: boolean;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const { toast } = useToast();
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [hospitalDropdownOpen, setHospitalDropdownOpen] = useState(false);
  const hospitalSearchRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    subject: "3",
    hospitalId: "",
    hospitalName: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    place: "1",
    remark: "",
    locationAddress: "",
  });

  const filteredHospitals = useMemo(() => {
    if (hospitalSearch.length < 3) return [];
    const q = hospitalSearch.toLowerCase();
    return hospitals.filter((h: any) =>
      h.name?.toLowerCase().includes(q) ||
      h.city?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [hospitals, hospitalSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hospitalSearchRef.current && !hospitalSearchRef.current.contains(e.target as Node)) {
        setHospitalDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createMeeting = useMutation({
    mutationFn: async () => {
      const startTime = new Date(`${form.startDate}T${form.startTime}:00`);
      const endTime = new Date(`${form.startDate}T${form.endTime}:00`);
      return apiRequest("POST", "/api/visit-events", {
        collaboratorId: collaborator.id,
        countryCode: collaborator.countryCode || "SK",
        subject: form.subject,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        hospitalId: form.hospitalId || null,
        place: form.place,
        remark: form.remark,
        locationAddress: form.locationAddress,
        status: "scheduled",
      });
    },
    onSuccess: () => {
      toast({ title: t.mpn.meetingScheduled });
      queryClient.invalidateQueries({ queryKey: ["/api/visit-events"] });
      onClose();
    },
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t.mpn.scheduleMeeting}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-medium">{collaborator.firstName} {collaborator.lastName}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-3">
                {collaborator.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{collaborator.phone}</span>}
                {collaborator.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{collaborator.email}</span>}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t.mpn.meetingDate}</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({...form, startDate: e.target.value})} data-testid="input-meeting-date" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.mpn.meetingTime}</Label>
              <Input type="time" value={form.startTime} onChange={(e) => setForm({...form, startTime: e.target.value})} data-testid="input-meeting-start" />
            </div>
            <div className="space-y-2">
              <Label>{t.mpn.meetingEndTime}</Label>
              <Input type="time" value={form.endTime} onChange={(e) => setForm({...form, endTime: e.target.value})} data-testid="input-meeting-end" />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t.common.type}</Label>
            <Select value={form.subject} onValueChange={(v) => setForm({...form, subject: v})}>
              <SelectTrigger data-testid="select-meeting-subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIT_SUBJECTS.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{(s as any)[locale] || s.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.mpn.place || "Place"}</Label>
            <Select value={form.place} onValueChange={(v) => setForm({...form, place: v})}>
              <SelectTrigger data-testid="select-meeting-place">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIT_PLACE_OPTIONS.map((p) => (
                  <SelectItem key={p.code} value={p.code}>{(p as any)[locale] || p.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2" ref={hospitalSearchRef}>
            <Label className="flex items-center gap-2">
              <Hospital className="h-4 w-4" />
              {t.mpn.hospital || "Hospital"}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={hospitalSearch}
                onChange={(e) => {
                  setHospitalSearch(e.target.value);
                  setHospitalDropdownOpen(e.target.value.length >= 3);
                }}
                onFocus={() => hospitalSearch.length >= 3 && setHospitalDropdownOpen(true)}
                placeholder={t.mpn.searchInstitution}
                className="pl-10"
                data-testid="input-hospital-search"
              />
              {hospitalSearch.length > 0 && hospitalSearch.length < 3 && (
                <div className="text-xs text-muted-foreground mt-1">{t.mpn.minChars}</div>
              )}
              {hospitalDropdownOpen && filteredHospitals.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                  {filteredHospitals.map((h: any) => (
                    <div
                      key={h.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-2 text-sm"
                      onClick={() => {
                        setForm({ ...form, hospitalId: h.id, hospitalName: h.name });
                        setHospitalSearch(h.name);
                        setHospitalDropdownOpen(false);
                      }}
                      data-testid={`hospital-option-${h.id}`}
                    >
                      {h._type === "clinic" ? (
                        <Stethoscope className="h-3 w-3 text-teal-600 flex-shrink-0" />
                      ) : (
                        <Building2 className="h-3 w-3 text-blue-600 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-1.5">
                          {h.name}
                          <Badge variant="outline" className={cn("text-[9px] px-1 py-0", h._type === "clinic" ? "text-teal-700 border-teal-300" : "text-blue-700 border-blue-300")}>
                            {h._type === "clinic" ? "Clinic" : "Hospital"}
                          </Badge>
                        </div>
                        {h.city && <div className="text-xs text-muted-foreground">{h.city}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {hospitalDropdownOpen && hospitalSearch.length >= 3 && filteredHospitals.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center">
                  {t.common.noResults}
                </div>
              )}
            </div>
            {form.hospitalName && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="flex-1">{form.hospitalName}</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                  setForm({ ...form, hospitalId: "", hospitalName: "" });
                  setHospitalSearch("");
                }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t.common.address || "Address"}
            </Label>
            <Input value={form.locationAddress} onChange={(e) => setForm({...form, locationAddress: e.target.value})} placeholder="..." data-testid="input-meeting-address" />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t.mpn.meetingNotes}</Label>
            <Textarea value={form.remark} onChange={(e) => setForm({...form, remark: e.target.value})} rows={4} data-testid="input-meeting-notes" />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">{t.common.cancel}</Button>
            <Button onClick={() => createMeeting.mutate()} disabled={createMeeting.isPending} className="flex-1" data-testid="btn-schedule-meeting">
              {createMeeting.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
              {t.mpn.scheduleMeeting}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActivityTab() {
  const { locale, t } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const { toast } = useToast();
  const [subTab, setSubTab] = useState("representatives");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [repCountryFilter, setRepCountryFilter] = useState<string>("all");
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("all");
  const [activityType, setActivityType] = useState<ActivityType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [meetingCollaborator, setMeetingCollaborator] = useState<Collaborator | null>(null);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [repPage, setRepPage] = useState(1);
  const repLimit = 50;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [summaryRepId, setSummaryRepId] = useState<string | null>(null);
  const [repDrawerId, setRepDrawerId] = useState<string | null>(null);
  const [summaryDateRange, setSummaryDateRange] = useState<"today" | "yesterday" | "7days" | "30days" | "all">("all");
  const [onlineRefreshKey, setOnlineRefreshKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setOnlineRefreshKey(k => k + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const dateFnsLocale = dateLocales[locale] || enUS;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => { setRepPage(1); }, [debouncedSearch, repCountryFilter, selectedCountries]);

  const repCountryParam = repCountryFilter !== "all" ? repCountryFilter : (selectedCountries.length > 0 ? selectedCountries.join(",") : "");

  const { data: collabResult, isLoading: collabLoading } = useQuery<{ data: Collaborator[]; total: number }>({
    queryKey: ["/api/collaborators", "paginated", repPage, repLimit, debouncedSearch, repCountryParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(repPage));
      params.set("limit", String(repLimit));
      if (debouncedSearch.length >= 3) params.set("search", debouncedSearch);
      if (repCountryParam) params.set("countries", repCountryParam);
      params.set("type", "mobile_enabled");
      const res = await fetch(`/api/collaborators?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const collaborators = collabResult?.data || [];
  const collabTotal = collabResult?.total || 0;
  const totalRepPages = Math.ceil(collabTotal / repLimit);

  const { data: repVisitStats = {} } = useQuery<Record<string, { total: number; completed: number }>>({
    queryKey: ["/api/mpn/rep-visit-stats", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/mpn/rep-visit-stats${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ["/api/hospitals/lookup", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/hospitals/lookup${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: clinics = [] } = useQuery<any[]>({
    queryKey: ["/api/clinics/lookup", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/clinics/lookup${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const hospitalsAndClinics = useMemo(() => {
    const h = hospitals.map((item: any) => ({ ...item, _type: "hospital" }));
    const c = clinics.map((item: any) => ({ ...item, _type: "clinic" }));
    return [...h, ...c];
  }, [hospitals, clinics]);

  const { data: visitEvents = [] } = useQuery<VisitEvent[]>({
    queryKey: ["/api/visit-events", "activity-tab", selectedCountries.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCountries.length > 0) params.set("countries", selectedCountries.join(","));
      params.set("limit", "500");
      const res = await fetch(`/api/visit-events?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: subTab === "activity" || subTab === "meetings",
  });

  const { data: callRecordings = [] } = useQuery<any[]>({
    queryKey: ["/api/collaborators", selectedCollaborator, "call-recordings"],
    queryFn: async () => {
      if (selectedCollaborator === "all") return [];
      const res = await fetch(`/api/collaborators/${selectedCollaborator}/call-recordings`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedCollaborator !== "all",
  });

  const { data: repCallLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/collaborator-call-logs", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/collaborator-call-logs${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: subTab === "activity",
  });

  const { data: summaryData } = useQuery<{ visits: any[]; calls: any[] }>({
    queryKey: ["/api/mpn/rep-summary", summaryRepId],
    queryFn: async () => {
      const [visitsRes, callsRes] = await Promise.all([
        fetch(`/api/visit-events?collaboratorId=${summaryRepId}`, { credentials: "include" }),
        fetch(`/api/collaborator-call-logs?collaboratorId=${summaryRepId}`, { credentials: "include" }),
      ]);
      const visits = visitsRes.ok ? await visitsRes.json() : [];
      const calls = callsRes.ok ? await callsRes.json() : [];
      return { visits: Array.isArray(visits) ? visits : [], calls };
    },
    enabled: !!summaryRepId,
  });

  const { data: repDrawerData, isLoading: repDrawerLoading } = useQuery<any>({
    queryKey: ["/api/collaborators/lookup", repDrawerId],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/lookup?ids=${repDrawerId}`, { credentials: "include" });
      if (!res.ok) return null;
      const list = await res.json();
      return list[0] || null;
    },
    enabled: !!repDrawerId,
  });

  const cancelMeeting = useMutation({
    mutationFn: async (id: string) => apiRequest("PUT", `/api/visit-events/${id}`, { status: "cancelled", isCancelled: true }),
    onSuccess: () => {
      toast({ title: t.common.cancelled });
      queryClient.invalidateQueries({ queryKey: ["/api/visit-events"] });
    },
  });

  const getCollaboratorName = useCallback((id: string) => {
    const collaborator = collaborators.find(c => c.id === id);
    return collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : t.common.unknown;
  }, [collaborators, t]);

  const getHospitalName = useCallback((id: string | null) => {
    if (!id) return null;
    const hospital = hospitals.find((h: any) => h.id === id);
    return hospital?.name || null;
  }, [hospitals]);

  const getSubjectLabel = useCallback((code: string) => {
    const subject = VISIT_SUBJECTS.find(s => s.code === code);
    if (!subject) return t.common.unknown;
    return (subject as any)[locale] || t.common.unknown;
  }, [locale, t]);

  const getPlaceLabel = useCallback((code: string) => {
    const place = VISIT_PLACE_OPTIONS.find(p => p.code === code);
    if (!place) return t.common.unknown;
    return (place as any)[locale] || t.common.unknown;
  }, [locale, t]);

  const activities: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    visitEvents.forEach((event) => {
      const collaboratorName = getCollaboratorName(event.collaboratorId);
      const hospitalName = getHospitalName(event.hospitalId);

      items.push({
        id: `${event.id}-scheduled`,
        type: "visit_scheduled",
        collaboratorId: event.collaboratorId,
        collaboratorName,
        timestamp: new Date(event.createdAt),
        details: {
          hospitalName: hospitalName || undefined,
          visitType: event.subject ? getSubjectLabel(event.subject) : undefined,
          place: event.place ? getPlaceLabel(event.place) : undefined,
        },
      });

      if (event.actualStart && !event.isCancelled && !event.isNotRealized) {
        items.push({
          id: `${event.id}-started`,
          type: "visit_started",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: new Date(event.actualStart),
          details: { hospitalName: hospitalName || undefined, visitType: event.subject ? getSubjectLabel(event.subject) : undefined },
        });
      }

      if ((event.status === 'completed' || event.actualEnd) && !event.isCancelled && !event.isNotRealized) {
        items.push({
          id: `${event.id}-completed`,
          type: "visit_completed",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: event.actualEnd ? new Date(event.actualEnd) : new Date(event.updatedAt),
          details: { hospitalName: hospitalName || undefined, visitType: event.subject ? getSubjectLabel(event.subject) : undefined },
        });
      }

      if (event.isCancelled || event.status === 'cancelled') {
        items.push({
          id: `${event.id}-cancelled`,
          type: "visit_cancelled",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: new Date(event.updatedAt),
          details: { hospitalName: hospitalName || undefined, visitType: event.subject ? getSubjectLabel(event.subject) : undefined, reason: (event as any).cancelReason || undefined },
        });
      }

      if (event.isNotRealized || event.status === 'not_realized') {
        items.push({
          id: `${event.id}-not-realized`,
          type: "visit_not_realized",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: new Date(event.updatedAt),
          details: { hospitalName: hospitalName || undefined, visitType: event.subject ? getSubjectLabel(event.subject) : undefined, reason: (event as any).cancelReason || undefined },
        });
      }
    });

    callRecordings.forEach((rec: any) => {
      const collabId = selectedCollaborator !== "all" ? selectedCollaborator : "";
      items.push({
        id: `call-${rec.id}`,
        type: "call_recording",
        collaboratorId: collabId,
        collaboratorName: rec.agentName || getCollaboratorName(collabId),
        timestamp: new Date(rec.createdAt),
        details: {
          callDuration: rec.durationSeconds,
          callDirection: rec.direction || "outbound",
          phoneNumber: rec.phoneNumber,
          recordingId: rec.id,
          transcriptionText: rec.transcriptionText,
          sentiment: rec.sentiment,
        },
      });
    });

    repCallLogs.forEach((call: any) => {
      const collaboratorName = getCollaboratorName(call.collaboratorId);
      items.push({
        id: `rep-call-${call.id}`,
        type: "call",
        collaboratorId: call.collaboratorId,
        collaboratorName,
        timestamp: new Date(call.startedAt),
        details: {
          phoneNumber: call.phoneNumber,
          callDirection: call.direction,
          callDuration: call.durationSeconds || 0,
          callStatus: call.status,
          notes: call.notes,
        },
      });
    });

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [visitEvents, collaborators, hospitals, callRecordings, repCallLogs, locale, selectedCollaborator, getCollaboratorName, getHospitalName, getSubjectLabel, getPlaceLabel]);

  const filteredActivities = useMemo(() => {
    let filtered = activities;
    if (selectedCollaborator !== "all") {
      filtered = filtered.filter(a => a.collaboratorId === selectedCollaborator || a.type === "call_recording" || a.type === "call");
    }
    if (activityType !== "all") {
      filtered = filtered.filter(a => a.type === activityType);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.collaboratorName.toLowerCase().includes(query) ||
        a.details.hospitalName?.toLowerCase().includes(query) ||
        a.details.visitType?.toLowerCase().includes(query) ||
        a.details.phoneNumber?.toLowerCase().includes(query)
      );
    }
    const now = new Date();
    if (dateRange === "today") {
      filtered = filtered.filter(a => isWithinInterval(a.timestamp, { start: startOfDay(now), end: endOfDay(now) }));
    } else if (dateRange === "yesterday") {
      const yd = subDays(now, 1);
      filtered = filtered.filter(a => isWithinInterval(a.timestamp, { start: startOfDay(yd), end: endOfDay(yd) }));
    } else if (dateRange === "week") {
      filtered = filtered.filter(a => isWithinInterval(a.timestamp, { start: startOfDay(subDays(now, 7)), end: endOfDay(now) }));
    } else if (dateRange === "month") {
      filtered = filtered.filter(a => isWithinInterval(a.timestamp, { start: startOfDay(subDays(now, 30)), end: endOfDay(now) }));
    }
    return filtered;
  }, [activities, selectedCollaborator, activityType, searchQuery, dateRange]);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "visit_scheduled": return <Calendar className="h-4 w-4" />;
      case "visit_started": return <MapPin className="h-4 w-4" />;
      case "visit_completed": return <CheckCircle className="h-4 w-4" />;
      case "visit_cancelled": return <XCircle className="h-4 w-4" />;
      case "visit_not_realized": return <AlertCircle className="h-4 w-4" />;
      case "login": return <LogIn className="h-4 w-4" />;
      case "call_recording": return <Phone className="h-4 w-4" />;
      case "call": return <Phone className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "visit_scheduled": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "visit_started": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "visit_completed": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "visit_cancelled": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case "visit_not_realized": return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      case "login": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      case "call_recording": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300";
      case "call": return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getActivityLabel = (type: ActivityItem["type"]) => {
    switch (type) {
      case "visit_scheduled": return t.common.scheduled;
      case "visit_started": return t.common.started;
      case "visit_completed": return t.common.completed;
      case "visit_cancelled": return t.common.cancelled;
      case "visit_not_realized": return t.common.notRealized;
      case "login": return t.activity?.login || "Login";
      case "call_recording": return t.mpn.callRecordings;
      case "call": return t.common.call || "Call";
      default: return t.common.unknown;
    }
  };

  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    filteredActivities.forEach(activity => {
      const dateKey = format(activity.timestamp, "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(activity);
    });
    return groups;
  }, [filteredActivities]);

  const stats = useMemo(() => {
    const scheduled = activities.filter(a => a.type === "visit_scheduled").length;
    const completed = activities.filter(a => a.type === "visit_completed").length;
    const cancelled = activities.filter(a => a.type === "visit_cancelled" || a.type === "visit_not_realized").length;
    const calls = activities.filter(a => a.type === "call_recording").length;
    return { scheduled, completed, cancelled, calls };
  }, [activities]);

  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    return visitEvents
      .filter(e => new Date(e.startTime) > now && e.status === "scheduled" && !e.isCancelled)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [visitEvents]);

  

  const playRecording = (recordingId: string) => {
    if (playingRecordingId === recordingId) {
      audioRef.current?.pause();
      setPlayingRecordingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(`/api/call-recordings/${recordingId}/stream`);
    audio.play();
    audio.onended = () => setPlayingRecordingId(null);
    audioRef.current = audio;
    setPlayingRecordingId(recordingId);
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (collabLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="medical-representatives-tab">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="stat-active-reps">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
              <Users className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="stat-active-reps-value">{collabTotal}</div>
              <div className="text-sm text-muted-foreground">{t.mpn.activeRepresentatives}</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-scheduled">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
              <Calendar className="h-5 w-5 text-green-700 dark:text-green-300" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="stat-scheduled-value">{stats.scheduled}</div>
              <div className="text-sm text-muted-foreground">{t.common.scheduled}</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-completed">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900">
              <CheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="stat-completed-value">{stats.completed}</div>
              <div className="text-sm text-muted-foreground">{t.common.completed}</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-calls">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900">
              <Phone className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="stat-calls-value">{stats.calls}</div>
              <div className="text-sm text-muted-foreground">{t.mpn.callRecordings}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid w-full max-w-xl grid-cols-3" data-testid="rep-sub-tabs">
          <TabsTrigger value="representatives" className="gap-1" data-testid="sub-tab-representatives">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.representativesList}</span>
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-1" data-testid="sub-tab-meetings">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.meetingManagement}</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1" data-testid="sub-tab-activity">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.activityMedicalRepresentants}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="representatives">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t.mpn.representativesList} ({collabTotal})
              </CardTitle>
              <CardDescription>{t.mpn.indexusConnectEnabled}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-start gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={t.common.search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-reps" />
                  </div>
                  {searchQuery.length > 0 && searchQuery.length < 3 && (
                    <div className="text-xs text-muted-foreground mt-1 ml-1">{t.mpn.minChars}</div>
                  )}
                </div>
                <Select value={repCountryFilter} onValueChange={setRepCountryFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-rep-country-filter">
                    <SelectValue placeholder={t.common.country} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.common.all || "All"}</SelectItem>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>{getCountryFlag(c.code)} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="h-[calc(100vh-480px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.common.name}</TableHead>
                      <TableHead>{t.common.status || "Status"}</TableHead>
                      <TableHead>Indexus Connect</TableHead>
                      <TableHead>{t.mpn.webrtcEnabled}</TableHead>
                      <TableHead>{t.mpn.callRecordingEnabled}</TableHead>
                      <TableHead>{t.mpn.totalVisits}</TableHead>
                      <TableHead>{t.mpn.completedVisits}</TableHead>
                      <TableHead>{t.common.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collaborators.map((c) => {
                      const isOnline = c.mobileLastActiveAt && new Date(c.mobileLastActiveAt).getTime() > Date.now() - 5 * 60 * 1000;
                      void onlineRefreshKey;
                      return (
                      <TableRow key={c.id} data-testid={`rep-row-${c.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="relative h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                              {isOnline && (
                                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                              )}
                            </div>
                            <div>
                              <span>{c.firstName} {c.lastName}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isOnline ? "default" : "secondary"} className={cn("text-xs", isOnline && "bg-green-600 hover:bg-green-700")}>
                            <span className={cn("h-2 w-2 rounded-full mr-1.5", isOnline ? "bg-white animate-pulse" : "bg-gray-400")} />
                            {isOnline ? "Online" : "Offline"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.mobileAppEnabled ? "default" : "secondary"} className="text-xs">
                            {c.mobileAppEnabled ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {c.mobileAppEnabled ? t.common.active : t.common.inactive}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.mobileWebrtcEnabled ? <Badge variant="outline" className="text-xs text-green-600"><CheckCircle className="h-3 w-3 mr-1" />On</Badge> : <Badge variant="outline" className="text-xs text-gray-400">Off</Badge>}
                        </TableCell>
                        <TableCell>
                          {c.mobileCallRecording ? <Badge variant="outline" className="text-xs text-green-600"><CheckCircle className="h-3 w-3 mr-1" />On</Badge> : <Badge variant="outline" className="text-xs text-gray-400">Off</Badge>}
                        </TableCell>
                        <TableCell className="text-center">{repVisitStats[c.id]?.total || 0}</TableCell>
                        <TableCell className="text-center">{repVisitStats[c.id]?.completed || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" onClick={() => setRepDrawerId(c.id)} data-testid={`btn-detail-${c.id}`} title={t.common.detail || "Detail"}>
                              <User className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setMeetingCollaborator(c)} data-testid={`btn-plan-meeting-${c.id}`}>
                              <Calendar className="h-3 w-3 mr-1" />
                              {t.mpn.planMeeting}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setSummaryRepId(c.id)} data-testid={`btn-summary-${c.id}`}>
                              <Database className="h-3 w-3 mr-1" />
                              {t.common.report || "Report"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                    {collaborators.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t.common.noResults}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {totalRepPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    {t.common.showing || "Showing"} {((repPage - 1) * repLimit) + 1}–{Math.min(repPage * repLimit, collabTotal)} {t.common.of || "of"} {collabTotal}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={repPage <= 1} onClick={() => setRepPage(p => p - 1)} data-testid="btn-rep-prev">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">{repPage} / {totalRepPages}</span>
                    <Button variant="outline" size="sm" disabled={repPage >= totalRepPages} onClick={() => setRepPage(p => p + 1)} data-testid="btn-rep-next">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t.mpn.upcomingMeetings} ({upcomingMeetings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-480px)]">
                  {upcomingMeetings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">{t.mpn.noMeetingsScheduled}</div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingMeetings.map((event) => (
                        <div key={event.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`meeting-card-${event.id}`}>
                          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                            <Calendar className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{t.mpn.meetingWith} {getCollaboratorName(event.collaboratorId)}</span>
                              <Badge variant="outline" className="text-xs">
                                {event.subject ? getSubjectLabel(event.subject) : ""}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(event.startTime), "dd.MM.yyyy", { locale: dateFnsLocale })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(event.startTime), "HH:mm")} — {format(new Date(event.endTime), "HH:mm")}
                              </span>
                            </div>
                            {event.hospitalId && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Building2 className="h-3 w-3" />
                                {getHospitalName(event.hospitalId)}
                              </div>
                            )}
                            {event.locationAddress && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {event.locationAddress}
                              </div>
                            )}
                            {event.remark && (
                              <div className="text-sm text-muted-foreground mt-1 italic">{event.remark}</div>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => cancelMeeting.mutate(event.id)} disabled={cancelMeeting.isPending} data-testid={`btn-cancel-meeting-${event.id}`}>
                            <XCircle className="h-4 w-4 mr-1" />
                            {t.mpn.cancelMeeting}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={t.common.search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-activities" />
                  </div>
                </div>
                <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                  <SelectTrigger className="w-[200px]" data-testid="select-collaborator">
                    <User className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={t.nav?.collaborators || "Collaborators"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.common.all}</SelectItem>
                    {collaborators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                  <SelectTrigger className="w-[180px]" data-testid="select-activity-type">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={t.common.status} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.common.all}</SelectItem>
                    <SelectItem value="visit_scheduled">{t.common.scheduled}</SelectItem>
                    <SelectItem value="visit_completed">{t.common.completed}</SelectItem>
                    <SelectItem value="visit_cancelled">{t.common.cancelled}</SelectItem>
                    <SelectItem value="call_recording">{t.mpn.callRecordings}</SelectItem>
                    <SelectItem value="call">{t.common.call || "Call"}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                  <SelectTrigger className="w-[150px]" data-testid="select-date-range">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">{t.common.today || "Today"}</SelectItem>
                    <SelectItem value="yesterday">{t.common.yesterday || "Yesterday"}</SelectItem>
                    <SelectItem value="week">{t.common.last7days}</SelectItem>
                    <SelectItem value="month">{t.common.last30days}</SelectItem>
                    <SelectItem value="all">{t.common.allTime}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t.mpn.activityMedicalRepresentants} ({filteredActivities.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-580px)]">
                {Object.keys(groupedActivities).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="no-activities-message">{t.common.noResults}</div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedActivities).map(([dateKey, dayActivities]) => (
                      <div key={dateKey}>
                        <div className="sticky top-0 bg-background py-2 z-10 mb-3">
                          <Badge variant="secondary">
                            {format(new Date(dateKey), "EEEE, d. MMMM yyyy", { locale: dateFnsLocale })}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {dayActivities.map((activity) => (
                            <div key={activity.id} className="flex gap-3 items-start p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors" data-testid={`activity-item-${activity.id}`}>
                              <div className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${getActivityColor(activity.type)}`}>
                                {getActivityIcon(activity.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm">{activity.collaboratorName}</span>
                                      <Badge variant="outline" className="text-xs">{getActivityLabel(activity.type)}</Badge>
                                    </div>
                                    {activity.details.hospitalName && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                        <Building2 className="h-3 w-3 flex-shrink-0" />{activity.details.hospitalName}
                                      </div>
                                    )}
                                    {activity.details.visitType && (
                                      <div className="text-xs text-muted-foreground">
                                        {activity.details.visitType}{activity.details.place && ` - ${activity.details.place}`}
                                      </div>
                                    )}
                                    {activity.type === "call_recording" && (
                                      <div className="mt-2 p-2 bg-muted/50 rounded space-y-1.5">
                                        <div className="flex items-center gap-3 text-xs flex-wrap">
                                          {activity.details.phoneNumber && (
                                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{activity.details.phoneNumber}</span>
                                          )}
                                          <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />{formatDuration(activity.details.callDuration)}
                                          </span>
                                          <Badge variant="outline" className="text-xs">
                                            {activity.details.callDirection === "inbound" ? t.mpn.inbound : t.mpn.outbound}
                                          </Badge>
                                          {activity.details.sentiment && (
                                            <Badge variant={activity.details.sentiment === "positive" ? "default" : activity.details.sentiment === "negative" ? "destructive" : "secondary"} className="text-xs">
                                              {activity.details.sentiment}
                                            </Badge>
                                          )}
                                        </div>
                                        {activity.details.transcriptionText && (
                                          <div className="text-xs text-muted-foreground italic border-l-2 border-primary/20 pl-2">
                                            {activity.details.transcriptionText.slice(0, 200)}
                                            {activity.details.transcriptionText.length > 200 && "..."}
                                          </div>
                                        )}
                                        {activity.details.recordingId && (
                                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => playRecording(activity.details.recordingId!)} data-testid={`btn-play-${activity.details.recordingId}`}>
                                            {playingRecordingId === activity.details.recordingId ? (
                                              <><X className="h-3 w-3 mr-1" />{t.mpn.stopRecording}</>
                                            ) : (
                                              <><Activity className="h-3 w-3 mr-1" />{t.mpn.playRecording}</>
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                    {activity.type === "call" && (
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                                        <span className="flex items-center gap-1">
                                          <Phone className="h-3 w-3" />
                                          {activity.details.callDirection === "inbound" ? "←" : "→"} {activity.details.phoneNumber}
                                        </span>
                                        {activity.details.callDuration ? (
                                          <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {Math.floor(activity.details.callDuration / 60)}:{String(activity.details.callDuration % 60).padStart(2, "0")}
                                          </span>
                                        ) : null}
                                        {activity.details.callStatus && (
                                          <Badge variant="outline" className="text-xs">{activity.details.callStatus}</Badge>
                                        )}
                                        {activity.details.notes && (
                                          <span className="italic text-xs border-l pl-2 border-muted-foreground/30">{activity.details.notes}</span>
                                        )}
                                      </div>
                                    )}
                                    {(activity.type === "visit_cancelled" || activity.type === "visit_not_realized") && (
                                      <div className="mt-1 px-2 py-1 bg-red-50 dark:bg-red-950 rounded text-xs text-red-700 dark:text-red-300">
                                        {activity.type === "visit_cancelled" ? t.common.cancelled : t.common.notRealized}
                                        {activity.details.reason && <span>: {activity.details.reason}</span>}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                                    <Clock className="h-3 w-3" />{format(activity.timestamp, "HH:mm")}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {meetingCollaborator && (
        <MeetingScheduleDrawer
          collaborator={meetingCollaborator}
          hospitals={hospitalsAndClinics}
          open={!!meetingCollaborator}
          onClose={() => setMeetingCollaborator(null)}
        />
      )}

      <Sheet open={!!summaryRepId} onOpenChange={(open) => { if (!open) { setSummaryRepId(null); setSummaryDateRange("all"); } }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto" data-testid="summary-report-sheet">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {t.common.report || "Report"}: {summaryRepId ? getCollaboratorName(summaryRepId) : ""}
            </SheetTitle>
          </SheetHeader>
          {summaryData ? (() => {
            const getDateBounds = () => {
              const now = new Date();
              switch (summaryDateRange) {
                case "today": return { start: startOfDay(now), end: endOfDay(now) };
                case "yesterday": return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
                case "7days": return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
                case "30days": return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
                default: return null;
              }
            };
            const bounds = getDateBounds();
            const filteredVisits = bounds
              ? summaryData.visits.filter((v: any) => { const d = new Date(v.startTime || v.visitDate || v.createdAt); return d >= bounds.start && d <= bounds.end; })
              : summaryData.visits;
            const filteredCalls = bounds
              ? summaryData.calls.filter((c: any) => { const d = new Date(c.startedAt || c.createdAt); return d >= bounds.start && d <= bounds.end; })
              : summaryData.calls;

            const exportToXls = async () => {
              const XLSX = await import("xlsx");
              const visitRows = filteredVisits.map((v: any) => ({
                [t.common.date || "Date"]: v.startTime ? format(new Date(v.startTime), "dd.MM.yyyy HH:mm") : v.visitDate ? format(new Date(v.visitDate), "dd.MM.yyyy HH:mm") : "—",
                [t.common.hospital || "Hospital"]: getHospitalName(v.hospitalId),
                [t.common.type || "Type"]: v.subject || v.visitType || "—",
                [t.common.status || "Status"]: v.status || "—",
                [t.mpn.remark || "Remark"]: v.remark || "",
              }));
              const callRows = filteredCalls.map((c: any) => ({
                [t.common.date || "Date"]: c.startedAt ? format(new Date(c.startedAt), "dd.MM.yyyy HH:mm") : "—",
                [t.common.phone || "Phone"]: c.phoneNumber || "—",
                Direction: c.direction || "—",
                Duration: c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}:${String(c.durationSeconds % 60).padStart(2, "0")}` : "—",
                [t.common.status || "Status"]: c.status || "—",
              }));
              const wb = XLSX.utils.book_new();
              if (visitRows.length > 0) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(visitRows), "Visits");
              }
              if (callRows.length > 0) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(callRows), "Calls");
              }
              if (visitRows.length === 0 && callRows.length === 0) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Info: "No data" }]), "Empty");
              }
              const repName = summaryRepId ? getCollaboratorName(summaryRepId).replace(/\s+/g, "_") : "report";
              XLSX.writeFile(wb, `${repName}_report.xlsx`);
            };

            return (
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["today", "yesterday", "7days", "30days", "all"] as const).map((r) => (
                  <Button key={r} size="sm" variant={summaryDateRange === r ? "default" : "outline"} onClick={() => setSummaryDateRange(r)} data-testid={`btn-summary-range-${r}`}>
                    {r === "today" ? (t.common.today || "Today") : r === "yesterday" ? (t.common.yesterday || "Yesterday") : r === "7days" ? "7 " + (t.common.days || "days") : r === "30days" ? "30 " + (t.common.days || "days") : (t.common.all || "All")}
                  </Button>
                ))}
                <Button size="sm" variant="outline" onClick={exportToXls} className="ml-auto" data-testid="btn-export-xls">
                  <Download className="h-3 w-3 mr-1" /> XLS
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold" data-testid="text-summary-visits">{filteredVisits.length}</div>
                    <div className="text-sm text-muted-foreground">{t.mpn.totalVisits}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold" data-testid="text-summary-calls">{filteredCalls.length}</div>
                    <div className="text-sm text-muted-foreground">{t.common.call || "Calls"}</div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {t.mpn.totalVisits} ({filteredVisits.length})
                </h4>
                {filteredVisits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.common.noResults}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.common.date || "Date"}</TableHead>
                        <TableHead>{t.common.hospital || "Hospital"}</TableHead>
                        <TableHead>{t.common.type || "Type"}</TableHead>
                        <TableHead>{t.common.status || "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisits.slice(0, 100).map((v: any) => (
                        <TableRow key={v.id} data-testid={`summary-visit-${v.id}`}>
                          <TableCell className="text-xs whitespace-nowrap">{v.startTime ? format(new Date(v.startTime), "dd.MM.yyyy HH:mm") : v.visitDate ? format(new Date(v.visitDate), "dd.MM.yyyy HH:mm") : "—"}</TableCell>
                          <TableCell className="text-xs">{getHospitalName(v.hospitalId)}</TableCell>
                          <TableCell className="text-xs">{v.subject || v.visitType || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={v.status === "completed" ? "default" : v.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                              {v.status || "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Phone className="h-4 w-4" /> {t.common.call || "Calls"} ({filteredCalls.length})
                </h4>
                {filteredCalls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.common.noResults}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.common.date || "Date"}</TableHead>
                        <TableHead>{t.common.phone || "Phone"}</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>{t.common.status || "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCalls.slice(0, 100).map((c: any) => (
                        <TableRow key={c.id} data-testid={`summary-call-${c.id}`}>
                          <TableCell className="text-xs whitespace-nowrap">{c.startedAt ? format(new Date(c.startedAt), "dd.MM.yyyy HH:mm") : "—"}</TableCell>
                          <TableCell className="text-xs">{c.phoneNumber || "—"}</TableCell>
                          <TableCell className="text-xs">{c.direction || "—"}</TableCell>
                          <TableCell className="text-xs">{c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}:${String(c.durationSeconds % 60).padStart(2, "0")}` : "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{c.status || "—"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
            );
          })() : summaryRepId ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={!!repDrawerId} onOpenChange={(open) => { if (!open) setRepDrawerId(null); }}>
        <SheetContent className="sm:max-w-xl overflow-y-auto" data-testid="rep-detail-drawer">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-violet-600" />
              {repDrawerLoading ? "..." : repDrawerData ? `${repDrawerData.titleBefore || ""} ${repDrawerData.firstName || ""} ${repDrawerData.lastName || ""}`.trim() : ""}
            </SheetTitle>
          </SheetHeader>
          {repDrawerLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : repDrawerData ? (
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{t.mpn.person}</Badge>
                {repDrawerData.collaboratorType && <Badge variant="secondary">{repDrawerData.collaboratorType}</Badge>}
                {repDrawerData.isActive === true && <Badge className="bg-green-600 text-white text-xs">{t.common.active}</Badge>}
                {repDrawerData.isActive === false && <Badge variant="destructive" className="text-xs">{t.common.inactive}</Badge>}
                {repDrawerData.countryCode && <Badge variant="outline">{getCountryFlag(repDrawerData.countryCode)} {repDrawerData.countryCode}</Badge>}
              </div>

              <Card>
                <CardContent className="p-4 space-y-2 text-sm">
                  {(repDrawerData.titleBefore || repDrawerData.firstName || repDrawerData.lastName) && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">
                        {[repDrawerData.titleBefore, repDrawerData.firstName, repDrawerData.lastName, repDrawerData.titleAfter].filter(Boolean).join(" ")}
                      </span>
                    </div>
                  )}
                  {repDrawerData.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{repDrawerData.phone}</span>
                    </div>
                  )}
                  {repDrawerData.mobile && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{repDrawerData.mobile}</span>
                    </div>
                  )}
                  {repDrawerData.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{repDrawerData.email}</span>
                    </div>
                  )}
                  {repDrawerData.collaboratorType && (
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{t.common.type || "Type"}: <span className="font-medium">{repDrawerData.collaboratorType}</span></span>
                    </div>
                  )}
                  {repDrawerData.specialization && (
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{repDrawerData.specialization}</span>
                    </div>
                  )}
                  {repDrawerData.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{[repDrawerData.address, repDrawerData.city, repDrawerData.zip].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  {repDrawerData.notes && (
                    <div className="flex items-start gap-2 mt-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground italic">{repDrawerData.notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
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
        <TabsList className="grid w-full max-w-2xl grid-cols-4" data-testid="mpn-tabs">
          <TabsTrigger value="network" className="gap-1" data-testid="tab-network">
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.network}</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1" data-testid="tab-activity">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.medicalRepresentatives}</span>
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
        <TabsContent value="activity"><ActivityTab /></TabsContent>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
