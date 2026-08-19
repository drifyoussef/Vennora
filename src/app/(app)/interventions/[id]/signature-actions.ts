"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getActionContext } from "@/core/context";
import { requireEditableIntervention } from "@/core/data/field";
import { toActionError, type ActionResult } from "@/core/errors";
import { objectId } from "@/core/schemas";
import { audit } from "@/core/tenant";
import { publishReportPdf, withdrawReportPdf } from "@/core/data/report-pdf";
import { deleteFile, storeFile } from "@/services/storage";

const schema = z.object({
  signerName: z
    .string()
    .trim()
    .min(2, "Renseignez le nom du signataire.")
    .max(120),
  /** PNG produit par le canvas, en data URI. */
  image: z
    .string()
    .startsWith("data:image/png;base64,", "Signature invalide.")
    .max(2_000_000, "Signature trop volumineuse."),
});

/**
 * Adresse IP de l'appelant.
 *
 * On ne lit `x-forwarded-for` que pour le premier segment : la suite peut
 * être ajoutée par n'importe quel intermédiaire, et un client peut forger
 * l'en-tête entier. C'est une trace, pas une preuve — le §20 la demande à ce
 * titre.
 */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}

/**
 * Enregistre la signature du client.
 *
 * Une seule signature par intervention : re-signer remplace la précédente,
 * fichier compris. Le PDF déjà généré est invalidé — il porte l'ancienne
 * signature, il devra être régénéré à la validation suivante.
 */
export async function saveSignatureAction(
  interventionId: string,
  formData: FormData,
): Promise<ActionResult<{ signedAt: string; signerName: string }>> {
  try {
    const context = await getActionContext("intervention.complete");
    const { db, ctx } = context;
    const id = objectId.parse(interventionId);

    await requireEditableIntervention(context, id);

    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Vérifiez le nom et la signature.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const base64 = parsed.data.image.split(",", 2)[1] ?? "";
    const body = Buffer.from(base64, "base64");

    const stored = await storeFile(
      {
        orgId: ctx.orgId,
        scope: "signatures",
        ownerId: id,
        body,
        contentType: "image/png",
      },
      ["image"],
    );

    const existing = await db.signature.findFirst({
      where: { interventionId: id },
      select: { id: true, storageKey: true },
    });

    const signedAt = new Date();
    const ip = await clientIp();
    const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

    if (existing) {
      await db.signature.updateMany({
        where: { interventionId: id },
        data: {
          signerName: parsed.data.signerName,
          storageKey: stored.key,
          signedAt,
          ipAddress: ip,
          userAgent,
        },
      });
      await deleteFile(existing.storageKey);
    } else {
      await db.signature.create({
        data: {
          orgId: ctx.orgId,
          interventionId: id,
          signerName: parsed.data.signerName,
          storageKey: stored.key,
          signedAt,
          ipAddress: ip,
          userAgent,
        },
      });
    }

    // Le PDF imprimé avant la signature ne la montre pas : il est caduc.
    // Plutôt que de le détruire — ce qui, l'intervention une fois close,
    // laissait un dossier sans rapport et sans moyen d'en refaire un —, on le
    // reconstruit immédiatement à partir du compte-rendu déjà validé. La
    // validation reste acquise : le texte n'a pas changé, seule la signature
    // s'y ajoute.
    const report = await db.report.findFirst({
      where: { interventionId: id },
      select: { pdfKey: true, validatedAt: true },
    });
    if (report?.validatedAt) {
      await publishReportPdf(context, id);
    } else if (report?.pdfKey) {
      // Compte-rendu retombé en brouillon : rien à publier, on retire le
      // fichier et la ligne de document qui l'annonçait.
      await withdrawReportPdf(context, id, report.pdfKey);
    }

    await audit(ctx, {
      action: "signature.captured",
      entity: "Signature",
      entityId: id,
      metadata: { signerName: parsed.data.signerName },
      ipAddress: ip ?? undefined,
    });

    revalidatePath(`/interventions/${id}`);
    revalidatePath("/documents");
    return {
      ok: true,
      data: { signedAt: signedAt.toISOString(), signerName: parsed.data.signerName },
    };
  } catch (e) {
    return toActionError(e);
  }
}
