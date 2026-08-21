import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Plus, Upload, UserRound, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { Pagination } from "@/components/vennora/pagination";
import { SearchInput } from "@/components/vennora/search-input";
import { getPageContext } from "@/core/context";
import { listCustomers } from "@/core/data/customers";
import { can } from "@/core/permissions";
import { listQuerySchema } from "@/core/schemas";
import { CustomerKind } from "@/core/enums";
import { formatDate, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clients" };

export default async function CustomersPage({
  searchParams,
}: PageProps<"/clients">) {
  const context = await getPageContext("customer.view");
  const params = await searchParams;
  const query = listQuerySchema.parse(params);

  const { items, total, page, pageCount } = await listCustomers(context, query);
  const canCreate = can(context.user.role, "customer.create");

  return (
    <>
      <PageHeader
        title="Clients"
        description="Particuliers et professionnels suivis par l'entreprise."
        actions={
          canCreate && (
            <div className="flex flex-wrap gap-2">
              {/* La reprise est proposée à côté de la création : c'est au
                  moment où l'on découvre une liste vide qu'on se demande
                  comment y faire entrer trois cents fiches. */}
              <Button asChild variant="outline" className="gap-1.5">
                <Link href="/clients/import">
                  <Upload className="size-4" />
                  Reprendre un fichier
                </Link>
              </Button>
              <Button asChild className="gap-1.5">
                <Link href="/clients/nouveau">
                  <Plus className="size-4" />
                  Nouveau client
                </Link>
              </Button>
            </div>
          )
        }
      />

      <SearchInput
        placeholder="Nom, téléphone, e-mail, ville ou adresse…"
        className="mb-4 max-w-md"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query.q ? "Aucun résultat" : "Aucun client"}
          description={
            query.q
              ? `Aucun client ne correspond à « ${query.q} ».`
              : "Créez votre premier client pour commencer à planifier des interventions."
          }
          action={
            canCreate &&
            !query.q && (
              <Button asChild>
                <Link href="/clients/nouveau">Créer un client</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Tableau sur écran large, cartes sur téléphone : une ligne de
              tableau à sept colonnes est illisible sous 640 px. */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="text-right">Sites</TableHead>
                  <TableHead>Dernière</TableHead>
                  <TableHead>Prochaine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((customer) => (
                  <TableRow key={customer.id} className="group">
                    <TableCell className="font-medium">
                      <Link
                        href={`/clients/${customer.id}`}
                        className="flex items-center gap-2 rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {customer.kind === CustomerKind.COMPANY ? (
                          <Building2 className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <UserRound className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPhone(customer.phone)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">
                      {customer.email ?? "—"}
                    </TableCell>
                    <TableCell>{customer.city ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {customer._count.sites}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(customer.lastInterventionAt)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums",
                        customer.nextInterventionAt
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatDate(customer.nextInterventionAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-2 md:hidden">
            {items.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/clients/${customer.id}`}
                  className="block rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2">
                    {customer.kind === CustomerKind.COMPANY ? (
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <UserRound className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-medium">{customer.name}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[formatPhone(customer.phone), customer.city]
                      .filter((v) => v && v !== "—")
                      .join(" · ") || "—"}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {customer._count.sites} site
                    {customer._count.sites > 1 ? "s" : ""}
                    {customer.nextInterventionAt &&
                      ` · prochaine le ${formatDate(customer.nextInterventionAt)}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            label={total > 1 ? "clients" : "client"}
            searchParams={params}
            basePath="/clients"
          />
        </>
      )}
    </>
  );
}
