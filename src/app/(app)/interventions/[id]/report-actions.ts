"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerFonctionnalite } from "@/core/plans";
import { getActionContext } from "@/core/context";
import { requireEditableIntervention, requireVisibleIntervention } from "@/core/data/field";
import { buildReportContext, loadReportData } from "@/core/data/report";
import { publishReportPdf } from "@/core/data/report-pdf";
import { refreshEquipmentDates } from "@/core/data/equipment";
import { refreshCustomerDates } from "@/core/data/customers";
import { ReportOrigin } from "@/core/enums";
import { AppError, NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { objectId } from "@/core/schemas";
import { audit } from "@/core/tenant";
import { getReportGenerator } from "@/services/ai";
import { sendMail } from "@/services/mail";
import { fileUrl } from "@/services/storage";
import { formatDate } from "@/lib/format";

const SECTION_KEYS = [
  "summary",
  "workDone",
  "equipmentState",
  "anomaliesSummary",
  "recommendations",
  "futureWork",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];
export type ReportSectionValues = Record<SectionKey, string>;

const sectionsSchema = z.object(
  Object.fromEntries(
    SECTION_KEYS.map((k) => [k, z.string().max(8000).default("")]),
  ) as Record<SectionKey, z.ZodDefault<z.ZodString>>,
);

/**
 * Génère un brouillon de compte-rendu.
 *
 * Le résultat est **toujours** un brouillon : `validatedAt` reste nul, et
 * aucun envoi n'est possible tant qu'un humain n'a pas validé. C'est la règle
 * la plus importante du lot — un texte produit par un modèle ne part jamais
 * seul chez un client.
 */
export async function generateReportAction(
  interventionId: string,
): Promise<ActionResult<ReportSectionValues & { provider: string }>> {
  try {
    const context = await getActionContext("report.edit");
    exigerFonctionnalite(context, "redaction-assistee");
    const { db, ctx } = context;
    const id = objectId.parse(interventionId);

    await requireEditableIntervention(context, id);

    const data = await loadReportData(context, id);
    const promptContext = await buildReportContext(context, data);
    const generator = await getReportGenerator();
    const generated = await generator.generate(promptContext);

    const sections: ReportSectionValues = {
      summary: generated.summary,
      workDone: generated.workDone,
      equipmentState: generated.equipmentState,
      anomaliesSummary: generated.anomaliesSummary,
      recommendations: generated.recommendations,
      futureWork: generated.futureWork,
    };

    await db.report.upsert({
      where: { interventionId: id },
      create: {
        orgId: ctx.orgId,
        interventionId: id,
        ...sections,
        origin: generated.provider === "mock" ? ReportOrigin.MANUAL : ReportOrigin.AI,
        aiModel: generated.model,
        aiGeneratedAt: new Date(),
        // Le texte soumis au modèle est conservé : sans lui, impossible de
        // comprendre après coup pourquoi une phrase a été écrite.
        aiSourceText: promptContext.rawNotes.join("\n"),
      },
      update: {
        ...sections,
        origin: generated.provider === "mock" ? ReportOrigin.MANUAL : ReportOrigin.AI,
        aiModel: generated.model,
        aiGeneratedAt: new Date(),
        aiSourceText: promptContext.rawNotes.join("\n"),
        regenerations: { increment: 1 },
        // Toute régénération invalide la validation précédente.
        validatedAt: null,
        validatedById: null,
      },
    });

    await audit(ctx, {
      action: "report.generated",
      entity: "Report",
      entityId: id,
      metadata: { provider: generated.provider, model: generated.model },
    });

    revalidatePath(`/interventions/${id}`);
    return { ok: true, data: { ...sections, provider: generated.provider } };
  } catch (e) {
    return toActionError(e);
  }
}

/** Enregistre les sections telles que le technicien les a corrigées. */
export async function saveReportAction(
  interventionId: string,
  values: ReportSectionValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("report.edit");
    const { db, ctx } = context;
    const id = objectId.parse(interventionId);

    await requireEditableIntervention(context, id);

    const parsed = sectionsSchema.parse(values);

    await db.report.upsert({
      where: { interventionId: id },
      create: { orgId: ctx.orgId, interventionId: id, ...parsed },
      // Une modification manuelle annule la validation : le texte validé et
      // le texte enregistré doivent toujours être le même.
      update: { ...parsed, validatedAt: null, validatedById: null },
    });

    revalidatePath(`/interventions/${id}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Validation humaine, puis génération du PDF.
 *
 * Le verrou du §17 : c'est la seule porte par laquelle un compte-rendu
 * devient envoyable.
 */
export async function validateReportAction(
  interventionId: string,
  values: ReportSectionValues,
): Promise<ActionResult<{ pdfUrl: string }>> {
  try {
    const context = await getActionContext("report.edit");
    const { db, ctx, user } = context;
    const id = objectId.parse(interventionId);

    await requireEditableIntervention(context, id);

    const parsed = sectionsSchema.parse(values);
    if (!parsed.summary.trim() || !parsed.workDone.trim()) {
      return {
        ok: false,
        code: "VALIDATION",
        error:
          "Le résumé et les travaux réalisés doivent être renseignés avant validation.",
      };
    }

    await db.report.upsert({
      where: { interventionId: id },
      create: {
        orgId: ctx.orgId,
        interventionId: id,
        ...parsed,
        validatedAt: new Date(),
        validatedById: user.id,
      },
      update: { ...parsed, validatedAt: new Date(), validatedById: user.id },
    });

    const data = await loadReportData(context, id);
    const stored = await publishReportPdf(context, id);

    await audit(ctx, {
      action: "report.validated",
      entity: "Report",
      entityId: id,
      metadata: { reference: data.reference },
    });

    revalidatePath(`/interventions/${id}`);
    revalidatePath("/documents");

    return { ok: true, data: { pdfUrl: await fileUrl(stored.key) } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Régénère le PDF d'un compte-rendu déjà validé.
 *
 * Volontairement gardée par `requireVisibleIntervention` et non par
 * `requireEditableIntervention` : régénérer ne touche pas au contenu du
 * compte-rendu, seulement au fichier qui l'imprime. Sans cette action, une
 * intervention close dont le PDF a disparu était une impasse — la validation,
 * seul endroit qui générait le fichier, refuse toute intervention terminée.
 */
export async function regenerateReportPdfAction(
  interventionId: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  try {
    const context = await getActionContext("report.edit");
    const { db, ctx } = context;
    const id = objectId.parse(interventionId);

    await requireVisibleIntervention(context, id);

    const report = await db.report.findFirst({
      where: { interventionId: id },
      select: { validatedAt: true },
    });
    if (!report?.validatedAt) {
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "Le compte-rendu doit avoir été validé pour qu'un PDF puisse être régénéré.",
      };
    }

    const stored = await publishReportPdf(context, id);

    await audit(ctx, {
      action: "report.pdf_regenerated",
      entity: "Report",
      entityId: id,
    });

    revalidatePath(`/interventions/${id}`);
    revalidatePath("/documents");

    return { ok: true, data: { pdfUrl: await fileUrl(stored.key) } };
  } catch (e) {
    return toActionError(e);
  }
}

const sendSchema = z.object({
  to: z.string().trim().email("Adresse e-mail invalide."),
  message: z.string().trim().max(2000).optional(),
});

/**
 * Envoie le rapport au client.
 *
 * Refusé tant que le rapport n'est pas validé : c'est le point où le §17
 * cesse d'être une intention et devient une contrainte technique.
 */
export async function sendReportAction(
  interventionId: string,
  formData: FormData,
): Promise<ActionResult<{ sentTo: string; driver: string }>> {
  try {
    const context = await getActionContext("report.send");
    exigerFonctionnalite(context, "envoi-rapport");
    const { db, ctx } = context;
    const id = objectId.parse(interventionId);

    await requireVisibleIntervention(context, id);

    const parsed = sendSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Adresse e-mail invalide.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const data = await loadReportData(context, id);
    if (!data.report?.validatedAt) {
      console.warn(
        `[vennora] envoi refusé pour ${data.reference} : compte-rendu non validé.`,
      );
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "Le compte-rendu doit être relu et validé avant d'être envoyé au client.",
      };
    }
    if (!data.report.pdfKey) {
      console.warn(
        `[vennora] envoi refusé pour ${data.reference} : aucun PDF associé.`,
      );
      throw new AppError("Le PDF n'a pas été généré.", "NO_PDF", 409);
    }

    const { readFileBytes } = await import("@/services/storage");
    const pdf = await readFileBytes(data.report.pdfKey);

    const intro = parsed.data.message?.trim();
    const result = await sendMail({
      to: [parsed.data.to],
      replyTo: data.org.email ?? undefined,
      subject: `Rapport d'intervention du ${formatDate(data.scheduledStart)} — ${data.org.name}`,
      text: [
        `Bonjour ${data.customer.name},`,
        "",
        intro ||
          `Vous trouverez ci-joint le rapport de l'intervention réalisée le ${formatDate(data.scheduledStart)} sur le site ${data.site.name}.`,
        "",
        data.nextInterventionAt
          ? `Prochaine intervention conseillée : ${formatDate(data.nextInterventionAt)}.`
          : null,
        "",
        "Cordialement,",
        data.org.name,
        [data.org.phone, data.org.email].filter(Boolean).join(" · "),
      ]
        .filter((l) => l !== null)
        .join("\n"),
      attachments: [
        {
          filename: `Rapport ${data.reference}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });

    await db.report.updateMany({
      where: { interventionId: id },
      data: { sentAt: new Date(), sentTo: { push: parsed.data.to } },
    });

    await audit(ctx, {
      action: "report.sent",
      entity: "Report",
      entityId: id,
      metadata: { to: parsed.data.to, driver: result.driver },
    });

    revalidatePath(`/interventions/${id}`);
    return { ok: true, data: { sentTo: parsed.data.to, driver: result.driver } };
  } catch (e) {
    return toActionError(e);
  }
}

const completeSchema = z.object({
  nextInterventionAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

/**
 * Clôture l'intervention.
 *
 * Exige la signature du client et un rapport validé — l'ordre du §29 n'est
 * pas décoratif. Fixe au passage la prochaine échéance de l'équipement et
 * crée le rappel du §23.
 */
export async function completeInterventionAction(
  interventionId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.complete");
    const { db, ctx } = context;
    const id = objectId.parse(interventionId);

    const intervention = await requireEditableIntervention(context, id);

    const [report, signature] = await Promise.all([
      db.report.findFirst({
        where: { interventionId: id },
        select: { validatedAt: true, pdfKey: true },
      }),
      db.signature.findFirst({
        where: { interventionId: id },
        select: { id: true },
      }),
    ]);

    if (!report?.validatedAt) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "Validez le compte-rendu avant de terminer l'intervention.",
      };
    }
    if (!signature) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "La signature du client est requise pour terminer.",
      };
    }

    const parsed = completeSchema.safeParse(Object.fromEntries(formData));
    const nextRaw = parsed.success ? parsed.data.nextInterventionAt : undefined;
    const nextInterventionAt =
      nextRaw && nextRaw.length > 0 ? new Date(`${nextRaw}T09:00:00`) : null;

    await db.intervention.updateMany({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        nextInterventionAt,
      },
    });

    if (nextInterventionAt) {
      await db.reminder.create({
        data: {
          orgId: ctx.orgId,
          customerId: intervention.customerId,
          equipmentId: intervention.equipmentId,
          sourceInterventionId: id,
          dueDate: nextInterventionAt,
          status: "PENDING",
        },
      });
    }

    await refreshCustomerDates(context, intervention.customerId);
    if (intervention.equipmentId) {
      await refreshEquipmentDates(context, intervention.equipmentId);
    }

    await audit(ctx, {
      action: "intervention.completed",
      entity: "Intervention",
      entityId: id,
      metadata: { reference: intervention.reference },
    });

    revalidatePath("/");
    revalidatePath("/interventions");
    revalidatePath(`/interventions/${id}`);
    revalidatePath("/planning");
    if (intervention.equipmentId) {
      revalidatePath(`/equipements/${intervention.equipmentId}`);
    }

    return { ok: true, data: { id } };
  } catch (e) {
    if (e instanceof NotFoundError) return toActionError(e);
    return toActionError(e);
  }
}
