import { useToast } from "@/hooks/use-toast"
import {
  type PulseToastState,
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import {
  AlertTriangle,
  BellRing,
  ClipboardList,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
} from "lucide-react"

const pulseIcons = {
  ended: PhoneOff,
  acw: ClipboardList,
  next: PhoneForwarded,
  connected: PhoneCall,
  warning: AlertTriangle,
} satisfies Record<PulseToastState, typeof PhoneOff>

const pulseSteps: PulseToastState[] = ["ended", "acw", "next"]

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, pulseState, ...props }) {
        const destructive = props.variant === "destructive"
        const pulse = props.variant === "pulse"
        const activePulseState = pulseState ?? "warning"
        const PulseIcon = pulseIcons[activePulseState]
        const activeStep = pulseSteps.indexOf(activePulseState)
        return (
          <Toast key={id} pulseState={pulseState} {...props}>
            <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              destructive
                ? "bg-white/15"
                : pulse
                  ? "h-[30px] w-[30px] rounded-lg bg-[#f7e3dc] text-[#b65046] dark:bg-[#553631] dark:text-[#f09a8e]"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-300"
            }`}>
              {pulse
                ? <PulseIcon className="relative h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
                : destructive
                  ? <AlertTriangle className="relative h-5 w-5" aria-hidden="true" />
                  : <BellRing className="relative h-5 w-5" aria-hidden="true" />}
            </div>
            <div className={`grid min-w-0 flex-1 ${pulse ? "gap-2" : "gap-1"}`}>
              {title && <ToastTitle className={pulse ? "text-xs font-extrabold leading-tight" : undefined}>{title}</ToastTitle>}
              {description && (
                <ToastDescription className={pulse ? "text-[11px] leading-relaxed text-[#697174] opacity-100 dark:text-[#c9c1be]" : undefined}>
                  {description}
                </ToastDescription>
              )}
              {pulse && activeStep >= 0 && (
                <div className="mt-0.5 flex items-center gap-1.5 border-t border-[#efe1da] pt-2 dark:border-[#513d38]" aria-hidden="true">
                  {pulseSteps.map((step, index) => {
                    const StepIcon = pulseIcons[step]
                    const active = index === activeStep
                    const complete = index < activeStep
                    return (
                      <div key={step} className="flex flex-1 items-center gap-1.5">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
                          active
                            ? "bg-[#f6e8e2] text-[#a85147] dark:bg-[#593a34] dark:text-[#f09a8e]"
                            : complete
                              ? "bg-[#e3f0e9] text-[#40826b] dark:bg-[#29483d] dark:text-[#83c5ac]"
                              : "bg-[#f1ebe6] text-[#a9a19c] dark:bg-[#3a3230] dark:text-[#877d79]"
                        }`}>
                          <StepIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </span>
                        {index < pulseSteps.length - 1 && (
                          <span className={`h-px flex-1 ${complete ? "bg-[#8ab9a7]" : "bg-[#dfd3cc] dark:bg-[#594a45]"}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
