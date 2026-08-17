/**
 * Contrat d'un métier (vertical).
 *
 * Le cœur applicatif (clients, sites, équipements, interventions, rapports)
 * est identique pour tous les métiers. Ce qui change d'un métier à l'autre —
 * le vocabulaire, le catalogue d'équipements, les types d'intervention, les
 * périodicités réglementaires, les sections du compte-rendu — est déclaré
 * ici et uniquement ici.
 *
 * Ajouter « chauffage » = ajouter un fichier dans src/verticals/chauffage/,
 * l'enregistrer dans le registre, et lancer la synchronisation des
 * catalogues. Aucune modification de src/core ni de src/app.
 */

export type TradeSlug =
  | "ramonage"
  | "chauffage"
  | "climatisation"
  | "incendie"
  | "portes-automatiques"
  | "cuisine-professionnelle"
  | "piscine"
  | "nuisibles"
  | "traitement-eau";

export interface EquipmentTypeDefinition {
  /** Code stable, jamais traduit, jamais renommé : sert de clé métier. */
  code: string;
  label: string;
  /** Nom d'icône lucide-react. */
  icon?: string;
  /** Périodicité conseillée entre deux interventions, en mois. */
  defaultIntervalMonths?: number;
  sortOrder: number;
}

export interface InterventionTypeDefinition {
  code: string;
  label: string;
  colorHex: string;
  defaultDurationMin: number;
  /** Délai avant la prochaine intervention du même type, en mois. */
  recurrenceMonths?: number;
  sortOrder: number;
}

export interface TradeDefinition {
  slug: TradeSlug;
  name: string;
  /** Couleur du métier, issue de la charte Vennora. */
  colorHex: string;
  /** Le MVP n'active que le ramonage. */
  active: boolean;

  /** Vocabulaire affiché dans l'interface pour ce métier. */
  vocabulary: {
    /** « équipement », « installation », « appareil »… */
    equipment: { singular: string; plural: string };
    intervention: { singular: string; plural: string };
  };

  equipmentTypes: EquipmentTypeDefinition[];
  interventionTypes: InterventionTypeDefinition[];

  /**
   * Sections du compte-rendu, dans l'ordre d'affichage et d'impression.
   * La clé correspond à un champ du modèle `Report`.
   */
  reportSections: Array<{
    key:
      | "summary"
      | "workDone"
      | "equipmentState"
      | "anomaliesSummary"
      | "recommendations"
      | "futureWork";
    label: string;
    /** Consigne donnée au modèle lors de la génération assistée (P4). */
    hint: string;
    required: boolean;
  }>;
}
