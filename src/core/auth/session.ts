import "server-only";
import type { Plan } from "@/core/enums";
import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "../errors";
import { assertCan, type Permission } from "../permissions";
import { auth } from "./index";
import type { UserRole } from "@/core/enums";

export interface CurrentUser {
  id: string;
  orgId: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  colorHex: string | null;
  org: {
    id: string;
    name: string;
    logoKey: string | null;
    tradeSlug: string;
    tradeName: string;
    /** Offre souscrite : c'est elle qui ouvre ou ferme les fonctionnalités. */
    plan: Plan;
  };
}

/**
 * Utilisateur courant, relu en base à chaque requête.
 *
 * Le JWT suffirait pour connaître l'id et le rôle, mais il reste valide
 * jusqu'à sept jours : un compte désactivé ou rétrogradé continuerait d'avoir
 * accès. On relit donc l'utilisateur, en mémoïsant l'appel avec `cache()` pour
 * qu'un rendu qui traverse dix composants serveur ne fasse qu'une requête.
 *
 * Retourne `null` plutôt que de rediriger : c'est à l'appelant de décider.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      orgId: true,
      role: true,
      firstName: true,
      lastName: true,
      email: true,
      active: true,
      colorHex: true,
      passwordChangedAt: true,
      org: {
        select: {
          id: true,
          name: true,
          logoKey: true,
          plan: true,
          trade: { select: { slug: true, name: true } },
        },
      },
    },
  });

  if (!user || !user.active) return null;

  // Un jeton émis avant le dernier changement de mot de passe est périmé,
  // même s'il n'a pas encore expiré. Sans ce contrôle, changer son mot de
  // passe ne déconnecterait aucun appareil pendant sept jours.
  // Marge d'une seconde : `iat` est en secondes, `passwordChangedAt` en
  // millisecondes, et les deux sont écrits à quelques instants d'intervalle.
  if (
    user.passwordChangedAt &&
    session.user.issuedAt * 1000 < user.passwordChangedAt.getTime() - 1000
  ) {
    return null;
  }

  return {
    id: user.id,
    orgId: user.orgId,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    colorHex: user.colorHex,
    org: {
      id: user.org.id,
      name: user.org.name,
      logoKey: user.org.logoKey,
      tradeSlug: user.org.trade.slug,
      tradeName: user.org.trade.name,
      plan: user.org.plan,
    },
  };
});

/** Pour les pages et layouts : redirige vers la connexion si non authentifié. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

/**
 * Pour les Server Actions et les routes : lève au lieu de rediriger, une
 * redirection au milieu d'une mutation étant ingérable côté client.
 */
export async function requireUserOrThrow(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await requireUserOrThrow();
  assertCan(user.role, permission);
  return user;
}
