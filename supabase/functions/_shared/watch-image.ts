const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateWatchImage(itemId: string, mediaId: string, mime: string, size: number) {
  if (!UUID.test(itemId) || !UUID.test(mediaId)) throw new Error("Identifiant de veille ou d’image invalide");
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    throw new Error("Images acceptées : JPG, JPEG, PNG, WebP et GIF");
  }
  if (size <= 0 || size > 50 * 1024 * 1024) throw new Error("L’image doit faire au maximum 50 Mo");
}

export async function saveWatchImage(admin: any, user: { id: string; email?: string }, file: File, itemId: string, mediaId: string, mime: string) {
  validateWatchImage(itemId, mediaId, mime, file.size);
  const { data: item, error: itemError } = await admin.from("watch_items").select("id,content_type,file_url").eq("id", itemId).single();
  if (itemError || !item) throw new Error("Élément de veille introuvable");
  const { data: existing, error: existingError } = await admin.from("media").select("*").eq("id", mediaId).maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (existing.source_type !== "watch" || existing.source_id !== itemId || existing.created_by !== user.id) throw new Error("Image déjà rattachée ailleurs");
    return existing;
  }
  const path = `images/${itemId}/${mediaId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await admin.storage.from("watch").upload(path, file, { contentType: mime, upsert: false });
  if (uploadError) throw uploadError;
  const { data: url } = admin.storage.from("watch").getPublicUrl(path);
  const { data: media, error } = await admin.from("media").insert({
    id: mediaId, file_url: url.publicUrl, file_name: file.name, file_size: file.size,
    mime_type: mime, file_type: "image", source_type: "watch", source_id: itemId,
    created_by: user.id, position: 0,
  }).select().single();
  if (error) {
    await admin.storage.from("watch").remove([path]);
    throw error;
  }
  const { error: logError } = await admin.from("activity_logs").insert({
    action_type: "watch_image_added", recipient_email: user.email || "", user_id: user.id,
    details: { watch_item_id: itemId, media_id: mediaId, file_name: file.name, file_size: file.size },
  });
  if (logError) {
    await admin.from("media").delete().eq("id", mediaId);
    await admin.storage.from("watch").remove([path]);
    throw logError;
  }
  if (item.content_type === "image" && !item.file_url) {
    const { error: primaryError } = await admin.from("watch_items").update({
      file_url: url.publicUrl, file_name: file.name, file_size: file.size, mime_type: mime,
    }).eq("id", itemId).is("file_url", null);
    if (primaryError) throw primaryError;
  }
  return media;
}