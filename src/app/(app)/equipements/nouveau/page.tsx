import type { Metadata } from "next";

import { EmptyState, PageHeader } from "@/components/vennora/page";
import { Button } from "@/components/ui/button";
import { getPageContext } from "@/core/context";
import { getEquipmentTypes } from "@/core/catalog";
import { objectId } from "@/core/schemas";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { EquipmentForm } from "../equipment-form";

export const metadata: Metadata = { title: "Nouvel équipement" };

export default async function NewEquipmentPage({
  searchParams,
}: PageProps<"/equipements/nouveau">) {
  const { db, user } = await getPageContext("equipment.create");
  const params = await searchParams;

  const [sites, types] = await Promise.all([
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

  if (sites.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader
          title="Nouvel équipement"
          breadcrumbs={[
            { label: "Équipements", href: "/equipements" },
            { label: "Nouveau" },
          ]}
        />
        <EmptyState
          icon={MapPin}
          title="Aucun site disponible"
          description="Un équipement est toujours rattaché à un site. Créez d'abord un client et son site."
          action={
            <Button asChild>
              <Link href="/clients/nouveau">Créer un client</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const requested =
    typeof params.site === "string" ? objectId.safeParse(params.site) : null;
  const preset =
    requested?.success && sites.some((s) => s.id === requested.data)
      ? requested.data
      : undefined;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nouvel équipement"
        breadcrumbs={[
          { label: "Équipements", href: "/equipements" },
          { label: "Nouveau" },
        ]}
      />
      <EquipmentForm
        sites={sites.map((s) => ({
          id: s.id,
          name: s.name,
          city: s.city,
          customerName: s.customer.name,
        }))}
        types={types}
        cancelHref={preset ? `/sites/${preset}` : "/equipements"}
        lockSite={Boolean(preset)}
        initial={preset ? { siteId: preset } : undefined}
      />
    </div>
  );
}
