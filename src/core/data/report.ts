import "server-only";
import { getTrade } from "@/verticals/registry";
import { fileUrl, readFileBytes } from "@/services/storage";
import type { ReportContext } from "@/services/ai";
import type { ReportDocumentData } from "@/services/pdf";
import {
  ANOMALY_SEVERITY_LABEL,
  INTERVENTION_STATUS_LABEL,
} from "../labels";
import { NotFoundError } from "../errors";
import { formatAddress, formatDate, formatDateTime } from "@/lib/format";
import type { AppContext } from "../context";

/**
 * Assemblage des données du rapport.
 *
 * Un seul endroit qui rassemble intervention, équipement, anomalies, photos,
 * notes et historique — consommé à la fois par la génération assistée et par
 * le rendu PDF, pour qu'aucun des deux ne voie une version différente des
 * faits.
 */
export async function loadReportData({ db }: AppContext, interventionId: string) {
  const intervention = await db.intervention.findFirst({
    where: { id: interventionId },
    select: {
      id: true,
      reference: true,
      scheduledStart: true,
      completedAt: true,
      status: true,
      notes: true,
      nextInterventionAt: true,
      org: {
        select: {
          name: true,
          address: true,
          postalCode: true,
          city: true,
          phone: true,
          email: true,
          siret: true,
          settings: true,
          trade: { select: { slug: true, name: true } },
        },
      },
      customer: { select: { id: true, name: true, email: true, phone: true } },
      site: {
        select: {
          name: true,
          address: true,
          addressComplement: true,
          postalCode: true,
          city: true,
        },
      },
      equipment: {
        select: {
          id: true,
          label: true,
          brand: true,
          model: true,
          serialNumber: true,
          installedAt: true,
          type: { select: { label: true } },
        },
      },
      technician: { select: { firstName: true, lastName: true } },
      type: { select: { label: true, recurrenceMonths: true } },
      anomalies: {
        orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
        select: {
          title: true,
          description: true,
          severity: true,
          recommendation: true,
        },
      },
      photos: {
        orderBy: { createdAt: "asc" },
        select: { storageKey: true, caption: true, mimeType: true },
      },
      voiceNotes: {
        orderBy: { createdAt: "asc" },
        select: { transcript: true, transcriptStatus: true },
      },
      signature: {
        select: { storageKey: true, signerName: true, signedAt: true },
      },
      report: {
        select: {
          id: true,
          summary: true,
          workDone: true,
          equipmentState: true,
          anomaliesSummary: true,
          recommendations: true,
          futureWork: true,
          validatedAt: true,
          pdfKey: true,
          sentAt: true,
          origin: true,
          regenerations: true,
        },
      },
    },
  });

  if (!intervention) throw new NotFoundError("Intervention");
  return intervention;
}

export type ReportData = Awaited<ReturnType<typeof loadReportData>>;

