"use client";

import { ConfirmDelete } from "@/components/vennora/confirm-delete";
import { deleteCustomerAction } from "../actions";

export function DeleteCustomer({
  id,
  name,
  siteCount,
}: {
  id: string;
  name: string;
  siteCount: number;
}) {
  return (
    <ConfirmDelete
      action={() => deleteCustomerAction(id)}
      entityName={name}
      title="Supprimer ce client ?"
      description={
        siteCount > 0
          ? `Les ${siteCount} site${siteCount > 1 ? "s" : ""} de ce client, leurs équipements et les interventions non terminées seront supprimés. Cette action est irréversible.`
          : "Cette action est irréversible."
      }
      redirectTo="/clients"
      requireTyping={siteCount > 0}
    />
  );
}
