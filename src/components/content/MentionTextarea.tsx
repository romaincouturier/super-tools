import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Profile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

export interface MentionUser {
  userId: string;
  email: string;
  displayName: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: MentionUser[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  onPaste?: (e: React.ClipboardEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const getDisplayName = (profile: Profile) => {
  if (profile.first_name && profile.last_name) {
    return `${profile.first_name} ${profile.last_name}`;
  }
  if (profile.display_name) return profile.display_name;
  return profile.email;
};

const MentionTextarea = ({
  value,
  onChange,
  onMentionsChange,
  placeholder,
  rows = 2,
  className,
  onPaste,
  onKeyDown,
}: MentionTextareaProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name, display_name")
        .order("first_name");
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  // Sync mentions: remove ones that are no longer in text
  useEffect(() => {
    const stillPresent = mentions.filter((m) =>
      value.includes(`@${m.displayName}`)
    );
    if (stillPresent.length !== mentions.length) {
      setMentions(stillPresent);
      onMentionsChange?.(stillPresent);
    }
  }, [value]);

  const filteredProfiles = profiles
    .filter((p) => {
      if (!mentionQuery) return true;
      const name = getDisplayName(p).toLowerCase();
      const email = p.email.toLowerCase();
      const query = mentionQuery.toLowerCase();
      return name.includes(query) || email.includes(query);
    })
    .slice(0, 6);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);

    // Detect @ mention: look backwards from cursor to find @
    const textBefore = newValue.slice(0, cursorPos);
    const atIndex = textBefore.lastIndexOf("@");

    if (atIndex >= 0) {
      const charBefore = atIndex > 0 ? textBefore[atIndex - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || atIndex === 0) {
        const query = textBefore.slice(atIndex + 1);
        if (query.length <= 30 && !query.includes("\n")) {
          setMentionQuery(query);
          setMentionStartIndex(atIndex);
          setShowDropdown(true);
          setSelectedIndex(0);
          return;
        }
      }
    }

    setShowDropdown(false);
  };

  const insertMention = useCallback(
    (profile: Profile) => {
      const textarea = textareaRef.current;
      if (!textarea || mentionStartIndex < 0) return;

      const displayName = getDisplayName(profile);
      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(mentionStartIndex + 1 + mentionQuery.length);
      const newValue = `${before}@${displayName} ${after}`;

      onChange(newValue);
      setShowDropdown(false);

      // Track mention (avoid duplicates)
      const newMention: MentionUser = {
        userId: profile.user_id,
        email: profile.email,
        displayName,
      };
      const updated = mentions.some((m) => m.userId === profile.user_id)
        ? mentions
        : [...mentions, newMention];
      setMentions(updated);
      onMentionsChange?.(updated);

      // Restore cursor position after the inserted mention
      requestAnimationFrame(() => {
        const newPos = mentionStartIndex + displayName.length + 2;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    },
    [value, mentionStartIndex, mentionQuery, mentions, onChange, onMentionsChange]
  );

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredProfiles.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredProfiles.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + filteredProfiles.length) % filteredProfiles.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredProfiles[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    onKeyDown?.(e);
  };

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onPaste={onPaste}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder}
        rows={rows}
        className={cn("resize-none", className)}
      />

      {showDropdown && filteredProfiles.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-72 bg-popover border border-border rounded-md shadow-lg z-50 overflow-hidden"
        >
          {filteredProfiles.map((profile, index) => (
            <button
              key={profile.user_id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex flex-col",
                index === selectedIndex && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(profile);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="font-medium">{getDisplayName(profile)}</span>
              <span className="text-xs text-muted-foreground">
                {profile.email}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;