/** Contexte transmis au service de rédaction. */
export async function buildReportContext(
  context: AppContext,
  data: ReportData,
): Promise<ReportContext> {
  const trade = getTrade(data.org.trade.slug);

  // Historique : ce qui a été constaté les fois précédentes sur le même
  // appareil. C'est ce qui permet d'écrire « fissure déjà signalée en 2025 ».
  let previousFindings: string[] = [];
  if (data.equipment) {
    const past = await context.db.anomaly.findMany({
      where: {
        equipmentId: data.equipment.id,
        interventionId: { not: data.id },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { title: true, status: true, createdAt: true },
    });
    previousFindings = past.map(
      (a) =>
        `${formatDate(a.createdAt)} — ${a.title} (${a.status === "OPEN" ? "toujours ouverte" : "traitée"})`,
    );
  }

  const transcripts = data.voiceNotes
    .filter((n) => n.transcriptStatus === "DONE" && n.transcript)
    .map((n) => n.transcript as string);

  return {
    tradeName: data.org.trade.name,
    interventionType: data.type.label,
    interventionDate: formatDate(data.scheduledStart),
    technicianName: `${data.technician.firstName} ${data.technician.lastName}`,
    customerName: data.customer.name,
    siteLabel: `${data.site.name} — ${formatAddress(data.site)}`,
    equipment: data.equipment
      ? {
          label: data.equipment.label ?? data.equipment.type.label,
          type: data.equipment.type.label,
          brand: data.equipment.brand,
          model: data.equipment.model,
          installedAt: data.equipment.installedAt
            ? String(data.equipment.installedAt.getFullYear())
            : null,
        }
      : null,
    previousFindings,
    anomalies: data.anomalies.map((a) => ({
      title: a.title,
      description: a.description,
      severity: ANOMALY_SEVERITY_LABEL[a.severity],
      recommendation: a.recommendation,
    })),
    photoCaptions: data.photos
      .map((p) => p.caption)
      .filter((c): c is string => Boolean(c)),
    rawNotes: [data.notes, ...transcripts].filter((n): n is string =>
      Boolean(n && n.trim()),
    ),
    sectionHints: trade.reportSections.map((s) => ({
      key: s.key,
      label: s.label,
      hint: s.hint,
    })),
  };
}

/**
 * Données du PDF.
 *
 * Les images sont intégrées en data URI plutôt que référencées par URL : le
 * PDF doit rester lisible une fois téléchargé, hors ligne, dans dix ans — un
 * lien signé expire en dix minutes.
 */
export async function buildPdfData(
  data: ReportData,
): Promise<ReportDocumentData> {
  const trade = getTrade(data.org.trade.slug);
  const report = data.report;

  const settings = (data.org.settings ?? {}) as Record<string, unknown>;
  const footer =
    typeof settings.reportFooter === "string" ? settings.reportFooter : null;

  const photos = await Promise.all(
    data.photos.slice(0, 12).map(async (photo) => {
      try {
        const bytes = await readFileBytes(photo.storageKey);
        return {
          dataUrl: `data:${photo.mimeType};base64,${bytes.toString("base64")}`,
          caption: photo.caption,
        };
      } catch {
        // Une photo illisible ne doit pas empêcher l'émission du rapport.
        return null;
      }
    }),
  );

  let signatureImage: string | null = null;
  if (data.signature) {
    try {
      const bytes = await readFileBytes(data.signature.storageKey);
      signatureImage = `data:image/png;base64,${bytes.toString("base64")}`;
    } catch {
      signatureImage = null;
    }
  }

  return {
    organization: {
      name: data.org.name,
      address: formatAddress(data.org) === "—" ? null : formatAddress(data.org),
      phone: data.org.phone,
      email: data.org.email,
      siret: data.org.siret,
      footer,
    },
    reference: data.reference,
    date: formatDate(data.scheduledStart),
    technicianName: `${data.technician.firstName} ${data.technician.lastName}`,
    customer: {
      name: data.customer.name,
      email: data.customer.email,
      phone: data.customer.phone,
    },
    site: { name: data.site.name, address: formatAddress(data.site) },
    equipment: data.equipment
      ? {
          label: data.equipment.label ?? data.equipment.type.label,
          type: data.equipment.type.label,
          brand: data.equipment.brand,
          model: data.equipment.model,
          serialNumber: data.equipment.serialNumber,
        }
      : null,
    interventionType: data.type.label,
    sections: trade.reportSections.map((s) => ({
      label: s.label,
      value: (report?.[s.key] as string | null) ?? "",
    })),
    anomalies: data.anomalies.map((a) => ({
      title: a.title,
      severity: ANOMALY_SEVERITY_LABEL[a.severity],
      description: a.description,
      recommendation: a.recommendation,
    })),
    photos: photos.filter((p): p is { dataUrl: string; caption: string | null } =>
      Boolean(p),
    ),
    signature: data.signature
      ? {
          imageDataUrl: signatureImage,
          signerName: data.signature.signerName,
          signedAt: formatDateTime(data.signature.signedAt),
        }
      : null,
    nextInterventionAt: data.nextInterventionAt
      ? formatDate(data.nextInterventionAt)
      : null,
  };
}

/** Lien temporaire vers le PDF déjà généré, pour l'affichage dans l'app. */
export async function reportPdfUrl(key: string): Promise<string> {
  return fileUrl(key);
}

export { INTERVENTION_STATUS_LABEL };
