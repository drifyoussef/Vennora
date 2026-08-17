import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Plus, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { Pagination } from "@/components/vennora/pagination";
import { SearchInput } from "@/components/vennora/search-input";
import { getPageContext } from "@/core/context";
import { listEquipment } from "@/core/data/equipment";
import { can } from "@/core/permissions";
import { listQuerySchema } from "@/core/schemas";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Équipements" };

export default async function EquipmentPage({
  searchParams,
}: PageProps<"/equipements">) {
  const context = await getPageContext("equipment.view");
  const params = await searchParams;
  const query = listQuerySchema.parse(params);
  const overdue = params.echeance === "depassee";

  const { items, total, page, pageCount } = await listEquipment(context, {
    ...query,
    overdue,
  });
  const canCreate = can(context.user.role, "equipment.create");
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Équipements"
        description="Parc suivi par l'entreprise, trié par échéance la plus proche."
        actions={
          canCreate && (
            <Button asChild className="gap-1.5">
              <Link href="/equipements/nouveau">
                <Plus className="size-4" />
                Nouvel équipement
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Marque, modèle, n° de série, client, ville…"
          className="max-w-md flex-1"
        />
        <Button
          asChild
          variant={overdue ? "default" : "outline"}
          size="sm"
          className="shrink-0"
        >
          <Link href={overdue ? "/equipements" : "/equipements?echeance=depassee"}>
            {overdue ? "Tout afficher" : "Échéance dépassée"}
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={query.q || overdue ? "Aucun résultat" : "Aucun équipement"}
          description={
            overdue
              ? "Aucun équipement n'a d'échéance dépassée. Bonne nouvelle."
              : query.q
                ? `Aucun équipement ne correspond à « ${query.q} ».`
                : "Déclarez les appareils de vos clients pour suivre leur historique et générer leurs QR codes."
          }
          action={
            canCreate &&
            !query.q &&
            !overdue && (
              <Button asChild>
                <Link href="/equipements/nouveau">Créer un équipement</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((equipment) => {
              const late = equipment.nextDueAt && equipment.nextDueAt < now;

              return (
                <li key={equipment.id}>
                  <Link
                    href={`/equipements/${equipment.id}`}
                    className="flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/25 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

                    <p className="mt-2 flex items-start gap-1.5 text-sm">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate">
                          {equipment.site.customer.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {equipment.site.name} · {equipment.site.city}
                        </span>
                      </span>
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                      <span className="text-muted-foreground">
                        {equipment._count.interventions} passage
                        {equipment._count.interventions > 1 ? "s" : ""}
                      </span>
                      <span
                        className={cn(
                          late
                            ? "font-medium text-severity-high"
                            : "text-muted-foreground",
                        )}
                      >
                        {equipment.nextDueAt
                          ? `Échéance ${formatDate(equipment.nextDueAt)}`
                          : "Jamais intervenu"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            label={total > 1 ? "équipements" : "équipement"}
            searchParams={params}
            basePath="/equipements"
          />
        </>
      )}
    </>
  );
}
