import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { objectId } from "@/core/schemas";
import { SiteForm } from "../../site-form";

export const metadata: Metadata = { title: "Modifier le site" };

export default async function EditSitePage({
  params,
}: PageProps<"/sites/[id]/modifier">) {
  const { db } = await getPageContext("site.update");
  const { id } = await params;

  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();

  const [site, customers] = await Promise.all([
    db.site.findFirst({
      where: { id: parsed.data },
      select: {
        id: true,
        customerId: true,
        name: true,
        address: true,
        addressComplement: true,
        postalCode: true,
        city: true,
        latitude: true,
        longitude: true,
        notes: true,
        accessNotes: true,
      },
    }),
    db.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!site) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={site.name}
        description="Modification du site."
        breadcrumbs={[
          { label: "Sites", href: "/sites" },
          { label: site.name, href: `/sites/${site.id}` },
          { label: "Modifier" },
        ]}
      />
      <SiteForm
        initial={site}
        customers={customers}
        cancelHref={`/sites/${site.id}`}
      />
    </div>
  );
}
