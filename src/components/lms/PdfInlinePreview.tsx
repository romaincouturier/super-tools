import { useEffect, useState } from "react";

interface Props {
  url: string;
  title?: string | null;
  height?: number;
}

/**
 * Aperçu PDF intégré. Le fichier est récupéré puis affiché via une URL blob
 * same-origin : les URL de stockage distantes sont souvent bloquées en iframe
 * ou servies en téléchargement forcé.
 */
export default function PdfInlinePreview({ url, title, height = 480 }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setBlobUrl(null);
    setFailed(false);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (cancelled) return;
        created = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
        setBlobUrl(created);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  if (failed) return null;
  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height }}>
        Chargement de l'aperçu…
      </div>
    );
  }
  return (
    <iframe
      src={`${blobUrl}#view=FitH`}
      title={title || "Aperçu PDF"}
      className="w-full block bg-background"
      style={{ height, border: 0 }}
    />
  );
}
