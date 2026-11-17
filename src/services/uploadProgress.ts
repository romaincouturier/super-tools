export type UploadProgressCallback = (percent: number) => void;

export function uploadWithProgress(url: string, method: string, body: XMLHttpRequestBodyInit, headers: Record<string, string>, onProgress?: UploadProgressCallback): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(100, Math.round(event.loaded / event.total * 100)));
    };
    xhr.onload = () => {
      let result: any;
      try { result = JSON.parse(xhr.responseText); } catch (error) { result = { message: error instanceof Error ? `Réponse d'envoi illisible (${xhr.status})` : "Réponse d'envoi illisible" }; }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(result);
      } else {
        reject(new Error(result.error || result.message || `Échec de l'envoi (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Connexion interrompue pendant l'envoi"));
    xhr.onabort = () => reject(new Error("Envoi annulé"));
    onProgress?.(0);
    xhr.send(body);
  });
}

export function uploadSignedFile(bucket: string, path: string, token: string, file: File, contentType: string, upsert: boolean, onProgress?: UploadProgressCallback) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath}?token=${encodeURIComponent(token)}`;
  return uploadWithProgress(url, "PUT", file, {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": contentType,
    "cache-control": "max-age=3600",
    "x-upsert": String(upsert),
  }, onProgress);
}