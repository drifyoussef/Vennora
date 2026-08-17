"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/core/auth";

const schema = z.object({
  email: z.string().min(1, "Renseignez votre e-mail.").email("E-mail invalide."),
  password: z.string().min(1, "Renseignez votre mot de passe."),
  suite: z.string().optional(),
});

export interface LoginState {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
}

/**
 * Connexion.
 *
 * Un seul message d'erreur pour « e-mail inconnu », « mot de passe faux » et
 * « compte désactivé » : détailler reviendrait à confirmer quels e-mails sont
 * enregistrés chez un client de Vennora.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    suite: formData.get("suite") ?? undefined,
  });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      fieldErrors: {
        email: flat.fieldErrors.email?.[0],
        password: flat.fieldErrors.password?.[0],
      },
    };
  }

  // Une destination ne peut être qu'un chemin interne : sans ce contrôle,
  // `?suite=https://…` transformerait la page de connexion en redirection
  // ouverte utilisable pour du hameçonnage.
  const suite = parsed.data.suite;
  const redirectTo =
    suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (e) {
    // `signIn` signale une connexion réussie en lançant une redirection Next :
    // il faut la laisser remonter, sinon l'utilisateur reste sur le formulaire.
    if (e instanceof AuthError) {
      return { error: "E-mail ou mot de passe incorrect." };
    }
    throw e;
  }

  return {};
}
