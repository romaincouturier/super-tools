import { useRef, useState, type ElementType } from "react";
import { Image as ImageIcon, Video, Paperclip, BarChart3, X, Plus } from "lucide-react";
import EmojiInsert from "@/components/ui/emoji-insert";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import type { NewPoll } from "@/hooks/usePracticeFeed";

const PLACEHOLDER = "Partagez votre travail, posez une question, inspirez la communauté.";

function getInitials(firstName: string, lastName: string, email: string) {
  const i = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return i || email.slice(0, 2).toUpperCase();
}

export default function PostComposer({
  email,
  firstName,
  lastName,
  photoUrl,
  onCreate,
}: {
  email: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  onCreate: (content: string, file: File | null, poll: NewPoll | null) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pollOptions, setPollOptions] = useState<string[] | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const initials = getInitials(firstName, lastName, email);

  const reset = () => {
    setContent("");
    setFile(null);
    setPreview(null);
    setPollOptions(null);
    setExpanded(false);
  };

  const openPicker = (accept: string) => {
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.click();
    }
  };

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const pollValid = !pollOptions || pollOptions.map((o) => o.trim()).filter(Boolean).length >= 2;
  const canPublish = (content.trim() !== "" || file !== null || (pollOptions !== null && pollValid)) && pollValid;

  const handlePublish = async () => {
    if (!canPublish) return;
    setPosting(true);
    try {
      const poll = pollOptions && pollOptions.map((o) => o.trim()).filter(Boolean).length >= 2
        ? { options: pollOptions }
        : null;
      await onCreate(content, file, poll);
      reset();
    } catch {
      toastError(toast, "Impossible de publier.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: photoUrl ? "transparent" : "var(--st-yellow)", color: "#101820" }}>
          {photoUrl ? <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" /> : initials}
        </div>

        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="flex-1 text-left rounded-full border px-4 py-2.5 text-sm transition-colors hover:bg-black/5"
            style={{ borderColor: "rgba(16,24,32,0.12)", color: "var(--st-ink-muted)", fontFamily: "inherit" }}
          >
            {PLACEHOLDER}
          </button>
        ) : (
          <div className="flex-1 min-w-0 space-y-3">
            <div className="relative">
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={4}
                className="w-full resize-none rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none"
                style={{ borderColor: "rgba(16,24,32,0.12)", background: "transparent", color: "var(--st-ink)", fontFamily: "inherit" }}
              />
              <div className="absolute bottom-2 right-2">
                <EmojiInsert onInsert={(e) => setContent((t) => t + e)} />
              </div>
            </div>

            {/* Attachment preview */}
            {file && (
              <div className="relative rounded-xl border p-2" style={{ borderColor: "rgba(16,24,32,0.12)" }}>
                {preview ? (
                  <img src={preview} alt="Aperçu" className="w-full rounded-lg object-cover" style={{ maxHeight: 240 }} />
                ) : (
                  <div className="flex items-center gap-2 text-sm px-1 py-2" style={{ color: "var(--st-ink)" }}>
                    <Paperclip size={16} /> {file.name}
                  </div>
                )}
                <button
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(16,24,32,0.6)", color: "#fff" }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Poll editor */}
            {pollOptions !== null && (
              <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "rgba(16,24,32,0.12)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: "var(--st-ink)" }}>Sondage</span>
                  <button onClick={() => setPollOptions(null)} className="text-xs hover:underline" style={{ color: "var(--st-ink-muted)" }}>
                    Retirer
                  </button>
                </div>
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => setPollOptions((prev) => prev!.map((o, idx) => (idx === i ? e.target.value : o)))}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 text-sm rounded-lg border px-3 py-1.5 outline-none"
                      style={{ borderColor: "rgba(16,24,32,0.12)", background: "transparent", color: "var(--st-ink)", fontFamily: "inherit" }}
                    />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions((prev) => prev!.filter((_, idx) => idx !== i))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5" style={{ color: "var(--st-ink-muted)" }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 5 && (
                  <button onClick={() => setPollOptions((prev) => [...prev!, ""])}
                    className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg hover:bg-black/5" style={{ color: "var(--st-ink-muted)" }}>
                    <Plus size={14} /> Ajouter une option
                  </button>
                )}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-1 flex-wrap">
              <ToolbarButton icon={ImageIcon} label="Photo" onClick={() => openPicker("image/*")} />
              <ToolbarButton icon={Video} label="Vidéo" onClick={() => openPicker("video/*")} />
              <ToolbarButton icon={Paperclip} label="Fichier" onClick={() => openPicker("*/*")} />
              <ToolbarButton
                icon={BarChart3}
                label="Sondage"
                active={pollOptions !== null}
                onClick={() => setPollOptions((prev) => (prev === null ? ["", ""] : prev))}
              />
              <div className="ml-auto flex items-center gap-2">
                <button onClick={reset} className="text-sm px-3 py-1.5 rounded-lg hover:bg-black/5" style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}>
                  Annuler
                </button>
                <button
                  onClick={handlePublish}
                  disabled={!canPublish || posting}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all hover:-translate-y-px disabled:opacity-50"
                  style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
                >
                  {posting ? "Publication..." : "Publier"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, onClick, active }: {
  icon: ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors hover:bg-black/5"
      style={{ color: active ? "#101820" : "var(--st-ink-muted)", background: active ? "rgba(255,209,0,0.2)" : "transparent", fontFamily: "inherit" }}
    >
      <Icon size={16} /> {label}
    </button>
  );
}
