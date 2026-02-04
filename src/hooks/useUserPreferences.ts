import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserPreference<T> {
  value: T | null;
  loading: boolean;
  error: Error | null;
  save: (value: T) => Promise<void>;
}

export function useUserPreference<T>(key: string, defaultValue: T): UserPreference<T> {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPreference = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.user?.id) {
          setValue(defaultValue);
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("user_preferences")
          .select("preference_value")
          .eq("user_id", session.session.user.id)
          .eq("preference_key", key)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data?.preference_value) {
          setValue(data.preference_value as T);
        } else {
          setValue(defaultValue);
        }
      } catch (err) {
        console.error("Error fetching user preference:", err);
        setError(err as Error);
        setValue(defaultValue);
      } finally {
        setLoading(false);
      }
    };

    fetchPreference();
  }, [key, defaultValue]);

  const save = useCallback(async (newValue: T) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user?.id) {
        throw new Error("User not authenticated");
      }

      const { error: upsertError } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: session.session.user.id,
            preference_key: key,
            preference_value: newValue as unknown as Record<string, unknown>,
          },
          {
            onConflict: "user_id,preference_key",
          }
        );

      if (upsertError) throw upsertError;

      setValue(newValue);
    } catch (err) {
      console.error("Error saving user preference:", err);
      setError(err as Error);
      throw err;
    }
  }, [key]);

  return { value: value ?? defaultValue, loading, error, save };
}
