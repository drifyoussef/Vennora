import "server-only";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/core/enums";

/**
 * Isolation multi-tenant.
 *
 * Le risque, dans une application où chaque requête porte un `orgId`, n'est
 * pas d'écrire le mauvais filtre : c'est d'en oublier un. Un `findMany` sans
 * `orgId` compile, passe les tests sur un jeu de données mono-entreprise, et
 * expose les clients d'une autre entreprise en production.
 *
 * On supprime la possibilité de l'oublier : `tenantDb(ctx)` renvoie un client
 * Prisma étendu qui injecte `orgId` dans le `where` de chaque lecture et de
 * chaque écriture, et dans le `data` de chaque création, pour tous les modèles
 * porteurs d'un tenant. Le client brut `prisma` reste accessible, mais son
 * usage est réservé à l'authentification (recherche par e-mail avant que le
 * tenant soit connu), au seed et à ce fichier.
 *
 * L'injection dans `update`/`delete`/`findUnique` s'appuie sur les filtres
 * non-uniques autorisés dans `where` depuis Prisma 5 : `{ id, orgId }` reste
 * un `where` valide, et une ressource appartenant à une autre organisation
 * remonte comme inexistante.
 *
 * Sur les créations, le typage Prisma continue d'exiger `orgId` : on l'écrit
 * donc explicitement à l'appel. L'extension l'écrase par celui du contexte,
 * ce qui neutralise toute tentative d'injection d'un `orgId` étranger depuis
 * le payload d'un formulaire.
 */

export interface TenantContext {
  orgId: string;
  userId: string;
  role: UserRole;
}

/** Modèles porteurs d'un `orgId`. Les catalogues métier n'en ont pas. */
const TENANT_MODELS = new Set([
  "User",
  "Customer",
  "Site",
  "Equipment",
  "Intervention",
  "InterventionPhoto",
  "VoiceNote",
  "Anomaly",
  "Report",
  "Signature",
  "Document",
  "Reminder",
  "AuditLog",
  "Counter",
]);

/** Opérations dont le `where` doit être restreint à l'organisation. */
const WHERE_SCOPED = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/** Opérations dont le `data` doit porter l'organisation. */
const DATA_SCOPED = new Set(["create", "createMany", "upsert"]);

type AnyArgs = Record<string, unknown>;

function withOrg<T extends AnyArgs>(data: T, orgId: string): T {
  // On force plutôt que d'utiliser une valeur fournie : une Server Action ne
  // doit jamais pouvoir écrire dans une autre organisation en passant un
  // `orgId` dans son payload.
  return { ...data, orgId };
}

function buildClient(orgId: string) {
  return prisma.$extends({
    name: `tenant:${orgId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }

          const next = { ...(args as AnyArgs) };

          if (WHERE_SCOPED.has(operation)) {
            next.where = withOrg(
              (next.where as AnyArgs | undefined) ?? {},
              orgId,
            );
          }

          if (DATA_SCOPED.has(operation)) {
            if (operation === "upsert") {
              next.create = withOrg(
                (next.create as AnyArgs | undefined) ?? {},
                orgId,
              );
            } else {
              const data = next.data;
              next.data = Array.isArray(data)
                ? data.map((d) => withOrg(d as AnyArgs, orgId))
                : withOrg((data as AnyArgs | undefined) ?? {}, orgId);
            }
          }

          return query(next);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof buildClient>;

// Un client étendu par organisation, réutilisé entre les requêtes : la
// construction de l'extension est peu coûteuse mais inutile à répéter, et le
// pool de connexions sous-jacent reste celui du client racine.
const clients = new Map<string, TenantClient>();

export function tenantDb(ctx: TenantContext | { orgId: string }): TenantClient {
  const existing = clients.get(ctx.orgId);
  if (existing) return existing;

  const created = buildClient(ctx.orgId);
  clients.set(ctx.orgId, created);
  return created;
}

/**
 * Journalise une action sensible. Volontairement « best effort » : un échec
 * d'écriture du journal ne doit jamais faire échouer l'action métier.
 */
export async function audit(
  ctx: TenantContext,
  entry: {
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  },
): Promise<void> {
  try {
    await tenantDb(ctx).auditLog.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata: entry.metadata as never,
        ipAddress: entry.ipAddress,
      },
    });
  } catch (e) {
    console.error("[vennora] échec d'écriture du journal d'audit", e);
  }
}
