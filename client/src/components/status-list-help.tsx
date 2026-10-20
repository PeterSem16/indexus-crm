import { useId, useRef, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getStatusListHelpCopy, statusListHelpSectionIds, type HelpSectionId } from "./status-list-help-copy";
import "./status-list-help.css";

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();

/** Read-only help. Kept local to Status List so it can open over template drafts. */
export function StatusListHelp({ locale }: { locale: string }) {
  const copy = getStatusListHelpCopy(locale);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<HelpSectionId>("start");
  const articleRef = useRef<HTMLElement>(null);
  const id = useId();
  const query = normalize(search);
  const visible = statusListHelpSectionIds.filter(key => !query || normalize(
    `${copy.sections[key].title} ${copy.sections[key].paragraphs.join(" ")}`
  ).includes(query));
  const current = visible.includes(active) ? active : visible[0];
  const section = current ? copy.sections[current] : undefined;
  return <Dialog open={open} onOpenChange={next => {
    setOpen(next);
    if (next) { setSearch(""); setActive("start"); }
  }}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" data-testid="status-list-help-open">
      <BookOpen className="h-3.5 w-3.5" aria-hidden="true"/><span>{copy.help}</span>
    </Button></DialogTrigger>
    <DialogContent className="status-list-help-dialog flex flex-col gap-0 overflow-hidden p-0" overlayClassName="!z-[10059]" hideCloseButton data-testid="status-list-help-dialog">
      <DialogHeader className="border-b px-5 py-4 pr-12">
        <DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" aria-hidden="true"/>{copy.title}</DialogTitle>
        <DialogDescription>{copy.intro}</DialogDescription>
        <button type="button" onClick={() => setOpen(false)} aria-label={copy.close} className="absolute right-3 top-3 rounded p-1.5 hover:bg-muted focus-visible:outline focus-visible:outline-2"><X className="h-4 w-4" aria-hidden="true"/></button>
      </DialogHeader>
      <div className="status-list-help-layout min-h-0 flex-1">
        <aside className="status-list-help-nav">
          <label className="status-list-help-search">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true"/>
            <input type="search" value={search} onChange={event => { setSearch(event.target.value); articleRef.current?.scrollTo(0, 0); }} placeholder={copy.search} aria-label={copy.search} data-testid="status-list-help-search"/>
          </label>
          <nav aria-label={copy.title}>{visible.map(key => <button type="button" key={key} aria-current={key === current ? "page" : undefined}
            onClick={() => { setActive(key); articleRef.current?.scrollTo(0, 0); }} data-testid={`status-list-help-chapter-${key}`}
            aria-controls={`${id}-article`}>{copy.sections[key].title}</button>)}</nav>
        </aside>
        <article ref={articleRef} id={`${id}-article`} className="status-list-help-article" tabIndex={0} aria-labelledby={section ? `${id}-title` : undefined} data-testid="status-list-help-article">
          {section ? <><h3 id={`${id}-title`}>{section.title}</h3>{section.paragraphs.map((text, index) => <p key={`${current}-${index}`}>{text}</p>)}</> : <p role="status">{copy.empty}</p>}
        </article>
      </div>
      <DialogFooter className="border-t px-5 py-3"><Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="status-list-help-close"><X className="mr-1.5 h-4 w-4" aria-hidden="true"/>{copy.close}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
