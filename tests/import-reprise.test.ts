import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyserImport, reprendreClients } from "@/core/import/customers";
import { lireCsv } from "@/lib/csv";
import { createTestOrg, destroyTestOrg, prisma, type TestOrg } from "./fixtures";

/**
 * Reprise d'un fichier clients, contre une vraie organisation.
 *
 * Le fichier d'essai reprend ce qu'un tableur français produit réellement :
 * point-virgule, en-têtes accentués, une ligne sans nom, une adresse
 * incomplète, et un doublon.
 */
const FICHIER = [
  "Nom;Prénom;Téléphone;E-mail;Adresse;Code postal;Ville;Type",
  "Dupont;Jean;0466524018;jean.dupont@exemple.fr;12 rue des Lilas;30100;Alès;particulier",
  "Boulangerie Marchand;;0466612233;;3 place du Marché;30140;Anduze;entreprise",
  "Fabre;Marie;;;;;;particulier",
  ";;;;7 rue Haute;30100;Alès;",
  "Dupont;Jean;0466524018;;12 rue des Lilas;30100;Alès;particulier",
].join("\n");

function analyser() {
  const { entetes, lignes } = lireCsv(FICHIER);
  return analyserImport(lignes, entetes);
}

describe("reprise d'un fichier clients", () => {
  let org: TestOrg;

  beforeAll(async () => {
    org = await createTestOrg("import");
  });

  afterAll(async () => {
    await destroyTestOrg(org);
  });

  it("crée les clients, et un site quand l'adresse est complète", async () => {
    const resultat = await reprendreClients(org.admin, analyser());

    // Quatre fiches nommées, dont un doublon interne écarté à l'écriture.
    expect(resultat.clientsCrees).toBe(3);
    // Marie Fabre n'a pas d'adresse : client sans site.
    expect(resultat.sitesCrees).toBe(2);
    expect(resultat.rejetes).toBe(1); // la ligne sans nom

    const clients = await prisma.customer.findMany({
      where: { orgId: org.id },
      select: { name: true, kind: true, city: true, sites: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    expect(clients.map((c) => c.name)).toEqual([
      "Boulangerie Marchand",
      "Dupont Jean",
      "Fabre Marie",
    ]);
    expect(clients[0].kind).toBe("COMPANY");
    expect(clients[0].sites[0].name).toBe("Établissement principal");
    expect(clients[2].sites).toHaveLength(0);
  });

  it("relancé sur le même fichier, n'ajoute rien", async () => {
    const resultat = await reprendreClients(org.admin, analyser());

    expect(resultat.clientsCrees).toBe(0);
    expect(resultat.ignores).toBe(4);

    const total = await prisma.customer.count({ where: { orgId: org.id } });
    expect(total).toBe(3);
  });

  it("n'écrit rien dans une autre organisation", async () => {
    const voisine = await createTestOrg("import-voisine");
    try {
      const avant = await prisma.customer.count({ where: { orgId: voisine.id } });
      await reprendreClients(org.admin, analyser());
      const apres = await prisma.customer.count({ where: { orgId: voisine.id } });
      expect(apres).toBe(avant);
    } finally {
      await destroyTestOrg(voisine);
    }
  });
});
