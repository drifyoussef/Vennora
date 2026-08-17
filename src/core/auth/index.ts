import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { authConfig } from "./config";
import { verifyPasswordConstantTime } from "./password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "E-mail et mot de passe",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            passwordHash: true,
            role: true,
            active: true,
            orgId: true,
            org: { select: { trade: { select: { slug: true } } } },
          },
        });

        // Toujours passer par la comparaison, même sans utilisateur trouvé :
        // sinon le temps de réponse indique quels e-mails existent.
        const valid = await verifyPasswordConstantTime(
          parsed.data.password,
          user?.passwordHash,
        );

        if (!user || !valid || !user.active) return null;

        // Non bloquant : un échec d'écriture ne doit pas empêcher la connexion.
        prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          orgId: user.orgId,
          role: user.role,
          tradeSlug: user.org.trade.slug,
        };
      },
    }),
  ],
});
