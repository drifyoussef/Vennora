"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionContext } from "@/core/context";
import { refreshCustomerDates } from "@/core/data/customers";
import { refreshEquipmentDates } from "@/core/data/equipment";
import { nextReference } from "@/core/data/interventions";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { assertOwnsIntervention } from "@/core/permissions";
import {
  interventionSchema,
  interventionStatusSchema,
  objectId,
} from "@/core/schemas";
import { audit } from "@/core/tenant";
import { InterventionStatus } from "@/core/enums";
import { fromDateTimeInput } from "@/lib/format";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/**
 * Contrôle que toutes les références pointent dans l'organisation, et que la
 * chaîne client → site → équipement est cohérente.
 *
 * Sans ce contrôle, un formulaire modifié permettrait de rattacher le site
 * d'un client à l'intervention d'un autre : les deux appartiennent bien à
 * l'entreprise, l'isolation tenant ne suffit donc pas ici.
 */
async function resolveRefs(
  db: Awaited<ReturnType<typeof getActionContext>>["db"],
  tradeSlug: string,
  input: {
    customerId: string;
    siteId: string;
    equipmentId?: string | null;
    technicianId: string;
    typeId: string;
  },
) {
  const [site, technician, type] = await Promise.all([
    db.site.findFirst({
      where: { id: input.siteId, customerId: input.customerId },
      select: { id: true, customerId: true },
    }),
    db.user.findFirst({
      where: { id: input.technicianId, active: true },
      select: { id: true },
    }),
    db.interventionType.findFirst({
      where: { id: input.typeId, active: true, trade: { slug: tradeSlug } },
      select: { id: true, recurrenceMonths: true },
    }),
  ]);

  if (!site) throw new NotFoundError("Site du client");
  if (!technician) throw new NotFoundError("Technicien");
  if (!type) throw new NotFoundError("Type d'intervention");

  let equipmentId: string | null = null;
  if (input.equipmentId) {
    const equipment = await db.equipment.findFirst({
      where: { id: input.equipmentId, siteId: site.id },
      select: { id: true },
    });
    if (!equipment) throw new NotFoundError("Équipement du site");
    equipmentId = equipment.id;
  }

  return { site, technician, type, equipmentId };
}

