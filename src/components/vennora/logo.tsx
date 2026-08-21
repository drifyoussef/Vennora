import { cn } from "@/lib/utils";

/**
 * Marque Vennora.
 *
 * Le « V » est tracé comme un conduit vu en coupe : deux montants qui
 * convergent, avec une amorce ambre au point de rencontre. Il fonctionne à
 * 20 px dans une barre de navigation comme à 200 px sur un rapport imprimé,
 * et reste lisible en monochrome sur un PDF noir et blanc.
 */
export function VennoraMark({
  className,
  monochrome = false,
}: {
  className?: string;
  monochrome?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <path
        d="M6 5.5 L16 26 L26 5.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 26 L20.6 16.5"
        stroke={monochrome ? "currentColor" : "var(--brand)"}
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity={monochrome ? 0.55 : 1}
      />
    </svg>
  );
}

export function VennoraLogo({
  className,
  showWordmark = true,
  subtitle,
  badge,
}: {
  className?: string;
  showWordmark?: boolean;
  subtitle?: string;
  /** Pastille posée à côté du sous-titre — l'offre, dans la barre latérale. */
  badge?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <VennoraMark className="size-7 shrink-0" />
      {showWordmark && (
        <div className="min-w-0 leading-none">
          <div className="font-heading text-[17px] font-semibold tracking-tight">
            Vennora Ramonage
          </div>
          {subtitle && (
            // La pastille passe à la ligne plutôt que de rogner le nom de
            // l'entreprise : « Ramonage Cév… » est une information perdue,
            // une seconde ligne n'est qu'un peu de place.
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="truncate text-[11px] font-medium opacity-60">
                {subtitle}
              </span>
              {badge}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
