/**
 * Contrats des services d'assistance à la rédaction.
 *
 * Deux capacités distinctes, deux fournisseurs distincts : Anthropic ne fait
 * pas de reconnaissance vocale, il faut un service dédié pour transcrire. Les
 * deux sont derrière une interface avec implémentation simulée, pour que
 * l'application tourne sans aucune clé.
 */

export interface TranscriptionInput {
  audio: Buffer;
  mimeType: string;
  /** Indice de langue, ISO 639-1. Le vocabulaire métier est français. */
  language?: string;
  /** Termes rares à privilégier : marques, mots du métier. */
  vocabulary?: string[];
}

export interface TranscriptionResult {
  text: string;
  /** Nom du fournisseur, journalisé pour tracer d'où vient un texte. */
  provider: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  /** `false` quand aucune clé n'est configurée : l'interface le dit alors. */
  readonly configured: boolean;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

/** Les six sections du compte-rendu, telles que déclarées par le vertical. */
export interface ReportSections {
  summary: string;
  workDone: string;
  equipmentState: string;
  anomaliesSummary: string;
  recommendations: string;
  futureWork: string;
}

export interface ReportContext {
  tradeName: string;
  interventionType: string;
  interventionDate: string;
  technicianName: string;
  customerName: string;
  siteLabel: string;
  equipment: {
    label: string;
    type: string;
    brand: string | null;
    model: string | null;
    installedAt: string | null;
  } | null;
  /** Historique récent : ce qui a été constaté les fois précédentes. */
  previousFindings: string[];
  anomalies: Array<{
    title: string;
    description: string | null;
    severity: string;
    recommendation: string | null;
  }>;
  photoCaptions: string[];
  /** Notes clavier et transcriptions vocales, dans l'ordre de saisie. */
  rawNotes: string[];
  /** Consignes de rédaction, une par section, issues du vertical. */
  sectionHints: Array<{ key: keyof ReportSections; label: string; hint: string }>;
}

export interface ReportGeneration extends ReportSections {
  provider: string;
  model: string | null;
}

export interface ReportGenerator {
  readonly name: string;
  readonly configured: boolean;
  generate(context: ReportContext): Promise<ReportGeneration>;
}
