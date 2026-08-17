"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionContext } from "@/core/context";
import { ReminderStatus } from "@/core/enums";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { objectId } from "@/core/schemas";
import { audit } from "@/core/tenant";

/**
 * Change le statut d'un rappel.
 *
 * Quatre états seulement : en attente, planifié, traité, écarté. Un rappel
 * écarté n'est pas supprimé — savoir qu'on a délibérément renoncé à replanifier
 * un équipement vaut mieux qu'une ligne disparue sans trace.
 */
export async function setReminderStatusAction(
  reminderId: string,
  status: ReminderStatus,
): Promise<ActionResult<{ id: string; status: ReminderStatus }>> {
  try {
    const { db, ctx } = await getActionContext("intervention.view");
    const id = objectId.parse(reminderId);
    const next = z.enum(ReminderStatus).parse(status);

    const existing = await db.reminder.findFirst({
      where: { id },
      select: { id: true, equipmentId: true },
    });
    if (!existing) throw new NotFoundError("Rappel");

    await db.reminder.updateMany({ where: { id }, data: { status: next } });

    await audit(ctx, {
      action: `reminder.${next.toLowerCase()}`,
      entity: "Reminder",
      entityId: id,
    });

    revalidatePath("/rappels");
    return { ok: true, data: { id, status: next } };
  } catch (e) {
    return toActionError(e);
  }
}
