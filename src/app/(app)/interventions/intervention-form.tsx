"use client";

import { useMemo, useState, useTransition } from "react";
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
import type { InterventionTypeEntry } from "@/core/catalog";
import type { CustomerOption } from "@/core/data/customers";
import { toDateInput, toTimeInput } from "@/lib/format";
import { createInterventionAction, updateInterventionAction } from "./actions";

export interface InterventionFormValues {
  id?: string;
  customerId?: string;
  siteId?: string;
  equipmentId?: string | null;
  technicianId?: string;
  typeId?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  notes?: string | null;
  internalNotes?: string | null;
}

/**
 * Formulaire d'intervention.
 *
 * Les trois sélecteurs client → site → équipement sont liés : choisir un
 * client restreint les sites, choisir un site restreint les équipements. Tout
 * l'arbre est envoyé au client en une fois — quelques centaines de lignes,
 * bien moins coûteuses qu'un aller-retour réseau à chaque changement de
 * sélection, et le formulaire reste utilisable en réseau instable.
 */
export function InterventionForm({
  initial,
  customers,
  technicians,
  types,
  cancelHref,
}: {
  initial?: InterventionFormValues;
  customers: CustomerOption[];
  technicians: Array<{ id: string; firstName: string; lastName: string }>;
  types: InterventionTypeEntry[];
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");
  const [equipmentId, setEquipmentId] = useState(initial?.equipmentId ?? "");
  const [typeId, setTypeId] = useState(initial?.typeId ?? types[0]?.id ?? "");

  const start = initial?.scheduledStart ?? defaultStart();
  const [startTime, setStartTime] = useState(toTimeInput(start));
  const [endTime, setEndTime] = useState(
    initial?.scheduledEnd
      ? toTimeInput(initial.scheduledEnd)
      : addMinutesToTime(toTimeInput(start), types[0]?.defaultDurationMin ?? 60),
  );

  const isEdit = Boolean(initial?.id);
  const err = (field: string) => errors[field]?.[0];

  const sites = useMemo(
    () => customers.find((c) => c.id === customerId)?.sites ?? [],
    [customers, customerId],
  );
  const equipments = useMemo(
    () => sites.find((s) => s.id === siteId)?.equipments ?? [],
    [sites, siteId],
  );

  /** Changer de client invalide le site, donc l'équipement. */
  function onCustomerChange(next: string) {
    setCustomerId(next);
    setSiteId("");
    setEquipmentId("");
  }

  function onSiteChange(next: string) {
    setSiteId(next);
    setEquipmentId("");
  }

  /** Changer de type recale l'heure de fin sur la durée par défaut du type. */
  function onTypeChange(next: string) {
    setTypeId(next);
    const type = types.find((t) => t.id === next);
    if (type) setEndTime(addMinutesToTime(startTime, type.defaultDurationMin));
  }

  /** Déplacer le début conserve la durée du créneau. */
  function onStartChange(next: string) {
    const duration = minutesBetween(startTime, endTime);
    setStartTime(next);
    setEndTime(addMinutesToTime(next, duration > 0 ? duration : 60));
  }

  function onSubmit(formData: FormData) {
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateInterventionAction(initial!.id!, formData)
        : await createInterventionAction(formData);

      if (result.ok) {
        toast.success(
          isEdit ? "Intervention mise à jour." : "Intervention planifiée.",
        );
        router.push(`/interventions/${result.data.id}`);
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

      <FormSection
        title="Lieu de l'intervention"
        hint="Choisissez le client, puis son site, puis l'appareil concerné."
      >
        <SelectField
          name="customerId"
          label="Client"
          required
          placeholder="Choisir un client…"
          value={customerId}
          onChange={onCustomerChange}
          error={err("customerId")}
          options={customers.map((c) => ({ value: c.id, label: c.name }))}
          className="sm:col-span-2"
        />

        <SelectField
          name="siteId"
          label="Site"
          required
          placeholder={
            customerId ? "Choisir un site…" : "Choisissez d'abord un client"
          }
          value={siteId}
          onChange={onSiteChange}
          error={err("siteId")}
          disabled={!customerId}
          options={sites.map((s) => ({
            value: s.id,
            label: `${s.name} — ${s.address}, ${s.city}`,
          }))}
          className="sm:col-span-2"
        />

        <SelectField
          name="equipmentId"
          label="Équipement"
          placeholder={
            !siteId
              ? "Choisissez d'abord un site"
              : equipments.length > 0
                ? "Aucun équipement particulier"
                : "Aucun équipement déclaré sur ce site"
          }
          value={equipmentId ?? ""}
          onChange={setEquipmentId}
          error={err("equipmentId")}
          disabled={!siteId || equipments.length === 0}
          options={equipments.map((e) => ({
            value: e.id,
            label: `${e.label ?? e.type.label}${e.brand ? ` — ${e.brand}` : ""}${e.location ? ` (${e.location})` : ""}`,
          }))}
          hint="Facultatif, mais l'historique n'est alimenté que si un équipement est désigné."
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection title="Créneau">
        <SelectField
          name="typeId"
          label="Type d'intervention"
          required
          value={typeId}
          onChange={onTypeChange}
          error={err("typeId")}
          options={types.map((t) => ({ value: t.id, label: t.label }))}
        />
        <SelectField
          name="technicianId"
          label="Technicien"
          required
          placeholder="Assigner à…"
          defaultValue={initial?.technicianId}
          error={err("technicianId")}
          options={technicians.map((t) => ({
            value: t.id,
            label: `${t.firstName} ${t.lastName}`,
          }))}
        />
        <TextField
          name="date"
          label="Date"
          type="date"
          required
          defaultValue={toDateInput(start)}
          error={err("date")}
          className="sm:col-span-2"
        />
        <TextField
          name="startTime"
          label="Heure de début"
          type="time"
          required
          value={startTime}
          onChange={(e) => onStartChange(e.target.value)}
          error={err("startTime")}
        />
        <TextField
          name="endTime"
          label="Heure de fin"
          type="time"
          required
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          error={err("endTime")}
        />
      </FormSection>

      <FormSection title="Consignes" columns={1}>
        <TextAreaField
          name="notes"
          label="Notes pour le technicien"
          rows={3}
          defaultValue={initial?.notes}
          error={err("notes")}
          placeholder="Ce qu'il faut savoir avant d'arriver : demande du client, matériel à prévoir…"
        />
        <TextAreaField
          name="internalNotes"
          label="Notes internes"
          rows={2}
          defaultValue={initial?.internalNotes}
          error={err("internalNotes")}
          hint="Jamais reprises dans le rapport remis au client."
        />
      </FormSection>

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Button type="submit" disabled={pending} className="min-w-32">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Enregistrer" : "Planifier l'intervention"}
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}

/** Par défaut : demain 8 h 30, le créneau le plus courant d'une tournée. */
function defaultStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 30, 0, 0);
  return d;
}

function minutesBetween(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  return th * 60 + tm - (fh * 60 + fm);
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
