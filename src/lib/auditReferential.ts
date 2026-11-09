/**
 * Référentiel V10 — réexport.
 *
 * La définition vit dans supabase/functions/_shared/ pour que l'écran et le
 * cron de nuit partagent la même source : un indicateur ne doit pas être
 * apprécié différemment selon qu'on le regarde depuis le navigateur ou depuis
 * une tâche planifiée.
 */
export * from "../../supabase/functions/_shared/qualiopi-referential";
