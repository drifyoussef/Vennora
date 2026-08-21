import JSZip from "jszip";
import { NextResponse } from "next/server";

import { getPageContext } from "@/core/context";
import { AppError } from "@/core/errors";
import { construireExport } from "@/core/export/organisation";
import { exigerFonctionnalite } from "@/core/plans";

/**
 * Téléchargement de l'export complet.
 *
 * Une route plutôt qu'une action serveur : le résultat est un fichier de
 * plusieurs mégaoctets que le navigateur doit enregistrer, pas une valeur à
 * réafficher. Rien n'est stocké au passage — l'archive est construite à la
 * demande, donc toujours à jour, et il n'y a pas de copie à protéger ni à
 * purger ensuite.
 *
 * `getPageContext` porte l'authentification, la permission et le
 * cloisonnement : un technicien n'exporte pas l'entreprise, et personne
 * n'exporte celle d'un autre.
 */
export async function GET() {
  const context = await getPageContext("organization.manage");

  // Une route n'a pas le traducteur d'erreurs des actions : sans ce filet,
  // un refus d'offre sortirait en 500, c'est-à-dire en « le logiciel est
  // cassé » au lieu de « ce n'est pas dans votre offre ».
  try {
    exigerFonctionnalite(context, "export");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof AppError ? e.message : "Accès refusé." },
      { status: 403 },
    );
  }

  const fichiers = await construireExport(context);
  const zip = new JSZip();
  for (const f of fichiers) zip.file(f.chemin, f.contenu);

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const jour = new Date().toISOString().slice(0, 10);
  const nom = `vennora-export-${context.user.org.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}-${jour}.zip`;

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "no-store",
    },
  });
}
