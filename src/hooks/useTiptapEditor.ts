import { useCallback, useEffect, useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import type { AnyExtension } from "@tiptap/core";

interface UseTiptapEditorOptions {
  content: string;
  onChange: (html: string) => void;
  extraExtensions?: AnyExtension[];
  editorProps?: Record<string, unknown>;
  onFocus?: (props: { editor: Editor }) => void;
}

/**
 * Shared Tiptap editor setup used by RichTextEditor and CrmDescriptionEditor.
 * Provides the common StarterKit + Link + Underline extensions and the setLink callback.
 */
export function useTiptapEditor({
  content,
  onChange,
  extraExtensions = [],
  editorProps,
  onFocus,
}: UseTiptapEditorOptions) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Underline,
      ...extraExtensions,
    ],
    content,
    editorProps: editorProps as any,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus,
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL du lien:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return { editor, setLink };
}
