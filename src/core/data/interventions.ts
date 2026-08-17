import "server-only";
import type { Prisma } from "@/generated/prisma";
import { InterventionStatus, UserRole } from "@/core/enums";
import { NotFoundError } from "../errors";
import { escapeSearch } from "../schemas";
import type { AppContext } from "../context";
import { interventionCardSelect } from "./dashboard";

const PAGE_SIZE = 30;

export interface InterventionFilters {
  q?: string;
  page?: number;
  status?: InterventionStatus;
  technicianId?: string;
  typeId?: string;
  customerId?: string;
  equipmentId?: string;
  from?: Date;
  to?: Date;
  /** Uniquement les interventions ayant relevé au moins une anomalie. */
  withAnomalies?: boolean;
}

function buildWhere(
  filters: InterventionFilters,
  user: AppContext["user"],
): Prisma.InterventionWhereInput {
  const where: Prisma.InterventionWhereInput = {};

  // Un technicien ne voit que ses interventions : c'est sa journée de travail,
  // pas le carnet de commandes de l'entreprise.
  if (user.role === UserRole.TECHNICIAN) {
    where.technicianId = user.id;
  } else if (filters.technicianId) {
    where.technicianId = filters.technicianId;
  }

  if (filters.status) where.status = filters.status;
  if (filters.typeId) where.typeId = filters.typeId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.equipmentId) where.equipmentId = filters.equipmentId;
  if (filters.withAnomalies) where.anomalies = { some: {} };

  if (filters.from || filters.to) {
    where.scheduledStart = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  if (filters.q) {
    const like = { contains: escapeSearch(filters.q), mode: "insensitive" as const };
    where.OR = [
      { reference: like },
      { customer: { name: like } },
      { site: { name: like } },
      { site: { address: like } },
      { site: { city: like } },
    ];
  }

  return where;
}

export async function listInterventions(
  { db, user }: AppContext,
  filters: InterventionFilters = {},
) {
  const page = filters.page ?? 1;
  const where = buildWhere(filters, user);

  const [items, total] = await Promise.all([
    db.intervention.findMany({
      where,
      orderBy: { scheduledStart: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: interventionCardSelect,
    }),
    db.intervention.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Interventions d'une plage de dates, pour le planning. Jamais paginé. */
export async function listPlanning(
  { db, user }: AppContext,
  from: Date,
  to: Date,
  technicianId?: string,
) {
  return db.intervention.findMany({
    where: buildWhere({ from, to, technicianId }, user),
    orderBy: { scheduledStart: "asc" },
    select: interventionCardSelect,
  });
}

export async function getIntervention({ db }: AppContext, id: string) {
  const intervention = await db.intervention.findFirst({
    where: { id },
    select: {
      id: true,
      reference: true,
      scheduledStart: true,
      scheduledEnd: true,
      startedAt: true,
      completedAt: true,
      status: true,
      notes: true,
      internalNotes: true,
      nextInterventionAt: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
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
        },
      },
      equipment: {
        select: {
          id: true,
          label: true,
          brand: true,
          model: true,
          serialNumber: true,
          location: true,
          type: { select: { label: true } },
        },
      },
      technician: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          colorHex: true,
          phone: true,
        },
      },
      type: {
        select: {
          id: true,
          label: true,
          colorHex: true,
          recurrenceMonths: true,
        },
      },
      anomalies: {
        orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          severity: true,
          status: true,
          recommendation: true,
          createdAt: true,
        },
      },
      report: {
        select: {
          id: true,
          summary: true,
          workDone: true,
          equipmentState: true,
          anomaliesSummary: true,
          recommendations: true,
          futureWork: true,
          origin: true,
          validatedAt: true,
          pdfKey: true,
          sentAt: true,
        },
      },
      signature: {
        select: { id: true, signerName: true, signedAt: true },
      },
      _count: { select: { photos: true, voiceNotes: true } },
    },
  });

  if (!intervention) throw new NotFoundError("Intervention");
  return intervention;
}

export type InterventionDetail = Awaited<ReturnType<typeof getIntervention>>;

/**
 * Numéro d'intervention lisible : INT-2026-0042.
 *
 * Le compteur est incrémenté par `$inc` MongoDB, atomique côté serveur : deux
 * interventions créées simultanément ne peuvent pas recevoir le même numéro.
 * L'`upsert` ne sert qu'à amorcer le compteur en début d'année.
 */
export async function nextReference(
  { db, ctx }: AppContext,
  date = new Date(),
): Promise<string> {
  const year = date.getFullYear();
  const key = `intervention:${year}`;

  const counter = await db.counter.upsert({
    where: { orgId_key: { orgId: ctx.orgId, key } },
    create: { orgId: ctx.orgId, key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return `INT-${year}-${String(counter.value).padStart(4, "0")}`;
}

/** Techniciens assignables, pour les sélecteurs de planning. */
export async function listTechnicians({ db }: AppContext) {
  return db.user.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      colorHex: true,
      role: true,
    },
  });
}
