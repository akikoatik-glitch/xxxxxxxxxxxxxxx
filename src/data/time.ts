export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dateKeyUtcFromUtc(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/**
 * Convert a wall-clock time belonging to a specific IANA timezone to a UTC ISO string.
 * The timezone is the competition's local timezone (kickoff times in football.json are
 * published in local kickoff time, e.g. Europe/London for the Premier League).
 */
export function wallClockToUtc(dateStr: string, time: string | undefined, tz: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const norm = time && /^\d{1,2}:\d{2}$/.test(time) ? time : undefined;
  const [hh, mm] = norm ? norm.split(":").map(Number) : [12, 0];
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(utcGuess);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const localUtc = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), hour, Number(get("minute")));
  const offsetMs = localUtc - utcGuess;

  const realUtc = new Date(utcGuess - offsetMs);
  return realUtc.toISOString();
}