"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeverityBadge } from "@/components/vennora/badges";
import { SelectField, TextAreaField, TextField } from "@/components/vennora/form";
import { ANOMALY_SEVERITY_LABEL, ANOMALY_STATUS_LABEL } from "@/core/labels";
import { AnomalySeverity, type AnomalyStatus } from "@/core/enums";
import { cn } from "@/lib/utils";
import {
  createAnomalyAction,
  deleteAnomalyAction,
  setAnomalyStatusAction,
  updateAnomalyAction,
} from "./anomaly-actions";

export interface AnomalyItem {
  id: string;
  title: string;
  description: string | null;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  recommendation: string | null;
}

/**
 * Anomalies d'une intervention.
 *
 * Un technicien saisit ça debout, une main sur l'échelle : le formulaire tient
 * en quatre champs dont un seul est obligatoire, et la gravité se choisit dans
 * une liste courte plutôt que sur une échelle numérique à interpréter.
 */
export function AnomalyPanel({
  interventionId,
  initial,
  readOnly,
}: {
  interventionId: string;
  initial: AnomalyItem[];
  readOnly: boolean;
}) {
  const [items, setItems] = useState<AnomalyItem[]>(initial);
  const [editing, setEditing] = useState<AnomalyItem | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  const open = items.filter((a) => a.status === "OPEN").length;

  function changeStatus(anomaly: AnomalyItem, status: AnomalyStatus) {
    startTransition(async () => {
      const result = await setAnomalyStatusAction(anomaly.id, status);
      if (result.ok) {
        setItems((current) =>
          current.map((a) => (a.id === anomaly.id ? { ...a, status } : a)),
        );
        toast.success(
          status === "RESOLVED" ? "Anomalie résolue." : "Anomalie rouverte.",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(anomaly: AnomalyItem) {
    startTransition(async () => {
      const result = await deleteAnomalyAction(anomaly.id);
      if (result.ok) {
        setItems((current) => current.filter((a) => a.id !== anomaly.id));
        toast.success("Anomalie supprimée.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">
          Anomalies
          {items.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {open} ouverte{open > 1 ? "s" : ""} sur {items.length}
            </span>
          )}
        </h2>
        {!readOnly && (
          <Button
            type="button"
            onClick={() => setEditing("new")}
            className="h-11 gap-1.5"
          >
            <Plus className="size-4" />
            Signaler
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Aucune anomalie n'a été relevée lors de cette intervention."
            : "Aucune anomalie relevée. Signalez ici tout constat à porter au rapport."}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((anomaly) => (
            <li
              key={anomaly.id}
              className={cn(
                "rounded-lg border p-3.5",
                anomaly.status === "OPEN"
                  ? "border-severity-high/25 bg-severity-high/5"
                  : "border-border opacity-75",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <TriangleAlert
                  className={cn(
                    "size-4 shrink-0",
                    anomaly.status === "OPEN"
                      ? "text-severity-high"
                      : "text-muted-foreground",
                  )}
                />
                <span className="font-medium">{anomaly.title}</span>
                <SeverityBadge severity={anomaly.severity} />
                <span className="text-xs text-muted-foreground">
                  {ANOMALY_STATUS_LABEL[anomaly.status]}
                </span>
              </div>

              {anomaly.description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {anomaly.description}
                </p>
              )}
              {anomaly.recommendation && (
                <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">
                  <span className="font-medium">Recommandation · </span>
                  {anomaly.recommendation}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {anomaly.status === "OPEN" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => changeStatus(anomaly, "RESOLVED")}
                    className="gap-1.5"
                  >
                    <Check className="size-3.5" />
                    Marquer résolue
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => changeStatus(anomaly, "OPEN")}
                    className="gap-1.5"
                  >
                    <X className="size-3.5" />
                    Rouvrir
                  </Button>
                )}

                {!readOnly && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(anomaly)}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => remove(anomaly)}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Supprimer
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AnomalyDialog
          interventionId={interventionId}
          anomaly={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) =>
            setItems((current) =>
              current.some((a) => a.id === saved.id)
                ? current.map((a) => (a.id === saved.id ? saved : a))
                : [...current, saved],
            )
          }
        />
      )}
    </section>
  );
}

const SEVERITIES = [
  AnomalySeverity.INFO,
  AnomalySeverity.LOW,
  AnomalySeverity.MEDIUM,
  AnomalySeverity.HIGH,
  AnomalySeverity.CRITICAL,
];

function AnomalyDialog({
  interventionId,
  anomaly,
  onClose,
  onSaved,
}: {
  interventionId: string;
  anomaly: AnomalyItem | null;
  onClose: () => void;
  onSaved: (anomaly: AnomalyItem) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setErrors({});
    startTransition(async () => {
      const result = anomaly
        ? await updateAnomalyAction(anomaly.id, formData)
        : await createAnomalyAction(interventionId, formData);

      if (result.ok) {
        onSaved(result.data as AnomalyItem);
        toast.success(anomaly ? "Anomalie mise à jour." : "Anomalie enregistrée.");
        onClose();
      } else {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {anomaly ? "Modifier l'anomalie" : "Signaler une anomalie"}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Ce constat figurera dans le rapport remis au client et restera dans
            l&apos;historique de l&apos;équipement.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4" noValidate>
          <TextField
            name="title"
            label="Constat"
            required
            defaultValue={anomaly?.title}
            error={errors.title?.[0]}
            placeholder="Fissure du raccord"
            autoComplete="off"
          />
          <SelectField
            name="severity"
            label="Gravité"
            required
            defaultValue={anomaly?.severity ?? AnomalySeverity.MEDIUM}
            error={errors.severity?.[0]}
            options={SEVERITIES.map((s) => ({
              value: s,
              label: ANOMALY_SEVERITY_LABEL[s],
            }))}
          />
          <TextAreaField
            name="description"
            label="Description"
            rows={3}
            defaultValue={anomaly?.description}
            error={errors.description?.[0]}
            placeholder="Ce qui a été constaté, où, et dans quel état."
          />
          <TextAreaField
            name="recommendation"
            label="Recommandation"
            rows={2}
            defaultValue={anomaly?.recommendation}
            error={errors.recommendation?.[0]}
            placeholder="Ce qu'il convient de faire, sans chiffrage."
          />

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {anomaly ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
