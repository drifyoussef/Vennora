import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Pagination.
 *
 * Précédent / suivant plutôt qu'une rangée de numéros : sur un fichier de
 * quelques centaines de clients, la recherche est le vrai outil de
 * navigation, la pagination n'est qu'un filet.
 */
export function Pagination({
  page,
  pageCount,
  total,
  label,
  searchParams,
  basePath,
}: {
  page: number;
  pageCount: number;
  total: number;
  label: string;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  if (pageCount <= 1) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        {total} {label}
      </p>
    );
  }

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page") continue;
      if (typeof value === "string") params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between gap-4"
    >
      <p className="text-sm text-muted-foreground">
        {total} {label} · page {page} sur {pageCount}
      </p>

      <div className="flex gap-2">
        <Button
          asChild={page > 1}
          variant="outline"
          size="sm"
          disabled={page <= 1}
          className="gap-1"
        >
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev">
              <ChevronLeft className="size-4" />
              Précédent
            </Link>
          ) : (
            <span>
              <ChevronLeft className="size-4" />
              Précédent
            </span>
          )}
        </Button>

        <Button
          asChild={page < pageCount}
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          className="gap-1"
        >
          {page < pageCount ? (
            <Link href={href(page + 1)} rel="next">
              Suivant
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span>
              Suivant
              <ChevronRight className="size-4" />
            </span>
          )}
        </Button>
      </div>
    </nav>
  );
}
