const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) {
    return iso;
  }
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatIssueDate(iso: string): string {
  const parsed = new Date(`${iso}T12:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return iso;
  }
  return `${MONTHS[month - 1]} ${year}`;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
