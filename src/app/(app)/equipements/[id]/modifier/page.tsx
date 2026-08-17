import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/vennora/page";
import { getEquipmentTypes } from "@/core/catalog";
import { getPageContext } from "@/core/context";
import { objectId } from "@/core/schemas";
import { EquipmentForm } from "../../equipment-form";

export const metadata: Metadata = { title: "Modifier l'équipement" };

export default async function EditEquipmentPage({
  params,
}: PageProps<"/equipements/[id]/modifier">) {
  const { db, user } = await getPageContext("equipment.update");
  const { id } = await params;

  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();

  const [equipment, sites, types] = await Promise.all([
    db.equipment.findFirst({
      where: { id: parsed.data },
      select: {
        id: true,
        siteId: true,
        typeId: true,
        label: true,
        brand: true,
        model: true,
        serialNumber: true,
        location: true,
        installedAt: true,
        description: true,
        notes: true,
        type: { select: { label: true } },
      },
    }),
    db.site.findMany({
      orderBy: [{ customer: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        city: true,
        customer: { select: { name: true } },
      },
    }),
    getEquipmentTypes(user.org.tradeSlug),
  ]);

  if (!equipment) notFound();

  const name = equipment.label ?? equipment.type.label;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={name}
        description="Modification de l'équipement."
        breadcrumbs={[
          { label: "Équipements", href: "/equipements" },
          { label: name, href: `/equipements/${equipment.id}` },
          { label: "Modifier" },
        ]}
      />
      <EquipmentForm
        initial={equipment}
        sites={sites.map((s) => ({
          id: s.id,
          name: s.name,
          city: s.city,
          customerName: s.customer.name,
        }))}
        types={types}
        cancelHref={`/equipements/${equipment.id}`}
      />
    </div>
  );
}
