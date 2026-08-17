import type { $Enums } from "@/generated/prisma";

/**
 * Énumérations métier, utilisables côté navigateur.
 *
 * Les énumérations générées par Prisma sont exportées depuis
 * `@/generated/prisma`, dont l'import — même pour une seule constante —
 * entraîne tout le runtime Prisma dans le bundle client. On redéclare donc
 * ici les valeurs sous forme d'objets simples.
 *
 * La cohérence avec le schéma n'est pas laissée à la vigilance : chaque
 * énumération est confrontée au type Prisma correspondant. Ajouter une valeur
 * dans `schema.prisma` sans la reporter ici casse la compilation.
 */

/** Échoue à la compilation si `V` ne couvre pas exactement `E`. */
type Exhaustive<E extends string, V extends string> = [E] extends [V]
  ? [V] extends [E]
    ? true
    : ["Valeur en trop", Exclude<V, E>]
  : ["Valeur manquante", Exclude<E, V>];

export const UserRole = {
  ADMIN: "ADMIN",
  TECHNICIAN: "TECHNICIAN",
} as const;
export type UserRole = $Enums.UserRole;
export type _UserRole = Exhaustive<
  $Enums.UserRole,
  (typeof UserRole)[keyof typeof UserRole]
>;

export const CustomerKind = {
  INDIVIDUAL: "INDIVIDUAL",
  COMPANY: "COMPANY",
} as const;
export type CustomerKind = $Enums.CustomerKind;
export type _CustomerKind = Exhaustive<
  $Enums.CustomerKind,
  (typeof CustomerKind)[keyof typeof CustomerKind]
>;

export const InterventionStatus = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type InterventionStatus = $Enums.InterventionStatus;
export type _InterventionStatus = Exhaustive<
  $Enums.InterventionStatus,
  (typeof InterventionStatus)[keyof typeof InterventionStatus]
>;

export const AnomalySeverity = {
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type AnomalySeverity = $Enums.AnomalySeverity;
export type _AnomalySeverity = Exhaustive<
  $Enums.AnomalySeverity,
  (typeof AnomalySeverity)[keyof typeof AnomalySeverity]
>;

export const AnomalyStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
} as const;
export type AnomalyStatus = $Enums.AnomalyStatus;
export type _AnomalyStatus = Exhaustive<
  $Enums.AnomalyStatus,
  (typeof AnomalyStatus)[keyof typeof AnomalyStatus]
>;

export const TranscriptStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  DONE: "DONE",
  FAILED: "FAILED",
} as const;
export type TranscriptStatus = $Enums.TranscriptStatus;
export type _TranscriptStatus = Exhaustive<
  $Enums.TranscriptStatus,
  (typeof TranscriptStatus)[keyof typeof TranscriptStatus]
>;

export const ReportOrigin = {
  MANUAL: "MANUAL",
  AI: "AI",
} as const;
export type ReportOrigin = $Enums.ReportOrigin;
export type _ReportOrigin = Exhaustive<
  $Enums.ReportOrigin,
  (typeof ReportOrigin)[keyof typeof ReportOrigin]
>;

export const DocumentCategory = {
  REPORT: "REPORT",
  INVOICE: "INVOICE",
  QUOTE: "QUOTE",
  CERTIFICATE: "CERTIFICATE",
  PHOTO: "PHOTO",
  OTHER: "OTHER",
} as const;
export type DocumentCategory = $Enums.DocumentCategory;
export type _DocumentCategory = Exhaustive<
  $Enums.DocumentCategory,
  (typeof DocumentCategory)[keyof typeof DocumentCategory]
>;

export const ReminderStatus = {
  PENDING: "PENDING",
  SCHEDULED: "SCHEDULED",
  DONE: "DONE",
  DISMISSED: "DISMISSED",
} as const;
export type ReminderStatus = $Enums.ReminderStatus;
export type _ReminderStatus = Exhaustive<
  $Enums.ReminderStatus,
  (typeof ReminderStatus)[keyof typeof ReminderStatus]
>;
