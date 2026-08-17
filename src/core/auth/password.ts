import "server-only";
import bcrypt from "bcryptjs";

/**
 * 12 tours : ~250 ms sur un serveur courant en 2026. Assez lent pour rendre
 * une attaque par dictionnaire coûteuse, assez rapide pour ne pas dégrader
 * une connexion depuis un téléphone en 4G sur un chantier.
 */
const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Compare systématiquement contre un hash factice quand l'utilisateur
 * n'existe pas, pour que le temps de réponse ne révèle pas si un e-mail est
 * enregistré.
 */
const DUMMY_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEe.5Y7VFOZR6/AzT.q1Q1YQ0kFq0k1zNGa";

export async function verifyPasswordConstantTime(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
