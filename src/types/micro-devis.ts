export interface FormationConfig {
  id: string;
  formation_name: string;
  prix: number;
  duree_heures: number;
  programme_url: string | null;
  is_default: boolean;
  display_order: number;
}

export interface FormationDate {
  id: string;
  date_label: string;
  is_default: boolean;
}

export interface DevisFormData {
  nomClient: string;
  adresseClient: string;
  codePostalClient: string;
  villeClient: string;
  pays: string;
  emailCommanditaire: string;
  adresseCommanditaire: string;
  isAdministration: boolean;
  noteDevis: string;
  formationDemandee: string;
  formationLibre: string;
  dateFormation: string;
  dateFormationLibre: string;
  lieu: string;
  lieuAutre: string;
  includeCadeau: boolean;
  fraisDossier: boolean;
  participants: string;
  typeSubrogation: "sans" | "avec" | "les2";
  typeDevis: "formation" | "jeu";
  formatFormation: "intra" | "inter";
}

export interface DevisHistoryItem {
  id: string;
  created_at: string;
  recipient_email: string;
  details: {
    formation_name: string;
    client_name: string;
    type_subrogation: string;
    nb_participants: number;
    form_data?: DevisFormData;
  };
}

export const LIEUX = [
  "En ligne en accédant à son compte sur supertilt.fr",
  "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon",
  "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris",
  "Chez le client",
];
