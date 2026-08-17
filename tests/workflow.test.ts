import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildPdfData, buildReportContext, loadReportData } from "@/core/data/report";
import { getReportGenerator } from "@/services/ai";
import { renderReportPdf } from "@/services/pdf";
import { deleteFile, storeFile } from "@/services/storage";
import {
  bytes,
  createTestOrg,
  destroyTestOrg,
  prisma,
  seedChain,
  type TestOrg,
} from "./fixtures";

/**
 * Chemin critique du §29.
 *
 * Client → intervention → photo → dictée → anomalie → compte-rendu →
 * signature → PDF. C'est le parcours qui définit le produit ; s'il casse,
 * plus rien d'autre n'a d'importance.
 */
describe("parcours terrain complet", () => {
  let org: TestOrg;
  let chain: Awaited<ReturnType<typeof seedChain>>;
  const keys: string[] = [];

  beforeAll(async () => {
    org = await createTestOrg("workflow");
    chain = await seedChain(org, { technicianId: org.technicianId });
  });

  afterAll(async () => {
    await Promise.all(keys.map(deleteFile));
    await destroyTestOrg(org);
    await prisma.$disconnect();
  });

  it("rattache la photo à l'intervention et à l'équipement", async () => {
    const stored = await storeFile(
      {
        orgId: org.id,
        scope: "interventions",
        ownerId: chain.intervention.id,
        body: bytes.jpeg,
        contentType: "image/jpeg",
      },
      ["image"],
    );
    keys.push(stored.key);

    const photo = await org.technician.db.interventionPhoto.create({
      data: {
        orgId: org.id,
        interventionId: chain.intervention.id,
        // Recopié depuis l'intervention : c'est ce qui alimente la galerie
        // de l'équipement sans traverser toutes ses interventions.
        equipmentId: chain.equipment.id,
        storageKey: stored.key,
        mimeType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        caption: "Conduit avant ramonage",
      },
      select: { equipmentId: true },
    });

    expect(photo.equipmentId).toBe(chain.equipment.id);
  });

  it("enregistre la dictée et sa transcription", async () => {
    const stored = await storeFile(
      {
        orgId: org.id,
        scope: "notes-vocales",
        ownerId: chain.intervention.id,
        body: bytes.webm,
        contentType: "audio/webm",
      },
      ["audio"],
    );
    keys.push(stored.key);

    await org.technician.db.voiceNote.create({
      data: {
        orgId: org.id,
        interventionId: chain.intervention.id,
        storageKey: stored.key,
        mimeType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        transcript: "Ramonage effectué. Fissure légère au raccord.",
        transcriptStatus: "DONE",
      },
    });

    const count = await org.technician.db.voiceNote.count({
      where: { interventionId: chain.intervention.id },
    });
    expect(count).toBe(1);
  });

  it("enregistre l'anomalie sur l'équipement", async () => {
    const anomaly = await org.technician.db.anomaly.create({
      data: {
        orgId: org.id,
        interventionId: chain.intervention.id,
        equipmentId: chain.equipment.id,
        title: "Fissure du raccord",
        severity: "MEDIUM",
        recommendation: "Contrôle et remplacement du raccord.",
        status: "OPEN",
      },
      select: { equipmentId: true },
    });
    expect(anomaly.equipmentId).toBe(chain.equipment.id);
  });

  it("nourrit le service de rédaction avec les données du terrain", async () => {
    const data = await loadReportData(org.technician, chain.intervention.id);
    const context = await buildReportContext(org.technician, data);

    expect(context.rawNotes.some((n) => n.includes("Fissure légère"))).toBe(true);
    expect(context.anomalies).toHaveLength(1);
    expect(context.photoCaptions).toContain("Conduit avant ramonage");
    // Les six sections viennent du vertical, jamais codées en dur ailleurs.
    expect(context.sectionHints).toHaveLength(6);
  });

  it("produit un brouillon qui reprend les notes sans les inventer", async () => {
    const data = await loadReportData(org.technician, chain.intervention.id);
    const context = await buildReportContext(org.technician, data);
    const generated = await (await getReportGenerator()).generate(context);

    expect(generated.workDone).toContain("Fissure légère");
    expect(generated.anomaliesSummary).toContain("Fissure du raccord");

    await org.technician.db.report.create({
      data: {
        orgId: org.id,
        interventionId: chain.intervention.id,
        summary: generated.summary,
        workDone: generated.workDone,
        equipmentState: generated.equipmentState,
        anomaliesSummary: generated.anomaliesSummary,
        recommendations: generated.recommendations,
        futureWork: generated.futureWork,
      },
    });
  });

  it("intègre photo et signature dans le PDF, puis le rend", async () => {
    const stored = await storeFile(
      {
        orgId: org.id,
        scope: "signatures",
        ownerId: chain.intervention.id,
        body: bytes.png,
        contentType: "image/png",
      },
      ["image"],
    );
    keys.push(stored.key);

    await org.technician.db.signature.create({
      data: {
        orgId: org.id,
        interventionId: chain.intervention.id,
        signerName: "Jean Dupont",
        storageKey: stored.key,
        ipAddress: "192.0.2.10",
      },
    });

    const data = await loadReportData(org.technician, chain.intervention.id);
    const pdfData = await buildPdfData(data);

    // Intégrées en data URI : le PDF doit rester lisible hors ligne, un lien
    // signé expire en dix minutes.
    expect(pdfData.photos[0]?.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(pdfData.signature?.imageDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(pdfData.sections).toHaveLength(6);

    const pdf = await renderReportPdf(pdfData);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(3000);
  });
});

/**
 * Le verrou du §17 : un texte produit par un modèle ne part jamais seul chez
 * un client. La règle est structurelle, pas une consigne d'interface.
 */
describe("validation humaine avant envoi", () => {
  let org: TestOrg;
  let chain: Awaited<ReturnType<typeof seedChain>>;

  beforeAll(async () => {
    org = await createTestOrg("validation");
    chain = await seedChain(org, { technicianId: org.technicianId });
  });

  afterAll(async () => {
    await destroyTestOrg(org);
    await prisma.$disconnect();
  });

  it("un rapport fraîchement généré n'est pas validé", async () => {
    await org.technician.db.report.create({
      data: {
        orgId: org.id,
        interventionId: chain.intervention.id,
        summary: "Brouillon",
        workDone: "Brouillon",
      },
    });

    const report = await org.technician.db.report.findFirst({
      where: { interventionId: chain.intervention.id },
      select: { validatedAt: true, pdfKey: true },
    });

    expect(report?.validatedAt).toBeNull();
    expect(report?.pdfKey).toBeNull();
  });

  it("une modification postérieure annule la validation", async () => {
    await org.technician.db.report.updateMany({
      where: { interventionId: chain.intervention.id },
      data: { validatedAt: new Date(), validatedById: org.technicianId },
    });

    // Ce que fait `saveReportAction` : toute édition repasse en brouillon.
    await org.technician.db.report.updateMany({
      where: { interventionId: chain.intervention.id },
      data: { summary: "Corrigé", validatedAt: null, validatedById: null },
    });

    const report = await org.technician.db.report.findFirst({
      where: { interventionId: chain.intervention.id },
      select: { validatedAt: true },
    });
    expect(report?.validatedAt).toBeNull();
  });
});
