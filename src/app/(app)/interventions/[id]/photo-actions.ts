"use server";

import { revalidatePath } from "next/cache";

import { getActionContext } from "@/core/context";
import { requireEditableIntervention } from "@/core/data/field";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { objectId } from "@/core/schemas";
import { audit } from "@/core/tenant";
import { deleteFile, fileUrl, storeFile } from "@/services/storage";

export interface PhotoDto {
  id: string;
  url: string;
  caption: string | null;
  sizeBytes: number;
  createdAt: string;
}

/**
 * Ajoute une photo à une intervention.
 *
 * L'image est déjà compressée par le navigateur ; le serveur revalide malgré
 * tout sa signature binaire et sa taille — un client peut poster ce qu'il
 * veut, la compression n'est qu'un service rendu au réseau.
 *
 * L'équipement est recopié depuis l'intervention, jamais lu dans le
 * formulaire : c'est ce qui permet d'afficher la galerie d'un équipement sans
 * traverser toutes ses interventions.
 */
export async function addPhotoAction(
  interventionId: string,
  formData: FormData,
): Promise<ActionResult<PhotoDto>> {
  try {
    const context = await getActionContext("intervention.update");
    const { db, ctx } = context;

    const id = objectId.parse(interventionId);
    const intervention = await requireEditableIntervention(context, id);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, code: "VALIDATION", error: "Aucun fichier reçu." };
    }

    const caption = (formData.get("caption") as string | null)?.trim() || null;
    const body = Buffer.from(await file.arrayBuffer());

    const stored = await storeFile(
      {
        orgId: ctx.orgId,
        scope: "interventions",
        ownerId: intervention.id,
        body,
        contentType: file.type,
      },
      ["image"],
    );

    // Le fichier est écrit avant la ligne en base : si la création échoue, on
    // efface le fichier pour ne pas laisser d'orphelin.
    let photo;
    try {
      photo = await db.interventionPhoto.create({
        data: {
          orgId: ctx.orgId,
          interventionId: intervention.id,
          equipmentId: intervention.equipmentId,
          storageKey: stored.key,
          mimeType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          caption,
          takenAt: new Date(),
          uploadedById: ctx.userId,
        },
        select: { id: true, caption: true, sizeBytes: true, createdAt: true },
      });
    } catch (e) {
      await deleteFile(stored.key);
      throw e;
    }

    revalidatePath(`/interventions/${intervention.id}`);
    if (intervention.equipmentId) {
      revalidatePath(`/equipements/${intervention.equipmentId}`);
    }

    return {
      ok: true,
      data: {
        id: photo.id,
        url: await fileUrl(stored.key),
        caption: photo.caption,
        sizeBytes: photo.sizeBytes,
        createdAt: photo.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updatePhotoCaptionAction(
  photoId: string,
  caption: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.update");
    const { db } = context;
    const id = objectId.parse(photoId);

    const photo = await db.interventionPhoto.findFirst({
      where: { id },
      select: { id: true, interventionId: true },
    });
    if (!photo?.interventionId) throw new NotFoundError("Photo");

    await requireEditableIntervention(context, photo.interventionId);

    await db.interventionPhoto.updateMany({
      where: { id },
      data: { caption: caption.trim().slice(0, 300) || null },
    });

    revalidatePath(`/interventions/${photo.interventionId}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Supprime une photo, puis son fichier.
 *
 * Dans cet ordre : un fichier orphelin est un coût de stockage, une ligne
 * pointant vers un fichier absent est une image cassée dans un rapport.
 */
export async function deletePhotoAction(
  photoId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.update");
    const { db, ctx } = context;
    const id = objectId.parse(photoId);

    const photo = await db.interventionPhoto.findFirst({
      where: { id },
      select: {
        id: true,
        storageKey: true,
        interventionId: true,
        equipmentId: true,
      },
    });
    if (!photo?.interventionId) throw new NotFoundError("Photo");

    await requireEditableIntervention(context, photo.interventionId);

    await db.interventionPhoto.deleteMany({ where: { id } });
    await deleteFile(photo.storageKey);

    await audit(ctx, {
      action: "photo.deleted",
      entity: "InterventionPhoto",
      entityId: id,
      metadata: { interventionId: photo.interventionId },
    });

    revalidatePath(`/interventions/${photo.interventionId}`);
    if (photo.equipmentId) revalidatePath(`/equipements/${photo.equipmentId}`);

    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}

/** Enregistre les notes libres saisies au clavier sur le terrain. */
export async function saveNotesAction(
  interventionId: string,
  notes: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.update");
    const { db } = context;
    const id = objectId.parse(interventionId);

    await requireEditableIntervention(context, id);

    await db.intervention.updateMany({
      where: { id },
      data: { notes: notes.trim().slice(0, 8000) || null },
    });

    revalidatePath(`/interventions/${id}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}
