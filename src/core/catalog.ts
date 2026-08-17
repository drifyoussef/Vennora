import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { syncTradeCatalogs as sync } from "./catalog-sync";

/** Voir `catalog-sync.ts`. Réexporté ici avec le client applicatif. */
export function syncTradeCatalogs() {
  return sync(prisma);
}

export interface CatalogEntry {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
}

export interface EquipmentTypeEntry extends CatalogEntry {
  icon: string | null;
  defaultIntervalMonths: number | null;
}

export interface InterventionTypeEntry extends CatalogEntry {
  colorHex: string;
  defaultDurationMin: number;
  recurrenceMonths: number | null;
}

/**
 * Catalogues actifs du métier. Mémoïsé par requête : la plupart des écrans en
 * ont besoin pour afficher un libellé, il serait absurde de relire la table à
 * chaque ligne de tableau.
 *
 * Ces tables ne portent pas d'`orgId` — ce sont des référentiels métier
 * partagés, pas des données d'entreprise — donc elles se lisent avec le
 * client racine.
 */
export const getEquipmentTypes = cache(
  async (tradeSlug: string): Promise<EquipmentTypeEntry[]> =>
    prisma.equipmentType.findMany({
      where: { trade: { slug: tradeSlug }, active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        id: true,
        code: true,
        label: true,
        icon: true,
        defaultIntervalMonths: true,
        sortOrder: true,
      },
    }),
);

export const getInterventionTypes = cache(
  async (tradeSlug: string): Promise<InterventionTypeEntry[]> =>
    prisma.interventionType.findMany({
      where: { trade: { slug: tradeSlug }, active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        id: true,
        code: true,
        label: true,
        colorHex: true,
        defaultDurationMin: true,
        recurrenceMonths: true,
        sortOrder: true,
      },
    }),
);
