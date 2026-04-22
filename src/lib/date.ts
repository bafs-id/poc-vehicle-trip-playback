/** Format a Date as a local-time YYYY-MM-DD string. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a Date as a local-time YYYY-MM-DDTHH key (used to bucket by hour). */
export function hourKey(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  return `${toLocalDateString(d)}T${h}`;
}

/** Seconds elapsed from `from` to `to`. */
export function secondsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 1000;
}
