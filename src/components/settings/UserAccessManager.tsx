import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppModule, MODULE_LABELS } from "@/hooks/useModuleAccess";

interface UserWithAccess {
  id: string;
  email: string;
  modules: AppModule[];
}

// Only include modules that exist in the database enum
const ALL_MODULES: AppModule[] = [
  "micro_devis",
  "formations",
  "evaluations",
  "certificates",
  "ameliorations",
  "historique",
  "contenu",
  "besoins",
  "parametres",
];

export default function UserAccessManager() {
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Get current user to exclude admin
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Get all users from user_module_access table with profiles
      const { data: accessData, error: accessError } = await supabase
        .from("user_module_access")
        .select("user_id, module");

      if (accessError) throw accessError;

      // Get profiles for names
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, email, display_name, first_name, last_name");

      const profileMap = new Map<string, { email: string; first_name: string | null; last_name: string | null }>();
      profilesData?.forEach((p: any) => {
        profileMap.set(p.user_id, { 
          email: p.email, 
          first_name: p.first_name,
          last_name: p.last_name 
        });
      });

      // Group by user
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
            email: displayName,
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
    // Don't allow toggling 'emails' module since it doesn't exist in DB enum
    if (module === "emails") return;
    
    setUpdating(`${userId}-${module}`);
    try {
      if (currentlyHasAccess) {
        // Remove access
        const { error } = await supabase
          .from("user_module_access")
          .delete()
          .eq("user_id", userId)
          .eq("module", module as "ameliorations" | "besoins" | "certificates" | "contenu" | "evaluations" | "formations" | "historique" | "micro_devis" | "parametres");

        if (error) throw error;
      } else {
        // Grant access
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("user_module_access")
          .insert({
            user_id: userId,
            module: module as "ameliorations" | "besoins" | "certificates" | "contenu" | "evaluations" | "formations" | "historique" | "micro_devis" | "parametres",
            granted_by: user?.id,
          });

        if (error) throw error;
      }

      // Update local state
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
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Gestion des accès utilisateurs</CardTitle>
        </div>
        <CardDescription>
          Gérez les accès aux différents modules de l'application pour chaque utilisateur.
          En tant qu'administrateur, vous avez accès à tous les modules.
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
                <div className="font-medium mb-3">{user.email}</div>
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
