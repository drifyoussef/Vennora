"use client";

import { ConfirmDelete } from "@/components/vennora/confirm-delete";
import { deleteSiteAction } from "../actions";

export function DeleteSite({
  id,
  name,
  customerId,
  equipmentCount,
}: {
  id: string;
  name: string;
  customerId: string;
  equipmentCount: number;
}) {
  return (
    <ConfirmDelete
      action={() => deleteSiteAction(id)}
      entityName={name}
      title="Supprimer ce site ?"
      description={
        equipmentCount > 0
          ? `Les ${equipmentCount} équipement${equipmentCount > 1 ? "s" : ""} de ce site et les interventions non terminées seront supprimés. Cette action est irréversible.`
          : "Cette action est irréversible."
      }
      redirectTo={`/clients/${customerId}`}
      requireTyping={equipmentCount > 0}
    />
  );
}
