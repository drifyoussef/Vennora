import "server-only";
import { InterventionStatus, UserRole } from "@/core/enums";
import { ForbiddenError, NotFoundError } from "../errors";
import type { AppContext } from "../context";

/**
 * Garde commune à toutes les actions du terrain.
 *
 * Photos, notes, anomalies, signature et clôture partagent exactement les
 * mêmes conditions : l'intervention existe dans l'organisation, elle est
 * assignée à celui qui agit (sauf pour un administrateur), et elle n'est pas
 * déjà close. Écrire ce contrôle une fois évite qu'une des huit actions
 * l'oublie.
 */
export async function requireEditableIntervention(
  { db, user }: AppContext,
  interventionId: string,
) {
  const intervention = await db.intervention.findFirst({
    where: { id: interventionId },
    select: {
      id: true,
      reference: true,
      status: true,
      technicianId: true,
      customerId: true,
      siteId: true,
      equipmentId: true,
    },
  });

  if (!intervention) throw new NotFoundError("Intervention");

  if (
    user.role === UserRole.TECHNICIAN &&
    intervention.technicianId !== user.id
  ) {
    // Volontairement « introuvable » : confirmer l'existence d'une
    // intervention assignée à un collègue n'apporte rien et renseigne.
    throw new NotFoundError("Intervention");
  }

  if (intervention.status === InterventionStatus.COMPLETED) {
    throw new ForbiddenError(
      "Cette intervention est terminée et signée. Elle ne peut plus être modifiée.",
    );
  }

  if (intervention.status === InterventionStatus.CANCELLED) {
    throw new ForbiddenError("Cette intervention est annulée.");
  }

  return intervention;
}

/** Même garde, sans exiger que l'intervention soit encore ouverte. */
export async function requireVisibleIntervention(
  { db, user }: AppContext,
  interventionId: string,
) {
  const intervention = await db.intervention.findFirst({
    where: { id: interventionId },
    select: {
      id: true,
      reference: true,
      status: true,
      technicianId: true,
      customerId: true,
      siteId: true,
      equipmentId: true,
    },
  });

  if (!intervention) throw new NotFoundError("Intervention");
  if (
    user.role === UserRole.TECHNICIAN &&
    intervention.technicianId !== user.id
  ) {
    throw new NotFoundError("Intervention");
  }
  return intervention;
}
