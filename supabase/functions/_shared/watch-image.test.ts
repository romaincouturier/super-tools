import { describe, expect, it, vi } from "vitest";
import { saveWatchImage, validateWatchImage } from "./watch-image";

const itemId = "11111111-1111-4111-8111-111111111111";
const mediaId = "22222222-2222-4222-8222-222222222222";

describe("images de veille", () => {
  it("accepte les images et refuse un autre type sans écrire", () => {
    expect(() => validateWatchImage(itemId, mediaId, "image/png", 100)).not.toThrow();
    expect(() => validateWatchImage(itemId, mediaId, "application/pdf", 100)).toThrow("Images acceptées");
  });

  it("enregistre une image dans la médiathèque et trace son rattachement à la veille", async () => {
    const mediaInsert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: mediaId }, error: null }) }) });
    const logInsert = vi.fn().mockResolvedValue({ error: null });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: (table: string) => table === "watch_items"
        ? { select: () => ({ eq: () => ({ single: async () => ({ data: { id: itemId }, error: null }) }) }) }
        : table === "activity_logs" ? { insert: logInsert } : {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }), insert: mediaInsert,
        },
      storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: "/image.png" } }) }) },
    };
    await saveWatchImage(admin, { id: "staff", email: "staff@example.test" }, new File(["png"], "photo.png"), itemId, mediaId, "image/png");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(mediaInsert).toHaveBeenCalledWith(expect.objectContaining({ source_type: "watch", source_id: itemId, id: mediaId, file_type: "image" }));
    expect(logInsert).toHaveBeenCalledWith(expect.objectContaining({ action_type: "watch_image_added", details: expect.objectContaining({ watch_item_id: itemId, media_id: mediaId }) }));
  });

  it("une nouvelle tentative ne duplique pas une image déjà enregistrée", async () => {
    const upload = vi.fn();
    const existing = { id: mediaId, source_type: "watch", source_id: itemId, created_by: "staff" };
    const admin = {
      from: (table: string) => ({ select: () => ({ eq: () => table === "watch_items"
        ? { single: async () => ({ data: { id: itemId }, error: null }) }
        : { maybeSingle: async () => ({ data: existing, error: null }) } }) }),
      storage: { from: () => ({ upload }) },
    };
    expect(await saveWatchImage(admin, { id: "staff" }, new File(["png"], "photo.png"), itemId, mediaId, "image/png")).toEqual(existing);
    expect(upload).not.toHaveBeenCalled();
  });
});