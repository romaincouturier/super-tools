import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cross-instance sync: when one hook instance saves, others with the same key update
const PREFERENCE_EVENT = "user-preference-updated";

function emitPreferenceUpdate(key: string, value: unknown) {
  window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: { key, value } }));
}

interface UserPreference<T> {
  value: T | null;
  loading: boolean;
  error: Error | null;
  save: (value: T) => Promise<void>;
}

export function useUserPreference<T>(key: string, defaultValue: T): UserPreference<T> {
  // defaultValue is often passed as an inline array/object and can change identity every render.
  // Keep a stable reference to prevent request loops.
  const defaultValueRef = useRef(defaultValue);

  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPreference = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.user?.id) {
          setValue(defaultValueRef.current);
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
          setValue(defaultValueRef.current);
        }
      } catch (err) {
        console.error("Error fetching user preference:", err);
        setError(err as Error);
        setValue(defaultValueRef.current);
      } finally {
        setLoading(false);
      }
    };

    fetchPreference();
  }, [key]);

  // Listen for cross-instance updates
  useEffect(() => {
    const handler = (e: Event) => {
      const { key: updatedKey, value: updatedValue } = (e as CustomEvent).detail;
      if (updatedKey === key) {
        setValue(updatedValue as T);
      }
    };
    window.addEventListener(PREFERENCE_EVENT, handler);
    return () => window.removeEventListener(PREFERENCE_EVENT, handler);
  }, [key]);

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
            preference_value: newValue,
          },
          {
            onConflict: "user_id,preference_key",
          }
        );

      if (upsertError) throw upsertError;

      setValue(newValue);
      emitPreferenceUpdate(key, newValue);
    } catch (err) {
      console.error("Error saving user preference:", err);
      setError(err as Error);
      throw err;
    }
  }, [key]);

  return { value: value ?? defaultValueRef.current, loading, error, save };
}
