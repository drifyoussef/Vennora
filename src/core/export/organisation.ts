import type { AppContext } from "@/core/context";
import { ANOMALY_SEVERITY_LABEL, ANOMALY_STATUS_LABEL, INTERVENTION_STATUS_LABEL } from "@/core/labels";
import { ecrireCsv } from "@/lib/csv";
import { readFileBytes } from "@/services/storage";

/**
 * Export complet des données d'une entreprise.
 *
 * Promesse tenue à la lettre : « elles vous appartiennent ». Un client qui
 * part doit pouvoir emporter son travail sans rien demander à personne, et
 * dans un format qu'il ouvre sans nous — d'où des CSV lisibles dans un
 * tableur plutôt qu'un JSON qui ne parle qu'aux développeurs, et les PDF
 * originaux à côté.
 *
 * Le contexte est cloisonné : impossible d'exporter les données d'une autre
 * entreprise, même en trafiquant la requête.
 */
export interface FichierExport {
  chemin: string;
  contenu: string | Buffer;
}

function date(v: Date | null | undefined): string {
  return v ? v.toISOString().slice(0, 10) : "";
}

function horodatage(v: Date | null | undefined): string {
  return v ? v.toISOString().replace("T", " ").slice(0, 16) : "";
}

export async function construireExport({
  db,
  user,
}: AppContext): Promise<FichierExport[]> {
  const [clients, sites, equipements, interventions, anomalies, rapports] =
    await Promise.all([
      db.customer.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, kind: true, email: true, phone: true,
          phoneSecondary: true, address: true, postalCode: true, city: true,
          notes: true, createdAt: true,
        },
      }),
      db.site.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true, customerId: true, name: true, address: true,
          addressComplement: true, postalCode: true, city: true,
          accessNotes: true, notes: true,
        },
      }),
      db.equipment.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true, siteId: true, label: true, brand: true, model: true,
          serialNumber: true, installedAt: true, lastInterventionAt: true,
          nextDueAt: true, type: { select: { label: true } },
        },
      }),
      db.intervention.findMany({
        orderBy: { scheduledStart: "asc" },
        select: {
          id: true, reference: true, customerId: true, siteId: true,
          equipmentId: true, status: true, scheduledStart: true,
          completedAt: true, notes: true,
          type: { select: { label: true } },
          technician: { select: { firstName: true, lastName: true } },
        },
      }),
      db.anomaly.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true, interventionId: true, equipmentId: true, title: true,
          description: true, severity: true, status: true, recommendation: true,
          createdAt: true,
        },
      }),
      db.report.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          interventionId: true, summary: true, workDone: true,
          equipmentState: true, anomaliesSummary: true, recommendations: true,
          futureWork: true, validatedAt: true, sentAt: true, pdfKey: true,
          origin: true,
          intervention: { select: { reference: true } },
        },
      }),
    ]);

  const fichiers: FichierExport[] = [
    {
      chemin: "clients.csv",
      contenu: ecrireCsv(
        ["id", "nom", "type", "email", "telephone", "telephone_2", "adresse", "code_postal", "ville", "notes", "cree_le"],
        clients.map((c) => [
          c.id, c.name, c.kind === "COMPANY" ? "Entreprise" : "Particulier",
          c.email, c.phone, c.phoneSecondary, c.address, c.postalCode, c.city,
          c.notes, date(c.createdAt),
        ]),
      ),
    },
    {
      chemin: "sites.csv",
      contenu: ecrireCsv(
        ["id", "client_id", "nom", "adresse", "complement", "code_postal", "ville", "acces", "notes"],
        sites.map((s) => [
          s.id, s.customerId, s.name, s.address, s.addressComplement,
          s.postalCode, s.city, s.accessNotes, s.notes,
        ]),
      ),
    },
    {
      chemin: "equipements.csv",
      contenu: ecrireCsv(
        ["id", "site_id", "type", "libelle", "marque", "modele", "numero_serie", "installe_le", "dernier_passage", "prochaine_echeance"],
        equipements.map((e) => [
          e.id, e.siteId, e.type.label, e.label, e.brand, e.model,
          e.serialNumber, date(e.installedAt), date(e.lastInterventionAt),
          date(e.nextDueAt),
        ]),
      ),
    },
    {
      chemin: "interventions.csv",
      contenu: ecrireCsv(
        ["reference", "id", "client_id", "site_id", "equipement_id", "type", "statut", "technicien", "prevue_le", "terminee_le", "notes"],
        interventions.map((i) => [
          i.reference, i.id, i.customerId, i.siteId, i.equipmentId,
          i.type.label, INTERVENTION_STATUS_LABEL[i.status],
          `${i.technician.firstName} ${i.technician.lastName}`,
          horodatage(i.scheduledStart), horodatage(i.completedAt), i.notes,
        ]),
      ),
    },
    {
      chemin: "anomalies.csv",
      contenu: ecrireCsv(
        ["id", "intervention_id", "equipement_id", "titre", "description", "gravite", "statut", "recommandation", "constatee_le"],
        anomalies.map((a) => [
          a.id, a.interventionId, a.equipmentId, a.title, a.description,
          ANOMALY_SEVERITY_LABEL[a.severity], ANOMALY_STATUS_LABEL[a.status],
          a.recommendation, date(a.createdAt),
        ]),
      ),
    },
    {
      chemin: "comptes-rendus.csv",
      contenu: ecrireCsv(
        ["intervention", "resume", "travaux", "etat_equipement", "anomalies", "recommandations", "travaux_a_prevoir", "origine", "valide_le", "envoye_le"],
        rapports.map((r) => [
          r.intervention?.reference, r.summary, r.workDone, r.equipmentState,
          r.anomaliesSummary, r.recommendations, r.futureWork,
          r.origin === "AI" ? "Brouillon assisté, relu" : "Rédigé à la main",
          horodatage(r.validatedAt), horodatage(r.sentAt),
        ]),
      ),
    },
  ];

  // Les PDF signés valent plus que leur contenu textuel : ce sont les pièces
  // remises aux clients. Un fichier illisible ne doit pas faire échouer
  // l'export entier — on le signale dans le fichier de lecture.
  const manquants: string[] = [];
  for (const r of rapports) {
    if (!r.pdfKey) continue;
    try {
      const octets = await readFileBytes(r.pdfKey);
      fichiers.push({
        chemin: `rapports/${r.intervention?.reference ?? r.interventionId}.pdf`,
        contenu: octets,
      });
    } catch {
      manquants.push(r.intervention?.reference ?? r.interventionId);
    }
  }

  fichiers.push({
    chemin: "lisez-moi.txt",
    contenu: [
      `Export des données — ${user.org.name}`,
      `Généré le ${new Date().toLocaleString("fr-FR")} par ${user.fullName}.`,
      "",
      "Contenu",
      `  clients.csv           ${clients.length} fiche(s)`,
      `  sites.csv             ${sites.length}`,
      `  equipements.csv       ${equipements.length}`,
      `  interventions.csv     ${interventions.length}`,
      `  anomalies.csv         ${anomalies.length}`,
      `  comptes-rendus.csv    ${rapports.length}`,
      `  rapports/             ${rapports.filter((r) => r.pdfKey).length - manquants.length} PDF signé(s)`,
      "",
      "Les fichiers CSV sont séparés par des points-virgules et encodés en UTF-8",
      "avec marque d'ordre d'octets : ils s'ouvrent directement dans un tableur.",
      "Les colonnes « id » permettent de relier les fichiers entre eux.",
      ...(manquants.length > 0
        ? ["", `Rapports dont le fichier PDF est introuvable : ${manquants.join(", ")}.`]
        : []),
      "",
    ].join("\n"),
  });

  return fichiers;
}
