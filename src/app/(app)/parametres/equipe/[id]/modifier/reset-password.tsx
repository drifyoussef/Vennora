"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TextField } from "@/components/vennora/form";
import { resetUserPasswordAction } from "../../../actions";

/**
 * Réinitialisation d'un mot de passe par un administrateur.
 *
 * Sert au cas courant — un technicien a perdu son mot de passe — et au cas
 * urgent : un téléphone volé. Dans les deux cas l'action déconnecte tous les
 * appareils du compte, ce que la boîte de dialogue annonce.
 */
export function ResetPassword({
  userId,
  fullName,
}: {
  userId: string;
  fullName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function onSubmit(formData: FormData) {
    setErrors({});
    startTransition(async () => {
      const result = await resetUserPasswordAction(userId, formData);
      if (result.ok) {
        toast.success(`Mot de passe réinitialisé pour ${fullName}.`);
        setOpen(false);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setErrors({});
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <KeyRound className="size-4" />
          Réinitialiser le mot de passe
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription className="text-pretty">
            Définissez un mot de passe provisoire pour {fullName} et
            communiquez-le lui de vive voix. Tous ses appareils seront
            déconnectés.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4" noValidate>
          <TextField
            name="password"
            label="Nouveau mot de passe"
            type="password"
            required
            error={errors.password?.[0]}
            hint="12 caractères minimum."
            autoComplete="new-password"
          />
          <TextField
            name="passwordConfirm"
            label="Confirmation"
            type="password"
            required
            error={errors.passwordConfirm?.[0]}
            autoComplete="new-password"
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" type="button">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
