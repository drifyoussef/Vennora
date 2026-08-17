/**
 * Jeu de démonstration : « Ramonage Cévennes ».
 *
 * Objectif — pouvoir ouvrir l'application et voir un métier qui tourne :
 * un historique crédible sur trois saisons de chauffe, des anomalies encore
 * ouvertes, des rapports signés, et une semaine de planning devant soi.
 *
 * Le tirage est déterministe (générateur à graine fixe) : deux exécutions
 * produisent le même jeu, ce qui rend les captures d'écran et les tests
 * reproductibles.
 *
 *   npm run db:seed
 *
 * Le script est idempotent : il efface les données de l'organisation de
 * démonstration avant de les recréer, et ne touche à aucune autre.
 */
import { PrismaClient } from "../src/generated/prisma";
import {
  AnomalySeverity,
  AnomalyStatus,
  CustomerKind,
  InterventionStatus,
  ReportOrigin,
  UserRole,
} from "../src/generated/prisma";
import { syncTradeCatalogs } from "../src/core/catalog-sync";
import bcrypt from "bcryptjs";
import { fakePhoto, fakeSignature, writeMedia } from "./seed-media";
import { rm } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const ORG_SLUG = "ramonage-cevennes";
const DEMO_PASSWORD = "vennora2026";

// --- Générateur déterministe ------------------------------------------------

