import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Heart, Shield, Globe, Users, Lock, ArrowRight } from "lucide-react";
import { SiMicrosoft } from "react-icons/si";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { login, loginWithMs365 } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requireMs365, setRequireMs365] = useState(false);
  const [ms365Message, setMs365Message] = useState("");

  // Check for MS365 auth errors in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      const errorMessages: Record<string, string> = {
        ms365_auth_failed: "Prihlásenie cez Microsoft 365 zlyhalo",
        missing_code: "Chýba autorizačný kód",
        session_expired: "Relácia vypršala, skúste znova",
        token_exchange_failed: "Chyba pri získavaní tokenu",
        graph_api_failed: "Chyba pri komunikácii s Microsoft",
        user_not_found: "Používateľ nebol nájdený",
        account_deactivated: "Účet je deaktivovaný",
        email_mismatch: "Email v Microsoft účte sa nezhoduje s CRM účtom",
        login_failed: "Prihlásenie zlyhalo",
      };
      toast({
        title: "Chyba prihlásenia",
        description: errorMessages[error] || "Neznáma chyba",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Chyba",
        description: "Zadajte používateľské meno a heslo",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setRequireMs365(false);
    try {
      const result = await login(username, password);
      
      if (result.requireMs365) {
        // User needs to login via MS365
        setRequireMs365(true);
        setMs365Message(result.message || "Tento účet vyžaduje prihlásenie cez Microsoft 365");
        return;
      }
      
      if (result.user) {
        setLocation("/");
      }
    } catch (error: any) {
      toast({
        title: "Prihlásenie zlyhalo",
        description: error.message || "Neplatné prihlasovacie údaje",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMs365Login = async () => {
    setIsLoading(true);
    try {
      await loginWithMs365(username);
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message || "Nepodarilo sa pripojiť k Microsoft 365",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: Globe,
      title: "Multi-Country Support",
      description: "Manage customers across Slovakia, Czech Republic, Hungary, Romania, Italy, Germany, and USA",
    },
    {
      icon: Users,
      title: "Role-Based Access",
      description: "Assign users to specific countries with Admin, Manager, or User roles",
    },
    {
      icon: Shield,
      title: "Secure Data Management",
      description: "Enterprise-grade security for sensitive medical customer data",
    },
    {
      icon: Heart,
      title: "Cord Blood Banking",
      description: "Specialized CRM features for cord blood and tissue banking services",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        
        <div className="relative z-10 container mx-auto px-4 py-8">
          <header className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
                <Heart className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">INDEXUS</h1>
                <p className="text-xs text-muted-foreground">Cord Blood Banking CRM</p>
              </div>
            </div>
          </header>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                  Manage Your <span className="text-primary">Cord Blood Banking</span> Business
                </h2>
                <p className="text-lg text-muted-foreground max-w-lg">
                  A comprehensive CRM system designed specifically for cord blood banking companies. 
                  Streamline customer management across multiple countries with role-based access control.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div 
                    key={index} 
                    className="flex gap-3 p-4 rounded-lg bg-card border hover-elevate"
                    data-testid={`feature-card-${index}`}
                  >
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <CardTitle className="text-2xl">Sign In</CardTitle>
                  </div>
                  <CardDescription>
                    Enter your credentials to access the CRM system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading}
                        data-testid="input-login-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        data-testid="input-login-password"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading}
                      data-testid="button-login"
                    >
                      {isLoading ? "Prihlasujem..." : "Prihlásiť sa"}
                      {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>

                    {/* MS365 Login Section */}
                    {requireMs365 && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                          {ms365Message}
                        </p>
                        <Button 
                          type="button"
                          variant="outline"
                          className="w-full border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"
                          onClick={handleMs365Login}
                          disabled={isLoading}
                          data-testid="button-login-ms365"
                        >
                          <SiMicrosoft className="mr-2 h-4 w-4" />
                          Prihlásiť sa cez Microsoft 365
                        </Button>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          <footer className="mt-24 pt-8 border-t">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <p>INDEXUS CRM - Secure Medical Customer Management</p>
              <div className="flex items-center gap-4">
                <span>Slovakia</span>
                <span>Czech Republic</span>
                <span>Hungary</span>
                <span>Romania</span>
                <span>Italy</span>
                <span>Germany</span>
                <span>USA</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
