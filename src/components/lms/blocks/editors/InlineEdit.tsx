import { useEffect, useRef } from "react";

interface InlineEditProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tag?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
  className?: string;
  onEnter?: () => void;
  onEmptyBackspace?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  multiline?: boolean;
}

export function InlineEdit({
  value,
  onChange,
  placeholder,
  tag = "div",
  style,
  className,
  onEnter,
  onEmptyBackspace,
  onFocus,
  onBlur,
  multiline = false,
}: InlineEditProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== (value || "")) el.innerText = value || "";
  }, [value]);

  const Tag = tag as React.ElementType;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      style={style}
      className={className}
      onFocus={onFocus}
      onBlur={onBlur}
      onInput={(e: React.FormEvent<HTMLElement>) => onChange(e.currentTarget.innerText)}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" && !multiline) {
          if (onEnter) { e.preventDefault(); onEnter(); }
          else e.preventDefault();
        }
        if (
          e.key === "Backspace" &&
          onEmptyBackspace &&
          !ref.current?.innerText
        ) {
          e.preventDefault();
          onEmptyBackspace();
        }
      }}
    />
  );
}
