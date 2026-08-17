import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/vennora/badges";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { ANOMALY_STATUS_LABEL, plural } from "@/core/labels";
import { objectId } from "@/core/schemas";
import { AnomalySeverity, AnomalyStatus, UserRole } from "@/core/enums";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Anomalies" };

const STATUSES = [
  AnomalyStatus.OPEN,
  AnomalyStatus.RESOLVED,
  AnomalyStatus.IGNORED,
] as const;

export default async function AnomaliesPage({
  searchParams,
}: PageProps<"/anomalies">) {
  const { db, user } = await getPageContext("anomaly.view");
  const params = await searchParams;

  const status =
    STATUSES.find((s) => s === params.statut) ?? AnomalyStatus.OPEN;
  const customerId =
    typeof params.client === "string" &&
    objectId.safeParse(params.client).success
      ? params.client
      : undefined;

  const anomalies = await db.anomaly.findMany({
    where: {
      status,
      ...(customerId ? { intervention: { customerId } } : {}),
      // Un technicien ne voit que les anomalies qu'il a lui-même relevées.
      ...(user.role === UserRole.TECHNICIAN
        ? { intervention: { technicianId: user.id } }
        : {}),
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      description: true,
      severity: true,
      status: true,
      recommendation: true,
      createdAt: true,
      intervention: {
        select: {
          id: true,
          reference: true,
          scheduledStart: true,
          customer: { select: { id: true, name: true } },
          site: { select: { id: true, name: true, city: true } },
        },
      },
      equipment: {
        select: { id: true, label: true, type: { select: { label: true } } },
      },
    },
  });

  const bySeverity = new Map<AnomalySeverity, number>();
  for (const anomaly of anomalies) {
    bySeverity.set(anomaly.severity, (bySeverity.get(anomaly.severity) ?? 0) + 1);
  }

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") next.set(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    return qs ? `/anomalies?${qs}` : "/anomalies";
  };

  return (
    <>
      <PageHeader
        title="Anomalies"
        description="Constats relevés sur le terrain, du plus grave au plus récent."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={href({ statut: value })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              status === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {ANOMALY_STATUS_LABEL[value]}
          </Link>
        ))}
        {customerId && (
          <Link
            href={href({ client: undefined })}
            className="rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
          >
            Retirer le filtre client
          </Link>
        )}
      </div>

      {anomalies.length === 0 ? (
        <EmptyState
          icon={status === AnomalyStatus.OPEN ? CheckCircle2 : TriangleAlert}
          title={
            status === AnomalyStatus.OPEN
              ? "Aucune anomalie ouverte"
              : "Aucune anomalie"
          }
          description={
            status === AnomalyStatus.OPEN
              ? "Tout le parc suivi est conforme aux derniers passages."
              : "Aucune anomalie ne correspond à ce filtre."
          }
        />
      ) : (
        <>
          {status === AnomalyStatus.OPEN && bySeverity.size > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {[...bySeverity.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([severity, count]) => (
                  <span
                    key={severity}
                    className="inline-flex items-center gap-1.5"
                  >
                    <SeverityBadge severity={severity} />
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </span>
                ))}
            </div>
          )}

          <ul className="space-y-2">
            {anomalies.map((anomaly) => (
              <li
                key={anomaly.id}
                className={cn(
                  "rounded-lg border bg-card p-4",
                  anomaly.status === AnomalyStatus.OPEN &&
                    (anomaly.severity === "CRITICAL" ||
                      anomaly.severity === "HIGH")
                    ? "border-severity-high/30"
                    : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <TriangleAlert
                    className={cn(
                      "size-4 shrink-0",
                      anomaly.status === AnomalyStatus.OPEN
                        ? "text-severity-high"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="font-medium">{anomaly.title}</span>
                  <SeverityBadge severity={anomaly.severity} />
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {formatDate(anomaly.createdAt)}
                  </span>
                </div>

                {anomaly.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {anomaly.description}
                  </p>
                )}

                {anomaly.recommendation && (
                  <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">
                    <span className="font-medium">Recommandation · </span>
                    {anomaly.recommendation}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-sm">
                  <Link
                    href={`/clients/${anomaly.intervention.customer.id}`}
                    className="font-medium hover:underline"
                  >
                    {anomaly.intervention.customer.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {anomaly.intervention.site.name} ·{" "}
                    {anomaly.intervention.site.city}
                  </span>
                  {anomaly.equipment && (
                    <Link
                      href={`/equipements/${anomaly.equipment.id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {anomaly.equipment.label ?? anomaly.equipment.type.label}
                    </Link>
                  )}
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-8"
                  >
                    <Link href={`/interventions/${anomaly.intervention.id}`}>
                      {anomaly.intervention.reference}
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">
            {plural(anomalies.length, "anomalie")}
            {anomalies.length === 100 && " (100 premières)"}
          </p>
        </>
      )}
    </>
  );
}
