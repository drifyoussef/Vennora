import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Boucle de redirection entre « / » et « /connexion ».
 *
 * Le proxy ne lit que le cookie ; les layouts relisent la base. Tant que les
 * deux pouvaient se contredire — compte supprimé, désactivé, ou recréé par un
 * seed avec un nouvel identifiant — chacun renvoyait vers l'autre
 * indéfiniment.
 *
 * On vérifie ici la règle structurelle qui l'empêche : le proxy n'a pas le
 * droit de rediriger un porteur de jeton hors de l'écran de connexion, seul
 * cet écran tranche, base sous les yeux.
 */
describe("pas de boucle entre / et /connexion", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const login = readFileSync("src/app/connexion/page.tsx", "utf8");

  it("le proxy ne redirige jamais depuis /connexion", () => {
    // Le motif fautif : `isLoggedIn && pathname === "/connexion"` suivi d'une
    // redirection vers la racine.
    expect(proxy).not.toMatch(/pathname\s*===\s*["']\/connexion["']/);
  });

  it("/connexion reste une route publique pour le proxy", () => {
    expect(proxy).toContain('"/connexion"');
    expect(proxy).toMatch(/PUBLIC_ROUTES/);
  });

  it("l'écran de connexion tranche en relisant la base", () => {
    expect(login).toContain("getCurrentUser");
    expect(login).toMatch(/if\s*\(current\)\s*redirect\("\/"\)/);
  });

  it("un jeton sans compte correspondant est signalé à l'utilisateur", () => {
    expect(login).toContain("staleSession");
    expect(login).toContain("Votre session n");
  });
});
