import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Shield, Megaphone } from "lucide-react";
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
  const [updating, setUpdating] = useState<string | null>(null);
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

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, email, display_name, first_name, last_name");

      const profileMap = new Map<string, { email: string; first_name: string | null; last_name: string | null }>();
      (profilesData || []).forEach((p) => {
        profileMap.set(p.user_id, {
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
        });
      });

      const userMap = new Map<string, AppModule[]>();
      accessData?.forEach((row) => {
        const existing = userMap.get(row.user_id) || [];
        existing.push(row.module as AppModule);
        userMap.set(row.user_id, existing);
      });

      const userList: UserWithAccess[] = [];
      
      userMap.forEach((modules, userId) => {
        if (currentUser?.id !== userId) {
          const profile = profileMap.get(userId);
          const displayName = profile?.first_name && profile?.last_name 
            ? `${profile.first_name} ${profile.last_name}`
            : profile?.email || `Utilisateur ${userId.slice(0, 8)}...`;
          userList.push({
            id: userId,
            email: profile?.email || "",
            displayName,
            modules,
          });
        }
      });

      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
      toastError(toast, "Impossible de charger la liste des utilisateurs.");
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleAccess = async (userId: string, module: AppModule, currentlyHasAccess: boolean) => {
    setUpdating(`${userId}-${module}`);
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
          .insert({
            user_id: userId,
            module: module as any,
            granted_by: user?.id,
          } as any);

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

      toast({
        title: "Accès mis à jour",
        description: currentlyHasAccess
          ? `Accès au module "${MODULE_LABELS[module]}" retiré.`
          : `Accès au module "${MODULE_LABELS[module]}" accordé.`,
      });
    } catch (error) {
      console.error("Error toggling access:", error);
      toastError(toast, "Impossible de modifier l'accès.");
    } finally {
      setUpdating(null);
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
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Gestion des accès utilisateurs</CardTitle>
          </div>
          <OnboardCollaboratorDialog isAdmin />
        </div>
        <CardDescription>
          Gérez les accès aux différents modules et définissez les rôles clés.
        </CardDescription>
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
            {users.map((user) => (
              <div key={user.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="font-medium">{user.displayName}</div>
                  {commManagerId === user.id && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">📢 Resp. communication</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {ALL_MODULES.map((module) => {
                    const hasAccess = user.modules.includes(module);
                    const isUpdating = updating === `${user.id}-${module}`;
                    
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
