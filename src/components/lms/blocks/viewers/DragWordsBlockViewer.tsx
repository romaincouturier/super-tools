import { useState, useMemo } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, pointerWithin, rectIntersection, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DragWordsBlockContent } from "@/types/lms-blocks";

type Part = { type: "text" | "blank"; value: string };
type Word = { id: string; value: string };

function parseDragWords(text: string): Part[] {
  const parts: Part[] = [];
  const regex = /\*([^*]+)\*/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push({ type: "blank", value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return args.pointerCoordinates ? hits : rectIntersection(args);
};

export default function DragWordsBlockViewer({ content }: { content: DragWordsBlockContent }) {
  return <DragWordsExercise key={content.text} content={content} />;
}

function DragWordsExercise({ content }: { content: DragWordsBlockContent }) {
  const parts = useMemo(() => parseDragWords(content.text ?? ""), [content.text]);
  const blanks = useMemo(() => parts.filter((part) => part.type === "blank"), [parts]);
  const wordBank = useMemo(() => {
    const words = blanks.map((blank, i) => ({ id: `word-${i}`, value: blank.value }));
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
    return words;
  }, [blanks]);
  const [placements, setPlacements] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const bank = useDroppable({ id: "bank" });
  const findWord = (id?: string) => wordBank.find((word) => word.id === id);
  const activeWord = findWord(dragged ?? undefined);
  const removeWord = (id: string) => {
    setPlacements((prev) => Object.fromEntries(Object.entries(prev).filter(([, wordId]) => wordId !== id)));
    setChecked(false);
    setSelected(null);
  };
  const placeWord = (idx: number, id: string) => {
    setPlacements((prev) => ({ ...Object.fromEntries(Object.entries(prev).filter(([, wordId]) => wordId !== id)), [idx]: id }));
    setSelected(null);
    setChecked(false);
  };
  const endDrag = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    if (!over) return;
    if (over.id === "bank") removeWord(String(active.id));
    else if (String(over.id).startsWith("blank-")) placeWord(Number(String(over.id).slice(6)), String(active.id));
  };
  const used = new Set(Object.values(placements));
  const allPlaced = Object.keys(placements).length === blanks.length;
  const correctCount = blanks.filter((blank, idx) => findWord(placements[idx])?.value === blank.value).length;
  if (!blanks.length) return null;
  let blankIdx = 0;

  return <DndContext sensors={sensors} collisionDetection={collisionDetection}
    onDragStart={({ active }) => { setDragged(String(active.id)); setSelected(null); }}
    onDragEnd={endDrag} onDragCancel={() => setDragged(null)}>
    <div className="space-y-4 text-foreground">
      {content.title && <p className="text-lg font-bold">{content.title}</p>}
      <p className="text-base text-muted-foreground">{content.instructions?.trim() || "Glissez chaque mot dans la bonne case"}</p>
      <div ref={bank.setNodeRef} aria-label="Réserve de mots" className={cn("flex min-h-16 flex-wrap items-center gap-2 rounded-lg border-2 border-transparent bg-muted p-3", bank.isOver && "border-accent")}>
        {wordBank.filter((word) => !used.has(word.id)).map((word) => <DraggableWord key={word.id} word={word} selected={selected === word.id}
          onClick={() => setSelected((prev) => prev === word.id ? null : word.id)} />)}
        {allPlaced && <span className="text-sm text-muted-foreground">Tous les mots ont été placés</span>}
      </div>
      <div className="text-lg leading-[2.8] whitespace-pre-wrap break-words">
        {parts.map((part, i) => {
          if (part.type === "text") return <span key={i}>{part.value}</span>;
          const idx = blankIdx++;
          const word = findWord(placements[idx]);
          const correct = checked && word?.value === part.value;
          return <WordSlot key={i} idx={idx} word={word} selected={!!selected} checked={checked} correct={correct}
            onPlace={() => selected && placeWord(idx, selected)} onRemove={() => word && removeWord(word.id)} />;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => { setSelected(null); setChecked(true); }} disabled={!allPlaced}><Check />Vérifier</Button>
        <Button type="button" variant="outline" onClick={() => { setPlacements({}); setSelected(null); setChecked(false); }}><RotateCcw />Recommencer</Button>
        {checked && <p role="status" className={cn("text-base font-semibold", correctCount === blanks.length && "text-success")}>{correctCount} / {blanks.length} correct{correctCount > 1 ? "s" : ""}</p>}
      </div>
    </div>
    <DragOverlay>{activeWord && <span className="inline-flex rounded-md border-2 border-accent bg-card px-4 py-2 text-base font-semibold text-card-foreground">{activeWord.value}</span>}</DragOverlay>
  </DndContext>;
}

function DraggableWord({ word, selected, onClick, placed = false }: { word: Word; selected: boolean; onClick: () => void; placed?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: word.id });
  return <Button ref={setNodeRef} type="button" variant="outline" {...attributes} {...listeners}
    onClick={onClick} aria-label={placed ? `Retirer ${word.value} de la case` : `Choisir ${word.value}`} aria-pressed={!placed && selected}
    className={cn("h-auto min-h-11 max-w-full cursor-grab whitespace-normal break-words border-2 px-3 py-2 text-base active:cursor-grabbing touch-manipulation", placed && "border-transparent bg-transparent hover:bg-transparent", selected && "border-accent bg-accent/10 font-bold", isDragging && "opacity-30")}>
    {word.value}
  </Button>;
}

function WordSlot({ idx, word, selected, checked, correct, onPlace, onRemove }: { idx: number; word?: Word; selected: boolean; checked: boolean; correct: boolean; onPlace: () => void; onRemove: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `blank-${idx}` });
  return <span ref={setNodeRef} className={cn("mx-1 inline-flex min-h-11 min-w-24 max-w-full items-center rounded-md border-2 align-middle leading-normal", checked ? correct ? "border-success bg-success-surface" : "border-destructive bg-error-surface" : isOver || word || selected ? "border-accent bg-accent/10" : "border-input bg-muted/40")}>
    {word ? <DraggableWord word={word} placed selected={false} onClick={onRemove} />
      : <Button type="button" variant="ghost" aria-label={`Case ${idx + 1}`} onClick={onPlace} className="h-11 w-full min-w-24">___</Button>}
    {checked && (correct ? <Check className="mr-2 h-4 w-4 shrink-0 text-success" aria-label="Correct" /> : <X className="mr-2 h-4 w-4 shrink-0 text-destructive" aria-label="Incorrect" />)}
  </span>;
}
