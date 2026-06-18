import { useState } from "react";
import { Loader2, Users, Send, ChevronRight, UserPlus, UserMinus } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { getInitials } from "@/lib/stringUtils";
import {
  useAllMatchingPosts,
  usePostGroups,
  useUnassignedRegistrations,
  useFormGroups,
  useAddMemberToGroup,
  useRemoveMemberFromGroup,
  useSendGroupEmail,
  type MatchingPostSummary,
  type GroupMatchingGroup,
  type GroupMatchingRegistration,
} from "@/hooks/useGroupMatching";

// ── Avatar ────────────────────────────────────────────────────────────────────

function MiniAvatar({ email, firstName, lastName, photoUrl }: { email: string; firstName?: string | null; lastName?: string | null; photoUrl?: string | null }) {
  const initials = getInitials(firstName ?? "", lastName ?? "", email.slice(0, 2).toUpperCase());
  return (
    <div
      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold shrink-0"
      style={{ background: photoUrl ? "transparent" : "var(--st-yellow)", color: "#101820" }}
      title={[firstName, lastName].filter(Boolean).join(" ") || email}
    >
      {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

// ── Wave sheet ────────────────────────────────────────────────────────────────

function WaveSheet({ post, onClose }: { post: MatchingPostSummary; onClose: () => void }) {
  const { data: groups = [], isLoading: groupsLoading } = usePostGroups(post.post_id);
  const { data: unassigned = [], isLoading: unassignedLoading } = useUnassignedRegistrations(post.post_id);
  const formGroups = useFormGroups(post.post_id);
  const addMember = useAddMemberToGroup(post.post_id);
  const removeMember = useRemoveMemberFromGroup(post.post_id);
  const sendEmail = useSendGroupEmail();
  const [sending, setSending] = useState<string | null>(null);
  const { toast } = useToast();

  const canFormAtLeastOne = unassigned.length >= post.group_size;

  const handleFormGroups = async () => {
    try {
      const created = await formGroups.mutateAsync({ groupSize: post.group_size });
      if (created.length === 0) {
        toast({ title: `Pas assez d'inscrits pour former un groupe de ${post.group_size}.` });
      } else {
        toast({ title: `${created.length} groupe(s) créé(s).` });
      }
    } catch {
      toastError(toast, "Impossible de former les groupes.");
    }
  };

  const handleAddToGroup = async (group: GroupMatchingGroup, reg: GroupMatchingRegistration) => {
    try {
      await addMember.mutateAsync({ groupId: group.id, registrationId: reg.id, learnerEmail: reg.learner_email });
    } catch {
      toastError(toast, "Impossible d'ajouter au groupe.");
    }
  };

  const handleRemoveFromGroup = async (groupId: string, registrationId?: string) => {
    if (!registrationId) return;
    try {
      await removeMember.mutateAsync({ groupId, registrationId });
    } catch {
      toastError(toast, "Impossible de détacher du groupe.");
    }
  };

  const handleSendAll = async () => {
    const unsent = groups.filter((g) => !g.email_sent_at);
    if (!unsent.length) { toast({ title: "Tous les emails ont déjà été envoyés." }); return; }
    for (const g of unsent) {
      setSending(g.id);
      try {
        await sendEmail.mutateAsync(g.id);
      } catch {
        toastError(toast, `Échec pour le groupe ${g.id.slice(0, 8)}`);
      }
    }
    setSending(null);
    toast({ title: "Mises en relation envoyées !", description: `${unsent.length} groupe(s) notifié(s).` });
  };

  const isLoading = groupsLoading || unassignedLoading;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col overflow-y-auto">
        <SheetHeader className="shrink-0">
          <SheetTitle>Mise en relation — groupes de {post.group_size}</SheetTitle>
          <p className="text-sm text-muted-foreground line-clamp-2">{post.post_content ?? "Post sans texte"}</p>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="flex-1 space-y-6 py-4">

            {/* Unassigned learners */}
            {unassigned.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {unassigned.length} inscrit(s) en attente d'un groupe
                  </p>
                  {canFormAtLeastOne && (
                    <Button size="sm" onClick={handleFormGroups} disabled={formGroups.isPending}>
                      {formGroups.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                      Créer {Math.floor(unassigned.length / post.group_size)} nouveau(x) groupe(s) de {post.group_size}
                    </Button>
                  )}
                </div>

                {groups.length === 0 && !canFormAtLeastOne && (
                  <p className="text-xs text-muted-foreground">
                    Il faut au moins {post.group_size} inscrits pour former un premier groupe.
                  </p>
                )}

                <div className="space-y-2">
                  {unassigned.map((reg) => (
                    <div key={reg.id} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium">{reg.learner_email}</p>
                      {groups.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs text-muted-foreground self-center">
                            Ajouter à un groupe existant :
                          </span>
                          {groups.map((g, idx) => (
                            <Button
                              key={g.id}
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddToGroup(g, reg)}
                              disabled={addMember.isPending}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Groupe #{idx + 1} ({g.members.length})
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Aucun groupe existant pour le moment.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formed groups */}
            {groups.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Groupes formés ({groups.length})</p>
                <div className="space-y-2">
                  {groups.map((g, i) => (
                    <div key={g.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Groupe #{i + 1}</span>
                        <div className="flex items-center gap-2">
                          {g.email_sent_at ? (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-200">Email envoyé</Badge>
                          ) : sending === g.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {g.members.map((m) => (
                          <div key={m.learner_email} className="flex items-center gap-2">
                            <MiniAvatar
                              email={m.learner_email}
                              firstName={m.first_name}
                              lastName={m.last_name}
                              photoUrl={m.photo_url}
                            />
                            <span className="flex-1 min-w-0 text-sm truncate">
                              {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.learner_email}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveFromGroup(g.id, m.registration_id)}
                              disabled={removeMember.isPending || !m.registration_id}
                              title="Détacher du groupe"
                            >
                              <UserMinus className="h-3 w-3 mr-1" />
                              Détacher
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {groups.length === 0 && unassigned.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun inscrit en attente.
              </p>
            )}
          </div>
        )}

        <SheetFooter className="shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          {groups.some((g) => !g.email_sent_at) && (
            <Button onClick={handleSendAll} disabled={!!sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Envoyer les mises en relation
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Post summary card ─────────────────────────────────────────────────────────

function MatchingPostCard({ post }: { post: MatchingPostSummary }) {
  const [waveOpen, setWaveOpen] = useState(false);

  return (
    <>
      <Card>
        <CardContent className="p-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,209,0,0.15)" }}>
            <Users className="h-5 w-5" style={{ color: "var(--st-ink)" }} />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium line-clamp-2" style={{ color: "var(--st-ink)" }}>
              {post.post_content ?? <span className="text-muted-foreground italic">Post sans texte</span>}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Groupes de {post.group_size}</span>
              <span>·</span>
              <span>{post.pending_count} en attente</span>
              <span>·</span>
              <span>{post.assigned_count} assigné(s)</span>
              <span>·</span>
              <span>{post.group_count} groupe(s) formé(s)</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setWaveOpen(true)}
          >
            Nouvelle vague <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </CardContent>
      </Card>
      {waveOpen && <WaveSheet post={post} onClose={() => setWaveOpen(false)} />}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LmsGroupMatching() {
  const { data: posts = [], isLoading } = useAllMatchingPosts();

  return (
    <ModuleLayout>
      <PageHeader title="Mise en relation" />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center gap-3">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Aucun post de mise en relation</p>
            <p className="text-sm text-muted-foreground">
              Activez l'option "Binômes" lors de la publication d'un post dans la communauté.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <MatchingPostCard key={p.post_id} post={p} />
          ))}
        </div>
      )}
    </ModuleLayout>
  );
}
