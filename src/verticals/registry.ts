import type { TradeDefinition, TradeSlug } from "./types";
import { ramonage } from "./ramonage";

/**
 * Registre des métiers connus de Vennora.
 *
 * Le MVP n'en active qu'un. Les huit autres sont déclarés (nom + couleur de
 * charte) mais sans catalogue : ils apparaissent dans le modèle de données et
 * dans la charte graphique, pas dans le produit. Les activer consistera à
 * écrire leur `TradeDefinition` complète, pas à modifier le cœur.
 */
const planned = (
  slug: TradeSlug,
  name: string,
  colorHex: string,
): TradeDefinition => ({
  slug,
  name,
  colorHex,
  active: false,
  vocabulary: {
    equipment: { singular: "Équipement", plural: "Équipements" },
    intervention: { singular: "Intervention", plural: "Interventions" },
  },
  equipmentTypes: [],
  interventionTypes: [],
  reportSections: ramonage.reportSections,
});

export const TRADES: Record<TradeSlug, TradeDefinition> = {
  ramonage,
  chauffage: planned("chauffage", "Chauffage", "#E2610F"),
  climatisation: planned("climatisation", "Climatisation", "#4FA8C7"),
  incendie: planned("incendie", "Incendie", "#C8102E"),
  "portes-automatiques": planned(
    "portes-automatiques",
    "Portes automatiques",
    "#7D8A93",
  ),
  "cuisine-professionnelle": planned(
    "cuisine-professionnelle",
    "Cuisine professionnelle",
    "#C9A227",
  ),
  piscine: planned("piscine", "Piscine", "#00A0A8"),
  nuisibles: planned("nuisibles", "Nuisibles", "#4F7B45"),
  "traitement-eau": planned("traitement-eau", "Traitement de l'eau", "#1E7FB8"),
};

export const ACTIVE_TRADES = Object.values(TRADES).filter((t) => t.active);

export function getTrade(slug: string): TradeDefinition {
  const trade = TRADES[slug as TradeSlug];
  if (!trade) {
    throw new Error(`Métier inconnu : « ${slug} »`);
  }
  return trade;
}

export type { TradeDefinition, TradeSlug } from "./types";
