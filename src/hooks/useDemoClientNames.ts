import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { buildKnownNamesMatcher } from "@/lib/demoMask";

/**
 * Noms des clients (CRM, missions et leurs contacts, formations et sociétés des
 * participants, devis, témoignages) sous forme de regex, pour masquer en mode
 * démo un nom cité dans un texte libre. Un client absent de ces tables n'est
 * pas reconnu. SuperTilt reste visible. Rien n'est chargé hors mode démo.
 */
export function useDemoClientNames(): RegExp | null {
  const { isDemoMode } = useDemoMode();
  const { data } = useQuery({
    queryKey: ["demo-client-names"],
    enabled: isDemoMode,
    staleTime: 30 * 60 * 1000,
    structuralSharing: false,
    queryFn: async () => {
      const [crm, missions, missionContacts, trainings, participants, quotes, testimonials] = await Promise.all([
        supabase.from("crm_cards").select("company, first_name, last_name"),
        supabase.from("missions").select("client_name"),
        supabase.from("mission_contacts").select("first_name, last_name"),
        supabase.from("trainings").select("client_name"),
        supabase.from("training_participants").select("company"),
        supabase.from("quotes").select("client_company"),
        supabase.from("testimonials").select("client_name, company"),
      ]);
      const names: (string | null)[] = [];
      const person = (first: string | null, last: string | null) => {
        if (first && last) names.push(`${first} ${last}`, last);
      };
      for (const c of crm.data ?? []) {
        names.push(c.company);
        person(c.first_name, c.last_name);
      }
      for (const c of missionContacts.data ?? []) person(c.first_name, c.last_name);
      for (const m of missions.data ?? []) names.push(m.client_name);
      for (const t of trainings.data ?? []) names.push(t.client_name);
      for (const p of participants.data ?? []) names.push(p.company);
      for (const q of quotes.data ?? []) names.push(q.client_company);
      for (const t of testimonials.data ?? []) names.push(t.client_name, t.company);
      return buildKnownNamesMatcher(names.filter((n) => !/supertilt/i.test(n ?? "")));
    },
  });
  return isDemoMode ? data ?? null : null;
}
