import { useRef, useState } from "react";
import { Plus, X, RefreshCw, Upload, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InlineEdit } from "./InlineEdit";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { cryptoRandomId } from "@/types/lms-blocks";
import type { FlipCardsBlockContent, FlipCard } from "@/types/lms-blocks";

const MAX_CARDS = 4;
const ACCENT = "#FFD100";

interface Props {
  lessonId: string;
  content: FlipCardsBlockContent;
  onChange: (content: FlipCardsBlockContent) => void;
  slim?: boolean;
}

export default function FlipCardsBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const cards = content.cards ?? [];

  const setCards = (next: FlipCard[]) => onChange({ ...content, cards: next });

  const updateCard = (i: number, patch: Partial<FlipCard>) =>
    setCards(cards.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  const addCard = () => {
    if (cards.length >= MAX_CARDS) return;
    setCards([...cards, { id: cryptoRandomId(), front_text: "Recto", back_text: "Verso" }]);
  };

  const removeCard = (i: number) => {
    if (cards.length <= 1) return;
    setCards(cards.filter((_, idx) => idx !== i));
  };

  if (slim) return <SlimEditor lessonId={lessonId} cards={cards} updateCard={updateCard} addCard={addCard} removeCard={removeCard} />;

  return (
    <div className="space-y-4">
      {cards.map((card, i) => (
        <CardFormFields
          key={card.id}
          lessonId={lessonId}
          card={card}
          index={i}
          canRemove={cards.length > 1}
          onChange={(patch) => updateCard(i, patch)}
          onRemove={() => removeCard(i)}
        />
      ))}
      {cards.length < MAX_CARDS && (
        <Button variant="outline" size="sm" onClick={addCard}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter une carte
        </Button>
      )}
    </div>
  );
}

function SlimEditor({
  lessonId,
  cards,
  updateCard,
  addCard,
  removeCard,
}: {
  lessonId: string;
  cards: FlipCard[];
  updateCard: (i: number, patch: Partial<FlipCard>) => void;
  addCard: () => void;
  removeCard: (i: number) => void;
}) {
  // For each card we toggle recto/verso editing
  const [editingBack, setEditingBack] = useState<Set<number>>(new Set());

  const toggleFace = (i: number) =>
    setEditingBack((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const isBack = (i: number) => editingBack.has(i);

  return (
    <div
      style={{
        borderRadius: "var(--st-br, 20px)",
        border: "1px solid var(--st-ink-08)",
        padding: "1.25rem",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, 1fr)`,
          gap: "0.75rem",
          marginBottom: "0.875rem",
        }}
      >
        {cards.map((card, i) => (
          <SlimCard
            key={card.id}
            lessonId={lessonId}
            card={card}
            index={i}
            showBack={isBack(i)}
            canRemove={cards.length > 1}
            onToggleFace={() => toggleFace(i)}
            onChange={(patch) => updateCard(i, patch)}
            onRemove={() => removeCard(i)}
          />
        ))}
      </div>

      {cards.length < MAX_CARDS && (
        <button
          onClick={addCard}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: "0.8125rem", fontWeight: 500, color: "var(--st-ink-60)",
            border: "none", background: "transparent", cursor: "pointer",
          }}
        >
          <Plus size={14} /> Ajouter une carte
        </button>
      )}
    </div>
  );
}

function SlimCard({
  lessonId,
  card,
  index,
  showBack,
  canRemove,
  onToggleFace,
  onChange,
  onRemove,
}: {
  lessonId: string;
  card: FlipCard;
  index: number;
  showBack: boolean;
  canRemove: boolean;
  onToggleFace: () => void;
  onChange: (patch: Partial<FlipCard>) => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const imageKey = showBack ? "back_image_url" : "front_image_url";
  const textKey = showBack ? "back_text" : "front_text";
  const imageUrl = showBack ? card.back_image_url : card.front_image_url;
  const text = showBack ? card.back_text : card.front_text;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onChange({ [imageKey]: url });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 14,
        border: `2px solid ${showBack ? ACCENT : "#e5e7eb"}`,
        background: showBack ? "#fffef5" : "#ffffff",
        padding: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 120,
      }}
    >
      {/* Face label + toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--st-ink-60)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {showBack ? "Verso" : "Recto"}
        </span>
        <button
          onClick={onToggleFace}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--st-ink-60)", display: "flex", alignItems: "center" }}
          title="Basculer recto / verso"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Image area */}
      <div
        style={{
          width: "100%", height: 40, borderRadius: 6,
          background: "#f3f4f6",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "hidden",
        }}
        onClick={() => fileRef.current?.click()}
        title="Importer une image"
      >
        {uploading ? <Spinner size="sm" /> : imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Upload size={14} style={{ color: "#9ca3af" }} />
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />
      </div>

      {/* Text */}
      <InlineEdit
        value={text ?? ""}
        onChange={(v) => onChange({ [textKey]: v || null })}
        placeholder={showBack ? "Texte verso…" : "Texte recto…"}
        style={{ fontSize: "0.8125rem", color: "var(--st-ink)", outline: "none", textAlign: "center" }}
      />

      {canRemove && (
        <button
          onClick={onRemove}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", alignSelf: "center", marginTop: 2 }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function CardFormFields({
  lessonId,
  card,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  lessonId: string;
  card: FlipCard;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<FlipCard>) => void;
  onRemove: () => void;
}) {
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const frontFileRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (side: "front" | "back", file: File) => {
    const key = side === "front" ? "front_image_url" : "back_image_url";
    side === "front" ? setUploadingFront(true) : setUploadingBack(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onChange({ [key]: url });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      side === "front" ? setUploadingFront(false) : setUploadingBack(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Carte {index + 1}</span>
        {canRemove && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Front */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Recto</Label>
          <div
            className="h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer overflow-hidden hover:border-gray-400 transition-colors"
            onClick={() => frontFileRef.current?.click()}
          >
            {uploadingFront ? <Spinner size="sm" /> : card.front_image_url ? (
              <img src={card.front_image_url} alt="" className="h-full w-full object-cover" />
            ) : <Upload className="h-5 w-5 text-gray-400" />}
            <input type="file" accept="image/*" ref={frontFileRef} style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload("front", f); e.target.value = ""; }}
            />
          </div>
          <Input value={card.front_text ?? ""} onChange={(e) => onChange({ front_text: e.target.value || null })} placeholder="Texte recto" />
        </div>
        {/* Back */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Verso</Label>
          <div
            className="h-16 rounded-lg border-2 border-dashed border-yellow-200 bg-yellow-50 flex items-center justify-center cursor-pointer overflow-hidden hover:border-yellow-400 transition-colors"
            onClick={() => backFileRef.current?.click()}
          >
            {uploadingBack ? <Spinner size="sm" /> : card.back_image_url ? (
              <img src={card.back_image_url} alt="" className="h-full w-full object-cover" />
            ) : <Upload className="h-5 w-5 text-yellow-400" />}
            <input type="file" accept="image/*" ref={backFileRef} style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload("back", f); e.target.value = ""; }}
            />
          </div>
          <Input value={card.back_text ?? ""} onChange={(e) => onChange({ back_text: e.target.value || null })} placeholder="Texte verso" />
        </div>
      </div>
    </div>
  );
}
