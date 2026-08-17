import Link from "next/link";
import { Camera, ChevronRight, MapPin, TriangleAlert } from "lucide-react";

import { StatusBadge, TechnicianChip, TypeBadge } from "@/components/vennora/badges";
import type { InterventionCard as Data } from "@/core/data/dashboard";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Ligne d'intervention.
 *
 * Même composant sur le tableau de bord, la liste et le planning : le
 * technicien reconnaît la même carte partout. L'heure est la première chose
 * lue, en gros et à gauche — c'est l'information qui structure une journée
 * de tournée.
 */
export function InterventionCard({
  intervention,
  showTechnician = false,
  className,
}: {
  intervention: Data;
  showTechnician?: boolean;
  className?: string;
}) {
  const { site, equipment } = intervention;
  const anomalies = intervention._count.anomalies;
  const photos = intervention._count.photos;

  return (
    <Link
      href={`/interventions/${intervention.id}`}
      className={cn(
        "group flex items-stretch gap-3 rounded-lg border border-border bg-card p-3 transition-colors",
        "hover:border-primary/25 hover:bg-accent/40",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        intervention.status === "CANCELLED" && "opacity-55",
        className,
      )}
    >
      <div className="flex w-14 shrink-0 flex-col items-start pt-0.5">
        <span className="font-heading text-lg leading-none font-semibold tabular-nums">
          {formatTime(intervention.scheduledStart)}
        </span>
        <span className="mt-1 text-xs text-muted-foreground tabular-nums">
          {formatTime(intervention.scheduledEnd)}
        </span>
      </div>

      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: intervention.type.colorHex }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium">
            {intervention.customer.name}
          </span>
          <StatusBadge status={intervention.status} />
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {site.address}
            {site.city ? `, ${site.city}` : ""}
          </span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TypeBadge
            label={intervention.type.label}
            colorHex={intervention.type.colorHex}
          />
          {equipment && (
            <span className="truncate text-xs text-muted-foreground">
              {equipment.label ??
                `${equipment.type.label}${equipment.brand ? ` ${equipment.brand}` : ""}`}
            </span>
          )}
          {anomalies > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-severity-high">
              <TriangleAlert className="size-3.5" />
              {anomalies}
            </span>
          )}
          {photos > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="size-3.5" />
              {photos}
            </span>
          )}
          {showTechnician && (
            <TechnicianChip
              firstName={intervention.technician.firstName}
              lastName={intervention.technician.lastName}
              colorHex={intervention.technician.colorHex}
              className="ml-auto"
            />
          )}
        </div>
      </div>

      <ChevronRight className="my-auto size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
