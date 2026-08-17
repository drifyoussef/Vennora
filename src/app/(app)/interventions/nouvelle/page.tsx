import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { getInterventionTypes } from "@/core/catalog";
import { getPageContext } from "@/core/context";
import { listCustomerOptions } from "@/core/data/customers";
import { listTechnicians } from "@/core/data/interventions";
import { objectId } from "@/core/schemas";
import { InterventionForm } from "../intervention-form";

export const metadata: Metadata = { title: "Nouvelle intervention" };

export default async function NewInterventionPage({
  searchParams,
}: PageProps<"/interventions/nouvelle">) {
  const context = await getPageContext("intervention.create");
  const params = await searchParams;

  const [customers, technicians, types] = await Promise.all([
    listCustomerOptions(context),
    listTechnicians(context),
    getInterventionTypes(context.user.org.tradeSlug),
  ]);

  if (customers.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader
          title="Nouvelle intervention"
          breadcrumbs={[
            { label: "Interventions", href: "/interventions" },
            { label: "Nouvelle" },
          ]}
        />
        <EmptyState
          icon={Users}
          title="Aucun client"
          description="Une intervention se planifie chez un client, sur un de ses sites. Créez d'abord un client."
          action={
            <Button asChild>
              <Link href="/clients/nouveau">Créer un client</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Préremplissage depuis une fiche client, site ou équipement.
  const initial = resolvePreset(customers, params);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nouvelle intervention"
        breadcrumbs={[
          { label: "Interventions", href: "/interventions" },
          { label: "Nouvelle" },
        ]}
      />
      <InterventionForm
        customers={customers}
        technicians={technicians}
        types={types}
        cancelHref="/interventions"
        initial={{
          ...initial,
          technicianId:
            context.user.role === "TECHNICIAN" ? context.user.id : undefined,
        }}
      />
    </div>
  );
}

/**
 * Déduit client / site / équipement des paramètres d'URL.
 *
 * On remonte toujours la chaîne complète : arriver depuis un équipement doit
 * présélectionner son site et son client, sinon les sélecteurs dépendants
 * restent vides et le préremplissage ne sert à rien.
 */
function resolvePreset(
  customers: Awaited<ReturnType<typeof listCustomerOptions>>,
  params: Record<string, string | string[] | undefined>,
) {
  const read = (key: string) => {
    const raw = params[key];
    if (typeof raw !== "string") return null;
    const parsed = objectId.safeParse(raw);
    return parsed.success ? parsed.data : null;
  };

  const equipmentId = read("equipement");
  if (equipmentId) {
    for (const customer of customers) {
      for (const site of customer.sites) {
        if (site.equipments.some((e) => e.id === equipmentId)) {
          return { customerId: customer.id, siteId: site.id, equipmentId };
        }
      }
    }
  }

  const siteId = read("site");
  if (siteId) {
    const customer = customers.find((c) =>
      c.sites.some((s) => s.id === siteId),
    );
    if (customer) return { customerId: customer.id, siteId };
  }

  const customerId = read("client");
  if (customerId && customers.some((c) => c.id === customerId)) {
    return { customerId };
  }

  return {};
}
