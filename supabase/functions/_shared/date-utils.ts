/**
 * Date Formatting Utilities
 *
 * Centralized date formatting functions for French locale
 */

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];

const DAYS_FR = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"
];

/**
 * Format date in French long format: "1 janvier 2024"
 */
export function formatDateFr(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const day = date.getDate();
  const month = MONTHS_FR[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format date with day name: "lundi 1 janvier 2024"
 */
export function formatDateWithDayFr(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const dayName = DAYS_FR[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_FR[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} ${day} ${month} ${year}`;
}

/**
 * Format date range: "1 au 3 janvier 2024" or "30 décembre 2023 au 2 janvier 2024"
 */
export function formatDateRange(startStr: string | Date, endStr: string | Date): string {
  const startDate = typeof startStr === "string" ? new Date(startStr) : startStr;
  const endDate = typeof endStr === "string" ? new Date(endStr) : endStr;

  const startDay = startDate.getDate();
  const startMonth = MONTHS_FR[startDate.getMonth()];
  const startYear = startDate.getFullYear();

  const endDay = endDate.getDate();
  const endMonth = MONTHS_FR[endDate.getMonth()];
  const endYear = endDate.getFullYear();

  if (startYear === endYear && startDate.getMonth() === endDate.getMonth()) {
    // Same month and year: "1 au 3 janvier 2024"
    return `${startDay} au ${endDay} ${endMonth} ${endYear}`;
  } else if (startYear === endYear) {
    // Same year, different month: "30 décembre au 2 janvier 2024"
    return `${startDay} ${startMonth} au ${endDay} ${endMonth} ${endYear}`;
  } else {
    // Different years
    return `${startDay} ${startMonth} ${startYear} au ${endDay} ${endMonth} ${endYear}`;
  }
}

/**
 * Format date for filename: "2024-01-15"
 */
export function formatDateForFileName(dateStr?: string | Date): string {
  const date = dateStr
    ? (typeof dateStr === "string" ? new Date(dateStr) : dateStr)
    : new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format date short: "15/01/2024"
 */
export function formatDateShort(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format time: "14h30"
 */
export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  return `${hours}h${minutes}`;
}

/**
 * Format datetime: "15/01/2024 à 14h30"
 */
export function formatDateTime(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const dateFormatted = formatDateShort(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dateFormatted} à ${hours}h${minutes}`;
}

/**
 * Format for ICS calendar files in Europe/Paris timezone: "20240115T143000"
 */
export function formatICSDate(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

/**
 * Calculate duration in days between two dates
 */
export function calculateDurationDays(startStr: string | Date, endStr: string | Date): number {
  const start = typeof startStr === "string" ? new Date(startStr) : startStr;
  const end = typeof endStr === "string" ? new Date(endStr) : endStr;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}
