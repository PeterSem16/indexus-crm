import { motion, AnimatePresence } from "framer-motion";
import { Send, Check } from "lucide-react";

// Reusable "sent for processing" overlay. Controlled by `open` + `status`.
// While "sending": a paper plane bobs inside pulsing rings.
// On "done": rings burst and a check pops in with the success label.
export function SendProcessingOverlay({
  open,
  status,
  sendingLabel,
  doneLabel,
}: {
  open: boolean;
  status: "sending" | "done";
  sendingLabel: string;
  doneLabel: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10060] flex items-center justify-center bg-background/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          data-testid="overlay-send-processing"
        >
          <motion.div
            className="flex flex-col items-center gap-5"
            initial={{ scale: 0.85, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
          >
            <div className="relative flex h-28 w-28 items-center justify-center">
              {status === "sending" &&
                [0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute h-14 w-14 rounded-full border-2 border-purple-400/50"
                    initial={{ scale: 0.6, opacity: 0.6 }}
                    animate={{ scale: 2.1, opacity: 0 }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.45, ease: "easeOut" }}
                  />
                ))}

              <AnimatePresence mode="wait">
                {status === "sending" ? (
                  <motion.div
                    key="plane"
                    className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, y: [0, -6, 0], rotate: [0, -8, 0] }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{
                      y: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
                      rotate: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
                    }}
                  >
                    <Send className="h-7 w-7 -translate-x-px translate-y-px" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="done"
                    className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/40"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 16 }}
                  >
                    <motion.span
                      className="absolute inset-0 rounded-full border-2 border-emerald-400"
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{ scale: 1.9, opacity: 0 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                    <Check className="h-8 w-8" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.div
              key={status}
              className="text-sm font-semibold text-foreground"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="text-send-processing-label"
            >
              {status === "sending" ? sendingLabel : doneLabel}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
