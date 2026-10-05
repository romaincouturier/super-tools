// Logique pure (testable) : regroupement des publications et rendu de l'aperçu.

export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface PendingDeposit {
  id: string;
  course_id: string;
  lesson_id: string | null;
  learner_email: string;
  comment: string | null;
  file_url: string | null;
  file_mime: string | null;
  file_name: string | null;
  trainer_notify_requested_at: string;
}

export interface DepositGroup {
  key: string;
  learner_email: string;
  course_id: string;
  deposits: PendingDeposit[];
}

/**
 * Regroupe par (apprenant, formation). Un groupe n'est prêt que lorsque sa
 * publication la plus récente a au moins GROUP_WINDOW_MS : les publications
 * rapprochées partent ensemble dans un seul mail.
 */
export function readyGroups(pending: PendingDeposit[], now: number): DepositGroup[] {
  const map = new Map<string, DepositGroup>();
  for (const d of pending) {
    const email = d.learner_email.toLowerCase();
    const key = `${email}|${d.course_id}`;
    const g = map.get(key) ?? { key, learner_email: email, course_id: d.course_id, deposits: [] };
    g.deposits.push(d);
    map.set(key, g);
  }
  const ready: DepositGroup[] = [];
  for (const g of map.values()) {
    const latest = Math.max(...g.deposits.map((d) => Date.parse(d.trainer_notify_requested_at)));
    if (now - latest >= GROUP_WINDOW_MS) {
      g.deposits.sort((a, b) => a.trainer_notify_requested_at.localeCompare(b.trainer_notify_requested_at));
      ready.push(g);
    }
  }
  return ready;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Titre = première ligne du texte (tronquée), extrait = reste (300 car.). */
export function titleAndExcerpt(comment: string | null): { title: string; excerpt: string } {
  const text = (comment || "").trim();
  if (!text) return { title: "", excerpt: "" };
  const [first, ...rest] = text.split(/\r?\n/);
  const title = first.length > 100 ? first.slice(0, 100) + "…" : first;
  let excerpt = rest.join("\n").trim();
  if (first.length > 100) excerpt = text;
  if (excerpt.length > 300) excerpt = excerpt.slice(0, 300) + "…";
  return { title, excerpt };
}

export function depositPreviewHtml(opts: {
  deposit: PendingDeposit;
  lessonTitle: string | null;
  viewUrl: string;
  likeUrl: string;
}): string {
  const { deposit, lessonTitle, viewUrl, likeUrl } = opts;
  const isImage = (deposit.file_mime || "").startsWith("image/") && !!deposit.file_url;
  const { title, excerpt } = titleAndExcerpt(deposit.comment);
  const img = isImage
    ? `<a href="${escapeHtml(viewUrl)}"><img src="${escapeHtml(deposit.file_url!)}" alt="${escapeHtml(deposit.file_name || "Visuel")}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:6px;margin:0 0 12px 0" /></a>`
    : deposit.file_name
    ? `<p style="margin:0 0 8px 0;color:#6b7280;font-size:13px">📎 ${escapeHtml(deposit.file_name)}</p>`
    : "";
  const lesson = lessonTitle
    ? `<p style="margin:0 0 6px 0;color:#6b7280;font-size:12px">Leçon « ${escapeHtml(lessonTitle)} »</p>`
    : "";
  const titleHtml = title ? `<p style="margin:0 0 6px 0;font-weight:bold;color:#111827">${escapeHtml(title)}</p>` : "";
  const excerptHtml = excerpt
    ? `<p style="margin:0 0 12px 0;color:#374151">${escapeHtml(excerpt).replace(/\n/g, "<br>")}</p>`
    : "";
  const btn = (label: string, url: string, primary: boolean) =>
    `<a href="${escapeHtml(url)}" style="display:inline-block;padding:8px 16px;margin:0 8px 0 0;border-radius:6px;text-decoration:none;font-size:14px;${
      primary ? "background:#111827;color:#ffffff" : "background:#ffffff;color:#111827;border:1px solid #d1d5db"
    }">${label}</a>`;
  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;background:#f9fafb">
      ${lesson}${img}${titleHtml}${excerptHtml}
      <div>${btn("👍 J'aime", likeUrl, false)}${btn("Voir la publication", viewUrl, true)}</div>
    </div>`;
}
