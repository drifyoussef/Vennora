import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/vennora/page";
import { getInterventionTypes } from "@/core/catalog";
import { getPageContext } from "@/core/context";
import { listCustomerOptions } from "@/core/data/customers";
import { listTechnicians } from "@/core/data/interventions";
import { objectId } from "@/core/schemas";
import { InterventionStatus, UserRole } from "@/core/enums";
import { InterventionForm } from "../../intervention-form";

export const metadata: Metadata = { title: "Replanifier" };

export default async function EditInterventionPage({
  params,
}: PageProps<"/interventions/[id]/modifier">) {
  const context = await getPageContext("intervention.update");
  const { id } = await params;

  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();

  const intervention = await context.db.intervention.findFirst({
    where: { id: parsed.data },
    select: {
      id: true,
      reference: true,
      customerId: true,
      siteId: true,
      equipmentId: true,
      technicianId: true,
      typeId: true,
      scheduledStart: true,
      scheduledEnd: true,
      notes: true,
      internalNotes: true,
      status: true,
    },
  });

  if (!intervention) notFound();
  if (
    context.user.role === UserRole.TECHNICIAN &&
    intervention.technicianId !== context.user.id
  ) {
    notFound();
  }

  // Une intervention terminée est signée : on ne la replanifie pas, on
  // renvoie vers la fiche plutôt que d'afficher un formulaire qui échouera.
  if (intervention.status === InterventionStatus.COMPLETED) {
    redirect(`/interventions/${intervention.id}`);
  }

  const [customers, technicians, types] = await Promise.all([
    listCustomerOptions(context),
    listTechnicians(context),
    getInterventionTypes(context.user.org.tradeSlug),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Replanifier l'intervention"
        description={intervention.reference}
        breadcrumbs={[
          { label: "Interventions", href: "/interventions" },
          {
            label: intervention.reference,
            href: `/interventions/${intervention.id}`,
          },
          { label: "Replanifier" },
        ]}
      />
      <InterventionForm
        initial={intervention}
        customers={customers}
        technicians={technicians}
        types={types}
        cancelHref={`/interventions/${intervention.id}`}
      />
    </div>
  );
}
