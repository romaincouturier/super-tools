# Réponse : emails automatiques post-formation (exemple Serge Lepretre-Bozzi)

Aucune modification. Il n'y a rien à mettre en œuvre : cliquer sur « Approuver » ne lancera aucun changement.

## 1. Planification et conditions d'envoi

Les 5 emails sont planifiés en une seule fois, au moment de l'envoi du mail de remerciement (le 29/10 à 15h07 pour Serge). Les délais se comptent en jours ouvrés à partir de ce mail, et non à partir de la fin de la formation. Ils sont réglables dans Paramètres, onglet des délais.

- google_review : J+1 (le 30/10). Il part toujours.
- evaluation_reminder_1 : J+2 (le 02/11). Il part seulement si l'évaluation n'est pas soumise.
- video_testimonial : J+3 (le 03/11 à 16h07). Il part toujours.
- evaluation_reminder_2 : J+5 (le 05/11). Il part seulement si l'évaluation n'est pas soumise.
- follow_up_news : J+30 (le 10/12). C'est un message informel, éventuellement personnalisé à partir de l'évaluation. Il part toujours.

Toutes les quelques minutes, un traitement envoie les emails dont l'heure est passée.

## 2. Relances d'évaluation

Rien n'est annulé à l'avance. Au moment de l'envoi, la relance vérifie l'évaluation. Si elle est soumise, la relance est annulée sans partir (motif « Évaluation déjà soumise »).
Serge a soumis la sienne le 03/11 à 10h07 (heure de Paris). Sa relance n°2 du 05/11 ne partira donc pas. Elle passera simplement à « annulée » le 05/11.

## 3. Avis Google et témoignage vidéo

Oui, ils partent pour toutes les formations dès que le mail de remerciement est envoyé, sans distinction de type. Je n'ai trouvé aucun réglage pour les désactiver : on ne peut régler que leur délai. Seule solution actuelle : annuler les envois programmés un par un.

## 4. Doublons

En principe, non. À la planification, un même type d'email n'est jamais créé deux fois pour un participant, même si le remerciement est renvoyé. À l'envoi, un email déjà marqué « envoyé » est refusé.
Il reste une faille théorique : si deux envois sont déclenchés exactement au même moment (passage automatique et bouton « Forcer » simultanés), rien ne verrouille l'email pendant l'envoi. Je n'ai pas vérifié si cela s'est déjà produit.
