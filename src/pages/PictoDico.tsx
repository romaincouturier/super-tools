import { useState, useMemo, useCallback, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BookImage,
  Copy,
  CheckCircle2,
  Webhook,
  Trash2,
  Plus,
  Wand2,
  CalendarDays,
  X,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PictoWord {
  id: string;
  word: string;
  language: string;
  source: "webhook" | "manual";
  request_type: "demande_ajout" | "erreur_signalee" | null;
  source_url: string | null;
  error_description: string | null;
  received_at: string | null;
  created_at: string;
}

interface PictoChallenge {
  id: string;
  title: string;
  theme: string;
  words: string[];
  challenge_date: string;
  school_year: string;
  event_id: string | null;
  created_at: string;
  updated_at: string;
}

interface GeneratedChallenge {
  month: number;
  year: number;
  theme: string;
  words: string[];
  challenge_date: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_LABELS: Record<number, string> = {
  1: "Janvier",
  2: "Février",
  3: "Mars",
  4: "Avril",
  5: "Mai",
  6: "Juin",
  7: "Juillet",
  8: "Août",
  9: "Septembre",
  10: "Octobre",
  11: "Novembre",
  12: "Décembre",
};

function getDefaultStartYear(): number {
  const now = new Date();
  return now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

function schoolYearLabel(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

// ---------------------------------------------------------------------------
// Tab: Mots collectés
// ---------------------------------------------------------------------------

function WordsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "webhook" | "manual">("all");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const { data: words = [], isLoading } = useQuery<PictoWord[]>({
    queryKey: ["pictodico_words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pictodico_words")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PictoWord[];
    },
  });

  const deleteWordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pictodico_words").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pictodico_words"] });
      toast({ title: "Mot supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pictodico_words").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pictodico_words"] });
      setConfirmDeleteAll(false);
      toast({ title: "Tous les mots supprimés" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    return words.filter((w) => {
      const matchSearch = w.word.toLowerCase().includes(search.toLowerCase());
      const matchSource = filterSource === "all" || w.source === filterSource;
      return matchSearch && matchSource;
    });
  }, [words, search, filterSource]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Rechercher un mot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <div className="flex gap-1">
            {(["all", "webhook", "manual"] as const).map((s) => (
              <Button
                key={s}
                variant={filterSource === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSource(s)}
              >
                {s === "all" ? "Tous" : s === "webhook" ? "Webhook" : "Manuel"}
              </Button>
            ))}
          </div>
          <Badge variant="secondary">{filtered.length} mot{filtered.length !== 1 ? "s" : ""}</Badge>
        </div>
        <div>
          {confirmDeleteAll ? (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-destructive font-medium">Confirmer la suppression de tous les mots ?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Supprimer tout"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteAll(false)}>
                Annuler
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={words.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer tout
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun mot trouvé
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Mot</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((word) => (
                    <tr key={word.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{word.word}</td>
                      <td className="px-4 py-3">
                        {word.request_type ? (
                          <Badge variant={word.request_type === "erreur_signalee" ? "destructive" : "secondary"} className="text-xs">
                            {word.request_type === "erreur_signalee" ? "Erreur signalée" : "Demande d'ajout"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {word.source === "webhook" ? "Webhook" : "Manuel"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {word.created_at
                          ? format(parseISO(word.created_at), "d MMM yyyy", { locale: fr })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteWordMutation.mutate(word.id)}
                          disabled={deleteWordMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Ajouter des mots
// ---------------------------------------------------------------------------

function ImportTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rawInput, setRawInput] = useState("");
  const [language, setLanguage] = useState("fr");

  const parsedWords = useMemo(() => {
    const lines = rawInput
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
    return [...new Set(lines)];
  }, [rawInput]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (parsedWords.length === 0) throw new Error("Aucun mot à importer");
      const rows = parsedWords.map((word) => ({
        word,
        language,
        source: "manual" as const,
        request_type: "demande_ajout" as const,
      }));
      const { error } = await supabase.from("pictodico_words").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pictodico_words"] });
      setRawInput("");
      toast({ title: `${parsedWords.length} mot${parsedWords.length !== 1 ? "s" : ""} importé${parsedWords.length !== 1 ? "s" : ""}` });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erreur lors de l'import", variant: "destructive" });
    },
  });

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import en masse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mots à importer</label>
            <Textarea
              placeholder="Un mot par ligne, ou séparés par des virgules"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            {parsedWords.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {parsedWords.length} mot{parsedWords.length !== 1 ? "s" : ""} détecté{parsedWords.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Langue</label>
            <div className="flex gap-2">
              {[
                { value: "fr", label: "Français" },
                { value: "en", label: "Anglais" },
              ].map((lang) => (
                <Button
                  key={lang.value}
                  variant={language === lang.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage(lang.value)}
                >
                  {lang.label}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => importMutation.mutate()}
            disabled={parsedWords.length === 0 || importMutation.isPending}
            className="w-full"
          >
            {importMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {parsedWords.length > 0
              ? `Importer ${parsedWords.length} mot${parsedWords.length !== 1 ? "s" : ""}`
              : "Importer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChallengeCard
// ---------------------------------------------------------------------------

interface ChallengeCardProps {
  challenge: PictoChallenge;
  onSave: (updated: PictoChallenge) => void;
  onCreateEvent: (challenge: PictoChallenge) => void;
  isSaving: boolean;
  isCreatingEvent: boolean;
}

function ChallengeCard({ challenge, onSave, onCreateEvent, isSaving, isCreatingEvent }: ChallengeCardProps) {
  const [local, setLocal] = useState<PictoChallenge>(challenge);
  const [newWord, setNewWord] = useState("");

  useEffect(() => {
    setLocal(challenge);
  }, [challenge]);

  const wordCount = local.words.length;
  const wordCountColor =
    wordCount < 15 || wordCount > 18
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-green-100 text-green-700 border-green-200";

  const monthNum = local.challenge_date
    ? parseISO(local.challenge_date).getMonth() + 1
    : null;

  const monthLabel = monthNum ? MONTH_LABELS[monthNum] : "—";

  function addWord() {
    const trimmed = newWord.trim();
    if (!trimmed || local.words.includes(trimmed)) return;
    setLocal((prev) => ({ ...prev, words: [...prev.words, trimmed] }));
    setNewWord("");
  }

  function removeWord(word: string) {
    setLocal((prev) => ({ ...prev, words: prev.words.filter((w) => w !== word) }));
  }

  const isDirty =
    local.title !== challenge.title ||
    local.theme !== challenge.theme ||
    local.challenge_date !== challenge.challenge_date ||
    JSON.stringify(local.words) !== JSON.stringify(challenge.words);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {monthLabel}
          </span>
          <Badge variant="outline" className={`text-xs font-medium border ${wordCountColor}`}>
            {wordCount} mot{wordCount !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Input
          value={local.title}
          onChange={(e) => setLocal((prev) => ({ ...prev, title: e.target.value }))}
          className="font-semibold text-base mt-1"
          placeholder="Titre du challenge"
        />
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pt-0">
        {/* Date */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <Input
            type="date"
            value={local.challenge_date ? local.challenge_date.slice(0, 10) : ""}
            onChange={(e) =>
              setLocal((prev) => ({ ...prev, challenge_date: e.target.value }))
            }
            className="text-sm"
          />
        </div>

        {/* Theme */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Thème</label>
          <Input
            value={local.theme}
            onChange={(e) => setLocal((prev) => ({ ...prev, theme: e.target.value }))}
            placeholder="Thème du challenge"
            className="text-sm"
          />
        </div>

        {/* Words */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Mots</label>
          <div className="flex flex-wrap gap-1.5 min-h-8">
            {local.words.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium"
              >
                {word}
                <button
                  type="button"
                  onClick={() => removeWord(word)}
                  className="hover:text-destructive transition-colors ml-0.5"
                  aria-label={`Supprimer ${word}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="Ajouter un mot..."
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addWord();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addWord} disabled={!newWord.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={() => onSave(local)}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : null}
            Sauvegarder
          </Button>

          {local.event_id ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-primary"
              asChild
            >
              <a href="/events" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Voir l'événement
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-xs"
              onClick={() => onCreateEvent(local)}
              disabled={isCreatingEvent}
            >
              {isCreatingEvent ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CalendarDays className="h-3 w-3 mr-1" />
              )}
              Créer événement
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab: PictoChallenges
// ---------------------------------------------------------------------------

function ChallengesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startYear, setStartYear] = useState(getDefaultStartYear);
  const [generatedChallenges, setGeneratedChallenges] = useState<PictoChallenge[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingEventId, setCreatingEventId] = useState<string | null>(null);

  const { data: savedChallenges = [] } = useQuery<PictoChallenge[]>({
    queryKey: ["pictodico_challenges", startYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pictodico_challenges")
        .select("*")
        .eq("school_year", schoolYearLabel(startYear))
        .order("challenge_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PictoChallenge[];
    },
  });

  // Merge: saved challenges override generated ones by id
  const displayChallenges = generatedChallenges.length > 0 ? generatedChallenges : savedChallenges;

  const { data: words = [] } = useQuery<PictoWord[]>({
    queryKey: ["pictodico_words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pictodico_words")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PictoWord[];
    },
  });

  async function generateChallenges() {
    setIsGenerating(true);
    try {
      const wordList = words.map((w) => w.word);
      const { data, error } = await supabase.functions.invoke("pictodico-generate-challenges", {
        body: { words: wordList, startYear },
      });
      if (error) throw error;

      const challenges: GeneratedChallenge[] = data?.challenges ?? [];
      if (challenges.length === 0) throw new Error("Aucun challenge généré");

      // Map to PictoChallenge shape (no id yet = temp uuid)
      const mapped: PictoChallenge[] = challenges.map((c, i) => ({
        id: `temp-${i}`,
        title: c.title,
        theme: c.theme,
        words: c.words,
        challenge_date: c.challenge_date,
        school_year: schoolYearLabel(startYear),
        event_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      setGeneratedChallenges(mapped);
      toast({ title: `${mapped.length} challenge${mapped.length !== 1 ? "s" : ""} générés` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la génération";
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveChallenge(updated: PictoChallenge) {
    setSavingId(updated.id);
    try {
      const isTemp = updated.id.startsWith("temp-");
      if (isTemp) {
        const { data, error } = await supabase
          .from("pictodico_challenges")
          .insert({
            title: updated.title,
            theme: updated.theme,
            words: updated.words,
            challenge_date: updated.challenge_date,
            school_year: updated.school_year,
          })
          .select()
          .single();
        if (error) throw error;
        const newId = data.id as string;
        setGeneratedChallenges((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...updated, id: newId } : c))
        );
      } else {
        const { error } = await supabase
          .from("pictodico_challenges")
          .update({
            title: updated.title,
            theme: updated.theme,
            words: updated.words,
            challenge_date: updated.challenge_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", updated.id);
        if (error) throw error;
        setGeneratedChallenges((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      }
      queryClient.invalidateQueries({ queryKey: ["pictodico_challenges"] });
      toast({ title: "Challenge sauvegardé" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      toast({ title: message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function createEvent(challenge: PictoChallenge) {
    setCreatingEventId(challenge.id);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .insert({
          title: challenge.title,
          description: "Mots : " + challenge.words.join(", "),
          event_date: challenge.challenge_date,
          event_type: "external",
          status: "active",
          location_type: "physical",
        })
        .select("id")
        .single();
      if (eventError) throw eventError;

      const eventId = eventData.id as string;

      const isTemp = challenge.id.startsWith("temp-");
      if (!isTemp) {
        const { error: updateError } = await supabase
          .from("pictodico_challenges")
          .update({ event_id: eventId })
          .eq("id", challenge.id);
        if (updateError) throw updateError;
      }

      const updateLocal = (prev: PictoChallenge[]) =>
        prev.map((c) => (c.id === challenge.id ? { ...c, event_id: eventId } : c));

      setGeneratedChallenges((prev) => updateLocal(prev));
      queryClient.invalidateQueries({ queryKey: ["pictodico_challenges"] });
      toast({ title: "Événement créé avec succès" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création de l'événement";
      toast({ title: message, variant: "destructive" });
    } finally {
      setCreatingEventId(null);
    }
  }

  const yearOptions = [startYear - 1, startYear, startYear + 1];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Année scolaire :</label>
          <div className="flex gap-1">
            {yearOptions.map((y) => (
              <Button
                key={y}
                variant={startYear === y ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStartYear(y);
                  setGeneratedChallenges([]);
                }}
              >
                {schoolYearLabel(y)}
              </Button>
            ))}
          </div>
        </div>
        <Button onClick={generateChallenges} disabled={isGenerating} className="gap-2">
          {isGenerating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Générer avec l'IA
        </Button>
      </div>

      {/* Grid */}
      {displayChallenges.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wand2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Aucun challenge pour cette année scolaire.</p>
          <p className="text-sm mt-1">Cliquez sur « Générer avec l'IA » pour créer les 10 challenges.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onSave={saveChallenge}
              onCreateEvent={createEvent}
              isSaving={savingId === challenge.id}
              isCreatingEvent={creatingEventId === challenge.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Configuration
// ---------------------------------------------------------------------------

function ConfigTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { copied: copiedWebhook, copy: copyWebhook } = useCopyToClipboard({ defaultToastTitle: "URL copiée" });
  const { copied: copiedSnippet, copy: copySnippet } = useCopyToClipboard({ defaultToastTitle: "Extrait copié" });
  const [newSecret, setNewSecret] = useState("");
  const [isSavingSecret, setIsSavingSecret] = useState(false);

  const { data: secretData } = useQuery<{ setting_value: string } | null>({
    queryKey: ["app_settings", "pictodico_webhook_secret"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "pictodico_webhook_secret")
        .maybeSingle();
      return data as { setting_value: string } | null;
    },
  });

  const webhookSecret = secretData?.setting_value ?? "";
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pictodico-webhook?key=${webhookSecret || "VOTRE_SECRET"}`;

  const wpSnippet = `define( 'SUPERTOOLS_WEBHOOK_URL', '${webhookUrl}' );`;

  async function saveSecret() {
    if (!newSecret.trim()) return;
    setIsSavingSecret(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ setting_key: "pictodico_webhook_secret", setting_value: newSecret.trim() }, { onConflict: "setting_key" });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["app_settings", "pictodico_webhook_secret"] });
      setNewSecret("");
      toast({ title: "Secret mis à jour" });
    } catch {
      toast({ title: "Erreur lors de la mise à jour du secret", variant: "destructive" });
    } finally {
      setIsSavingSecret(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            URL du Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-center">
            <code className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono break-all">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyWebhook(webhookUrl)}
              title="Copier"
            >
              {copiedWebhook ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Utilisez cette URL dans votre plugin WordPress pour envoyer les demandes de mots.
          </p>
        </CardContent>
      </Card>

      {/* wp-config.php snippet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extrait wp-config.php</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-start">
            <pre className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono whitespace-pre-wrap break-all">
              {wpSnippet}
            </pre>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copySnippet(wpSnippet)}
              title="Copier"
            >
              {copiedSnippet ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ajoutez cette ligne dans votre <code>wp-config.php</code> pour configurer la clé du webhook.
          </p>
        </CardContent>
      </Card>

      {/* Secret management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {webhookSecret ? "Modifier le secret" : "Définir le secret"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {webhookSecret && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Secret configuré
            </div>
          )}
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Nouveau secret..."
              value={newSecret}
              onChange={(e) => setNewSecret(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSecret();
              }}
            />
            <Button onClick={saveSecret} disabled={!newSecret.trim() || isSavingSecret}>
              {isSavingSecret ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ce secret sécurise les appels entrants vers le webhook Picto-Dico.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const PictoDico = () => {
  return (
    <ModuleLayout>
      <div className="p-6 space-y-6">
        <PageHeader
          icon={BookImage}
          title="Picto-Dico"
          subtitle="Gestion du dictionnaire de pictogrammes et challenges mensuels"
        />

        <Tabs defaultValue="words" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="words">Mots collectés</TabsTrigger>
            <TabsTrigger value="import">Ajouter des mots</TabsTrigger>
            <TabsTrigger value="challenges">PictoChallenges</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="words">
            <WordsTab />
          </TabsContent>

          <TabsContent value="import">
            <ImportTab />
          </TabsContent>

          <TabsContent value="challenges">
            <ChallengesTab />
          </TabsContent>

          <TabsContent value="config">
            <ConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </ModuleLayout>
  );
};

export default PictoDico;
