import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Pencil, Plus, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Field,
  FieldGrid,
  PageHeader,
} from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { getEquipment } from "@/core/data/equipment";
import { plural } from "@/core/labels";
import { can } from "@/core/permissions";
import { objectId } from "@/core/schemas";
import { equipmentQrUrl, renderEquipmentQrSvg } from "@/services/qrcode";
import { formatAddress, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DeleteEquipment } from "./delete-equipment";
import { EquipmentHistory } from "./history";
import { QrPanel } from "./qr-panel";

export async function generateMetadata({
  params,
}: PageProps<"/equipements/[id]">): Promise<Metadata> {
  const { db } = await getPageContext("equipment.view");
  const { id } = await params;
  const parsed = objectId.safeParse(id);
  if (!parsed.success) return { title: "Équipement" };

  const equipment = await db.equipment.findFirst({
    where: { id: parsed.data },
    select: { label: true, type: { select: { label: true } } },
  });
  return { title: equipment?.label ?? equipment?.type.label ?? "Équipement" };
}

export default async function EquipmentDetailPage({
  params,
}: PageProps<"/equipements/[id]">) {
  const context = await getPageContext("equipment.view");
  const { id } = await params;

  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();

  let equipment;
  try {
    equipment = await getEquipment(context, parsed.data);
  } catch {
    notFound();
  }

  const { role } = context.user;
  const name = equipment.label ?? equipment.type.label;
  const qrSvg = await renderEquipmentQrSvg(equipment.qrToken);
  const overdue = equipment.nextDueAt && equipment.nextDueAt < new Date();

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          {
            label: equipment.site.customer.name,
            href: `/clients/${equipment.site.customer.id}`,
          },
          { label: equipment.site.name, href: `/sites/${equipment.site.id}` },
          { label: name },
        ]}
        title={name}
        description={
          [equipment.brand, equipment.model].filter(Boolean).join(" ") ||
          equipment.type.label
        }
        actions={
          <>
            <QrPanel
              equipmentId={equipment.id}
              svg={qrSvg}
              url={equipmentQrUrl(equipment.qrToken)}
              title={name}
              subtitle={`${equipment.site.customer.name} — ${equipment.site.name}`}
              canRegenerate={can(role, "equipment.update")}
            />
            {can(role, "equipment.update") && (
              <Button asChild variant="outline" className="gap-1.5">
                <Link href={`/equipements/${equipment.id}/modifier`}>
                  <Pencil className="size-4" />
                  Modifier
                </Link>
              </Button>
            )}
            <Button asChild className="gap-1.5">
              <Link href={`/interventions/nouvelle?equipement=${equipment.id}`}>
                <Plus className="size-4" />
                Intervention
              </Link>
            </Button>
          </>
        }
      />

      {!equipment.active && (
        <div className="mb-6 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Cet équipement est retiré du parc. Son historique reste consultable.
        </div>
      )}

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <FieldGrid className="lg:grid-cols-4">
          <Field label="Type">{equipment.type.label}</Field>
          <Field label="Marque et modèle">
            {[equipment.brand, equipment.model].filter(Boolean).join(" ") || "—"}
          </Field>
          <Field label="Numéro de série">
            {equipment.serialNumber ? (
              <span className="font-mono text-xs">{equipment.serialNumber}</span>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Installé le">{formatDate(equipment.installedAt)}</Field>

          <Field label="Client">
            <Link
              href={`/clients/${equipment.site.customer.id}`}
              className="font-medium hover:underline"
            >
              {equipment.site.customer.name}
            </Link>
          </Field>
          <Field label="Site">
            <Link
              href={`/sites/${equipment.site.id}`}
              className="inline-flex items-start gap-1.5 hover:underline"
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span>
                {equipment.site.name}
                <span className="block text-xs text-muted-foreground">
                  {formatAddress(equipment.site)}
                </span>
              </span>
            </Link>
          </Field>
          <Field label="Emplacement">{equipment.location ?? "—"}</Field>
          <Field label="Prochaine échéance">
            <span
              className={cn(
                overdue && "font-medium text-severity-high",
              )}
            >
              {formatDate(equipment.nextDueAt)}
              {equipment.nextDueAt && (
                <span className="block text-xs opacity-70">
                  {formatRelative(equipment.nextDueAt)}
                </span>
              )}
            </span>
          </Field>
        </FieldGrid>

        {(equipment.description || equipment.notes) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {equipment.description && (
              <div className="rounded-lg bg-muted/60 p-3.5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Description
                </p>
                <p className="mt-1.5 text-sm whitespace-pre-wrap">
                  {equipment.description}
                </p>
              </div>
            )}
            {equipment.notes && (
              <div className="rounded-lg bg-muted/60 p-3.5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Notes techniques
                </p>
                <p className="mt-1.5 text-sm whitespace-pre-wrap">
                  {equipment.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {equipment.openAnomalies > 0 && (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-severity-high/25 bg-severity-high/8 px-3.5 py-3 text-sm text-severity-high">
            <TriangleAlert className="size-4 shrink-0" />
            <span className="font-medium">
              {plural(
                equipment.openAnomalies,
                "anomalie ouverte",
                "anomalies ouvertes",
              )}{" "}
              sur cet équipement
            </span>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading mb-4 text-lg font-semibold">
          Historique
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {plural(equipment.interventions.length, "intervention")}
          </span>
        </h2>

        {equipment.interventions.length === 0 && !equipment.installedAt ? (
          <EmptyState
            title="Aucun historique"
            description="Les interventions réalisées sur cet équipement apparaîtront ici, année par année."
            action={
              <Button asChild>
                <Link href={`/interventions/nouvelle?equipement=${equipment.id}`}>
                  Planifier une intervention
                </Link>
              </Button>
            }
          />
        ) : (
          <EquipmentHistory
            interventions={equipment.interventions}
            installedAt={equipment.installedAt}
            nextDueAt={equipment.nextDueAt}
          />
        )}
      </section>

      {can(role, "equipment.delete") && (
        <div className="mt-10 border-t border-border pt-6">
          <DeleteEquipment
            id={equipment.id}
            name={name}
            siteId={equipment.site.id}
            interventionCount={equipment.interventions.length}
          />
        </div>
      )}
    </>
  );
}
