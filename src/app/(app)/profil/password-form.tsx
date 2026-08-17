"use client";

import { useState, useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/vennora/form";
import { changeMyPasswordAction } from "./actions";

/**
 * Changement de mot de passe.
 *
 * En cas de succès l'action redirige vers la connexion : le composant n'a
 * donc pas d'état « réussi » à afficher, seulement des erreurs. La
 * déconnexion est annoncée avant, pas subie après.
 */
export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const err = (field: string) => errors[field]?.[0];

  function onSubmit(formData: FormData) {
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await changeMyPasswordAction(formData);
      // Chemin nominal : la redirection a déjà eu lieu, on n'arrive pas ici.
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? null : result.error);
        if (!result.fieldErrors) toast.error(result.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />

      <TextField
        name="currentPassword"
        label="Mot de passe actuel"
        type="password"
        required
        error={err("currentPassword")}
        autoComplete="current-password"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="password"
          label="Nouveau mot de passe"
          type="password"
          required
          error={err("password")}
          hint="12 caractères minimum. Une phrase est plus sûre qu'un mot compliqué."
          autoComplete="new-password"
        />
        <TextField
          name="passwordConfirm"
          label="Confirmation"
          type="password"
          required
          error={err("passwordConfirm")}
          autoComplete="new-password"
        />
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
        <LogOut className="mt-0.5 size-4 shrink-0" />
        <span>
          Vous serez déconnecté de tous vos appareils, celui-ci compris, et
          devrez vous reconnecter avec le nouveau mot de passe.
        </span>
      </p>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Changer le mot de passe
      </Button>
    </form>
  );
}
