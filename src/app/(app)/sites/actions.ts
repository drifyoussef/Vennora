"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionContext } from "@/core/context";
import { audit } from "@/core/tenant";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { objectId, siteSchema } from "@/core/schemas";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export async function createSiteAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("site.create");

    const parsed = siteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;

    // Le client est fourni par le formulaire : on vérifie qu'il appartient
    // bien à l'organisation avant de rattacher quoi que ce soit.
    const customer = await db.customer.findFirst({
      where: { id: input.customerId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Client");

    const site = await db.site.create({
      data: {
        orgId: ctx.orgId,
        customerId: customer.id,
        name: input.name,
        address: input.address,
        addressComplement: input.addressComplement,
        postalCode: input.postalCode,
        city: input.city,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        notes: input.notes,
        accessNotes: input.accessNotes,
      },
      select: { id: true, name: true },
    });

    await audit(ctx, {
      action: "site.created",
      entity: "Site",
      entityId: site.id,
      metadata: { name: site.name, customerId: customer.id },
    });

    revalidatePath("/sites");
    revalidatePath(`/clients/${customer.id}`);
    return { ok: true, data: { id: site.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateSiteAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("site.update");
    const siteId = objectId.parse(id);

    const parsed = siteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;
    const customer = await db.customer.findFirst({
      where: { id: input.customerId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Client");

    const result = await db.site.updateMany({
      where: { id: siteId },
      data: {
        customerId: customer.id,
        name: input.name,
        address: input.address,
        addressComplement: input.addressComplement,
        postalCode: input.postalCode,
        city: input.city,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        notes: input.notes,
        accessNotes: input.accessNotes,
      },
    });
    if (result.count === 0) throw new NotFoundError("Site");

    await audit(ctx, {
      action: "site.updated",
      entity: "Site",
      entityId: siteId,
    });

    revalidatePath("/sites");
    revalidatePath(`/sites/${siteId}`);
    revalidatePath(`/clients/${customer.id}`);
    return { ok: true, data: { id: siteId } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteSiteAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("site.delete");
    const siteId = objectId.parse(id);

    const site = await db.site.findFirst({
      where: { id: siteId },
      select: { id: true, name: true, customerId: true },
    });
    if (!site) throw new NotFoundError("Site");

    const completed = await db.intervention.count({
      where: { siteId, status: "COMPLETED" },
    });
    if (completed > 0) {
      return {
        ok: false,
        code: "CONFLICT",
        error: `Ce site porte ${completed} intervention${completed > 1 ? "s" : ""} terminée${completed > 1 ? "s" : ""}. L'historique ne peut pas être supprimé.`,
      };
    }

    await db.intervention.deleteMany({ where: { siteId } });
    await db.equipment.deleteMany({ where: { siteId } });
    await db.site.deleteMany({ where: { id: siteId } });

    await audit(ctx, {
      action: "site.deleted",
      entity: "Site",
      entityId: siteId,
      metadata: { name: site.name },
    });

    revalidatePath("/sites");
    revalidatePath(`/clients/${site.customerId}`);
    return { ok: true, data: { id: site.customerId } };
  } catch (e) {
    return toActionError(e);
  }
}
