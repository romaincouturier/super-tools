import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Cloud, CloudOff, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface GoogleConnectProps {
  onStatusChange?: (connected: boolean) => void;
}

const GoogleConnect = ({ onStatusChange }: GoogleConnectProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const popupMonitorRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();

  const resetConnectingState = () => {
    if (popupMonitorRef.current) {
      window.clearInterval(popupMonitorRef.current);
      popupMonitorRef.current = null;
    }
    if (connectTimeoutRef.current) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    setIsConnecting(false);
  };

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      setIsConnected(data.connected);
      setNeedsReconnect(Boolean(data.needsReconnect));
      setNeedsUpgrade(Boolean(data.needsUpgrade));
      onStatusChange?.(data.connected);
    } catch (error) {
      console.error("Failed to check Google status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleMessage = (event: MessageEvent) => {
      const expectedOrigin = window.location.origin;
      if (event.origin !== expectedOrigin) {
        console.warn("Ignored postMessage from untrusted origin:", event.origin);
        return;
      }

      if (event.data?.type === "google-auth") {
        resetConnectingState();
        if (event.data.success) {
          setIsConnected(true);
          setNeedsReconnect(false);
          setNeedsUpgrade(false);
          onStatusChange?.(true);
          checkStatus();
          toast({
            title: "Google connecté",
            description: "Drive et Calendar sont maintenant accessibles.",
          });
        } else {
          toast({
            title: "Échec de la connexion",
            description: event.data.error || "Une erreur est survenue",
            variant: "destructive",
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onStatusChange, toast]);

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      "about:blank",
      "google-auth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      setIsConnecting(false);
      toast({
        title: "Popup bloquée",
        description: "Autorisez les popups pour connecter Google.",
        variant: "destructive",
      });
      return;
    }

    popup.document.write("Connexion à Google en cours...");

    popupMonitorRef.current = window.setInterval(() => {
      if (popup.closed) {
        resetConnectingState();
      }
    }, 500);

    connectTimeoutRef.current = window.setTimeout(() => {
      resetConnectingState();
      toast({
        title: "Connexion interrompue",
        description: "La connexion Google a pris trop de temps. Réessayez.",
        variant: "destructive",
      });
    }, 120000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Non connecté",
          description: "Veuillez vous connecter d'abord.",
          variant: "destructive",
        });
        popup.close();
        resetConnectingState();
        return;
      }

      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?action=callback`;
      const appCallbackUrl = `${window.location.origin}/google/callback`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?action=initiate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ redirectUri, appCallbackUrl }),
        }
      );

      const data = await response.json();

      if (data.authUrl) {
        popup.location.href = data.authUrl;
      } else {
        throw new Error(data.error || "Failed to get auth URL");
      }
    } catch (error: unknown) {
      console.error("Failed to initiate OAuth:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de démarrer la connexion",
        variant: "destructive",
      });
      popup.close();
      resetConnectingState();
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?action=disconnect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      setIsConnected(false);
      setNeedsReconnect(false);
      setNeedsUpgrade(false);
      resetConnectingState();
      onStatusChange?.(false);
      toast({
        title: "Google déconnecté",
        description: "Drive et Calendar ont été déconnectés.",
      });
    } catch (error: unknown) {
      console.error("Failed to disconnect:", error);
      toast({
        title: "Erreur",
        description: "Impossible de déconnecter Google",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Spinner />
        Vérification Google...
      </div>
    );
  }

  if (isConnected || needsReconnect || needsUpgrade) {
    const showWarning = needsReconnect || needsUpgrade;
    const label = needsUpgrade
      ? "Mettre à jour la connexion Google"
      : needsReconnect
        ? "Google à reconnecter"
        : "Google connecté";

    return (
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 text-sm ${showWarning ? "text-destructive" : "text-green-600"}`}>
          {showWarning ? <CloudOff className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {label}
        </div>
        {showWarning && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting}
            className="gap-2"
          >
            {isConnecting ? <Spinner /> : <Cloud className="w-4 h-4" />}
            {needsUpgrade ? "Mettre à jour" : "Reconnecter"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="text-muted-foreground hover:text-destructive"
        >
          <CloudOff className="w-4 h-4 mr-1" />
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
          <Cloud className="w-4 h-4" />
          Connecter Google
        </>
      )}
    </Button>
  );
};

export default GoogleConnect;
