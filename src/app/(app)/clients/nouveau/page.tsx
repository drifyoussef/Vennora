import type { Metadata } from "next";

import { PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Nouveau client" };

export default async function NewCustomerPage() {
  await getPageContext("customer.create");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nouveau client"
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: "Nouveau" }]}
      />
      <CustomerForm cancelHref="/clients" />
    </div>
  );
}
