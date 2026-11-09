export const AUTHOR_STATUS_LABELS: Record<string, string> = {
  invited: "Invité",
  form_in_progress: "Formulaire en cours",
  form_submitted: "Formulaire soumis",
  contract_sent: "Contrat envoyé",
  signed: "Contrat signé",
  online: "Fiche en ligne",
};

export const FORM_SECTIONS: { title: string; fields: [string, string][] }[] = [
  { title: "Vendeur", fields: [
    ["legal_name", "Raison sociale"], ["postal_address", "Adresse postale"], ["legal_rep_first_name", "Prénom du représentant légal"],
    ["legal_rep_last_name", "Nom du représentant légal"], ["siren", "SIREN"], ["phone", "Téléphone"],
  ] },
  { title: "Jeu", fields: [
    ["game_name", "Nom du jeu"], ["author_email", "Email de l'auteur"], ["pitch", "Pitch"], ["price_ht", "Prix de vente HT (€)"],
    ["game_page_url", "URL de la page du jeu"], ["video_url", "URL de la vidéo"], ["long_description", "Description longue"], ["credits", "Mentions des auteurs et crédits"],
  ] },
  { title: "Logistique", fields: [
    ["weight_g", "Poids (g)"], ["package_dimensions", "Dimensions du colis"], ["shipping_fee", "Frais de port pour un jeu (€)"], ["shipping_delay", "Délai d'expédition"],
  ] },
  { title: "Location", fields: [
    ["location_enabled", "Location proposée"], ["location_duration_days", "Durée (jours)"], ["location_price_ht", "Tarif HT (€)"],
    ["location_late_fee_month", "Pénalité de retard par mois (€)"], ["location_replacement_price", "Prix de remplacement (€)"],
  ] },
  { title: "Informations complémentaires", fields: [["testimonials", "Témoignages de joueurs"], ["other_info", "Autres infos pour la fiche produit"]] },
];
