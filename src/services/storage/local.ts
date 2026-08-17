import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { signKey } from "./signing";
import type { StorageDriver, UrlAudience } from "./types";

/**
 * Stockage sur disque, pour le développement.
 *
 * Les fichiers vivent dans `.storage/` à la racine du projet — hors de
 * `public/`, sciemment : tout ce qui est dans `public/` est servi sans
 * contrôle, or ces fichiers sont des photos de chantier et des signatures
 * clients. Ils ne sortent que par une route qui vérifie la signature.
 */
const ROOT = path.join(process.cwd(), ".storage");

/**
 * Refuse toute clé qui pourrait sortir de `.storage/`.
 *
 * La clé est construite côté serveur, mais elle transite ensuite par une URL
 * et revient donc du client : `org/x/../../etc/passwd` doit être rejeté avant
 * d'atteindre le système de fichiers.
 */
export function assertSafeKey(key: string): void {
  if (
    !key ||
    key.length > 400 ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.includes("\0") ||
    key.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Clé de stockage invalide : ${JSON.stringify(key)}`);
  }
}

function resolve(key: string): string {
  assertSafeKey(key);
  const full = path.join(ROOT, key);

  // Ceinture et bretelles : même si `assertSafeKey` laissait passer quelque
  // chose, le chemin résolu doit rester sous la racine.
  const relative = path.relative(ROOT, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Clé de stockage hors du répertoire autorisé.");
  }
  return full;
}

export const localDriver: StorageDriver = {
  name: "local",

  async put(key, body) {
    const full = resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  },

  async get(key) {
    return readFile(resolve(key));
  },

  async delete(key) {
    // `force` : supprimer un fichier déjà absent est un succès, pas une erreur.
    await rm(resolve(key), { force: true });
  },

  async exists(key) {
    try {
      await stat(resolve(key));
      return true;
    } catch {
      return false;
    }
  },

  async url(key: string, expiresInSeconds: number, audience: UrlAudience) {
    assertSafeKey(key);
    const { exp, aud, sig } = signKey(key, expiresInSeconds, audience);
    const params = new URLSearchParams({ exp: String(exp), aud, sig });
    return `/api/fichiers/${key}?${params}`;
  },
};
