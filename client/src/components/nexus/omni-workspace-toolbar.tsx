import type { ReactNode } from "react";
import { Maximize2, Minimize2, Network, PenSquare, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import type { NexusTab } from "./nexus-types";
export function OmniWorkspaceToolbar({ tabs, activeTab, onTab, onSearch, onSettings, onFullscreen, fullscreen, onCompose, scope, chatError, onChatRetry }: {
  tabs: { key: NexusTab; label: string; icon: ReactNode; badge?: number }[];
  activeTab: NexusTab; onTab: (tab: NexusTab) => void; onSearch: () => void; onSettings: () => void;
  onFullscreen: () => void; fullscreen: boolean; onCompose: () => void; scope: string;
  chatError: boolean; onChatRetry: () => void;
}) {
  const { t } = useI18n();
  return <header className="omni-top">
    <div className="omni-toolbar">
      <div className="omni-brand"><div className="omni-brand-mark"><Network className="h-4 w-4" /></div>
        <h1>{t.nexusOmni.title}</h1>
      </div>
      <nav className="omni-channel-tabs" aria-label={t.nexusOmni.title} data-testid="nexus-tabs">
        {tabs.map(tab => <button type="button" key={tab.key} onClick={() => onTab(tab.key)} data-testid={`tab-${tab.key}`}
          aria-current={activeTab === tab.key ? "page" : undefined} aria-selected={activeTab === tab.key}
          className={activeTab === tab.key ? "selected" : ""}>
          {tab.icon}<span>{tab.label}</span>{!!tab.badge && <span className="omni-tab-count">{tab.badge}</span>}
        </button>)}
      </nav>
      <div className="omni-toolbar-actions">
        {chatError && <Button size="sm" variant="outline" onClick={onChatRetry}>{t.common.refresh}</Button>}
        <Button variant="outline" size="icon" onClick={onSearch} data-testid="button-smart-search"
          aria-label={t.nexusOmni.search.searchInEmails} title={`${t.nexusOmni.search.searchInEmails} · Ctrl K\n${t.omniGroups.scope}: ${scope}`}>
          <Search className="h-4 w-4" />
        </Button>
        {activeTab === "email" && <Button variant="outline" size="icon" title={t.nexusOmni.settings.accounts} aria-label={t.nexusOmni.settings.accounts}
          onClick={onSettings} data-testid="button-signature"><Settings className="h-4 w-4" /></Button>}
        <Button variant="outline" size="icon" title={fullscreen ? t.nexusOmni.exitFullscreen : t.nexusOmni.fullscreen}
          aria-label={fullscreen ? t.nexusOmni.exitFullscreen : t.nexusOmni.fullscreen} onClick={onFullscreen} data-testid="button-nexus-fullscreen">
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        {activeTab === "email" && <Button onClick={onCompose} data-testid="button-compose"><PenSquare className="h-4 w-4 mr-2" />{t.nexusOmni.common.newMessage}</Button>}
      </div>
    </div>
  </header>;
}
