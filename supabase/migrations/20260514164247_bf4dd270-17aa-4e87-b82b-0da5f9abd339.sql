UPDATE public.email_templates
SET subject = 'Nouvelle commande de {{nom_jeu}} !',
    html_content = '<p>Bonjour {{prenom_auteur}},</p>
<p>Je suis ravi de t''annoncer qu''une commande vient d''être passée pour <strong>{{nom_jeu}}</strong> :</p>
<ul>
  <li>Quantité : {{quantite}}</li>
  <li>Prix vendu : {{prix_vendu}}</li>
  {{#note_client}}<li>Note du client : {{note_client}}</li>{{/note_client}}
</ul>
<p><strong>Voici les coordonnées pour l''envoi du jeu :</strong></p>
<p>{{nom_client}}<br>
{{adresse_livraison}}<br>
{{#telephone}}Téléphone : {{telephone}}<br>{{/telephone}}
Email : {{email_client}}</p>
<p>Une fois que tu auras tout envoyé, peux-tu me le confirmer s''il te plaît ?</p>
<p>Ta facture sera de <strong>{{taux_commission}} x {{prix_ht}} HT</strong> + frais de port. Pour rappel, voici mes coordonnées de facturation :</p>
<ul>
  <li>Raison sociale : SuperTilt</li>
  <li>SIRET : 54003585400020</li>
  <li>Numéro de TVA intracommunautaire : FR91540035854</li>
  <li>Adresse : 55 Chemin du Moulin du Got, 69340 Francheville</li>
</ul>
<p>Je te remercie d''avance.</p>
<p>À bientôt !</p>'
WHERE template_type = 'supertilt_dropshipping';