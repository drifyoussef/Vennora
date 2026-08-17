import "server-only";
import { InterventionStatus, AnomalyStatus, UserRole } from "@/core/enums";
import { endOfDay, endOfWeek, startOfDay, startOfWeek } from "@/lib/format";
import type { AppContext } from "../context";

/**
 * Chiffres du tableau de bord.
 *
 * Un technicien voit sa propre journée, un administrateur voit celle de
 * l'entreprise : ce n'est pas une question de droits mais d'utilité — un
 * technicien qui voit « 27 interventions aujourd'hui » n'apprend rien.
 */
export async function getDashboard({ db, user }: AppContext) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const mine =
    user.role === UserRole.TECHNICIAN ? { technicianId: user.id } : {};

  const [
    todayPlanned,
    todayInProgress,
    todayCompleted,
    todayCancelled,
    weekCount,
    customerCount,
    equipmentCount,
    openAnomalies,
    criticalAnomalies,
    todayList,
    upcoming,
  ] = await Promise.all([
    db.intervention.count({
      where: {
        ...mine,
        scheduledStart: { gte: dayStart, lte: dayEnd },
        status: InterventionStatus.PLANNED,
      },
    }),
    db.intervention.count({
      where: {
        ...mine,
        scheduledStart: { gte: dayStart, lte: dayEnd },
        status: InterventionStatus.IN_PROGRESS,
      },
    }),
    db.intervention.count({
      where: {
        ...mine,
        scheduledStart: { gte: dayStart, lte: dayEnd },
        status: InterventionStatus.COMPLETED,
      },
    }),
    db.intervention.count({
      where: {
        ...mine,
        scheduledStart: { gte: dayStart, lte: dayEnd },
        status: InterventionStatus.CANCELLED,
      },
    }),
    db.intervention.count({
      where: {
        ...mine,
        scheduledStart: { gte: weekStart, lte: weekEnd },
        status: { not: InterventionStatus.CANCELLED },
      },
    }),
    db.customer.count(),
    db.equipment.count({ where: { active: true } }),
    db.anomaly.count({ where: { status: AnomalyStatus.OPEN } }),
    db.anomaly.count({
      where: { status: AnomalyStatus.OPEN, severity: { in: ["HIGH", "CRITICAL"] } },
    }),
    db.intervention.findMany({
      where: {
        ...mine,
        scheduledStart: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { scheduledStart: "asc" },
      select: interventionCardSelect,
    }),
    db.intervention.findMany({
      where: {
        ...mine,
        scheduledStart: { gt: dayEnd },
        status: InterventionStatus.PLANNED,
      },
      orderBy: { scheduledStart: "asc" },
      take: 5,
      select: interventionCardSelect,
    }),
  ]);

  return {
    today: {
      total: todayPlanned + todayInProgress + todayCompleted + todayCancelled,
      planned: todayPlanned,
      inProgress: todayInProgress,
      completed: todayCompleted,
      cancelled: todayCancelled,
      list: todayList,
    },
    weekCount,
    customerCount,
    equipmentCount,
    openAnomalies,
    criticalAnomalies,
    upcoming,
  };
}

/**
 * Projection commune à toutes les listes d'interventions : assez pour
 * afficher une carte complète, rien de plus. Aucun `include` complet, qui
 * ramènerait notes internes et champs de rapport sur une vue de liste.
 */
export const interventionCardSelect = {
  id: true,
  reference: true,
  scheduledStart: true,
  scheduledEnd: true,
  status: true,
  customer: { select: { id: true, name: true, phone: true } },
  site: {
    select: {
      id: true,
      name: true,
      address: true,
      postalCode: true,
      city: true,
    },
  },
  equipment: {
    select: {
      id: true,
      label: true,
      brand: true,
      model: true,
      type: { select: { label: true } },
    },
  },
  technician: {
    select: { id: true, firstName: true, lastName: true, colorHex: true },
  },
  type: { select: { label: true, colorHex: true } },
  _count: { select: { anomalies: true, photos: true } },
} as const;

export type InterventionCard = Awaited<
  ReturnType<typeof getDashboard>
>["today"]["list"][number];
