import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Heart, Shield, Globe, Users, Lock, ArrowRight, Building2 } from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { login, loginWithMs365 } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"username" | "password" | "ms365">("username");
  const [authMethod, setAuthMethod] = useState<"classic" | "ms365">("classic");
  const [userFullName, setUserFullName] = useState("");

  // Check for MS365 auth errors in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      const errorMessages: Record<string, string> = {
        ms365_auth_failed: "Microsoft 365 login failed",
        missing_code: "Missing authorization code",
        session_expired: "Session expired, please try again",
        token_exchange_failed: "Error obtaining token",
        graph_api_failed: "Error communicating with Microsoft",
        user_not_found: "User not found",
        account_deactivated: "Account is deactivated",
        email_mismatch: "Microsoft account email does not match CRM account",
        login_failed: "Login failed",
      };
      toast({
        title: "Login Error",
        description: errorMessages[error] || "Unknown error",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  // Step 1: Check auth method by username
  const handleCheckAuthMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      toast({
        title: "Error",
        description: "Please enter your username",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/check-auth-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
        credentials: "include",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "User does not exist",
          variant: "destructive",
        });
        return;
      }
      
      setAuthMethod(data.authMethod);
      setUserFullName(data.fullName);
      
      if (data.authMethod === "ms365") {
        setStep("ms365");
      } else {
        setStep("password");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2a: Classic password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(username, password);
      
      if (result.user) {
        setLocation("/");
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2b: MS365 login
  const handleMs365Login = async () => {
    setIsLoading(true);
    try {
      await loginWithMs365(username);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to connect to Microsoft 365",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };
  
  // Go back to username step
  const handleBack = () => {
    setStep("username");
    setPassword("");
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
                  {/* Step 1: Username */}
                  {step === "username" && (
                    <form onSubmit={handleCheckAuthMethod} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          placeholder="Enter your username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          disabled={isLoading}
                          autoFocus
                          data-testid="input-login-username"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoading || !username}
                        data-testid="button-continue"
                      >
                        {isLoading ? "Verifying..." : "Continue"}
                        {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>
                    </form>
                  )}

                  {/* Step 2a: Password for classic auth */}
                  {step === "password" && (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground">Signing in as</p>
                        <p className="font-semibold">{userFullName || username}</p>
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
                          autoFocus
                          data-testid="input-login-password"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoading || !password}
                        data-testid="button-login"
                      >
                        {isLoading ? "Signing in..." : "Sign In"}
                        {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={handleBack}
                        disabled={isLoading}
                        data-testid="button-back"
                      >
                        Back
                      </Button>
                    </form>
                  )}

                  {/* Step 2b: MS365 login */}
                  {step === "ms365" && (
                    <div className="space-y-4">
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground">Signing in as</p>
                        <p className="font-semibold">{userFullName || username}</p>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3 text-center">
                          This account requires Microsoft 365 sign-in
                        </p>
                        <Button 
                          type="button"
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={handleMs365Login}
                          disabled={isLoading}
                          data-testid="button-login-ms365"
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          {isLoading ? "Signing in..." : "Sign in with Microsoft 365"}
                        </Button>
                      </div>
                      <Button 
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={handleBack}
                        disabled={isLoading}
                        data-testid="button-back-ms365"
                      >
                        Back
                      </Button>
                    </div>
                  )}
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
