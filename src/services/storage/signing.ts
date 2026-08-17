import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { UrlAudience } from "./types";

/**
 * Signature des URLs de fichiers servies par l'application.
 *
 * Le pilote local n'a pas d'équivalent des URLs présignées S3 : on le
 * reconstitue avec un HMAC. La clé est `AUTH_SECRET`, donc jamais exposée, et
 * la signature couvre à la fois le chemin, la date d'expiration et l'audience
 * — modifier l'un des trois invalide l'URL.
 */

const SEPARATOR = "|";

function sign(payload: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

export interface SignedParams {
  exp: number;
  aud: UrlAudience;
  sig: string;
}

export function signKey(
  key: string,
  expiresInSeconds: number,
  audience: UrlAudience,
): SignedParams {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return {
    exp,
    aud: audience,
    sig: sign([key, exp, audience].join(SEPARATOR)),
  };
}

export type VerifyResult =
  | { ok: true; audience: UrlAudience }
  | { ok: false; reason: "expired" | "invalid" };

export function verifyKey(
  key: string,
  params: { exp: string | null; aud: string | null; sig: string | null },
): VerifyResult {
  if (!params.exp || !params.aud || !params.sig) {
    return { ok: false, reason: "invalid" };
  }

  if (params.aud !== "tenant" && params.aud !== "public") {
    return { ok: false, reason: "invalid" };
  }

  const exp = Number(params.exp);
  if (!Number.isFinite(exp)) return { ok: false, reason: "invalid" };

  const expected = sign([key, exp, params.aud].join(SEPARATOR));

  // Comparaison à temps constant : une comparaison de chaînes classique
  // s'arrête au premier octet différent et laisse deviner la signature.
  const a = Buffer.from(expected);
  const b = Buffer.from(params.sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }

  // L'expiration n'est vérifiée qu'après la signature : sinon une URL forgée
  // et une URL périmée se distinguent par le message d'erreur.
  if (exp * 1000 < Date.now()) return { ok: false, reason: "expired" };

  return { ok: true, audience: params.aud };
}
