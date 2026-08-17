import Link from "next/link";
import { Camera, CheckCircle2, CircleDashed, FileText, TriangleAlert } from "lucide-react";

import { SeverityBadge, TechnicianChip } from "@/components/vennora/badges";
import type { EquipmentDetail } from "@/core/data/equipment";
import { INTERVENTION_STATUS_LABEL } from "@/core/labels";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Historique de l'équipement, groupé par année.
 *
 * C'est l'écran qui justifie de saisir les équipements plutôt que de se
 * contenter d'un carnet : voir en trois secondes que la fissure signalée en
 * 2025 n'a toujours pas été reprise. Les anomalies sont donc affichées à même
 * la ligne d'intervention, pas repliées derrière un clic.
 */
export function EquipmentHistory({
  interventions,
  installedAt,
  nextDueAt,
}: {
  interventions: EquipmentDetail["interventions"];
  installedAt: Date | null;
  nextDueAt: Date | null;
}) {
  const byYear = new Map<number, EquipmentDetail["interventions"]>();
  for (const intervention of interventions) {
    const year = intervention.scheduledStart.getFullYear();
    const bucket = byYear.get(year);
    if (bucket) bucket.push(intervention);
    else byYear.set(year, [intervention]);
  }

  const years = [...byYear.keys()].sort((a, b) => b - a);
  const now = new Date();
  const overdue = nextDueAt && nextDueAt < now;

  return (
    <div className="relative">
      {/* Filet vertical du fil chronologique. */}
      <div
        className="absolute top-2 bottom-2 left-[7px] w-px bg-border"
        aria-hidden="true"
      />

      <ol className="space-y-8">
        {nextDueAt && (
          <li className="relative pl-8">
            <Dot tone={overdue ? "alert" : "next"} />
            <p
              className={cn(
                "font-heading text-sm font-semibold",
                overdue ? "text-severity-high" : "text-brand",
              )}
            >
              {formatDate(nextDueAt)}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {overdue
                ? "Échéance dépassée — intervention à replanifier"
                : "Prochaine intervention conseillée"}
            </p>
          </li>
        )}

        {years.map((year) => (
          <li key={year} className="relative pl-8">
            <Dot tone="year" />
            <p className="font-heading text-lg leading-none font-semibold tabular-nums">
              {year}
            </p>

            <ul className="mt-3 space-y-3">
              {byYear.get(year)!.map((intervention) => {
                const openAnomalies = intervention.anomalies.filter(
                  (a) => a.status === "OPEN",
                );

                return (
                  <li
                    key={intervention.id}
                    className="rounded-lg border border-border bg-card p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {intervention.status === "COMPLETED" ? (
                        <CheckCircle2 className="size-4 shrink-0 text-status-done" />
                      ) : (
                        <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <Link
                        href={`/interventions/${intervention.id}`}
                        className="font-medium hover:underline"
                      >
                        {intervention.type.label}
                      </Link>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {formatDate(intervention.scheduledStart)}
                      </span>
                      {intervention.status !== "COMPLETED" && (
                        <span className="text-xs text-muted-foreground">
                          {INTERVENTION_STATUS_LABEL[intervention.status]}
                        </span>
                      )}

                      <span className="ml-auto flex items-center gap-3">
                        {intervention._count.photos > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Camera className="size-3.5" />
                            {intervention._count.photos}
                          </span>
                        )}
                        {intervention.report?.validatedAt && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                            title="Rapport validé"
                          >
                            <FileText className="size-3.5" />
                          </span>
                        )}
                        <TechnicianChip
                          firstName={intervention.technician.firstName}
                          lastName={intervention.technician.lastName}
                          colorHex={intervention.technician.colorHex}
                        />
                      </span>
                    </div>

                    {intervention.anomalies.length === 0 ? (
                      intervention.status === "COMPLETED" && (
                        <p className="mt-2 text-sm text-status-done">
                          Conforme — aucune anomalie relevée
                        </p>
                      )
                    ) : (
                      <ul className="mt-2.5 space-y-1.5">
                        {intervention.anomalies.map((anomaly) => (
                          <li
                            key={anomaly.id}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <TriangleAlert
                              className={cn(
                                "size-3.5 shrink-0",
                                anomaly.status === "OPEN"
                                  ? "text-severity-high"
                                  : "text-muted-foreground",
                              )}
                            />
                            <span
                              className={cn(
                                anomaly.status !== "OPEN" &&
                                  "text-muted-foreground line-through decoration-1",
                              )}
                            >
                              {anomaly.title}
                            </span>
                            <SeverityBadge severity={anomaly.severity} />
                            {anomaly.status === "RESOLVED" && (
                              <span className="text-xs text-status-done">
                                résolue
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {openAnomalies.length > 0 &&
                      openAnomalies[0].recommendation && (
                        <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-sm text-muted-foreground">
                          {openAnomalies[0].recommendation}
                        </p>
                      )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}

        {installedAt && (
          <li className="relative pl-8">
            <Dot tone="origin" />
            <p className="font-heading text-lg leading-none font-semibold tabular-nums">
              {installedAt.getFullYear()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Installation — {formatDate(installedAt)}
            </p>
          </li>
        )}
      </ol>
    </div>
  );
}

function Dot({ tone }: { tone: "year" | "next" | "alert" | "origin" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-1 left-0 size-[15px] rounded-full border-2 border-background",
        tone === "year" && "bg-primary",
        tone === "next" && "bg-brand",
        tone === "alert" && "bg-severity-high",
        tone === "origin" && "bg-muted-foreground/40",
      )}
    />
  );
}
