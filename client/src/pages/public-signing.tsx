import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertCircle, FileSignature, ShieldCheck, PenLine } from "lucide-react";

type SigningStep = "loading" | "error" | "otp" | "sign" | "success" | "already_signed";

interface SigningInfo {
  contractNumber: string;
  signerName: string;
  status: string;
  verificationMethod: string;
  otpVerified: boolean;
  signatureRequestId: string;
}

export default function PublicSigningPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [step, setStep] = useState<SigningStep>("loading");
  const [signingInfo, setSigningInfo] = useState<SigningInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [typedName, setTypedName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchSigningInfo();
  }, [token]);

  async function fetchSigningInfo() {
    try {
      const res = await fetch(`/api/public/sign/${token}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.alreadySigned) {
          setStep("already_signed");
        } else {
          setErrorMessage(data.error || "This signing link is not valid");
          setStep("error");
        }
        return;
      }

      setSigningInfo(data);
      if (data.otpVerified) {
        setStep("sign");
      } else {
        setStep("otp");
      }
    } catch {
      setErrorMessage("Unable to connect to the server. Please try again later.");
      setStep("error");
    }
  }

  async function handleVerifyOtp() {
    if (!otpCode || otpCode.length < 4) {
      setOtpError("Please enter the verification code");
      return;
    }

    setIsSubmitting(true);
    setOtpError("");

    try {
      const res = await fetch(`/api/public/sign/${token}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode })
      });
      const data = await res.json();

      if (!res.ok) {
        setOtpError(data.error || "Verification failed");
        setIsSubmitting(false);
        return;
      }

      setStep("sign");
    } catch {
      setOtpError("Connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitSignature() {
    if (!typedName || typedName.trim().length < 2) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/public/sign/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typedName: typedName.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to submit signature");
        setStep("error");
        return;
      }

      setStep("success");
    } catch {
      setErrorMessage("Connection error. Please try again.");
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #6B1C3B 0%, #4a1329 50%, #2d0b19 100%)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white" data-testid="text-signing-title">INDEXUS</h1>
          <p className="text-white/70 text-sm mt-1">Contract Signing Portal</p>
        </div>

        {step === "loading" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-loading">Loading signing information...</p>
            </CardContent>
          </Card>
        )}

        {step === "error" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-muted-foreground" data-testid="text-error">{errorMessage}</p>
            </CardContent>
          </Card>
        )}

        {step === "already_signed" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <h2 className="text-lg font-semibold" data-testid="text-already-signed">Contract Already Signed</h2>
              <p className="text-center text-muted-foreground text-sm">This contract has already been signed. No further action is needed.</p>
            </CardContent>
          </Card>
        )}

        {step === "otp" && signingInfo && (
          <Card>
            <CardHeader className="text-center gap-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(107, 28, 59, 0.1)" }}>
                <ShieldCheck className="h-6 w-6" style={{ color: "#6B1C3B" }} />
              </div>
              <CardTitle className="text-lg" data-testid="text-verify-title">Verify Your Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Contract <span className="font-medium text-foreground">{signingInfo.contractNumber}</span></p>
                <p className="text-sm text-muted-foreground">Signing as <span className="font-medium text-foreground">{signingInfo.signerName}</span></p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Please enter the 6-digit verification code sent to your {signingInfo.verificationMethod === "sms_otp" ? "phone" : "email"}.
              </p>
              <Input
                data-testid="input-otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, ""));
                  setOtpError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
              {otpError && (
                <p className="text-sm text-destructive text-center" data-testid="text-otp-error">{otpError}</p>
              )}
              <Button
                data-testid="button-verify-otp"
                className="w-full"
                onClick={handleVerifyOtp}
                disabled={isSubmitting || otpCode.length < 4}
                style={{ backgroundColor: "#6B1C3B" }}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify Code
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "sign" && signingInfo && (
          <Card>
            <CardHeader className="text-center gap-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(107, 28, 59, 0.1)" }}>
                <PenLine className="h-6 w-6" style={{ color: "#6B1C3B" }} />
              </div>
              <CardTitle className="text-lg" data-testid="text-sign-title">Sign Contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Contract <span className="font-medium text-foreground">{signingInfo.contractNumber}</span></p>
                <p className="text-sm text-muted-foreground">Your identity has been verified</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Type your full name to sign</label>
                <Input
                  data-testid="input-typed-name"
                  type="text"
                  placeholder={signingInfo.signerName}
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitSignature()}
                  className="text-base"
                />
              </div>

              {typedName.trim().length >= 2 && (
                <div className="rounded-md border p-6 text-center" style={{ backgroundColor: "rgba(107, 28, 59, 0.03)" }}>
                  <p className="text-xs text-muted-foreground mb-2">Signature Preview</p>
                  <p
                    data-testid="text-signature-preview"
                    className="text-3xl"
                    style={{
                      fontFamily: "'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive",
                      color: "#1a1a2e"
                    }}
                  >
                    {typedName.trim()}
                  </p>
                </div>
              )}

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By clicking "Sign Contract" below, I confirm that I am <strong>{signingInfo.signerName}</strong> and I agree to the terms of contract <strong>{signingInfo.contractNumber}</strong>. This electronic signature has the same legal validity as a handwritten signature.
                </p>
              </div>

              <Button
                data-testid="button-submit-signature"
                className="w-full"
                onClick={handleSubmitSignature}
                disabled={isSubmitting || typedName.trim().length < 2}
                style={{ backgroundColor: "#6B1C3B" }}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSignature className="h-4 w-4 mr-2" />}
                Sign Contract
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold" data-testid="text-success-title">Contract Signed Successfully</h2>
              <p className="text-center text-muted-foreground text-sm">
                Your signature has been recorded. You may close this window.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-white/40 text-xs mt-6">
          Secured by INDEXUS CRM
        </p>
      </div>
    </div>
  );
}
