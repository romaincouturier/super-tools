export function videoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "drive.google.com") return null;
  const id = parsed.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
    ?? (["/open", "/uc"].includes(parsed.pathname) ? parsed.searchParams.get("id") : null);
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const preview = new URL(`https://drive.google.com/file/d/${id}/preview`);
  const resourceKey = parsed.searchParams.get("resourcekey");
  if (resourceKey) preview.searchParams.set("resourcekey", resourceKey);
  return preview.href;
}