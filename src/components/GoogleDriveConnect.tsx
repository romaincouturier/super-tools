import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Cloud, CloudOff, Loader2, CheckCircle } from "lucide-react";

interface GoogleDriveConnectProps {
  onStatusChange?: (connected: boolean) => void;
}

const GoogleDriveConnect = ({ onStatusChange }: GoogleDriveConnectProps) => {
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-auth?action=status`,
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
      console.error("Failed to check Google Drive status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    // Listen for OAuth popup messages
    const handleMessage = (event: MessageEvent) => {
      // Validate origin to prevent malicious postMessage attacks
      const expectedOrigin = import.meta.env.VITE_SUPABASE_URL;
      if (expectedOrigin && event.origin !== expectedOrigin) {
        console.warn("Ignored postMessage from untrusted origin:", event.origin);
        return;
      }

      if (event.data?.type === "google-drive-auth") {
        setIsConnecting(false);
        if (event.data.success) {
          setIsConnected(true);
          onStatusChange?.(true);
          toast({
            title: "Google Drive connecté",
            description: "Vos certificats seront uploadés automatiquement.",
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
    setIsConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Non connecté",
          description: "Veuillez vous connecter d'abord.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Get the callback URL - use the edge function URL
      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-auth?action=callback`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-auth?action=initiate`,
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
        // Open OAuth popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        window.open(
          data.authUrl,
          "google-drive-auth",
          `width=${width},height=${height},left=${left},top=${top}`
        );
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
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-auth?action=disconnect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      setIsConnected(false);
      onStatusChange?.(false);
      toast({
        title: "Google Drive déconnecté",
        description: "Les certificats ne seront plus uploadés sur Drive.",
      });
    } catch (error: unknown) {
      console.error("Failed to disconnect:", error);
      toast({
        title: "Erreur",
        description: "Impossible de déconnecter Google Drive",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Vérification Google Drive...
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" />
          Google Drive connecté
        </div>
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
          <Loader2 className="w-4 h-4 animate-spin" />
          Connexion...
        </>
      ) : (
        <>
          <Cloud className="w-4 h-4" />
          Connecter Google Drive
        </>
      )}
    </Button>
  );
};

export default GoogleDriveConnect;
