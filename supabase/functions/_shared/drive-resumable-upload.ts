/**
 * Upload d'un gros fichier vers Google Drive sans jamais le charger en mémoire.
 *
 * Une edge function n'a que quelques centaines de Mo : télécharger un fichier
 * de 100 Mo puis le recopier dans un corps multipart la fait tomber. On ouvre
 * donc une session resumable Drive et on l'alimente par des requêtes Range sur
 * l'URL signée du storage : le pic mémoire est celui d'un chunk.
 */

/** Google exige des chunks intermédiaires multiples de 256 Ko. */
export const STREAM_CHUNK_BYTES = 8 * 1024 * 1024;

export interface StreamUploadOptions {
  accessToken: string;
  fileName: string;
  mimeType: string;
  folderId: string;
  /** URL signée du fichier source, qui doit accepter les requêtes Range. */
  sourceUrl: string;
  totalSize: number;
  /** Timestamp au-delà duquel l'upload est abandonné et la session annulée. */
  deadline: number;
  /**
   * Appelé entre les chunks : un gros fichier peut occuper le tick plus
   * longtemps que le verrou de run, et sans ce battement un second tick
   * reprendrait le même run en parallèle.
   */
  heartbeat?: () => Promise<void>;
  heartbeatIntervalMs?: number;
  chunkBytes?: number;
}

export async function streamFileToGoogleDrive(options: StreamUploadOptions): Promise<void> {
  const {
    accessToken,
    fileName,
    mimeType,
    folderId,
    sourceUrl,
    totalSize,
    deadline,
    heartbeat,
    heartbeatIntervalMs = 20_000,
    chunkBytes = STREAM_CHUNK_BYTES,
  } = options;

  const initRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(totalSize),
      },
      body: JSON.stringify({ name: fileName, mimeType, parents: [folderId] }),
    },
  );

  if (!initRes.ok) {
    throw new Error(`Drive resumable init failed (${initRes.status}): ${await initRes.text()}`);
  }

  const sessionUrl = initRes.headers.get("location");
  // Corps lu même vide : une réponse non consommée garde la connexion ouverte.
  await initRes.text();
  if (!sessionUrl) throw new Error("Drive resumable session URL missing");

  try {
    let offset = 0;
    let lastBeat = Date.now();

    while (offset < totalSize) {
      if (Date.now() > deadline) {
        throw new Error(`stream upload timeout at ${offset}/${totalSize} bytes`);
      }

      const rangeEnd = Math.min(offset + chunkBytes, totalSize) - 1;
      const partRes = await fetch(sourceUrl, { headers: { Range: `bytes=${offset}-${rangeEnd}` } });
      if (!partRes.ok) {
        throw new Error(`storage range read failed (${partRes.status}) at ${offset}`);
      }
      const chunk = new Uint8Array(await partRes.arrayBuffer());
      const expected = rangeEnd - offset + 1;
      // Un storage qui ignore l'en-tête Range renvoie le fichier entier : on
      // enverrait alors des octets qui ne correspondent pas au Content-Range
      // annoncé, donc un fichier corrompu dans Drive.
      if (chunk.length !== expected) {
        throw new Error(`storage range read mismatch at ${offset} (${chunk.length} octets pour ${expected} demandés)`);
      }

      const putRes = await fetch(sessionUrl, {
        method: "PUT",
        headers: { "Content-Range": `bytes ${offset}-${offset + chunk.length - 1}/${totalSize}` },
        body: chunk,
      });

      if (putRes.status === 200 || putRes.status === 201) {
        await putRes.text();
        return;
      }
      if (putRes.status !== 308) {
        throw new Error(`Drive chunk upload failed (${putRes.status}): ${await putRes.text()}`);
      }

      // 308 = chunk accepté. Drive renvoie le dernier octet réellement reçu,
      // qui peut être inférieur à ce qui a été envoyé.
      const confirmedRange = putRes.headers.get("range");
      await putRes.text();
      const confirmed = confirmedRange ? Number(confirmedRange.split("-")[1]) + 1 : NaN;
      offset = Number.isFinite(confirmed) && confirmed > offset ? confirmed : offset + chunk.length;

      if (heartbeat && Date.now() - lastBeat >= heartbeatIntervalMs) {
        await heartbeat();
        lastBeat = Date.now();
      }
    }

    // Tous les octets ont été envoyés sans que Drive ne finalise le fichier.
    throw new Error(`Drive resumable upload incomplete (${totalSize} octets envoyés, aucune confirmation)`);
  } catch (err) {
    // Session annulée pour ne pas laisser de fichier partiel dans Drive.
    // L'échec de l'annulation ne doit jamais masquer l'erreur d'origine.
    try {
      const cancelRes = await fetch(sessionUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await cancelRes.text();
    } catch (cancelErr) {
      console.warn("[drive-resumable-upload] Annulation de session échouée:", cancelErr);
    }
    throw err;
  }
}
