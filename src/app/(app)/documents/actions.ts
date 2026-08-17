"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionContext } from "@/core/context";
import { DocumentCategory } from "@/core/enums";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { objectId } from "@/core/schemas";
import { audit } from "@/core/tenant";
import { deleteFile, storeFile } from "@/services/storage";

const schema = z.object({
  name: z.string().trim().max(200).optional(),
  category: z.enum(DocumentCategory).default(DocumentCategory.OTHER),
  customerId: objectId.optional().or(z.literal("")),
  siteId: objectId.optional().or(z.literal("")),
  equipmentId: objectId.optional().or(z.literal("")),
  interventionId: objectId.optional().or(z.literal("")),
});

/**
 * Téléverse un document et le rattache à un objet du référentiel.
 *
 * Le rattachement est vérifié dans l'organisation avant d'écrire : un
 * identifiant venu du formulaire ne désigne rien tant qu'il n'a pas été relu
 * par le client cloisonné.
 *
 * Le nom affiché est nettoyé de son chemin — un navigateur peut envoyer
 * `C:\Users\...\devis.pdf` — mais il ne sert jamais à construire la clé de
 * stockage, qui reste un UUID.
 */
export async function uploadDocumentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx, user } = await getActionContext("document.upload");

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, code: "VALIDATION", error: "Aucun fichier reçu." };
    }

    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Rattachement invalide.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const input = parsed.data;
    const empty = (v?: string) => (v && v.length > 0 ? v : null);

    const customerId = empty(input.customerId);
    const siteId = empty(input.siteId);
    const equipmentId = empty(input.equipmentId);
    const interventionId = empty(input.interventionId);

    if (!customerId && !siteId && !equipmentId && !interventionId) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Rattachez le document à un client, un site ou un équipement.",
      };
    }

    // Chaque référence est relue dans l'organisation : sinon un identifiant
    // recopié depuis une autre entreprise créerait un document orphelin
    // pointant chez le voisin.
    for (const [label, id, read] of [
      ["Client", customerId, () => db.customer.findFirst({ where: { id: customerId! }, select: { id: true } })],
      ["Site", siteId, () => db.site.findFirst({ where: { id: siteId! }, select: { id: true } })],
      ["Équipement", equipmentId, () => db.equipment.findFirst({ where: { id: equipmentId! }, select: { id: true } })],
      ["Intervention", interventionId, () => db.intervention.findFirst({ where: { id: interventionId! }, select: { id: true } })],
    ] as const) {
      if (id && !(await read())) throw new NotFoundError(label);
    }

    const body = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(
      {
        orgId: ctx.orgId,
        scope: "documents",
        ownerId: customerId ?? siteId ?? equipmentId ?? interventionId!,
        body,
        contentType: file.type,
      },
      ["document", "image"],
    );

    const displayName =
      input.name?.trim() ||
      file.name.split(/[\\/]/).pop()?.slice(0, 200) ||
      "Document";

    let document;
    try {
      document = await db.document.create({
        data: {
          orgId: ctx.orgId,
          customerId,
          siteId,
          equipmentId,
          interventionId,
          name: displayName,
          category: input.category,
          storageKey: stored.key,
          mimeType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          uploadedById: user.id,
        },
        select: { id: true },
      });
    } catch (e) {
      await deleteFile(stored.key);
      throw e;
    }

    await audit(ctx, {
      action: "document.uploaded",
      entity: "Document",
      entityId: document.id,
      metadata: { name: displayName, category: input.category },
    });

    revalidatePath("/documents");
    if (customerId) revalidatePath(`/clients/${customerId}`);

    return { ok: true, data: { id: document.id } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Supprime un document.
 *
 * Un rapport d'intervention validé est refusé : il fait partie du dossier
 * remis au client, et le supprimer d'un clic depuis une liste générale serait
 * trop facile. Il part avec l'intervention, ou pas du tout.
 */
export async function deleteDocumentAction(
  documentId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("document.delete");
    const id = objectId.parse(documentId);

    const document = await db.document.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        storageKey: true,
        category: true,
        customerId: true,
        interventionId: true,
      },
    });
    if (!document) throw new NotFoundError("Document");

    if (document.category === DocumentCategory.REPORT && document.interventionId) {
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "Ce rapport fait partie du dossier de l'intervention. Il ne se supprime pas depuis les documents.",
      };
    }

    await db.document.deleteMany({ where: { id } });
    await deleteFile(document.storageKey);

    await audit(ctx, {
      action: "document.deleted",
      entity: "Document",
      entityId: id,
      metadata: { name: document.name },
    });

    revalidatePath("/documents");
    if (document.customerId) revalidatePath(`/clients/${document.customerId}`);

    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}
