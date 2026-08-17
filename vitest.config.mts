import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests d'intégration.
 *
 * Ils tournent contre la vraie base : l'essentiel de ce qu'on veut vérifier —
 * isolation multi-tenant, cascades, contraintes d'unicité — est un
 * comportement de la base qu'un double en mémoire ne reproduirait pas. Chaque
 * suite crée son organisation jetable et l'efface à la fin.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Doit précéder l'alias « @ » : Vite applique la première règle qui
      // correspond.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Les suites partagent la base : les paralléliser produirait des
    // interférences pénibles à diagnostiquer pour un gain nul à cette échelle.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ["tests/setup.ts"],
  },
});
