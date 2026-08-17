"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  FormError,
  FormSection,
  TextAreaField,
  TextField,
} from "@/components/vennora/form";
import { CustomerKind } from "@/core/enums";
import { CUSTOMER_KIND_LABEL } from "@/core/labels";
import { cn } from "@/lib/utils";
import { createCustomerAction, updateCustomerAction } from "./actions";

export interface CustomerFormValues {
  id?: string;
  kind: CustomerKind;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneSecondary?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  notes?: string | null;
}

/**
 * Formulaire client.
 *
 * Le type (particulier / professionnel) commande les champs d'identité :
 * afficher les six en permanence pousserait à remplir « Nom » ET « Raison
 * sociale » sur le même client.
 */
export function CustomerForm({
  initial,
  cancelHref,
}: {
  initial?: CustomerFormValues;
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<CustomerKind>(
    initial?.kind ?? CustomerKind.INDIVIDUAL,
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(initial?.id);
  const err = (field: string) => errors[field]?.[0];

  function onSubmit(formData: FormData) {
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateCustomerAction(initial!.id!, formData)
        : await createCustomerAction(formData);

      if (result.ok) {
        toast.success(isEdit ? "Client mis à jour." : "Client créé.");
        router.push(`/clients/${result.data.id}`);
        router.refresh();
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.error);
      if (!result.fieldErrors) toast.error(result.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-8" noValidate>
      <FormError message={formError} />

      <FormSection title="Identité">
        <div className="sm:col-span-2">
          <Label className="mb-2 block">Type de client</Label>
          <div className="grid max-w-md grid-cols-2 gap-2">
            {([CustomerKind.INDIVIDUAL, CustomerKind.COMPANY] as const).map(
              (value) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors",
                    kind === value
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-input hover:bg-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                    className="sr-only"
                  />
                  {CUSTOMER_KIND_LABEL[value]}
                </label>
              ),
            )}
          </div>
        </div>

        {kind === CustomerKind.COMPANY ? (
          <TextField
            label="Raison sociale"
            name="companyName"
            defaultValue={initial?.companyName}
            error={err("companyName")}
            required
            className="sm:col-span-2"
          />
        ) : (
          <>
            <TextField
              label="Nom"
              name="lastName"
              defaultValue={initial?.lastName}
              error={err("lastName")}
              required
              autoComplete="family-name"
            />
            <TextField
              label="Prénom"
              name="firstName"
              defaultValue={initial?.firstName}
              error={err("firstName")}
              autoComplete="given-name"
            />
          </>
        )}
      </FormSection>

      <FormSection
        title="Contact"
        hint="Au moins un téléphone ou un e-mail est nécessaire pour joindre le client et lui envoyer ses rapports."
      >
        <TextField
          label="Téléphone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={initial?.phone}
          error={err("phone")}
          autoComplete="tel"
        />
        <TextField
          label="Téléphone secondaire"
          name="phoneSecondary"
          type="tel"
          inputMode="tel"
          defaultValue={initial?.phoneSecondary}
          error={err("phoneSecondary")}
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          inputMode="email"
          defaultValue={initial?.email}
          error={err("email")}
          autoComplete="email"
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection
        title="Adresse de facturation"
        hint="Les interventions se déroulent sur les sites du client, créés séparément."
      >
        <TextField
          label="Adresse"
          name="address"
          defaultValue={initial?.address}
          error={err("address")}
          className="sm:col-span-2"
        />
        <TextField
          label="Code postal"
          name="postalCode"
          inputMode="numeric"
          defaultValue={initial?.postalCode}
          error={err("postalCode")}
        />
        <TextField
          label="Ville"
          name="city"
          defaultValue={initial?.city}
          error={err("city")}
        />
      </FormSection>

      <FormSection title="Notes" columns={1}>
        <TextAreaField
          label="Notes internes"
          name="notes"
          defaultValue={initial?.notes}
          error={err("notes")}
          placeholder="Informations utiles à l'équipe : préférences, historique commercial, précautions…"
        />
      </FormSection>

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Button type="submit" disabled={pending} className="min-w-32">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Enregistrer" : "Créer le client"}
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
