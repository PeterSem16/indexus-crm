import { MailOpen, MessageSquareText, MessagesSquare, ListTodo } from "lucide-react";
import { Link } from "wouter";
import "./sidebar-notification-badge.css";

type Kind = "email" | "sms" | "chat" | "task";
const icons = { email: MailOpen, sms: MessageSquareText, chat: MessagesSquare, task: ListTodo };

export function SidebarNotificationBadge({
  kind, count, label, href, testId,
}: {
  kind: Kind;
  count: number;
  label: string;
  href?: string;
  testId?: string;
}) {
  if (!Number.isFinite(count) || count <= 0) return null;
  const Icon = icons[kind];
  const accessibleLabel = `${label}: ${count}`;
  const props = {
    className: `sidebar-count-pill sidebar-count-pill-${kind}`,
    title: accessibleLabel,
    "aria-label": accessibleLabel,
    "data-testid": testId,
  };
  const content = <><Icon aria-hidden="true" /><span>{count > 99 ? "99+" : count}</span></>;
  return href ? <Link href={href} {...props}>{content}</Link> : <span {...props}>{content}</span>;
}
