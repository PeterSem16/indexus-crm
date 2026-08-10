// ─────────────────────────────────────────────────────────────────────────────
// My Clinics & Hospitals — dashboard pre reprezentanta
// Zobrazí všetky kliniky a nemocnice pridelené prihlásenému používateľovi.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UserCheck, Building2, Hospital, MapPin, Phone, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface RepClinic {
  id: string;
  name: string;
  doctorName: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  countryCode: string | null;
  phone: string | null;
  contractStatus: string | null;
  interestCooperation: string | null;
  isActive: boolean | null;
  assignedSince: string | null;
}

interface RepHospital {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  region: string | null;
  countryCode: string | null;
  phone: string | null;
  isActive: boolean | null;
  assignedSince: string | null;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "d. M. yyyy"); } catch { return String(d); }
}

export default function MyClinicsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const p = t.representantPanel;
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"clinics" | "hospitals">("clinics");

  const { data: clinicsData, isLoading: clinicsLoading } = useQuery<{ clinics: RepClinic[]; total: number }>({
    queryKey: ["/api/representatives", user?.id, "clinics"],
    queryFn: async () => {
      const res = await fetch(`/api/representatives/${user!.id}/clinics?limit=200`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const { data: hospitalsData, isLoading: hospitalsLoading } = useQuery<{ hospitals: RepHospital[]; total: number }>({
    queryKey: ["/api/representatives", user?.id, "hospitals"],
    queryFn: async () => {
      const res = await fetch(`/api/representatives/${user!.id}/hospitals?limit=200`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const allClinics = clinicsData?.clinics ?? [];
  const allHospitals = hospitalsData?.hospitals ?? [];

  const filteredClinics = allClinics.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase()) ||
    c.district?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredHospitals = allHospitals.filter(h =>
    !search || h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.city?.toLowerCase().includes(search.toLowerCase()) ||
    h.district?.toLowerCase().includes(search.toLowerCase())
  );

  const isLoading = clinicsLoading || hospitalsLoading;
  const isEmpty = allClinics.length === 0 && allHospitals.length === 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <UserCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{p.myClinicsTitle}</h1>
          <p className="text-sm text-muted-foreground">{p.myClinicsDesc}</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t.common.loading}</span>
        </div>
      )}

      {!isLoading && isEmpty && (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <UserCheck className="h-12 w-12 opacity-30" />
          <p className="text-sm">{p.myClinicsEmpty}</p>
        </div>
      )}

      {!isLoading && !isEmpty && (
        <>
          {/* Controls */}
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder={`${t.common.search || "Search"}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs h-9"
            />
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => setTab("clinics")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${tab === "clinics" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                <Building2 className="h-3.5 w-3.5" />
                {t.nav?.clinics || "Clinics"} ({filteredClinics.length})
              </button>
              <button
                onClick={() => setTab("hospitals")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${tab === "hospitals" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                <Hospital className="h-3.5 w-3.5" />
                {t.nav?.hospitalsAndClinics || "Hospitals"} ({filteredHospitals.length})
              </button>
            </div>
          </div>

          {/* Clinics list */}
          {tab === "clinics" && (
            <div className="rounded-xl border overflow-hidden">
              {filteredClinics.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">{p.myClinicsEmpty}</div>
              ) : (
                <div className="divide-y">
                  {filteredClinics.map(c => (
                    <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 shrink-0">
                        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{c.name}</span>
                          {c.doctorName && (
                            <span className="text-xs text-muted-foreground truncate">{c.doctorName}</span>
                          )}
                          {c.contractStatus && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{c.contractStatus}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {c.city && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />{c.city}
                              {c.district && `, ${c.district}`}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="h-3 w-3" />{c.phone}
                            </span>
                          )}
                          {c.assignedSince && (
                            <span>{p.since} {fmtDate(c.assignedSince)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hospitals list */}
          {tab === "hospitals" && (
            <div className="rounded-xl border overflow-hidden">
              {filteredHospitals.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">{p.myClinicsEmpty}</div>
              ) : (
                <div className="divide-y">
                  {filteredHospitals.map(h => (
                    <div key={h.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40 shrink-0">
                        <Hospital className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{h.name}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {h.city && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />{h.city}
                              {h.district && `, ${h.district}`}
                            </span>
                          )}
                          {h.phone && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="h-3 w-3" />{h.phone}
                            </span>
                          )}
                          {h.assignedSince && (
                            <span>{p.since} {fmtDate(h.assignedSince)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
