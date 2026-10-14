import { Bell, ClipboardList, Mail, MessageSquare, Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { activityTemplateIconKind } from "./automation-activity-template-utils";

const icons = {
  phone: Phone,
  inbound: PhoneIncoming,
  outbound: PhoneOutgoing,
  email: Mail,
  message: MessageSquare,
  task: ClipboardList,
  notification: Bell,
} as const;

export function AutomationActivityTemplateIcon({ templateId }: { templateId: string }) {
  const kind = activityTemplateIconKind(templateId);
  if (!kind) return null;
  const Icon = icons[kind];
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
      <Icon className="size-3.5" />
    </span>
  );
}
