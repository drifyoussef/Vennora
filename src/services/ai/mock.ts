import "server-only";
import type { ReportContext, ReportGeneration, ReportGenerator } from "./types";
import type { TranscriptionProvider, TranscriptionResult } from "./types";

/**
 * Implémentations simulées, utilisées tant qu'aucune clé n'est configurée.
 *
 * Elles ne renvoient pas du texte factice : elles assemblent réellement les
 * données de l'intervention. Le technicien obtient donc un brouillon utile,
 * l'écran de validation se teste de bout en bout, et brancher un vrai modèle
 * plus tard ne change que la qualité de la rédaction — pas le parcours.
 */

function joinLines(lines: Array<string | null | undefined>): string {
  return lines.filter((l): l is string => Boolean(l && l.trim())).join("\n");
}

export const mockGenerator: ReportGenerator = {
  name: "mock",
  configured: true,

  async generate(context: ReportContext): Promise<ReportGeneration> {
    const equipment = context.equipment;
    const equipmentLabel = equipment
      ? `${equipment.label}${equipment.brand ? ` ${equipment.brand}` : ""}`
      : "l'installation";

    const open = context.anomalies.length;
    const notes = context.rawNotes.filter((n) => n.trim());

    return {
      summary: joinLines([
        `Intervention de ${context.interventionType.toLowerCase()} réalisée le ${context.interventionDate} par ${context.technicianName} chez ${context.customerName}, sur le site ${context.siteLabel}.`,
        equipment
          ? `Équipement concerné : ${equipmentLabel}${equipment.model ? ` (${equipment.model})` : ""}.`
          : null,
        open === 0
          ? "Aucune anomalie n'a été relevée."
          : `${open} anomalie${open > 1 ? "s ont" : " a"} été relevée${open > 1 ? "s" : ""}.`,
      ]),

      workDone: notes.length
        ? notes.join("\n")
        : "Aucune opération n'a été détaillée dans les notes du technicien.",

      equipmentState: equipment
        ? `${equipmentLabel} contrôlé lors de l'intervention. Se reporter aux anomalies ci-dessous pour les points de vigilance.`
        : "État de l'installation non détaillé.",

      anomaliesSummary:
        open === 0
          ? "Aucune anomalie constatée lors de cette intervention."
          : context.anomalies
              .map(
                (a) =>
                  `• ${a.title} (gravité : ${a.severity})${a.description ? ` — ${a.description}` : ""}`,
              )
              .join("\n"),

      recommendations:
        open === 0
          ? "Poursuivre l'utilisation habituelle de l'appareil et respecter la périodicité d'entretien."
          : context.anomalies
              .filter((a) => a.recommendation)
              .map((a) => `• ${a.recommendation}`)
              .join("\n") || "Se reporter aux anomalies constatées.",

      futureWork:
        open === 0
          ? ""
          : "Reprise des points signalés avant la prochaine saison de chauffe.",

      provider: "mock",
      model: null,
    };
  },
};

export const mockTranscription: TranscriptionProvider = {
  name: "mock",
  configured: true,

  async transcribe(): Promise<TranscriptionResult> {
    // Volontairement explicite : un texte qui ressemblerait à une vraie
    // transcription serait recopié tel quel dans un rapport client par
    // quelqu'un qui n'aurait pas lu la configuration.
    return {
      text: "[Transcription indisponible — aucun service de reconnaissance vocale n'est configuré. Réécoutez l'enregistrement et saisissez le texte ici.]",
      provider: "mock",
    };
  },
};
