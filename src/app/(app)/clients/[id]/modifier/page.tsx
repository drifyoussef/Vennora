import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { objectId } from "@/core/schemas";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Modifier le client" };

export default async function EditCustomerPage({
  params,
}: PageProps<"/clients/[id]/modifier">) {
  const { db } = await getPageContext("customer.update");
  const { id } = await params;

  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();

  const customer = await db.customer.findFirst({
    where: { id: parsed.data },
    select: {
      id: true,
      kind: true,
      name: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      phone: true,
      phoneSecondary: true,
      address: true,
      postalCode: true,
      city: true,
      notes: true,
    },
  });

  if (!customer) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={customer.name}
        description="Modification de la fiche client."
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: customer.name, href: `/clients/${customer.id}` },
          { label: "Modifier" },
        ]}
      />
      <CustomerForm
        initial={customer}
        cancelHref={`/clients/${customer.id}`}
      />
    </div>
  );
}
