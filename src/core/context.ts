import "server-only";
import { forbidden } from "next/navigation";
import { requireUser, requireUserOrThrow, type CurrentUser } from "./auth/session";
import { assertCan, can, type Permission } from "./permissions";
import { tenantDb, type TenantClient, type TenantContext } from "./tenant";

/**
 * Point d'entrée unique de toute lecture ou écriture métier.
 *
 * Une page ou une Server Action commence par `await getPageContext()` ou
 * `await getActionContext()`, puis n'utilise que le `db` retourné. Elle n'a
 * ainsi aucun moyen d'atteindre les données d'une autre organisation, même
 * en oubliant un filtre.
 */
export interface AppContext {
  user: CurrentUser;
  ctx: TenantContext;
  db: TenantClient;
}

function build(user: CurrentUser): AppContext {
  const ctx: TenantContext = {
    orgId: user.orgId,
    userId: user.id,
    role: user.role,
  };
  return { user, ctx, db: tenantDb(ctx) };
}

/**
 * Pages et layouts : redirige vers /connexion si la session est absente, et
 * rend une page 403 si le rôle ne suffit pas.
 *
 * `forbidden()` plutôt qu'une exception : un technicien qui saisit à la main
 * l'URL des paramètres doit voir « réservé aux administrateurs », pas une page
 * d'erreur générique. Et plutôt qu'un `notFound()`, parce qu'ici la page
 * existe bel et bien — la masquer n'apporterait rien, l'entrée de menu étant
 * déjà filtrée par le même contrôle de droits.
 */
export async function getPageContext(
  permission?: Permission,
): Promise<AppContext> {
  const user = await requireUser();
  if (permission && !can(user.role, permission)) forbidden();
  return build(user);
}

/** Server Actions et route handlers : lève une erreur au lieu de rediriger. */
export async function getActionContext(
  permission?: Permission,
): Promise<AppContext> {
  const user = await requireUserOrThrow();
  if (permission) assertCan(user.role, permission);
  return build(user);
}
