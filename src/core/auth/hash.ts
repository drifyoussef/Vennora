import bcrypt from "bcryptjs";

/**
 * Hachage des mots de passe.
 *
 * Séparé de `password.ts`, qui porte la garde `server-only` : le seed et le
 * provisionnement d'une organisation tournent hors du runtime Next et doivent
 * pouvoir hacher un mot de passe. Le coût était jusqu'ici recopié dans le
 * seed — deux endroits pour un réglage qui doit rester unique.
 *
 * 12 tours : ~250 ms sur un serveur courant en 2026. Assez lent pour rendre
 * une attaque par dictionnaire coûteuse, assez rapide pour ne pas dégrader
 * une connexion depuis un téléphone en 4G sur un chantier.
 */
export const HASH_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, HASH_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
