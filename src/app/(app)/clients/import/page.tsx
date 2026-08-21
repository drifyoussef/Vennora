import type { Metadata } from "next";

import { PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Reprendre un fichier clients" };

export default async function ImportPage() {
  await getPageContext("customer.create");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Reprendre un fichier clients"
        description="Un export de tableur suffit. Rien n'est enregistré avant votre validation."
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: "Reprise" }]}
      />
      <ImportForm />
    </div>
  );
}
