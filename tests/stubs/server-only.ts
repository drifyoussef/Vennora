/**
 * Neutralise `server-only` sous Vitest.
 *
 * Le vrai module lève à l'import hors d'un composant serveur. C'est
 * exactement son rôle en production — empêcher qu'un secret parte dans le
 * bundle navigateur — mais les tests exécutent ce code côté Node, où la
 * protection n'a pas d'objet.
 */
export {};
