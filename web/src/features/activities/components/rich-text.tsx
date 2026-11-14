"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Underline, type LucideIcon } from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  labelledBy: string;
}

/** Notes editor: bold, italic, underline and lists, matching what the API's sanitizer keeps. */
export function RichText({ value, onChange, labelledBy }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { "aria-labelledby": labelledBy, "aria-multiline": "true", role: "textbox" } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      underline: e?.isActive("underline") ?? false,
      bulletList: e?.isActive("bulletList") ?? false,
      orderedList: e?.isActive("orderedList") ?? false,
    }),
  });

  const tools: { key: keyof NonNullable<typeof active>; label: string; icon: LucideIcon; run: () => void }[] = [
    { key: "bold", label: "Bold", icon: Bold, run: () => editor?.chain().focus().toggleBold().run() },
    { key: "italic", label: "Italic", icon: Italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { key: "underline", label: "Underline", icon: Underline, run: () => editor?.chain().focus().toggleUnderline().run() },
    { key: "bulletList", label: "Bulleted list", icon: List, run: () => editor?.chain().focus().toggleBulletList().run() },
    { key: "orderedList", label: "Numbered list", icon: ListOrdered, run: () => editor?.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div className="rich-text border-2 border-ink bg-surface focus-within:border-primary">
      <div role="toolbar" aria-label="Formatting" className="flex gap-0.5 border-b-2 border-line p-1">
        {tools.map(({ key, label, icon: Icon, run }) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={active?.[key] ?? false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            className="flex h-[30px] w-8 items-center justify-center hover:bg-surface-hover aria-pressed:bg-raised"
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
