import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import {
  requestPulseDial,
  type PulseDialHandler,
} from "@/lib/pulse-dial-request";

interface PulseDialButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled"> {
  phoneNumber: string | null | undefined;
  onDial: PulseDialHandler | undefined;
  errorMessage: string;
  children: ReactNode;
}

function PulseDialButton({
  phoneNumber,
  onDial,
  errorMessage,
  children,
  ...buttonProps
}: PulseDialButtonProps) {
  const [dialFailed, setDialFailed] = useState(false);
  const unavailable = !phoneNumber?.trim() || !onDial;

  const handleClick = async () => {
    setDialFailed(false);
    try {
      const requested = await requestPulseDial(onDial, phoneNumber);
      if (!requested) setDialFailed(true);
    } catch {
      setDialFailed(true);
    }
  };

  return (
    <>
      <button
        type="button"
        {...buttonProps}
        disabled={unavailable}
        onClick={handleClick}
      >
        {children}
      </button>
      {dialFailed ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </>
  );
}

export function PulseMainDialButton(props: PulseDialButtonProps) {
  return <PulseDialButton {...props} data-testid="btn-call-from-canvas" />;
}

export function PulseQuickDialButton(props: PulseDialButtonProps) {
  return <PulseDialButton {...props} data-testid="btn-quick-call" />;
}

export function PulseClinicDialButton(props: PulseDialButtonProps) {
  return <PulseDialButton {...props} data-testid="btn-call-phone1" />;
}

export function PulseMobileDialButton({
  label,
  ...props
}: PulseDialButtonProps & { label: string }) {
  return (
    <PulseDialButton
      {...props}
      data-testid={`btn-mobile-call-${label.toLowerCase().replace(/\s/g, "-")}`}
    />
  );
}