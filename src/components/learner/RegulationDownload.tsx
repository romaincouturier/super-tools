import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { prepareRegulationDownload } from "@/services/trainingRegulation";
import { reportHandledError } from "@/lib/sentry";

export default function RegulationDownload({ url }: { url: string }) {
  const [blobUrl, setBlobUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setBlobUrl(""); setError("");
    prepareRegulationDownload(url).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
    }).catch(cause => { if (active) { reportHandledError(cause); setError("Téléchargement indisponible"); } });
    return () => { active = false; if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 30000); };
  }, [url]);
  return <div className="min-w-0">
    {blobUrl ? <Button variant="outline" className="w-full whitespace-normal h-auto min-h-11" asChild><a href={blobUrl} download="reglement-interieur-supertilt.pdf"><Download className="mr-2 h-4 w-4 shrink-0" />Règlement intérieur</a></Button> : <Button variant="outline" className="w-full whitespace-normal h-auto min-h-11" disabled>{!error && <Spinner className="mr-2" />}Règlement intérieur</Button>}
    {error && <p role="alert" className="text-xs text-destructive mt-1">{error}</p>}
  </div>;
}