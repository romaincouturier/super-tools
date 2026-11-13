export interface FirefliesMeeting {
  id: string;
  title: string;
  date: number;
  duration?: number;
  summary?: { overview?: string };
  sentences?: Array<{ speaker_name?: string; text: string; start_time?: number; end_time?: number }>;
}

export async function firefliesQuery(query: string, variables: Record<string, unknown>): Promise<any> {
  const key = Deno.env.get("FIREFLIES_API_KEY");
  if (!key) throw new Error("Fireflies n’est pas configuré");
  const response = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Fireflies ${response.status}: ${await response.text()}`);
  const json = await response.json();
  if (json.errors?.length) throw new Error(`Fireflies : ${JSON.stringify(json.errors)}`);
  if (!json.data) throw new Error("Fireflies : réponse sans données");
  return json.data;
}

export async function listFirefliesPage(skip: number, toDate?: string, fromDate?: string): Promise<FirefliesMeeting[]> {
  const data = await firefliesQuery(`query($limit: Int, $skip: Int, $toDate: DateTime, $fromDate: DateTime) {
    transcripts(limit: $limit, skip: $skip, toDate: $toDate, fromDate: $fromDate) { id title date }
  }`, { limit: 50, skip, toDate, fromDate });
  if (!Array.isArray(data.transcripts)) throw new Error("Fireflies : inventaire indisponible");
  return data.transcripts;
}

export async function getFirefliesMeeting(id: string): Promise<FirefliesMeeting> {
  const data = await firefliesQuery(`query($id: String!) {
    transcript(id: $id) { id title date duration summary { overview } sentences { speaker_name text start_time end_time } }
  }`, { id });
  if (!data.transcript) throw new Error("Réunion Fireflies inaccessible");
  return data.transcript;
}