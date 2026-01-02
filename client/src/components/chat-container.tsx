import { useChatContext } from "@/contexts/chat-context";
import { ChatWindow } from "./chat-window";

export function ChatContainer() {
  const { openChats, unreadCounts } = useChatContext();

  return (
    <>
      {openChats.map((chat, index) => (
        <ChatWindow
          key={chat.partnerId}
          partnerId={chat.partnerId}
          partner={chat.partner}
          minimized={chat.minimized}
          position={index}
          unreadCount={unreadCounts.get(chat.partnerId) || 0}
        />
      ))}
    </>
  );
}
