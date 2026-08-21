"use server";

import { revalidatePath } from "next/cache";

import { getActionContext } from "@/core/context";
import { toActionError, type ActionResult } from "@/core/errors";
import {
  analyserImport,
  reprendreClients,
  type AnalyseImport,
  type ResultatImport,
} from "@/core/import/customers";
import { audit } from "@/core/tenant";
import { decoderTexte, lireCsv } from "@/lib/csv";

/**
 * Reprise du fichier clients.
 *
 * Deux temps volontairement séparés : l'analyse ne touche à rien et rend
 * compte de ce qui a été compris ; l'import écrit. Entre les deux, c'est
 * l'utilisateur qui décide — reprendre trois cents fiches sans les avoir vues
 * est le genre d'opération qu'on ne défait pas d'un clic.
 *
 * Le fichier est relu à l'import plutôt que de faire l'aller-retour avec les
 * lignes analysées : ce qui revient du navigateur ne se croit pas sur parole,
 * et un fichier de six cents lignes ferait un formulaire inutilement lourd.
 */
const TAILLE_MAX = 5 * 1024 * 1024;
const LIGNES_MAX = 5000;

async function lireFichier(formData: FormData) {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    throw new Error("Aucun fichier reçu.");
  }
  if (fichier.size > TAILLE_MAX) {
    throw new Error("Fichier trop volumineux (5 Mo maximum).");
  }

  const contenu = decoderTexte(new Uint8Array(await fichier.arrayBuffer()));
  const { entetes, lignes } = lireCsv(contenu);

  if (entetes.length === 0) {
    throw new Error("Fichier vide ou illisible.");
  }
  if (lignes.length > LIGNES_MAX) {
    throw new Error(
      `Fichier trop long : ${lignes.length} lignes pour un maximum de ${LIGNES_MAX}. Découpez-le.`,
    );
  }

  return analyserImport(lignes, entetes);
}

export async function analyserFichierAction(
  formData: FormData,
): Promise<ActionResult<AnalyseImport>> {
  try {
    await getActionContext("customer.create");
    return { ok: true, data: await lireFichier(formData) };
  } catch (e) {
    return toActionError(e);
  }
}

export async function importerClientsAction(
  formData: FormData,
): Promise<ActionResult<ResultatImport>> {
  try {
    const context = await getActionContext("customer.create");
    const { ctx } = context;
    const analyse = await lireFichier(formData);
    const resultat = await reprendreClients(context, analyse);

    await audit(ctx, {
      action: "customers.imported",
      entity: "Customer",
      metadata: { ...resultat },
    });

    revalidatePath("/clients");

    return { ok: true, data: resultat };
  } catch (e) {
    return toActionError(e);
  }
}
