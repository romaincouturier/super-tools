import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlag } from "./useFeatureFlag";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: string;
  is_default: boolean;
  settings: Record<string, unknown>;
  max_participants: number;
  max_active_trainings: number;
  storage_limit_mb: number;
}

interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

/**
 * Hook to get the current user's organization.
 * Returns null when multi-tenant is disabled (feature flag off).
 * When enabled, fetches the user's org via org_members.
 */
export function useOrganization() {
  const multiTenantEnabled = useFeatureFlag("multi_tenant_enabled");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!multiTenantEnabled) {
      setOrganization(null);
      setMembership(null);
      return;
    }

    let mounted = true;
    setLoading(true);

    const fetchOrg = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Get user's org membership
      const { data: memberData } = await supabase
        .from("org_members")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!memberData || !mounted) {
        setLoading(false);
        return;
      }

      setMembership(memberData as OrgMember);

      // Get org details
      const { data: orgData } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", memberData.org_id)
        .single();

      if (mounted && orgData) {
        setOrganization(orgData as unknown as Organization);
      }
      if (mounted) setLoading(false);
    };

    fetchOrg();
    return () => { mounted = false; };
  }, [multiTenantEnabled]);

  return {
    organization,
    membership,
    loading,
    isMultiTenant: multiTenantEnabled,
    orgId: organization?.id ?? null,
    userRole: membership?.role ?? null,
  };
}
