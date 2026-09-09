import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { AlertTriangle, BellRing } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const destructive = props.variant === "destructive"
        return (
          <Toast key={id} {...props}>
            <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              destructive ? "bg-white/15" : "bg-sky-500/10 text-sky-600 dark:text-sky-300"
            }`}>
              {destructive
                ? <AlertTriangle className="relative h-5 w-5" aria-hidden="true" />
                : <BellRing className="relative h-5 w-5" aria-hidden="true" />}
            </div>
            <div className="grid min-w-0 flex-1 gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
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
