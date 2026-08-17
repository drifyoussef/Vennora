import { UserRole } from "@/core/enums";
import { ForbiddenError } from "./errors";

/**
 * Matrice de permissions.
 *
 * Deux rôles au MVP. L'ADMIN gère l'entreprise ; le TECHNICIAN travaille sur
 * le terrain. Le technicien peut lire les clients/sites/équipements dont il a
 * besoin pour ses interventions, mais ne gère ni le référentiel client ni les
 * paramètres de l'entreprise.
 *
 * Deux permissions demandent une vérification supplémentaire au niveau de
 * l'objet, pas seulement du rôle : `intervention.update` et
 * `intervention.complete` sont accordées au technicien uniquement sur SES
 * interventions. Voir `assertCanEditIntervention`.
 */
export const PERMISSIONS = [
  "dashboard.view",

  "customer.view",
  "customer.create",
  "customer.update",
  "customer.delete",

  "site.view",
  "site.create",
  "site.update",
  "site.delete",

  "equipment.view",
  "equipment.create",
  "equipment.update",
  "equipment.delete",

  "intervention.view",
  "intervention.viewAll",
  "intervention.create",
  "intervention.update",
  "intervention.complete",
  "intervention.delete",
  "intervention.assign",

  "anomaly.view",
  "anomaly.create",
  "anomaly.update",

  "report.view",
  "report.edit",
  "report.send",

  "document.view",
  "document.upload",
  "document.delete",

  "user.view",
  "user.manage",

  "organization.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const TECHNICIAN_PERMISSIONS = new Set<Permission>([
  "dashboard.view",

  "customer.view",
  "site.view",

  "equipment.view",
  "equipment.create",
  "equipment.update",

  "intervention.view",
  "intervention.create",
  "intervention.update",
  "intervention.complete",

  "anomaly.view",
  "anomaly.create",
  "anomaly.update",

  "report.view",
  "report.edit",
  "report.send",

  "document.view",
  "document.upload",
]);

export function can(role: UserRole, permission: Permission): boolean {
  if (role === UserRole.ADMIN) return true;
  return TECHNICIAN_PERMISSIONS.has(permission);
}

export function assertCan(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(
      "Cette action est réservée aux administrateurs de l'entreprise.",
    );
  }
}

/**
 * Un technicien ne peut agir que sur les interventions qui lui sont
 * assignées. L'admin agit sur toutes celles de son organisation.
 */
export function assertOwnsIntervention(
  actor: { id: string; role: UserRole },
  intervention: { technicianId: string },
): void {
  if (actor.role === UserRole.ADMIN) return;
  if (intervention.technicianId !== actor.id) {
    throw new ForbiddenError(
      "Cette intervention est assignée à un autre technicien.",
    );
  }
}