export async function createInterventionAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.create");
    const { db, ctx, user } = context;

    const parsed = interventionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;
    const refs = await resolveRefs(db, user.org.tradeSlug, input);

    const scheduledStart = fromDateTimeInput(input.date, input.startTime);
    const scheduledEnd = fromDateTimeInput(input.date, input.endTime);
    const reference = await nextReference(context, scheduledStart);

    const intervention = await db.intervention.create({
      data: {
        orgId: ctx.orgId,
        reference,
        customerId: refs.site.customerId,
        siteId: refs.site.id,
        equipmentId: refs.equipmentId,
        technicianId: refs.technician.id,
        typeId: refs.type.id,
        scheduledStart,
        scheduledEnd,
        status: InterventionStatus.PLANNED,
        notes: input.notes,
        internalNotes: input.internalNotes,
      },
      select: { id: true, reference: true },
    });

    await refreshCustomerDates(context, refs.site.customerId);

    // Un rappel dont l'équipement vient d'être replanifié n'a plus lieu d'être
    // en attente : sinon la liste « à replanifier » redemande éternellement ce
    // qui est déjà au planning.
    if (refs.equipmentId) {
      await db.reminder.updateMany({
        where: { equipmentId: refs.equipmentId, status: "PENDING" },
        data: { status: "SCHEDULED" },
      });
    }

    await audit(ctx, {
      action: "intervention.created",
      entity: "Intervention",
      entityId: intervention.id,
      metadata: { reference: intervention.reference },
    });

    revalidatePath("/interventions");
    revalidatePath("/planning");
    revalidatePath("/");
    return { ok: true, data: { id: intervention.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateInterventionAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.update");
    const { db, ctx, user } = context;
    const interventionId = objectId.parse(id);

    const existing = await db.intervention.findFirst({
      where: { id: interventionId },
      select: {
        id: true,
        technicianId: true,
        status: true,
        customerId: true,
        equipmentId: true,
      },
    });
    if (!existing) throw new NotFoundError("Intervention");
    assertOwnsIntervention(user, existing);

    if (existing.status === InterventionStatus.COMPLETED) {
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "Cette intervention est terminée et signée. Elle ne peut plus être replanifiée.",
      };
    }

    const parsed = interventionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;
    const refs = await resolveRefs(db, user.org.tradeSlug, input);

    await db.intervention.updateMany({
      where: { id: interventionId },
      data: {
        customerId: refs.site.customerId,
        siteId: refs.site.id,
        equipmentId: refs.equipmentId,
        technicianId: refs.technician.id,
        typeId: refs.type.id,
        scheduledStart: fromDateTimeInput(input.date, input.startTime),
        scheduledEnd: fromDateTimeInput(input.date, input.endTime),
        notes: input.notes,
        internalNotes: input.internalNotes,
      },
    });

    await refreshCustomerDates(context, refs.site.customerId);
    if (existing.customerId !== refs.site.customerId) {
      await refreshCustomerDates(context, existing.customerId);
    }

    await audit(ctx, {
      action: "intervention.updated",
      entity: "Intervention",
      entityId: interventionId,
    });

    revalidatePath("/interventions");
    revalidatePath(`/interventions/${interventionId}`);
    revalidatePath("/planning");
    return { ok: true, data: { id: interventionId } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Changement de statut.
 *
 * Les transitions autorisées sont explicites : passer directement de
 * « planifiée » à « terminée » contournerait la prise de photos et la
 * signature, qui sont tout l'intérêt du produit.
 */
const ALLOWED_TRANSITIONS: Record<InterventionStatus, InterventionStatus[]> = {
  [InterventionStatus.PLANNED]: [
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.CANCELLED,
  ],
  [InterventionStatus.IN_PROGRESS]: [
    InterventionStatus.COMPLETED,
    InterventionStatus.PLANNED,
    InterventionStatus.CANCELLED,
  ],
  [InterventionStatus.COMPLETED]: [],
  [InterventionStatus.CANCELLED]: [InterventionStatus.PLANNED],
};

export async function setInterventionStatusAction(
  id: string,
  status: InterventionStatus,
): Promise<ActionResult<{ id: string; status: InterventionStatus }>> {
  try {
    const context = await getActionContext("intervention.update");
    const { db, ctx, user } = context;

    const parsed = interventionStatusSchema.parse({ id, status });

    const existing = await db.intervention.findFirst({
      where: { id: parsed.id },
      select: {
        id: true,
        status: true,
        technicianId: true,
        customerId: true,
        equipmentId: true,
        startedAt: true,
      },
    });
    if (!existing) throw new NotFoundError("Intervention");
    assertOwnsIntervention(user, existing);

    if (!ALLOWED_TRANSITIONS[existing.status].includes(parsed.status)) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "Ce changement de statut n'est pas autorisé.",
      };
    }

    const now = new Date();
    await db.intervention.updateMany({
      where: { id: parsed.id },
      data: {
        status: parsed.status,
        startedAt:
          parsed.status === InterventionStatus.IN_PROGRESS && !existing.startedAt
            ? now
            : undefined,
        completedAt:
          parsed.status === InterventionStatus.COMPLETED ? now : undefined,
      },
    });

    await refreshCustomerDates(context, existing.customerId);
    if (existing.equipmentId) {
      await refreshEquipmentDates(context, existing.equipmentId);
    }

    await audit(ctx, {
      action: `intervention.${parsed.status.toLowerCase()}`,
      entity: "Intervention",
      entityId: parsed.id,
      metadata: { from: existing.status, to: parsed.status },
    });

    revalidatePath("/");
    revalidatePath("/interventions");
    revalidatePath(`/interventions/${parsed.id}`);
    revalidatePath("/planning");
    return { ok: true, data: { id: parsed.id, status: parsed.status } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteInterventionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.delete");
    const { db, ctx } = context;
    const interventionId = objectId.parse(id);

    const existing = await db.intervention.findFirst({
      where: { id: interventionId },
      select: {
        id: true,
        reference: true,
        status: true,
        customerId: true,
        equipmentId: true,
      },
    });
    if (!existing) throw new NotFoundError("Intervention");

    if (existing.status === InterventionStatus.COMPLETED) {
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "Une intervention terminée fait partie de l'historique de l'équipement et ne peut pas être supprimée. Vous pouvez l'annuler.",
      };
    }

    await db.anomaly.deleteMany({ where: { interventionId } });
    await db.interventionPhoto.deleteMany({ where: { interventionId } });
    await db.voiceNote.deleteMany({ where: { interventionId } });
    await db.report.deleteMany({ where: { interventionId } });
    await db.signature.deleteMany({ where: { interventionId } });
    await db.intervention.deleteMany({ where: { id: interventionId } });

    await refreshCustomerDates(context, existing.customerId);
    if (existing.equipmentId) {
      await refreshEquipmentDates(context, existing.equipmentId);
    }

    await audit(ctx, {
      action: "intervention.deleted",
      entity: "Intervention",
      entityId: interventionId,
      metadata: { reference: existing.reference },
    });

    revalidatePath("/interventions");
    revalidatePath("/planning");
    return { ok: true, data: { id: interventionId } };
  } catch (e) {
    return toActionError(e);
  }
}
