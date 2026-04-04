"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-pm-muted hover:text-pm-text hover:bg-pm-surface"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-blue-400 underline" },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Start writing...",
      }),
      // Table support — preserves AI-generated pricing tables and scope tables
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm prose-invert max-w-none focus:outline-none min-h-[200px] px-3 py-2 text-pm-text",
      },
    },
  });

  // Sync external value changes without losing cursor if the HTML is functionally the same
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className={`border border-pm-border rounded-lg overflow-hidden bg-pm-bg ${className ?? ""}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-pm-border bg-pm-card">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <span className="line-through">S</span>
        </ToolbarButton>

        <span className="w-px h-5 bg-pm-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          H2
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          H3
        </ToolbarButton>

        <span className="w-px h-5 bg-pm-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
          • List
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
          1. List
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          &ldquo; Quote
        </ToolbarButton>

        <span className="w-px h-5 bg-pm-border mx-1" />

        {/* Table controls */}
        <ToolbarButton onClick={insertTable} active={false} title="Insert Table">
          ⊞ Table
        </ToolbarButton>
        {editor.isActive("table") && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} active={false} title="Add Column">
              +Col
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} active={false} title="Add Row">
              +Row
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} active={false} title="Delete Column">
              -Col
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} active={false} title="Delete Row">
              -Row
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} active={false} title="Delete Table">
              ✕Tbl
            </ToolbarButton>
          </>
        )}

        <span className="w-px h-5 bg-pm-border mx-1" />

        <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="Add Link">
          Link
        </ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
            Unlink
          </ToolbarButton>
        )}

        <span className="w-px h-5 bg-pm-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          ―
        </ToolbarButton>
      </div>

      {/* Editor area — table styles scoped here */}
      <style>{`
        .tiptap table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .tiptap table th, .tiptap table td { border: 1px solid #334155; padding: 8px 12px; text-align: left; font-size: 13px; }
        .tiptap table th { background: #1e293b; font-weight: 600; color: #94a3b8; }
        .tiptap table tr:nth-child(even) td { background: #0f172a40; }
        .tiptap table .selectedCell { background: #2563eb30; }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  );
}
