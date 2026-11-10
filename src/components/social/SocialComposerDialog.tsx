import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ImageIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SocialMediaPicker, { SocialMediaThumb, mediaDisplayName } from "@/components/social/SocialMediaPicker";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { demoBlur } from "@/lib/demoMask";
import { useToast } from "@/hooks/use-toast";
import { useMediaByIds, type MediaItem } from "@/hooks/useMedia";
import { useAutoSaveForm, type AutoSaveFormValues } from "@/hooks/useAutoSaveForm";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useDeleteSocialGroup,
  useDeleteSocialPost,
  useSaveSocialGroup,
  useSetSocialPostPublished,
  useSocialChannels,
  useSocialGroup,
  useSocialThemes,
  useUpdatePublishedSocialPost,
} from "@/hooks/useSocialContents";
import { toastError } from "@/lib/toastError";
import { formatAlert } from "../../../supabase/functions/_shared/social-post-alerts";
import {
  DISPLAY_STATUS_LABELS,
  validateDateRemoval,
  validateStatusChange,
  type SocialDraftStatus,
  NO_CHANNEL_MESSAGE,
  alertsByChannel,
  buildGroupPosts,
  publishedPostEdits,
  SOCIAL_FORMAT_LABELS,
  parisLocalToUtcIso,
  utcIsoToParisLocal,
  type SocialChannel,
  type SocialContentGroup,
  type SocialFormat,
  type SocialGroupDraft,
} from "@/services/socialContents";

interface ComposerValues extends AutoSaveFormValues {
  channelIds: string[];
  format: SocialFormat;
  sync: boolean;
  themeId: string | null;
  commonText: string;
  texts: Record<string, string>;
  commonMediaId: string | null;
  mediaIds: Record<string, string | null>;
  date: string;
  time: string;
  statuses: Record<string, SocialDraftStatus>;
}

const DEFAULT_TIME = "09:00";

/** Visuel choisi : vignette, nom masqué en démo, Changer et Retirer. */
function VisualField({ label, mediaId, mediaById, onPick, onRemove }: {
  label: string;
  mediaId: string | null;
  mediaById: Map<string, MediaItem>;
  onPick: () => void;
  onRemove: () => void;
}) {
  const { isDemoMode } = useDemoMode();
  const item = mediaId ? mediaById.get(mediaId) : undefined;
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {mediaId ? (
          <>
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded border bg-muted" data-testid="social-visual-thumb">
              {item ? <SocialMediaThumb item={item} /> : <ImageIcon className="m-auto mt-5 h-6 w-6 text-muted-foreground" />}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm">{item ? mediaDisplayName(item, isDemoMode) : "Visuel sélectionné"}</span>
            <Button type="button" variant="outline" size="sm" onClick={onPick}>Changer</Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>Retirer</Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onPick}>
            <ImageIcon className="h-4 w-4 mr-1" /> Choisir dans la Médiathèque
          </Button>
        )}
      </div>
    </div>
  );
}

const COMMON_VISUAL = "__common__";
const NO_THEME = "__none__";

interface SocialComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contenu existant à rouvrir, null pour un nouveau contenu. */
  groupId: string | null;
}

