import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface UseAuthOptions {
  redirectTo?: string;
  checkPasswordChange?: boolean;
}

export function useAuth(options: UseAuthOptions = {}) {
  const { redirectTo = "/auth", checkPasswordChange = true } = options;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const checkPasswordChangeRequired = useCallback(async (userId: string) => {
    if (!checkPasswordChange) return false;
    
    try {
      const { data: metadata } = await supabase
        .from("user_security_metadata")
        .select("must_change_password")
        .eq("user_id", userId)
        .maybeSingle();

      return metadata?.must_change_password === true;
    } catch (error) {
      console.error("Error checking password change:", error);
      return false;
    }
  }, [checkPasswordChange]);

  useEffect(() => {
    let mounted = true;
    
    // Safety timeout to prevent infinite spinner
    const timeout = window.setTimeout(() => {
      if (mounted && loading) {
        console.warn("[useAuth] Timeout reached, forcing loading to false");
        setLoading(false);
      }
    }, 8000);

    const handleSession = async (session: { user: User } | null) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        navigate(redirectTo);
        return;
      }

      setUser(session.user);

      if (checkPasswordChange) {
        const mustChange = await checkPasswordChangeRequired(session.user.id);
        if (mustChange && mounted) {
          navigate("/force-password-change");
          setLoading(false);
          return;
        }
      }

      if (mounted) {
        setLoading(false);
      }
    };

    // Initial session check
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        handleSession(session);
      })
      .catch((error) => {
        console.error("[useAuth] getSession error:", error);
        if (mounted) {
          setLoading(false);
          navigate(redirectTo);
        }
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (event === "SIGNED_OUT") {
          setUser(null);
          navigate(redirectTo);
          return;
        }

        if (session?.user) {
          setUser(session.user);
        }
      }
    );

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate, redirectTo, checkPasswordChange, checkPasswordChangeRequired]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate(redirectTo);
  }, [navigate, redirectTo]);

  return {
    user,
    loading,
    logout,
  };
}
