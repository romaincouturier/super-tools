import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Shield, Megaphone, CheckCheck, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { AppModule, MODULE_LABELS, ALL_MODULES } from "@/hooks/useModuleAccess";
import OnboardCollaboratorDialog from "@/components/OnboardCollaboratorDialog";

interface UserWithAccess {
  id: string;
  email: string;
  displayName: string;
  modules: AppModule[];
}

export default function UserAccessManager() {
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [commManagerId, setCommManagerId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchCommManager();
  }, []);

  const fetchCommManager = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "communication_manager_user_id")
      .maybeSingle();
    if (data?.setting_value) setCommManagerId(data.setting_value);
  };

  const fetchUsers = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const { data: accessData, error: accessError } = await supabase
        .from("user_module_access")
        .select("user_id, module");

      if (accessError) throw accessError;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name, display_name, is_admin");
      
      if (profilesError) throw profilesError;

      const accessByUser: Record<string, AppModule[]> = {};
      for (const row of accessData || []) {
        if (!accessByUser[row.user_id]) accessByUser[row.user_id] = [];
        accessByUser[row.user_id].push(row.module as AppModule);
      }

      const allUserIds = new Set([
        ...Object.keys(accessByUser),
        ...(profiles || []).filter(p => !p.is_admin).map(p => p.user_id),
      ]);

      if (currentUser?.id) allUserIds.delete(currentUser.id);

      const userList: UserWithAccess[] = [];
      allUserIds.forEach((userId) => {
        const profile = profiles?.find(p => p.user_id === userId);
        if (profile?.is_admin) return;

        const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
          || profile?.display_name || profile?.email || userId;
        const modules = accessByUser[userId] || [];

        userList.push({
          id: userId,
          email: profile?.email || "",
          displayName,
          modules,
        });
      });

      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
      toastError(toast, "Impossible de charger la liste des utilisateurs.");
    } finally {
      setLoading(false);
    }
  };

  const markUpdating = (key: string, active: boolean) => {
    setUpdating((prev) => {
      const next = new Set(prev);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleModuleAccess = async (userId: string, module: AppModule, currentlyHasAccess: boolean) => {
    const key = `${userId}-${module}`;
    markUpdating(key, true);
    try {
      if (currentlyHasAccess) {
        const { error } = await supabase
          .from("user_module_access")
          .delete()
          .eq("user_id", userId)
          .eq("module", module as any);

        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("user_module_access")
          .upsert({
            user_id: userId,
            module: module as any,
            granted_by: user?.id,
          } as any, { onConflict: "user_id,module" });

        if (error) throw error;
      }

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              modules: currentlyHasAccess
                ? u.modules.filter((m) => m !== module)
                : [...u.modules, module],
            };
          }
          return u;
        })
      );
    } catch (error) {
      console.error("Error toggling access:", error);
      toastError(toast, "Impossible de modifier l'accès.");
    } finally {
      markUpdating(key, false);
    }
  };

  const toggleAllModules = async (userId: string, grantAll: boolean) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const allKey = `${userId}-all`;
    markUpdating(allKey, true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (grantAll) {
        // Insert all missing modules
        const missingModules = ALL_MODULES.filter((m) => !user.modules.includes(m));
        if (missingModules.length > 0) {
          const rows = missingModules.map((module) => ({
            user_id: userId,
            module: module as any,
            granted_by: currentUser?.id,
          }));

          // Use upsert to avoid duplicate key errors
          const { error } = await supabase
            .from("user_module_access")
            .upsert(rows as any[], { onConflict: "user_id,module" });

          if (error) throw error;
        }

        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, modules: [...ALL_MODULES] } : u
          )
        );

        toast({
          title: "Accès complet accordé",
          description: `${user.displayName} a maintenant accès à tous les modules.`,
        });
      } else {
        // Remove all modules
        const { error } = await supabase
          .from("user_module_access")
          .delete()
          .eq("user_id", userId);

        if (error) throw error;

        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, modules: [] } : u
          )
        );

        toast({
          title: "Accès retirés",
          description: `Tous les accès de ${user.displayName} ont été retirés.`,
        });
      }
    } catch (error) {
      console.error("Error toggling all modules:", error);
      toastError(toast, "Impossible de modifier les accès.");
    } finally {
      markUpdating(allKey, false);
    }
  };

  const saveCommManager = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ setting_key: "communication_manager_user_id", setting_value: userId, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });
      if (error) throw error;
      setCommManagerId(userId);
      const user = users.find(u => u.id === userId);
      toast({
        title: "Responsable communication défini",
        description: `${user?.displayName || "Utilisateur"} recevra les notifications de sessions complètes.`,
      });
    } catch (error) {
      console.error("Error saving comm manager:", error);
      toastError(toast, "Impossible de sauvegarder.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Gestion des accès
            </CardTitle>
            <CardDescription>Configurez les modules accessibles pour chaque collaborateur</CardDescription>
          </div>
          <OnboardCollaboratorDialog onSuccess={fetchUsers} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {users.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <Megaphone className="h-5 w-5 text-primary shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm font-medium whitespace-nowrap">Responsable communication :</Label>
              <Select value={commManagerId || ""} onValueChange={saveCommManager}>
                <SelectTrigger className="h-8 w-[220px] text-sm">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Reçoit les notifications de sessions complètes</span>
            </div>
          </div>
        )}

        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun utilisateur avec des accès configurés.</p>
            <p className="text-sm mt-2">
              Les utilisateurs apparaîtront ici une fois qu'ils auront été ajoutés via l'onboarding.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => {
              const allGranted = ALL_MODULES.every((m) => user.modules.includes(m));
              const isUpdatingAll = updating.has(`${user.id}-all`);

              return (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="font-medium">{user.displayName}</div>
                      {commManagerId === user.id && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">📢 Resp. communication</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAllModules(user.id, true)}
                        disabled={allGranted || isUpdatingAll}
                        className="gap-1.5 text-xs"
                      >
                        {isUpdatingAll && !allGranted ? <Spinner size="sm" /> : <CheckCheck className="h-3.5 w-3.5" />}
                        Tout activer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAllModules(user.id, false)}
                        disabled={user.modules.length === 0 || isUpdatingAll}
                        className="gap-1.5 text-xs"
                      >
                        {isUpdatingAll && allGranted ? <Spinner size="sm" /> : <XCircle className="h-3.5 w-3.5" />}
                        Tout retirer
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {ALL_MODULES.map((module) => {
                      const hasAccess = user.modules.includes(module);
                      const isUpdating = updating.has(`${user.id}-${module}`) || isUpdatingAll;
                      
                      return (
                        <div key={module} className="flex items-center gap-2">
                          <Switch
                            id={`${user.id}-${module}`}
                            checked={hasAccess}
                            onCheckedChange={() => toggleModuleAccess(user.id, module, hasAccess)}
                            disabled={isUpdating}
                            className="scale-90"
                          />
                          <Label
                            htmlFor={`${user.id}-${module}`}
                            className="text-sm cursor-pointer whitespace-nowrap"
                          >
                            {MODULE_LABELS[module]}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
