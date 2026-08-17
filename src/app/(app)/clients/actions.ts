"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionContext } from "@/core/context";
import { audit } from "@/core/tenant";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import {
  customerDisplayName,
  customerSchema,
  objectId,
} from "@/core/schemas";

/**
 * Actions client.
 *
 * Chacune recommence à zéro : contexte (donc session, rôle, organisation),
 * validation, puis écriture via le client scopé. Aucune ne reçoit d'`orgId`
 * depuis le formulaire.
 */

function fieldErrors(error: z.ZodError) {
  const flat = z.flattenError(error);
  return flat.fieldErrors as Record<string, string[]>;
}

export async function createCustomerAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("customer.create");

    const parsed = customerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;
    const customer = await db.customer.create({
      data: {
        orgId: ctx.orgId,
        kind: input.kind,
        name: customerDisplayName(input),
        firstName: input.firstName,
        lastName: input.lastName,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        phoneSecondary: input.phoneSecondary,
        address: input.address,
        postalCode: input.postalCode,
        city: input.city,
        notes: input.notes,
      },
      select: { id: true, name: true },
    });

    await audit(ctx, {
      action: "customer.created",
      entity: "Customer",
      entityId: customer.id,
      metadata: { name: customer.name },
    });

    revalidatePath("/clients");
    return { ok: true, data: { id: customer.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateCustomerAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("customer.update");

    const customerId = objectId.parse(id);
    const parsed = customerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;

    // `updateMany` plutôt qu'`update` : renvoie 0 au lieu de lever quand la
    // ressource appartient à une autre organisation, ce qui nous laisse
    // répondre « introuvable » sans distinguer les deux cas.
    const result = await db.customer.updateMany({
      where: { id: customerId },
      data: {
        kind: input.kind,
        name: customerDisplayName(input),
        firstName: input.firstName,
        lastName: input.lastName,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        phoneSecondary: input.phoneSecondary,
        address: input.address,
        postalCode: input.postalCode,
        city: input.city,
        notes: input.notes,
      },
    });

    if (result.count === 0) throw new NotFoundError("Client");

    await audit(ctx, {
      action: "customer.updated",
      entity: "Customer",
      entityId: customerId,
    });

    revalidatePath("/clients");
    revalidatePath(`/clients/${customerId}`);
    return { ok: true, data: { id: customerId } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Suppression d'un client.
 *
 * MongoDB n'a pas de cascade : on efface explicitement toute la descendance,
 * dans l'ordre inverse des dépendances. Un client ayant des interventions
 * terminées n'est pas supprimable — l'historique et les rapports signés ont
 * une valeur probante, on ne les efface pas d'un clic.
 */
export async function deleteCustomerAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("customer.delete");
    const customerId = objectId.parse(id);

    const customer = await db.customer.findFirst({
      where: { id: customerId },
      select: { id: true, name: true },
    });
    if (!customer) throw new NotFoundError("Client");

    const completed = await db.intervention.count({
      where: { customerId, status: "COMPLETED" },
    });
    if (completed > 0) {
      return {
        ok: false,
        code: "CONFLICT",
        error: `Ce client a ${completed} intervention${completed > 1 ? "s" : ""} terminée${completed > 1 ? "s" : ""}. L'historique ne peut pas être supprimé.`,
      };
    }

    const siteIds = (
      await db.site.findMany({ where: { customerId }, select: { id: true } })
    ).map((s) => s.id);

    await db.reminder.deleteMany({ where: { customerId } });
    await db.document.deleteMany({ where: { customerId } });
    await db.intervention.deleteMany({ where: { customerId } });
    if (siteIds.length > 0) {
      await db.equipment.deleteMany({ where: { siteId: { in: siteIds } } });
    }
    await db.site.deleteMany({ where: { customerId } });
    await db.customer.deleteMany({ where: { id: customerId } });

    await audit(ctx, {
      action: "customer.deleted",
      entity: "Customer",
      entityId: customerId,
      metadata: { name: customer.name, sites: siteIds.length },
    });

    revalidatePath("/clients");
    return { ok: true, data: { id: customerId } };
  } catch (e) {
    return toActionError(e);
  }
}
