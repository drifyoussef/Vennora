"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionContext } from "@/core/context";
import { requireEditableIntervention } from "@/core/data/field";
import { AnomalyStatus } from "@/core/enums";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { anomalySchema, objectId } from "@/core/schemas";
import { audit } from "@/core/tenant";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export interface AnomalyDto {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  recommendation: string | null;
}

/**
 * Crée une anomalie depuis l'écran d'intervention.
 *
 * `equipmentId` est recopié depuis l'intervention plutôt que lu dans le
 * formulaire : c'est ce qui alimente l'historique de l'équipement, et le
 * client n'a pas à pouvoir choisir sur quel appareil s'impute un constat.
 */
export async function createAnomalyAction(
  interventionId: string,
  formData: FormData,
): Promise<ActionResult<AnomalyDto>> {
  try {
    const context = await getActionContext("anomaly.create");
    const { db, ctx } = context;

    const id = objectId.parse(interventionId);
    const intervention = await requireEditableIntervention(context, id);

    const parsed = anomalySchema.safeParse({
      ...Object.fromEntries(formData),
      interventionId: id,
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Vérifiez les champs en rouge.",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;
    const anomaly = await db.anomaly.create({
      data: {
        orgId: ctx.orgId,
        interventionId: intervention.id,
        equipmentId: intervention.equipmentId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        recommendation: input.recommendation,
        status: AnomalyStatus.OPEN,
      },
      select: {
        id: true,
        title: true,
        description: true,
        severity: true,
        status: true,
        recommendation: true,
      },
    });

    await audit(ctx, {
      action: "anomaly.created",
      entity: "Anomaly",
      entityId: anomaly.id,
      metadata: { interventionId: intervention.id, severity: anomaly.severity },
    });

    revalidatePath(`/interventions/${intervention.id}`);
    revalidatePath("/anomalies");
    if (intervention.equipmentId) {
      revalidatePath(`/equipements/${intervention.equipmentId}`);
    }

    return { ok: true, data: anomaly };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateAnomalyAction(
  anomalyId: string,
  formData: FormData,
): Promise<ActionResult<AnomalyDto>> {
  try {
    const context = await getActionContext("anomaly.update");
    const { db } = context;
    const id = objectId.parse(anomalyId);

    const existing = await db.anomaly.findFirst({
      where: { id },
      select: { id: true, interventionId: true, equipmentId: true },
    });
    if (!existing) throw new NotFoundError("Anomalie");

    await requireEditableIntervention(context, existing.interventionId);

    const parsed = anomalySchema.safeParse({
      ...Object.fromEntries(formData),
      interventionId: existing.interventionId,
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Vérifiez les champs en rouge.",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;
    await db.anomaly.updateMany({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        severity: input.severity,
        recommendation: input.recommendation,
      },
    });

    revalidatePath(`/interventions/${existing.interventionId}`);
    revalidatePath("/anomalies");

    return {
      ok: true,
      data: {
        id,
        title: input.title,
        description: input.description,
        severity: input.severity,
        status: input.status,
        recommendation: input.recommendation,
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Change le statut d'une anomalie.
 *
 * Utilisable même sur une intervention close : une anomalie relevée l'an
 * dernier se résout aujourd'hui, sans qu'on rouvre l'intervention d'origine.
 * C'est pourquoi cette action ne passe pas par `requireEditableIntervention`.
 */
export async function setAnomalyStatusAction(
  anomalyId: string,
  status: "OPEN" | "RESOLVED" | "IGNORED",
  resolutionNote?: string,
): Promise<ActionResult<{ id: string; status: string }>> {
  try {
    const { db, ctx, user } = await getActionContext("anomaly.update");
    const id = objectId.parse(anomalyId);

    const parsedStatus = z.enum(AnomalyStatus).parse(status);

    const existing = await db.anomaly.findFirst({
      where: { id },
      select: { id: true, interventionId: true, equipmentId: true },
    });
    if (!existing) throw new NotFoundError("Anomalie");

    const resolved = parsedStatus === AnomalyStatus.RESOLVED;
    await db.anomaly.updateMany({
      where: { id },
      data: {
        status: parsedStatus,
        resolvedAt: resolved ? new Date() : null,
        resolvedById: resolved ? user.id : null,
        resolutionNote: resolved ? (resolutionNote?.trim() || null) : null,
      },
    });

    await audit(ctx, {
      action: `anomaly.${parsedStatus.toLowerCase()}`,
      entity: "Anomaly",
      entityId: id,
    });

    revalidatePath(`/interventions/${existing.interventionId}`);
    revalidatePath("/anomalies");
    if (existing.equipmentId) {
      revalidatePath(`/equipements/${existing.equipmentId}`);
    }

    return { ok: true, data: { id, status: parsedStatus } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteAnomalyAction(
  anomalyId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("anomaly.update");
    const { db, ctx } = context;
    const id = objectId.parse(anomalyId);

    const existing = await db.anomaly.findFirst({
      where: { id },
      select: { id: true, interventionId: true, equipmentId: true },
    });
    if (!existing) throw new NotFoundError("Anomalie");

    await requireEditableIntervention(context, existing.interventionId);

    // Les photos rattachées à l'anomalie restent attachées à l'intervention :
    // on ne détruit pas une preuve parce qu'un constat a été reformulé.
    await db.interventionPhoto.updateMany({
      where: { anomalyId: id },
      data: { anomalyId: null },
    });
    await db.anomaly.deleteMany({ where: { id } });

    await audit(ctx, {
      action: "anomaly.deleted",
      entity: "Anomaly",
      entityId: id,
    });

    revalidatePath(`/interventions/${existing.interventionId}`);
    revalidatePath("/anomalies");
    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}
