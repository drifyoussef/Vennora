import "server-only";
import type { Prisma } from "@/generated/prisma";
import { NotFoundError } from "../errors";
import { escapeSearch } from "../schemas";
import type { AppContext } from "../context";

const PAGE_SIZE = 25;

function searchFilter(q: string): Prisma.SiteWhereInput {
  const like = { contains: escapeSearch(q), mode: "insensitive" as const };
  return {
    OR: [
      { name: like },
      { address: like },
      { city: like },
      { postalCode: like },
      { customer: { name: like } },
    ],
  };
}

export async function listSites(
  { db }: AppContext,
  options: { q?: string; page?: number; customerId?: string } = {},
) {
  const page = options.page ?? 1;
  const where: Prisma.SiteWhereInput = {
    ...(options.q ? searchFilter(options.q) : {}),
    ...(options.customerId ? { customerId: options.customerId } : {}),
  };

  const [items, total] = await Promise.all([
    db.site.findMany({
      where,
      orderBy: [{ city: "asc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        address: true,
        addressComplement: true,
        postalCode: true,
        city: true,
        customer: { select: { id: true, name: true } },
        _count: { select: { equipments: true, interventions: true } },
      },
    }),
    db.site.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getSite({ db }: AppContext, id: string) {
  const site = await db.site.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      addressComplement: true,
      postalCode: true,
      city: true,
      latitude: true,
      longitude: true,
      notes: true,
      accessNotes: true,
      createdAt: true,
      customer: {
        select: { id: true, name: true, phone: true, email: true },
      },
      equipments: {
        orderBy: [{ active: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          label: true,
          brand: true,
          model: true,
          serialNumber: true,
          location: true,
          active: true,
          installedAt: true,
          lastInterventionAt: true,
          nextDueAt: true,
          type: { select: { label: true, icon: true } },
          _count: { select: { interventions: true } },
        },
      },
    },
  });

  if (!site) throw new NotFoundError("Site");

  const interventions = await db.intervention.findMany({
    where: { siteId: id },
    orderBy: { scheduledStart: "desc" },
    take: 20,
    select: {
      id: true,
      reference: true,
      scheduledStart: true,
      status: true,
      type: { select: { label: true, colorHex: true } },
      equipment: {
        select: { id: true, label: true, type: { select: { label: true } } },
      },
      technician: { select: { firstName: true, lastName: true, colorHex: true } },
    },
  });

  return { ...site, interventions };
}

export type SiteDetail = Awaited<ReturnType<typeof getSite>>;
