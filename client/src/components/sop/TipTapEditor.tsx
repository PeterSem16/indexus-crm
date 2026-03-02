import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Extension } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Minus, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Unlink, ImageIcon, Table as TableIcon,
  Paintbrush, Highlighter, Type,
  TableProperties, RowsIcon, Columns3, Trash2,
  Subscript as SubIcon, Superscript as SupIcon, Code2, Pilcrow,
  Plus, Minus as MinusIcon,
  RemoveFormatting, AArrowUp, AArrowDown, CaseSensitive,
  Search, Replace, ReplaceAll, X, ChevronDown, ChevronUp, CaseLower
} from "lucide-react";

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
  { label: "64", value: "64px" },
];

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#B7B7B7", "#CCCCCC", "#D9D9D9", "#EFEFEF", "#F3F3F3", "#FFFFFF",
  "#980000", "#FF0000", "#FF9900", "#FFFF00", "#00FF00", "#00FFFF", "#4A86E8", "#0000FF", "#9900FF", "#FF00FF",
  "#E6B8AF", "#F4CCCC", "#FCE5CD", "#FFF2CC", "#D9EAD3", "#D0E0E3", "#C9DAF8", "#CFE2F3", "#D9D2E9", "#EAD1DC",
  "#DD7E6B", "#EA9999", "#F9CB9C", "#FFE599", "#B6D7A8", "#A2C4C9", "#A4C2F4", "#9FC5E8", "#B4A7D6", "#D5A6BD",
  "#CC4125", "#E06666", "#F6B26B", "#FFD966", "#93C47D", "#76A5AF", "#6D9EEB", "#6FA8DC", "#8E7CC3", "#C27BA0",
];

function ToolbarButton({ onClick, active, disabled, children, title }: {
  onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded text-xs transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80",
        disabled && "opacity-40 cursor-not-allowed"
      )}
      data-testid={`editor-btn-${title?.toLowerCase().replace(/\s+/g, '-') || 'action'}`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5" />;
}

