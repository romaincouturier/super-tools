import { useRef, useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, Upload, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InlineEdit } from "./InlineEdit";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { cryptoRandomId } from "@/types/lms-blocks";
import type { TimelineBlockContent, TimelineStep, TimelineDetailItem } from "@/types/lms-blocks";

const MAX_STEPS = 5;
const ACCENT = "#FFD100";

interface Props {
  lessonId: string;
  content: TimelineBlockContent;
  onChange: (content: TimelineBlockContent) => void;
  slim?: boolean;
}

export default function TimelineBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const steps = content.steps ?? [];

  const setSteps = (next: TimelineStep[]) => onChange({ ...content, steps: next });

  const updateStep = (i: number, patch: Partial<TimelineStep>) => {
    const next = steps.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    setSteps(next);
  };

  const addStep = () => {
    if (steps.length >= MAX_STEPS) return;
    setSteps([...steps, { id: cryptoRandomId(), title: `Étape ${steps.length + 1}`, description: "", panel_title: "Exemples d'usages", panel_items: [] }]);
  };

  const removeStep = (i: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, idx) => idx !== i));
  };

  if (slim) return <SlimEditor lessonId={lessonId} steps={steps} updateStep={updateStep} addStep={addStep} removeStep={removeStep} />;

  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <StepFormFields
          key={step.id}
          lessonId={lessonId}
          step={step}
          index={i}
          canRemove={steps.length > 1}
          onChange={(patch) => updateStep(i, patch)}
          onRemove={() => removeStep(i)}
        />
      ))}
      {steps.length < MAX_STEPS && (
        <Button variant="outline" size="sm" onClick={addStep}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter une étape
        </Button>
      )}
    </div>
  );
}

function SlimEditor({
  lessonId,
  steps,
  updateStep,
  addStep,
  removeStep,
}: {
  lessonId: string;
  steps: TimelineStep[];
  updateStep: (i: number, patch: Partial<TimelineStep>) => void;
  addStep: () => void;
  removeStep: (i: number) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  const handleImageUpload = async (i: number, file: File) => {
    setUploadingIdx(i);
    try {
      const url = await uploadLmsImage(file, lessonId);
      updateStep(i, { icon_url: url });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploadingIdx(null);
    }
  };

  return (
    <div
      style={{
        borderRadius: "var(--st-br, 20px)",
        border: "1px solid var(--st-ink-08)",
        padding: "1.25rem",
      }}
    >
      {/* Numbers row */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
        {steps.map((step, i) => (
          <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            {i > 0 && <div style={{ flex: 1, height: 0, borderTop: "2px dotted #d1d5db" }} />}
            <div
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: ACCENT, color: "#101820",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: "0.8125rem", flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 0, borderTop: "2px dotted #d1d5db" }} />}
          </div>
        ))}
      </div>

      {/* Step cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(steps.length, 5)}, 1fr)`,
          gap: "0.75rem",
        }}
      >
        {steps.map((step, i) => (
          <div
            key={step.id}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              textAlign: "center", borderRadius: 16, border: "2px solid #e5e7eb",
              background: "#ffffff", padding: "0.875rem 0.625rem",
            }}
          >
            {/* Image area */}
            <div
              style={{
                width: 48, height: 48, borderRadius: 8,
                background: "#f3f4f6", marginBottom: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", overflow: "hidden", flexShrink: 0,
              }}
              onClick={() => fileRefs.current[i]?.click()}
              title="Cliquer pour importer une image"
            >
              {uploadingIdx === i ? (
                <Spinner size="sm" />
              ) : step.icon_url ? (
                <img src={step.icon_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <Upload size={18} style={{ color: "#9ca3af" }} />
              )}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                ref={(el) => { fileRefs.current[i] = el; }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(i, f);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Title */}
            <InlineEdit
              value={step.title}
              onChange={(v) => updateStep(i, { title: v })}
              placeholder="Titre de l'étape"
              style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--st-ink)", outline: "none", textAlign: "center", width: "100%" }}
            />

            {/* Description */}
            <InlineEdit
              value={step.description ?? ""}
              onChange={(v) => updateStep(i, { description: v || null })}
              placeholder="Description courte…"
              style={{ fontSize: "0.75rem", color: "var(--st-ink-60)", outline: "none", marginTop: 4, textAlign: "center", width: "100%" }}
            />

            {/* Panel toggle */}
            <button
              style={{
                marginTop: 8, width: 26, height: 26, borderRadius: "50%",
                background: openIdx === i ? ACCENT : "#f3f4f6",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              title="Éditer l'encart"
            >
              {openIdx === i ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Remove step */}
            {steps.length > 1 && (
              <button
                onClick={() => removeStep(i)}
                style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 11 }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Open step panel editor */}
      {openIdx !== null && openIdx < steps.length && (
        <PanelEditor
          lessonId={lessonId}
          step={steps[openIdx]}
          onChange={(patch) => updateStep(openIdx, patch)}
          accent={ACCENT}
        />
      )}

      {/* Add step */}
      {steps.length < MAX_STEPS && (
        <button
          onClick={addStep}
          style={{
            marginTop: "1rem", display: "flex", alignItems: "center", gap: 6,
            fontSize: "0.8125rem", fontWeight: 500, color: "var(--st-ink-60)",
            border: "none", background: "transparent", cursor: "pointer",
          }}
        >
          <Plus size={14} /> Ajouter une étape
        </button>
      )}
    </div>
  );
}

function PanelEditor({
  lessonId,
  step,
  onChange,
  accent,
}: {
  lessonId: string;
  step: TimelineStep;
  onChange: (patch: Partial<TimelineStep>) => void;
  accent: string;
}) {
  const items = step.panel_items ?? [];
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  const setItems = (next: TimelineDetailItem[]) => onChange({ panel_items: next });

  const updateItem = (i: number, patch: Partial<TimelineDetailItem>) =>
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const addItem = () => setItems([...items, { id: cryptoRandomId(), label: "" }]);

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const handleIconUpload = async (i: number, file: File) => {
    setUploadingIdx(i);
    try {
      const url = await uploadLmsImage(file, lessonId);
      updateItem(i, { icon_url: url });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploadingIdx(null);
    }
  };

  return (
    <div
      style={{
        marginTop: 8, borderRadius: 12, border: `2px solid ${accent}`,
        background: "#fffef5", padding: "0.875rem",
      }}
    >
      {/* Panel title */}
      <InlineEdit
        value={step.panel_title ?? ""}
        onChange={(v) => onChange({ panel_title: v || null })}
        placeholder="Titre de l'encart (ex: Exemples d'usages)"
        style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--st-ink)", outline: "none", marginBottom: 8, display: "block" }}
      />

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Icon upload */}
            <div
              style={{
                width: 24, height: 24, borderRadius: 4, background: "#f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", overflow: "hidden", flexShrink: 0,
              }}
              onClick={() => fileRefs.current[i]?.click()}
              title="Icône"
            >
              {uploadingIdx === i ? (
                <Spinner size="sm" />
              ) : item.icon_url ? (
                <img src={item.icon_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <Upload size={10} style={{ color: "#9ca3af" }} />
              )}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                ref={(el) => { fileRefs.current[i] = el; }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleIconUpload(i, f);
                  e.target.value = "";
                }}
              />
            </div>

            <InlineEdit
              value={item.label}
              onChange={(v) => updateItem(i, { label: v })}
              placeholder="Texte de l'élément…"
              style={{ flex: 1, fontSize: "0.8125rem", color: "var(--st-ink)", outline: "none" }}
            />

            <button
              onClick={() => removeItem(i)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "2px 4px" }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addItem}
        style={{
          marginTop: 8, display: "flex", alignItems: "center", gap: 4,
          fontSize: "0.75rem", fontWeight: 500, color: "var(--st-ink-60)",
          border: "none", background: "transparent", cursor: "pointer",
        }}
      >
        <Plus size={12} /> Ajouter un élément
      </button>
    </div>
  );
}

