import { getOpenAIApiKey } from "./api-keys.ts";

const EMBEDDING_MODEL = "text-embedding-3-small";

/** Génère un embedding OpenAI (text-embedding-3-small, 1536 dims) ou null. */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey || !text.trim()) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      console.error("[embeddings] OpenAI error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("[embeddings] failed", e);
    return null;
  }
}
