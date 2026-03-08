import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Flag, Shield, BarChart3, CreditCard } from "lucide-react";
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

interface OrgStats {
  trainings: number;
  participants: number;
  missions: number;
  members: number;
}

const FEATURE_FLAGS = ["multi_tenant_enabled", "i18n_enabled", "billing_enabled"];
const PLANS = ["free", "pro", "business"];

export default function Admin() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [orgStats, setOrgStats] = useState<Record<string, OrgStats>>({});
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
      const stats: Record<string, OrgStats> = {};
      for (const org of orgsRes.data) {
        const [members, trainings, participants, missions] = await Promise.all([
          supabase.from("org_members").select("*", { count: "exact", head: true }).eq("org_id", org.id),
          supabase.from("trainings").select("*", { count: "exact", head: true }).eq("org_id", org.id),
          supabase.from("training_participants").select("id, training_id, trainings!inner(org_id)", { count: "exact", head: true }).eq("trainings.org_id" as any, org.id),
          supabase.from("missions").select("*", { count: "exact", head: true }).eq("org_id", org.id),
        ]);
        stats[org.id] = {
          members: members.count || 0,
          trainings: trainings.count || 0,
          participants: participants.count || 0,
          missions: missions.count || 0,
        };
      }
      setOrgStats(stats);
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

  const updateOrgPlan = async (orgId: string, plan: string) => {
    const { error } = await supabase
      .from("organizations")
      .update({ plan })
      .eq("id", orgId);

    if (error) {
      toast.error("Erreur lors de la mise à jour du plan");
      return;
    }

    setOrgs((prev) => prev.map((o) => (o.id === orgId ? { ...o, plan } : o)));
    toast.success(`Plan mis à jour → ${plan}`);
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
            <CardDescription>
              Activer ou désactiver les fonctionnalités globales de la plateforme.
            </CardDescription>
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
            <CardDescription>
              Gestion des organisations et de leurs plans.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orgs.length === 0 ? (
              <p className="text-muted-foreground">{t("admin.noOrgs")}</p>
            ) : (
              <div className="space-y-4">
                {orgs.map((org) => {
                  const stats = orgStats[org.id] || { members: 0, trainings: 0, participants: 0, missions: 0 };
                  return (
                    <div
                      key={org.id}
                      className="p-4 rounded-lg border bg-card space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{org.name}</p>
                            <p className="text-sm text-muted-foreground">/{org.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {org.is_default && <Badge>Défaut</Badge>}
                          <Select value={org.plan} onValueChange={(v) => updateOrgPlan(org.id, v)}>
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PLANS.map((p) => (
                                <SelectItem key={p} value={p}>
                                  <div className="flex items-center gap-1">
                                    <CreditCard className="h-3 w-3" />
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Usage stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Membres :</span>
                          <span className="font-medium">{stats.members}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Formations :</span>
                          <span className="font-medium">{stats.trainings}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Participants :</span>
                          <span className="font-medium">{stats.participants}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Missions :</span>
                          <span className="font-medium">{stats.missions}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  );
}
