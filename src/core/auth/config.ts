import type { NextAuthConfig } from "next-auth";

/**
 * Configuration Auth.js commune, sans dépendance à Prisma ni à bcrypt.
 *
 * Ce fichier doit rester exécutable dans le runtime Edge : c'est lui que
 * charge le middleware. Le provider Credentials, qui a besoin de la base et
 * du hachage, est ajouté dans `./index.ts`, chargé uniquement côté Node.
 */
export const authConfig = {
  session: {
    strategy: "jwt",
    // Un technicien reste connecté sur son téléphone toute la semaine sans
    // avoir à ressaisir son mot de passe entre deux chantiers.
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  pages: {
    signIn: "/connexion",
    error: "/connexion",
  },

  providers: [],

  callbacks: {
    /**
     * Le jeton porte l'organisation et le rôle. Ils servent aux redirections
     * et à l'affichage ; toute décision d'autorisation côté serveur relit
     * l'utilisateur en base (voir `session.ts`), pour qu'une désactivation de
     * compte prenne effet immédiatement et non à l'expiration du jeton.
     */
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id as string;
        token.orgId = user.orgId;
        token.role = user.role;
        token.tradeSlug = user.tradeSlug;
      }
      if (trigger === "update" && session?.name) {
        token.name = session.name as string;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.orgId = token.orgId as string;
        session.user.role = token.role as "ADMIN" | "TECHNICIAN";
        session.user.tradeSlug = token.tradeSlug as string;
        // Date d'émission du jeton, en secondes. Comparée à
        // `passwordChangedAt` pour refuser un jeton antérieur au dernier
        // changement de mot de passe.
        session.user.issuedAt = typeof token.iat === "number" ? token.iat : 0;
      }
      return session;
    },
  },

  trustHost: true,
} satisfies NextAuthConfig;
