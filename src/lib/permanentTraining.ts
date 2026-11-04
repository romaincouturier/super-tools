export function orderCourseOptions<T extends { id: string; title: string; formation_config_id: string | null }>(courses: T[], linkedIds: string[]) {
  const linked = new Set(linkedIds);
  return courses.map(course => ({ ...course, isAssigned: !!course.formation_config_id || linked.has(course.id) }))
    .sort((a, b) => Number(a.isAssigned) - Number(b.isAssigned) || a.title.localeCompare(b.title, "fr", { sensitivity: "base" }));
}

export function soloFormulaValues(config: { id: string; duree_heures: number | null; prix: number | null; elearning_access_email_content: string | null; supports_url: string | null; woocommerce_product_id: number | null; learndash_course_id: number | null }) {
  return {
    formation_config_id: config.id,
    name: "Solo",
    duree_heures: config.duree_heures,
    prix: config.prix,
    elearning_access_email_content: config.elearning_access_email_content,
    supports_url: config.supports_url,
    woocommerce_product_id: config.woocommerce_product_id,
    learndash_course_id: config.learndash_course_id,
    display_order: 0,
    coaching_sessions_count: 0,
  };
}