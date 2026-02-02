import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LoginAttemptStatus {
  allowed: boolean;
  isBlocked: boolean;
  blockedBy: "email" | "ip" | null;
  remainingAttempts: number;
  delaySeconds: number;
  unlockAt: string | null;
  remainingSeconds: number;
}

const initialStatus: LoginAttemptStatus = {
  allowed: true,
  isBlocked: false,
  blockedBy: null,
  remainingAttempts: 5,
  delaySeconds: 0,
  unlockAt: null,
  remainingSeconds: 0,
};

export function useLoginAttempts() {
  const [status, setStatus] = useState<LoginAttemptStatus>(initialStatus);
  const [isChecking, setIsChecking] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Compte à rebours pour le déblocage
  useEffect(() => {
    if (!status.isBlocked || status.remainingSeconds <= 0) {
      setCountdown(0);
      return;
    }

    setCountdown(status.remainingSeconds);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Réinitialiser le statut quand le compte à rebours est terminé
          setStatus(initialStatus);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status.isBlocked, status.remainingSeconds]);

  // Vérifier si la connexion est autorisée
  const checkAttempt = useCallback(async (email: string): Promise<boolean> => {
    if (!email) return true;

    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-login-attempt", {
        body: { email },
      });

      if (error) {
        console.error("Error checking login attempt:", error);
        return true; // Fail-open
      }

      setStatus({
        allowed: data.allowed ?? true,
        isBlocked: data.isBlocked ?? false,
        blockedBy: data.blockedBy ?? null,
        remainingAttempts: data.remainingAttempts ?? 5,
        delaySeconds: data.delaySeconds ?? 0,
        unlockAt: data.unlockAt ?? null,
        remainingSeconds: data.remainingSeconds ?? 0,
      });

      return data.allowed ?? true;
    } catch (error) {
      console.error("Check attempt error:", error);
      return true; // Fail-open
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Logger une tentative
  const logAttempt = useCallback(async (email: string, success: boolean) => {
    try {
      await supabase.functions.invoke("log-login-attempt", {
        body: { email, success },
      });

      // Si échec, re-vérifier le statut
      if (!success) {
        await checkAttempt(email);
      } else {
        // Si succès, réinitialiser le statut
        setStatus(initialStatus);
      }
    } catch (error) {
      console.error("Log attempt error:", error);
    }
  }, [checkAttempt]);

  // Formater le temps restant
  const formatTimeRemaining = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    status,
    isChecking,
    countdown,
    checkAttempt,
    logAttempt,
    formatTimeRemaining,
  };
}
