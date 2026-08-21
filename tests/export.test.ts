import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construireExport } from "@/core/export/organisation";
import { lireCsv, decoderTexte } from "@/lib/csv";
import { createTestOrg, destroyTestOrg, seedChain, type TestOrg } from "./fixtures";

/**
 * Export complet, contre une vraie organisation.
 *
 * Ce qui est vérifié n'est pas « le fichier existe » mais « il ne contient
 * que les données de l'entreprise » : un export qui fuiterait chez le voisin
 * serait pire que pas d'export du tout.
 */
describe("export des données", () => {
  let org: TestOrg;
  let voisine: TestOrg;

  beforeAll(async () => {
    org = await createTestOrg("export");
    voisine = await createTestOrg("export-voisine");
    await seedChain(org);
    await seedChain(voisine);
  });

  afterAll(async () => {
    await destroyTestOrg(org);
    await destroyTestOrg(voisine);
  });

  it("produit les six tableaux et un fichier de lecture", async () => {
    const fichiers = await construireExport(org.admin);
    const chemins = fichiers.map((f) => f.chemin);

    expect(chemins).toEqual(
      expect.arrayContaining([
        "clients.csv",
        "sites.csv",
        "equipements.csv",
        "interventions.csv",
        "anomalies.csv",
        "comptes-rendus.csv",
        "lisez-moi.txt",
      ]),
    );
  });

  it("écrit des CSV relisibles, accents compris", async () => {
    const fichiers = await construireExport(org.admin);
    const clients = fichiers.find((f) => f.chemin === "clients.csv")!;
    const relu = lireCsv(
      decoderTexte(new TextEncoder().encode(clients.contenu as string)),
    );

    expect(relu.entetes).toContain("nom");
    expect(relu.lignes.length).toBeGreaterThan(0);
    expect(relu.lignes[0].nom).toBeTruthy();
  });

  it("ne laisse fuir aucune donnée de l'organisation voisine", async () => {
    const fichiers = await construireExport(org.admin);
    const tout = fichiers
      .filter((f) => typeof f.contenu === "string")
      .map((f) => f.contenu as string)
      .join("\n");

    // L'identifiant de l'organisation voisine ne doit apparaître nulle part,
    // pas plus que celui de ses utilisateurs.
    expect(tout).not.toContain(voisine.id);
    expect(tout).not.toContain(voisine.adminId);
  });
});
