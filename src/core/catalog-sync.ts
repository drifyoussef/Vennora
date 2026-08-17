import type { PrismaClient } from "@/generated/prisma";
import { TRADES } from "@/verticals/registry";
import type { TradeDefinition } from "@/verticals/types";

/**
 * Projection du registre des métiers vers la base.
 *
 * Les catalogues (types d'équipement, types d'intervention) sont déclarés en
 * code — c'est là qu'ils sont relus et versionnés — mais stockés en base pour
 * que les interventions déjà enregistrées gardent une référence stable même
 * si un type disparaît du registre.
 *
 * Idempotent : à relancer après chaque évolution d'un vertical. Les types
 * absents du registre sont désactivés, jamais supprimés.
 *
 * Ce module reçoit le client en paramètre et n'importe pas `server-only` :
 * il doit rester exécutable depuis un script de seed hors runtime Next.
 */
export async function syncTradeCatalogs(prisma: PrismaClient): Promise<void> {
  for (const trade of Object.values(TRADES) as TradeDefinition[]) {
    const record = await prisma.trade.upsert({
      where: { slug: trade.slug },
      create: {
        slug: trade.slug,
        name: trade.name,
        colorHex: trade.colorHex,
        active: trade.active,
      },
      update: {
        name: trade.name,
        colorHex: trade.colorHex,
        active: trade.active,
      },
      select: { id: true },
    });

    for (const type of trade.equipmentTypes) {
      await prisma.equipmentType.upsert({
        where: { tradeId_code: { tradeId: record.id, code: type.code } },
        create: {
          tradeId: record.id,
          code: type.code,
          label: type.label,
          icon: type.icon,
          defaultIntervalMonths: type.defaultIntervalMonths ?? null,
          sortOrder: type.sortOrder,
          active: true,
        },
        update: {
          label: type.label,
          icon: type.icon,
          defaultIntervalMonths: type.defaultIntervalMonths ?? null,
          sortOrder: type.sortOrder,
          active: true,
        },
      });
    }

    for (const type of trade.interventionTypes) {
      await prisma.interventionType.upsert({
        where: { tradeId_code: { tradeId: record.id, code: type.code } },
        create: {
          tradeId: record.id,
          code: type.code,
          label: type.label,
          colorHex: type.colorHex,
          defaultDurationMin: type.defaultDurationMin,
          recurrenceMonths: type.recurrenceMonths ?? null,
          sortOrder: type.sortOrder,
          active: true,
        },
        update: {
          label: type.label,
          colorHex: type.colorHex,
          defaultDurationMin: type.defaultDurationMin,
          recurrenceMonths: type.recurrenceMonths ?? null,
          sortOrder: type.sortOrder,
          active: true,
        },
      });
    }

    const keptEquipment = trade.equipmentTypes.map((t) => t.code);
    const keptIntervention = trade.interventionTypes.map((t) => t.code);

    if (keptEquipment.length > 0) {
      await prisma.equipmentType.updateMany({
        where: { tradeId: record.id, code: { notIn: keptEquipment } },
        data: { active: false },
      });
    }
    if (keptIntervention.length > 0) {
      await prisma.interventionType.updateMany({
        where: { tradeId: record.id, code: { notIn: keptIntervention } },
        data: { active: false },
      });
    }
  }
}
