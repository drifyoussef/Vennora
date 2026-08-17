"use server";

import { z } from "zod";

import { signOut } from "@/core/auth";
import { hashPassword, verifyPassword } from "@/core/auth/password";
import { getActionContext } from "@/core/context";
import { toActionError, UnauthorizedError, type ActionResult } from "@/core/errors";
import { passwordChangeSchema } from "@/core/schemas";
import { audit } from "@/core/tenant";

/**
 * Changement de mot de passe par l'intéressé.
 *
 * L'ancien mot de passe est exigé : sans lui, un téléphone déverrouillé
 * laissé sur un chantier suffirait à prendre le compte définitivement.
 *
 * Effet de bord assumé : `passwordChangedAt` invalide tous les jetons émis
 * avant, y compris celui de la session en cours. C'est le comportement
 * attendu — on change son mot de passe surtout quand on le croit compromis,
 * et laisser les autres appareils connectés viderait le geste de son sens.
 * L'interface l'annonce avant de valider.
 */
export async function changeMyPasswordAction(
  formData: FormData,
): Promise<ActionResult<{ signedOut: true }>> {
  try {
    const { db, ctx, user } = await getActionContext();

    const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const record = await db.user.findFirst({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!record) throw new UnauthorizedError();

    const valid = await verifyPassword(
      parsed.data.currentPassword,
      record.passwordHash,
    );
    if (!valid) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Mot de passe actuel incorrect.",
        fieldErrors: { currentPassword: ["Mot de passe actuel incorrect."] },
      };
    }

    await db.user.updateMany({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        passwordChangedAt: new Date(),
      },
    });

    await audit(ctx, {
      action: "user.passwordChanged",
      entity: "User",
      entityId: user.id,
    });
  } catch (e) {
    return toActionError(e);
  }

  // Hors du `try` : `signOut` termine par une redirection Next, qui remonte
  // sous forme d'exception. L'attraper la transformerait en « une erreur est
  // survenue » alors que le changement a réussi.
  //
  // Effacer le cookie est nécessaire, pas cosmétique : le jeton courant vient
  // d'être invalidé, le garder produirait une redirection sèche vers la
  // connexion sans le moindre message.
  await signOut({ redirectTo: "/connexion?motdepasse=change" });

  return { ok: true, data: { signedOut: true } };
}
