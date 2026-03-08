import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Building2, Users, Flag, Shield } from "lucide-react";
import { toast } from "sonner";
import PageLoading from "@/components/PageLoading";

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_default: boolean;
  created_at: string;
  max_participants: number;
  max_active_trainings: number;
}

interface FeatureFlag {
  setting_key: string;
  setting_value: string | null;
  description: string | null;
}

const FEATURE_FLAGS = ["multi_tenant_enabled", "i18n_enabled", "billing_enabled"];

export default function Admin() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [orgsRes, flagsRes] = await Promise.all([
      supabase.from("organizations").select("*").order("created_at"),
      supabase.from("app_settings").select("setting_key, setting_value, description").in("setting_key", FEATURE_FLAGS),
    ]);

    if (orgsRes.data) {
      setOrgs(orgsRes.data as unknown as Organization[]);
      // Get member counts
      const counts: Record<string, number> = {};
      for (const org of orgsRes.data) {
        const { count } = await supabase
          .from("org_members")
          .select("*", { count: "exact", head: true })
          .eq("org_id", org.id);
        counts[org.id] = count || 0;
      }
      setMemberCounts(counts);
    }

    if (flagsRes.data) {
      setFlags(flagsRes.data as FeatureFlag[]);
    }

    setLoading(false);
  };

  const toggleFlag = async (key: string, currentValue: string | null) => {
    const newValue = currentValue === "true" ? "false" : "true";
    const { error } = await supabase
      .from("app_settings")
      .update({ setting_value: newValue })
      .eq("setting_key", key);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    setFlags((prev) =>
      prev.map((f) => (f.setting_key === key ? { ...f, setting_value: newValue } : f))
    );
    toast.success(`${key} → ${newValue === "true" ? "Activé" : "Désactivé"}`);
  };

  if (authLoading || loading) return <PageLoading />;

  return (
    <ModuleLayout>
      <div className="space-y-6">
        <PageHeader title={t("admin.title")} icon={Shield} backTo="/" />

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              {t("admin.featureFlags")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {flags.map((flag) => (
              <div key={flag.setting_key} className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">{flag.setting_key}</Label>
                  {flag.description && (
                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={flag.setting_value === "true" ? "default" : "secondary"}>
                    {flag.setting_value === "true" ? t("admin.flagEnabled") : t("admin.flagDisabled")}
                  </Badge>
                  <Switch
                    checked={flag.setting_value === "true"}
                    onCheckedChange={() => toggleFlag(flag.setting_key, flag.setting_value)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t("admin.organizations")} ({orgs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orgs.length === 0 ? (
              <p className="text-muted-foreground">{t("admin.noOrgs")}</p>
            ) : (
              <div className="space-y-3">
                {orgs.map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-sm text-muted-foreground">/{org.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{org.plan}</Badge>
                      {org.is_default && <Badge>Défaut</Badge>}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {memberCounts[org.id] ?? 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  );
}
