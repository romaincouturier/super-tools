import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

const GoogleDriveCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success") === "true";
    const error = params.get("error") || undefined;

    window.opener?.postMessage(
      { type: "google-drive-auth", success, error },
      window.location.origin,
    );

    window.close();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner />
        Finalisation de la connexion Google Drive...
      </div>
    </main>
  );
};

export default GoogleDriveCallback;