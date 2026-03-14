import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Extension } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, List, ListOrdered,
  Quote, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Unlink, ImageIcon, Table as TableIcon,
  Paintbrush, Type, Minus,
  Paperclip, X, Upload, Sparkles, Loader2, ChevronDown, ChevronUp
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff",
  "#9900ff", "#ff00ff", "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3",
  "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
];

const FONT_SIZES = [
  { label: "8", value: "8px" },
  { label: "9", value: "9px" },
  { label: "10", value: "10px" },
  { label: "11", value: "11px" },
  { label: "12", value: "12px" },
  { label: "13", value: "13px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
  { label: "28", value: "28px" },
  { label: "32", value: "32px" },
  { label: "36", value: "36px" },
  { label: "48", value: "48px" },
  { label: "72", value: "72px" },
];

interface EmailEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  signatureHtml?: string;
  attachments?: File[];
  onAttachmentsChange?: (files: File[]) => void;
  showAttachments?: boolean;
  className?: string;
  onAiSuggest?: () => void;
  onAiSummary?: () => void;
  aiLoading?: boolean;
  aiSummaryLoading?: boolean;
}

export default function EmailEditor({
  initialContent = "",
  onChange,
  placeholder = "Napíšte správu...",
  minHeight = "200px",
  signatureHtml,
  attachments = [],
  onAttachmentsChange,
  showAttachments = true,
  className,
  onAiSuggest,
  onAiSummary,
  aiLoading,
  aiSummaryLoading,
}: EmailEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const imageFileRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-blue-600 underline" } }),
      Image.configure({ HTMLAttributes: { class: "max-w-full h-auto rounded" } }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3",
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (editor && !initializedRef.current) {
      initializedRef.current = true;
      let content = initialContent || "";
      const alreadyHasSignature = content.indexOf('<div class="email-signature"') !== -1;
      if (signatureHtml && !alreadyHasSignature) {
        const spacer = "<p><br></p><p><br></p><p><br></p>";
        content = content + spacer + '<div class="email-signature">' + signatureHtml + "</div>";
      }
      if (content) {
        editor.commands.setContent(content);
        setTimeout(() => {
          editor.commands.focus("start");
        }, 50);
      }
    }
  }, [editor, initialContent, signatureHtml]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onAttachmentsChange) {
      const newFiles = Array.from(e.target.files);
      onAttachmentsChange([...attachments, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [attachments, onAttachmentsChange]);

  const removeAttachment = useCallback((index: number) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((_, i) => i !== index));
    }
  }, [attachments, onAttachmentsChange]);

  const handleImageInsert = useCallback(() => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl("");
      setImageOpen(false);
    }
  }, [imageUrl, editor]);

  const handleImageFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && editor) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          editor.chain().focus().setImage({ src: ev.target.result as string }).run();
        }
      };
      reader.readAsDataURL(file);
      setImageOpen(false);
    }
    if (imageFileRef.current) imageFileRef.current.value = "";
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkUrl("");
    setLinkOpen(false);
  }, [editor, linkUrl]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getCurrentFontSize = () => {
    if (!editor) return "";
    const attrs = editor.getAttributes("textStyle");
    return attrs?.fontSize ? attrs.fontSize.replace("px", "") : "13";
  };

  if (!editor) return null;

  return (
    <div className={cn("border rounded-lg overflow-hidden bg-background", className)} data-testid="email-editor">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30" data-testid="email-editor-toolbar">
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("bold") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Tučné"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("italic") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Kurzíva"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("underline") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Podčiarknuté"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("strike") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Prečiarknuté"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Select
          value={getCurrentFontSize()}
          onValueChange={(val) => {
            editor.chain().focus().setFontSize(`${val}px`).run();
          }}
        >
          <SelectTrigger className="h-7 w-14 text-xs px-1.5 border-0 bg-transparent hover:bg-accent" data-testid="select-font-size">
            <SelectValue placeholder="13" />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map(s => (
              <SelectItem key={s.value} value={s.label}>
                <span style={{ fontSize: s.value }}>{s.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("heading", { level: 1 }) && "bg-accent")}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Nadpis 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("heading", { level: 2 }) && "bg-accent")}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Nadpis 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("bulletList") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Odrážkový zoznam"
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("orderedList") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Číslovaný zoznam"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("blockquote") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citácia"
        >
          <Quote className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontálna čiara"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive({ textAlign: "left" }) && "bg-accent")}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Zarovnať vľavo"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive({ textAlign: "center" }) && "bg-accent")}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Na stred"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive({ textAlign: "right" }) && "bg-accent")}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Zarovnať vpravo"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive({ textAlign: "justify" }) && "bg-accent")}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          title="Do bloku"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Farba textu">
              <Paintbrush className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            <div className="grid grid-cols-8 gap-1">
              {TEXT_COLORS.map(color => (
                <button
                  key={color}
                  className="h-5 w-5 rounded border border-muted-foreground/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => { editor.chain().focus().setColor(color).run(); setColorOpen(false); }}
                />
              ))}
            </div>
            <button className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground text-center py-1" onClick={() => { editor.chain().focus().unsetColor().run(); setColorOpen(false); }}>
              Zrušiť farbu
            </button>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className={cn("h-7 w-7", editor.isActive("link") && "bg-accent")} title="Odkaz">
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="flex gap-1">
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setLink()}
                className="h-8 text-sm"
              />
              <Button size="sm" className="h-8" onClick={setLink}>OK</Button>
            </div>
          </PopoverContent>
        </Popover>
        {editor.isActive("link") && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().unsetLink().run()} title="Odstrániť odkaz">
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        )}

        <Popover open={imageOpen} onOpenChange={setImageOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Vložiť obrázok">
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 space-y-2" align="start">
            <div className="flex gap-1">
              <Input
                placeholder="URL obrázka..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImageInsert()}
                className="h-8 text-sm"
              />
              <Button size="sm" className="h-8" onClick={handleImageInsert}>OK</Button>
            </div>
            <div className="text-center">
              <span className="text-xs text-muted-foreground">alebo</span>
            </div>
            <Button
              type="button" variant="outline" size="sm" className="w-full"
              onClick={() => imageFileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-2" />
              Nahrať zo súboru
            </Button>
            <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
          </PopoverContent>
        </Popover>

        <Button
          type="button" variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Vložiť tabuľku"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Späť">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Vpred">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>

        {showAttachments && (
          <>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} title="Pridať prílohu">
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          </>
        )}

        {(onAiSuggest || onAiSummary) && (
          <>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            {onAiSuggest && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs px-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                onClick={onAiSuggest}
                disabled={aiLoading}
                title="Generovať odpoveď pomocou AI"
                data-testid="button-ai-suggest"
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generovať odpoveď
              </Button>
            )}
            {onAiSummary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs px-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={onAiSummary}
                disabled={aiSummaryLoading}
                title="Zhrnutie emailovej konverzácie"
                data-testid="button-ai-summary"
              >
                {aiSummaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Zhrnutie
              </Button>
            )}
          </>
        )}
      </div>

      <EditorContent editor={editor} data-testid="email-editor-content" />

      {showAttachments && attachments.length > 0 && (
        <div className="border-t px-3 py-2 flex flex-wrap gap-1.5 bg-muted/20">
          {attachments.map((file, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-40 truncate">{file.name}</span>
              <span className="text-muted-foreground text-[10px]">({formatFileSize(file.size)})</span>
              <button type="button" className="ml-1 h-4 w-4 rounded-sm hover:bg-destructive/20 flex items-center justify-center" onClick={() => removeAttachment(index)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function useEmailEditorRef() {
  const editorRef = useRef<{ setContent: (html: string) => void } | null>(null);
  return editorRef;
}

interface EmailRecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  knownEmails: Array<{ name?: string; address: string }>;
  className?: string;
  "data-testid"?: string;
}

export function EmailRecipientInput({
  value,
  onChange,
  placeholder = "Komu",
  knownEmails,
  className,
  ...props
}: EmailRecipientInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Array<{ name?: string; address: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = useCallback((inputVal: string) => {
    onChange(inputVal);
    const parts = inputVal.split(",");
    const current = parts[parts.length - 1].trim().toLowerCase();
    if (current.length >= 1) {
      const uniqueEmails = Array.from(new Map(knownEmails.map(e => [e.address.toLowerCase(), e])).values());
      const filtered = uniqueEmails.filter(
        e => e.address.toLowerCase().includes(current) || (e.name && e.name.toLowerCase().includes(current))
      ).slice(0, 8);
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [onChange, knownEmails]);

  const selectSuggestion = useCallback((suggestion: { name?: string; address: string }) => {
    const parts = value.split(",").map(p => p.trim()).filter(Boolean);
    const alreadySelected = parts.slice(0, -1);
    const newParts = [...alreadySelected, suggestion.address];
    onChange(newParts.join(", ") + ", ");
    setShowSuggestions(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [value, onChange]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          const parts = value.split(",");
          const current = parts[parts.length - 1].trim().toLowerCase();
          if (current.length >= 1) {
            handleInputChange(value);
          }
        }}
        className={className}
        data-testid={props["data-testid"]}
      />
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto" data-testid="email-suggestions">
          {filteredSuggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectSuggestion(s);
              }}
              data-testid={`suggestion-${i}`}
            >
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                {(s.name || s.address).substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                {s.name && <span className="font-medium block truncate">{s.name}</span>}
                <span className="text-muted-foreground text-xs block truncate">{s.address}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
