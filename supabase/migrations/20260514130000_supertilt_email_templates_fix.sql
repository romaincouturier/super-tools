-- ═══════════════════════════════════════════════════════════════
-- SuperTilt : seed des templates email dans la table email_templates
-- existante (module formations). On préfixe les template_type avec
-- "supertilt_" pour isoler ces templates sans créer une nouvelle table.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default)
SELECT
  'supertilt_dropshipping',
  'SuperTilt — Email dropshipping auteur',
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
<p>Cordialement,<br>L''équipe SuperTilt</p>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'supertilt_dropshipping'
);

INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default)
SELECT
  'supertilt_location',
  'SuperTilt — Email location client',
  'Contrat de location — {{nom_jeu}}',
  '<p>Bonjour {{nom_client}},</p>
<p>Merci pour votre commande de location du jeu <strong>{{nom_jeu}}</strong>.</p>
<p>Veuillez trouver ci-joint le contrat de location à signer et nous retourner.</p>
<p><strong>Commande n° :</strong> {{numero_commande}}<br>
<strong>Date :</strong> {{date_commande}}</p>
<p>Cordialement,<br>L''équipe SuperTilt</p>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'supertilt_location'
);

INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default)
SELECT
  'supertilt_partner',
  'SuperTilt — Notification partenaire',
  'Nouvelle vente — {{nom_jeu}}',
  '<p>Bonjour,</p>
<p>Une nouvelle vente a été enregistrée pour le jeu <strong>{{nom_jeu}}</strong>.</p>
<p><strong>Commande :</strong> {{numero_commande}}<br>
<strong>Date :</strong> {{date_commande}}<br>
<strong>Quantité :</strong> {{quantite}}<br>
<strong>Montant TTC :</strong> {{montant_ttc}}<br>
<strong>Commission estimée :</strong> {{commission}}</p>
<p>Cordialement,<br>L''équipe SuperTilt</p>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'supertilt_partner'
);

INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default)
SELECT
  'supertilt_internal_notif',
  'SuperTilt — Notification interne',
  '[SuperTilt] Nouvelle commande — {{nom_jeu}}',
  '<p>Nouvelle commande reçue.</p>
<p><strong>Jeu :</strong> {{nom_jeu}}<br>
<strong>Commande :</strong> {{numero_commande}}<br>
<strong>Client :</strong> {{nom_client}} ({{email_client}})<br>
<strong>Quantité :</strong> {{quantite}}<br>
<strong>Montant TTC :</strong> {{montant_ttc}}</p>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'supertilt_internal_notif'
);

INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default)
SELECT
  'supertilt_restock',
  'SuperTilt — Email réapprovisionnement',
  'Réapprovisionnement nécessaire — {{nom_jeu}}',
  '<p>Bonjour,</p>
<p>Le stock du jeu <strong>{{nom_jeu}}</strong> est passé sous le seuil minimum.</p>
<p><strong>Stock actuel :</strong> {{stock_actuel}}<br>
<strong>Seuil minimum :</strong> {{seuil_minimum}}</p>
<p><strong>Éléments à commander :</strong></p>
<pre>{{elements_a_commander}}</pre>
<p><strong>Fournisseurs / URLs :</strong></p>
<pre>{{fournisseurs}}</pre>
<p>Cordialement,<br>L''équipe SuperTilt</p>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'supertilt_restock'
);
