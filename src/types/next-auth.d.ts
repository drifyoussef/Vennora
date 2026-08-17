import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    orgId: string;
    role: "ADMIN" | "TECHNICIAN";
    tradeSlug: string;
  }

  interface Session {
    user: {
      id: string;
      orgId: string;
      role: "ADMIN" | "TECHNICIAN";
      tradeSlug: string;
      /** Émission du jeton, en secondes depuis l'époque Unix. */
      issuedAt: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    orgId: string;
    role: "ADMIN" | "TECHNICIAN";
    tradeSlug: string;
  }
}

export {};
