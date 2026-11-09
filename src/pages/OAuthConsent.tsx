import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { loadOAuthConsent, decideOAuthConsent } from "@/services/oauthConsent";

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const id = params.get("authorization_id") ?? "";
  const { status } = useSession();
  const navigate = useNavigate();
  const [details, setDetails] = useState<Awaited<ReturnType<typeof loadOAuthConsent>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) { setError("Demande de connexion absente ou expirée."); return; }
    if (status === "loading") return;
    if (status === "anon") {
      navigate(`/connexion?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
      return;
    }
    let active = true;
    loadOAuthConsent(id).then(data => {
      if (!active) return;
      if ("redirect_url" in data && data.redirect_url) { window.location.assign(data.redirect_url); return; }
      setDetails(data);
    }).catch(() => { if (active) setError("Cette demande est invalide ou expirée. Relancez la connexion depuis votre assistant."); });
    return () => { active = false; };
  }, [id, status, navigate]);
  async function decide(approve: boolean) {
    setBusy(true); setError("");
    try { window.location.assign(await decideOAuthConsent(id, approve)); }
    catch { setError("La décision n’a pas pu être enregistrée. Réessayez."); setBusy(false); }
  }
  const client = details && "client" in details ? details.client : null;
  return <main className="min-h-screen bg-background flex items-center justify-center p-6"><section className="w-full max-w-lg space-y-6">
    <h1 className="text-2xl font-bold">Connecter {client?.name ?? "votre assistant"} à SuperTools</h1>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!details && !error && <p className="text-muted-foreground">Chargement…</p>}
    {client && <><p>Votre assistant pourra utiliser les outils autorisés de votre compte. Vos droits d’accès restent inchangés.</p>
      {"redirect_uri" in details && <p className="text-sm text-muted-foreground break-all">{String(details.redirect_uri)}</p>}
      <div className="flex gap-3"><Button disabled={busy} onClick={() => decide(true)}>Autoriser</Button><Button variant="outline" disabled={busy} onClick={() => decide(false)}>Refuser</Button></div></>}
  </section></main>;
}