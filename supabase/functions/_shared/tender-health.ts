export interface TenderSourceHealth {
  source: string;
  lastImport: string | null;
  workingDays: number | null;
}

export function workingDaysSince(value: string, now = new Date()): number {
  const parisDay = (date: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  const start = new Date(`${parisDay(new Date(value))}T12:00:00Z`);
  const end = parisDay(now);
  let count = 0;
  while (start.toISOString().slice(0, 10) < end) {
    start.setUTCDate(start.getUTCDate() + 1);
    const day = start.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export function isTenderSourceStale(lastImport: string | null, now = new Date()): boolean {
  return lastImport === null || workingDaysSince(lastImport, now) > 3;
}

// deno-lint-ignore no-explicit-any
export async function fetchTenderSourceHealth(supabase: any, now = new Date()): Promise<TenderSourceHealth[]> {
  const { data: place } = await supabase.from("tender_opportunities")
    .select("id").eq("source", "place").limit(1);
  const sources = ["ted", "boamp", "marches", ...(place?.length ? ["place"] : [])];
  const states = await Promise.all(sources.map(async (source) => {
    const { data, error } = await supabase.from("tender_opportunities")
      .select("created_at").eq("source", source)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`Santé AO ${source}: ${error.message}`);
    const lastImport = data?.created_at ?? null;
    return { source, lastImport, workingDays: lastImport ? workingDaysSince(lastImport, now) : null };
  }));
  return states.filter((state) => isTenderSourceStale(state.lastImport, now));
}

export function tenderHealthLabel(state: TenderSourceHealth): string {
  const source = state.source === "marches" ? "AWS" : state.source.toUpperCase();
  return `Veille AO : aucun avis ${source} importé ${state.workingDays === null ? "à ce jour" : `depuis ${state.workingDays} jours ouvrés`}`;
}