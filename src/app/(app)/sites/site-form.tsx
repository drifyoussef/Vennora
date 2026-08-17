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
  TextAreaField,
  TextField,
} from "@/components/vennora/form";
import { createSiteAction, updateSiteAction } from "./actions";

export interface SiteFormValues {
  id?: string;
  customerId: string;
  name?: string | null;
  address?: string | null;
  addressComplement?: string | null;
  postalCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  accessNotes?: string | null;
}

export function SiteForm({
  initial,
  customers,
  cancelHref,
  lockCustomer = false,
}: {
  initial?: SiteFormValues;
  customers: Array<{ id: string; name: string }>;
  cancelHref: string;
  lockCustomer?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(initial?.id);
  const err = (field: string) => errors[field]?.[0];

  function onSubmit(formData: FormData) {
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateSiteAction(initial!.id!, formData)
        : await createSiteAction(formData);

      if (result.ok) {
        toast.success(isEdit ? "Site mis à jour." : "Site créé.");
        router.push(`/sites/${result.data.id}`);
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

      <FormSection title="Rattachement">
        {lockCustomer && initial?.customerId ? (
          <input type="hidden" name="customerId" value={initial.customerId} />
        ) : (
          <SelectField
            name="customerId"
            label="Client"
            required
            placeholder="Choisir un client…"
            defaultValue={initial?.customerId}
            error={err("customerId")}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            className="sm:col-span-2"
          />
        )}

        <TextField
          name="name"
          label="Nom du site"
          required
          defaultValue={initial?.name}
          error={err("name")}
          hint="« Maison principale », « Résidence secondaire », « Atelier »…"
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection title="Adresse">
        <TextField
          name="address"
          label="Adresse"
          required
          defaultValue={initial?.address}
          error={err("address")}
          autoComplete="street-address"
          className="sm:col-span-2"
        />
        <TextField
          name="addressComplement"
          label="Complément"
          defaultValue={initial?.addressComplement}
          error={err("addressComplement")}
          hint="Bâtiment, étage, lieu-dit…"
          className="sm:col-span-2"
        />
        <TextField
          name="postalCode"
          label="Code postal"
          required
          inputMode="numeric"
          maxLength={5}
          defaultValue={initial?.postalCode}
          error={err("postalCode")}
          autoComplete="postal-code"
        />
        <TextField
          name="city"
          label="Ville"
          required
          defaultValue={initial?.city}
          error={err("city")}
          autoComplete="address-level2"
        />
        <TextField
          name="latitude"
          label="Latitude"
          type="number"
          step="any"
          defaultValue={initial?.latitude}
          error={err("latitude")}
          hint="Facultatif — utile pour les hameaux mal géocodés."
        />
        <TextField
          name="longitude"
          label="Longitude"
          type="number"
          step="any"
          defaultValue={initial?.longitude}
          error={err("longitude")}
        />
      </FormSection>

      <FormSection title="Accès et notes" columns={1}>
        <TextAreaField
          name="accessNotes"
          label="Consignes d'accès"
          rows={3}
          defaultValue={initial?.accessNotes}
          error={err("accessNotes")}
          placeholder="Digicode, emplacement des clés, chien, stationnement, échelle nécessaire…"
          hint="Affiché au technicien avant qu'il démarre l'intervention."
        />
        <TextAreaField
          name="notes"
          label="Notes"
          defaultValue={initial?.notes}
          error={err("notes")}
        />
      </FormSection>

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Button type="submit" disabled={pending} className="min-w-32">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Enregistrer" : "Créer le site"}
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
