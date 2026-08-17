import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Plus, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { Pagination } from "@/components/vennora/pagination";
import { SearchInput } from "@/components/vennora/search-input";
import { getPageContext } from "@/core/context";
import { listSites } from "@/core/data/sites";
import { can } from "@/core/permissions";
import { plural } from "@/core/labels";
import { listQuerySchema } from "@/core/schemas";
import { formatAddress } from "@/lib/format";

export const metadata: Metadata = { title: "Sites" };

export default async function SitesPage({ searchParams }: PageProps<"/sites">) {
  const context = await getPageContext("site.view");
  const params = await searchParams;
  const query = listQuerySchema.parse(params);

  const { items, total, page, pageCount } = await listSites(context, query);
  const canCreate = can(context.user.role, "site.create");

  return (
    <>
      <PageHeader
        title="Sites"
        description="Lieux d'intervention rattachés à vos clients."
        actions={
          canCreate && (
            <Button asChild className="gap-1.5">
              <Link href="/sites/nouveau">
                <Plus className="size-4" />
                Nouveau site
              </Link>
            </Button>
          )
        }
      />

      <SearchInput
        placeholder="Nom du site, adresse, ville ou client…"
        className="mb-4 max-w-md"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={query.q ? "Aucun résultat" : "Aucun site"}
          description={
            query.q
              ? `Aucun site ne correspond à « ${query.q} ».`
              : "Les sites sont les adresses où se déroulent les interventions. Un client peut en avoir plusieurs."
          }
          action={
            canCreate &&
            !query.q && (
              <Button asChild>
                <Link href="/sites/nouveau">Créer un site</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((site) => (
              <li key={site.id}>
                <Link
                  href={`/sites/${site.id}`}
                  className="flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/25 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <p className="font-medium">{site.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {site.customer.name}
                  </p>
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    <span>{formatAddress(site)}</span>
                  </p>
                  <div className="mt-auto flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Wrench className="size-3.5" />
                      {plural(site._count.equipments, "équipement")}
                    </span>
                    <span>
                      {plural(site._count.interventions, "intervention")}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            label={total > 1 ? "sites" : "site"}
            searchParams={params}
            basePath="/sites"
          />
        </>
      )}
    </>
  );
}
