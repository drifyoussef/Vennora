import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Squelettes de chargement.
 *
 * Ils reprennent la géométrie réelle des écrans — hauteur d'en-tête, nombre de
 * colonnes, gabarit des cartes — pour que le passage au contenu ne fasse pas
 * sauter la page. Un squelette qui ne ressemble pas à ce qui arrive est pire
 * qu'une page vide : il déplace tout au moment du remplacement.
 */

export function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      {withAction && <Skeleton className="h-9 w-44" />}
    </div>
  );
}

/** Grille de cartes : sites, équipements. */
export function CardGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-border bg-card p-4"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <div className="flex justify-between border-t border-border pt-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lignes d'intervention : tableau de bord, liste, planning en vue jour. */
export function RowListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-stretch gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="w-14 space-y-1.5">
            <Skeleton className="h-5 w-11" />
            <Skeleton className="h-3 w-9" />
          </div>
          <Skeleton className="w-1 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tableau dense : liste des clients sur écran large. */
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-28 sm:block" />
            <Skeleton className="hidden h-4 w-40 md:block" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bloc de fiche : bandeau de champs au-dessus du contenu. */
export function DetailSkeleton({
  panels = 3,
  aside = true,
}: {
  panels?: number;
  aside?: boolean;
}) {
  return (
    <div className={cn("grid gap-6", aside && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
      <div className="space-y-5">
        {Array.from({ length: panels }, (_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-border bg-card p-5"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>

      {aside && (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-border bg-card p-5"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barre de recherche et de filtres, présente en tête de la plupart des listes. */
export function FiltersSkeleton({ chips = 0 }: { chips?: number }) {
  return (
    <div className="mb-4 space-y-3">
      <Skeleton className="h-10 w-full max-w-md" />
      {chips > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: chips }, (_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
      )}
    </div>
  );
}
