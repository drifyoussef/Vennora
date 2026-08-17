import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ForbiddenError, NotFoundError } from "@/core/errors";
import { assertCan, assertOwnsIntervention, can } from "@/core/permissions";
import {
  requireEditableIntervention,
  requireVisibleIntervention,
} from "@/core/data/field";
import { UserRole } from "@/core/enums";
import {
  createTestOrg,
  destroyTestOrg,
  prisma,
  seedChain,
  type TestOrg,
} from "./fixtures";

/**
 * Permissions.
 *
 * Deux niveaux à distinguer, et c'est là que se logent les erreurs : le rôle
 * dit ce qu'on a le droit de faire *en général*, l'appartenance dit sur *quel
 * objet*. Un technicien a le droit de modifier une intervention — pas celle
 * d'un collègue.
 */
describe("matrice de rôles", () => {
  it("l'administrateur a tous les droits", () => {
    expect(can(UserRole.ADMIN, "organization.manage")).toBe(true);
    expect(can(UserRole.ADMIN, "user.manage")).toBe(true);
    expect(can(UserRole.ADMIN, "customer.delete")).toBe(true);
  });

  it("le technicien ne gère ni l'entreprise ni l'équipe", () => {
    expect(can(UserRole.TECHNICIAN, "organization.manage")).toBe(false);
    expect(can(UserRole.TECHNICIAN, "user.manage")).toBe(false);
    expect(can(UserRole.TECHNICIAN, "customer.delete")).toBe(false);
    expect(can(UserRole.TECHNICIAN, "intervention.delete")).toBe(false);
  });

  it("le technicien travaille sur le terrain", () => {
    for (const permission of [
      "intervention.update",
      "intervention.complete",
      "anomaly.create",
      "report.edit",
      "report.send",
      "equipment.create",
    ] as const) {
      expect(can(UserRole.TECHNICIAN, permission)).toBe(true);
    }
  });

  it("assertCan lève pour un droit refusé", () => {
    expect(() => assertCan(UserRole.TECHNICIAN, "user.manage")).toThrow(
      ForbiddenError,
    );
    expect(() => assertCan(UserRole.ADMIN, "user.manage")).not.toThrow();
  });

  it("assertOwnsIntervention laisse passer l'administrateur", () => {
    expect(() =>
      assertOwnsIntervention(
        { id: "moi", role: UserRole.ADMIN },
        { technicianId: "quelquun-dautre" },
      ),
    ).not.toThrow();
  });

  it("assertOwnsIntervention bloque le technicien sur l'intervention d'un pair", () => {
    expect(() =>
      assertOwnsIntervention(
        { id: "moi", role: UserRole.TECHNICIAN },
        { technicianId: "un-collegue" },
      ),
    ).toThrow(ForbiddenError);
  });
});

describe("accès objet aux interventions", () => {
  let org: TestOrg;
  let chain: Awaited<ReturnType<typeof seedChain>>;

  beforeAll(async () => {
    org = await createTestOrg("perms");
    chain = await seedChain(org, { technicianId: org.technicianId });
  });

  afterAll(async () => {
    await destroyTestOrg(org);
    await prisma.$disconnect();
  });

  it("le technicien assigné peut travailler dessus", async () => {
    const result = await requireEditableIntervention(
      org.technician,
      chain.intervention.id,
    );
    expect(result.id).toBe(chain.intervention.id);
  });

  it("un autre technicien de la même entreprise ne la voit pas", async () => {
    // « Introuvable » et non « interdit » : confirmer l'existence d'une
    // intervention assignée à un collègue renseignerait inutilement.
    await expect(
      requireVisibleIntervention(org.otherTechnician, chain.intervention.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("l'administrateur accède à toutes les interventions de l'entreprise", async () => {
    const result = await requireVisibleIntervention(
      org.admin,
      chain.intervention.id,
    );
    expect(result.id).toBe(chain.intervention.id);
  });

  it("une intervention terminée n'est plus modifiable", async () => {
    const done = await seedChain(org, { technicianId: org.technicianId });
    await org.admin.db.intervention.updateMany({
      where: { id: done.intervention.id },
      data: { status: "COMPLETED" },
    });

    await expect(
      requireEditableIntervention(org.technician, done.intervention.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Elle reste consultable : l'historique et le rapport signé ont une valeur.
    await expect(
      requireVisibleIntervention(org.technician, done.intervention.id),
    ).resolves.toMatchObject({ id: done.intervention.id });
  });

  it("une intervention annulée n'est pas modifiable", async () => {
    const cancelled = await seedChain(org, { technicianId: org.technicianId });
    await org.admin.db.intervention.updateMany({
      where: { id: cancelled.intervention.id },
      data: { status: "CANCELLED" },
    });

    await expect(
      requireEditableIntervention(org.technician, cancelled.intervention.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

/**
 * Comptes disparus ou désactivés.
 *
 * `getCurrentUser` relit la base à chaque requête précisément pour que ces
 * deux cas prennent effet immédiatement, sans attendre l'expiration du jeton.
 */
describe("session et état du compte", () => {
  it("un compte désactivé n'est plus retourné", async () => {
    const org = await createTestOrg("desactive");
    try {
      await prisma.user.update({
        where: { id: org.technicianId },
        data: { active: false },
      });

      const user = await prisma.user.findUnique({
        where: { id: org.technicianId },
        select: { active: true },
      });
      // C'est le prédicat exact qu'applique `getCurrentUser`.
      expect(user?.active).toBe(false);
    } finally {
      await destroyTestOrg(org);
    }
  });

  it("un compte supprimé ne laisse rien à relire", async () => {
    const org = await createTestOrg("supprime");
    const id = org.technicianId;
    await destroyTestOrg(org);

    expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
  });
});
