import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Smartphone, 
  Home, 
  Calendar, 
  Building2, 
  User,
  MapPin,
  Clock,
  Plus,
  Mic,
  ChevronRight,
  LogOut,
  Wifi,
  WifiOff,
  Battery,
  Signal,
  CheckCircle2,
  AlertCircle,
  Play,
  Square
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type MobileScreen = "login" | "dashboard" | "visits" | "hospitals" | "profile" | "visit-detail" | "new-visit";

interface MobileUser {
  collaboratorId: string;
  countryCode: string;
  firstName: string;
  lastName: string;
}

interface VisitEvent {
  id: string;
  hospitalId: string;
  hospitalName?: string;
  visitType: string;
  status: string;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

interface Hospital {
  id: string;
  name: string;
  city?: string;
  address?: string;
}

export default function MobilePreview() {
  const { toast } = useToast();
  const [currentScreen, setCurrentScreen] = useState<MobileScreen>("login");
  const [isOnline, setIsOnline] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [visits, setVisits] = useState<VisitEvent[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [selectedVisit, setSelectedVisit] = useState<VisitEvent | null>(null);
  const [newVisitForm, setNewVisitForm] = useState({
    hospitalId: "",
    visitType: "personal_visit",
    scheduledDate: new Date().toISOString().split("T")[0],
    notes: ""
  });

  const currentTime = new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      toast({ title: "Vyplnte prihlasovacie udaje", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/mobile/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Prihlasenie zlyhalo");
      }
      
      const data = await response.json();
      setToken(data.token);
      setUser({
        collaboratorId: data.collaboratorId,
        countryCode: data.countryCode,
        firstName: data.firstName,
        lastName: data.lastName
      });
      setCurrentScreen("dashboard");
      loadData(data.token);
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async (authToken: string) => {
    try {
      const [visitsRes, hospitalsRes] = await Promise.all([
        fetch("/api/mobile/visit-events", {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch("/api/mobile/hospitals", {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      ]);
      
      if (visitsRes.ok) {
        const visitsData = await visitsRes.json();
        setVisits(visitsData);
      }
      
      if (hospitalsRes.ok) {
        const hospitalsData = await hospitalsRes.json();
        setHospitals(hospitalsData);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setVisits([]);
    setHospitals([]);
    setCurrentScreen("login");
    setLoginForm({ username: "", password: "" });
  };

  const handleCreateVisit = async () => {
    if (!newVisitForm.hospitalId) {
      toast({ title: "Vyberte nemocnicu", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/mobile/visit-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newVisitForm,
          status: "planned"
        })
      });
      
      if (!response.ok) throw new Error("Nepodarilo sa vytvorit navstevu");
      
      const newVisit = await response.json();
      setVisits(prev => [newVisit, ...prev]);
      setCurrentScreen("visits");
      setNewVisitForm({
        hospitalId: "",
        visitType: "personal_visit",
        scheduledDate: new Date().toISOString().split("T")[0],
        notes: ""
      });
      toast({ title: "Navsteva vytvorena" });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getVisitTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      personal_visit: "Osobna navsteva",
      phone_call: "Telefonicky hovor",
      online_meeting: "Online stretnutie",
      training: "Skolenie",
      other: "Ine"
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      planned: { label: "Planovana", variant: "secondary" },
      in_progress: { label: "Prebieha", variant: "default" },
      completed: { label: "Dokoncena", variant: "outline" }
    };
    const { label, variant } = config[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={variant} className="text-xs">{label}</Badge>;
  };

  const renderStatusBar = () => (
    <div className="flex items-center justify-between px-4 py-1 bg-black text-white text-xs">
      <span>{currentTime}</span>
      <div className="flex items-center gap-2">
        <Signal className="h-3 w-3" />
        {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3 text-red-400" />}
        <Battery className="h-3 w-3" />
      </div>
    </div>
  );

  const renderTabBar = () => (
    <div className="flex items-center justify-around border-t bg-white py-2">
      <button 
        onClick={() => setCurrentScreen("dashboard")}
        className={`flex flex-col items-center gap-1 px-4 py-1 ${currentScreen === "dashboard" ? "text-primary" : "text-muted-foreground"}`}
        data-testid="mobile-tab-dashboard"
      >
        <Home className="h-5 w-5" />
        <span className="text-xs">Domov</span>
      </button>
      <button 
        onClick={() => setCurrentScreen("visits")}
        className={`flex flex-col items-center gap-1 px-4 py-1 ${currentScreen === "visits" ? "text-primary" : "text-muted-foreground"}`}
        data-testid="mobile-tab-visits"
      >
        <Calendar className="h-5 w-5" />
        <span className="text-xs">Navstevy</span>
      </button>
      <button 
        onClick={() => setCurrentScreen("hospitals")}
        className={`flex flex-col items-center gap-1 px-4 py-1 ${currentScreen === "hospitals" ? "text-primary" : "text-muted-foreground"}`}
        data-testid="mobile-tab-hospitals"
      >
        <Building2 className="h-5 w-5" />
        <span className="text-xs">Nemocnice</span>
      </button>
      <button 
        onClick={() => setCurrentScreen("profile")}
        className={`flex flex-col items-center gap-1 px-4 py-1 ${currentScreen === "profile" ? "text-primary" : "text-muted-foreground"}`}
        data-testid="mobile-tab-profile"
      >
        <User className="h-5 w-5" />
        <span className="text-xs">Profil</span>
      </button>
    </div>
  );

  const renderLoginScreen = () => (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-primary/10 to-background p-6">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Smartphone className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-bold">INDEXUS Connect</h1>
        <p className="text-sm text-muted-foreground">Mobilna aplikacia pre terennych pracovnikov</p>
      </div>
      
      <div className="w-full space-y-4">
        <Input
          placeholder="Prihlasovacie meno"
          value={loginForm.username}
          onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
          data-testid="mobile-input-username"
        />
        <Input
          type="password"
          placeholder="Heslo"
          value={loginForm.password}
          onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
          data-testid="mobile-input-password"
        />
        <Button 
          className="w-full" 
          onClick={handleLogin}
          disabled={isLoading}
          data-testid="mobile-button-login"
        >
          {isLoading ? "Prihlasovanie..." : "Prihlasit sa"}
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground mt-8 text-center">
        Pristupove udaje nastavuje administrator v CRM systeme
      </p>
    </div>
  );

  const renderDashboard = () => (
    <div className="flex flex-col h-full">
      <div className="bg-primary text-primary-foreground p-4">
        <p className="text-sm opacity-80">Vitajte,</p>
        <h2 className="text-lg font-semibold">{user?.firstName} {user?.lastName}</h2>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-3">
            <div className="text-2xl font-bold text-primary">{visits.length}</div>
            <div className="text-xs text-muted-foreground">Celkovo navstev</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-green-600">
              {visits.filter(v => v.status === "completed").length}
            </div>
            <div className="text-xs text-muted-foreground">Dokoncených</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-blue-600">
              {visits.filter(v => v.status === "planned").length}
            </div>
            <div className="text-xs text-muted-foreground">Planovanych</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold">{hospitals.length}</div>
            <div className="text-xs text-muted-foreground">Nemocnic</div>
          </Card>
        </div>
        
        <h3 className="font-semibold mb-2">Rychle akcie</h3>
        <div className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => setCurrentScreen("new-visit")}
            data-testid="mobile-button-new-visit"
          >
            <Plus className="h-4 w-4" />
            Nova navsteva
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => setCurrentScreen("visits")}
          >
            <Calendar className="h-4 w-4" />
            Zobrazit navstevy
          </Button>
        </div>
        
        <Separator className="my-4" />
        
        <h3 className="font-semibold mb-2">Posledne navstevy</h3>
        {visits.slice(0, 3).map(visit => (
          <Card 
            key={visit.id} 
            className="p-3 mb-2 cursor-pointer hover-elevate"
            onClick={() => {
              setSelectedVisit(visit);
              setCurrentScreen("visit-detail");
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {hospitals.find(h => h.id === visit.hospitalId)?.name || "Nemocnica"}
                </p>
                <p className="text-xs text-muted-foreground">{visit.scheduledDate}</p>
              </div>
              {getStatusBadge(visit.status)}
            </div>
          </Card>
        ))}
      </ScrollArea>
    </div>
  );

  const renderVisits = () => (
    <div className="flex flex-col h-full">
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <h2 className="font-semibold">Navstevy</h2>
        <Button 
          size="icon" 
          variant="ghost" 
          className="text-primary-foreground"
          onClick={() => setCurrentScreen("new-visit")}
          data-testid="mobile-button-add-visit"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {visits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Ziadne navstevy</p>
            <Button 
              variant="ghost" 
              onClick={() => setCurrentScreen("new-visit")}
            >
              Vytvorit prvu navstevu
            </Button>
          </div>
        ) : (
          visits.map(visit => (
            <Card 
              key={visit.id} 
              className="p-3 mb-2 cursor-pointer hover-elevate"
              onClick={() => {
                setSelectedVisit(visit);
                setCurrentScreen("visit-detail");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {hospitals.find(h => h.id === visit.hospitalId)?.name || "Nemocnica"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {visit.scheduledDate}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(visit.status)}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))
        )}
      </ScrollArea>
    </div>
  );

  const renderHospitals = () => (
    <div className="flex flex-col h-full">
      <div className="bg-primary text-primary-foreground p-4">
        <h2 className="font-semibold">Nemocnice</h2>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {hospitals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Ziadne nemocnice</p>
          </div>
        ) : (
          hospitals.map(hospital => (
            <Card key={hospital.id} className="p-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{hospital.name}</p>
                  {hospital.city && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {hospital.city}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </ScrollArea>
    </div>
  );

  const renderProfile = () => (
    <div className="flex flex-col h-full">
      <div className="bg-primary text-primary-foreground p-4">
        <h2 className="font-semibold">Profil</h2>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col items-center mb-6">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <User className="h-10 w-10 text-primary" />
          </div>
          <h3 className="font-semibold">{user?.firstName} {user?.lastName}</h3>
          <p className="text-sm text-muted-foreground">Terenný pracovník</p>
          <Badge className="mt-2">{user?.countryCode}</Badge>
        </div>
        
        <Separator className="my-4" />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm">Stav pripojenia</span>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-600">Offline</span>
                </>
              )}
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => setIsOnline(!isOnline)}
          >
            {isOnline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            {isOnline ? "Simulovat offline rezim" : "Pripojit online"}
          </Button>
        </div>
        
        <Separator className="my-4" />
        
        <Button 
          variant="destructive" 
          className="w-full"
          onClick={handleLogout}
          data-testid="mobile-button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Odhlasit sa
        </Button>
      </ScrollArea>
    </div>
  );

  const renderVisitDetail = () => (
    <div className="flex flex-col h-full">
      <div className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <Button 
          size="icon" 
          variant="ghost" 
          className="text-primary-foreground"
          onClick={() => setCurrentScreen("visits")}
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
        </Button>
        <h2 className="font-semibold">Detail navstevy</h2>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {selectedVisit && (
          <>
            <Card className="p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">
                    {hospitals.find(h => h.id === selectedVisit.hospitalId)?.name || "Nemocnica"}
                  </p>
                  {getStatusBadge(selectedVisit.status)}
                </div>
              </div>
              
              <Separator className="my-3" />
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Typ:</span>
                  <span>{getVisitTypeLabel(selectedVisit.visitType)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Datum:</span>
                  <span>{selectedVisit.scheduledDate}</span>
                </div>
                {selectedVisit.notes && (
                  <div>
                    <span className="text-muted-foreground">Poznamky:</span>
                    <p className="mt-1">{selectedVisit.notes}</p>
                  </div>
                )}
              </div>
            </Card>
            
            <h3 className="font-semibold mb-2">Hlasove poznamky</h3>
            <Card className="p-4">
              <div className="flex flex-col items-center">
                {isRecording ? (
                  <>
                    <div className="text-2xl font-mono mb-3 text-red-600">
                      {formatRecordingTime(recordingTime)}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />
                      <span className="text-sm text-red-600">Nahrava sa...</span>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setIsRecording(false);
                        setRecordingTime(0);
                        toast({ title: "Nahravka ulozena (simulacia)" });
                      }}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Zastavit
                    </Button>
                  </>
                ) : (
                  <>
                    <Mic className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Kliknite pre nahravanie hlasovej poznamky
                    </p>
                    <Button onClick={() => setIsRecording(true)}>
                      <Play className="h-4 w-4 mr-2" />
                      Spustit nahravanie
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </>
        )}
      </ScrollArea>
    </div>
  );

  const renderNewVisit = () => (
    <div className="flex flex-col h-full">
      <div className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <Button 
          size="icon" 
          variant="ghost" 
          className="text-primary-foreground"
          onClick={() => setCurrentScreen("visits")}
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
        </Button>
        <h2 className="font-semibold">Nova navsteva</h2>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nemocnica</label>
            <select 
              className="w-full p-2 border rounded-md bg-background"
              value={newVisitForm.hospitalId}
              onChange={(e) => setNewVisitForm(prev => ({ ...prev, hospitalId: e.target.value }))}
              data-testid="mobile-select-hospital"
            >
              <option value="">Vyberte nemocnicu</option>
              {hospitals.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Typ navstevy</label>
            <select 
              className="w-full p-2 border rounded-md bg-background"
              value={newVisitForm.visitType}
              onChange={(e) => setNewVisitForm(prev => ({ ...prev, visitType: e.target.value }))}
            >
              <option value="personal_visit">Osobna navsteva</option>
              <option value="phone_call">Telefonicky hovor</option>
              <option value="online_meeting">Online stretnutie</option>
              <option value="training">Skolenie</option>
              <option value="other">Ine</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Datum</label>
            <Input
              type="date"
              value={newVisitForm.scheduledDate}
              onChange={(e) => setNewVisitForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Poznamky</label>
            <textarea 
              className="w-full p-2 border rounded-md bg-background min-h-[100px]"
              value={newVisitForm.notes}
              onChange={(e) => setNewVisitForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Volitelne poznamky..."
            />
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleCreateVisit}
            disabled={isLoading}
            data-testid="mobile-button-save-visit"
          >
            {isLoading ? "Ukladanie..." : "Ulozit navstevu"}
          </Button>
        </div>
      </ScrollArea>
    </div>
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case "login": return renderLoginScreen();
      case "dashboard": return renderDashboard();
      case "visits": return renderVisits();
      case "hospitals": return renderHospitals();
      case "profile": return renderProfile();
      case "visit-detail": return renderVisitDetail();
      case "new-visit": return renderNewVisit();
      default: return renderLoginScreen();
    }
  };

  const showTabBar = currentScreen !== "login" && currentScreen !== "visit-detail" && currentScreen !== "new-visit";

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex flex-col items-center">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold flex items-center gap-2 justify-center">
          <Smartphone className="h-6 w-6" />
          INDEXUS Connect - Nahlad
        </h1>
        <p className="text-muted-foreground">
          Webova simulacia mobilnej aplikacie
        </p>
      </div>
      
      <div className="relative">
        <div className="w-[375px] h-[812px] bg-black rounded-[3rem] p-3 shadow-2xl">
          <div className="w-full h-full bg-background rounded-[2.5rem] overflow-hidden flex flex-col">
            {renderStatusBar()}
            <div className="flex-1 overflow-hidden flex flex-col">
              {renderScreen()}
            </div>
            {showTabBar && renderTabBar()}
            <div className="h-1 w-32 bg-black rounded-full mx-auto my-2" />
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-center text-sm text-muted-foreground max-w-md">
        <p>Tato stranka simuluje mobilnu aplikaciu INDEXUS Connect.</p>
        <p>Prihlasovacie udaje nastavte v CRM cez Spolupracovnici &rarr; INDEXUS Connect.</p>
      </div>
    </div>
  );
}
