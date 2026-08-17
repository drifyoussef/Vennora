import "server-only";
import type { Prisma } from "@/generated/prisma";
import { InterventionStatus } from "@/core/enums";
import { NotFoundError } from "../errors";
import { escapeSearch } from "../schemas";
import { addMonths } from "@/lib/format";
import type { AppContext } from "../context";

const PAGE_SIZE = 30;

function searchFilter(q: string): Prisma.EquipmentWhereInput {
  const like = { contains: escapeSearch(q), mode: "insensitive" as const };
  return {
    OR: [
      { label: like },
      { brand: like },
      { model: like },
      { serialNumber: like },
      { location: like },
      { site: { name: like } },
      { site: { city: like } },
      { site: { address: like } },
      { site: { customer: { name: like } } },
    ],
  };
}

export async function listEquipment(
  { db }: AppContext,
  options: {
    q?: string;
    page?: number;
    siteId?: string;
    typeId?: string;
    /** Uniquement les équipements dont l'échéance est passée. */
    overdue?: boolean;
  } = {},
) {
  const page = options.page ?? 1;
  const where: Prisma.EquipmentWhereInput = {
    active: true,
    ...(options.q ? searchFilter(options.q) : {}),
    ...(options.siteId ? { siteId: options.siteId } : {}),
    ...(options.typeId ? { typeId: options.typeId } : {}),
    ...(options.overdue ? { nextDueAt: { lt: new Date() } } : {}),
  };

  const [items, total] = await Promise.all([
    db.equipment.findMany({
      where,
      orderBy: [{ nextDueAt: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        label: true,
        brand: true,
        model: true,
        location: true,
        serialNumber: true,
        lastInterventionAt: true,
        nextDueAt: true,
        type: { select: { id: true, label: true, icon: true } },
        site: {
          select: {
            id: true,
            name: true,
            city: true,
            customer: { select: { id: true, name: true } },
          },
        },
        _count: { select: { interventions: true } },
      },
    }),
    db.equipment.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type EquipmentListItem = Awaited<
  ReturnType<typeof listEquipment>
>["items"][number];

/**
 * Fiche équipement, avec tout son historique.
 *
 * C'est l'écran qui fait la valeur de Vennora : on veut voir d'un coup d'œil
 * ce qui s'est passé sur cet appareil depuis son installation, année par
 * année, anomalies comprises. On charge donc l'historique complet, pas une
 * page de dix lignes.
 */
export async function getEquipment({ db }: AppContext, id: string) {
  const equipment = await db.equipment.findFirst({
    where: { id },
    select: {
      id: true,
      label: true,
      brand: true,
      model: true,
      serialNumber: true,
      location: true,
      installedAt: true,
      description: true,
      notes: true,
      qrToken: true,
      active: true,
      createdAt: true,
      lastInterventionAt: true,
      nextDueAt: true,
      type: {
        select: {
          id: true,
          label: true,
          icon: true,
          defaultIntervalMonths: true,
        },
      },
      site: {
        select: {
          id: true,
          name: true,
          address: true,
          addressComplement: true,
          postalCode: true,
          city: true,
          accessNotes: true,
          customer: {
            select: { id: true, name: true, phone: true, email: true },
          },
        },
      },
    },
  });

  if (!equipment) throw new NotFoundError("Équipement");

  const [interventions, openAnomalies] = await Promise.all([
    db.intervention.findMany({
      where: { equipmentId: id },
      orderBy: { scheduledStart: "desc" },
      select: {
        id: true,
        reference: true,
        scheduledStart: true,
        completedAt: true,
        status: true,
        notes: true,
        type: { select: { label: true, colorHex: true } },
        technician: {
          select: { firstName: true, lastName: true, colorHex: true },
        },
        anomalies: {
          orderBy: { severity: "desc" },
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
            recommendation: true,
          },
        },
        report: {
          select: { id: true, pdfKey: true, validatedAt: true, summary: true },
        },
        _count: { select: { photos: true } },
      },
    }),
    db.anomaly.count({ where: { equipmentId: id, status: "OPEN" } }),
  ]);

  return { ...equipment, interventions, openAnomalies };
}

export type EquipmentDetail = Awaited<ReturnType<typeof getEquipment>>;

/** Résout un QR code vers l'équipement, dans le tenant courant seulement. */
export async function findEquipmentByQrToken(
  { db }: AppContext,
  token: string,
) {
  return db.equipment.findFirst({
    where: { qrToken: token },
    select: { id: true },
  });
}

/**
 * Recalcule dernière intervention et prochaine échéance.
 *
 * L'échéance suit la périodicité du type d'équipement (12 mois pour le
 * ramonage), sauf si la dernière intervention a fixé explicitement une date.
 */
export async function refreshEquipmentDates(
  { db }: AppContext,
  equipmentId: string,
): Promise<void> {
  const equipment = await db.equipment.findFirst({
    where: { id: equipmentId },
    select: { id: true, type: { select: { defaultIntervalMonths: true } } },
  });
  if (!equipment) return;

  const last = await db.intervention.findFirst({
    where: { equipmentId, status: InterventionStatus.COMPLETED },
    orderBy: { scheduledStart: "desc" },
    select: { scheduledStart: true, nextInterventionAt: true },
  });

  const interval = equipment.type.defaultIntervalMonths;
  const nextDueAt = last
    ? (last.nextInterventionAt ??
      (interval ? addMonths(last.scheduledStart, interval) : null))
    : null;

  await db.equipment.update({
    where: { id: equipmentId },
    data: {
      lastInterventionAt: last?.scheduledStart ?? null,
      nextDueAt,
    },
  });
}
