import "server-only";
import { PrismaClient } from "@/generated/prisma";
import { isProduction } from "./env";

/**
 * Client Prisma partagé.
 *
 * En développement, Next recharge les modules à chaque édition : sans ce
 * cache sur `globalThis`, chaque rechargement ouvrirait un nouveau pool de
 * connexions vers Atlas et on atteindrait la limite du cluster en quelques
 * minutes.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ["error"] : ["error", "warn"],
  });

if (!isProduction) globalForPrisma.prisma = prisma;

export * from "@/generated/prisma";
