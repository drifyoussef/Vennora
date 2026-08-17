import { PrismaClient } from "@/generated/prisma";
import { tenantDb, type TenantContext } from "@/core/tenant";
import type { AppContext } from "@/core/context";
import { UserRole } from "@/core/enums";

/**
 * Organisations jetables pour les tests.
 *
 * Chaque suite crée les siennes et les efface après : les tests tournent
 * contre la vraie base, donc ils ne doivent jamais s'appuyer sur — ni abîmer —
 * le jeu de démonstration.
 */
export const prisma = new PrismaClient();

export interface TestOrg {
  id: string;
  slug: string;
  adminId: string;
  technicianId: string;
  otherTechnicianId: string;
  admin: AppContext;
  technician: AppContext;
  /** Un second technicien, pour vérifier le cloisonnement entre pairs. */
  otherTechnician: AppContext;
}

function contextFor(
  orgId: string,
  userId: string,
  role: UserRole,
  tradeSlug: string,
): AppContext {
  const ctx: TenantContext = { orgId, userId, role };
  return {
    ctx,
    db: tenantDb(ctx),
    user: {
      id: userId,
      orgId,
      role,
      firstName: "Test",
      lastName: role,
      fullName: `Test ${role}`,
      email: `${userId}@test.local`,
      colorHex: null,
      org: {
        id: orgId,
        name: "Organisation de test",
        logoKey: null,
        tradeSlug,
        tradeName: "Ramonage",
      },
    },
  };
}

export async function createTestOrg(label: string): Promise<TestOrg> {
  const trade = await prisma.trade.findUniqueOrThrow({
    where: { slug: "ramonage" },
    select: { id: true, slug: true },
  });

  const slug = `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: { name: `Test ${label}`, slug, tradeId: trade.id },
    select: { id: true },
  });

  const make = (role: UserRole, suffix: string) =>
    prisma.user.create({
      data: {
        orgId: org.id,
        firstName: "Test",
        lastName: suffix,
        email: `${slug}-${suffix}@test.local`,
        passwordHash: "x".repeat(60),
        role,
      },
      select: { id: true },
    });

  const admin = await make(UserRole.ADMIN, "admin");
  const technician = await make(UserRole.TECHNICIAN, "tech");
  const other = await make(UserRole.TECHNICIAN, "tech2");

  return {
    id: org.id,
    slug,
    adminId: admin.id,
    technicianId: technician.id,
    otherTechnicianId: other.id,
    admin: contextFor(org.id, admin.id, UserRole.ADMIN, trade.slug),
    technician: contextFor(org.id, technician.id, UserRole.TECHNICIAN, trade.slug),
    otherTechnician: contextFor(org.id, other.id, UserRole.TECHNICIAN, trade.slug),
  };
}

export async function destroyTestOrg(org: TestOrg): Promise<void> {
  const orgId = org.id;
  // Ordre inverse des dépendances : MongoDB n'a pas de cascade.
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.reminder.deleteMany({ where: { orgId } });
  await prisma.document.deleteMany({ where: { orgId } });
  await prisma.signature.deleteMany({ where: { orgId } });
  await prisma.report.deleteMany({ where: { orgId } });
  await prisma.interventionPhoto.deleteMany({ where: { orgId } });
  await prisma.voiceNote.deleteMany({ where: { orgId } });
  await prisma.anomaly.deleteMany({ where: { orgId } });
  await prisma.intervention.deleteMany({ where: { orgId } });
  await prisma.equipment.deleteMany({ where: { orgId } });
  await prisma.site.deleteMany({ where: { orgId } });
  await prisma.customer.deleteMany({ where: { orgId } });
  await prisma.counter.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
}

/** Client → site → équipement → intervention, l'ossature de tout test métier. */
export async function seedChain(
  org: TestOrg,
  options: { technicianId?: string; status?: "PLANNED" | "IN_PROGRESS" } = {},
) {
  const db = org.admin.db;

  const customer = await db.customer.create({
    data: {
      orgId: org.id,
      kind: "INDIVIDUAL",
      name: "Dupont Jean",
      lastName: "Dupont",
      firstName: "Jean",
      email: "jean@test.local",
      phone: "0466521874",
    },
    select: { id: true },
  });

  const site = await db.site.create({
    data: {
      orgId: org.id,
      customerId: customer.id,
      name: "Maison principale",
      address: "12 rue Victor Hugo",
      postalCode: "30100",
      city: "Alès",
    },
    select: { id: true },
  });

  const type = await prisma.equipmentType.findFirstOrThrow({
    where: { code: "POELE_GRANULES", trade: { slug: "ramonage" } },
    select: { id: true },
  });

  const equipment = await db.equipment.create({
    data: {
      orgId: org.id,
      siteId: site.id,
      typeId: type.id,
      label: "Poêle à granulés",
      brand: "MCZ",
      qrToken: `test-${Math.random().toString(36).slice(2)}`,
    },
    select: { id: true, qrToken: true },
  });

  const interventionType = await prisma.interventionType.findFirstOrThrow({
    where: { code: "RAMONAGE", trade: { slug: "ramonage" } },
    select: { id: true },
  });

  const start = new Date();
  const intervention = await db.intervention.create({
    data: {
      orgId: org.id,
      reference: `TST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      customerId: customer.id,
      siteId: site.id,
      equipmentId: equipment.id,
      technicianId: options.technicianId ?? org.technicianId,
      typeId: interventionType.id,
      scheduledStart: start,
      scheduledEnd: new Date(start.getTime() + 3_600_000),
      status: options.status ?? "IN_PROGRESS",
    },
    select: { id: true, reference: true },
  });

  return { customer, site, equipment, intervention };
}

/** Fichiers minimaux mais authentiques : la validation lit les octets réels. */
export const bytes = {
  jpeg: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(600, 7)]),
  png: Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(400, 1),
  ]),
  webm: Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(400, 3)]),
  pdf: Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(400, 5)]),
  html: Buffer.from("<!doctype html><script>alert(1)</script>"),
  svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
};
