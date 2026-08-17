/**
 * Formatage français, partagé entre serveur et client.
 *
 * Les `Intl.*Format` sont coûteux à construire : on les instancie une fois au
 * chargement du module plutôt qu'à chaque cellule de tableau.
 */

const dateShort = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateMedium = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeOnly = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateShort.format(new Date(d));
}

export function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateLong.format(new Date(d));
}

export function formatDateMedium(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateMedium.format(new Date(d));
}

export function formatDayMonth(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dayMonth.format(new Date(d));
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return timeOnly.format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return `${dateShort.format(date)} à ${timeOnly.format(date)}`;
}

/** « 1 h 30 », « 45 min » — jamais « 1.5 h ». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Écart lisible : « dans 3 jours », « il y a 2 mois ». */
export function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  const days = Math.round(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );

  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  if (days > 0 && days < 30) return `dans ${days} jours`;
  if (days < 0 && days > -30) return `il y a ${-days} jours`;

  const months = Math.round(days / 30);
  if (months > 0 && months < 12)
    return `dans ${months} mois`;
  if (months < 0 && months > -12)
    return `il y a ${-months} mois`;

  const years = Math.round(days / 365);
  return years > 0 ? `dans ${years} an${years > 1 ? "s" : ""}` : `il y a ${-years} an${-years > 1 ? "s" : ""}`;
}

/** Numéro de téléphone français par groupes de deux. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/** Adresse sur une ligne, sans virgules orphelines. */
export function formatAddress(parts: {
  address?: string | null;
  addressComplement?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): string {
  const line = [parts.address, parts.addressComplement]
    .filter(Boolean)
    .join(", ");
  const town = [parts.postalCode, parts.city].filter(Boolean).join(" ");
  return [line, town].filter(Boolean).join(" — ") || "—";
}

/** Initiales pour les pastilles techniciens. */
export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

/** Semaine française : lundi → dimanche. */
export function startOfWeek(d: Date): Date {
  const c = startOfDay(d);
  const day = (c.getDay() + 6) % 7;
  c.setDate(c.getDate() - day);
  return c;
}

export function endOfWeek(d: Date): Date {
  const c = startOfWeek(d);
  c.setDate(c.getDate() + 6);
  return endOfDay(c);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function addMonths(d: Date, n: number): Date {
  const c = new Date(d);
  c.setMonth(c.getMonth() + n);
  return c;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Valeur `value` d'un `<input type="date">`, en heure locale. */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Recombine les champs date + heure d'un formulaire en `Date` locale.
 * `new Date("2026-08-17T08:30")` est interprété en heure locale par tous les
 * navigateurs modernes, contrairement à la forme sans heure qui bascule en UTC.
 */
export function fromDateTimeInput(date: string, time: string): Date {
  return new Date(`${date}T${time || "00:00"}`);
}
