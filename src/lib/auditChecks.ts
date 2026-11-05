/**
 * Moteur de l'audit blanc — réexport.
 *
 * La définition vit dans supabase/functions/_shared/ pour que l'écran et le
 * cron de nuit rendent le même verdict sur les mêmes faits.
 */
export * from "../../supabase/functions/_shared/qualiopi-checks";
