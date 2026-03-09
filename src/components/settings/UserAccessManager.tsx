import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Shield, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
      (profilesData as any[] || []).forEach((p: any) => {
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
      toast({
        title: "Erreur",
        description: "Impossible de charger la liste des utilisateurs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleAccess = async (userId: string, module: AppModule, currentlyHasAccess: boolean) => {
    setUpdating(`${userId}-${module}`);
    try {
      if (currentlyHasAccess) {
        const { error } = await (supabase as any)
          .from("user_module_access")
          .delete()
          .eq("user_id", userId)
          .eq("module", module);

        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from("user_module_access")
          .insert({
            user_id: userId,
            module,
            granted_by: user?.id,
          });

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
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'accès.",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const updateJobTitle = async (userId: string, jobTitle: string) => {
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ job_title: jobTitle.trim() || null })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, jobTitle } : u)
      );
    } catch (error) {
      console.error("Error updating job title:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la fonction.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
          Gérez les accès aux différents modules et la fonction de chaque utilisateur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-muted-foreground text-sm hidden sm:block">·</div>
                  <Input
                    value={user.jobTitle}
                    onChange={(e) => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, jobTitle: e.target.value } : u))}
                    onBlur={(e) => updateJobTitle(user.id, e.target.value)}
                    placeholder="Fonction (ex: Chargée de communication)"
                    className="h-7 text-sm max-w-xs"
                  />
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
