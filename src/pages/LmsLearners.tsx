import { useState } from "react";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail } from "@/lib/demoMask";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Users,
  Search,
  MoreVertical,
  ShieldOff,
  ShieldCheck,
  Pencil,
  Trash2,
  Mail,
  CircleOff,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Spinner } from "@/components/ui/spinner";

interface LearnerAccount {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
}

async function callManage(action: string, params: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke("manage-learner-account", {
    body: { action, ...params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function LmsLearners() {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { isDemoMode } = useDemoMode();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editLearner, setEditLearner] = useState<LearnerAccount | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["lms-learners"],
    queryFn: async () => {
      const result = await callManage("list");
      return result.learners as LearnerAccount[];
    },
  });

  const learners = data ?? [];

  const filtered = learners.filter((l) =>
    l.email.toLowerCase().includes(search.toLowerCase())
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["lms-learners"] });

  const disableMutation = useMutation({
    mutationFn: (user_id: string) => callManage("disable", { user_id }),
    onSuccess: () => { toast({ title: "Compte désactivé" }); invalidate(); },
    onError: (e: Error) => toastError(toast, e),
  });

  const enableMutation = useMutation({
    mutationFn: (user_id: string) => callManage("enable", { user_id }),
    onSuccess: () => { toast({ title: "Compte réactivé" }); invalidate(); },
    onError: (e: Error) => toastError(toast, e),
  });

  const deleteMutation = useMutation({
    mutationFn: (user_id: string) => callManage("delete", { user_id }),
    onSuccess: () => { toast({ title: "Compte supprimé" }); invalidate(); },
    onError: (e: Error) => toastError(toast, e),
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({ user_id, email }: { user_id: string; email: string }) =>
      callManage("update_email", { user_id, email }),
    onSuccess: () => {
      toast({ title: "Email modifié" });
      setEditLearner(null);
      invalidate();
    },
    onError: (e: Error) => toastError(toast, e),
  });

  const handleDelete = async (learner: LearnerAccount) => {
    const ok = await confirm({
      title: "Supprimer ce compte apprenant ?",
      description: `Le compte de ${learner.email} sera définitivement supprimé. L'apprenant ne pourra plus se connecter. Cette action est irréversible.`,
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    deleteMutation.mutate(learner.id);
  };

  const handleDisable = async (learner: LearnerAccount) => {
    const ok = await confirm({
      title: "Désactiver ce compte ?",
      description: `${learner.email} ne pourra plus se connecter à l'espace apprenant. Vous pouvez le réactiver à tout moment.`,
      confirmText: "Désactiver",
      variant: "destructive",
    });
    if (!ok) return;
    disableMutation.mutate(learner.id);
  };

  const openEditEmail = (learner: LearnerAccount) => {
    setEditLearner(learner);
    setNewEmail(learner.email);
  };

  return (
    <ModuleLayout>
      <ConfirmDialog />
      <div className="container py-6 space-y-6 max-w-4xl">
        <PageHeader
          icon={Users}
          title="Comptes apprenants"
          subtitle="Gérez les accès des apprenants à l'espace e-learning"
          backTo="/lms"
        />

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} compte{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {search ? "Aucun apprenant trouvé pour cette recherche." : "Aucun compte apprenant créé."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.map((learner) => (
                  <div key={learner.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {learner.banned
                        ? <CircleOff className="w-4 h-4 text-destructive" />
                        : <Mail className="w-4 h-4 text-primary" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{isDemoMode ? maskEmail(learner.email) : learner.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Créé le {format(new Date(learner.created_at), "d MMM yyyy", { locale: fr })}
                        {learner.last_sign_in_at && (
                          <> · Dernière connexion {format(new Date(learner.last_sign_in_at), "d MMM yyyy", { locale: fr })}</>
                        )}
                        {!learner.last_sign_in_at && <> · Jamais connecté</>}
                      </p>
                    </div>
                    {learner.banned && (
                      <Badge variant="outline" className="text-destructive border-destructive/40 text-xs">
                        Désactivé
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditEmail(learner)}>
                          <Pencil className="w-4 h-4 mr-2" /> Modifier l'email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {learner.banned ? (
                          <DropdownMenuItem onClick={() => enableMutation.mutate(learner.id)}>
                            <ShieldCheck className="w-4 h-4 mr-2" /> Réactiver le compte
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleDisable(learner)}>
                            <ShieldOff className="w-4 h-4 mr-2" /> Désactiver le compte
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(learner)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Supprimer le compte
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit email dialog */}
      <Dialog open={!!editLearner} onOpenChange={(o) => !o && setEditLearner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nouvel email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLearner(null)}>Annuler</Button>
            <Button
              onClick={() => editLearner && updateEmailMutation.mutate({ user_id: editLearner.id, email: newEmail })}
              disabled={!newEmail.trim() || newEmail === editLearner?.email || updateEmailMutation.isPending}
            >
              {updateEmailMutation.isPending ? <Spinner /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
}
