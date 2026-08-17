import "server-only";
import type { ReportContext } from "./types";

/**
 * Construction du prompt de rédaction.
 *
 * Isolé de l'adaptateur pour deux raisons : le mock s'en sert pour produire
 * une sortie plausible à partir des mêmes données, et la formulation peut
 * être relue et versionnée sans toucher au code d'appel.
 *
 * Le principe directeur tient en une phrase : **le modèle reformule, il
 * n'invente pas**. Un compte-rendu de ramonage a une portée quasi
 * réglementaire ; une opération inventée dans « Travaux réalisés » engage
 * l'entreprise.
 */
export const SYSTEM_PROMPT = `Tu rédiges des comptes-rendus d'intervention technique pour une entreprise française, à partir des notes prises sur le terrain par le technicien.

Règles absolues :
- N'invente jamais une opération, une mesure, une pièce ou un constat qui ne figure pas dans les notes. Ce document a une valeur probante.
- Si une section n'est pas documentée par les notes, écris-le franchement plutôt que de meubler.
- Écris au passé composé, à la voix active, sans « je » ni « nous » : « Ramonage mécanique effectué », pas « J'ai effectué le ramonage ».
- Français professionnel, phrases courtes. Le destinataire est le client, pas un confrère : évite le jargon non expliqué.
- Aucun chiffrage, aucun prix, aucun engagement commercial.
- Ne recopie pas les notes telles quelles : structure-les, corrige la syntaxe et les scories de dictée.

Tu produis exactement les six sections demandées, sans titre ni préambule dans le texte de chaque section.`;

export function buildUserPrompt(context: ReportContext): string {
  const lines: string[] = [];

  lines.push(`Métier : ${context.tradeName}`);
  lines.push(`Type d'intervention : ${context.interventionType}`);
  lines.push(`Date : ${context.interventionDate}`);
  lines.push(`Technicien : ${context.technicianName}`);
  lines.push(`Client : ${context.customerName}`);
  lines.push(`Site : ${context.siteLabel}`);

  if (context.equipment) {
    const e = context.equipment;
    lines.push(
      `Équipement : ${e.label} (${e.type})${
        e.brand || e.model
          ? ` — ${[e.brand, e.model].filter(Boolean).join(" ")}`
          : ""
      }${e.installedAt ? `, installé en ${e.installedAt}` : ""}`,
    );
  } else {
    lines.push("Équipement : non précisé");
  }

  if (context.previousFindings.length > 0) {
    lines.push("");
    lines.push("Constats des interventions précédentes sur cet équipement :");
    for (const finding of context.previousFindings) lines.push(`- ${finding}`);
  }

  lines.push("");
  lines.push("Notes du technicien (clavier et dictée, dans l'ordre) :");
  if (context.rawNotes.length === 0) {
    lines.push("(aucune note saisie)");
  } else {
    for (const note of context.rawNotes) lines.push(note);
  }

  lines.push("");
  if (context.anomalies.length === 0) {
    lines.push("Anomalies enregistrées : aucune.");
  } else {
    lines.push("Anomalies enregistrées :");
    for (const anomaly of context.anomalies) {
      lines.push(
        `- ${anomaly.title} (gravité : ${anomaly.severity})${
          anomaly.description ? ` — ${anomaly.description}` : ""
        }${anomaly.recommendation ? ` Recommandation : ${anomaly.recommendation}` : ""}`,
      );
    }
  }

  if (context.photoCaptions.length > 0) {
    lines.push("");
    lines.push("Légendes des photos :");
    for (const caption of context.photoCaptions) lines.push(`- ${caption}`);
  }

  lines.push("");
  lines.push("Consignes par section :");
  for (const section of context.sectionHints) {
    lines.push(`- ${section.label} : ${section.hint}`);
  }

  return lines.join("\n");
}

/**
 * Schéma de sortie.
 *
 * Passé en sortie structurée plutôt qu'en consigne de format : demander du
 * JSON dans le texte du prompt marche « la plupart du temps », ce qui est
 * exactement le taux d'échec qu'on ne veut pas sur un écran de terrain.
 */
export const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "Résumé de l'intervention, deux à trois phrases factuelles.",
    },
    workDone: {
      type: "string",
      description: "Travaux réellement réalisés, un par ligne.",
    },
    equipmentState: {
      type: "string",
      description: "État constaté de l'équipement et du conduit.",
    },
    anomaliesSummary: {
      type: "string",
      description:
        "Anomalies constatées avec leur gravité, ou mention explicite qu'il n'y en a aucune.",
    },
    recommendations: {
      type: "string",
      description: "Conseils d'usage et actions conseillées, sans chiffrage.",
    },
    futureWork: {
      type: "string",
      description:
        "Travaux à prévoir, par ordre de priorité. Vide s'il n'y en a pas.",
    },
  },
  required: [
    "summary",
    "workDone",
    "equipmentState",
    "anomaliesSummary",
    "recommendations",
    "futureWork",
  ],
  additionalProperties: false,
} as const;
