"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { saveNotesAction } from "./photo-actions";

/**
 * Notes libres du terrain.
 *
 * Enregistrement automatique deux secondes après la dernière frappe : un
 * technicien qui range son téléphone au milieu d'une phrase ne doit pas perdre
 * ce qu'il vient d'écrire, et lui demander d'appuyer sur « Enregistrer » à
 * chaque fois est une invitation à l'oubli.
 */
export function NotesPanel({
  interventionId,
  initial,
  readOnly,
}: {
  interventionId: string;
  initial: string;
  readOnly: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const saved = useRef(initial);

  useEffect(() => {
    if (readOnly || value === saved.current) return;

    const timer = setTimeout(async () => {
      setState("saving");
      const result = await saveNotesAction(interventionId, value);
      if (result.ok) {
        saved.current = value;
        setState("saved");
      } else {
        setState("idle");
        toast.error(result.error);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [value, interventionId, readOnly]);

  // L'indicateur « enregistré » s'efface tout seul : le laisser en
  // permanence le rendrait invisible à force d'être là.
  useEffect(() => {
    if (state !== "saved") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">Notes</h2>
        <span
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {state === "saving" && (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Enregistrement…
            </>
          )}
          {state === "saved" && (
            <>
              <Check className="size-3.5 text-status-done" />
              Enregistré
            </>
          )}
        </span>
      </div>

      {readOnly ? (
        value ? (
          <p className="text-sm whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune note.</p>
        )
      ) : (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          maxLength={8000}
          placeholder="Ce que vous avez constaté, fait, ou ce qu'il faudra prévoir. Ces notes alimentent le compte-rendu."
          className="resize-y"
        />
      )}
    </section>
  );
}
