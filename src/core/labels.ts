import { AnomalySeverity, AnomalyStatus, CustomerKind, DocumentCategory, InterventionStatus, UserRole } from "@/core/enums";

/**
 * Libellés français des énumérations.
 *
 * Aucun libellé ne doit être écrit en dur dans un composant : le jour où
 * « intervention » devient « passage » pour un autre métier, c'est ici que ça
 * se change (voir aussi `vocabulary` dans les définitions de métier).
 */

export const INTERVENTION_STATUS_LABEL: Record<InterventionStatus, string> = {
  [InterventionStatus.PLANNED]: "Planifiée",
  [InterventionStatus.IN_PROGRESS]: "En cours",
  [InterventionStatus.COMPLETED]: "Terminée",
  [InterventionStatus.CANCELLED]: "Annulée",
};

/** Classe Tailwind de la pastille de statut. */
export const INTERVENTION_STATUS_TONE: Record<InterventionStatus, string> = {
  [InterventionStatus.PLANNED]:
    "bg-status-planned/12 text-status-planned border-status-planned/25",
  [InterventionStatus.IN_PROGRESS]:
    "bg-status-progress/15 text-status-progress border-status-progress/30",
  [InterventionStatus.COMPLETED]:
    "bg-status-done/12 text-status-done border-status-done/25",
  [InterventionStatus.CANCELLED]:
    "bg-status-cancelled/12 text-status-cancelled border-status-cancelled/25 line-through decoration-1",
};

export const ANOMALY_SEVERITY_LABEL: Record<AnomalySeverity, string> = {
  [AnomalySeverity.INFO]: "Information",
  [AnomalySeverity.LOW]: "Faible",
  [AnomalySeverity.MEDIUM]: "Moyenne",
  [AnomalySeverity.HIGH]: "Élevée",
  [AnomalySeverity.CRITICAL]: "Critique",
};

export const ANOMALY_SEVERITY_TONE: Record<AnomalySeverity, string> = {
  [AnomalySeverity.INFO]:
    "bg-severity-info/12 text-severity-info border-severity-info/25",
  [AnomalySeverity.LOW]:
    "bg-severity-low/12 text-severity-low border-severity-low/25",
  [AnomalySeverity.MEDIUM]:
    "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  [AnomalySeverity.HIGH]:
    "bg-severity-high/15 text-severity-high border-severity-high/30",
  [AnomalySeverity.CRITICAL]:
    "bg-severity-critical/15 text-severity-critical border-severity-critical/35",
};

/** Ordre de gravité croissante, pour trier une liste d'anomalies. */
export const SEVERITY_ORDER: AnomalySeverity[] = [
  AnomalySeverity.INFO,
  AnomalySeverity.LOW,
  AnomalySeverity.MEDIUM,
  AnomalySeverity.HIGH,
  AnomalySeverity.CRITICAL,
];

export const ANOMALY_STATUS_LABEL: Record<AnomalyStatus, string> = {
  [AnomalyStatus.OPEN]: "Ouverte",
  [AnomalyStatus.RESOLVED]: "Résolue",
  [AnomalyStatus.IGNORED]: "Ignorée",
};

export const CUSTOMER_KIND_LABEL: Record<CustomerKind, string> = {
  [CustomerKind.INDIVIDUAL]: "Particulier",
  [CustomerKind.COMPANY]: "Professionnel",
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Administrateur",
  [UserRole.TECHNICIAN]: "Technicien",
};

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  [DocumentCategory.REPORT]: "Rapport",
  [DocumentCategory.INVOICE]: "Facture",
  [DocumentCategory.QUOTE]: "Devis",
  [DocumentCategory.CERTIFICATE]: "Certificat",
  [DocumentCategory.PHOTO]: "Photo",
  [DocumentCategory.OTHER]: "Autre",
};

/** « 3 interventions », « 1 intervention », « Aucune intervention ». */
export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
  zero?: string,
): string {
  if (count === 0 && zero) return zero;
  return `${count} ${count > 1 ? pluralForm : singular}`;
}
