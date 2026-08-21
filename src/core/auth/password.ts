import "server-only";
import bcrypt from "bcryptjs";

/**
 * Mots de passe, côté application.
 *
 * Le calcul lui-même vit dans `hash.ts`, sans la garde `server-only` : le
 * seed et le provisionnement d'une organisation en ont besoin hors du
 * runtime Next. Ce module reste le point d'entrée de l'application, avec sa
 * garde et la comparaison à temps constant.
 */
export { hashPassword, verifyPassword, HASH_ROUNDS } from "./hash";

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
