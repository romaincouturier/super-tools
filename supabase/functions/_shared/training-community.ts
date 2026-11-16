export interface TrainingCommunity {
  community_lms_course_id?: string | null;
  private_group_url?: string | null;
}

export function trainingCommunityUrl(training: TrainingCommunity, appUrl: string, staff = false): string | null {
  const courseId = training.community_lms_course_id;
  if (courseId) return `${appUrl.replace(/\/$/, "")}${staff ? `/lms/communautes/${encodeURIComponent(courseId)}` : `/espace-apprenant/pratique?fromCourse=${encodeURIComponent(courseId)}`}`;
  const external = training.private_group_url?.trim();
  return external && /^https?:\/\//i.test(external) ? external : null;
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function includeTrainingCommunity(html: string, training: TrainingCommunity, appUrl: string): string {
  const url = trainingCommunityUrl(training, appUrl);
  if (!url) return html;
  let body = html;
  if (training.community_lms_course_id && training.private_group_url?.trim()) {
    body = body.split(training.private_group_url.trim()).join(escapeHtml(url));
  }
  if (body.includes(escapeHtml(url))) return body;
  const label = training.community_lms_course_id ? "Rejoindre la communauté SuperTilt Academy" : "Rejoindre la communauté";
  const block = `<p style="text-align:left"><a href="${escapeHtml(url)}">${label}</a></p>`;
  return body.includes("</body>") ? body.replace("</body>", `${block}</body>`) : body + block;
}

export async function appendTrainingCommunity(db: any, html: string, trainingId: string, appUrl: string): Promise<string> {
  const { data, error } = await db.from("trainings").select("community_lms_course_id, private_group_url").eq("id", trainingId).maybeSingle();
  if (error) throw error;
  return data ? includeTrainingCommunity(html, data, appUrl) : html;
}