export default function TipTapEditor({ content, onChange, placeholder, className }: TipTapEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [findResults, setFindResults] = useState<{ count: number; current: number }>({ count: 0, current: 0 });
  const findInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline cursor-pointer" } }),
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder || "Start writing..." }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      contentRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: "tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-full px-5 py-4",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== contentRef.current) {
      contentRef.current = content;
      editor.commands.setContent(content || "", false);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    setLinkUrl("");
  }, [editor, linkUrl]);

  const insertImage = useCallback(() => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl("");
  }, [editor, imageUrl]);

  const getTextContent = useCallback(() => {
    if (!editor) return "";
    const div = document.createElement("div");
    div.innerHTML = editor.getHTML();
    return div.textContent || div.innerText || "";
  }, [editor]);

  const findMatches = useCallback((searchStr: string) => {
    if (!searchStr || !editor) return [];
    const text = getTextContent();
    const flags = matchCase ? "g" : "gi";
    const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, flags);
    const matches: number[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match.index);
    }
    return matches;
  }, [editor, matchCase, getTextContent]);

  const updateFindResults = useCallback((searchStr: string) => {
    const matches = findMatches(searchStr);
    setFindResults({ count: matches.length, current: matches.length > 0 ? 1 : 0 });
  }, [findMatches]);

  useEffect(() => {
    if (showFindReplace && findText.length >= 1) {
      updateFindResults(findText);
    } else {
      setFindResults({ count: 0, current: 0 });
    }
  }, [findText, matchCase, showFindReplace, content]);

  const handleFindReplace = useCallback((replaceOne: boolean) => {
    if (!editor || !findText) return;
    const html = editor.getHTML();
    const flags = matchCase ? "" : "i";
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, replaceOne ? flags : "g" + flags);
    const newHtml = html.replace(regex, replaceText);
    if (newHtml !== html) {
      editor.commands.setContent(newHtml, true);
      contentRef.current = newHtml;
      onChange(newHtml);
      updateFindResults(findText);
    }
  }, [editor, findText, replaceText, matchCase, onChange, updateFindResults]);

  const toggleFindReplace = useCallback(() => {
    setShowFindReplace(prev => {
      if (!prev) {
        setTimeout(() => findInputRef.current?.focus(), 100);
      }
      return !prev;
    });
  }, []);

  if (!editor) return null;

  const currentFontSize = editor.getAttributes("textStyle").fontSize || "";
  const currentFontSizeLabel = FONT_SIZES.find(s => s.value === currentFontSize)?.label || currentFontSize.replace("px", "") || "—";

  return (
    <div className={cn("flex flex-col border rounded-lg overflow-hidden bg-background", className)} data-testid="tiptap-editor">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 shrink-0">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="h-7 px-2 flex items-center gap-1 rounded text-xs hover:bg-muted text-foreground/80" title="Paragraph format" data-testid="editor-btn-paragraph-format">
              <Pilcrow className="h-3.5 w-3.5" />
              <span className="text-[10px]">
                {editor.isActive("heading", { level: 1 }) ? "H1"
                  : editor.isActive("heading", { level: 2 }) ? "H2"
                  : editor.isActive("heading", { level: 3 }) ? "H3"
                  : editor.isActive("heading", { level: 4 }) ? "H4"
                  : editor.isActive("heading", { level: 5 }) ? "H5"
                  : editor.isActive("heading", { level: 6 }) ? "H6"
                  : "¶"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="start">
            <button type="button" className={cn("w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted", !editor.isActive("heading") && "bg-muted/50")} onClick={() => editor.chain().focus().setParagraph().run()}>
              Paragraph
            </button>
            <button type="button" className={cn("w-full text-left px-2 py-1.5 rounded text-xl font-bold hover:bg-muted", editor.isActive("heading", { level: 1 }) && "bg-muted/50")} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              Heading 1
            </button>
            <button type="button" className={cn("w-full text-left px-2 py-1.5 rounded text-lg font-bold hover:bg-muted", editor.isActive("heading", { level: 2 }) && "bg-muted/50")} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              Heading 2
            </button>
            <button type="button" className={cn("w-full text-left px-2 py-1.5 rounded text-base font-semibold hover:bg-muted", editor.isActive("heading", { level: 3 }) && "bg-muted/50")} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              Heading 3
            </button>
            <button type="button" className={cn("w-full text-left px-2 py-1.5 rounded text-sm font-semibold hover:bg-muted", editor.isActive("heading", { level: 4 }) && "bg-muted/50")} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
              Heading 4
            </button>
            <button type="button" className={cn("w-full text-left px-2 py-1.5 rounded text-xs font-semibold hover:bg-muted", editor.isActive("heading", { level: 5 }) && "bg-muted/50")} onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}>
              Heading 5
            </button>
            <button type="button" className={cn("w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold uppercase hover:bg-muted", editor.isActive("heading", { level: 6 }) && "bg-muted/50")} onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}>
              Heading 6
            </button>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="h-7 px-2 flex items-center gap-1 rounded text-xs hover:bg-muted text-foreground/80" title="Font size" data-testid="editor-btn-font-size">
              <CaseSensitive className="h-3.5 w-3.5" />
              <span className="text-[10px] min-w-[14px] text-center">{currentFontSizeLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1 max-h-60 overflow-y-auto" align="start">
            <button type="button" className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-muted", !currentFontSize && "bg-muted/50")} onClick={() => editor.chain().focus().unsetFontSize().run()}>
              Default
            </button>
            {FONT_SIZES.map(size => (
              <button
                key={size.value}
                type="button"
                className={cn("w-full text-left px-2 py-1 rounded hover:bg-muted flex items-center justify-between", currentFontSize === size.value && "bg-muted/50")}
                onClick={() => editor.chain().focus().setFontSize(size.value).run()}
              >
                <span style={{ fontSize: Math.min(parseInt(size.label), 20) + "px" }}>{size.label}</span>
                <span className="text-[10px] text-muted-foreground">{size.value}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="Subscript">
          <SubIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="Superscript">
          <SupIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted" title="Text color" data-testid="editor-btn-text-color">
              <div className="flex flex-col items-center">
                <Type className="h-3 w-3 text-foreground/80" />
                <div className="h-0.5 w-3.5 rounded-full mt-px" style={{ backgroundColor: editor.getAttributes("textStyle").color || "#000" }} />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="grid grid-cols-10 gap-0.5">
              {COLORS.map(color => (
                <button key={color} type="button" className="h-5 w-5 rounded border border-border/50 hover:scale-125 transition-transform" style={{ backgroundColor: color }}
                  onClick={() => { editor.chain().focus().setColor(color).run(); }} />
              ))}
            </div>
            <button type="button" className="mt-2 text-xs text-muted-foreground hover:text-foreground w-full text-left" onClick={() => editor.chain().focus().unsetColor().run()}>
              Reset color
            </button>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn("h-7 w-7 flex items-center justify-center rounded hover:bg-muted", editor.isActive("highlight") && "bg-primary text-primary-foreground")} title="Highlight" data-testid="editor-btn-highlight">
              <Highlighter className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="grid grid-cols-10 gap-0.5">
              {COLORS.slice(20).map(color => (
                <button key={color} type="button" className="h-5 w-5 rounded border border-border/50 hover:scale-125 transition-transform" style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().toggleHighlight({ color }).run()} />
              ))}
            </div>
            <button type="button" className="mt-2 text-xs text-muted-foreground hover:text-foreground w-full text-left" onClick={() => editor.chain().focus().unsetHighlight().run()}>
              Remove highlight
            </button>
          </PopoverContent>
        </Popover>

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify">
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Task list">
          <CheckSquare className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().sinkListItem("listItem").run()} disabled={!editor.can().sinkListItem("listItem")} title="Indent">
          <span className="text-[10px] font-mono">→</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().liftListItem("listItem").run()} disabled={!editor.can().liftListItem("listItem")} title="Outdent">
          <span className="text-[10px] font-mono">←</span>
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
          <Code2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn("h-7 w-7 flex items-center justify-center rounded hover:bg-muted", editor.isActive("link") && "bg-primary text-primary-foreground")} title="Link" data-testid="editor-btn-link">
              <LinkIcon className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-2">
              <Input placeholder="https://example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-8 text-xs" onKeyDown={(e) => e.key === "Enter" && setLink()} data-testid="input-link-url" />
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={setLink}>Insert link</Button>
                {editor.isActive("link") && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => editor.chain().focus().unsetLink().run()}>
                    <Unlink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted" title="Insert image" data-testid="editor-btn-image">
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-2">
              <Input placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="h-8 text-xs" onKeyDown={(e) => e.key === "Enter" && insertImage()} data-testid="input-image-url" />
              <Button size="sm" className="h-7 text-xs w-full" onClick={insertImage}>Insert image</Button>
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarDivider />

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn("h-7 w-7 flex items-center justify-center rounded hover:bg-muted", editor.isActive("table") && "bg-primary text-primary-foreground")} title="Table" data-testid="editor-btn-table">
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <div className="space-y-0.5">
              <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <Plus className="h-3 w-3" /> Insert table (3×3)
              </button>
              {editor.isActive("table") && (
                <>
                  <Separator />
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().addColumnBefore().run()}>
                    <Columns3 className="h-3 w-3" /> Add column before
                  </button>
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                    <Columns3 className="h-3 w-3" /> Add column after
                  </button>
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().deleteColumn().run()}>
                    <Columns3 className="h-3 w-3 text-destructive" /> Delete column
                  </button>
                  <Separator />
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().addRowBefore().run()}>
                    <RowsIcon className="h-3 w-3" /> Add row before
                  </button>
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().addRowAfter().run()}>
                    <RowsIcon className="h-3 w-3" /> Add row after
                  </button>
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().deleteRow().run()}>
                    <RowsIcon className="h-3 w-3 text-destructive" /> Delete row
                  </button>
                  <Separator />
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
                    <TableProperties className="h-3 w-3" /> Toggle header row
                  </button>
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().mergeCells().run()}>
                    <TableProperties className="h-3 w-3" /> Merge cells
                  </button>
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2" onClick={() => editor.chain().focus().splitCell().run()}>
                    <TableProperties className="h-3 w-3" /> Split cell
                  </button>
                  <Separator />
                  <button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2 text-destructive" onClick={() => editor.chain().focus().deleteTable().run()}>
                    <Trash2 className="h-3 w-3" /> Delete table
                  </button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting">
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={toggleFindReplace} active={showFindReplace} title="Find & Replace">
          <Search className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {showFindReplace && (
        <div className="px-3 py-2 border-b bg-muted/20 shrink-0 space-y-2" data-testid="find-replace-panel">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                ref={findInputRef}
                placeholder="Find..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="h-7 text-xs pl-7 pr-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    updateFindResults(findText);
                  }
                  if (e.key === "Escape") {
                    setShowFindReplace(false);
                  }
                }}
                data-testid="input-find-text"
              />
            </div>
            <button
              type="button"
              onClick={() => setMatchCase(!matchCase)}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded text-xs transition-colors shrink-0",
                matchCase ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80 border"
              )}
              title="Match case"
              data-testid="btn-match-case"
            >
              <CaseSensitive className="h-3.5 w-3.5" />
            </button>
            {findText && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                {findResults.count > 0 ? `${findResults.current}/${findResults.count}` : "0"}
              </span>
            )}
            <button
              type="button"
              onClick={() => { setShowFindReplace(false); setFindText(""); setReplaceText(""); }}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground shrink-0"
              title="Close"
              data-testid="btn-close-find"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Replace className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="h-7 text-xs pl-7 pr-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFindReplace(true);
                  }
                  if (e.key === "Escape") {
                    setShowFindReplace(false);
                  }
                }}
                data-testid="input-replace-text"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-2 gap-1 shrink-0"
              onClick={() => handleFindReplace(true)}
              disabled={!findText || findResults.count === 0}
              data-testid="btn-replace-one"
            >
              Replace
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-2 gap-1 shrink-0"
              onClick={() => handleFindReplace(false)}
              disabled={!findText || findResults.count === 0}
              data-testid="btn-replace-all"
            >
              All
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" data-testid="tiptap-editor-content">
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  );
}