let seedState = 0x5eed_1234;
function rand(): number {
  // xorshift32 : suffisant pour du jeu de démonstration, et stable.
  seedState ^= seedState << 13;
  seedState ^= seedState >>> 17;
  seedState ^= seedState << 5;
  return (seedState >>> 0) / 0xffff_ffff;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
function chance(p: number): boolean {
  return rand() < p;
}

// --- Dates ------------------------------------------------------------------

const NOW = new Date();

function at(year: number, month: number, day: number, hour = 8, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function addMonths(d: Date, n: number) {
  const c = new Date(d);
  c.setMonth(c.getMonth() + n);
  return c;
}
function addMinutes(d: Date, n: number) {
  return new Date(d.getTime() + n * 60_000);
}

// --- Données métier ---------------------------------------------------------

const TECHNICIANS = [
  {
    firstName: "Ludovic",
    lastName: "Fabre",
    email: "ludovic@ramonage-cevennes.fr",
    phone: "06 12 44 87 03",
    colorHex: "#0F3D4C",
  },
  {
    firstName: "Sarah",
    lastName: "Bouzid",
    email: "sarah@ramonage-cevennes.fr",
    phone: "06 78 21 09 55",
    colorHex: "#D97A28",
  },
  {
    firstName: "Mathieu",
    lastName: "Rouvière",
    email: "mathieu@ramonage-cevennes.fr",
    phone: "06 45 60 12 88",
    colorHex: "#1E7FB8",
  },
] as const;

const CUSTOMERS = [
  {
    kind: CustomerKind.INDIVIDUAL,
    name: "Dupont Jean",
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean.dupont@orange.fr",
    phone: "04 66 52 18 74",
    city: "Alès",
    postalCode: "30100",
    address: "12 rue Victor Hugo",
  },
  {
    kind: CustomerKind.COMPANY,
    name: "Martin SARL",
    companyName: "Martin SARL",
    email: "contact@martin-sarl.fr",
    phone: "04 66 30 92 10",
    city: "Anduze",
    postalCode: "30140",
    address: "5 rue de Paris",
  },
  {
    kind: CustomerKind.INDIVIDUAL,
    name: "Durand Pierre",
    firstName: "Pierre",
    lastName: "Durand",
    email: "p.durand@gmail.com",
    phone: "06 81 22 40 19",
    city: "Saint-Jean-du-Gard",
    postalCode: "30270",
    address: "8 rue Pasteur",
  },
  {
    kind: CustomerKind.INDIVIDUAL,
    name: "Nogaret Hélène",
    firstName: "Hélène",
    lastName: "Nogaret",
    email: "helene.nogaret@free.fr",
    phone: "06 14 78 33 21",
    city: "Lasalle",
    postalCode: "30460",
    address: "3 chemin des Aires",
  },
  {
    kind: CustomerKind.COMPANY,
    name: "Gîtes du Galeizon",
    companyName: "Gîtes du Galeizon",
    email: "reservation@gites-galeizon.fr",
    phone: "04 66 34 77 12",
    city: "Cendras",
    postalCode: "30480",
    address: "Route du Galeizon",
  },
  {
    kind: CustomerKind.INDIVIDUAL,
    name: "Serrano Michel",
    firstName: "Michel",
    lastName: "Serrano",
    email: "m.serrano@sfr.fr",
    phone: "06 60 91 05 47",
    city: "Le Vigan",
    postalCode: "30120",
    address: "22 avenue Sergent Triaire",
  },
  {
    kind: CustomerKind.INDIVIDUAL,
    name: "Bastide Claire",
    firstName: "Claire",
    lastName: "Bastide",
    email: "claire.bastide@laposte.net",
    phone: "06 33 58 71 90",
    city: "Sumène",
    postalCode: "30440",
    address: "7 place du Marché",
  },
  {
    kind: CustomerKind.COMPANY,
    name: "Mairie de Génolhac",
    companyName: "Mairie de Génolhac",
    email: "technique@genolhac.fr",
    phone: "04 66 61 18 00",
    city: "Génolhac",
    postalCode: "30450",
    address: "Place du Colombier",
  },
  {
    kind: CustomerKind.INDIVIDUAL,
    name: "Villaret Antoine",
    firstName: "Antoine",
    lastName: "Villaret",
    email: "antoine.villaret@gmail.com",
    phone: "06 09 44 26 83",
    city: "Florac",
    postalCode: "48400",
    address: "14 rue du Pêcher",
  },
  {
    kind: CustomerKind.INDIVIDUAL,
    name: "Combes Marie-José",
    firstName: "Marie-José",
    lastName: "Combes",
    email: "mj.combes@orange.fr",
    phone: "04 66 85 30 62",
    city: "Bagnols-les-Bains",
    postalCode: "48190",
    address: "2 route de Mende",
  },
] as const;

/** Sites additionnels : certains clients en ont plusieurs. */
const EXTRA_SITES: Record<
  string,
  Array<{ name: string; address: string; postalCode: string; city: string }>
> = {
  "Dupont Jean": [
    {
      name: "Résidence secondaire",
      address: "Hameau de Peyrolles",
      postalCode: "30124",
      city: "Peyrolles",
    },
  ],
  "Martin SARL": [
    {
      name: "Atelier",
      address: "ZA de Labahou, lot 4",
      postalCode: "30140",
      city: "Anduze",
    },
  ],
  "Gîtes du Galeizon": [
    {
      name: "Gîte du Serre",
      address: "Chemin du Serre",
      postalCode: "30480",
      city: "Cendras",
    },
    {
      name: "Gîte de la Vallée",
      address: "Route du Galeizon, lieu-dit Le Martinet",
      postalCode: "30480",
      city: "Cendras",
    },
  ],
  "Mairie de Génolhac": [
    {
      name: "Salle des fêtes",
      address: "Rue de la Fabrique",
      postalCode: "30450",
      city: "Génolhac",
    },
    {
      name: "École primaire",
      address: "Rue des Écoles",
      postalCode: "30450",
      city: "Génolhac",
    },
  ],
};

const EQUIPMENT_POOL = [
  { code: "POELE_GRANULES", brands: ["MCZ", "Palazzetti", "Rika", "Edilkamin"] },
  { code: "POELE_BOIS", brands: ["Godin", "Invicta", "Jøtul", "Supra"] },
  { code: "CHEMINEE", brands: ["Focus", "Cheminées Philippe", "Artisanal"] },
  { code: "INSERT", brands: ["Invicta", "Seguin", "Deville"] },
  { code: "CHAUDIERE_BOIS", brands: ["Fröling", "Hargassner", "ETA"] },
  { code: "CHAUDIERE_FIOUL", brands: ["De Dietrich", "Viessmann"] },
  { code: "CHAUDIERE_GAZ", brands: ["Saunier Duval", "Frisquet", "Chappée"] },
] as const;

const LOCATIONS = [
  "Séjour",
  "Salon",
  "Cuisine",
  "Chaufferie",
  "Sous-sol",
  "Pièce de vie",
] as const;

const ANOMALY_TEMPLATES = [
  {
    title: "Dépôt de bistre important",
    description:
      "Conduit fortement encrassé sur la partie haute, dépôt vitrifié adhérent.",
    severity: AnomalySeverity.HIGH,
    recommendation:
      "Débistrage mécanique à programmer avant la prochaine saison de chauffe.",
  },
  {
    title: "Fissure du raccord",
    description:
      "Fissure constatée au niveau du raccordement entre l'appareil et le conduit.",
    severity: AnomalySeverity.MEDIUM,
    recommendation: "Contrôle et remplacement du raccord.",
  },
  {
    title: "Chapeau de cheminée détérioré",
    description:
      "Chapeau descellé, risque d'infiltration d'eau et de perte de tirage.",
    severity: AnomalySeverity.MEDIUM,
    recommendation: "Remplacement du chapeau, intervention en toiture.",
  },
  {
    title: "Joint de porte à remplacer",
    description: "Joint de porte du foyer durci, étanchéité insuffisante.",
    severity: AnomalySeverity.LOW,
    recommendation: "Remplacement du joint tressé au prochain entretien.",
  },
  {
    title: "Trappe de ramonage inaccessible",
    description:
      "Trappe condamnée par un aménagement, contrôle du pied de conduit impossible.",
    severity: AnomalySeverity.LOW,
    recommendation: "Prévoir la création d'une trappe accessible.",
  },
  {
    title: "Absence de détecteur de fumée",
    description: "Aucun détecteur avertisseur autonome de fumée dans la pièce.",
    severity: AnomalySeverity.INFO,
    recommendation: "Installation d'un DAAF conforme à la norme EN 14604.",
  },
  {
    title: "Conduit non étanche",
    description:
      "Passage de fumées constaté au niveau d'un about de boisseau, refoulement possible.",
    severity: AnomalySeverity.CRITICAL,
    recommendation:
      "Arrêt d'utilisation recommandé jusqu'au tubage du conduit.",
  },
  {
    title: "Ventilation insuffisante",
    description:
      "Amenée d'air de la pièce obstruée, tirage dégradé en fonctionnement.",
    severity: AnomalySeverity.MEDIUM,
    recommendation: "Dégager l'entrée d'air et vérifier sa section.",
  },
] as const;

const WORK_DONE = [
  "Ramonage mécanique du conduit sur toute sa hauteur par le bas. Aspiration des suies, nettoyage du foyer et du déflecteur. Vérification de la vacuité et du tirage.",
  "Ramonage mécanique du conduit, démontage et nettoyage du raccordement. Nettoyage du creuset, du brasero et de l'échangeur. Contrôle de la vis sans fin et du ventilateur d'extraction.",
  "Ramonage par le haut, brossage du conduit maçonné. Nettoyage de la trappe de pied et évacuation des suies. Contrôle visuel du chapeau depuis la toiture.",
  "Entretien complet de la chaudière : nettoyage du corps de chauffe, contrôle du brûleur, remplacement du filtre, mesure de combustion.",
] as const;

const EQUIPMENT_STATE = [
  "Conduit en bon état général, maçonnerie saine, tirage correct.",
  "Appareil propre et fonctionnel. Conduit sain, aucune trace de refoulement.",
  "Conduit correct dans l'ensemble. Léger encrassement en partie haute, sans gravité à ce stade.",
  "Appareil vieillissant mais en état de fonctionnement. Joints à surveiller.",
] as const;

// --- Nettoyage --------------------------------------------------------------

async function wipeDemoOrg(orgId: string) {
  // Les fichiers accompagnent les lignes : les laisser accumulerait un
  // répertoire de plus en plus gros à chaque relance du seed.
  await rm(path.join(process.cwd(), ".storage", "org", orgId), {
    recursive: true,
    force: true,
  });
  // Ordre inverse des dépendances : MongoDB n'a pas de contrainte, mais on
  // évite de laisser des orphelins si le script échoue en cours de route.
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.reminder.deleteMany({ where: { orgId } });
  await prisma.document.deleteMany({ where: { orgId } });
  await prisma.signature.deleteMany({ where: { orgId } });
  await prisma.report.deleteMany({ where: { orgId } });
  await prisma.interventionPhoto.deleteMany({ where: { orgId } });
  await prisma.voiceNote.deleteMany({ where: { orgId } });
  await prisma.anomaly.deleteMany({ where: { orgId } });
  await prisma.intervention.deleteMany({ where: { orgId } });
  await prisma.equipment.deleteMany({ where: { orgId } });
  await prisma.site.deleteMany({ where: { orgId } });
  await prisma.customer.deleteMany({ where: { orgId } });
  await prisma.counter.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
}

// --- Seed -------------------------------------------------------------------

async function main() {
  console.log("→ Synchronisation des catalogues métier…");
  await syncTradeCatalogs(prisma);

  const trade = await prisma.trade.findUniqueOrThrow({
    where: { slug: "ramonage" },
    select: { id: true },
  });

  const equipmentTypes = await prisma.equipmentType.findMany({
    where: { tradeId: trade.id },
    select: { id: true, code: true, defaultIntervalMonths: true },
  });
  const interventionTypes = await prisma.interventionType.findMany({
    where: { tradeId: trade.id },
    select: { id: true, code: true, defaultDurationMin: true },
  });

  const equipmentTypeByCode = new Map(equipmentTypes.map((t) => [t.code, t]));
  const interventionTypeByCode = new Map(
    interventionTypes.map((t) => [t.code, t]),
  );

  const existing = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });
  if (existing) {
    console.log("→ Purge du jeu de démonstration existant…");
    await wipeDemoOrg(existing.id);
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  console.log("→ Création de l'entreprise…");
  const org = await prisma.organization.create({
    data: {
      name: "Ramonage Cévennes",
      slug: ORG_SLUG,
      address: "18 route d'Uzès",
      postalCode: "30100",
      city: "Alès",
      phone: "04 66 52 40 18",
      email: "contact@ramonage-cevennes.fr",
      siret: "84219476300021",
      tradeId: trade.id,
      settings: {
        reportFooter:
          "Ramonage Cévennes — SIRET 842 194 763 00021 — Assurance décennale AXA n° 4218871",
        certificateMention:
          "Certificat de ramonage établi conformément à l'arrêté du 20 juillet 2023.",
      },
    },
  });

  console.log("→ Création des utilisateurs…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.user.create({
    data: {
      orgId: org.id,
      firstName: "Céline",
      lastName: "Mazel",
      email: "celine@ramonage-cevennes.fr",
      phone: "04 66 52 40 18",
      passwordHash,
      role: UserRole.ADMIN,
      colorHex: "#6B7780",
    },
  });

  const technicians: Array<{ id: string; firstName: string; lastName: string }> =
    [];
  for (const t of TECHNICIANS) {
    technicians.push(
      await prisma.user.create({
        data: {
          orgId: org.id,
          firstName: t.firstName,
          lastName: t.lastName,
          email: t.email,
          phone: t.phone,
          passwordHash,
          role: UserRole.TECHNICIAN,
          colorHex: t.colorHex,
        },
      }),
    );
  }

  console.log("→ Création des clients et des sites…");
  const sites: Array<{
    id: string;
    customerId: string;
    customerName: string;
    city: string;
  }> = [];

  for (const c of CUSTOMERS) {
    const customer = await prisma.customer.create({
      data: {
        orgId: org.id,
        kind: c.kind,
        name: c.name,
        firstName: "firstName" in c ? c.firstName : null,
        lastName: "lastName" in c ? c.lastName : null,
        companyName: "companyName" in c ? c.companyName : null,
        email: c.email,
        phone: c.phone,
        address: c.address,
        postalCode: c.postalCode,
        city: c.city,
      },
    });

    // Site principal, à l'adresse du client.
    const main = await prisma.site.create({
      data: {
        orgId: org.id,
        customerId: customer.id,
        name:
          c.kind === CustomerKind.COMPANY ? "Établissement principal" : "Maison principale",
        address: c.address,
        postalCode: c.postalCode,
        city: c.city,
        accessNotes: chance(0.3) ? "Portail à gauche, chien attaché." : null,
      },
    });
    sites.push({
      id: main.id,
      customerId: customer.id,
      customerName: c.name,
      city: c.city,
    });

    for (const extra of EXTRA_SITES[c.name] ?? []) {
      const site = await prisma.site.create({
        data: {
          orgId: org.id,
          customerId: customer.id,
          name: extra.name,
          address: extra.address,
          postalCode: extra.postalCode,
          city: extra.city,
        },
      });
      sites.push({
        id: site.id,
        customerId: customer.id,
        customerName: c.name,
        city: extra.city,
      });
    }
  }

  console.log(`   ${CUSTOMERS.length} clients, ${sites.length} sites`);

  console.log("→ Création des équipements…");
  const equipments: Array<{
    id: string;
    siteId: string;
    customerId: string;
    customerName: string;
    intervalMonths: number;
  }> = [];

  // Au moins un équipement par site, puis on complète jusqu'à 25.
  const TARGET_EQUIPMENT = 25;
  for (let i = 0; i < TARGET_EQUIPMENT; i++) {
    const site = i < sites.length ? sites[i] : pick(sites);
    const spec = pick(EQUIPMENT_POOL);
    const type = equipmentTypeByCode.get(spec.code);
    if (!type) continue;

    const installedYear = randInt(2008, 2024);
    const equipment = await prisma.equipment.create({
      data: {
        orgId: org.id,
        siteId: site.id,
        typeId: type.id,
        brand: pick(spec.brands),
        model: `${pick(["Serie", "Modèle", "Réf."])} ${randInt(100, 900)}`,
        serialNumber: `${randInt(10, 99)}-${randInt(10000, 99999)}`,
        location: pick(LOCATIONS),
        installedAt: at(installedYear, randInt(1, 12), randInt(1, 28)),
        notes: chance(0.25)
          ? "Accès par l'échelle de toit côté nord."
          : null,
      },
    });
    equipments.push({
      id: equipment.id,
      siteId: site.id,
      customerId: site.customerId,
      customerName: site.customerName,
      intervalMonths: type.defaultIntervalMonths ?? 12,
    });
  }
  console.log(`   ${equipments.length} équipements`);

  console.log("→ Création des interventions…");

  const year = NOW.getFullYear();
  let sequence = 0;
  const nextReference = () => {
    sequence += 1;
    return `INT-${year}-${String(sequence).padStart(4, "0")}`;
  };

  const ramonageType = interventionTypeByCode.get("RAMONAGE")!;
  const entretienType = interventionTypeByCode.get("ENTRETIEN")!;
  const controleType = interventionTypeByCode.get("CONTROLE")!;
  const depannageType = interventionTypeByCode.get("DEPANNAGE")!;

  let anomalyCount = 0;
  let reportCount = 0;

  /** Crée une intervention terminée, avec rapport, signature et anomalies. */
  async function createCompleted(
    equipment: (typeof equipments)[number],
    date: Date,
    typeId: string,
    durationMin: number,
  ) {
    const technician = pick(technicians);
    const start = date;
    const end = addMinutes(start, durationMin);

    const intervention = await prisma.intervention.create({
      data: {
        orgId: org.id,
        reference: nextReference(),
        customerId: equipment.customerId,
        siteId: equipment.siteId,
        equipmentId: equipment.id,
        technicianId: technician.id,
        typeId,
        scheduledStart: start,
        scheduledEnd: end,
        startedAt: addMinutes(start, randInt(-10, 15)),
        completedAt: addMinutes(end, randInt(-15, 20)),
        status: InterventionStatus.COMPLETED,
        notes: null,
        nextInterventionAt: addMonths(start, equipment.intervalMonths),
      },
    });

    // Anomalies : environ une intervention sur trois en relève au moins une.
    const anomalies = [];
    if (chance(0.34)) {
      const count = chance(0.2) ? 2 : 1;
      const used = new Set<string>();
      for (let i = 0; i < count; i++) {
        const template = pick(ANOMALY_TEMPLATES);
        if (used.has(template.title)) continue;
        used.add(template.title);

        // Les anomalies anciennes ont généralement été traitées depuis.
        const isOld = start < addMonths(NOW, -14);
        const status = isOld
          ? chance(0.75)
            ? AnomalyStatus.RESOLVED
            : AnomalyStatus.OPEN
          : chance(0.25)
            ? AnomalyStatus.RESOLVED
            : AnomalyStatus.OPEN;

        anomalies.push(
          await prisma.anomaly.create({
            data: {
              orgId: org.id,
              interventionId: intervention.id,
              equipmentId: equipment.id,
              title: template.title,
              description: template.description,
              severity: template.severity,
              recommendation: template.recommendation,
              status,
              resolvedAt:
                status === AnomalyStatus.RESOLVED
                  ? addMonths(start, randInt(1, 10))
                  : null,
              resolvedById:
                status === AnomalyStatus.RESOLVED ? technician.id : null,
            },
          }),
        );
        anomalyCount += 1;
      }
    }

    const anomaliesSummary =
      anomalies.length === 0
        ? "Aucune anomalie constatée lors de cette intervention."
        : anomalies
            .map((a) => `• ${a.title} — ${a.description ?? ""}`)
            .join("\n");

    const recommendations =
      anomalies.length === 0
        ? "Poursuivre l'utilisation de bois sec (humidité inférieure à 20 %). Prochain ramonage dans douze mois."
        : anomalies.map((a) => `• ${a.recommendation ?? ""}`).join("\n");

    await prisma.report.create({
      data: {
        orgId: org.id,
        interventionId: intervention.id,
        summary: `Intervention réalisée le ${start.toLocaleDateString("fr-FR")} par ${technician.firstName} ${technician.lastName}. Conduit et appareil contrôlés, installation ${anomalies.length === 0 ? "conforme" : "avec réserves"}.`,
        workDone: pick(WORK_DONE),
        equipmentState: pick(EQUIPMENT_STATE),
        anomaliesSummary,
        recommendations,
        futureWork:
          anomalies.length === 0
            ? null
            : "Reprise des points signalés avant la prochaine saison de chauffe.",
        origin: ReportOrigin.MANUAL,
        validatedAt: addMinutes(end, 5),
        validatedById: technician.id,
        pdfGeneratedAt: addMinutes(end, 6),
        sentAt: chance(0.8) ? addMinutes(end, 8) : null,
        sentTo: [],
      },
    });
    reportCount += 1;

    // Vraie image : une clé pointant dans le vide affichait une signature
    // cassée dans le PDF de démonstration.
    const signature = await writeMedia(
      org.id, "signatures", intervention.id, "png",
      fakeSignature(sequence),
    );
    await prisma.signature.create({
      data: {
        orgId: org.id,
        interventionId: intervention.id,
        signerName: equipment.customerName,
        storageKey: signature.key,
        signedAt: addMinutes(end, 4),
      },
    });

    // Une à trois photos de chantier, elles aussi réelles.
    for (let p = 0; p < randInt(1, 3); p++) {
      const photo = await writeMedia(
        org.id, "interventions", intervention.id, "png",
        fakePhoto(sequence * 3 + p),
      );
      await prisma.interventionPhoto.create({
        data: {
          orgId: org.id,
          interventionId: intervention.id,
          equipmentId: equipment.id,
          storageKey: photo.key,
          mimeType: "image/png",
          sizeBytes: photo.sizeBytes,
          caption: pick([
            "Conduit avant intervention",
            "Foyer après nettoyage",
            "Raccordement contrôlé",
            "Chapeau vu depuis la toiture",
          ]),
          takenAt: addMinutes(start, randInt(5, 45)),
          uploadedById: technician.id,
          sortOrder: p,
        },
      });
    }

    return intervention;
  }

  // Historique : trois saisons de chauffe, une intervention par équipement et
  // par an sur les équipements les plus anciens.
  const historyEquipments = equipments.slice(0, 14);
  for (const equipment of historyEquipments) {
    for (const yearsAgo of [3, 2, 1]) {
      if (yearsAgo === 3 && chance(0.4)) continue; // tous les clients ne datent pas de 2023
      const date = at(
        year - yearsAgo,
        randInt(9, 11),
        randInt(1, 28),
        randInt(8, 16),
        pick([0, 30]),
      );
      await createCompleted(equipment, date, ramonageType.id, 60);
    }
  }

  // Quelques entretiens et dépannages récents.
  for (let i = 0; i < 6; i++) {
    const equipment = pick(equipments);
    const date = at(
      year,
      randInt(1, Math.max(1, NOW.getMonth())),
      randInt(1, 28),
      randInt(8, 16),
      pick([0, 30]),
    );
    if (date >= NOW) continue;
    const type = chance(0.5) ? entretienType : depannageType;
    await createCompleted(equipment, date, type.id, type.defaultDurationMin);
  }

  console.log("→ Journée en cours et planning à venir…");

  const startOfToday = new Date(NOW);
  startOfToday.setHours(0, 0, 0, 0);

  /** Crée une intervention non terminée (planifiée ou en cours). */
  async function createOpen(
    equipment: (typeof equipments)[number],
    start: Date,
    typeId: string,
    durationMin: number,
    status: InterventionStatus,
    technicianId: string,
  ) {
    return prisma.intervention.create({
      data: {
        orgId: org.id,
        reference: nextReference(),
        customerId: equipment.customerId,
        siteId: equipment.siteId,
        equipmentId: equipment.id,
        technicianId,
        typeId,
        scheduledStart: start,
        scheduledEnd: addMinutes(start, durationMin),
        startedAt:
          status === InterventionStatus.IN_PROGRESS
            ? addMinutes(start, 5)
            : null,
        status,
      },
    });
  }

  // La journée du technicien principal : 3 terminées, 2 en cours, 3 à venir.
  const today = technicians[0];
  const todaySlots = [8.5, 10, 11.5, 13.5, 14.5, 16, 17, 18];
  const todayStatuses: InterventionStatus[] = [
    InterventionStatus.COMPLETED,
    InterventionStatus.COMPLETED,
    InterventionStatus.COMPLETED,
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.PLANNED,
    InterventionStatus.PLANNED,
    InterventionStatus.PLANNED,
  ];

  for (let i = 0; i < todaySlots.length; i++) {
    const equipment = equipments[(i * 3) % equipments.length];
    const hour = Math.floor(todaySlots[i]);
    const minute = (todaySlots[i] % 1) * 60;
    const start = new Date(startOfToday);
    start.setHours(hour, minute, 0, 0);

    if (todayStatuses[i] === InterventionStatus.COMPLETED) {
      await createCompleted(equipment, start, ramonageType.id, 60);
    } else {
      await createOpen(
        equipment,
        start,
        i % 3 === 0 ? entretienType.id : ramonageType.id,
        60,
        todayStatuses[i],
        today.id,
      );
    }
  }

  // Le reste de la semaine et les deux suivantes, réparties entre techniciens.
  for (let day = 1; day <= 18; day++) {
    const date = addDays(startOfToday, day);
    if (date.getDay() === 0) continue; // pas de dimanche
    const count = date.getDay() === 6 ? randInt(0, 2) : randInt(2, 4);

    for (let i = 0; i < count; i++) {
      const equipment = pick(equipments);
      const start = new Date(date);
      start.setHours(randInt(8, 16), pick([0, 30]), 0, 0);
      await createOpen(
        equipment,
        start,
        chance(0.75) ? ramonageType.id : pick([entretienType, controleType]).id,
        60,
        InterventionStatus.PLANNED,
        pick(technicians).id,
      );
    }
  }

  console.log("→ Mise à jour des dates dérivées…");

  // Miroirs dénormalisés : dernière et prochaine intervention, échéances.
  for (const equipment of equipments) {
    const last = await prisma.intervention.findFirst({
      where: {
        orgId: org.id,
        equipmentId: equipment.id,
        status: InterventionStatus.COMPLETED,
      },
      orderBy: { scheduledStart: "desc" },
      select: { scheduledStart: true },
    });

    await prisma.equipment.update({
      where: { id: equipment.id },
      data: {
        lastInterventionAt: last?.scheduledStart ?? null,
        nextDueAt: last
          ? addMonths(last.scheduledStart, equipment.intervalMonths)
          : null,
      },
    });
  }

  const customers = await prisma.customer.findMany({
    where: { orgId: org.id },
    select: { id: true },
  });

  for (const customer of customers) {
    const [last, next] = await Promise.all([
      prisma.intervention.findFirst({
        where: {
          orgId: org.id,
          customerId: customer.id,
          status: InterventionStatus.COMPLETED,
        },
        orderBy: { scheduledStart: "desc" },
        select: { scheduledStart: true },
      }),
      prisma.intervention.findFirst({
        where: {
          orgId: org.id,
          customerId: customer.id,
          status: InterventionStatus.PLANNED,
          scheduledStart: { gte: NOW },
        },
        orderBy: { scheduledStart: "asc" },
        select: { scheduledStart: true },
      }),
    ]);

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        lastInterventionAt: last?.scheduledStart ?? null,
        nextInterventionAt: next?.scheduledStart ?? null,
      },
    });
  }

  // Compteur de numérotation aligné sur ce qui a été créé.
  await prisma.counter.create({
    data: { orgId: org.id, key: `intervention:${year}`, value: sequence },
  });

  // Aucun Document n'est créé ici : le PDF d'un rapport est régénéré à la
  // demande par /api/interventions/[id]/rapport, à partir des données. Créer
  // des lignes pointant vers des fichiers absents ne ferait qu'afficher des
  // documents cassés.

  const totals = {
    interventions: await prisma.intervention.count({ where: { orgId: org.id } }),
    anomaliesOuvertes: await prisma.anomaly.count({
      where: { orgId: org.id, status: AnomalyStatus.OPEN },
    }),
  };

  console.log("\n✔ Jeu de démonstration prêt");
  console.log(`   Entreprise      Ramonage Cévennes`);
  console.log(`   Clients         ${CUSTOMERS.length}`);
  console.log(`   Sites           ${sites.length}`);
  console.log(`   Équipements     ${equipments.length}`);
  console.log(`   Interventions   ${totals.interventions}`);
  console.log(`   Anomalies       ${anomalyCount} (${totals.anomaliesOuvertes} ouvertes)`);
  console.log(`   Rapports        ${reportCount}`);
  console.log(`\n   Connexion admin       celine@ramonage-cevennes.fr`);
  console.log(`   Connexion technicien  ludovic@ramonage-cevennes.fr`);
  console.log(`   Mot de passe          ${DEMO_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error("\n✖ Échec du seed\n", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
