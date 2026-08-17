"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FormError,
  FormSection,
  SelectField,
  TextField,
} from "@/components/vennora/form";
import { USER_ROLE_LABEL } from "@/core/labels";
import { UserRole } from "@/core/enums";
import { TEAM_COLORS } from "@/core/palette";
import { cn } from "@/lib/utils";
import { createUserAction, updateUserAction } from "../actions";

export interface UserFormValues {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  role?: UserRole;
  colorHex?: string | null;
  active?: boolean;
}

export function UserForm({
  initial,
  defaultColor,
  isSelf = false,
  cancelHref,
}: {
  initial?: UserFormValues;
  defaultColor: string;
  isSelf?: boolean;
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [color, setColor] = useState(initial?.colorHex ?? defaultColor);
  const [active, setActive] = useState(initial?.active ?? true);

  const isEdit = Boolean(initial?.id);
  const err = (field: string) => errors[field]?.[0];

  function onSubmit(formData: FormData) {
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateUserAction(initial!.id!, formData)
        : await createUserAction(formData);

      if (result.ok) {
        toast.success(isEdit ? "Membre mis à jour." : "Membre ajouté.");
        router.push("/parametres");
        router.refresh();
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors?.email ? null : result.error);
      if (!result.fieldErrors) toast.error(result.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-8" noValidate>
      <FormError message={formError} />

      <FormSection title="Identité">
        <TextField
          name="firstName"
          label="Prénom"
          required
          defaultValue={initial?.firstName}
          error={err("firstName")}
          autoComplete="given-name"
        />
        <TextField
          name="lastName"
          label="Nom"
          required
          defaultValue={initial?.lastName}
          error={err("lastName")}
          autoComplete="family-name"
        />
        <TextField
          name="email"
          label="Adresse e-mail"
          type="email"
          inputMode="email"
          required
          defaultValue={initial?.email}
          error={err("email")}
          hint="Sert d'identifiant de connexion."
          autoComplete="off"
          className="sm:col-span-2"
        />
        <TextField
          name="phone"
          label="Téléphone"
          type="tel"
          inputMode="tel"
          defaultValue={initial?.phone}
          error={err("phone")}
        />
        <SelectField
          name="role"
          label="Rôle"
          required
          defaultValue={initial?.role ?? UserRole.TECHNICIAN}
          error={err("role")}
          options={[
            { value: UserRole.TECHNICIAN, label: USER_ROLE_LABEL.TECHNICIAN },
            { value: UserRole.ADMIN, label: USER_ROLE_LABEL.ADMIN },
          ]}
          hint="Le technicien voit ses interventions ; l'administrateur gère l'entreprise."
        />
      </FormSection>

      <FormSection
        title="Couleur du planning"
        hint="Elle identifie ce membre d'un coup d'œil sur la vue semaine."
        columns={1}
      >
        <input type="hidden" name="colorHex" value={color} />
        <div className="flex flex-wrap gap-2">
          {TEAM_COLORS.map((option) => (
            <button
              key={option.hex}
              type="button"
              onClick={() => setColor(option.hex)}
              aria-pressed={color === option.hex}
              title={option.label}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border-2 transition-transform",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                color === option.hex
                  ? "scale-110 border-foreground"
                  : "border-transparent hover:scale-105",
              )}
            >
              <span
                className="size-7 rounded-full"
                style={{ backgroundColor: option.hex }}
              />
              <span className="sr-only">{option.label}</span>
            </button>
          ))}
        </div>
        {err("colorHex") && (
          <p className="text-sm text-destructive">{err("colorHex")}</p>
        )}
      </FormSection>

      {isEdit ? (
        <FormSection title="Accès" columns={1}>
          <input type="hidden" name="active" value={active ? "true" : "false"} />
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
              active ? "border-input" : "border-severity-high/35 bg-severity-high/5",
            )}
          >
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={isSelf}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="block text-sm font-medium">Compte actif</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {isSelf
                  ? "Vous ne pouvez pas désactiver votre propre compte."
                  : "Un compte désactivé ne peut plus se connecter. Son historique, ses rapports et ses signatures restent intacts."}
              </span>
            </span>
          </label>
        </FormSection>
      ) : (
        <FormSection
          title="Mot de passe initial"
          hint="Communiquez-le au membre de l'équipe ; il pourra le changer depuis son profil."
        >
          <TextField
            name="password"
            label="Mot de passe"
            type="password"
            required
            error={err("password")}
            hint="12 caractères minimum."
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
        </FormSection>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Button type="submit" disabled={pending} className="min-w-32">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Enregistrer" : "Ajouter le membre"}
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
