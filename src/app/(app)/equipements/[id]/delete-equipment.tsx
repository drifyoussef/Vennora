"use client";

import { ConfirmDelete } from "@/components/vennora/confirm-delete";
import { deleteEquipmentAction } from "../actions";

export function DeleteEquipment({
  id,
  name,
  siteId,
  interventionCount,
}: {
  id: string;
  name: string;
  siteId: string;
  interventionCount: number;
}) {
  const hasHistory = interventionCount > 0;

  return (
    <ConfirmDelete
      action={() => deleteEquipmentAction(id)}
      entityName={name}
      title={hasHistory ? "Retirer cet équipement du parc ?" : "Supprimer cet équipement ?"}
      description={
        hasHistory
          ? `Cet équipement porte ${interventionCount} intervention${interventionCount > 1 ? "s" : ""}. Il sera retiré du parc et n'apparaîtra plus dans les listes, mais son historique et ses rapports restent consultables.`
          : "Cet équipement n'a aucun historique. Il sera définitivement supprimé."
      }
      redirectTo={`/sites/${siteId}`}
      triggerLabel={hasHistory ? "Retirer du parc" : "Supprimer"}
    />
  );
}