function StepFormFields({
  lessonId,
  step,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  lessonId: string;
  step: TimelineStep;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<TimelineStep>) => void;
  onRemove: () => void;
}) {
  const items = step.panel_items ?? [];
  const [uploadingStep, setUploadingStep] = useState(false);
  const [uploadingItemIdx, setUploadingItemIdx] = useState<number | null>(null);
  const stepFileRef = useRef<HTMLInputElement>(null);
  const itemFileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  const setItems = (next: TimelineDetailItem[]) => onChange({ panel_items: next });

  const handleStepIconUpload = async (file: File) => {
    setUploadingStep(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onChange({ icon_url: url });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploadingStep(false);
    }
  };

  const handleItemIconUpload = async (i: number, file: File) => {
    setUploadingItemIdx(i);
    try {
      const url = await uploadLmsImage(file, lessonId);
      setItems(items.map((it, idx) => idx === i ? { ...it, icon_url: url } : it));
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploadingItemIdx(null);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Étape {index + 1}</span>
        {canRemove && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Step icon */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:border-gray-400 transition-colors"
          onClick={() => stepFileRef.current?.click()}
        >
          {uploadingStep ? <Spinner size="sm" /> : step.icon_url ? (
            <img src={step.icon_url} alt="" className="w-full h-full object-contain" />
          ) : (
            <Upload className="h-5 w-5 text-gray-400" />
          )}
          <input type="file" accept="image/*" ref={stepFileRef} style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStepIconUpload(f); e.target.value = ""; }}
          />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <Label className="text-xs">Titre</Label>
            <Input value={step.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Titre de l'étape" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input value={step.description ?? ""} onChange={(e) => onChange({ description: e.target.value || null })} placeholder="Description courte…" />
          </div>
        </div>
      </div>

      {/* Panel section */}
      <div className="space-y-2 pt-1">
        <Label className="text-xs">Titre de l'encart</Label>
        <Input value={step.panel_title ?? ""} onChange={(e) => onChange({ panel_title: e.target.value || null })} placeholder="Exemples d'usages" />

        <Label className="text-xs">Éléments de l'encart</Label>
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded border-dashed border border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
              onClick={() => itemFileRefs.current[i]?.click()}
            >
              {uploadingItemIdx === i ? <Spinner size="sm" /> : item.icon_url ? (
                <img src={item.icon_url} alt="" className="w-full h-full object-contain" />
              ) : <Upload className="h-3 w-3 text-gray-400" />}
              <input type="file" accept="image/*" ref={(el) => { itemFileRefs.current[i] = el; }} style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleItemIconUpload(i, f); e.target.value = ""; }}
              />
            </div>
            <Input
              value={item.label}
              onChange={(e) => setItems(items.map((it, idx) => idx === i ? { ...it, label: e.target.value } : it))}
              placeholder={`Élément ${i + 1}`}
              className="flex-1"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: cryptoRandomId(), label: "" }])}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>
    </div>
  );
}
