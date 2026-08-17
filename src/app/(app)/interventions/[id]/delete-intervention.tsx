"use client";

import { ConfirmDelete } from "@/components/vennora/confirm-delete";
import { deleteInterventionAction } from "../actions";

export function DeleteIntervention({
  id,
  reference,
}: {
  id: string;
  reference: string;
}) {
  return (
    <ConfirmDelete
      action={() => deleteInterventionAction(id)}
      entityName={reference}
      title="Supprimer cette intervention ?"
      description="L'intervention, ses photos, ses notes et ses anomalies seront supprimées. Cette action est irréversible."
      redirectTo="/interventions"
      triggerVariant="ghost"
    />
  );
}
