import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestOrg,
  destroyTestOrg,
  prisma,
  seedChain,
  type TestOrg,
} from "./fixtures";

/**
 * Isolation multi-tenant.
 *
 * C'est la garantie la plus coûteuse à perdre : une fuite ici expose les
 * clients d'une entreprise à une autre. Les tests attaquent le client scopé
 * avec des identifiants valides mais appartenant à l'organisation voisine —
 * exactement ce que produirait un identifiant deviné ou recopié.
 */
describe("isolation multi-tenant", () => {
  let a: TestOrg;
  let b: TestOrg;
  let chainA: Awaited<ReturnType<typeof seedChain>>;

  beforeAll(async () => {
    a = await createTestOrg("orga");
    b = await createTestOrg("orgb");
    chainA = await seedChain(a);
    await seedChain(b);
  });

  afterAll(async () => {
    await destroyTestOrg(a);
    await destroyTestOrg(b);
    await prisma.$disconnect();
  });

  it("ne liste que les clients de son organisation", async () => {
    const fromA = await a.admin.db.customer.findMany({ select: { id: true } });
    const fromB = await b.admin.db.customer.findMany({ select: { id: true } });

    expect(fromA).toHaveLength(1);
    expect(fromB).toHaveLength(1);
    expect(fromA[0].id).not.toBe(fromB[0].id);
  });

  it("rend introuvable un client d'une autre organisation, identifiant en main", async () => {
    const found = await b.admin.db.customer.findFirst({
      where: { id: chainA.customer.id },
    });
    expect(found).toBeNull();
  });

  it("refuse de modifier une intervention d'une autre organisation", async () => {
    const result = await b.admin.db.intervention.updateMany({
      where: { id: chainA.intervention.id },
      data: { notes: "injection" },
    });
    expect(result.count).toBe(0);

    const untouched = await prisma.intervention.findUniqueOrThrow({
      where: { id: chainA.intervention.id },
      select: { notes: true },
    });
    expect(untouched.notes).toBeNull();
  });

  it("refuse de supprimer les données d'une autre organisation", async () => {
    const result = await b.admin.db.equipment.deleteMany({
      where: { id: chainA.equipment.id },
    });
    expect(result.count).toBe(0);
    expect(
      await prisma.equipment.findUnique({ where: { id: chainA.equipment.id } }),
    ).not.toBeNull();
  });

  it("écrase un orgId falsifié à la création plutôt que de lui obéir", async () => {
    // Le scénario réel : une Server Action dont le payload contient l'orgId
    // d'une autre entreprise. L'extension doit imposer celui du contexte.
    const created = await b.admin.db.customer.create({
      data: {
        orgId: a.id, // valeur hostile
        kind: "INDIVIDUAL",
        name: "Tentative",
        lastName: "Tentative",
        phone: "0600000000",
      },
      select: { id: true, orgId: true },
    });

    expect(created.orgId).toBe(b.id);
    expect(created.orgId).not.toBe(a.id);
  });

  it("ne résout pas un QR code appartenant à une autre organisation", async () => {
    const equipment = await prisma.equipment.findUniqueOrThrow({
      where: { id: chainA.equipment.id },
      select: { qrToken: true },
    });

    const fromB = await b.technician.db.equipment.findFirst({
      where: { qrToken: equipment.qrToken },
    });
    expect(fromB).toBeNull();
  });

  it("compte à zéro les agrégats d'une autre organisation", async () => {
    const count = await b.admin.db.intervention.count({
      where: { id: chainA.intervention.id },
    });
    expect(count).toBe(0);
  });
});
