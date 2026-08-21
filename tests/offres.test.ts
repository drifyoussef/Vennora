import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Plan } from "@/core/enums";
import { autorise, exigerFonctionnalite, offreRequise, utilisateursInclus } from "@/core/plans";
import { construireExport } from "@/core/export/organisation";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";

/**
 * Verrouillage par offre.
 *
 * Ce qui est vérifié ici n'est pas l'apparence — le flou n'est qu'un décor —
 * mais le refus côté serveur, seul rempart réel.
 */
describe("matrice des offres", () => {
  it("n'ouvre rien de payant à l'offre la plus basse", () => {
    expect(autorise(Plan.ESSENTIEL, "redaction-assistee")).toBe(false);
    expect(autorise(Plan.ESSENTIEL, "envoi-rapport")).toBe(false);
    expect(autorise(Plan.ESSENTIEL, "rappels")).toBe(false);
    expect(autorise(Plan.ESSENTIEL, "export")).toBe(false);
  });

  it("ouvre la rédaction et l'envoi dès l'offre Pro, l'export à Business", () => {
    expect(autorise(Plan.PRO, "redaction-assistee")).toBe(true);
    expect(autorise(Plan.PRO, "envoi-rapport")).toBe(true);
    expect(autorise(Plan.PRO, "export")).toBe(false);
    expect(autorise(Plan.BUSINESS, "export")).toBe(true);
  });

  it("ouvre tout à l'offre Entreprise", () => {
    expect(autorise(Plan.ENTREPRISE, "export")).toBe(true);
    expect(utilisateursInclus(Plan.ENTREPRISE)).toBe(Infinity);
  });

  it("donne à Fondateur les droits de Pro, pour trois utilisateurs", () => {
    expect(autorise(Plan.FONDATEUR, "redaction-assistee")).toBe(true);
    expect(autorise(Plan.FONDATEUR, "envoi-rapport")).toBe(true);
    expect(autorise(Plan.FONDATEUR, "rappels")).toBe(true);
    expect(autorise(Plan.FONDATEUR, "export")).toBe(false);
    expect(utilisateursInclus(Plan.FONDATEUR)).toBe(3);
  });

  it("ne propose jamais de passer à Fondateur : elle ne se souscrit plus", () => {
    for (const f of ["redaction-assistee", "envoi-rapport", "rappels", "export"] as const) {
      expect(offreRequise(f)).not.toBe(Plan.FONDATEUR);
    }
  });

  it("désigne la première offre suffisante, pour le message", () => {
    expect(offreRequise("redaction-assistee")).toBe(Plan.PRO);
    expect(offreRequise("export")).toBe(Plan.BUSINESS);
  });
});

describe("garde serveur", () => {
  let essentiel: TestOrg;
  let business: TestOrg;

  beforeAll(async () => {
    essentiel = await createTestOrg("offre-essentiel", Plan.ESSENTIEL);
    business = await createTestOrg("offre-business", Plan.BUSINESS);
  });

  afterAll(async () => {
    await destroyTestOrg(essentiel);
    await destroyTestOrg(business);
  });

  it("refuse une fonctionnalité hors offre, en nommant celle qu'il faut", () => {
    expect(() => exigerFonctionnalite(essentiel.admin, "redaction-assistee")).toThrow(
      /offre Pro/,
    );
  });

  it("laisse passer ce qui est compris dans l'offre", () => {
    expect(() => exigerFonctionnalite(business.admin, "export")).not.toThrow();
    expect(() => exigerFonctionnalite(business.admin, "rappels")).not.toThrow();
  });

  it("refuse même à un administrateur : l'offre n'est pas un droit d'accès", () => {
    expect(() => exigerFonctionnalite(essentiel.admin, "export")).toThrow();
    expect(() => exigerFonctionnalite(essentiel.technician, "export")).toThrow();
  });

  it("l'export reste construit pour une offre qui y a droit", async () => {
    const fichiers = await construireExport(business.admin);
    expect(fichiers.map((f) => f.chemin)).toContain("clients.csv");
  });
});
