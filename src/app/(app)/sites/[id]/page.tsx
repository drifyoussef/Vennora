import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  KeyRound,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge, TechnicianChip, TypeBadge } from "@/components/vennora/badges";
import {
  EmptyState,
  Field,
  FieldGrid,
  PageHeader,
} from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { getSite } from "@/core/data/sites";
import { plural } from "@/core/labels";
import { can } from "@/core/permissions";
import { objectId } from "@/core/schemas";
import { formatAddress, formatDate, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DeleteSite } from "./delete-site";

export async function generateMetadata({
  params,
}: PageProps<"/sites/[id]">): Promise<Metadata> {
  const { db } = await getPageContext("site.view");
  const { id } = await params;
  const parsed = objectId.safeParse(id);
  if (!parsed.success) return { title: "Site" };

  const site = await db.site.findFirst({
    where: { id: parsed.data },
    select: { name: true },
  });
  return { title: site?.name ?? "Site" };
}

export default async function SitePage({ params }: PageProps<"/sites/[id]">) {
  const context = await getPageContext("site.view");
  const { id } = await params;

  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();

  let site;
  try {
    site = await getSite(context, parsed.data);
  } catch {
    notFound();
  }

  const { role } = context.user;
  const mapsQuery = encodeURIComponent(
    `${site.address}, ${site.postalCode} ${site.city}`,
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: site.customer.name, href: `/clients/${site.customer.id}` },
          { label: site.name },
        ]}
        title={site.name}
        description={formatAddress(site)}
        actions={
          <>
            {can(role, "site.update") && (
              <Button asChild variant="outline" className="gap-1.5">
                <Link href={`/sites/${site.id}/modifier`}>
                  <Pencil className="size-4" />
                  Modifier
                </Link>
              </Button>
            )}
            <Button asChild className="gap-1.5">
              <Link href={`/interventions/nouvelle?site=${site.id}`}>
                <Plus className="size-4" />
                Intervention
              </Link>
            </Button>
          </>
        }
      />

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <FieldGrid className="lg:grid-cols-4">
          <Field label="Client">
            <Link
              href={`/clients/${site.customer.id}`}
              className="font-medium hover:underline"
            >
              {site.customer.name}
            </Link>
          </Field>
          <Field label="Téléphone">
            {site.customer.phone ? (
              <a
                href={`tel:${site.customer.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 tabular-nums hover:underline"
              >
                <Phone className="size-3.5 text-muted-foreground" />
                {formatPhone(site.customer.phone)}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Adresse">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-start gap-1.5 hover:underline"
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              {formatAddress(site)}
            </a>
          </Field>
          <Field label="Créé le">{formatDate(site.createdAt)}</Field>
        </FieldGrid>

        {site.accessNotes && (
          <div className="mt-5 flex gap-3 rounded-lg border border-brand/25 bg-brand-subtle px-3.5 py-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-medium tracking-wide text-brand uppercase">
                Consignes d&apos;accès
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {site.accessNotes}
              </p>
            </div>
          </div>
        )}

        {site.notes && (
          <div className="mt-4 rounded-lg bg-muted/60 p-3.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Notes
            </p>
            <p className="mt-1.5 text-sm whitespace-pre-wrap">{site.notes}</p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">
            Équipements
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {plural(site.equipments.length, "appareil", "appareils")}
            </span>
          </h2>
          {can(role, "equipment.create") && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/equipements/nouveau?site=${site.id}`}>
                <Plus className="size-4" />
                Ajouter
              </Link>
            </Button>
          )}
        </div>

        {site.equipments.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Aucun équipement déclaré"
            description="Déclarez les appareils présents sur ce site pour suivre leur historique et générer leurs QR codes."
            action={
              can(role, "equipment.create") && (
                <Button asChild>
                  <Link href={`/equipements/nouveau?site=${site.id}`}>
                    Ajouter un équipement
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {site.equipments.map((equipment) => {
              const overdue =
                equipment.nextDueAt && equipment.nextDueAt < new Date();

              return (
                <li key={equipment.id}>
                  <Link
                    href={`/equipements/${equipment.id}`}
                    className={cn(
                      "flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/25 hover:bg-accent/40",
                      !equipment.active && "opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">
                        {equipment.label ?? equipment.type.label}
                      </p>
                      {equipment.location && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {equipment.location}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[equipment.brand, equipment.model]
                        .filter(Boolean)
                        .join(" ") || equipment.type.label}
                    </p>
                    <div className="mt-auto space-y-1 border-t border-border pt-3 text-xs">
                      <p className="text-muted-foreground">
                        Dernier passage ·{" "}
                        {formatDate(equipment.lastInterventionAt)}
                      </p>
                      <p
                        className={cn(
                          overdue
                            ? "font-medium text-severity-high"
                            : "text-muted-foreground",
                        )}
                      >
                        Prochaine échéance · {formatDate(equipment.nextDueAt)}
                        {overdue && " (dépassée)"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading mb-3 text-lg font-semibold">
          Interventions sur ce site
        </h2>
        {site.interventions.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Aucune intervention"
            description="L'historique du site apparaîtra ici."
          />
        ) : (
          <ul className="space-y-2">
            {site.interventions.map((intervention) => (
              <li key={intervention.id}>
                <Link
                  href={`/interventions/${intervention.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-primary/25 hover:bg-accent/40"
                >
                  <span className="w-24 shrink-0 text-sm tabular-nums">
                    {formatDate(intervention.scheduledStart)}
                  </span>
                  <TypeBadge
                    label={intervention.type.label}
                    colorHex={intervention.type.colorHex}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {intervention.equipment
                      ? (intervention.equipment.label ??
                        intervention.equipment.type.label)
                      : "—"}
                  </span>
                  <TechnicianChip
                    firstName={intervention.technician.firstName}
                    lastName={intervention.technician.lastName}
                    colorHex={intervention.technician.colorHex}
                  />
                  <StatusBadge status={intervention.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {can(role, "site.delete") && (
        <div className="mt-10 border-t border-border pt-6">
          <DeleteSite
            id={site.id}
            name={site.name}
            customerId={site.customer.id}
            equipmentCount={site.equipments.length}
          />
        </div>
      )}
    </>
  );
}
