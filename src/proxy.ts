import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/core/auth/config";

/**
 * Redirection optimiste (convention `proxy`, ex-`middleware` de Next 15).
 *
 * Ce filtre ne fait que lire le cookie de session pour éviter d'afficher une
 * page vide à un visiteur non connecté. Il ne constitue PAS le contrôle
 * d'accès : celui-ci est fait dans les layouts et les Server Actions via
 * `getPageContext` / `getActionContext`, qui relisent l'utilisateur en base.
 * Contourner ce fichier ne donne donc accès à rien.
 */
const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ["/connexion", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isLoggedIn = Boolean(req.auth?.user);

  if (!isLoggedIn && !isPublic) {
    const url = new URL("/connexion", req.nextUrl.origin);
    // Conserve la destination pour y revenir après la connexion — un
    // technicien qui ouvre un QR code doit atterrir sur l'équipement scanné.
    if (pathname !== "/") url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }

  // Volontairement, aucune redirection dans l'autre sens.
  //
  // Rediriger « jeton présent » vers « / » depuis /connexion créait une boucle
  // infinie dès que le jeton et la base se contredisaient : compte supprimé,
  // désactivé, ou simplement recréé par un seed avec un nouvel identifiant.
  // Le proxy ne lit que le cookie, le layout relit la base — la seule façon de
  // ne jamais boucler est que l'écran de connexion tranche lui-même, avec la
  // base sous les yeux (voir app/connexion/page.tsx).
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les images optimisées et le favicon.
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|woff2)$).*)",
  ],
};
