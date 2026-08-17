import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/core/auth/session";
import { getStorage, keyBelongsToOrg } from "@/services/storage";
import { verifyKey } from "@/services/storage/signing";

/**
 * Service des fichiers stockés.
 *
 * Trois contrôles successifs, dans cet ordre :
 *
 *   1. la signature HMAC — l'URL a bien été émise par l'application ;
 *   2. l'expiration — elle n'a pas été mise en favori il y a trois semaines ;
 *   3. l'audience — pour une URL « tenant », une session de la bonne
 *      organisation est exigée en plus de la signature.
 *
 * Le troisième contrôle est ce qui distingue ce mécanisme d'une URL présignée
 * S3 classique : une capture d'écran de l'URL, ou une fuite par l'en-tête
 * `Referer`, ne suffit pas à ouvrir la photo d'un chantier.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await context.params;
  const key = segments.map(decodeURIComponent).join("/");

  const params = request.nextUrl.searchParams;
  const verified = verifyKey(key, {
    exp: params.get("exp"),
    aud: params.get("aud"),
    sig: params.get("sig"),
  });

  if (!verified.ok) {
    // Même réponse pour une signature forgée et pour un lien périmé : la
    // distinction n'apprendrait rien d'utile à un utilisateur légitime, et
    // renseignerait un attaquant sur la validité de sa forge.
    return new NextResponse("Lien invalide ou expiré.", { status: 403 });
  }

  if (verified.audience === "tenant") {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse("Authentification requise.", { status: 401 });
    }
    if (!keyBelongsToOrg(key, user.orgId)) {
      return new NextResponse("Fichier introuvable.", { status: 404 });
    }
  }

  let body: Buffer;
  try {
    const driver = await getStorage();
    body = await driver.get(key);
  } catch {
    return new NextResponse("Fichier introuvable.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeFor(key),
      "Content-Length": String(body.length),
      // `private` : ni un proxy d'entreprise ni un CDN ne doit conserver la
      // photo d'un chantier. `max-age` court, aligné sur la durée du lien.
      "Cache-Control": "private, max-age=300, must-revalidate",
      // Un fichier téléversé ne doit jamais être interprété par le navigateur,
      // même si sa signature binaire a été acceptée.
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Le type est déduit de l'extension, elle-même issue de la détection binaire. */
function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "pdf":
      return "application/pdf";
    case "webm":
      return "audio/webm";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}