export default function SocialComposerDialog({ open, onOpenChange, groupId }: SocialComposerDialogProps) {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { data: channels = [], isLoading: channelsLoading } = useSocialChannels();
  const [currentId, setCurrentId] = useState<string>("");
  /** Un nouveau contenu est relu dès son premier enregistrement, pour le marquage et la suppression. */
  const [savedOnce, setSavedOnce] = useState(false);
  const queryId = groupId ?? (savedOnce && currentId ? currentId : null);
  const {
    data: group, isFetching: groupFetching, isPending: groupPending, isError: groupError, refetch: refetchGroup,
  } = useSocialGroup(open ? queryId : null);
  /** Dernier état connu du contenu en base, mis à jour aussi par les relectures explicites. */
  const groupRef = useRef<SocialContentGroup | null | undefined>(group);
  groupRef.current = group;
  const refetchRef = useRef(refetchGroup);
  refetchRef.current = refetchGroup;
  /** Lu au moment de l'action : un enregistrement peut aboutir pendant qu'une confirmation est ouverte. */
  const savedOnceRef = useRef(false);
  const save = useSaveSocialGroup();
  const { mutateAsync: updatePublished } = useUpdatePublishedSocialPost();
  const { mutateAsync: setPublished } = useSetSocialPostPublished();
  const { mutateAsync: removePost } = useDeleteSocialPost();
  const { mutateAsync: removeGroup } = useDeleteSocialGroup();
  /** Marquage ou suppression en cours : aucune sauvegarde automatique ne part. */
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const setBusyState = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };
  const { confirm, ConfirmDialog } = useConfirm();
  const channelsById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const themesQuery = useSocialThemes();
  const themes = useMemo(() => themesQuery.data ?? [], [themesQuery.data]);
  /** Tant que les thèmes ne sont pas lus, « Sans thème » serait faux pour un contenu qui en a un. */
  const themesReady = !themesQuery.isPending && !themesQuery.isError;

  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [format, setFormat] = useState<SocialFormat>("post");
  const [sync, setSync] = useState(true);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [commonText, setCommonText] = useState("");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [commonMediaId, setCommonMediaId] = useState<string | null>(null);
  const [mediaIds, setMediaIds] = useState<Record<string, string | null>>({});
  /** Seuls les visuels choisis sont lus ; le sélecteur charge la Médiathèque à son ouverture. */
  const chosenMediaIds = useMemo(
    () => [commonMediaId, ...Object.values(mediaIds)].filter((id): id is string => !!id),
    [commonMediaId, mediaIds],
  );
  const mediaQuery = useMediaByIds(chosenMediaIds, { enabled: open });
  const mediaById = useMemo(() => new Map((mediaQuery.data ?? []).map((m) => [m.id, m])), [mediaQuery.data]);
  /** Cible du sélecteur ouvert : visuel commun ou identifiant du canal. */
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [date, setDate] = useState("");
  /** Statut choisi par déclinaison non publiée, indépendant de la date. */
  const [statuses, setStatuses] = useState<Record<string, SocialDraftStatus>>({});
  const [time, setTime] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const initializedFor = useRef<string | null>(null);
  /** Chaîne des enregistrements : chacun attend le précédent, l'ordre d'écriture suit l'ordre de saisie. */
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const lastSaveFailed = useRef(false);

  const toDraft = useCallback((v: ComposerValues): SocialGroupDraft => ({
    groupId: currentId,
    format: v.format,
    sync: v.sync,
    themeId: v.themeId,
    channelIds: v.channelIds,
    commonText: v.commonText,
    texts: v.texts,
    commonMediaId: v.commonMediaId,
    mediaIds: v.mediaIds,
    scheduledAt: v.date ? parisLocalToUtcIso(v.date, v.time || DEFAULT_TIME) : null,
    statuses: Object.fromEntries(v.channelIds.map((id) => [id, v.statuses[id] ?? "unscheduled"])),
  }), [currentId]);

  /** Relit le contenu et met à jour l'état connu de la base sans attendre le rendu. */
  const reloadGroup = useCallback(async () => {
    const data = (await refetchRef.current()).data;
    groupRef.current = data;
    return data;
  }, []);

  /** Ajoute une écriture à la chaîne : marquage et suppressions passent après les sauvegardes en cours. */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = saveChain.current.then(task);
    saveChain.current = run.catch(() => undefined);
    return run;
  }, []);

  const { mutateAsync } = save;
  const runSave = useCallback((v: ComposerValues): Promise<boolean> => {
    const draft = toDraft(v);
    const run = saveChain.current.then(async () => {
      try {
        await mutateAsync(draft);
        for (const edit of publishedPostEdits(groupRef.current?.posts ?? [], draft)) {
          try {
            await updatePublished(edit);
          } catch (e) {
            // La déclinaison n'est plus publiée (marquage annulé ailleurs) : relire plutôt que réessayer.
            if ((e as { code?: string } | null)?.code !== "22023") throw e;
            await reloadGroup();
          }
        }
        lastSaveFailed.current = false;
        savedOnceRef.current = true;
        setSavedOnce(true);
        return true;
      } catch (e) {
        lastSaveFailed.current = true;
        toastError(toast, e);
        return false;
      }
    });
    saveChain.current = run;
    return run;
  }, [mutateAsync, updatePublished, reloadGroup, toDraft, toast]);

  const handleAutoSave = useCallback(async (values: AutoSaveFormValues): Promise<boolean> => {
    const v = values as ComposerValues;
    if (!currentId || busyRef.current || v.channelIds.length === 0) return false;
    return runSave(v);
  }, [currentId, runSave]);

  const formValues = useMemo<ComposerValues>(
    () => ({ channelIds, format, sync, themeId, commonText, texts, commonMediaId, mediaIds, date, time, statuses }),
    [channelIds, format, sync, themeId, commonText, texts, commonMediaId, mediaIds, date, time, statuses],
  );

  const { autoSaving, lastSaved, resetTracking, flushAndGetPending } = useAutoSaveForm({
    open: open && !!currentId && !busy,
    formValues,
    onSave: handleAutoSave,
  });

  useEffect(() => {
    if (!open) {
      initializedFor.current = null;
      setCurrentId("");
      setSavedOnce(false);
      savedOnceRef.current = false;
      return;
    }
    const key = groupId ?? "new";
    if (initializedFor.current === key) return;
    if (groupId && (groupFetching || groupPending)) return;
    initializedFor.current = key;
    lastSaveFailed.current = false;

    if (groupId && (groupError || !group)) {
      toastError(toast, "Contenu introuvable");
      onOpenChange(false);
      return;
    }

    const posts = group?.posts ?? [];
    const ids = posts.map((p) => p.channel_id);
    const reference = posts.find((p) => p.publication_status !== "published") ?? posts[0];
    const firstText = reference?.text ?? "";
    const scheduled = posts.find((p) => p.publication_status !== "published" && p.scheduled_at)?.scheduled_at
      ?? posts.find((p) => p.scheduled_at)?.scheduled_at ?? null;
    const local = scheduled ? utcIsoToParisLocal(scheduled) : null;
    setCurrentId(group?.id ?? groupId ?? crypto.randomUUID());
    setChannelIds(ids);
    setFormat(group?.format ?? "post");
    setSync(group?.sync ?? true);
    setThemeId(group?.theme_id ?? null);
    setCommonText(firstText);
    setTexts(Object.fromEntries(posts.map((p) => [p.channel_id, p.text])));
    setCommonMediaId(reference?.media_id ?? null);
    setMediaIds(Object.fromEntries(posts.map((p) => [p.channel_id, p.media_id ?? null])));
    setPickerFor(null);
    setDate(local?.date ?? "");
    setTime(local?.time ?? "");
    setStatuses(Object.fromEntries(posts
      .filter((p) => p.publication_status !== "published")
      .map((p) => [p.channel_id, p.publication_status as SocialDraftStatus])));
    setActiveTab(reference?.channel_id ?? "");
    resetTracking();
  }, [open, groupId, group, groupFetching, groupPending, groupError, resetTracking, toast, onOpenChange]);

  const orderedSelected = channels.filter((c) => channelIds.includes(c.id));
  /** Déclinaisons publiées selon la base : modifiables seules, jamais décochables. */
  const publishedChannelIds = useMemo(
    () => new Set((group?.posts ?? [])
      .filter((p) => p.publication_status === "published")
      .map((p) => p.channel_id)),
    [group],
  );

  // Synchro active : le texte et le visuel des non publiées restent ceux du commun, pour qu'aucun
  // texte périmé ne soit enregistré sur une déclinaison au moment où elle devient publiée.
  useEffect(() => {
    if (!sync) return;
    const editable = channelIds.filter((id) => !publishedChannelIds.has(id));
    setTexts((prev) => (editable.every((id) => prev[id] === commonText)
      ? prev
      : { ...prev, ...Object.fromEntries(editable.map((id) => [id, commonText])) }));
    setMediaIds((prev) => (editable.every((id) => id in prev && prev[id] === commonMediaId)
      ? prev
      : { ...prev, ...Object.fromEntries(editable.map((id) => [id, commonMediaId])) }));
  }, [sync, commonText, commonMediaId, channelIds, publishedChannelIds]);

  const toggleChannel = (id: string, checked: boolean) => {
    setChannelIds((prev) => (checked ? [...prev, id] : prev.filter((c) => c !== id)));
    if (checked) {
      setTexts((prev) => (id in prev ? prev : { ...prev, [id]: commonText }));
      setMediaIds((prev) => (id in prev ? prev : { ...prev, [id]: commonMediaId }));
      if (!activeTab || !channelIds.includes(activeTab)) setActiveTab(id);
    } else if (activeTab === id) {
      setActiveTab(channelIds.find((c) => c !== id) ?? "");
    }
  };

  const toggleSync = async (next: boolean) => {
    const editable = channelIds.filter((id) => !publishedChannelIds.has(id));
    if (next) {
      const tab = activeTab && editable.includes(activeTab)
        ? activeTab
        : orderedSelected.find((c) => !publishedChannelIds.has(c.id))?.id;
      const distinct = new Set(editable.map((id) => JSON.stringify([
        texts[id] ?? commonText,
        id in mediaIds ? mediaIds[id] : commonMediaId,
      ])));
      if (distinct.size > 1) {
        const ok = await confirm({
          title: "Réactiver le texte commun ?",
          description: "Seuls le texte et le visuel de l'onglet affiché seront conservés. Ceux propres aux autres canaux seront remplacés.",
          confirmText: "Remplacer",
          variant: "destructive",
        });
        if (!ok) return;
      }
      if (tab) {
        setCommonText(texts[tab] ?? commonText);
        setCommonMediaId(tab in mediaIds ? mediaIds[tab] : commonMediaId);
      }
    } else {
      const own = (id: string) => publishedChannelIds.has(id);
      setTexts(Object.fromEntries(channelIds.map((id) => [id, own(id) ? (texts[id] ?? "") : commonText])));
      setMediaIds(Object.fromEntries(channelIds.map((id) => [id, own(id) ? (mediaIds[id] ?? null) : commonMediaId])));
      if (!activeTab || !channelIds.includes(activeTab)) setActiveTab(orderedSelected[0]?.id ?? "");
    }
    setSync(next);
  };

  const changeDate = (value: string) => {
    setDate(value);
    if (value && !time) setTime(DEFAULT_TIME);
  };

  const changeStatus = (channelId: string, next: SocialDraftStatus) => {
    const refusal = validateStatusChange(next, date ? "x" : null);
    if (refusal) {
      toast({ title: refusal, variant: "destructive" });
      return;
    }
    setStatuses((prev) => ({ ...prev, [channelId]: next }));
  };

  const clearDate = () => {
    const refusal = validateDateRemoval(channelIds
      .filter((id) => !publishedChannelIds.has(id))
      .map((id) => statuses[id] ?? "unscheduled"));
    if (refusal) {
      toast({ title: refusal, variant: "destructive" });
      return;
    }
    setDate("");
    setTime("");
  };

  const handleClose = (isOpen: boolean) => {
    // Une opération (marquage, suppression) est en cours : la fermeture attendrait une saisie périmée.
    if (!isOpen && busyRef.current) return;
    if (!isOpen) {
      const pending = flushAndGetPending() as ComposerValues | null;
      const values = pending ?? (lastSaveFailed.current ? formValues : null);
      const hasText = [formValues.commonText, ...Object.values(formValues.texts)].some((t) => t.trim());
      if (formValues.channelIds.length === 0 && hasText) {
        toast({ title: "Brouillon non enregistré : choisissez au moins un canal", variant: "destructive" });
      } else if (values) {
        handleAutoSave(values);
      }
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (channelIds.length === 0) {
      toastError(toast, NO_CHANNEL_MESSAGE);
      return;
    }
    flushAndGetPending();
    if (await runSave(formValues)) onOpenChange(false);
  };

  const setVisual = (target: string, mediaId: string | null) => {
    if (target === COMMON_VISUAL) setCommonMediaId(mediaId);
    else setMediaIds((prev) => ({ ...prev, [target]: mediaId }));
  };

  /** Enregistre la saisie en attente (ou celle dont l'enregistrement a échoué), puis attend la fin des écritures. */
  const flushPending = async (): Promise<boolean> => {
    const pending = flushAndGetPending() as ComposerValues | null;
    const values = pending ?? (lastSaveFailed.current ? formValues : null);
    if (values && values.channelIds.length > 0) return runSave(values);
    await saveChain.current;
    return !lastSaveFailed.current;
  };

  const togglePublished = async (channelId: string) => {
    setBusyState(true);
    try {
      if (!(await flushPending())) return;
      const post = (await reloadGroup())?.posts.find((p) => p.channel_id === channelId);
      if (!post) return;
      const publish = post.publication_status !== "published";
      if (!publish && sync && (post.text !== commonText || post.media_id !== commonMediaId)) {
        const ok = await confirm({
          title: "Reprendre le texte et le visuel communs ?",
          description: "Les corrections faites après publication seront remplacées.",
          confirmText: "Reprendre",
          variant: "destructive",
        });
        if (!ok) return;
      }
      await enqueue(() => setPublished({ postId: post.id, published: publish }));
      const fresh = (await reloadGroup())?.posts.find((p) => p.channel_id === channelId);
      const own = !publish && sync
        ? { text: commonText, media: commonMediaId }
        : { text: fresh?.text ?? texts[channelId] ?? "", media: fresh ? fresh.media_id : (mediaIds[channelId] ?? null) };
      const nextTexts = { ...texts, [channelId]: own.text };
      const nextMediaIds = { ...mediaIds, [channelId]: own.media };
      setTexts(nextTexts);
      setMediaIds(nextMediaIds);
      // Annulée, la déclinaison rejoint le groupe : sa date (et, synchro active, le texte et le visuel communs).
      // Statut retrouvé : celui de la base, Brouillon si le contenu n'a plus de date.
      const restored: SocialDraftStatus = date && fresh?.publication_status === "scheduled" ? "scheduled" : "unscheduled";
      const nextStatuses = { ...statuses, [channelId]: restored };
      if (!publish) setStatuses(nextStatuses);
      if (!publish) await runSave({ ...formValues, texts: nextTexts, mediaIds: nextMediaIds, statuses: nextStatuses });
    } catch (e) {
      toastError(toast, e);
    } finally {
      setBusyState(false);
    }
  };

  /** Supprime tout le contenu, sans enregistrer la saisie en attente, puis ferme. */
  const removeWholeContent = async () => {
    flushAndGetPending();
    await saveChain.current;
    if (groupId || savedOnceRef.current) await enqueue(() => removeGroup(currentId));
    onOpenChange(false);
  };

  const deleteDeclination = async (channelId: string) => {
    const remaining = channelIds.filter((c) => c !== channelId);
    const name = channelsById.get(channelId)?.name ?? "ce canal";
    const ok = await confirm({
      title: "Supprimer cette déclinaison ?",
      description: remaining.length === 0
        ? `C'est la dernière déclinaison : supprimer ${name} supprime tout le contenu.`
        : `La déclinaison ${name} sera supprimée. Les autres canaux du contenu sont conservés.`,
      confirmText: "Supprimer cette déclinaison",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyState(true);
    const previous = { channelIds, activeTab };
    try {
      if (remaining.length === 0) {
        await removeWholeContent();
        return;
      }
      // Le canal quitte la saisie avant la suppression : aucune sauvegarde ne peut le réinsérer.
      // La saisie en attente est réenregistrée à la fin, sans lui.
      setChannelIds(remaining);
      setActiveTab(orderedSelected.find((c) => c.id !== channelId)?.id ?? "");
      flushAndGetPending();
      await saveChain.current;
      if (groupId || savedOnceRef.current) {
        const post = (await reloadGroup())?.posts.find((p) => p.channel_id === channelId);
        if (post) await enqueue(() => removePost(post.id));
      }
    } catch (e) {
      setChannelIds(previous.channelIds);
      setActiveTab(previous.activeTab);
      toastError(toast, e);
    } finally {
      setBusyState(false);
    }
  };

  const deleteContent = async () => {
    const ok = await confirm({
      title: "Supprimer tout le contenu ?",
      description: "Toutes les déclinaisons de ce contenu seront supprimées, publiées comprises.",
      confirmText: "Supprimer tout le contenu",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyState(true);
    try {
      await removeWholeContent();
    } catch (e) {
      toastError(toast, e);
    } finally {
      setBusyState(false);
    }
  };

  /** Statut, marquage publié et suppression de la déclinaison d'un onglet. */
  const declinationBar = (c: SocialChannel) => {
    const saved = group?.posts.some((p) => p.channel_id === c.id) ?? false;
    const published = publishedChannelIds.has(c.id);
    const status: SocialDraftStatus = statuses[c.id] ?? "unscheduled";
    return (
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded border bg-muted/40 px-3 py-2 text-sm" data-testid="social-declination-bar">
        {published ? (
          <Badge variant="default">{DISPLAY_STATUS_LABELS.published}</Badge>
        ) : (
          <Select value={status} onValueChange={(v) => changeStatus(c.id, v as SocialDraftStatus)} disabled={busy}>
            <SelectTrigger className="h-8 w-36" aria-label={`Statut ${c.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unscheduled">{DISPLAY_STATUS_LABELS.unscheduled}</SelectItem>
              <SelectItem value="scheduled">{DISPLAY_STATUS_LABELS.scheduled}</SelectItem>
            </SelectContent>
          </Select>
        )}
        {published && <span className="text-xs text-muted-foreground">Publié, modifié seul</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!published && !date && (
            <span className="text-xs text-muted-foreground">Planifiez une date pour marquer publié</span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !saved || (!published && !date)}
            onClick={() => togglePublished(c.id)}
          >
            {published ? "Annuler le marquage" : "Marquer publié"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => deleteDeclination(c.id)}>
            <Trash2 className="h-4 w-4 mr-1" /> Supprimer cette déclinaison
          </Button>
        </div>
      </div>
    );
  };

  /** Visuels choisis relus : un visuel absent du résultat (supprimé) compte comme manquant. */
  const libraryReady = !mediaQuery.isPending && !mediaQuery.isError && !mediaQuery.isPlaceholderData;

  const liveAlerts = useMemo(
    () => alertsByChannel(
      buildGroupPosts(toDraft(formValues)).map((p) => ({
        ...p,
        media_id: p.media_id && libraryReady && !mediaById.has(p.media_id) ? null : p.media_id,
        publication_status: publishedChannelIds.has(p.channel_id) ? "published" as const : undefined,
      })),
      channelsById,
    ),
    [formValues, channelsById, toDraft, libraryReady, mediaById, publishedChannelIds],
  );

  const loading = channelsLoading || (!!groupId && initializedFor.current !== groupId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {groupId ? "Modifier le contenu" : "Nouveau contenu"}
            <span className="text-xs font-normal text-muted-foreground">
              {autoSaving ? (
                <span className="flex items-center gap-1"><Spinner size="sm" className="h-3 w-3" /> Enregistrement...</span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> Sauvegardé</span>
              ) : null}
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Canaux</Label>
              <TooltipProvider>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {channels.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded border px-3 py-2 cursor-pointer">
                      <Checkbox
                        checked={channelIds.includes(c.id)}
                        disabled={publishedChannelIds.has(c.id)}
                        title={publishedChannelIds.has(c.id) ? "Déclinaison publiée : supprimez-la pour la retirer" : undefined}
                        onCheckedChange={(v) => toggleChannel(c.id, v === true)}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline">{c.abbreviation}</Badge>
                        </TooltipTrigger>
                        <TooltipContent>{c.name}</TooltipContent>
                      </Tooltip>
                      <span className="text-sm">{c.name}</span>
                    </label>
                  ))}
                </div>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as SocialFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOCIAL_FORMAT_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Thème</Label>
                <Select
                  value={!themesReady ? "" : themeId && themes.some((t) => t.id === themeId) ? themeId : NO_THEME}
                  onValueChange={(v) => setThemeId(v === NO_THEME ? null : v)}
                  disabled={!themesReady}
                >
                  <SelectTrigger aria-label="Thème">
                    <SelectValue placeholder={themesQuery.isError ? "Thèmes indisponibles" : "Chargement des thèmes..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_THEME}>Sans thème</SelectItem>
                    {themes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} aria-hidden="true" />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 sm:pt-6">
                <Switch id="social-sync" checked={sync} onCheckedChange={toggleSync} />
                <Label htmlFor="social-sync">Texte commun à tous les canaux</Label>
              </div>
            </div>

            {orderedSelected.length === 0 ? (
              <div className="space-y-1">
                <Label htmlFor="social-text">Texte</Label>
                <Textarea id="social-text" rows={8} style={demoBlur(isDemoMode)} value={commonText} onChange={(e) => setCommonText(e.target.value)} />
                <div className="pt-2">
                  <VisualField
                    label="Visuel"
                    mediaId={commonMediaId}
                    mediaById={mediaById}
                    onPick={() => setPickerFor(COMMON_VISUAL)}
                    onRemove={() => setCommonMediaId(null)}
                  />
                </div>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex flex-wrap h-auto">
                  {orderedSelected.map((c) => (
                    <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>
                  ))}
                </TabsList>
                {orderedSelected.map((c) => (
                  <TabsContent key={c.id} value={c.id}>
                    {declinationBar(c)}
                    {sync && !publishedChannelIds.has(c.id) ? (
                      <div className="space-y-1">
                        <Label htmlFor="social-text">Texte</Label>
                        <Textarea id="social-text" rows={8} style={demoBlur(isDemoMode)} value={commonText} onChange={(e) => setCommonText(e.target.value)} />
                        <div className="pt-2">
                          <VisualField
                            label="Visuel"
                            mediaId={commonMediaId}
                            mediaById={mediaById}
                            onPick={() => setPickerFor(COMMON_VISUAL)}
                            onRemove={() => setCommonMediaId(null)}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <Textarea
                          aria-label={`Texte ${c.name}`}
                          rows={8}
                          style={demoBlur(isDemoMode)}
                          value={texts[c.id] ?? ""}
                          onChange={(e) => setTexts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        />
                        <div className="pt-2">
                          <VisualField
                            label={`Visuel ${c.name}`}
                            mediaId={c.id in mediaIds ? mediaIds[c.id] : commonMediaId}
                            mediaById={mediaById}
                            onPick={() => setPickerFor(c.id)}
                            onRemove={() => setVisual(c.id, null)}
                          />
                        </div>
                      </>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="social-date">Date (heure de Paris, facultative)</Label>
                <Input id="social-date" type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="social-time">Heure</Label>
                <Input id="social-time" type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value || (date ? DEFAULT_TIME : ""))} />
              </div>
            </div>
            {date && (
              <Button variant="ghost" size="sm" onClick={clearDate}>
                Retirer la date
              </Button>
            )}

            {liveAlerts.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" aria-live="polite" data-testid="social-composer-alerts">
                <p className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-4 w-4" /> Alertes (l'enregistrement reste possible)
                </p>
                <ul className="mt-1 space-y-0.5">
                  {liveAlerts.map((a) => (
                    <li key={a.channelId}>
                      <span className="font-medium">{channelsById.get(a.channelId)?.name ?? "Canal"}</span> : {a.alerts.map(formatAlert).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {(groupId || savedOnce) && !loading && (
            <Button variant="ghost" className="text-destructive sm:mr-auto" disabled={busy} onClick={deleteContent}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer tout le contenu
            </Button>
          )}
          <Button variant="outline" onClick={() => handleClose(false)}>Fermer</Button>
          <Button onClick={handleSave} disabled={save.isPending || loading}>
            {save.isPending ? <Spinner size="sm" /> : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog />
      <SocialMediaPicker
        open={pickerFor !== null}
        onOpenChange={(next) => { if (!next) setPickerFor(null); }}
        onSelect={(mediaId) => { if (pickerFor) setVisual(pickerFor, mediaId); }}
      />
    </Dialog>
  );
}
