export const LIVE_STATUSES=['scheduled','completed'] as const;
export const LIVE_FIELDS='id,training_id,title,scheduled_at,duration_minutes,meeting_url,replay_url,status,meeting_type,trainings(training_name)';
export function flattenLive(r:Record<string,unknown>){const {trainings,...rest}=r;const t=trainings as {training_name?:string}|null;return {...rest,training_name:t?.training_name??null};}
export function replayPostContent(title:string,calendarUrl:string){return `🎬 Le replay du live « ${title} » est disponible ! 🎉\n\nVous pouvez le retrouver dès maintenant dans le [calendrier des lives](${calendarUrl}).\n\nBon visionnage 👀`;}
