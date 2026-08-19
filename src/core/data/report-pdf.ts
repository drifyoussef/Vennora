import "server-only";
import type { AppContext } from "../context";
import { DocumentCategory } from "../enums";
import { buildPdfData, loadReportData } from "./report";
import { renderReportPdf } from "@/services/pdf";
import { deleteFile, storeFile } from "@/services/storage";

/**
 * Fabrique le PDF du compte-rendu et le publie.
 *
 * Trois choses vont toujours ensemble : le fichier sur le disque, la clé
 * portée par `Report.pdfKey`, et la ligne « Rapport » de la liste des
 * documents. Les avoir laissées se désynchroniser a produit un document qui
 * promettait un téléchargement introuvable — d'où ce point de passage unique,
 * appelé par la validation, par la capture de signature et par la
 * régénération après clôture.
 *
 * L'ordre est délibéré : on écrit le nouveau fichier avant de supprimer
 * l'ancien. Si la génération échoue, l'intervention garde le PDF qu'elle
 * avait ; on ne remplace jamais quelque chose par rien.
 */
export async function publishReportPdf(
  context: AppContext,
  interventionId: string,
): Promise<{ key: string; sizeBytes: number }> {
  const { db, ctx, user } = context;

  const data = await loadReportData(context, interventionId);
  const pdf = await renderReportPdf(await buildPdfData(data));
  const ancienneCle = data.report?.pdfKey ?? null;

  const stored = await storeFile(
    {
      orgId: ctx.orgId,
      scope: "rapports",
      ownerId: interventionId,
      body: pdf,
      contentType: "application/pdf",
    },
    ["document"],
  );

  await db.report.updateMany({
    where: { interventionId },
    data: { pdfKey: stored.key, pdfGeneratedAt: new Date() },
  });

  await db.document.deleteMany({
    where: { interventionId, category: DocumentCategory.REPORT },
  });
  await db.document.create({
    data: {
      orgId: ctx.orgId,
      interventionId,
      customerId: data.customer.id,
      name: `Rapport ${data.reference}.pdf`,
      category: DocumentCategory.REPORT,
      storageKey: stored.key,
      mimeType: "application/pdf",
      sizeBytes: stored.sizeBytes,
      uploadedById: user.id,
    },
  });

  // Le précédent PDF n'est retiré qu'une fois le nouveau en place.
  if (ancienneCle && ancienneCle !== stored.key) await deleteFile(ancienneCle);

  return { key: stored.key, sizeBytes: stored.sizeBytes };
}

/**
 * Retire le PDF et la ligne de document qui l'accompagne.
 *
 * Utilisé quand il n'y a plus rien à publier — un compte-rendu qui retombe à
 * l'état de brouillon ne doit pas laisser un rapport téléchargeable derrière
 * lui.
 */
export async function withdrawReportPdf(
  context: AppContext,
  interventionId: string,
  pdfKey: string,
): Promise<void> {
  const { db } = context;
  await db.report.updateMany({
    where: { interventionId },
    data: { pdfKey: null, pdfGeneratedAt: null },
  });
  await db.document.deleteMany({
    where: { interventionId, category: DocumentCategory.REPORT },
  });
  await deleteFile(pdfKey);
}
