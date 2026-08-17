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
import { toDateInput } from "@/lib/format";
import { createEquipmentAction, updateEquipmentAction } from "./actions";

export interface EquipmentFormValues {
  id?: string;
  siteId: string;
  typeId?: string;
  label?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  installedAt?: Date | null;
  description?: string | null;
  notes?: string | null;
}

export interface SiteOption {
  id: string;
  name: string;
  city: string;
  customerName: string;
}

export function EquipmentForm({
  initial,
  sites,
  types,
  cancelHref,
  lockSite = false,
}: {
  initial?: EquipmentFormValues;
  sites: SiteOption[];
  types: Array<{ id: string; label: string }>;
  cancelHref: string;
  lockSite?: boolean;
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
        ? await updateEquipmentAction(initial!.id!, formData)
        : await createEquipmentAction(formData);

      if (result.ok) {
        toast.success(isEdit ? "Équipement mis à jour." : "Équipement créé.");
        router.push(`/equipements/${result.data.id}`);
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

      <FormSection title="Emplacement">
        {lockSite && initial?.siteId ? (
          <input type="hidden" name="siteId" value={initial.siteId} />
        ) : (
          <SelectField
            name="siteId"
            label="Site"
            required
            placeholder="Choisir un site…"
            defaultValue={initial?.siteId}
            error={err("siteId")}
            options={sites.map((s) => ({
              value: s.id,
              label: `${s.customerName} — ${s.name} (${s.city})`,
            }))}
            className="sm:col-span-2"
          />
        )}

        <SelectField
          name="typeId"
          label="Type d'équipement"
          required
          placeholder="Choisir un type…"
          defaultValue={initial?.typeId}
          error={err("typeId")}
          options={types.map((t) => ({ value: t.id, label: t.label }))}
        />

        <TextField
          name="location"
          label="Pièce"
          defaultValue={initial?.location}
          error={err("location")}
          hint="« Séjour », « Chaufferie »…"
        />
      </FormSection>

      <FormSection
        title="Identification"
        hint="Ces informations figurent sur le rapport d'intervention et sur le certificat."
      >
        <TextField
          name="label"
          label="Libellé"
          defaultValue={initial?.label}
          error={err("label")}
          hint="Laisser vide pour utiliser le type d'équipement."
          className="sm:col-span-2"
        />
        <TextField
          name="brand"
          label="Marque"
          defaultValue={initial?.brand}
          error={err("brand")}
        />
        <TextField
          name="model"
          label="Modèle"
          defaultValue={initial?.model}
          error={err("model")}
        />
        <TextField
          name="serialNumber"
          label="Numéro de série"
          defaultValue={initial?.serialNumber}
          error={err("serialNumber")}
        />
        <TextField
          name="installedAt"
          label="Date d'installation"
          type="date"
          defaultValue={
            initial?.installedAt ? toDateInput(new Date(initial.installedAt)) : ""
          }
          error={err("installedAt")}
        />
      </FormSection>

      <FormSection title="Description et notes" columns={1}>
        <TextAreaField
          name="description"
          label="Description"
          rows={3}
          defaultValue={initial?.description}
          error={err("description")}
          placeholder="Configuration du conduit, tubage, particularités de l'installation…"
        />
        <TextAreaField
          name="notes"
          label="Notes techniques"
          defaultValue={initial?.notes}
          error={err("notes")}
          placeholder="Accès en toiture, outillage spécifique, précautions…"
        />
      </FormSection>

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Button type="submit" disabled={pending} className="min-w-32">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Enregistrer" : "Créer l'équipement"}
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
