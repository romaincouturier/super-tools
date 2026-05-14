-- ═══════════════════════════════════════════════════════════════
-- Fix : table email_templates déjà utilisée par le module formations.
-- On crée une table dédiée supertilt_email_templates pour éviter
-- tout conflit de schéma.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.supertilt_email_templates (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  subject      TEXT    NOT NULL DEFAULT '',
  body         TEXT    NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supertilt_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage supertilt_email_templates"
  ON public.supertilt_email_templates FOR ALL TO authenticated USING (true);

CREATE TRIGGER supertilt_email_templates_updated_at
  BEFORE UPDATE ON public.supertilt_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates
INSERT INTO public.supertilt_email_templates (template_key, name, subject, body) VALUES
(
  'dropshipping',
  'Email dropshipping auteur',
  'Nouvelle commande — {{nom_jeu}} (×{{quantite}})',
  '<p>Bonjour,</p>
<p>Une nouvelle commande vient d''être passée pour votre jeu <strong>{{nom_jeu}}</strong>.</p>
<p><strong>Détails de la commande :</strong></p>
<ul>
  <li>Commande n° : {{numero_commande}}</li>
  <li>Date : {{date_commande}}</li>
  <li>Client : {{nom_client}}</li>
  <li>Quantité : {{quantite}}</li>
  <li>Montant TTC : {{montant_ttc}}</li>
</ul>
<p><strong>Adresse de livraison :</strong><br>{{adresse_livraison}}</p>
{{#message_personnalise_jeu}}<p>{{message_personnalise_jeu}}</p>{{/message_personnalise_jeu}}
<p>Merci de procéder à l''expédition dans les meilleurs délais.</p>
<p>Cordialement,<br>L''équipe SuperTilt</p>'
),
(
  'location',
  'Email location client',
  'Contrat de location — {{nom_jeu}}',
  '<p>Bonjour {{nom_client}},</p>
<p>Merci pour votre commande de location du jeu <strong>{{nom_jeu}}</strong>.</p>
<p>Veuillez trouver ci-joint le contrat de location à signer et nous retourner.</p>
<p><strong>Commande n° :</strong> {{numero_commande}}<br>
<strong>Date :</strong> {{date_commande}}</p>
<p>Cordialement,<br>L''équipe SuperTilt</p>'
),
(
  'partner',
  'Notification partenaire',
  'Nouvelle vente — {{nom_jeu}}',
  '<p>Bonjour,</p>
<p>Une nouvelle vente a été enregistrée pour le jeu <strong>{{nom_jeu}}</strong>.</p>
<p><strong>Commande :</strong> {{numero_commande}}<br>
<strong>Date :</strong> {{date_commande}}<br>
<strong>Quantité :</strong> {{quantite}}<br>
<strong>Montant TTC :</strong> {{montant_ttc}}<br>
<strong>Commission estimée :</strong> {{commission}}</p>
<p>Cordialement,<br>L''équipe SuperTilt</p>'
),
(
  'internal_notif',
  'Notification interne SuperTilt',
  '[SuperTilt] Nouvelle commande — {{nom_jeu}}',
  '<p>Nouvelle commande reçue.</p>
<p><strong>Jeu :</strong> {{nom_jeu}}<br>
<strong>Commande :</strong> {{numero_commande}}<br>
<strong>Client :</strong> {{nom_client}} ({{email_client}})<br>
<strong>Quantité :</strong> {{quantite}}<br>
<strong>Montant TTC :</strong> {{montant_ttc}}</p>'
),
(
  'restock',
  'Email réapprovisionnement',
  'Réapprovisionnement nécessaire — {{nom_jeu}}',
  '<p>Bonjour,</p>
<p>Le stock du jeu <strong>{{nom_jeu}}</strong> est passé sous le seuil minimum.</p>
<p><strong>Stock actuel :</strong> {{stock_actuel}}<br>
<strong>Seuil minimum :</strong> {{seuil_minimum}}</p>
<p><strong>Éléments à commander :</strong></p>
<pre>{{elements_a_commander}}</pre>
<p><strong>Fournisseurs / URLs :</strong></p>
<pre>{{fournisseurs}}</pre>
<p>Cordialement,<br>L''équipe SuperTilt</p>'
)
ON CONFLICT (template_key) DO NOTHING;

-- Mise à jour du log pour référencer la bonne table (colonne optionnelle déjà sans FK)
-- order_email_log.template_key reste une simple clé texte, pas de FK → aucun changement.
