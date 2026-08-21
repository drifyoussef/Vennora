import { describe, expect, it } from "vitest";
import { decoderTexte, ecrireCsv, lireCsv, normaliserEntete } from "@/lib/csv";

describe("lecture de CSV", () => {
  it("accepte le point-virgule des tableurs français", () => {
    const { entetes, lignes } = lireCsv("Nom;Ville\nDupont;Alès\n");
    expect(entetes).toEqual(["nom", "ville"]);
    expect(lignes).toEqual([{ nom: "Dupont", ville: "Alès" }]);
  });

  it("accepte aussi la virgule", () => {
    const { lignes } = lireCsv("nom,ville\nDupont,Alès\n");
    expect(lignes[0]).toEqual({ nom: "Dupont", ville: "Alès" });
  });

  it("garde les virgules contenues dans une adresse entre guillemets", () => {
    const { lignes } = lireCsv('nom,adresse\nDupont,"12 rue des Lilas, bât. B"\n');
    expect(lignes[0].adresse).toBe("12 rue des Lilas, bât. B");
  });

  it("gère les guillemets doublés et les sauts de ligne internes", () => {
    const { lignes } = lireCsv('nom,note\nDupont,"dit ""le grand""\nvoisin du n°14"\n');
    expect(lignes[0].note).toBe('dit "le grand"\nvoisin du n°14');
  });

  it("normalise les en-têtes accentués et espacés", () => {
    expect(normaliserEntete("Code Postal")).toBe("code_postal");
    expect(normaliserEntete("Téléphone")).toBe("telephone");
    expect(normaliserEntete("E-mail  ")).toBe("e_mail");
  });

  it("retire la marque d'ordre d'octets qui collerait au premier en-tête", () => {
    const { entetes } = lireCsv(decoderTexte(new TextEncoder().encode("﻿nom;ville\nA;B")));
    expect(entetes[0]).toBe("nom");
  });

  it("décode un fichier Windows-1252 sans casser les accents", () => {
    // « Église » encodé en Windows-1252 : É = 0xC9, invalide en UTF-8.
    const octets = new Uint8Array([0x6e, 0x6f, 0x6d, 0x0a, 0xc9, 0x67, 0x6c, 0x69, 0x73, 0x65]);
    expect(decoderTexte(octets)).toBe("nom\nÉglise");
  });

  it("ignore les lignes vides et les fins de ligne Windows", () => {
    const { lignes } = lireCsv("nom;ville\r\nDupont;Alès\r\n\r\n");
    expect(lignes).toHaveLength(1);
  });
});

describe("écriture de CSV", () => {
  it("sépare par des points-virgules et ouvre par la marque d'ordre d'octets", () => {
    const csv = ecrireCsv(["nom", "ville"], [["Dupont", "Alès"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("nom;ville");
    expect(csv).toContain("Dupont;Alès");
  });

  it("encadre les champs qui contiennent un séparateur ou un guillemet", () => {
    const csv = ecrireCsv(["note"], [['dit "le grand"; voisin']]);
    expect(csv).toContain('"dit ""le grand""; voisin"');
  });

  it("écrit les valeurs absentes comme des cases vides", () => {
    expect(ecrireCsv(["a", "b"], [[null, undefined]])).toContain(";\r\n");
  });

  it("se relit lui-même", () => {
    const csv = ecrireCsv(["nom", "adresse"], [["Dupont", "12 rue des Lilas, bât. B"]]);
    const relu = lireCsv(decoderTexte(new TextEncoder().encode(csv)));
    expect(relu.lignes[0]).toEqual({ nom: "Dupont", adresse: "12 rue des Lilas, bât. B" });
  });
});
