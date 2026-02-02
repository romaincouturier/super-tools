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

const ALL_MODULES: AppModule[] = [
  "micro_devis",
  "formations",
  "evaluations",
  "certificates",
  "ameliorations",
  "historique",
  "contenu",
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
      // Get all users from user_module_access table
      const { data: accessData, error: accessError } = await supabase
        .from("user_module_access")
        .select("user_id, module");

      if (accessError) throw accessError;

      // Group by user
      const userMap = new Map<string, AppModule[]>();
      accessData?.forEach((row) => {
        const existing = userMap.get(row.user_id) || [];
        existing.push(row.module as AppModule);
        userMap.set(row.user_id, existing);
      });

      // For now, we'll show users that have at least one module access
      // In a real scenario, you might want to fetch from a profiles table
      const userList: UserWithAccess[] = [];
      
      // Get current user to exclude admin
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // We need to get user emails - since we don't have direct access to auth.users,
      // we'll need to work with what we have. For now, we'll show user IDs
      // In production, you'd want a profiles table to store emails
      userMap.forEach((modules, userId) => {
        if (currentUser?.id !== userId) {
          userList.push({
            id: userId,
            email: `Utilisateur ${userId.slice(0, 8)}...`,
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
        // Remove access
        const { error } = await supabase
          .from("user_module_access")
          .delete()
          .eq("user_id", userId)
          .eq("module", module);

        if (error) throw error;
      } else {
        // Grant access
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("user_module_access")
          .insert({
            user_id: userId,
            module,
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
          <div className="space-y-6">
            {users.map((user) => (
              <div key={user.id} className="border rounded-lg p-4 space-y-4">
                <div className="font-medium">{user.email}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {ALL_MODULES.map((module) => {
                    const hasAccess = user.modules.includes(module);
                    const isUpdating = updating === `${user.id}-${module}`;
                    
                    return (
                      <div key={module} className="flex items-center justify-between gap-2">
                        <Label
                          htmlFor={`${user.id}-${module}`}
                          className="text-sm cursor-pointer"
                        >
                          {MODULE_LABELS[module]}
                        </Label>
                        <Switch
                          id={`${user.id}-${module}`}
                          checked={hasAccess}
                          onCheckedChange={() => toggleModuleAccess(user.id, module, hasAccess)}
                          disabled={isUpdating}
                        />
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
