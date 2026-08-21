import type { AnomalySeverity, InterventionStatus, Plan } from "@/core/enums";
import {
  ANOMALY_SEVERITY_LABEL,
  ANOMALY_SEVERITY_TONE,
  INTERVENTION_STATUS_LABEL,
  INTERVENTION_STATUS_TONE,
} from "@/core/labels";
import { libelleOffre } from "@/core/plans";
import { cn } from "@/lib/utils";

/**
 * Pastilles de statut et de gravité.
 *
 * Volontairement sobres : un fond très pâle et un texte teinté, jamais de
 * couleur pleine. Sur un écran de planning qui affiche trente lignes, des
 * pastilles saturées transforment la page en sapin de Noël et on ne voit
 * plus ce qui compte.
 */

const base =
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({
  status,
  className,
}: {
  status: InterventionStatus;
  className?: string;
}) {
  return (
    <span className={cn(base, INTERVENTION_STATUS_TONE[status], className)}>
      {status === "IN_PROGRESS" && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {INTERVENTION_STATUS_LABEL[status]}
    </span>
  );
}

export function SeverityBadge({
  severity,
  count,
  className,
}: {
  severity: AnomalySeverity;
  /** Renseigné, le nombre entre dans la pastille et le libellé se met au
   *  pluriel : « 3 élevées » se lit d'un coup, contrairement à un compteur
   *  posé à côté qu'il faut rattacher à sa pastille. */
  count?: number;
  className?: string;
}) {
  const libelle = ANOMALY_SEVERITY_LABEL[severity];
  return (
    <span className={cn(base, ANOMALY_SEVERITY_TONE[severity], className)}>
      {count === undefined ? (
        libelle
      ) : (
        <>
          <span className="font-semibold tabular-nums">{count}</span>
          <span className="ml-1">
            {count > 1 ? `${libelle.toLowerCase()}s` : libelle.toLowerCase()}
          </span>
        </>
      )}
    </span>
  );
}

/** Pastille colorée d'un type d'intervention, couleur venant du catalogue. */
export function TypeBadge({
  label,
  colorHex,
  className,
}: {
  label: string;
  colorHex: string;
  className?: string;
}) {
  return (
    <span
      className={cn(base, "border-transparent", className)}
      style={{
        backgroundColor: `color-mix(in oklab, ${colorHex} 12%, transparent)`,
        color: colorHex,
        borderColor: `color-mix(in oklab, ${colorHex} 25%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

/** Pastille d'initiales pour identifier un technicien d'un coup d'œil. */
export function TechnicianChip({
  firstName,
  lastName,
  colorHex,
  showName = false,
  className,
}: {
  firstName: string;
  lastName: string;
  colorHex?: string | null;
  showName?: boolean;
  className?: string;
}) {
  const color = colorHex ?? "var(--muted-foreground)";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: color }}
        title={`${firstName} ${lastName}`}
      >
        {`${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()}
      </span>
      {showName && (
        <span className="truncate text-sm">
          {firstName} {lastName}
        </span>
      )}
    </span>
  );
}

const OFFRE_TON: Record<Plan, string> = {
  ESSENTIEL: "bg-offre-essentiel text-offre-essentiel-foreground",
  FONDATEUR: "bg-offre-fondateur text-offre-fondateur-foreground",
  PRO: "bg-offre-pro text-offre-pro-foreground",
  BUSINESS: "bg-offre-business text-offre-business-foreground",
  ENTREPRISE: "bg-offre-entreprise text-offre-entreprise-foreground",
};

/**
 * Offre souscrite, affichée à côté du nom de l'entreprise.
 *
 * Purement informatif : rien ici ne donne de droit. Ce qui ouvre une
 * fonctionnalité est la matrice de `core/plans.ts`, appliquée côté serveur.
 */
export function OffreBadge({ plan, className }: { plan: Plan; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        OFFRE_TON[plan],
        className,
      )}
    >
      {libelleOffre(plan)}
    </span>
  );
}
