"use client";

import { useRef, useEffect, useCallback } from "react";
import styles from "./RichTextEditor.module.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Track whether the last change was from user (avoid infinite loop with useEffect)
  const isProgrammaticUpdate = useRef(false);

  // Inject initial value once on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync if parent resets value externally (e.g. form reset)
  useEffect(() => {
    if (!editorRef.current) return;
    if (isProgrammaticUpdate.current) {
      isProgrammaticUpdate.current = false;
      return;
    }
    // Only update DOM if it actually differs to avoid cursor reset
    if (editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val ?? undefined);
    // Fire onChange after execCommand
    isProgrammaticUpdate.current = true;
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const handleInput = useCallback(() => {
    isProgrammaticUpdate.current = true;
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "b": e.preventDefault(); exec("bold"); break;
        case "i": e.preventDefault(); exec("italic"); break;
        case "u": e.preventDefault(); exec("underline"); break;
      }
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <button type="button" className={styles.toolBtn} title="Bold (Ctrl+B)" onClick={() => exec("bold")}>
          <b>B</b>
        </button>
        <button type="button" className={styles.toolBtn} title="Italic (Ctrl+I)" onClick={() => exec("italic")}>
          <i>I</i>
        </button>
        <button type="button" className={styles.toolBtn} title="Underline (Ctrl+U)" onClick={() => exec("underline")}>
          <u>U</u>
        </button>
        <button type="button" className={styles.toolBtn} title="Strikethrough" onClick={() => exec("strikeThrough")}>
          <s>S</s>
        </button>

        <div className={styles.divider} />

        <button type="button" className={styles.toolBtn} title="Heading" onClick={() => exec("formatBlock", "<h3>")}>
          H
        </button>
        <button type="button" className={styles.toolBtn} title="Normal text" onClick={() => exec("formatBlock", "<p>")}>
          ¶
        </button>

        <div className={styles.divider} />

        <button type="button" className={styles.toolBtn} title="Numbered list" onClick={() => exec("insertOrderedList")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/>
            <line x1="10" y1="18" x2="21" y2="18"/>
            <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1.</text>
            <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">2.</text>
            <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">3.</text>
          </svg>
        </button>
        <button type="button" className={styles.toolBtn} title="Bullet list" onClick={() => exec("insertUnorderedList")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/>
            <line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </button>

        <div className={styles.divider} />

        <button type="button" className={styles.toolBtn} title="Align left" onClick={() => exec("justifyLeft")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
          </svg>
        </button>

        <div className={styles.divider} />

        <button type="button" className={styles.toolBtn} title="Hapus format" onClick={() => exec("removeFormat")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l4 4-9 9H3v-4l9-9z"/><line x1="19" y1="19" x2="21" y2="21"/>
          </svg>
        </button>
      </div>

      {/* ── Editing area ── */}
      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder || "Tulis deskripsi pertanyaan..."}
      />
    </div>
  );
}
