import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { InterventionCard } from "@/components/vennora/intervention-card";
import { Pagination } from "@/components/vennora/pagination";
import { SearchInput } from "@/components/vennora/search-input";
import { getInterventionTypes } from "@/core/catalog";
import { getPageContext } from "@/core/context";
import { listInterventions, listTechnicians } from "@/core/data/interventions";
import { INTERVENTION_STATUS_LABEL } from "@/core/labels";
import { listQuerySchema, objectId } from "@/core/schemas";
import { InterventionStatus, UserRole } from "@/core/enums";
import { formatDayMonth, isSameDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Interventions" };

const STATUSES = [
  InterventionStatus.PLANNED,
  InterventionStatus.IN_PROGRESS,
  InterventionStatus.COMPLETED,
  InterventionStatus.CANCELLED,
] as const;

export default async function InterventionsPage({
  searchParams,
}: PageProps<"/interventions">) {
  const context = await getPageContext("intervention.view");
  const params = await searchParams;
  const query = listQuerySchema.parse(params);

  const status = STATUSES.find((s) => s === params.statut);
  const technicianId =
    typeof params.technicien === "string" &&
    objectId.safeParse(params.technicien).success
      ? params.technicien
      : undefined;
  const typeId =
    typeof params.type === "string" && objectId.safeParse(params.type).success
      ? params.type
      : undefined;

  const [{ items, total, page, pageCount }, technicians, types] =
    await Promise.all([
      listInterventions(context, { ...query, status, technicianId, typeId }),
      listTechnicians(context),
      getInterventionTypes(context.user.org.tradeSlug),
    ]);

  const isAdmin = context.user.role === UserRole.ADMIN;

  // Regroupement par jour : une liste plate de trente interventions sur six
  // semaines est illisible ; la date est le repère naturel.
  const groups: Array<{ date: Date; items: typeof items }> = [];
  for (const intervention of items) {
    const last = groups.at(-1);
    if (last && isSameDay(last.date, intervention.scheduledStart)) {
      last.items.push(intervention);
    } else {
      groups.push({
        date: intervention.scheduledStart,
        items: [intervention],
      });
    }
  }

  const buildHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && key !== "page") next.set(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    return qs ? `/interventions?${qs}` : "/interventions";
  };

  return (
    <>
      <PageHeader
        title="Interventions"
        description={
          isAdmin
            ? "Toutes les interventions de l'entreprise."
            : "Les interventions qui vous sont assignées."
        }
        actions={
          <Button asChild className="gap-1.5">
            <Link href="/interventions/nouvelle">
              <Plus className="size-4" />
              Nouvelle intervention
            </Link>
          </Button>
        }
      />

      <div className="mb-5 space-y-3">
        <SearchInput
          placeholder="Référence, client, adresse…"
          className="max-w-md"
        />

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={buildHref({ statut: undefined })} active={!status}>
            Tous les statuts
          </FilterChip>
          {STATUSES.map((value) => (
            <FilterChip
              key={value}
              href={buildHref({ statut: value })}
              active={status === value}
            >
              {INTERVENTION_STATUS_LABEL[value]}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={buildHref({ type: undefined })} active={!typeId}>
            Tous les types
          </FilterChip>
          {types.map((type) => (
            <FilterChip
              key={type.id}
              href={buildHref({ type: type.id })}
              active={typeId === type.id}
            >
              {type.label}
            </FilterChip>
          ))}
        </div>

        {isAdmin && technicians.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              href={buildHref({ technicien: undefined })}
              active={!technicianId}
            >
              Toute l&apos;équipe
            </FilterChip>
            {technicians.map((technician) => (
              <FilterChip
                key={technician.id}
                href={buildHref({ technicien: technician.id })}
                active={technicianId === technician.id}
              >
                {technician.firstName} {technician.lastName.charAt(0)}.
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune intervention"
          description="Aucune intervention ne correspond à ces critères."
          action={
            <Button asChild variant="outline">
              <Link href="/interventions">Réinitialiser les filtres</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.date.toISOString()}>
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                  {capitalize(formatDayMonth(group.date))}
                </h2>
                <div className="space-y-2">
                  {group.items.map((intervention) => (
                    <InterventionCard
                      key={intervention.id}
                      intervention={intervention}
                      showTechnician={isAdmin}
                      showReference
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            label={total > 1 ? "interventions" : "intervention"}
            searchParams={params}
            basePath="/interventions"
          />
        </>
      )}
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
