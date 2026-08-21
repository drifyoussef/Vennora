import "server-only";
import type { Prisma } from "@/generated/prisma";
import { InterventionStatus } from "@/core/enums";
import { NotFoundError } from "../errors";
import { escapeSearch } from "../schemas";
import type { AppContext } from "../context";

const PAGE_SIZE = 25;

/**
 * Recherche client : nom, téléphone, e-mail, ville et adresse des sites.
 *
 * Le ramoneur cherche presque toujours par téléphone (le client vient
 * d'appeler) ou par rue (il est devant la porte). Chercher uniquement par nom
 * rendrait la liste inutilisable sur le terrain.
 */
function searchFilter(q: string): Prisma.CustomerWhereInput {
  const safe = escapeSearch(q);
  const like = { contains: safe, mode: "insensitive" as const };
  const digits = q.replace(/\D/g, "");

  const or: Prisma.CustomerWhereInput[] = [
    { name: like },
    { companyName: like },
    { firstName: like },
    { lastName: like },
    { email: like },
    { city: like },
    { address: like },
    { sites: { some: { address: like } } },
    { sites: { some: { city: like } } },
  ];

  // Un numéro saisi « 0466521874 » doit trouver « 04 66 52 18 74 » : on
  // recherche sur les chiffres en insérant des séparateurs optionnels.
  if (digits.length >= 4) {
    or.push({
      phone: {
        contains: digits.split("").join("[\\s.\\-]*"),
        mode: "insensitive",
      },
    });
    or.push({ phone: like });
  }

  return { OR: or };
}

export async function listCustomers(
  { db }: AppContext,
  options: { q?: string; page?: number } = {},
) {
  const page = options.page ?? 1;
  const where: Prisma.CustomerWhereInput = options.q
    ? searchFilter(options.q)
    : {};

  const [items, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        kind: true,
        phone: true,
        email: true,
        city: true,
        lastInterventionAt: true,
        nextInterventionAt: true,
        _count: { select: { sites: true } },
      },
    }),
    db.customer.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
  };
}

export type CustomerListItem = Awaited<
  ReturnType<typeof listCustomers>
>["items"][number];

/** Fiche client complète : contact, sites, équipements, interventions. */
export async function getCustomer({ db }: AppContext, id: string) {
  const customer = await db.customer.findFirst({
    where: { id },
    select: {
      id: true,
      kind: true,
      name: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      phone: true,
      phoneSecondary: true,
      address: true,
      postalCode: true,
      city: true,
      notes: true,
      createdAt: true,
      lastInterventionAt: true,
      nextInterventionAt: true,
      sites: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          addressComplement: true,
          postalCode: true,
          city: true,
          accessNotes: true,
          _count: { select: { equipments: true } },
          equipments: {
            where: { active: true },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              label: true,
              brand: true,
              model: true,
              location: true,
              nextDueAt: true,
              lastInterventionAt: true,
              type: { select: { label: true, icon: true } },
            },
          },
        },
      },
    },
  });

  if (!customer) throw new NotFoundError("Client");

  const [interventions, documents, openAnomalies] = await Promise.all([
    db.intervention.findMany({
      where: { customerId: id },
      orderBy: { scheduledStart: "desc" },
      take: 30,
      select: {
        id: true,
        reference: true,
        scheduledStart: true,
        status: true,
        type: { select: { label: true, colorHex: true } },
        site: { select: { id: true, name: true } },
        equipment: { select: { id: true, label: true, type: { select: { label: true } } } },
        technician: {
          select: { firstName: true, lastName: true, colorHex: true },
        },
        _count: { select: { anomalies: true } },
      },
    }),
    db.document.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        name: true,
        category: true,
        sizeBytes: true,
        createdAt: true,
        // Nécessaire pour signer le lien de téléchargement côté serveur.
        storageKey: true,
      },
    }),
    db.anomaly.count({
      where: { status: "OPEN", intervention: { customerId: id } },
    }),
  ]);

  return { ...customer, interventions, documents, openAnomalies };
}

export type CustomerDetail = Awaited<ReturnType<typeof getCustomer>>;

/** Liste allégée pour les sélecteurs de formulaire. */
export async function listCustomerOptions({ db }: AppContext) {
  return db.customer.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sites: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          equipments: {
            where: { active: true },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              label: true,
              brand: true,
              location: true,
              type: { select: { label: true } },
            },
          },
        },
      },
    },
  });
}

export type CustomerOption = Awaited<
  ReturnType<typeof listCustomerOptions>
>[number];

/**
 * Rafraîchit les dates dérivées d'un client.
 *
 * Ces deux champs sont dénormalisés pour que la liste clients tienne en deux
 * requêtes au lieu d'un agrégat par ligne. Ils doivent être recalculés à
 * chaque création, déplacement ou clôture d'intervention.
 */
export async function refreshCustomerDates(
  { db }: AppContext,
  customerId: string,
): Promise<void> {
  const now = new Date();

  const [last, next] = await Promise.all([
    db.intervention.findFirst({
      where: { customerId, status: InterventionStatus.COMPLETED },
      orderBy: { scheduledStart: "desc" },
      select: { scheduledStart: true },
    }),
    db.intervention.findFirst({
      where: {
        customerId,
        status: { in: [InterventionStatus.PLANNED, InterventionStatus.IN_PROGRESS] },
        scheduledStart: { gte: now },
      },
      orderBy: { scheduledStart: "asc" },
      select: { scheduledStart: true },
    }),
  ]);

  await db.customer.update({
    where: { id: customerId },
    data: {
      lastInterventionAt: last?.scheduledStart ?? null,
      nextInterventionAt: next?.scheduledStart ?? null,
    },
  });
}
