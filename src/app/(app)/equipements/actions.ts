"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getActionContext } from "@/core/context";
import { audit } from "@/core/tenant";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { equipmentSchema, objectId } from "@/core/schemas";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/**
 * Vérifie que site et type appartiennent bien au périmètre autorisé.
 *
 * Le type d'équipement vient d'un catalogue partagé entre organisations : on
 * contrôle qu'il relève bien du métier de l'entreprise, sinon un formulaire
 * trafiqué permettrait de rattacher un « brûleur de piscine » à un ramoneur.
 */
async function resolveRefs(
  db: Awaited<ReturnType<typeof getActionContext>>["db"],
  tradeSlug: string,
  siteId: string,
  typeId: string,
) {
  const [site, type] = await Promise.all([
    db.site.findFirst({
      where: { id: siteId },
      select: { id: true, customerId: true },
    }),
    db.equipmentType.findFirst({
      where: { id: typeId, active: true, trade: { slug: tradeSlug } },
      select: { id: true },
    }),
  ]);

  if (!site) throw new NotFoundError("Site");
  if (!type) throw new NotFoundError("Type d'équipement");

  return { site, type };
}

export async function createEquipmentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx, user } = await getActionContext("equipment.create");

    const parsed = equipmentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;
    const { site, type } = await resolveRefs(
      db,
      user.org.tradeSlug,
      input.siteId,
      input.typeId,
    );

    const equipment = await db.equipment.create({
      data: {
        orgId: ctx.orgId,
        siteId: site.id,
        typeId: type.id,
        label: input.label,
        brand: input.brand,
        model: input.model,
        serialNumber: input.serialNumber,
        location: input.location,
        installedAt: input.installedAt ?? null,
        description: input.description,
        notes: input.notes,
        qrToken: randomUUID(),
      },
      select: { id: true },
    });

    await audit(ctx, {
      action: "equipment.created",
      entity: "Equipment",
      entityId: equipment.id,
      metadata: { siteId: site.id },
    });

    revalidatePath("/equipements");
    revalidatePath(`/sites/${site.id}`);
    revalidatePath(`/clients/${site.customerId}`);
    return { ok: true, data: { id: equipment.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateEquipmentAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx, user } = await getActionContext("equipment.update");
    const equipmentId = objectId.parse(id);

    const parsed = equipmentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;
    const { site, type } = await resolveRefs(
      db,
      user.org.tradeSlug,
      input.siteId,
      input.typeId,
    );

    const result = await db.equipment.updateMany({
      where: { id: equipmentId },
      data: {
        siteId: site.id,
        typeId: type.id,
        label: input.label,
        brand: input.brand,
        model: input.model,
        serialNumber: input.serialNumber,
        location: input.location,
        installedAt: input.installedAt ?? null,
        description: input.description,
        notes: input.notes,
      },
    });
    if (result.count === 0) throw new NotFoundError("Équipement");

    await audit(ctx, {
      action: "equipment.updated",
      entity: "Equipment",
      entityId: equipmentId,
    });

    revalidatePath("/equipements");
    revalidatePath(`/equipements/${equipmentId}`);
    revalidatePath(`/sites/${site.id}`);
    return { ok: true, data: { id: equipmentId } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Retire un équipement du parc.
 *
 * On désactive au lieu de supprimer dès qu'il existe un historique : les
 * rapports passés référencent cet appareil, et un certificat de ramonage qui
 * renvoie vers un équipement disparu perd sa valeur.
 */
export async function deleteEquipmentAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("equipment.delete");
    const equipmentId = objectId.parse(id);

    const equipment = await db.equipment.findFirst({
      where: { id: equipmentId },
      select: { id: true, siteId: true, label: true },
    });
    if (!equipment) throw new NotFoundError("Équipement");

    const interventions = await db.intervention.count({
      where: { equipmentId },
    });

    if (interventions > 0) {
      await db.equipment.updateMany({
        where: { id: equipmentId },
        data: { active: false, nextDueAt: null },
      });
      await audit(ctx, {
        action: "equipment.deactivated",
        entity: "Equipment",
        entityId: equipmentId,
        metadata: { interventions },
      });
    } else {
      await db.equipment.deleteMany({ where: { id: equipmentId } });
      await audit(ctx, {
        action: "equipment.deleted",
        entity: "Equipment",
        entityId: equipmentId,
      });
    }

    revalidatePath("/equipements");
    revalidatePath(`/sites/${equipment.siteId}`);
    return { ok: true, data: { id: equipment.siteId } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Régénère le jeton du QR code.
 *
 * À utiliser si une étiquette a été photographiée ou si elle circule hors du
 * site : l'ancien QR cesse immédiatement de résoudre.
 */
export async function regenerateQrTokenAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("equipment.update");
    const equipmentId = objectId.parse(id);

    const result = await db.equipment.updateMany({
      where: { id: equipmentId },
      data: { qrToken: randomUUID() },
    });
    if (result.count === 0) throw new NotFoundError("Équipement");

    await audit(ctx, {
      action: "equipment.qrRegenerated",
      entity: "Equipment",
      entityId: equipmentId,
    });

    revalidatePath(`/equipements/${equipmentId}`);
    return { ok: true, data: { id: equipmentId } };
  } catch (e) {
    return toActionError(e);
  }
}
