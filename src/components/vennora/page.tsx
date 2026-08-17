import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chrome de page : fil d'Ariane, titre, actions.
 *
 * Un seul composant pour tous les écrans desktop, pour que le titre soit
 * toujours à la même hauteur d'une page à l'autre — c'est ce qui donne
 * l'impression d'un outil et non d'un assemblage d'écrans.
 */

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Fil d'Ariane"
          className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 opacity-50" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * État vide.
 *
 * Toujours proposer l'action qui remplit l'écran : un tableau vide sans
 * bouton oblige l'utilisateur à deviner où aller.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Libellé + valeur, l'unité d'affichage des fiches. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm break-words">{children ?? "—"}</dd>
    </div>
  );
}

export function FieldGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </dl>
  );
}
