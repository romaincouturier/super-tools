import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { Calendar, CalendarOff, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface GoogleCalendarConnectProps {
  onStatusChange?: (connected: boolean) => void;
}

const GoogleCalendarConnect = ({ onStatusChange }: GoogleCalendarConnectProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      setIsConnected(data.connected);
      onStatusChange?.(data.connected);
    } catch (error) {
      console.error("Failed to check Google Calendar status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleMessage = (event: MessageEvent) => {
      const expectedOrigin = import.meta.env.VITE_SUPABASE_URL;
      if (expectedOrigin && event.origin !== expectedOrigin) return;

      if (event.data?.type === "google-calendar-auth") {
        setIsConnecting(false);
        if (event.data.success) {
          setIsConnected(true);
          onStatusChange?.(true);
          toast({
            title: "Google Calendar connecté",
            description: "Votre agenda sera utilisé par le coach commercial.",
          });
        } else {
          toastError(toast, event.data.error || "Une erreur est survenue", { title: "Échec de la connexion" });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onStatusChange, toast]);

  const handleConnect = async () => {
    setIsConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toastError(toast, "Veuillez vous connecter d'abord.", { title: "Non connecté" });
        setIsConnecting(false);
        return;
      }

      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=callback`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=initiate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ redirectUri }),
        }
      );

      const data = await response.json();

      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        window.open(
          data.authUrl,
          "google-calendar-auth",
          `width=${width},height=${height},left=${left},top=${top}`
        );
      } else {
        throw new Error(data.error || "Failed to get auth URL");
      }
    } catch (error: unknown) {
      console.error("Failed to initiate Calendar OAuth:", error);
      toastError(toast, error instanceof Error ? error : "Impossible de démarrer la connexion");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=disconnect`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      setIsConnected(false);
      onStatusChange?.(false);
      toast({ title: "Google Calendar déconnecté", description: "L'agenda ne sera plus utilisé par le coach." });
    } catch (error: unknown) {
      console.error("Failed to disconnect:", error);
      toastError(toast, "Impossible de déconnecter Google Calendar");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Spinner />
        Vérification Google Calendar...
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" />
          Google Calendar connecté
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="text-muted-foreground hover:text-destructive"
        >
          <CalendarOff className="w-4 h-4 mr-1" />
          Déconnecter
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleConnect}
      disabled={isConnecting}
      className="gap-2"
    >
      {isConnecting ? (
        <>
          <Spinner />
          Connexion...
        </>
      ) : (
        <>
          <Calendar className="w-4 h-4" />
          Connecter Google Calendar
        </>
      )}
    </Button>
  );
};

export default GoogleCalendarConnect;
