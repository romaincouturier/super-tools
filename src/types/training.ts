export interface FormationFormula {
  id: string;
  formation_config_id: string;
  name: string;
  duree_heures: number | null;
  prix: number | null;
  elearning_access_email_content: string | null;
  woocommerce_product_id: number | null;
  supports_url: string | null;
  display_order: number;
  coaching_sessions_count: number;
}
