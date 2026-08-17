"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InterventionStatus } from "@/core/enums";
import { setInterventionStatusAction } from "../actions";

/**
 * Boutons de progression.
 *
 * Un seul geste principal visible à la fois : depuis « planifiée » on démarre,
 * depuis « en cours » on termine. Le technicien ne doit pas avoir à choisir
 * parmi quatre statuts au milieu d'un chantier.
 */
export function StatusActions({
  id,
  status,
}: {
  id: string;
  status: InterventionStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(next: InterventionStatus, message: string) {
    startTransition(async () => {
      const result = await setInterventionStatusAction(id, next);
      if (result.ok) {
        toast.success(message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (status === InterventionStatus.COMPLETED) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === InterventionStatus.PLANNED && (
        <>
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              move(InterventionStatus.IN_PROGRESS, "Intervention démarrée.")
            }
            className="gap-1.5"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Démarrer l&apos;intervention
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              move(InterventionStatus.CANCELLED, "Intervention annulée.")
            }
            className="gap-1.5 text-muted-foreground"
          >
            <XCircle className="size-4" />
            Annuler
          </Button>
        </>
      )}

      {status === InterventionStatus.IN_PROGRESS && (
        <>
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              move(InterventionStatus.COMPLETED, "Intervention terminée.")
            }
            className="gap-1.5"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Terminer l&apos;intervention
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              move(InterventionStatus.PLANNED, "Intervention remise en attente.")
            }
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="size-4" />
            Remettre en attente
          </Button>
        </>
      )}

      {status === InterventionStatus.CANCELLED && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            move(InterventionStatus.PLANNED, "Intervention réactivée.")
          }
          className="gap-1.5"
        >
          <RotateCcw className="size-4" />
          Réactiver
        </Button>
      )}
    </div>
  );
}
