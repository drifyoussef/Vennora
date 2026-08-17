import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Building2,
  ChevronRight,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  TriangleAlert,
  UserRound,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  Field,
  FieldGrid,
  PageHeader,
} from "@/components/vennora/page";
import { StatusBadge, TechnicianChip, TypeBadge } from "@/components/vennora/badges";
import { getPageContext } from "@/core/context";
import { getCustomer } from "@/core/data/customers";
import { CUSTOMER_KIND_LABEL, DOCUMENT_CATEGORY_LABEL, plural } from "@/core/labels";
import { can } from "@/core/permissions";
import { objectId } from "@/core/schemas";
import { CustomerKind } from "@/core/enums";
import {
  formatAddress,
  formatDate,
  formatDateTime,
  formatPhone,
} from "@/lib/format";
import { DeleteCustomer } from "./delete-customer";

export async function generateMetadata({
  params,
}: PageProps<"/clients/[id]">): Promise<Metadata> {
  const context = await getPageContext("customer.view");
  const { id } = await params;
  const parsed = objectId.safeParse(id);
  if (!parsed.success) return { title: "Client" };

  const customer = await context.db.customer.findFirst({
    where: { id: parsed.data },
    select: { name: true },
  });
  return { title: customer?.name ?? "Client" };
}

export default async function CustomerPage({ params }: PageProps<"/clients/[id]">) {
  const context = await getPageContext("customer.view");
  const { id } = await params;

  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();

  let customer;
  try {
    customer = await getCustomer(context, parsed.data);
  } catch {
    notFound();
  }

  const { role } = context.user;
  const canEdit = can(role, "customer.update");
  const canDelete = can(role, "customer.delete");
  const canAddSite = can(role, "site.create");

  const equipmentCount = customer.sites.reduce(
    (sum, site) => sum + site._count.equipments,
    0,
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: customer.name },
        ]}
        title={
          <span className="flex items-center gap-2.5">
            {customer.kind === CustomerKind.COMPANY ? (
              <Building2 className="size-6 shrink-0 text-muted-foreground" />
            ) : (
              <UserRound className="size-6 shrink-0 text-muted-foreground" />
            )}
            {customer.name}
          </span>
        }
        description={`${CUSTOMER_KIND_LABEL[customer.kind]} · client depuis le ${formatDate(customer.createdAt)}`}
        actions={
          <>
            {canEdit && (
              <Button asChild variant="outline" className="gap-1.5">
                <Link href={`/clients/${customer.id}/modifier`}>
                  <Pencil className="size-4" />
                  Modifier
                </Link>
              </Button>
            )}
            <Button asChild className="gap-1.5">
              <Link href={`/interventions/nouvelle?client=${customer.id}`}>
                <Plus className="size-4" />
                Intervention
              </Link>
            </Button>
          </>
        }
      />

      {/* Contact : toujours visible, hors onglets. C'est ce qu'on vient
          chercher neuf fois sur dix en ouvrant une fiche client. */}
      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <FieldGrid className="lg:grid-cols-4">
          <Field label="Téléphone">
            {customer.phone ? (
              <a
                href={`tel:${customer.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 font-medium tabular-nums hover:underline"
              >
                <Phone className="size-3.5 text-muted-foreground" />
                {formatPhone(customer.phone)}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Téléphone secondaire">
            {formatPhone(customer.phoneSecondary)}
          </Field>
          <Field label="E-mail">
            {customer.email ? (
              <a
                href={`mailto:${customer.email}`}
                className="inline-flex items-center gap-1.5 break-all hover:underline"
              >
                <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                {customer.email}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Adresse de facturation">
            {formatAddress(customer)}
          </Field>
        </FieldGrid>

        {customer.notes && (
          <div className="mt-5 rounded-lg bg-muted/60 p-3.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Notes internes
            </p>
            <p className="mt-1.5 text-sm whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}

        {customer.openAnomalies > 0 && (
          <Link
            href={`/anomalies?client=${customer.id}`}
            className="mt-5 flex items-center gap-2 rounded-lg border border-severity-high/25 bg-severity-high/8 px-3.5 py-3 text-sm text-severity-high transition-colors hover:bg-severity-high/12"
          >
            <TriangleAlert className="size-4 shrink-0" />
            <span className="font-medium">
              {plural(customer.openAnomalies, "anomalie ouverte", "anomalies ouvertes")}
            </span>
            <ChevronRight className="ml-auto size-4" />
          </Link>
        )}
      </section>

      <Tabs defaultValue="sites">
        <TabsList className="mb-4">
          <TabsTrigger value="sites">
            Sites
            <span className="ml-1.5 text-xs tabular-nums opacity-60">
              {customer.sites.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="equipements">
            Équipements
            <span className="ml-1.5 text-xs tabular-nums opacity-60">
              {equipmentCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="interventions">
            Interventions
            <span className="ml-1.5 text-xs tabular-nums opacity-60">
              {customer.interventions.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            <span className="ml-1.5 text-xs tabular-nums opacity-60">
              {customer.documents.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sites">
          {customer.sites.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Aucun site"
              description="Un site est un lieu d'intervention : maison principale, résidence secondaire, local professionnel…"
              action={
                canAddSite && (
                  <Button asChild>
                    <Link href={`/sites/nouveau?client=${customer.id}`}>
                      Ajouter un site
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-3">
              {customer.sites.map((site) => (
                <div
                  key={site.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/sites/${site.id}`}
                        className="font-medium hover:underline"
                      >
                        {site.name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        {formatAddress(site)}
                      </p>
                      {site.accessNotes && (
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          Accès · {site.accessNotes}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {plural(site._count.equipments, "équipement")}
                    </span>
                  </div>

                  {site.equipments.length > 0 && (
                    <ul className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
                      {site.equipments.map((equipment) => (
                        <li key={equipment.id}>
                          <Link
                            href={`/equipements/${equipment.id}`}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50"
                          >
                            <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {equipment.label ?? equipment.type.label}
                              {equipment.brand && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {equipment.brand}
                                </span>
                              )}
                            </span>
                            {equipment.location && (
                              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                {equipment.location}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {canAddSite && (
                <Button asChild variant="outline" className="gap-1.5">
                  <Link href={`/sites/nouveau?client=${customer.id}`}>
                    <Plus className="size-4" />
                    Ajouter un site
                  </Link>
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="equipements">
          {equipmentCount === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Aucun équipement"
              description="Les équipements sont rattachés à un site. Créez d'abord un site, puis déclarez les appareils qu'il abrite."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {customer.sites.flatMap((site) =>
                site.equipments.map((equipment) => (
                  <Link
                    key={equipment.id}
                    href={`/equipements/${equipment.id}`}
                    className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/25 hover:bg-accent/40"
                  >
                    <p className="font-medium">
                      {equipment.label ?? equipment.type.label}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[equipment.brand, equipment.model]
                        .filter(Boolean)
                        .join(" ") || equipment.type.label}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {site.name}
                      {equipment.location && ` · ${equipment.location}`}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs">
                      <span className="text-muted-foreground">
                        Dernier passage {formatDate(equipment.lastInterventionAt)}
                      </span>
                    </div>
                  </Link>
                )),
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="interventions">
          {customer.interventions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucune intervention"
              description="L'historique des passages apparaîtra ici."
              action={
                <Button asChild>
                  <Link href={`/interventions/nouvelle?client=${customer.id}`}>
                    Planifier une intervention
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {customer.interventions.map((intervention) => (
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
                      {intervention.site.name}
                      {intervention.equipment &&
                        ` · ${intervention.equipment.label ?? intervention.equipment.type.label}`}
                    </span>
                    {intervention._count.anomalies > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-severity-high">
                        <TriangleAlert className="size-3.5" />
                        {intervention._count.anomalies}
                      </span>
                    )}
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
        </TabsContent>

        <TabsContent value="documents">
          {customer.documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucun document"
              description="Les rapports d'intervention signés seront rangés ici automatiquement."
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {customer.documents.map((document) => (
                <li
                  key={document.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {document.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {DOCUMENT_CATEGORY_LABEL[document.category]}
                  </span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {formatDateTime(document.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {canDelete && (
        <div className="mt-10 border-t border-border pt-6">
          <DeleteCustomer
            id={customer.id}
            name={customer.name}
            siteCount={customer.sites.length}
          />
        </div>
      )}
    </>
  );
}
