import type { Metadata } from "next";

import { PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { objectId } from "@/core/schemas";
import { SiteForm } from "../site-form";

export const metadata: Metadata = { title: "Nouveau site" };

export default async function NewSitePage({
  searchParams,
}: PageProps<"/sites/nouveau">) {
  const { db } = await getPageContext("site.create");
  const params = await searchParams;

  const customers = await db.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Arrivée depuis une fiche client : on présélectionne et on verrouille le
  // rattachement, pour éviter de recréer un site chez le mauvais client.
  const requested =
    typeof params.client === "string"
      ? objectId.safeParse(params.client)
      : null;
  const preset =
    requested?.success && customers.some((c) => c.id === requested.data)
      ? requested.data
      : undefined;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nouveau site"
        breadcrumbs={[{ label: "Sites", href: "/sites" }, { label: "Nouveau" }]}
      />
      <SiteForm
        customers={customers}
        cancelHref={preset ? `/clients/${preset}` : "/sites"}
        lockCustomer={Boolean(preset)}
        initial={preset ? { customerId: preset } : undefined}
      />
    </div>
  );
}
