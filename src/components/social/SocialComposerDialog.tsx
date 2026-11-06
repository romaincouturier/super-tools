import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ImageIcon } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useMediaLibrary, type MediaItem } from "@/hooks/useMedia";
import { useAutoSaveForm, type AutoSaveFormValues } from "@/hooks/useAutoSaveForm";
import { useConfirm } from "@/hooks/useConfirm";
import { useSaveSocialGroup, useSocialChannels, useSocialGroup } from "@/hooks/useSocialContents";
import { toastError } from "@/lib/toastError";
import { formatAlert } from "../../../supabase/functions/_shared/social-post-alerts";
import {
  NO_CHANNEL_MESSAGE,
  alertsByChannel,
  buildGroupPosts,
  SOCIAL_FORMAT_LABELS,
  parisLocalToUtcIso,
  utcIsoToParisLocal,
  type SocialFormat,
  type SocialGroupDraft,
} from "@/services/socialContents";

interface ComposerValues extends AutoSaveFormValues {
  channelIds: string[];
  format: SocialFormat;
  sync: boolean;
  commonText: string;
  texts: Record<string, string>;
  commonMediaId: string | null;
  mediaIds: Record<string, string | null>;
  date: string;
  time: string;
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

interface SocialComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contenu existant à rouvrir, null pour un nouveau contenu. */
  groupId: string | null;
}

export default function SocialComposerDialog({ open, onOpenChange, groupId }: SocialComposerDialogProps) {
  const { toast } = useToast();
  const { data: channels = [], isLoading: channelsLoading } = useSocialChannels();
  const {
    data: group, isFetching: groupFetching, isPending: groupPending, isError: groupError,
  } = useSocialGroup(open ? groupId : null);
  const save = useSaveSocialGroup();
  const { confirm, ConfirmDialog } = useConfirm();
  const mediaQuery = useMediaLibrary({ enabled: open });
  const mediaLibrary = mediaQuery.data;
  const mediaById = useMemo(() => new Map((mediaLibrary ?? []).map((m) => [m.id, m])), [mediaLibrary]);
  const channelsById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const [currentId, setCurrentId] = useState<string>("");
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [format, setFormat] = useState<SocialFormat>("post");
  const [sync, setSync] = useState(true);
  const [commonText, setCommonText] = useState("");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [commonMediaId, setCommonMediaId] = useState<string | null>(null);
  const [mediaIds, setMediaIds] = useState<Record<string, string | null>>({});
  /** Cible du sélecteur ouvert : visuel commun ou identifiant du canal. */
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [date, setDate] = useState("");
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
    channelIds: v.channelIds,
    commonText: v.commonText,
    texts: v.texts,
    commonMediaId: v.commonMediaId,
    mediaIds: v.mediaIds,
    scheduledAt: v.date ? parisLocalToUtcIso(v.date, v.time || DEFAULT_TIME) : null,
  }), [currentId]);

  const { mutateAsync } = save;
  const runSave = useCallback((v: ComposerValues): Promise<boolean> => {
    const draft = toDraft(v);
    const run = saveChain.current.then(async () => {
      try {
        await mutateAsync(draft);
        lastSaveFailed.current = false;
        return true;
      } catch (e) {
        lastSaveFailed.current = true;
        toastError(toast, e);
        return false;
      }
    });
    saveChain.current = run;
    return run;
  }, [mutateAsync, toDraft, toast]);

  const handleAutoSave = useCallback(async (values: AutoSaveFormValues): Promise<boolean> => {
    const v = values as ComposerValues;
    if (!currentId || v.channelIds.length === 0) return false;
    return runSave(v);
  }, [currentId, runSave]);

  const formValues = useMemo<ComposerValues>(
    () => ({ channelIds, format, sync, commonText, texts, commonMediaId, mediaIds, date, time }),
    [channelIds, format, sync, commonText, texts, commonMediaId, mediaIds, date, time],
  );

  const { autoSaving, lastSaved, resetTracking, flushAndGetPending } = useAutoSaveForm({
    open: open && !!currentId,
    formValues,
    onSave: handleAutoSave,
  });

  useEffect(() => {
    if (!open) {
      initializedFor.current = null;
      setCurrentId("");
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
    const scheduled = posts.find((p) => p.scheduled_at)?.scheduled_at ?? null;
    const local = scheduled ? utcIsoToParisLocal(scheduled) : null;
    setCurrentId(group?.id ?? groupId ?? crypto.randomUUID());
    setChannelIds(ids);
    setFormat(group?.format ?? "post");
    setSync(group?.sync ?? true);
    setCommonText(firstText);
    setTexts(Object.fromEntries(posts.map((p) => [p.channel_id, p.text])));
    setCommonMediaId(reference?.media_id ?? null);
    setMediaIds(Object.fromEntries(posts.map((p) => [p.channel_id, p.media_id ?? null])));
    setPickerFor(null);
    setDate(local?.date ?? "");
    setTime(local?.time ?? "");
    setActiveTab(ids[0] ?? "");
    resetTracking();
  }, [open, groupId, group, groupFetching, groupPending, groupError, resetTracking, toast, onOpenChange]);

  const orderedSelected = channels.filter((c) => channelIds.includes(c.id));

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
    if (next) {
      const tab = activeTab && channelIds.includes(activeTab) ? activeTab : orderedSelected[0]?.id;
      const distinct = new Set(channelIds.map((id) => JSON.stringify([
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
      setTexts(Object.fromEntries(channelIds.map((id) => [id, commonText])));
      setMediaIds(Object.fromEntries(channelIds.map((id) => [id, commonMediaId])));
      if (!activeTab || !channelIds.includes(activeTab)) setActiveTab(orderedSelected[0]?.id ?? "");
    }
    setSync(next);
  };

  const changeDate = (value: string) => {
    setDate(value);
    if (value && !time) setTime(DEFAULT_TIME);
  };

  const handleClose = (isOpen: boolean) => {
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

  const publishedChannelIds = useMemo(
    () => new Set((groupId && group ? group.posts : [])
      .filter((p) => p.publication_status === "published")
      .map((p) => p.channel_id)),
    [groupId, group],
  );
  /** Médiathèque chargée : un visuel absent de la liste (supprimé) compte comme manquant. */
  const libraryReady = !mediaQuery.isPending && !mediaQuery.isError;

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
              <div className="flex items-center gap-2 sm:pt-6">
                <Switch id="social-sync" checked={sync} onCheckedChange={toggleSync} />
                <Label htmlFor="social-sync">Texte commun à tous les canaux</Label>
              </div>
            </div>

            {sync || orderedSelected.length === 0 ? (
              <div className="space-y-1">
                <Label htmlFor="social-text">Texte</Label>
                <Textarea id="social-text" rows={8} value={commonText} onChange={(e) => setCommonText(e.target.value)} />
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
                    <Textarea
                      aria-label={`Texte ${c.name}`}
                      rows={8}
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
              <Button variant="ghost" size="sm" onClick={() => { setDate(""); setTime(""); }}>
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
