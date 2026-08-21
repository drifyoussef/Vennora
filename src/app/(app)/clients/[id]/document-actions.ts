"use server";

import { z } from "zod";

import { getActionContext } from "@/core/context";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { exigerFonctionnalite } from "@/core/plans";
import { objectId } from "@/core/schemas";
import { audit } from "@/core/tenant";
import { sendMail } from "@/services/mail";
import { readFileBytes } from "@/services/storage";

/**
 * Envoi d'un document au client, depuis sa fiche.
 *
 * Le rapport d'une intervention s'envoie déjà depuis l'intervention. Mais on
 * cherche rarement « l'intervention du 14 octobre » : on cherche un client
 * qui redemande son certificat. D'où ce second chemin, qui part de la fiche
 * client et vaut pour tout document rangé là.
 *
 * La pièce voyage en pièce jointe, comme le rapport : le destinataire la
 * garde, sans lien qui expire ni compte à créer.
 */
const schema = z.object({
  to: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  message: z.string().trim().max(2000).optional(),
});

export async function envoyerDocumentAction(
  documentId: string,
  formData: FormData,
): Promise<ActionResult<{ sentTo: string; driver: string }>> {
  try {
    const context = await getActionContext("document.view");
    exigerFonctionnalite(context, "envoi-rapport");
    const { db, ctx, user } = context;
    const id = objectId.parse(documentId);

    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Adresse e-mail invalide.",
      };
    }

    // Lecture cloisonnée : c'est elle qui autorise, pas la clé de stockage.
    const document = await db.document.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        storageKey: true,
        mimeType: true,
        customer: { select: { name: true } },
      },
    });
    if (!document) throw new NotFoundError("Document");

    const fichier = await readFileBytes(document.storageKey);
    const intro = parsed.data.message?.trim();

    const result = await sendMail({
      to: [parsed.data.to],
      replyTo: user.email,
      subject: `${document.name} — ${user.org.name}`,
      text: [
        `Bonjour${document.customer ? ` ${document.customer.name}` : ""},`,
        "",
        intro || `Vous trouverez ci-joint le document « ${document.name} ».`,
        "",
        "Cordialement,",
        user.org.name,
      ].join("\n"),
      attachments: [
        {
          filename: document.name,
          content: fichier,
          contentType: document.mimeType,
        },
      ],
    });

    await audit(ctx, {
      action: "document.sent",
      entity: "Document",
      entityId: document.id,
      metadata: { to: parsed.data.to, name: document.name },
    });

    return { ok: true, data: { sentTo: parsed.data.to, driver: result.driver } };
  } catch (e) {
    return toActionError(e);
  }
}
