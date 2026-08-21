import { describe, expect, it } from "vitest";
import { analyserImport } from "@/core/import/customers";
import { lireCsv } from "@/lib/csv";
import { CustomerKind } from "@/core/enums";

function analyser(csv: string) {
  const { entetes, lignes } = lireCsv(csv);
  return analyserImport(lignes, entetes);
}

describe("reprise d'un fichier clients", () => {
  it("reconnaît les colonnes d'un tableur d'artisan", () => {
    const a = analyser(
      "Nom;Prénom;Téléphone;Adresse;CP;Ville\nDupont;Jean;0466524018;12 rue des Lilas;30100;Alès\n",
    );
    expect(a.rejetees).toHaveLength(0);
    expect(a.valides[0]).toMatchObject({
      nom: "Dupont Jean",
      phone: "0466524018",
      postalCode: "30100",
      city: "Alès",
      siteCreable: true,
    });
  });

  it("accepte d'autres intitulés pour les mêmes informations", () => {
    const a = analyser("Raison sociale,Courriel,Commune\nMartin SARL,contact@martin.fr,Anduze\n");
    expect(a.valides[0].nom).toBe("Martin SARL");
    expect(a.valides[0].email).toBe("contact@martin.fr");
    expect(a.valides[0].city).toBe("Anduze");
  });

  it("distingue une entreprise d'un particulier", () => {
    const a = analyser("nom;type\nSyndic du Parc;syndic\nDupont;particulier\n");
    expect(a.valides[0].kind).toBe(CustomerKind.COMPANY);
    expect(a.valides[1].kind).toBe(CustomerKind.INDIVIDUAL);
  });

  it("refuse une ligne sans nom, en donnant son numéro de tableur", () => {
    const a = analyser("nom;ville\n;Alès\nDupont;Anduze\n");
    expect(a.rejetees[0]).toMatchObject({ numero: 2, motif: "Aucun nom de client." });
    expect(a.valides).toHaveLength(1);
  });

  it("refuse une adresse e-mail invalide plutôt que de l'enregistrer", () => {
    const a = analyser("nom;email\nDupont;jean(at)exemple.fr\n");
    expect(a.valides).toHaveLength(0);
    expect(a.rejetees[0].motif).toContain("invalide");
  });

  it("ne crée pas de site quand l'adresse est incomplète", () => {
    const a = analyser("nom;adresse;ville\nDupont;12 rue des Lilas;Alès\n");
    expect(a.valides[0].siteCreable).toBe(false);
    expect(a.valides[0].address).toBe("12 rue des Lilas");
  });

  it("signale les doublons du fichier sans les écarter", () => {
    const a = analyser("nom;cp\nDupont Jean;30100\nDUPONT  JEAN;30100\n");
    expect(a.valides).toHaveLength(2);
    expect(a.doublons).toBe(1);
  });

  it("liste les colonnes qu'il n'a pas su interpréter", () => {
    const a = analyser("nom;chaudière;ville\nDupont;Frisquet;Alès\n");
    expect(a.colonnesIgnorees).toContain("chaudiere");
  });
});
