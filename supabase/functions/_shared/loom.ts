/**
 * Client Loom — API GraphQL interne (https://www.loom.com/graphql).
 *
 * Loom n'a pas d'API publique. Sur un plan gratuit, les transcripts sont
 * lisibles mais non téléchargeables : la seule voie est l'API que consomme
 * l'app web, authentifiée par le cookie de session `connect.sid`.
 *
 * Conséquences assumées :
 *   - le cookie expire (~30 jours) et doit être recollé dans les réglages ;
 *   - le schéma n'est pas documenté et peut changer sans préavis. Un 401 ou
 *     une réponse sans `videos` remonte en LoomSessionExpiredError pour que
 *     l'appelant affiche "cookie à renouveler" et non une erreur générique.
 */

const LOOM_GRAPHQL_URL = "https://www.loom.com/graphql";

export class LoomSessionExpiredError extends Error {}

export interface LoomVideo {
  id: string;
  name: string | null;
  createdAt: string | null;
  playable_duration: number | null;
}

export interface LoomPhrase {
  ts: number;
  speakerName?: string | null;
  value: string;
}

async function loomGraphQL<T>(
  cookie: string,
  operationName: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(LOOM_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apollographql-client-name": "web",
      "x-loom-request-source": "loom_web",
      cookie,
    },
    body: JSON.stringify({ operationName, query, variables }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new LoomSessionExpiredError(
      "Session Loom expirée : recollez un cookie connect.sid frais dans les réglages.",
    );
  }
  if (!res.ok) {
    throw new Error(`Loom GraphQL ${operationName} a répondu HTTP ${res.status}`);
  }

  const body = await res.json();
  if (body?.errors?.length) {
    throw new Error(
      `Loom GraphQL ${operationName} : ${body.errors.map((e: { message?: string }) => e.message ?? "erreur inconnue").join("; ")}`,
    );
  }
  return body.data as T;
}

const LIST_VIDEOS_QUERY = `query GetLoomsForLibrary($limit: Int!, $cursor: String, $source: LoomsSource!, $sortType: LoomsSortType!, $sortOrder: LoomsSortOrder!, $filters: [[LoomsCollectionFilter!]!]) {
  getLooms {
    __typename
    ... on GetLoomsPayload {
      videos(first: $limit, after: $cursor, source: $source, sortType: $sortType, sortOrder: $sortOrder, filters: $filters) {
        edges { cursor node { id name createdAt playable_duration } }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
}`;

/** Vidéos du compte, les plus récentes d'abord (dossiers inclus). */
export async function listLoomVideos(
  cookie: string,
  limit: number,
  cursor?: string,
): Promise<{ videos: LoomVideo[]; endCursor: string | null; hasNextPage: boolean }> {
  const data = await loomGraphQL<{
    getLooms: {
      __typename: string;
      videos?: {
        edges: Array<{ node: LoomVideo }>;
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
      };
    };
  }>(cookie, "GetLoomsForLibrary", LIST_VIDEOS_QUERY, {
    source: "MINE",
    sortType: "RECENT",
    sortOrder: "DESC",
    filters: [[{ type: "CREATED_BY_ME" }]],
    limit,
    cursor: cursor ?? null,
  });

  const videos = data.getLooms?.videos;
  if (!videos) {
    throw new LoomSessionExpiredError(
      `Loom n'a pas renvoyé de vidéos (${data.getLooms?.__typename ?? "réponse inattendue"}) : cookie connect.sid probablement expiré.`,
    );
  }
  return {
    videos: videos.edges.map((e) => e.node),
    endCursor: videos.pageInfo.endCursor,
    hasNextPage: videos.pageInfo.hasNextPage,
  };
}

const TRANSCRIPT_QUERY = `query fetchVideoTranscript($videoId: ID!) {
  fetchVideoTranscript(videoId: $videoId) {
    ... on VideoTranscriptDetails {
      video_id source_url transcription_status language
    }
  }
}`;

/** Format aligné sur Fireflies : une ligne par phrase, préfixée du locuteur. */
export function phrasesToText(phrases: LoomPhrase[]): string {
  return phrases
    .map((p) => ({ text: (p.value ?? "").trim(), speaker: p.speakerName?.trim() }))
    .filter((p) => p.text !== "")
    .map((p) => (p.speaker ? `${p.speaker}: ${p.text}` : p.text))
    .join("\n");
}

/**
 * Transcript d'une vidéo. `null` quand Loom n'en a pas encore produit
 * (transcription en cours, ou vidéo sans parole).
 */
export async function getLoomTranscript(
  cookie: string,
  videoId: string,
): Promise<{ text: string; language: string | null } | null> {
  const data = await loomGraphQL<{
    fetchVideoTranscript: {
      source_url?: string | null;
      transcription_status?: string | null;
      language?: string | null;
    } | null;
  }>(cookie, "fetchVideoTranscript", TRANSCRIPT_QUERY, { videoId });

  const details = data.fetchVideoTranscript;
  if (!details?.source_url) return null;

  const res = await fetch(details.source_url);
  if (!res.ok) {
    throw new Error(`Téléchargement du transcript Loom ${videoId} : HTTP ${res.status}`);
  }
  const payload = await res.json();
  const phrases = (payload?.phrases ?? []) as LoomPhrase[];
  return { text: phrasesToText(phrases), language: details.language ?? null };
}
